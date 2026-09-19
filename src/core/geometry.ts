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

export interface Offset {
	x: number;
	y: number;
}

/** Where each overlay element is translated to; every value is a whole pixel. */
export interface RulerPieces {
	band: Offset;
	/** Anchored with its bottom edge at y = 0, so translating by band.y hangs it above the band. */
	dimTop: Offset;
	dimBottom: Offset;
	/** Anchored with its right edge at x = 0, so translating by band.x puts it left of the band. */
	dimLeft: Offset;
	dimRight: Offset;
	handle: Offset;
}

export function computePieces(band: BandRect, handleSize: number): RulerPieces {
	return {
		band: { x: band.x, y: band.y },
		dimTop: { x: 0, y: band.y },
		dimBottom: { x: 0, y: band.y + band.height },
		dimLeft: { x: band.x, y: band.y },
		dimRight: { x: band.x + band.width, y: band.y },
		handle: { x: 0, y: Math.round(band.y + (band.height - handleSize) / 2) },
	};
}
