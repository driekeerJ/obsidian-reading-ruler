# Reading Ruler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `reading-ruler` Obsidian community plugin: a Kindle-style reading band with dimmed surroundings for Markdown and PDF views on desktop and mobile.

**Architecture:** One `pointer-events: none` overlay per supported leaf, attached to the public `view.contentEl`. All arithmetic and rules live in pure modules under `src/core/` (test-first with Vitest); a thin DOM layer (`overlay.ts`, `manager.ts`, `caret.ts`) only forwards raw input to those functions and writes a `transform`.

**Tech Stack:** TypeScript, esbuild (obsidian-sample-plugin layout), Vitest, ESLint with `eslint-plugin-obsidianmd`, Obsidian API, CodeMirror 6 (`@codemirror/view`, externalised).

**Spec:** `docs/superpowers/specs/2026-09-18-reading-ruler-design.md`

## Global Constraints

- Plugin id `reading-ruler`, name `Reading Ruler`, `isDesktopOnly: false`, `minAppVersion: "1.0.0"`, license MIT, author `Jeroen van der Wal`.
- `src/core/**` imports nothing from `obsidian`, the DOM or CodeMirror.
- No `innerHTML`, no global `app`, no default hotkeys, no network, styling only in `styles.css`, UI text in English sentence case.
- Cleanup through `registerDomEvent` / `registerEvent` / `register`.
- Per frame only `transform` changes; no layout reads inside rAF callbacks; no pointer listeners while the ruler is off or pinned.
- Ranges and defaults exactly as in spec section 5.
- Never push, publish or create a GitHub repository without the author's explicit request.
- Commit after every task with the `Co-Authored-By` trailer.

## File structure

