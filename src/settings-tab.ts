import {
	PluginSettingTab,
	Setting,
	type App,
	type Plugin,
	type SettingControl,
	type SettingDefinitionControl,
	type SettingDefinitionGroup,
} from 'obsidian';
import { LIMITS, type Limit, type RulerSettings, type TintPreset } from './core/settings';
import type { RulerManager } from './manager';

/** `fixedPercent` is the stored `fixedFraction`, shown as a percentage. */
type ControlKey = Exclude<keyof RulerSettings, 'fixedFraction'> | 'fixedPercent';

type RulerSettingDefinition = SettingDefinitionControl<ControlKey>;

const PRESET_LABELS: Record<TintPreset, string> = {
	yellow: 'Yellow',
	blue: 'Blue',
	green: 'Green',
	pink: 'Pink',
	gray: 'Gray',
	custom: 'Custom',
};

/** Settings whose value decides whether other settings are visible. */
const STRUCTURAL_KEYS: ReadonlySet<ControlKey> = new Set<ControlKey>(['fullWidth', 'tintPreset']);

function slider(key: ControlKey, limit: Limit, unit: string): SettingControl<ControlKey> {
	return { type: 'slider', key, ...limit, displayFormat: (value) => `${value}${unit}` };
}

/**
 * The settings are described once as data. Obsidian 1.13.0 and later render them
 * declaratively through getSettingDefinitions(), which also makes them searchable.
 * Older versions do not know that API and fall back to display().
 */
export class RulerSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		plugin: Plugin,
		private readonly manager: RulerManager,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionGroup<ControlKey>[] {
		const settings = (): RulerSettings => this.manager.model.settings;

		return [
			{
				type: 'group',
				items: [
					{
						name: 'Show ruler',
						desc: 'Also available as a command and from the ribbon.',
						control: { type: 'toggle', key: 'enabled' },
					},
				],
			},
			{
				type: 'group',
				heading: 'Band',
				items: [
					{
						name: 'Band height',
						desc: 'Height of the clear band.',
						control: slider('bandHeight', LIMITS.bandHeight, ' px'),
					},
					{
						name: 'Dim strength',
						desc: 'How dark the text outside the band gets.',
						control: slider('dimStrength', LIMITS.dimStrength, '%'),
					},
					{
						name: 'Full width',
						desc: 'Turn off to use a narrower band that follows the pointer horizontally.',
						control: { type: 'toggle', key: 'fullWidth' },
					},
					{
						name: 'Width',
						desc: 'Width of the band as a percentage of the pane.',
						visible: () => !settings().fullWidth,
						control: slider('widthPercent', LIMITS.widthPercent, '%'),
					},
				],
			},
			{
				type: 'group',
				heading: 'Tint',
				items: [
					{
						name: 'Tint color',
						desc: 'Color laid over the band, like a highlighter.',
						control: { type: 'dropdown', key: 'tintPreset', options: PRESET_LABELS },
					},
					{
						name: 'Custom color',
						visible: () => settings().tintPreset === 'custom',
						control: { type: 'color', key: 'tintCustomColor' },
					},
					{
						name: 'Tint strength',
						desc: 'Set to 0 for a fully clear band.',
						control: slider('tintStrength', LIMITS.tintStrength, '%'),
					},
				],
			},
			{
				type: 'group',
				heading: 'Position',
				items: [
					{
						name: 'Fixed position',
						desc: 'Where the band rests when there is no pointer to follow, measured from the top. On touch screens you can also drag the handle at the edge of the band.',
						control: slider('fixedPercent', { min: 0, max: 100, step: 1 }, '%'),
					},
					{
						name: 'Follow caret while editing',
						desc: 'Move the band to the line you are typing on. Moving the mouse takes over again.',
						aliases: ['text cursor'],
						control: { type: 'toggle', key: 'followCaret' },
					},
				],
			},
			{
				type: 'group',
				heading: 'Views',
				items: [
					{ name: 'Show in Markdown notes', control: { type: 'toggle', key: 'showInMarkdown' } },
					{ name: 'Show in PDF files', control: { type: 'toggle', key: 'showInPdf' } },
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		const { settings } = this.manager.model;
		if (key === 'fixedPercent') return Math.round(settings.fixedFraction * 100);
		return settings[key as keyof RulerSettings];
	}

	setControlValue(key: string, value: unknown): void {
		const patch = key === 'fixedPercent' ? { fixedFraction: Number(value) / 100 } : { [key]: value };
		// updateSettings validates and clamps, so an untyped patch is safe here.
		this.manager.updateSettings(patch);
	}

	/** Fallback for Obsidian versions before 1.13.0, which never call getSettingDefinitions(). */
	display(): void {
		this.renderLegacy();
	}

	private renderLegacy(): void {
		this.containerEl.empty();

		for (const group of this.getSettingDefinitions()) {
			if (group.heading) new Setting(this.containerEl).setName(group.heading).setHeading();

			for (const item of group.items ?? []) {
				const definition = item as RulerSettingDefinition;
				const visible = typeof definition.visible === 'function' ? definition.visible() : definition.visible;
				if (visible !== false) this.renderLegacySetting(definition);
			}
		}
	}

	private renderLegacySetting(definition: RulerSettingDefinition): void {
		const { control } = definition;
		const { key } = control;
		const setting = new Setting(this.containerEl).setName(definition.name);
		if (definition.desc) setting.setDesc(definition.desc);

		const onChange = (value: unknown): void => {
			this.setControlValue(key, value);
			if (STRUCTURAL_KEYS.has(key)) this.renderLegacy();
		};

		switch (control.type) {
			case 'toggle':
				setting.addToggle((toggle) => toggle.setValue(this.getControlValue(key) as boolean).onChange(onChange));
				break;
			case 'slider': {
				// Before 1.13.0 a slider does not show its value, so put it next to the slider.
				const format = control.displayFormat ?? String;
				const valueEl = setting.controlEl.createSpan({
					cls: 'reading-ruler-slider-value',
					text: format(this.getControlValue(key) as number),
				});
				setting.addSlider((component) => {
					component
						.setLimits(control.min, control.max, control.step)
						.setValue(this.getControlValue(key) as number)
						.onChange(onChange);
					component.sliderEl.addEventListener('input', () => valueEl.setText(format(component.getValue())));
				});
				break;
			}
			case 'dropdown':
				setting.addDropdown((dropdown) =>
					dropdown
						.addOptions(control.options)
						.setValue(this.getControlValue(key) as string)
						.onChange(onChange),
				);
				break;
			case 'color':
				setting.addColorPicker((picker) => picker.setValue(this.getControlValue(key) as string).onChange(onChange));
				break;
			default:
				break;
		}
	}
}
