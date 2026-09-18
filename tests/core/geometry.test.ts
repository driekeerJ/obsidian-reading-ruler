import { describe, expect, it } from 'vitest';
import { computeBand, type BandInput } from '../../src/core/geometry';

function input(overrides: Partial<Omit<BandInput, 'settings'>> & Partial<BandInput['settings']> = {}): BandInput {
	const { bandHeight = 60, fullWidth = true, widthPercent = 100, ...rest } = overrides;
	return {
		anchorX: 400,
		anchorY: 300,
		hostWidth: 800,
		hostHeight: 600,
		...rest,
		settings: { bandHeight, fullWidth, widthPercent },
	};
}

describe('computeBand: vertical', () => {
	it('centres the band on the anchor', () => {
		expect(computeBand(input())).toEqual({ x: 0, y: 270, width: 800, height: 60 });
	});

	it('does not clamp at the top edge', () => {
		expect(computeBand(input({ anchorY: 0 })).y).toBe(-30);
	});

	it('does not clamp at the bottom edge', () => {
		expect(computeBand(input({ anchorY: 600 })).y).toBe(570);
	});

	it('follows the band height setting', () => {
		expect(computeBand(input({ bandHeight: 200 }))).toMatchObject({ y: 200, height: 200 });
	});
});

describe('computeBand: horizontal', () => {
	it('ignores the pointer x at full width', () => {
		expect(computeBand(input({ anchorX: 5 }))).toMatchObject({ x: 0, width: 800 });
	});

	it('centres a custom width band on the anchor', () => {
		expect(computeBand(input({ fullWidth: false, widthPercent: 50 }))).toMatchObject({ x: 200, width: 400 });
	});

	it('clamps at the left edge and keeps the width', () => {
		expect(computeBand(input({ fullWidth: false, widthPercent: 50, anchorX: 10 }))).toMatchObject({ x: 0, width: 400 });
	});

	it('clamps at the right edge and keeps the width', () => {
		expect(computeBand(input({ fullWidth: false, widthPercent: 50, anchorX: 795 }))).toMatchObject({ x: 400, width: 400 });
	});

	it('treats custom 100 % like full width', () => {
		expect(computeBand(input({ fullWidth: false, widthPercent: 100, anchorX: 10 }))).toMatchObject({ x: 0, width: 800 });
	});
});

describe('computeBand: robustness', () => {
	it('returns whole pixels', () => {
		const band = computeBand(input({ anchorX: 123.7, anchorY: 300.4, hostWidth: 801, fullWidth: false, widthPercent: 33 }));
		for (const value of Object.values(band)) expect(Number.isInteger(value)).toBe(true);
	});

	it('never extends past the right edge after rounding', () => {
		const band = computeBand(input({ anchorX: 801, hostWidth: 801, fullWidth: false, widthPercent: 33 }));
		expect(band.x + band.width).toBeLessThanOrEqual(801);
	});

	it('handles an empty host without NaN', () => {
		expect(computeBand(input({ hostWidth: 0, hostHeight: 0, anchorX: 0, anchorY: 0 }))).toEqual({ x: 0, y: -30, width: 0, height: 60 });
	});
});
