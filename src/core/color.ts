const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidHex(value: unknown): value is string {
	return typeof value === 'string' && HEX_PATTERN.test(value);
}

export function normalizeHex(hex: string): string {
	const digits = hex.slice(1).toLowerCase();
	if (digits.length === 6) return `#${digits}`;
	return `#${[...digits].map((digit) => digit + digit).join('')}`;
}

export function tintToRgba(hex: string, strengthPercent: number): string {
	if (!isValidHex(hex) || !Number.isFinite(strengthPercent) || strengthPercent <= 0) {
		return 'transparent';
	}
	const digits = normalizeHex(hex).slice(1);
	const red = parseInt(digits.slice(0, 2), 16);
	const green = parseInt(digits.slice(2, 4), 16);
	const blue = parseInt(digits.slice(4, 6), 16);
	const alpha = Math.min(1, Math.round(strengthPercent) / 100);
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
