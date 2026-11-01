/**
 * Theme customizer — registry facade and built-in presets.
 *
 * The variable definitions come from the generated registry (see
 * `scripts/extract-customizer-vars.mjs`, run as `pnpm extract-vars`); presets
 * are hand-crafted theme seeds. Theme value maps are keyed by the full custom
 * property name so the site-wide applier never needs this registry.
 */
import { generatedDefinitions, generatedVersion, type GeneratedDef } from './registry.generated';

export type VarType = GeneratedDef['type'];
export type VarSource = GeneratedDef['source'];

export interface VariableDefinition extends GeneratedDef {}

export const variables: VariableDefinition[] = generatedDefinitions;

/** The installed Blades version the registry was generated against. */
export const registryVersion = generatedVersion;

/** Distinct sources in registry order. */
export const sources = [...new Set(variables.map((v) => v.source))] as VarSource[];

/** Distinct categories per source. */
export function categoriesOf(source: VarSource): string[] {
	return [...new Set(variables.filter((v) => v.source === source).map((v) => v.category))];
}

export function getDefinition(name: string): VariableDefinition | undefined {
	return variables.find((v) => v.name === name);
}

/**
 * First 6-digit hex inside a value, for prefilling color inputs. Pico values
 * often read `light-dark(#ffffff, #131620)`; the picker needs one concrete
 * swatch, so the first hex wins (light scheme).
 */
export function hexOf(value?: string): string | undefined {
	const match = /#([0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(value ?? '');
	if (!match) return undefined;
	const hex = match[1];
	return hex.length === 3 ? `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : `#${hex}`;
}

/**
 * Light half of a Pico palette value, when it is a `light-dark(a, b)` pair.
 * Flat values return undefined.
 */
export function lightHalfOf(value?: string): string | undefined {
	const match = /light-dark\(\s*([^,]+),/i.exec(value ?? '');
	return match ? match[1].trim() : undefined;
}

/**
 * Dark half of a Pico palette value, when it is a `light-dark(a, b)` pair.
 * Flat values return undefined.
 */
export function darkHalfOf(value?: string): string | undefined {
	const match = /light-dark\([^,]+,\s*([^)]+)\)/i.exec(value ?? '');
	return match ? match[1].trim() : undefined;
}

export interface Theme {
	id: string;
	name: string;
	/** Sparse map: full var name → value; unset vars stay at their initial. */
	values: Record<string, string>;
	/** Set when the theme started as a preset or a saved-theme fork. */
	forkOf?: string;
	updatedAt: number;
}

/**
 * Built-in presets. Keys are full var names; a `@dark` suffix on the key sets
 * a scheme-specific value (e.g. `--pico-color@dark`), otherwise the light
 * value is inherited by dark mode. Palettes carry these @dark halves so
 * swapping schemes keeps them readable: background + text (+ their muted
 * variants) always differ per scheme.
 */
