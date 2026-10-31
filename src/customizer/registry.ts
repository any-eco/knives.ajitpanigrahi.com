/**
 * Theme customizer — variable registry and built-in presets.
 *
 * The registry is hand-picked for now (the extraction script that generates it
 * from the installed Blades CSS is a later work package); see
 * docs/plans/theme-customizer.md.
 */

/** The custom property types the panel can edit for now. */
export type VarType = 'color' | 'length' | 'text';

export interface VariableDefinition {
	/** Stable internal key, e.g. `pico.primary`. */
	id: string;
	name: string;
	source: 'pico' | 'blades' | 'knives';
	category: string;
	type: VarType;
	/** Value suggested when the picker opens; `null` means "initial (unset)". */
	sample: string | null;
	/** Hex fallback for color pickers when `sample` describes both schemes. */
	swatch?: string;
}

export interface Theme {
	id: string;
	name: string;
	/** Sparse map of var id → value; unset vars stay at Blade defaults. */
	values: Record<string, string>;
	/** Set when the theme started as a preset or a saved-theme fork. */
	forkOf?: string;
	updatedAt: number;
}

/** Order the panel groups follow. */
export const categories = ['Colors', 'Spacing & sizing', 'Typography'] as const;

export const variables: VariableDefinition[] = [
	{
		id: 'pico.primary',
		name: '--pico-primary',
		source: 'pico',
		category: 'Colors',
		type: 'color',
		sample: '#0172ad',
	},
	{
		id: 'pico.primary-background',
		name: '--pico-primary-background',
		source: 'pico',
		category: 'Colors',
		type: 'color',
		sample: '#0172ad',
	},
	{
		id: 'pico.background-color',
		name: '--pico-background-color',
		source: 'pico',
		category: 'Colors',
		type: 'color',
		sample: 'light-dark(#ffffff, #131620)',
		swatch: '#ffffff',
	},
	{
		id: 'pico.color',
		name: '--pico-color',
		source: 'pico',
		category: 'Colors',
		type: 'color',
		sample: 'light-dark(#373c44, #c2c7d0)',
		swatch: '#373c44',
	},
	{
		id: 'pico.muted-color',
		name: '--pico-muted-color',
		source: 'pico',
		category: 'Colors',
		type: 'color',
		sample: '#646b79',
	},
	{
		id: 'pico.muted-border-color',
		name: '--pico-muted-border-color',
		source: 'pico',
		category: 'Colors',
		type: 'color',
		sample: '#e7eaef',
	},
	{
		id: 'pico.border-radius',
		name: '--pico-border-radius',
		source: 'pico',
		category: 'Spacing & sizing',
		type: 'length',
		sample: '0.25rem',
	},
	{
		id: 'pico.spacing',
		name: '--pico-spacing',
		source: 'pico',
		category: 'Spacing & sizing',
		type: 'length',
		sample: '1rem',
	},
	{
		id: 'pico.form-element-spacing-vertical',
		name: '--pico-form-element-spacing-vertical',
		source: 'pico',
		category: 'Spacing & sizing',
		type: 'length',
		sample: '0.75rem',
	},
	{
		id: 'pico.font-size',
		name: '--pico-font-size',
		source: 'pico',
		category: 'Typography',
		type: 'length',
		sample: '100%',
	},
	{
		id: 'pico.font-weight',
		name: '--pico-font-weight',
		source: 'pico',
		category: 'Typography',
		type: 'text',
		sample: '400',
	},
	{
		id: 'pico.transition',
		name: '--pico-transition',
		source: 'pico',
		category: 'Typography',
		type: 'text',
		sample: '0.2s ease-in-out',
	},
];

const byId = new Map(variables.map((v) => [v.id, v]));

export function getDefinition(id: string): VariableDefinition | undefined {
	return byId.get(id);
}

/**
 * Built-in presets. One value per variable — Pico's layered palette uses
 * `light-dark()`, so a value applies to both color schemes until per-scheme
 * editing lands (an open question in the spec).
 */
export const presets: Theme[] = [
	{
		id: 'preset-default',
		name: 'Blades default',
		values: {},
		updatedAt: 0,
	},
	{
		id: 'preset-paper',
		name: 'Paper',
		forkOf: 'preset-default',
		values: {
			'pico.background-color': '#f7f4ee',
			'pico.color': '#33302a',
			'pico.muted-color': '#6d675b',
			'pico.muted-border-color': '#ded8cb',
			'pico.primary': '#8a5a2b',
			'pico.primary-background': '#8a5a2b',
			'pico.border-radius': '0.375rem',
		},
		updatedAt: 0,
	},
	{
		id: 'preset-ink',
		name: 'Ink',
		forkOf: 'preset-default',
		values: {
			'pico.background-color': '#14161a',
			'pico.color': '#d9dde3',
			'pico.muted-color': '#7d8590',
			'pico.muted-border-color': '#262b34',
			'pico.primary': '#6ea8fe',
			'pico.primary-background': '#6ea8fe',
			'pico.font-weight': '450',
		},
		updatedAt: 0,
	},
];

/** The localStorage bucket. Versioned for future schema moves. */
export const STORAGE_KEY = 'knives-customizer';
export const STORAGE_VERSION = 1;
