import { tintToRgba } from './core/color';
import { computeBand, computePieces, type Offset } from './core/geometry';
import { fractionToY, nextMode, yToFraction, type InputMode } from './core/input';
import { resolveTintColor } from './core/settings';
import type { RulerModel } from './core/state';

export interface OverlayCallbacks {
	/** Called live while the handle is dragged. */
	onFractionChange(fraction: number): void;
	/** Called when the drag ends, so the new position can be persisted. */
	onFractionCommit(): void;
}

interface Point {
	x: number;
	y: number;
}

type BrowserWindow = Window & typeof window;

const PASSIVE: AddEventListenerOptions = { passive: true };

/** Has to match --rr-handle-size in styles.css. */
const HANDLE_SIZE = 44;

type PieceName = 'band' | 'dimTop' | 'dimBottom' | 'dimLeft' | 'dimRight' | 'handle';

const PIECE_CLASSES: Record<PieceName, string> = {
	dimTop: 'reading-ruler-dim mod-top',
	dimBottom: 'reading-ruler-dim mod-bottom',
	dimLeft: 'reading-ruler-dim mod-left',
	dimRight: 'reading-ruler-dim mod-right',
	band: 'reading-ruler-band',
	handle: 'reading-ruler-handle',
};

/**
 * Renders the ruler inside one leaf. It forwards raw input to the pure core
 * functions and only ever writes CSS variables that feed a transform.
 */
export class LeafOverlay {
	private readonly overlayEl: HTMLElement;
	private readonly handleEl: HTMLElement;
	private readonly pieces: Record<PieceName, HTMLElement>;
	private readonly writtenTransforms = new Map<PieceName, string>();
	private readonly stopWatchingMigration: () => void;

	private win: BrowserWindow;
	private resizeObserver: ResizeObserver | null = null;
	private frame: number | null = null;
	private listening = false;

	private mode: InputMode = 'fixed';
	private hostWidth = 0;
	private hostHeight = 0;
	/** Viewport position of the host; null means it has to be measured again. */
	private hostOrigin: Point | null = null;
	private pointer: Point | null = null;
	private caretY: number | null = null;
	private frozenAnchor: Point | null = null;
	private dragging = false;
	private readonly writtenProps = new Map<string, string>();

	constructor(
		readonly hostEl: HTMLElement,
		private model: RulerModel,
		private readonly callbacks: OverlayCallbacks,
	) {
		this.win = hostEl.win as BrowserWindow;
		hostEl.addClass('reading-ruler-host');
		this.overlayEl = hostEl.createDiv({ cls: 'reading-ruler-overlay' });
		const pieces = {} as Record<PieceName, HTMLElement>;
		for (const name of Object.keys(PIECE_CLASSES) as PieceName[]) {
			pieces[name] = this.overlayEl.createDiv({ cls: PIECE_CLASSES[name] });
		}
		this.pieces = pieces;
		this.handleEl = pieces.handle;

		this.stopWatchingMigration = hostEl.onWindowMigrated((win) => {
			this.cancelFrame();
			this.win = win as BrowserWindow;
			this.hostOrigin = null;
			this.observeSize();
			this.scheduleRender();
		});

		this.observeSize();
		this.update(model);
	}

	update(model: RulerModel): void {
		const wasPinned = this.model.pinned;
		this.model = model;
		const { settings, pinned } = model;

		if (pinned && !wasPinned) this.frozenAnchor = this.liveAnchor();
		if (!pinned) this.frozenAnchor = null;

		this.writeProps({
			'--rr-height': `${settings.bandHeight}px`,
			'--rr-dim': String(settings.dimStrength / 100),
			'--rr-band-bg': tintToRgba(resolveTintColor(settings), settings.tintStrength),
		});
		this.overlayEl.toggleClass('is-enabled', settings.enabled);
		this.overlayEl.toggleClass('is-pinned', pinned);
		this.overlayEl.toggleClass('has-tint', settings.tintStrength > 0);
		this.overlayEl.toggleClass('is-full-width', settings.fullWidth || settings.widthPercent >= 100);

		this.setListening(settings.enabled && !pinned);
		this.scheduleRender();
	}

	setFixedFraction(fraction: number): void {
		this.model = { ...this.model, settings: { ...this.model.settings, fixedFraction: fraction } };
		this.scheduleRender();
	}

	/** True while the band is following the caret, so scrolling has to keep it on that line. */
	get caretLeads(): boolean {
		return this.listening && this.mode === 'caret';
	}

	/**
	 * Caret position relative to the top of the host, measured by the editor extension.
	 * With refreshOnly the position is only updated when the caret already leads.
	 */
	reportCaret(hostY: number, refreshOnly: boolean): void {
		if (!this.listening) return;
		if (refreshOnly && this.mode !== 'caret') return;
		const mode = nextMode(this.mode, { kind: 'caret' }, this.model.settings.followCaret);
		if (mode !== 'caret') return;
		this.mode = mode;
		this.caretY = hostY;
		this.scheduleRender();
	}

	destroy(): void {
		this.setListening(false);
		this.cancelFrame();
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.stopWatchingMigration();
		this.overlayEl.remove();
		this.hostEl.removeClass('reading-ruler-host');
	}

	private observeSize(): void {
		this.resizeObserver?.disconnect();
		// The observer has to come from the window that owns the element, otherwise
		// it stops firing in popout windows.
		this.resizeObserver = new this.win.ResizeObserver((entries) => {
			const size = entries[entries.length - 1]?.contentRect;
			if (!size) return;
			this.hostWidth = size.width;
			this.hostHeight = size.height;
			this.hostOrigin = null;
			this.scheduleRender();
		});
		this.resizeObserver.observe(this.hostEl);
	}

