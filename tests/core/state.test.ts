import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { canApply, reduce, withSettings, type RulerModel } from '../../src/core/state';

function model(overrides: { enabled?: boolean; pinned?: boolean; bandHeight?: number } = {}): RulerModel {
	const { pinned = false, ...settings } = overrides;
	return Object.freeze({
		settings: Object.freeze({ ...DEFAULT_SETTINGS, ...settings }),
		pinned,
	});
}

describe('reduce: toggle', () => {
	it('turns the ruler on', () => {
		expect(reduce(model({ enabled: false }), 'toggle').settings.enabled).toBe(true);
	});

	it('turns the ruler off', () => {
		expect(reduce(model({ enabled: true }), 'toggle').settings.enabled).toBe(false);
	});

	it('clears the pin when turning off', () => {
		const next = reduce(model({ enabled: true, pinned: true }), 'toggle');
		expect(next.settings.enabled).toBe(false);
		expect(next.pinned).toBe(false);
	});

	it('starts unpinned when turning on', () => {
		expect(reduce(model({ enabled: false }), 'toggle').pinned).toBe(false);
	});
});

describe('reduce: togglePin', () => {
	it('pins and unpins while enabled', () => {
		const pinned = reduce(model({ enabled: true }), 'togglePin');
		expect(pinned.pinned).toBe(true);
		expect(reduce(pinned, 'togglePin').pinned).toBe(false);
	});

	it('does nothing while disabled', () => {
		const off = model({ enabled: false });
		expect(reduce(off, 'togglePin')).toBe(off);
	});
});

describe('reduce: thicker and thinner', () => {
	it('changes the band height in steps of 10', () => {
		expect(reduce(model({ enabled: true }), 'thicker').settings.bandHeight).toBe(70);
		expect(reduce(model({ enabled: true }), 'thinner').settings.bandHeight).toBe(50);
	});

	it('does nothing while disabled', () => {
		const off = model({ enabled: false });
		expect(reduce(off, 'thicker')).toBe(off);
		expect(reduce(off, 'thinner')).toBe(off);
	});

	it('returns the same model at the limits', () => {
		const max = model({ enabled: true, bandHeight: 300 });
		const min = model({ enabled: true, bandHeight: 20 });
		expect(reduce(max, 'thicker')).toBe(max);
		expect(reduce(min, 'thinner')).toBe(min);
	});

	it('still works while pinned', () => {
		expect(reduce(model({ enabled: true, pinned: true }), 'thicker').settings.bandHeight).toBe(70);
	});

	it('leaves other settings untouched', () => {
		const before = model({ enabled: true });
		const after = reduce(before, 'thicker');
		expect({ ...after.settings, bandHeight: 60 }).toEqual(before.settings);
	});
});

describe('canApply', () => {
	it('always allows toggle', () => {
		expect(canApply(model({ enabled: false }), 'toggle')).toBe(true);
		expect(canApply(model({ enabled: true }), 'toggle')).toBe(true);
	});

	it.each(['togglePin', 'thicker', 'thinner'] as const)('allows %s only while enabled', (action) => {
		expect(canApply(model({ enabled: false }), action)).toBe(false);
		expect(canApply(model({ enabled: true }), action)).toBe(true);
	});
});

describe('withSettings', () => {
	it('replaces the settings and keeps the pin while enabled', () => {
		const next = withSettings(model({ enabled: true, pinned: true }), { ...DEFAULT_SETTINGS, enabled: true, dimStrength: 80 });
		expect(next.settings.dimStrength).toBe(80);
		expect(next.pinned).toBe(true);
	});

	it('releases the pin when the new settings turn the ruler off', () => {
		const next = withSettings(model({ enabled: true, pinned: true }), { ...DEFAULT_SETTINGS, enabled: false });
		expect(next.pinned).toBe(false);
	});
});
