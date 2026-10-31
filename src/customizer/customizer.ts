/**
 * Theme customizer client — minimal vanilla JS. Three responsibilities:
 * 1. state: the working theme (sparse id → value overrides) + persistence;
 * 2. theme list: apply/fork presets, apply/rename/delete saved themes;
 * 3. applier: turn the override map into one unlayered CSS block and post it
 *    into the demo iframe (which owns the same override style element).
 *
 * One script, no framework. Event delegation only.
 */
import {
	STORAGE_KEY,
	STORAGE_VERSION,
	getDefinition,
	presets,
	variables,
	type Theme,
} from './registry';

type State = {
	/** Sparse override map. */
	values: Record<string, string>;
	/** The theme the edits are based on, or null when nothing is loaded yet. */
	base: Theme | null;
	/** True while edits live only in memory. */
	dirty: boolean;
};

const $ = <T extends Element = HTMLElement>(sel: string, root: Element | Document = document) =>
	root.querySelector<T>(sel)!;

const $$ = <T extends Element = HTMLElement>(sel: string, root: Element | Document = document) => [
	...root.querySelectorAll<T>(sel),
];

const state: State = { values: {}, base: null, dirty: false };

/* ---------------------------------- storage ------------------------------- */

interface Storage {
	version: number;
	themes: Theme[];
	activeId: string | null;
}

function loadStorage(): Storage {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const data = JSON.parse(raw) as Storage;
			if (data.version === STORAGE_VERSION) {
				return {
					version: data.version,
					themes: data.themes ?? [],
					activeId: data.activeId ?? null,
				};
			}
		}
	} catch {
		/* fail soft: private mode, quota, corrupt JSON → defaults */
	}
	return { version: STORAGE_VERSION, themes: [], activeId: null };
}

function saveStorage() {
	const data = loadStorage();
	data.activeId = state.base?.id ?? null;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch {
		notice("Could not reach local storage — changes won't persist.");
	}
}

function persistTheme(theme: Theme) {
	const data = loadStorage();
	const i = data.themes.findIndex((t) => t.id === theme.id);
	if (i >= 0) data.themes[i] = theme;
	else data.themes.push(theme);
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch {
		notice('Could not save the theme in local storage.');
	}
	renderThemes();
}

function randomId() {
	return `theme-${crypto.randomUUID()}`;
}

/* --------------------------------- applier -------------------------------- */

function cssSafe(value: string) {
	// Values are user input; keep them out of braces/semicolons.
	return value.replace(/[{};\\]/g, '');
}

function renderCss(values: Record<string, string>) {
	const lines = variables
		.filter((v) => values[v.id])
		.map((v) => `	${v.name}: ${cssSafe(values[v.id])};`);
	return lines.length ? `:where(:root) {\n${lines.join('\n')}\n}` : '';
}

const demo = () => $<HTMLIFrameElement>('#cx-demo');

function apply() {
	demo().contentWindow?.postMessage({ type: 'knives-cx', css: renderCss(state.values) }, '*');
}

function refreshRows() {
	for (const row of $$('[data-cx-row]')) {
		const id = row.dataset.cxRow!;
		const value = state.values[id];
		const input = $<HTMLInputElement>('input[name=value]', row);
		if (row.dataset.type === 'color') {
			// The color input needs a concrete value to open a picker; feed it the
			// override, else the definition's swatch — but never write the value back.
			const raw = state.values[id] ?? getDefinition(id)?.swatch ?? getDefinition(id)?.sample;
			if (!input.matches(':focus')) {
				input.value = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw ?? '')?.[0] ?? '#7f7f7f';
			}
		} else {
			if (!input.matches(':focus')) input.value = value ?? '';
			// Unset length/text fields keep nothing in the box: the placeholder
			// says "initial".
		}
		const reset = $<HTMLButtonElement>('button[data-cx-reset]', row);
		reset.disabled = !value;
		const text = $<HTMLElement>('[data-cx-current]', row);
		text.textContent = value ? '' : 'initial';
	}
	updateMeta();
}

function overrideCount() {
	return Object.keys(state.values).filter((id) => state.values[id]).length;
}

function updateMeta() {
	$('#cx-modified').textContent = String(overrideCount());
	($('#cx-reset-all') as HTMLButtonElement).disabled = overrideCount() === 0;
	const dirty = $('#cx-dirty');
	dirty.hidden = !state.dirty;
	updateSaveLabel();
}

function markDirty() {
	const baseValues = state.base?.values ?? {};
	state.dirty =
		Object.keys(state.values).length !== Object.keys(baseValues).length ||
		Object.keys(state.values).some((id) => state.values[id] !== baseValues[id]);
	updateMeta();
	updateSaveLabel();
}

function currentThemeName() {
	return state.base?.name ?? 'My theme';
}

function updateSaveLabel() {
	$('#cx-save').textContent = state.dirty ? `Save “${currentThemeName()}”…` : 'Saved';
}

/* ------------------------------ theme actions ----------------------------- */

function loadTheme(theme: Theme) {
	state.base = theme;
	state.values = { ...theme.values };
	state.dirty = false;
	$<HTMLInputElement>('#cx-name').value = theme.name;
	renderThemes();
	refreshRows();
	apply();
	saveStorage();
}

function fork(base: Theme, name: string): Theme {
	return { ...base, id: randomId(), name, forkOf: base.id, updatedAt: Date.now() };
}

