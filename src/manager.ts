import { ItemView, debounce, type Plugin, type WorkspaceLeaf } from 'obsidian';
import { clampFraction } from './core/input';
import { clampSettings, type RulerSettings } from './core/settings';
import { canApply, reduce, withSettings, type RulerAction, type RulerModel } from './core/state';
import { LeafOverlay } from './overlay';

const SAVE_DELAY_MS = 500;

type ModelListener = (model: RulerModel) => void;

/** Owns the ruler state and keeps one overlay per supported leaf. */
export class RulerManager {
	private current: RulerModel;
	private readonly overlays = new Map<WorkspaceLeaf, LeafOverlay>();
	private readonly listeners = new Set<ModelListener>();
	private unsaved = false;
	private destroyed = false;
	private readonly requestSave = debounce(() => this.saveNow(), SAVE_DELAY_MS, true);

	constructor(
		private readonly plugin: Plugin,
		settings: RulerSettings,
		private readonly save: (settings: RulerSettings) => Promise<void>,
	) {
		this.current = { settings, pinned: false };

		const { workspace } = plugin.app;
		plugin.registerEvent(workspace.on('layout-change', () => this.sync()));
		plugin.registerEvent(workspace.on('active-leaf-change', () => this.sync()));
		plugin.registerEvent(workspace.on('window-open', () => this.sync()));
		workspace.onLayoutReady(() => this.sync());
	}

	get model(): RulerModel {
		return this.current;
	}

	/** Calls the listener now and after every change; returns a function to unsubscribe. */
	onChange(listener: ModelListener): () => void {
		this.listeners.add(listener);
		listener(this.current);
		return () => this.listeners.delete(listener);
	}

	can(action: RulerAction): boolean {
		return canApply(this.current, action);
	}

	dispatch(action: RulerAction): void {
		this.apply(reduce(this.current, action));
	}

	updateSettings(patch: Partial<RulerSettings>): void {
		const settings = clampSettings({ ...this.current.settings, ...patch });
		this.apply(withSettings(this.current, settings));
	}

	reportCaret(hostEl: HTMLElement, hostY: number, refreshOnly: boolean): void {
		for (const overlay of this.overlays.values()) {
			if (overlay.hostEl === hostEl) {
				overlay.reportCaret(hostY, refreshOnly);
				return;
			}
		}
	}

	sync(): void {
		// onLayoutReady cannot be cancelled and may still fire after the plugin was unloaded.
		if (this.destroyed) return;
		const seen = new Set<WorkspaceLeaf>();

		this.plugin.app.workspace.iterateAllLeaves((leaf) => {
			const hostEl = this.hostFor(leaf);
			if (!hostEl) return;
			seen.add(leaf);

			const existing = this.overlays.get(leaf);
			if (existing?.hostEl === hostEl) return;
			existing?.destroy();
			this.overlays.set(leaf, new LeafOverlay(hostEl, this.current, this.overlayCallbacks));
		});

		for (const [leaf, overlay] of this.overlays) {
			if (seen.has(leaf)) continue;
			overlay.destroy();
			this.overlays.delete(leaf);
		}
	}

	destroy(): void {
		this.destroyed = true;
		this.requestSave.cancel();
		if (this.unsaved) this.saveNow();
		for (const overlay of this.overlays.values()) overlay.destroy();
		this.overlays.clear();
		this.listeners.clear();
	}

	private readonly overlayCallbacks = {
		onFractionChange: (fraction: number): void => {
			const fixedFraction = clampFraction(fraction);
			this.current = {
				...this.current,
				settings: { ...this.current.settings, fixedFraction },
			};
			this.unsaved = true;
			// Dragging bypasses the full update path: only the position changes.
			for (const overlay of this.overlays.values()) overlay.setFixedFraction(fixedFraction);
		},
		onFractionCommit: (): void => {
			this.requestSave();
		},
	};

	private hostFor(leaf: WorkspaceLeaf): HTMLElement | null {
		const { view } = leaf;
		if (!(view instanceof ItemView)) return null;
		const { showInMarkdown, showInPdf } = this.current.settings;
		const type = view.getViewType();
		const supported = (type === 'markdown' && showInMarkdown) || (type === 'pdf' && showInPdf);
		return supported ? view.contentEl : null;
	}

	private apply(next: RulerModel): void {
		if (next === this.current) return;
		const settingsChanged = next.settings !== this.current.settings;
		this.current = next;

		for (const overlay of this.overlays.values()) overlay.update(next);
		for (const listener of this.listeners) listener(next);

		if (settingsChanged) {
			this.sync();
			this.unsaved = true;
			this.requestSave();
		}
	}

	private saveNow(): void {
		this.unsaved = false;
		this.save(this.current.settings).catch((error: unknown) => {
			console.error('Reading Ruler: could not save settings', error);
		});
	}
}