	private setListening(listening: boolean): void {
		if (listening === this.listening) return;
		this.listening = listening;

		if (listening) {
			this.hostEl.addEventListener('pointerenter', this.onPointerEnter, PASSIVE);
			this.hostEl.addEventListener('pointermove', this.onPointer, PASSIVE);
			this.hostEl.addEventListener('pointerdown', this.onPointer, PASSIVE);
			this.handleEl.addEventListener('pointerdown', this.onHandleDown);
			this.handleEl.addEventListener('pointermove', this.onHandleMove);
			this.handleEl.addEventListener('pointerup', this.onHandleUp);
			this.handleEl.addEventListener('pointercancel', this.onHandleUp);
			this.handleEl.addEventListener('mousedown', this.preventFocusLoss);
		} else {
			this.hostEl.removeEventListener('pointerenter', this.onPointerEnter);
			this.hostEl.removeEventListener('pointermove', this.onPointer);
			this.hostEl.removeEventListener('pointerdown', this.onPointer);
			this.handleEl.removeEventListener('pointerdown', this.onHandleDown);
			this.handleEl.removeEventListener('pointermove', this.onHandleMove);
			this.handleEl.removeEventListener('pointerup', this.onHandleUp);
			this.handleEl.removeEventListener('pointercancel', this.onHandleUp);
			this.handleEl.removeEventListener('mousedown', this.preventFocusLoss);
			this.endDrag();
		}
	}

	private readonly onPointerEnter = (): void => {
		// The leaf may have moved without resizing (for example a sidebar opening).
		this.hostOrigin = null;
	};

	private readonly onPointer = (evt: PointerEvent): void => {
		const mode = nextMode(this.mode, { kind: 'pointer', pointerType: evt.pointerType }, false);
		if (evt.pointerType === 'touch') this.overlayEl.addClass('has-touch');

		if (mode === 'follow') {
			// Layout is read here, in the event handler, and never in the frame callback.
			const origin = this.measureOrigin();
			this.pointer = { x: evt.clientX - origin.x, y: evt.clientY - origin.y };
		} else if (mode === this.mode) {
			return;
		}
		this.mode = mode;
		this.scheduleRender();
	};

	private readonly onHandleDown = (evt: PointerEvent): void => {
		evt.preventDefault();
		evt.stopPropagation();
		this.dragging = true;
		this.hostOrigin = null;
		this.measureOrigin();
		this.handleEl.setPointerCapture(evt.pointerId);
		this.handleEl.addClass('is-dragging');
	};

	private readonly onHandleMove = (evt: PointerEvent): void => {
		evt.stopPropagation();
		if (!this.dragging) return;
		const origin = this.measureOrigin();
		this.callbacks.onFractionChange(yToFraction(evt.clientY - origin.y, this.hostHeight));
	};

	private readonly onHandleUp = (evt: PointerEvent): void => {
		evt.stopPropagation();
		if (!this.dragging) return;
		if (this.handleEl.hasPointerCapture(evt.pointerId)) {
			this.handleEl.releasePointerCapture(evt.pointerId);
		}
		this.endDrag();
		this.callbacks.onFractionCommit();
	};

	private readonly preventFocusLoss = (evt: MouseEvent): void => {
		evt.preventDefault();
	};

	private endDrag(): void {
		this.dragging = false;
		this.handleEl.removeClass('is-dragging');
	}

	private measureOrigin(): Point {
		if (!this.hostOrigin) {
			const rect = this.hostEl.getBoundingClientRect();
			this.hostOrigin = { x: rect.left, y: rect.top };
		}
		return this.hostOrigin;
	}

	private liveAnchor(): Point {
		const centerX = this.hostWidth / 2;
		if (this.mode === 'follow' && this.pointer) return this.pointer;
		if (this.mode === 'caret' && this.caretY !== null) return { x: centerX, y: this.caretY };
		return { x: centerX, y: fractionToY(this.model.settings.fixedFraction, this.hostHeight) };
	}

	private scheduleRender(): void {
		if (this.frame !== null) return;
		this.frame = this.win.requestAnimationFrame(() => {
			this.frame = null;
			this.render();
		});
	}

	private cancelFrame(): void {
		if (this.frame === null) return;
		this.win.cancelAnimationFrame(this.frame);
		this.frame = null;
	}

	private render(): void {
		const anchor = this.frozenAnchor ?? this.liveAnchor();
		const band = computeBand({
			anchorX: anchor.x,
			anchorY: anchor.y,
			hostWidth: this.hostWidth,
			hostHeight: this.hostHeight,
			settings: this.model.settings,
		});

		this.overlayEl.toggleClass('is-fixed', this.mode === 'fixed');
		this.writeProps({ '--rr-width': `${band.width}px` });

		const offsets = computePieces(band, HANDLE_SIZE);
		for (const name of Object.keys(offsets) as PieceName[]) this.moveTo(name, offsets[name]);
	}

	/**
	 * The transform goes straight onto the element. Routing it through a custom
	 * property on the overlay would re-resolve the style of every piece each frame.
	 */
	private moveTo(name: PieceName, offset: Offset): void {
		const transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
		if (this.writtenTransforms.get(name) === transform) return;
		this.writtenTransforms.set(name, transform);
		this.pieces[name].setCssStyles({ transform });
	}

	/** Only touches the DOM for values that actually changed. */
	private writeProps(props: Record<string, string>): void {
		const changed: Record<string, string> = {};
		let dirty = false;
		for (const [name, value] of Object.entries(props)) {
			if (this.writtenProps.get(name) === value) continue;
			this.writtenProps.set(name, value);
			changed[name] = value;
			dirty = true;
		}
		if (dirty) this.overlayEl.setCssProps(changed);
	}
}
