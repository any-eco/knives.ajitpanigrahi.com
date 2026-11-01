/**
 * Themer client — minimal vanilla JS for the site-wide customizer panel.
 *
 * 1. state: the working theme (sparse name → value overrides) + persistence;
 * 2. theme list: apply/fork presets, apply/rename/duplicate/delete saved themes;
 * 3. applier: render one unlayered override <style> on the live page (the
 *    site IS the preview).
 *
 * One script, no framework. Event delegation only.
 */
import {
	STORAGE_KEY,
	STORAGE_VERSION,
	darkHalfOf,
	getDefinition,
	hexOf,
	lightHalfOf,
	presets,
	variables,
	type Theme,
} from './registry';

type State = {
	/** Sparse override map, keyed by full variable name (+ `@dark` suffixes). */
	values: Record<string, string>;
	/** The theme the edits are based on, or null when nothing is loaded yet. */
	base: Theme | null;
	/** True while edits live only in memory. */
	dirty: boolean;
	/** Which scheme half the variable rows edit. */
	schemeMode: 'light' | 'dark';
};

const $ = <T extends Element = HTMLElement>(sel: string, root: Element | Document = document) =>
	root.querySelector<T>(sel)!;

const $$ = <T extends Element = HTMLElement>(sel: string, root: Element | Document = document) => [
	...root.querySelectorAll<T>(sel),
];

const state: State = {
	values: {},
	base: null,
	dirty: false,
	schemeMode: 'light',
};

/** The values key a row currently edits: `--var` in light, `--var@dark` in dark. */
function editKey(name: string) {
	return state.schemeMode === 'dark' ? `${name}@dark` : name;
}

/* The file input for imports is server-rendered; wire it once. */
document.addEventListener('change', (event) => {
	const input = event.target as HTMLInputElement;
	if (input.id === 'docs-import' && input.files?.[0]) {
		void importThemes(input.files[0]);
		input.value = '';
	}
});

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

function randomId() {
	return `theme-${crypto.randomUUID()}`;
}

/* --------------------------------- applier -------------------------------- */

function cssSafe(value: string) {
	// Values are user input; keep them out of braces/semicolons.
	return value.replace(/[{};]/g, '');
}

