export type InputMode = 'fixed' | 'follow' | 'caret';

export type RulerInput = { kind: 'pointer'; pointerType: string } | { kind: 'caret' };

export function nextMode(current: InputMode, input: RulerInput, followCaret: boolean): InputMode {
	if (input.kind === 'caret') return followCaret ? 'caret' : current;

	switch (input.pointerType) {
		case 'mouse':
		case 'pen':
			return 'follow';
		case 'touch':
			return 'fixed';
		default:
			return current;
	}
}

export function clampFraction(value: number): number {
	if (Number.isNaN(value)) return 0;
	return Math.min(1, Math.max(0, value));
}

export function fractionToY(fraction: number, hostHeight: number): number {
	return clampFraction(fraction) * hostHeight;
}

export function yToFraction(y: number, hostHeight: number): number {
	if (hostHeight <= 0) return 0;
	return clampFraction(y / hostHeight);
}
