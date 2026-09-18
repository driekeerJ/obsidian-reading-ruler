import { describe, expect, it } from 'vitest';
import { isValidHex, normalizeHex, tintToRgba } from '../../src/core/color';

describe('isValidHex', () => {
	it.each(['#fff', '#FFEB3B', '#abcdef', '#000'])('accepts %s', (value) => {
		expect(isValidHex(value)).toBe(true);
	});

	it.each(['fff', '#ffff', '#gggggg', '', '#', 12, null, undefined, {}])('rejects %s', (value) => {
		expect(isValidHex(value)).toBe(false);
	});
});

describe('normalizeHex', () => {
	it('expands shorthand and lowercases', () => {
		expect(normalizeHex('#FfF')).toBe('#ffffff');
		expect(normalizeHex('#a1B')).toBe('#aa11bb');
	});

	it('lowercases long form', () => {
		expect(normalizeHex('#ABCDEF')).toBe('#abcdef');
	});
});

describe('tintToRgba', () => {
	it('converts hex and strength to an rgba string', () => {
		expect(tintToRgba('#ffeb3b', 20)).toBe('rgba(255, 235, 59, 0.2)');
		expect(tintToRgba('#fff', 40)).toBe('rgba(255, 255, 255, 0.4)');
	});

	it('avoids floating point noise in the alpha channel', () => {
		expect(tintToRgba('#000000', 35)).toBe('rgba(0, 0, 0, 0.35)');
		expect(tintToRgba('#000000', 7)).toBe('rgba(0, 0, 0, 0.07)');
	});

	it('is transparent at zero or negative strength', () => {
		expect(tintToRgba('#ffeb3b', 0)).toBe('transparent');
		expect(tintToRgba('#ffeb3b', -5)).toBe('transparent');
	});

	it('is transparent for invalid input', () => {
		expect(tintToRgba('nope', 20)).toBe('transparent');
		expect(tintToRgba('#ffeb3b', Number.NaN)).toBe('transparent');
	});

	it('caps alpha at 1', () => {
		expect(tintToRgba('#ffeb3b', 250)).toBe('rgba(255, 235, 59, 1)');
	});
});