function saveCurrent() {
	const name = ($<HTMLInputElement>('#cx-name').value || 'My theme').trim();
	const editingSaved = state.base && state.base.id.startsWith('theme-');
	const theme: Theme = editingSaved
		? { ...state.base!, name, values: { ...state.values }, updatedAt: Date.now() }
		: { id: randomId(), name, values: { ...state.values }, updatedAt: Date.now() };
	persistTheme(theme);
	state.base = theme;
	state.values = { ...theme.values };
	state.dirty = false;
	saveStorage();
	renderThemes();
	refreshRows();
	notice(`Saved “${theme.name}”.`);
}

function deleteTheme(id: string) {
	const data = loadStorage();
	data.themes = data.themes.filter((t) => t.id !== id);
	if (state.base?.id === id) state.base = null;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch {}
	renderThemes();
}

function renderThemes() {
	const data = loadStorage();
	const list = $('#cx-theme-list');
	list.innerHTML = '';
	const row = (theme: Theme, actions: string) => {
		const li = document.createElement('li');
		li.dataset.cxTheme = theme.id;
		li.innerHTML = `<span>${theme.name}</span>` + actions;
		return li;
	};
	for (const preset of presets) {
		list.append(
			row(
				preset,
				`<button data-cx-load="${preset.id}" title="Apply preset">Apply</button>
				<button data-cx-fork="${preset.id}" title="Fork into a saved theme">Fork</button>`,
			),
		);
	}
	for (const theme of data.themes) {
		const active = state.base?.id === theme.id && !state.dirty;
		list.append(
			row(
				theme,
				`${active ? '<b>Active</b>' : `<button data-cx-load="${theme.id}">Apply</button>`}
				<button data-cx-rename="${theme.id}" title="Rename">✎</button>
				<button data-cx-delete="${theme.id}" title="Delete">✕</button>`,
			),
		);
	}
	if (!data.themes.length) {
		const empty = document.createElement('li');
		empty.dataset.cxEmpty = 'true';
		empty.textContent = 'Nothing saved yet.';
		list.append(empty);
	}
}

/* ---------------------------------- notice -------------------------------- */

let noticeTimer: number | undefined;
function notice(message: string) {
	const el = $('#cx-notice');
	el.textContent = message;
	el.showPopover();
	clearTimeout(noticeTimer);
	noticeTimer = window.setTimeout(() => el.hidePopover(), 4000);
}

/* ---------------------------- wiring (delegated) -------------------------- */

document.addEventListener('input', (e) => {
	const input = e.target as HTMLInputElement;
	const row = input.closest('[data-cx-row]');
	if (!row) return;
	const id = row.getAttribute('data-cx-row')!;
	if (!input.value) delete state.values[id];
	else state.values[id] = input.value;
	refreshRows();
	markDirty();
	apply();
});

document.addEventListener('click', (e) => {
	const target = e.target as HTMLElement;
	const button = target.closest('button');
	if (!button) return;

	const row = button.closest('[data-cx-row]');
	if (row) {
		// Per-row reset: drop the override, back to the Blade default.
		delete state.values[row.getAttribute('data-cx-row')!];
		refreshRows();
		markDirty();
		apply();
		return;
	}

	if (button.id === 'cx-reset-all') {
		state.values = {};
		refreshRows();
		markDirty();
		apply();
		return;
	}

	if (button.id === 'cx-save') {
		saveCurrent();
		return;
	}

	const loadId = button.dataset.cxLoad;
	if (loadId) {
		const theme =
			presets.find((t) => t.id === loadId) ?? loadStorage().themes.find((t) => t.id === loadId);
		if (theme) loadTheme(theme);
		return;
	}

	const forkId = button.dataset.cxFork;
	if (forkId) {
		const base =
			presets.find((t) => t.id === forkId) ?? loadStorage().themes.find((t) => t.id === forkId);
		if (base) loadTheme(fork(base, `${base.name} fork`));
		notice('Forked — rename and save it.');
		return;
	}

	const renameId = button.dataset.cxRename;
	if (renameId) {
		const theme = loadStorage().themes.find((t) => t.id === renameId);
		const name = theme && window.prompt('New name', theme.name);
		if (theme && name) persistTheme({ ...theme, name, updatedAt: Date.now() });
		return;
	}

	const deleteId = button.dataset.cxDelete;
	if (deleteId) {
		const theme = loadStorage().themes.find((t) => t.id === deleteId);
		if (theme && window.confirm(`Delete “${theme.name}”?`)) deleteTheme(deleteId);
	}
});

/* Scheme buttons in the demo toolbar forward to the iframe. */
let scheme: 'system' | 'light' | 'dark' = 'system';

function applyScheme() {
	demo().contentWindow?.postMessage(
		{ type: 'knives-cx-scheme', theme: scheme === 'system' ? null : scheme },
		'*',
	);
}

$$('[data-cx-scheme-button]').forEach((button) => {
	button.addEventListener('click', () => {
		scheme = (button.dataset.cxSchemeButton ?? 'system') as typeof scheme;
		$$('[data-cx-scheme-button]').forEach((b) =>
			b.setAttribute('aria-pressed', String(b === button)),
		);
		applyScheme();
	});
});

/* -------------------------------- boot ---------------------------------- */

const data = loadStorage();
const boot = data.activeId
	? [presets.find((t) => t.id === data.activeId), ...data.themes].find(
			(t) => t?.id === data.activeId,
		)
	: undefined;
loadTheme(boot ?? presets[0]!);
refreshRows();

/* When the demo finishes loading, replay the current overrides. */
demo().addEventListener('load', () => {
	apply();
	applyScheme();
});
