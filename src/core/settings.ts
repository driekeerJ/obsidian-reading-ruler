import { isValidHex, normalizeHex } from './color';

export type TintPreset = 'yellow' | 'blue' | 'green' | 'pink' | 'gray' | 'custom';

export interface RulerSettings {
	enabled: boolean;
	bandHeight: number;
	dimStrength: number;
	tintPreset: TintPreset;
	tintCustomColor: string;
	tintStrength: number;
	fullWidth: boolean;
	widthPercent: number;
	fixedFraction: number;
	followCaret: boolean;
	showInMarkdown: boolean;
	showInPdf: boolean;
}

export interface Limit {
	min: number;
	max: number;
	step: number;
}

export const LIMITS = {
	bandHeight: { min: 20, max: 300, step: 10 },
	dimStrength: { min: 10, max: 90, step: 5 },
	tintStrength: { min: 0, max: 40, step: 5 },
	widthPercent: { min: 30, max: 100, step: 5 },
	fixedFraction: { min: 0, max: 1, step: 0.01 },
} as const satisfies Record<string, Limit>;

export const TINT_PRESETS: Record<Exclude<TintPreset, 'custom'>, string> = {
	yellow: '#ffeb3b',
	blue: '#64b5f6',
	green: '#81c784',
	pink: '#f48fb1',
	gray: '#bdbdbd',
};

export const DEFAULT_SETTINGS: Readonly<RulerSettings> = Object.freeze({
	enabled: false,
	bandHeight: 60,
	dimStrength: 50,
	tintPreset: 'yellow',
	tintCustomColor: '#ffeb3b',
	tintStrength: 0,
	fullWidth: true,
	widthPercent: 100,
	fixedFraction: 0.35,
	followCaret: false,
	showInMarkdown: true,
	showInPdf: true,
});

const PRESET_NAMES: readonly string[] = [...Object.keys(TINT_PRESETS), 'custom'];

function clampNumber(value: unknown, limit: Limit, fallback: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
	return Math.min(limit.max, Math.max(limit.min, value));
}

function readBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function readPreset(value: unknown): TintPreset {
	return typeof value === 'string' && PRESET_NAMES.includes(value)
		? (value as TintPreset)
		: DEFAULT_SETTINGS.tintPreset;
}

export function clampSettings(raw: unknown): RulerSettings {
	const source: Record<string, unknown> =
		typeof raw === 'object' && raw !== null && !Array.isArray(raw)
			? (raw as Record<string, unknown>)
			: {};
	const defaults = DEFAULT_SETTINGS;

	return {
		enabled: readBoolean(source.enabled, defaults.enabled),
		bandHeight: Math.round(clampNumber(source.bandHeight, LIMITS.bandHeight, defaults.bandHeight)),
		dimStrength: clampNumber(source.dimStrength, LIMITS.dimStrength, defaults.dimStrength),
		tintPreset: readPreset(source.tintPreset),
		tintCustomColor: isValidHex(source.tintCustomColor)
			? normalizeHex(source.tintCustomColor)
			: defaults.tintCustomColor,
		tintStrength: clampNumber(source.tintStrength, LIMITS.tintStrength, defaults.tintStrength),
		fullWidth: readBoolean(source.fullWidth, defaults.fullWidth),
		widthPercent: clampNumber(source.widthPercent, LIMITS.widthPercent, defaults.widthPercent),
		fixedFraction: clampNumber(source.fixedFraction, LIMITS.fixedFraction, defaults.fixedFraction),
		followCaret: readBoolean(source.followCaret, defaults.followCaret),
		showInMarkdown: readBoolean(source.showInMarkdown, defaults.showInMarkdown),
		showInPdf: readBoolean(source.showInPdf, defaults.showInPdf),
	};
}

export function stepBandHeight(current: number, direction: 1 | -1): number {
	const { min, max, step } = LIMITS.bandHeight;
	return Math.min(max, Math.max(min, current + direction * step));
}

export function resolveTintColor(settings: RulerSettings): string {
	return settings.tintPreset === 'custom'
		? settings.tintCustomColor
		: TINT_PRESETS[settings.tintPreset];
}
