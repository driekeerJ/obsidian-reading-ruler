import { stepBandHeight, type RulerSettings } from './settings';

export interface RulerModel {
	settings: RulerSettings;
	pinned: boolean;
}

export type RulerAction = 'toggle' | 'togglePin' | 'thicker' | 'thinner';

export function canApply(model: RulerModel, action: RulerAction): boolean {
	return action === 'toggle' || model.settings.enabled;
}

function withBandHeight(model: RulerModel, bandHeight: number): RulerModel {
	if (bandHeight === model.settings.bandHeight) return model;
	return { ...model, settings: { ...model.settings, bandHeight } };
}

export function reduce(model: RulerModel, action: RulerAction): RulerModel {
	if (!canApply(model, action)) return model;

	switch (action) {
		case 'toggle':
			return {
				settings: { ...model.settings, enabled: !model.settings.enabled },
				pinned: false,
			};
		case 'togglePin':
			return { ...model, pinned: !model.pinned };
		case 'thicker':
			return withBandHeight(model, stepBandHeight(model.settings.bandHeight, 1));
		case 'thinner':
			return withBandHeight(model, stepBandHeight(model.settings.bandHeight, -1));
	}
}
