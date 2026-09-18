import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	clampSettings,
	resolveTintColor,
	stepBandHeight,
} from '../../src/core/settings';

describe('clampSettings', () => {
	it.each([null, undefined, 42, 'x', [], true])('returns defaults for %s', (raw) => {
		const result = clampSettings(raw);
		expect(result).toEqual(DEFAULT_SETTINGS);
		expect(result).not.toBe(DEFAULT_SETTINGS);
	});

	it('fills in missing keys from the defaults', () => {
		expect(clampSettings({ bandHeight: 100 })).toEqual({ ...DEFAULT_SETTINGS, bandHeight: 100 });
	});

	it.each([
		[5, 20],
		[999, 300],
		[64.6, 65],
		[Number.NaN, 60],
		['80', 60],
		[null, 60],
	])('bandHeight %s becomes %s', (input, expected) => {
		expect(clampSettings({ bandHeight: input }).bandHeight).toBe(expected);
	});

	it('clamps dim strength to 10-90', () => {
		expect(clampSettings({ dimStrength: 0 }).dimStrength).toBe(10);
		expect(clampSettings({ dimStrength: 100 }).dimStrength).toBe(90);
		expect(clampSettings({ dimStrength: 55 }).dimStrength).toBe(55);
	});

	it('clamps tint strength to 0-40', () => {
		expect(clampSettings({ tintStrength: -1 }).tintStrength).toBe(0);
		expect(clampSettings({ tintStrength: 50 }).tintStrength).toBe(40);
	});

	it('clamps width percent to 30-100', () => {
		expect(clampSettings({ widthPercent: 10 }).widthPercent).toBe(30);
		expect(clampSettings({ widthPercent: 150 }).widthPercent).toBe(100);
	});

	it('clamps the fixed fraction to 0-1 and rejects non-finite values', () => {
		expect(clampSettings({ fixedFraction: -0.2 }).fixedFraction).toBe(0);
		expect(clampSettings({ fixedFraction: 1.4 }).fixedFraction).toBe(1);
		expect(clampSettings({ fixedFraction: Number.POSITIVE_INFINITY }).fixedFraction).toBe(0.35);
		expect(clampSettings({ fixedFraction: 0.5 }).fixedFraction).toBe(0.5);
	});

	it('falls back to yellow for an unknown preset', () => {
		expect(clampSettings({ tintPreset: 'purple' }).tintPreset).toBe('yellow');
		expect(clampSettings({ tintPreset: 'custom' }).tintPreset).toBe('custom');
	});

	it('validates and normalizes the custom colour', () => {
		expect(clampSettings({ tintCustomColor: 'red' }).tintCustomColor).toBe('#ffeb3b');
		expect(clampSettings({ tintCustomColor: '#ABCDEF' }).tintCustomColor).toBe('#abcdef');
		expect(clampSettings({ tintCustomColor: '#0F0' }).tintCustomColor).toBe('#00ff00');
	});

	it('only accepts real booleans', () => {
		const result = clampSettings({ enabled: 'yes', fullWidth: 0, followCaret: 1, showInPdf: null });
		expect(result.enabled).toBe(false);
		expect(result.fullWidth).toBe(true);
		expect(result.followCaret).toBe(false);
		expect(result.showInPdf).toBe(true);
	});

	it('drops unknown keys', () => {
		expect(clampSettings({ unknownKey: 1 })).toEqual(DEFAULT_SETTINGS);
	});

	it('keeps a valid object unchanged', () => {
		const valid = {
			enabled: true,
			bandHeight: 120,
			dimStrength: 70,
			tintPreset: 'custom' as const,
			tintCustomColor: '#123456',
			tintStrength: 25,
			fullWidth: false,
			widthPercent: 60,
			fixedFraction: 0.5,
			followCaret: true,
			showInMarkdown: false,
			showInPdf: true,
		};
		expect(clampSettings(valid)).toEqual(valid);
	});
});

describe('stepBandHeight', () => {
	it.each([
		[60, 1, 70],
		[60, -1, 50],
		[300, 1, 300],
		[20, -1, 20],
		[295, 1, 300],
		[25, -1, 20],
	] as const)('from %s with direction %s gives %s', (current, direction, expected) => {
		expect(stepBandHeight(current, direction)).toBe(expected);
	});
});

describe('resolveTintColor', () => {
	it('returns the preset colour', () => {
		expect(resolveTintColor({ ...DEFAULT_SETTINGS, tintPreset: 'blue' })).toBe('#64b5f6');
	});

	it('returns the custom colour for the custom preset', () => {
		expect(
			resolveTintColor({ ...DEFAULT_SETTINGS, tintPreset: 'custom', tintCustomColor: '#123456' }),
		).toBe('#123456');
	});
});
