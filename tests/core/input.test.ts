import { describe, expect, it } from 'vitest';
import { clampFraction, fractionToY, nextMode, yToFraction } from '../../src/core/input';

describe('nextMode', () => {
	it('follows a mouse', () => {
		expect(nextMode('fixed', { kind: 'pointer', pointerType: 'mouse' }, false)).toBe('follow');
	});

	it('follows a hovering pen', () => {
		expect(nextMode('fixed', { kind: 'pointer', pointerType: 'pen' }, false)).toBe('follow');
	});

	it('returns to the fixed position on touch', () => {
		expect(nextMode('follow', { kind: 'pointer', pointerType: 'touch' }, false)).toBe('fixed');
		expect(nextMode('caret', { kind: 'pointer', pointerType: 'touch' }, true)).toBe('fixed');
	});

	it('ignores unknown pointer types', () => {
		expect(nextMode('follow', { kind: 'pointer', pointerType: '' }, false)).toBe('follow');
		expect(nextMode('fixed', { kind: 'pointer', pointerType: 'eraser' }, false)).toBe('fixed');
	});

	it('follows the caret only when the setting is on', () => {
		expect(nextMode('follow', { kind: 'caret' }, true)).toBe('caret');
		expect(nextMode('follow', { kind: 'caret' }, false)).toBe('follow');
		expect(nextMode('fixed', { kind: 'caret' }, false)).toBe('fixed');
	});

	it('lets the last input win', () => {
		expect(nextMode('caret', { kind: 'pointer', pointerType: 'mouse' }, true)).toBe('follow');
	});
});

describe('fraction conversion', () => {
	it('converts a fraction to pixels', () => {
		expect(fractionToY(0.35, 1000)).toBe(350);
	});

	it('converts pixels to a fraction', () => {
		expect(yToFraction(350, 1000)).toBe(0.35);
	});

	it('clamps positions outside the host', () => {
		expect(yToFraction(-5, 100)).toBe(0);
		expect(yToFraction(500, 100)).toBe(1);
	});

	it('returns 0 for an empty host', () => {
		expect(yToFraction(10, 0)).toBe(0);
		expect(yToFraction(10, -4)).toBe(0);
	});

	it('round-trips', () => {
		expect(yToFraction(fractionToY(0.42, 731), 731)).toBeCloseTo(0.42, 9);
	});

	it('clamps fractions and rejects NaN', () => {
		expect(clampFraction(-1)).toBe(0);
		expect(clampFraction(2)).toBe(1);
		expect(clampFraction(0.5)).toBe(0.5);
		expect(clampFraction(Number.NaN)).toBe(0);
	});
});
