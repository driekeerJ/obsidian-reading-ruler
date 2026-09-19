import type { Extension } from '@codemirror/state';
import { ViewPlugin, type EditorView, type PluginValue, type ViewUpdate } from '@codemirror/view';
import type { RulerManager } from './manager';

interface CaretMeasurement {
	hostEl: HTMLElement;
	hostY: number;
}

const PASSIVE: AddEventListenerOptions = { passive: true };

/**
 * Reports the caret line to the ruler while typing. Strictly read-only: it never
 * dispatches a transaction and never touches the selection or the focus.
 */
export function caretExtension(manager: RulerManager): Extension {
	class CaretFollower implements PluginValue {
		private readonly unsubscribe: () => void;
		private readonly measureKey = {};
		private listening = false;

		constructor(private readonly view: EditorView) {
			this.unsubscribe = manager.onChange(() => this.setListening(this.isActive()));
		}

		update(update: ViewUpdate): void {
			if (!update.selectionSet && !update.docChanged) return;
			if (this.isActive()) this.measure(false);
		}

		destroy(): void {
			this.unsubscribe();
			this.setListening(false);
		}

		private isActive(): boolean {
			const { settings, pinned } = manager.model;
			return settings.enabled && settings.followCaret && !pinned;
		}

		/** The scroll listener only exists while caret following can actually happen. */
		private setListening(listening: boolean): void {
			if (listening === this.listening) return;
			this.listening = listening;
			if (listening) this.view.scrollDOM.addEventListener('scroll', this.onScroll, PASSIVE);
			else this.view.scrollDOM.removeEventListener('scroll', this.onScroll);
		}

		// A caret jump usually scrolls the editor afterwards, so the band has to be
		// kept on the caret line while scrolling. This never takes over from the mouse.
		private readonly onScroll = (): void => {
			// Skip the measurement entirely while the mouse or the fixed position leads.
			const hostEl = this.view.dom.closest<HTMLElement>('.reading-ruler-host');
			if (hostEl && manager.caretLeads(hostEl)) this.measure(true);
		};

		private measure(refreshOnly: boolean): void {
			// requestMeasure batches the DOM reads into CodeMirror's own measure phase,
			// so this does not force an extra layout.
			this.view.requestMeasure<CaretMeasurement | null>({
				key: this.measureKey,
				read: (view) => {
					const hostEl = view.dom.closest<HTMLElement>('.reading-ruler-host');
					const coords = view.coordsAtPos(view.state.selection.main.head);
					if (!hostEl || !coords) return null;
					const hostTop = hostEl.getBoundingClientRect().top;
					return { hostEl, hostY: (coords.top + coords.bottom) / 2 - hostTop };
				},
				write: (measurement) => {
					if (measurement) manager.reportCaret(measurement.hostEl, measurement.hostY, refreshOnly);
				},
			});
		}
	}

	return ViewPlugin.fromClass(CaretFollower);
}