function cssFor(values: Record<string, string>): string {
	// Selectors intentionally use :root:root (0,2,0) unlayered: site role CSS
	// declares :root-level variables themselves (unlayered, 0,1,0), and a
	// :where(:root) override would lose those ties. Higher specificity +
	// appending the style element last makes the live overrides win.
	//
	// Scheme halves: `name` carries the light value, `name@dark` the dark
	// value. Dark inherits the light value unless a dark override exists.
	// `light-dark()` pairs ride along for colors; non-color values (which
	// light-dark() can't express) are scheme-split into override rules.
	const rootLines: string[] = [];
	const scoped = new Map<string, string[]>();
	const darkRoot: string[] = [];
	const darkScoped = new Map<string, string[]>();

	for (const def of variables) {
		const name = def.name;
		const light = values[name] || '';
		const dark = values[`${name}@dark`] || '';
		if (!light && !dark) continue;

		const paired =
			def.type === 'color' && /light-dark\(/i.test(def.initial)
				? [lightHalfOf(def.initial), darkHalfOf(def.initial)]
				: null;

		let baseLine: string | null = null;
		let darkOnly = false;

		if (paired) {
			if (dark)
				baseLine = light
					? `	${name}: light-dark(${cssSafe(light)}, ${cssSafe(dark)});`
					: `	${name}: light-dark(${paired[0]}, ${cssSafe(dark)});`;
			else if (light) baseLine = `	${name}: ${cssSafe(light)};`; // dark inherits
		} else if (!dark) {
			baseLine = `	${name}: ${cssSafe(light)};`;
		} else {
			if (light) baseLine = `	${name}: ${cssSafe(light)};`;
			darkOnly = true;
		}

		if (baseLine) {
			if (def.selector) scoped.set(def.selector, [...(scoped.get(def.selector) ?? []), baseLine]);
			else rootLines.push(baseLine);
		}

		if (darkOnly) {
			const darkLine = `	${name}: ${cssSafe(dark)};`;
			if (def.selector)
				darkScoped.set(def.selector, [...(darkScoped.get(def.selector) ?? []), darkLine]);
			else darkRoot.push(darkLine);
		}
	}

	let css = rootLines.length ? `:root:root {\n${rootLines.join('\n')}\n}` : '';
	for (const [selector, lines] of scoped) css += `\n${selector} {\n${lines.join('\n')}\n}`;
	if (darkRoot.length) {
		css += `\n:root:root[data-theme='dark'] {\n${darkRoot.join('\n')}\n}`;
		css += `\n@media (prefers-color-scheme: dark) {\n	:root:root:not([data-theme]) {\n${darkRoot.join('\n')}\n	}\n}`;
	}
	for (const [selector, lines] of darkScoped) {
		css += `\n${selector}:where([data-theme='dark']) {\n${lines.join('\n')}\n}`;
		css += `\n@media (prefers-color-scheme: dark) {\n	:where(${selector}):where(:root:not([data-theme])) {\n${lines.join('\n')}\n	}\n}`;
	}
	return css.trim();
}

function apply() {
	// The live page: install/refresh the override style element.
	let style = document.getElementById('docs-vars');
	if (!style) {
		style = document.createElement('style');
		style.id = 'docs-vars';
		document.head.append(style);
	}
	style.textContent = cssFor(state.values);
}

function refreshRows() {
	const darkMode = state.schemeMode === 'dark';
	for (const row of $$('[data-docs-row]')) {
		const name = row.dataset.docsRow!;
		const value = state.values[editKey(name)];
		const input = $<HTMLInputElement>('input[name=value]', row);
		const def = getDefinition(name);
		if (row.dataset.type === 'color') {
			// The picker needs a concrete 6-digit hex; in dark mode an unset
			// dark value pre-fills with the inherited light value (the dark
			// scheme shows it), else the site's dark half of the initial.
			let raw = value ?? def?.initial ?? '';
			if (darkMode) raw = value ?? state.values[name] ?? darkHalfOf(def?.initial) ?? '';
			if (!input.matches(':focus')) input.value = hexOf(raw) ?? '#7f7f7f';
			input.placeholder = darkMode && state.values[name] ? 'inherits' : 'initial';
		} else if (!input.matches(':focus')) {
			input.value = value ?? '';
			input.placeholder = darkMode && state.values[name] ? 'inherits' : 'initial';
		}
		// Icon (`url(...)`) values swap the preview's mask.
		const preview = row.querySelector<HTMLElement>('[data-docs-icon-preview]');
		if (preview) {
			preview.style.setProperty('--docs-cx-icon-preview', value ?? def?.initial ?? 'none');
		}
		$<HTMLButtonElement>('button[data-docs-reset]', row).disabled = !value;
		$<HTMLElement>('[data-docs-current]', row).textContent = value
			? ''
			: darkMode && state.values[name]
				? 'inherits'
				: 'initial';
	}
	updateMeta();
}

/* -------------------------------- meta state ------------------------------ */

function overrideCount() {
	return Object.keys(state.values).filter((name) => state.values[name]).length;
}

function updateMeta() {
	const counter = $('#docs-modified');
	if (counter) counter.textContent = String(overrideCount());
	$<HTMLButtonElement>('#docs-reset-all').disabled = overrideCount() === 0;
	$('#docs-dirty').hidden = !state.dirty;
	updateSaveLabel();
}

function markDirty() {
	const baseValues = state.base?.values ?? {};
	state.dirty =
		Object.keys(state.values).length !== Object.keys(baseValues).length ||
		Object.keys(state.values).some((name) => state.values[name] !== baseValues[name]);
	updateMeta();
}

function updateSaveLabel() {
	const button = $('#docs-save');
	if (button) button.textContent = state.dirty ? 'Save' : 'Saved';
}

/* ------------------------------ theme actions ----------------------------- */

function loadTheme(theme: Theme) {
	state.base = theme;
	state.values = { ...theme.values };
	state.dirty = false;
	$<HTMLInputElement>('#docs-name').value = theme.name;
	renderThemes();
	refreshRows();
	apply();
	saveStorage();
}

function fork(base: Theme, name: string): Theme {
	return { ...base, id: randomId(), name, forkOf: base.id, updatedAt: Date.now() };
}

function saveCurrent() {
	const name = ($<HTMLInputElement>('#docs-name').value || 'My theme').trim();
	const theme: Theme = state.base?.id.startsWith('theme-')
		? { ...state.base, name, values: { ...state.values }, updatedAt: Date.now() }
		: { id: randomId(), name, values: { ...state.values }, updatedAt: Date.now() };
	persistTheme(theme);
	state.base = theme;
	state.values = { ...theme.values };
	state.dirty = false;
	$<HTMLInputElement>('#docs-name').value = theme.name;
	saveStorage();
	renderThemes();
	refreshRows();
	notice(`Saved “${theme.name}”.`);
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
	const list = $('#docs-theme-list');
	list.innerHTML = '';
	const row = (theme: Theme, actions: string) => {
		const li = document.createElement('li');
		li.dataset.docsTheme = theme.id;
		li.innerHTML = `<span>${theme.name}</span>` + actions;
		return li;
	};
	for (const preset of presets) {
		list.append(
			row(
				preset,
				`<button data-docs-load="${preset.id}" title="Apply preset">Apply</button>
				<button data-docs-fork="${preset.id}" title="Fork into a saved theme">Fork</button>`,
			),
		);
	}
	for (const theme of data.themes) {
		const active = state.base?.id === theme.id && !state.dirty;
		list.append(
			row(
				theme,
				`${active ? '<b>Active</b>' : `<button data-docs-load="${theme.id}">Apply</button>`}
				<button data-docs-rename="${theme.id}" title="Rename">✎</button>
				<button data-docs-delete="${theme.id}" title="Delete">✕</button>`,
			),
		);
	}
	if (!data.themes.length) {
		const empty = document.createElement('li');
		empty.dataset.docsEmpty = 'true';
		empty.textContent = 'Nothing saved yet.';
		list.append(empty);
	}
}

/* ---------------------------------- filter -------------------------------- */

function filterRows() {
	const query = ($<HTMLInputElement>('[data-docs-filter]')?.value ?? '').trim().toLowerCase();
	let visible = 0;
	for (const row of $$('[data-docs-row]')) {
		const match = !query || (row.dataset.docsRow ?? '').toLowerCase().includes(query);
		row.hidden = !match;
		if (match) visible++;
	}
	for (const group of $$('[data-docs-group]')) {
		group.hidden = ![...group.querySelectorAll<HTMLElement>('[data-docs-row]')].some(
			(r) => !r.hidden,
		);
	}
	for (const source of $$('[data-docs-source]')) {
		source.hidden = ![...source.querySelectorAll<HTMLElement>('[data-docs-group]')].some(
			(g) => !g.hidden,
		);
	}
	const count = $('[data-docs-filter-count]');
	if (count) count.textContent = query ? `${visible}/${$$('[data-docs-row]').length}` : '';
}

/* ------------------------------- export/import ---------------------------- */

function exportTheme() {
	const name = ($<HTMLInputElement>('#docs-name').value || 'My theme').trim();
	const payload = {
		name,
		values: state.values,
		exportedAt: new Date().toISOString(),
	};
	const blob = new Blob([JSON.stringify(payload, null, '\t')], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `knives-theme-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
	notice('Theme exported.');
}

async function importThemes(file: File) {
	try {
		const parsed = JSON.parse(await file.text()) as {
			name?: string;
			values?: Record<string, string>;
			themes?: Theme[];
		};
		const incoming: Theme[] =
			parsed.themes ?? (parsed.values ? [{ ...parsed, id: '', updatedAt: 0 } as Theme] : []);
		let imported = 0;
		for (const theme of incoming) {
			const values = Object.fromEntries(
				Object.entries(theme.values ?? {}).filter(
					([name, value]) => getDefinition(name) && typeof value === 'string',
				),
			);
			persistTheme({
				id: randomId(),
				name: theme.name || file.name.replace(/\.json$/i, ''),
				forkOf: theme.forkOf,
				values,
				updatedAt: Date.now(),
			});
			imported++;
		}
		notice(
			imported
				? `Imported ${imported} theme${imported === 1 ? '' : 's'}.`
				: 'No themes found in that file.',
		);
	} catch {
		notice('That file is not a valid theme JSON.');
	}
}

/* -------------------------- native-dialog plumbing ------------------------ */

/* Minimal JS for the native <dialog>s: show/showModal + aria bookkeeping.
   The main panel opens modal on mobile (<1100px, overlay) and modeless on
   wide screens (docked right, the page shifts over via html[data-docs-docked]);
   its open state persists across navigation through session storage. The
   "Save & Manage Themes" dialog opens only from its header button, always as
   a modeless dock beside the main rail. Closing: Esc, or the ✕ buttons
   ([data-docs-close]). */
const PANEL_ID = 'docs-panel';
const DOCKED_QUERY = '(min-width: 1100px)';
const PANEL_OPEN_KEY = 'knives-customizer-panel-open';

function isDocked() {
	return window.matchMedia(DOCKED_QUERY).matches;
}

function syncTrigger(dialog: HTMLDialogElement | null) {
	if (!dialog) return;
	for (const trigger of $$('[data-docs-open]')) {
		if (trigger.dataset.docsOpen === dialog.id)
			trigger.setAttribute('aria-expanded', String(dialog.open));
	}
}

/**
 * Dock bookkeeping: only the main panel claims html[data-docs-docked]; the
 * themes dialog stacks directly on top of it, so no extra rail state exists.
 */
function clearDockAttrs() {
	delete document.documentElement.dataset.docsDocked;
}

function applyDialog(dialog: HTMLDialogElement, persist: boolean) {
	if (isDocked()) {
		dialog.show();
		if (dialog.id === PANEL_ID) document.documentElement.dataset.docsDocked = 'true';
	} else {
		dialog.showModal();
		delete document.documentElement.dataset.docsDocked;
	}
	if (persist) sessionStorage.setItem(PANEL_OPEN_KEY, '1');
	else syncTrigger(dialog);
}

/* Re-dock (or take over as overlay) when the viewport crosses the breakpoint
   while either dialog is open. */
window.matchMedia(DOCKED_QUERY).addEventListener('change', () => {
	for (const id of [PANEL_ID, 'docs-themes-panel']) {
		const dialog = document.getElementById(id);
		if (dialog instanceof HTMLDialogElement && dialog.open) {
			const wasMain = id === PANEL_ID;
			dialog.close();
			applyDialog(dialog, wasMain);
			if (wasMain) sessionStorage.setItem(PANEL_OPEN_KEY, '1');
		}
	}
});

if (sessionStorage.getItem(PANEL_OPEN_KEY) === '1') {
	const dialog = document.getElementById(PANEL_ID);
	if (dialog instanceof HTMLDialogElement && !dialog.open) applyDialog(dialog, true);
}

for (const trigger of $$('[data-docs-open]')) {
	const dialog = document.getElementById(trigger.dataset.docsOpen ?? '');
	if (!dialog || !(dialog instanceof HTMLDialogElement)) continue;
	const isMain = dialog.id === PANEL_ID;
	const persist = isMain;

	// The main footer button toggles; other openers (Save & Manage Themes)
	// only open — closing belongs to the ✕ buttons and Esc.
	const open = () => {
		if (dialog.open) {
			if (isMain) {
				dialog.close();
				clearDockAttrs();
				sessionStorage.setItem(PANEL_OPEN_KEY, '0');
			}
			return;
		}
		applyDialog(dialog, persist);
		syncTrigger(dialog);
	};
	trigger.addEventListener('click', open);
	dialog.addEventListener('close', () => {
		clearDockAttrs();
		if (persist) sessionStorage.setItem(PANEL_OPEN_KEY, '0');
	});
	if (!trigger.hasAttribute('aria-controls')) trigger.setAttribute('aria-controls', dialog.id);
	syncTrigger(dialog);
}

/* Deterministic ✕ closers — no toggling semantics. */
for (const closer of $$('[data-docs-close]')) {
	closer.addEventListener('click', () => {
		const dialog = document.getElementById(closer.dataset.docsClose ?? '');
		if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return;
		dialog.close();
		clearDockAttrs();
		if (dialog.id === PANEL_ID) sessionStorage.setItem(PANEL_OPEN_KEY, '0');
		syncTrigger(dialog);
	});
}

/* ---------------------------------- notice -------------------------------- */

let noticeTimer: number | undefined;
function notice(message: string) {
	const el = $('#docs-notice');
	if (!el) return;
	el.textContent = message;
	el.showPopover();
	clearTimeout(noticeTimer);
	noticeTimer = window.setTimeout(() => el.hidePopover(), 4000);
}

/* ---------------------------- wiring (delegated) -------------------------- */

document.addEventListener('input', (e) => {
	const input = e.target as HTMLInputElement;
	if (input.matches('[data-docs-filter]')) {
		filterRows();
		return;
	}
	if (input.matches('[data-docs-scheme-mode-input]')) {
		return; // handled by the click handler below
	}
	const row = input.closest('[data-docs-row]');
	if (!row) return;
	const name = row.getAttribute('data-docs-row')!;
	const key = editKey(name);
	if (!input.value) delete state.values[key];
	else state.values[key] = input.value;
	refreshRows();
	markDirty();
	apply();
});

document.addEventListener('click', (e) => {
	const button = (e.target as HTMLElement).closest('button');
	if (!button) return;

	const row = button.closest('[data-docs-row]');
	if (row) {
		// Per-row reset: drop the override for the scheme being edited.
		const name = row.getAttribute('data-docs-row')!;
		delete state.values[editKey(name)];

		refreshRows();
		markDirty();
		apply();
		return;
	}

	if (button.id === 'docs-reset-all') {
		state.values = {};
		refreshRows();
		markDirty();
		apply();
		return;
	}

	if (button.id === 'docs-save') {
		saveCurrent();
		return;
	}

	if (button.id === 'docs-export') {
		exportTheme();
		return;
	}

	const loadId = button.dataset.docsLoad;
	if (loadId) {
		const theme =
			presets.find((t) => t.id === loadId) ?? loadStorage().themes.find((t) => t.id === loadId);
		if (theme) loadTheme(theme);
		return;
	}

	const forkId = button.dataset.docsFork;
	if (forkId) {
		const base =
			presets.find((t) => t.id === forkId) ?? loadStorage().themes.find((t) => t.id === forkId);
		if (base) loadTheme(fork(base, `${base.name} fork`));
		notice('Forked — rename and save it.');
		return;
	}

	const renameId = button.dataset.docsRename;
	if (renameId) {
		const theme = loadStorage().themes.find((t) => t.id === renameId);
		const name = theme && window.prompt('New name', theme.name);
		if (theme && name) persistTheme({ ...theme, name, updatedAt: Date.now() });
		return;
	}

	const deleteId = button.dataset.docsDelete;
	if (deleteId) {
		const theme = loadStorage().themes.find((t) => t.id === deleteId);
		if (theme && window.confirm(`Delete “${theme.name}”?`)) deleteTheme(deleteId);
		return;
	}

	// Which scheme half the variable rows edit; switching only re-renders.
	const schemeMode = button.dataset.docsSchemeModeButton;
	if (schemeMode) {
		state.schemeMode = schemeMode as State['schemeMode'];
		$$('[data-docs-scheme-mode-button]').forEach((b) =>
			b.setAttribute('aria-pressed', String(b === button)),
		);
		refreshRows();
	}
});

/* -------------------------------- boot ----------------------------------- */

const data = loadStorage();
const boot = data.activeId
	? [presets.find((t) => t.id === data.activeId), ...data.themes].find(
			(t) => t?.id === data.activeId,
		)
	: undefined;
if (boot) loadTheme(boot);
else {
	// Nothing to restore: leave the site untouched and mirror the empty state.
	refreshRows();
}
