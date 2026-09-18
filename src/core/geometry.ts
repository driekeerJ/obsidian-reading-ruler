import type { RulerSettings } from './settings';

export interface BandInput {
	anchorX: number;
	anchorY: number;
	hostWidth: number;
	hostHeight: number;
	settings: Pick<RulerSettings, 'bandHeight' | 'fullWidth' | 'widthPercent'>;
}

export interface BandRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export function computeBand(input: BandInput): BandRect {
	const { anchorX, anchorY, settings } = input;
	const hostWidth = Math.max(0, Math.round(input.hostWidth));
	const height = settings.bandHeight;
	// Vertically the band is deliberately not clamped: it may be cut off at the edges.
	const y = Math.round(anchorY - height / 2);

	if (settings.fullWidth) return { x: 0, y, width: hostWidth, height };

	const width = Math.round((hostWidth * settings.widthPercent) / 100);
	const x = Math.round(Math.min(hostWidth - width, Math.max(0, anchorX - width / 2)));
	return { x, y, width, height };
}