| File | Responsibility |
|---|---|
| `manifest.json`, `versions.json`, `version-bump.mjs`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`, `LICENSE` | Project scaffold |
| `src/core/settings.ts` | Settings type, defaults, limits, presets, `clampSettings`, `stepBandHeight`, `resolveTintColor` |
| `src/core/color.ts` | `isValidHex`, `tintToRgba` |
| `src/core/state.ts` | `RulerModel`, `RulerAction`, `reduce`, `canApply` |
| `src/core/geometry.ts` | `computeBand` |
| `src/core/input.ts` | `InputMode`, `nextMode`, `fractionToY`, `yToFraction`, `clampFraction` |
| `src/overlay.ts` | `LeafOverlay`: DOM, listeners, rAF, handle |
| `src/manager.ts` | `RulerManager`: leaf ↔ overlay sync, model, persistence |
| `src/caret.ts` | CodeMirror extension reporting caret coordinates |
| `src/settings-tab.ts` | Settings UI |
| `src/main.ts` | Plugin entry: commands, ribbon, wiring |
| `styles.css` | All styling |
| `tests/core/*.test.ts` | Unit tests |
| `README.md`, `.github/workflows/release.yml` | Docs and release automation |

---

### Task 1: Scaffold

**Files:** all scaffold files above, plus a minimal `src/main.ts` exporting an empty `Plugin` subclass and an empty `styles.css`.

**Produces:** `npm run build` (tsc check + esbuild → `main.js`), `npm test` (Vitest), `npm run lint`.

- [ ] Create `package.json` with scripts `dev`, `build`, `test` (`vitest run`), `lint`, `version`; devDependencies as in the current sample plugin plus `vitest`.
- [ ] Copy `esbuild.config.mjs`, `tsconfig.json`, `version-bump.mjs`, `eslint.config.mjs` from the current `obsidianmd/obsidian-sample-plugin` master and adapt (entry `src/main.ts`; tsconfig includes `src` and `tests`).
- [ ] `manifest.json` per Global Constraints; `versions.json` = `{ "0.1.0": "1.0.0" }`; version `0.1.0`.
- [ ] `.gitignore`: `node_modules`, `main.js`, `*.map`, `data.json`, `.DS_Store`.
- [ ] `npm install`, then `npm run build` and `npm test -- --passWithNoTests`. Expected: both succeed.
- [ ] Commit `chore: scaffold plugin project`.

### Task 2: `core/settings.ts`

**Produces:**

```ts
export type TintPreset = 'yellow' | 'blue' | 'green' | 'pink' | 'gray' | 'custom';
export interface RulerSettings {
  enabled: boolean; bandHeight: number; dimStrength: number;
  tintPreset: TintPreset; tintCustomColor: string; tintStrength: number;
  fullWidth: boolean; widthPercent: number; fixedFraction: number;
  followCaret: boolean; showInMarkdown: boolean; showInPdf: boolean;
}
export const LIMITS: { bandHeight; dimStrength; tintStrength; widthPercent; fixedFraction } // each { min, max, step }
export const TINT_PRESETS: Record<Exclude<TintPreset, 'custom'>, string>;
export const DEFAULT_SETTINGS: Readonly<RulerSettings>;
export function clampSettings(raw: unknown): RulerSettings;
export function stepBandHeight(current: number, direction: 1 | -1): number;
export function resolveTintColor(settings: RulerSettings): string; // hex
```

Test cases (`tests/core/settings.test.ts`), written first and seen failing:

| Input | Expected |
|---|---|
| `clampSettings(null)`, `undefined`, `42`, `'x'`, `[]` | deep-equals `DEFAULT_SETTINGS`, and is a fresh object |
| `{ bandHeight: 5 }` / `999` / `64.6` / `NaN` / `'80'` | 20 / 300 / 65 / 60 / 60 |
| `{ dimStrength: 0 }` / `100` | 10 / 90 |
| `{ tintStrength: -1 }` / `50` | 0 / 40 |
| `{ widthPercent: 10 }` / `150` | 30 / 100 |
| `{ fixedFraction: -0.2 }` / `1.4` / `Infinity` | 0 / 1 / 0.35 |
| `{ tintPreset: 'purple' }` | `'yellow'` |
| `{ tintCustomColor: 'red' }` / `'#ABCDEF'` | `'#ffeb3b'` / `'#abcdef'` |
| `{ enabled: 'yes' }` | `false` |
| `{ unknownKey: 1 }` | key dropped |
| valid full object | returned unchanged (deep equal) |
| `stepBandHeight(60, 1)` / `(60, -1)` / `(300, 1)` / `(20, -1)` / `(295, 1)` | 70 / 50 / 300 / 20 / 300 |
| `resolveTintColor` preset blue / custom `#123456` | `#64b5f6` / `#123456` |

- [ ] Write tests → run `npx vitest run tests/core/settings.test.ts` → FAIL (module missing).
- [ ] Implement → PASS. Commit `feat(core): settings clamping`.

### Task 3: `core/color.ts`

**Produces:** `isValidHex(value: unknown): value is string` (accepts `#rgb` and `#rrggbb`, case-insensitive), `normalizeHex(hex: string): string` (lowercase `#rrggbb`), `tintToRgba(hex: string, strengthPercent: number): string`.

| Input | Expected |
|---|---|
| `isValidHex('#fff')`, `'#FFEB3B'` | true |
| `isValidHex('fff')`, `'#ffff'`, `'#gggggg'`, `12`, `null` | false |
| `normalizeHex('#FfF')` | `'#ffffff'` |
| `tintToRgba('#ffeb3b', 20)` | `'rgba(255, 235, 59, 0.2)'` |
| `tintToRgba('#ffeb3b', 0)` | `'transparent'` |
| `tintToRgba('#fff', 40)` | `'rgba(255, 255, 255, 0.4)'` |
| `tintToRgba('nope', 20)` | `'transparent'` |

`settings.ts` uses `isValidHex` / `normalizeHex` from this module.

- [ ] Tests first → FAIL → implement → PASS. Commit `feat(core): tint colour conversion`.

### Task 4: `core/state.ts`

**Produces:**

```ts
export interface RulerModel { settings: RulerSettings; pinned: boolean }
export type RulerAction = 'toggle' | 'togglePin' | 'thicker' | 'thinner';
export function canApply(model: RulerModel, action: RulerAction): boolean;
export function reduce(model: RulerModel, action: RulerAction): RulerModel;
```

Test cases: toggle off→on; toggle on→off clears `pinned`; `togglePin` on/off while enabled; `togglePin`, `thicker`, `thinner` return the **same object reference** while disabled; `thicker` at 300 and `thinner` at 20 return the same reference; `thicker` 60→70; input model is never mutated (freeze it with `Object.freeze`); `canApply` true for `toggle` always, false for the rest while disabled.

- [ ] Tests first → FAIL → implement → PASS. Commit `feat(core): on/off and pin rules`.

### Task 5: `core/geometry.ts`

**Produces:**

```ts
export interface BandInput {
  anchorX: number; anchorY: number; hostWidth: number; hostHeight: number;
  settings: Pick<RulerSettings, 'bandHeight' | 'fullWidth' | 'widthPercent'>;
}
export interface BandRect { x: number; y: number; width: number; height: number }
export function computeBand(input: BandInput): BandRect;
```

| Case | Expected |
|---|---|
| full width, anchor (400, 300), host 800×600, height 60 | `{ x: 0, y: 270, width: 800, height: 60 }` |
| anchorY 0 | `y: -30` (not clamped) |
| anchorY 600 | `y: 570` (not clamped) |
| custom 50 %, anchorX 400 | `x: 200, width: 400` |
| custom 50 %, anchorX 10 | `x: 0, width: 400` |
| custom 50 %, anchorX 795 | `x: 400, width: 400` |
| custom 100 % | same as full width |
| fractional input (anchorY 300.4, width 33 % of 801) | all outputs integers |
| host 0×0 | `{ x: 0, y: -30, width: 0, height: 60 }`, no NaN |

- [ ] Tests first → FAIL → implement → PASS. Commit `feat(core): band geometry`.

### Task 6: `core/input.ts`

**Produces:**

```ts
export type InputMode = 'fixed' | 'follow' | 'caret';
export type RulerInput = { kind: 'pointer'; pointerType: string } | { kind: 'caret' };
export function nextMode(current: InputMode, input: RulerInput, followCaret: boolean): InputMode;
export function clampFraction(value: number): number;          // NaN → 0
export function fractionToY(fraction: number, hostHeight: number): number;
export function yToFraction(y: number, hostHeight: number): number; // hostHeight <= 0 → 0
```

Cases: mouse → `follow`; pen → `follow`; touch → `fixed`; unknown pointer type (`''`) → unchanged; caret with `followCaret` true → `caret`, false → unchanged; mouse after caret → `follow`; `fractionToY(0.35, 1000)` = 350; `yToFraction(350, 1000)` = 0.35; `yToFraction(-5, 100)` = 0; `yToFraction(500, 100)` = 1; `yToFraction(10, 0)` = 0; round trip stays within 1e-9.

- [ ] Tests first → FAIL → implement → PASS. Commit `feat(core): input mode arbitration`.

### Task 7: `styles.css` and `overlay.ts`

**Consumes:** everything in `core/`.

**Produces:**

```ts
export interface OverlayCallbacks {
  onFractionChange(fraction: number): void;   // live while dragging
  onFractionCommit(): void;                   // pointerup: persist
}
export class LeafOverlay {
  constructor(hostEl: HTMLElement, model: RulerModel, callbacks: OverlayCallbacks);
  update(model: RulerModel): void;            // settings, enabled, pinned changed
  setFixedFraction(fraction: number): void;   // from another overlay's drag
  reportCaret(clientY: number): void;         // from caret.ts, viewport coords
  destroy(): void;
}
```

Behaviour: spec sections 9 and 10. Details that matter:

- DOM built with `createDiv`; host gets class `reading-ruler-host`.
- `update()` writes CSS variables via `setCssProps` and toggles `is-enabled`, `is-pinned`, `is-fixed` classes; attaches listeners only when `enabled && !pinned`, detaches otherwise.
- Pointer handlers store the latest `clientX/clientY/pointerType` and schedule one `hostEl.win.requestAnimationFrame`; the frame callback computes host-relative coordinates from the **cached** rect, calls `nextMode` + `computeBand`, writes `transform`.
- Rect cache: refreshed on `pointerenter`, invalidated by `ResizeObserver` (the observer callback stores its `contentRect` size and marks the position dirty; the position part is re-read on the next `pointerenter` or, if the pointer is already inside, on the next `pointermove` before scheduling the frame — never inside the frame).
- `hostEl.onWindowMigrated` cancels the pending frame and recreates the `ResizeObserver` from the new window.
- Handle: `pointerdown` → `preventDefault`, `setPointerCapture`; `pointermove` → `yToFraction` → `callbacks.onFractionChange`; `pointerup`/`pointercancel` → `onFractionCommit`.
- `destroy()` removes listeners, observer, pending frame, DOM and the host class.

- [ ] Write `styles.css` (overlay, band with `box-shadow` dim, handle, `is-*` states, reduced-motion block).
- [ ] Write `overlay.ts`. `npm run build` and `npm run lint` pass.
- [ ] Commit `feat: leaf overlay and touch handle`.

### Task 8: `manager.ts` and `main.ts`

**Produces:**

```ts
export class RulerManager {
  constructor(plugin: Plugin, settings: RulerSettings, save: (s: RulerSettings) => Promise<void>);
  get model(): RulerModel;
  dispatch(action: RulerAction): void;
  can(action: RulerAction): boolean;
  updateSettings(patch: Partial<RulerSettings>): void;  // clamp → apply → debounced save
  reportCaret(contentEl: HTMLElement, clientY: number): void;
  sync(): void;
  destroy(): void;                                      // flush save, destroy overlays
}
```

- `sync()`: `workspace.iterateAllLeaves`; supported when `view instanceof ItemView` and view type is `markdown` (if `showInMarkdown`) or `pdf` (if `showInPdf`); `Map<WorkspaceLeaf, LeafOverlay>`; recreate when `view.contentEl` changed.
- Events: `layout-change`, `active-leaf-change`, `window-open`, plus `workspace.onLayoutReady`.
- `main.ts`: `clampSettings(await loadData())`, four commands (`checkCallback` backed by `manager.can`), ribbon icon `scan-line` "Toggle reading ruler", settings tab, `registerEditorExtension(caretExtension(manager))`, `register(() => manager.destroy())`.

- [ ] Implement, build, lint. Commit `feat: manager, commands and ribbon`.

### Task 9: `settings-tab.ts`

Controls per spec section 12, using `Setting`, `addSlider` (`setLimits` from `LIMITS`, `setDynamicTooltip`), `addDropdown`, `addColorPicker`, `addToggle`. The custom colour row and the width slider are shown conditionally by re-running `display()`. Headings via `setHeading()`; no top-level plugin-name heading.

- [ ] Implement, build, lint. Commit `feat: settings tab`.

### Task 10: `caret.ts`

```ts
export function caretExtension(manager: RulerManager): Extension;
```

`EditorView.updateListener.of(update => …)`: return early unless `selectionSet || docChanged`, and unless `model.settings.enabled && followCaret && !pinned`. `update.view.requestMeasure({ read: v => v.coordsAtPos(v.state.selection.main.head), write: coords => … })`. Host lookup: `update.state.field(editorInfoField)`; when it is a `MarkdownView` use its `contentEl`, otherwise `update.view.dom.closest('.reading-ruler-host')`.

- [ ] Implement, build, lint. Commit `feat: optional caret following`.

### Task 11: Verify in real Obsidian

- [ ] Create `~/Obsidian/RulerTest` with `Long note.md` (generated, ≥ 400 paragraphs), a multi-page PDF, and `.obsidian/plugins/reading-ruler` symlinked to the repo build output (`main.js`, `manifest.json`, `styles.css`).
- [ ] Try to drive Obsidian via `--remote-debugging-port`; verify the list in spec section 14. Record exactly what was and was not verified.
- [ ] Fix defects found, each with a regression test when the defect is in `core/`.

### Task 12: README and release workflow

- [ ] `README.md`: what it does, installation (manual, BRAT), usage, commands, settings, mobile toolbar tip, manual test checklists (desktop, iPad), submission steps, privacy note.
- [ ] `.github/workflows/release.yml`: on tag push → `npm ci`, `npm run build`, `gh release create` with the three assets (draft).
- [ ] Commit `docs: README and release workflow`.

### Task 13: Final review

- [ ] `npm test`, `npm run build`, `npm run lint` all green; review the diff against the spec; update spec where implementation decisions deviated; report to the author.
