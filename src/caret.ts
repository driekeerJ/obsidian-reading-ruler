import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { RulerManager } from './manager';

interface CaretMeasurement {
	hostEl: HTMLElement;
	hostY: number;
}

/**
 * Reports the caret line to the ruler while typing. Strictly read-only: it never
 * dispatches a transaction and never touches the selection or the focus.
 */
export function caretExtension(manager: RulerManager): Extension {
	const measureKey = {};

	return EditorView.updateListener.of((update) => {
		if (!update.selectionSet && !update.docChanged) return;
		const { settings, pinned } = manager.model;
		if (!settings.enabled || !settings.followCaret || pinned) return;

		// requestMeasure batches the DOM reads into CodeMirror's own measure phase,
		// so this does not force an extra layout.
		update.view.requestMeasure<CaretMeasurement | null>({
			key: measureKey,
			read: (view) => {
				const hostEl = view.dom.closest<HTMLElement>('.reading-ruler-host');
				const coords = view.coordsAtPos(view.state.selection.main.head);
				if (!hostEl || !coords) return null;
				const hostTop = hostEl.getBoundingClientRect().top;
				return { hostEl, hostY: (coords.top + coords.bottom) / 2 - hostTop };
			},
			write: (measurement) => {
				if (measurement) manager.reportCaret(measurement.hostEl, measurement.hostY);
			},
		});
	});
}
