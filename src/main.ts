import { Plugin } from 'obsidian';
import { caretExtension } from './caret';
import { clampSettings } from './core/settings';
import type { RulerAction } from './core/state';
import { RulerManager } from './manager';
import { RulerSettingTab } from './settings-tab';

interface CommandSpec {
	id: string;
	name: string;
	icon: string;
	action: RulerAction;
}

const COMMANDS: CommandSpec[] = [
	{ id: 'toggle', name: 'Toggle ruler', icon: 'scan-line', action: 'toggle' },
	{ id: 'toggle-pin', name: 'Pin or unpin ruler', icon: 'pin', action: 'togglePin' },
	{ id: 'increase-band-height', name: 'Increase band height', icon: 'plus', action: 'thicker' },
	{ id: 'decrease-band-height', name: 'Decrease band height', icon: 'minus', action: 'thinner' },
];

export default class ReadingRulerPlugin extends Plugin {
	async onload(): Promise<void> {
		const settings = clampSettings(await this.loadData());
		const manager = new RulerManager(this, settings, (next) => this.saveData(next));
		this.register(() => manager.destroy());

		for (const { id, name, icon, action } of COMMANDS) {
			this.addCommand({
				id,
				name,
				icon,
				// Pin and resize are hidden from the palette while the ruler is off.
				checkCallback: (checking) => {
					if (!manager.can(action)) return false;
					if (!checking) manager.dispatch(action);
					return true;
				},
			});
		}

		const ribbonEl = this.addRibbonIcon('scan-line', 'Toggle reading ruler', () => manager.dispatch('toggle'));
		manager.onChange((model) => ribbonEl.toggleClass('is-active', model.settings.enabled));

		this.addSettingTab(new RulerSettingTab(this.app, this, manager));
		this.registerEditorExtension(caretExtension(manager));
	}
}