export const presets: Theme[] = [
	{
		id: 'preset-default',
		name: 'Blades (Default)',
		values: {},
		updatedAt: 0,
	},
	{
		id: 'preset-paper',
		name: 'Paper',
		forkOf: 'preset-default',
		values: {
			'--pico-background-color': '#f7f4ee',
			'--pico-color': '#33302a',
			'--pico-muted-color': '#6d675b',
			'--pico-muted-border-color': '#ded8cb',
			'--pico-background-color@dark': '#1b1712',
			'--pico-color@dark': '#e7decd',
			'--pico-muted-color@dark': '#a89e8c',
			'--pico-muted-border-color@dark': '#3a332a',
			'--pico-primary': '#8a5a2b',
			'--pico-primary@dark': '#d9a066',
			'--pico-primary-background': '#8a5a2b',
			'--pico-primary-background@dark': '#a4743f',
			'--pico-form-element-background-color': '#fffdf8',
			'--pico-form-element-background-color@dark': '#241f18',
			'--pico-code-kbd-background-color': '#eae5da',
			'--pico-code-kbd-background-color@dark': '#332c22',
			'--pico-border-radius': '0.375rem',
		},
		updatedAt: 0,
	},
	{
		id: 'preset-ink',
		name: 'Ink',
		forkOf: 'preset-default',
		values: {
			'--pico-background-color': '#14161a',
			'--pico-color': '#d9dde3',
			'--pico-muted-color': '#7d8590',
			'--pico-muted-border-color': '#262b34',
			'--pico-primary': '#6ea8fe',
			'--pico-primary-background': '#6ea8fe',
			'--pico-font-weight': '450',
			// Ink is a dark-first palette: keep the values in both schemes.
			'--pico-background-color@dark': '#14161a',
			'--pico-color@dark': '#d9dde3',
			'--pico-muted-color@dark': '#7d8590',
			'--pico-muted-border-color@dark': '#262b34',
			'--pico-primary@dark': '#6ea8fe',
			'--pico-primary-background@dark': '#6ea8fe',
			'--pico-form-element-background-color': '#1c2026',
			'--pico-form-element-background-color@dark': '#1c2026',
			'--pico-code-kbd-background-color': '#23282f',
			'--pico-code-kbd-background-color@dark': '#23282f',
		},
		updatedAt: 0,
	},
	{
		id: 'preset-forest',
		name: 'Forest',
		forkOf: 'preset-default',
		values: {
			'--pico-background-color': '#f3f7f2',
			'--pico-color': '#24352a',
			'--pico-muted-color': '#5f7064',
			'--pico-muted-border-color': '#d5e0d4',
			'--pico-background-color@dark': '#121c15',
			'--pico-color@dark': '#d6e4d8',
			'--pico-muted-color@dark': '#8aa093',
			'--pico-muted-border-color@dark': '#2c3d31',
			'--pico-primary': '#2f6f4f',
			'--pico-primary@dark': '#66b389',
			'--pico-primary-background': '#2f6f4f',
			'--pico-primary-background@dark': '#3d8a63',
			'--pico-form-element-background-color': '#fafdf9',
			'--pico-form-element-background-color@dark': '#18231a',
			'--pico-code-kbd-background-color': '#e5efe6',
			'--pico-code-kbd-background-color@dark': '#243328',
			'--pico-border-radius': '0.5rem',
		},
		updatedAt: 0,
	},
	{
		id: 'preset-plum',
		name: 'Plum',
		forkOf: 'preset-default',
		values: {
			'--pico-background-color': '#faf6fb',
			'--pico-color': '#3b2b40',
			'--pico-muted-color': '#75667b',
			'--pico-muted-border-color': '#e4d8e7',
			'--pico-background-color@dark': '#191019',
			'--pico-color@dark': '#eadbe9',
			'--pico-muted-color@dark': '#a892ab',
			'--pico-muted-border-color@dark': '#3a2b3d',
			'--pico-primary': '#8a4b91',
			'--pico-primary@dark': '#c98fd0',
			'--pico-primary-background': '#8a4b91',
			'--pico-primary-background@dark': '#a163a8',
			'--pico-form-element-background-color': '#fffefd',
			'--pico-form-element-background-color@dark': '#231724',
			'--pico-code-kbd-background-color': '#efe4ef',
			'--pico-code-kbd-background-color@dark': '#2b1e2c',
			'--pico-font-size': '102%',
		},
		updatedAt: 0,
	},
	{
		id: 'preset-contrast',
		name: 'High contrast',
		forkOf: 'preset-default',
		values: {
			'--pico-background-color': '#ffffff',
			'--pico-color': '#000000',
			'--pico-muted-color': '#3d3d3d',
			'--pico-muted-border-color': '#000000',
			'--pico-background-color@dark': '#000000',
			'--pico-color@dark': '#ffffff',
			'--pico-muted-color@dark': '#c2c2c2',
			'--pico-muted-border-color@dark': '#ffffff',
			'--pico-primary': '#0033cc',
			'--pico-primary@dark': '#66a3ff',
			'--pico-primary-background': '#0033cc',
			'--pico-primary-background@dark': '#3366ff',
			'--pico-form-element-background-color': '#ffffff',
			'--pico-form-element-background-color@dark': '#000000',
			'--pico-code-kbd-background-color': '#ffffff',
			'--pico-code-kbd-background-color@dark': '#000000',
			'--pico-border-width': '0.125rem',
			'--pico-font-weight': '500',
		},
		updatedAt: 0,
	},
];

/** The localStorage bucket. Versioned for future schema moves. */
export const STORAGE_KEY = 'knives-customizer';
export const STORAGE_VERSION = 1;
