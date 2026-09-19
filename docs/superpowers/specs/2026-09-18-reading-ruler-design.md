# Reading Ruler — design spec

Date: 2026-09-18
Status: approved design, pending spec review

## 1. Purpose

An Obsidian community plugin that shows a Kindle-style reading ruler: a clear
horizontal band at reading height while everything above and below is dimmed.
It works in Markdown notes (Reading view, Live Preview, Source mode) and in
PDFs opened in Obsidian, on desktop and on mobile (iPad, iPhone, Android).
The iPad is the primary motivation.

| Field | Value |
|---|---|
| Plugin name | Reading Ruler |
| Plugin id | `reading-ruler` (free in `community-plugins.json` and no open PR on 2026-09-18) |
| Author | Jeroen van der Wal (`driekeerJ`) |
| Repository | `driekeerJ/obsidian-reading-ruler` |
| License | MIT |
| `isDesktopOnly` | `false` |
| `minAppVersion` | `1.0.0` (all APIs used exist since ≤ 0.15.4; verified only against 1.14.2) |
| UI language | English only |
| Network / telemetry | None |

## 2. Verified platform facts

Verified against `obsidian@1.13.1` typings and the local Obsidian 1.14.2 app
bundle (pdf.js 5.3.34).

- The PDF viewer lives in the **same document** as the rest of the app, not in
  an iframe. Structure: `view.contentEl → .pdf-container →
  .pdf-content-container → .pdf-viewer-container → .pdfViewer`. The only
  iframe code path belongs to Obsidian Publish.
- The PDF scroll container is `.pdf-viewer-container` (`overflow: auto`). The
  `.pdf-container` is first built off-screen in `body` and then moved into the
  view. We therefore never depend on PDF-internal classes; we attach to the
  public `ItemView.contentEl`.
- `.workspace-leaf` has `contain: strict; isolation: isolate; position:
  relative; overflow: hidden`. An overlay inside a leaf cannot leak over
  sidebars, menus or modals. `.view-content` itself is not positioned.
- Popout windows have their own `Window` and `Document`. Available API:
  `el.win`, `el.doc`, `el.onWindowMigrated()`, `workspace.on('window-open' |
  'window-close')`, `activeDocument`, `activeWindow`.
- Mobile uses the same `app.js` and the same PDF DOM. No popouts and no status
  bar on mobile. `Platform.isMobile / isPhone / isTablet` exist.
- The PDF view type string is `"pdf"`; the Markdown view type is `"markdown"`.

Not verifiable by the implementer: real touch, Apple Pencil hover and
WKWebView/Android WebView behaviour. These are covered by the manual
checklist (section 10).

## 3. Scope

In scope for v1:

- One overlay per visible leaf whose view type is `markdown` or `pdf`, each
  individually switchable in settings.
- Sidebars, tab bars, title bar and ribbon are never dimmed.
- Works in split panes, stacked tabs and popout windows.
- Commands, one ribbon icon, settings tab.

Explicitly out of scope for v1: view-menu items, status bar item, canvas and
image views, third-party views, per-leaf settings, default hotkeys, blend
modes for the tint, persisting the pinned state.

## 4. Architecture

```
src/
  core/                 pure: no obsidian, DOM or CodeMirror imports
    settings.ts         RulerSettings, DEFAULT_SETTINGS, clampSettings(),
                        stepBandHeight(), TINT_PRESETS
    state.ts            RulerModel, RulerAction, reduce(), canApply()
    geometry.ts         computeBand()
    input.ts            InputMode, nextMode(), fractionToY(), yToFraction(),
                        clampFraction()
    color.ts            isValidHex(), tintToRgba()
  main.ts               Plugin: load/save, commands, ribbon, settings tab
  manager.ts            RulerManager: leaves ↔ overlays, broadcast, save
  overlay.ts            LeafOverlay: DOM, listeners, rAF loop, drag handle
  caret.ts              CodeMirror 6 extension reporting caret position
  settings-tab.ts       PluginSettingTab
styles.css
tests/core/*.test.ts    Vitest unit tests
```

Dependencies point one way: `main → manager → overlay → core`. `core` imports
nothing outside itself. The overlay is a dumb renderer: it forwards raw input
(`pointerType`, x, y, host size) to pure functions and writes the result as a
`transform`.

## 5. Settings

| Key | Type | Range | Default | Step |
|---|---|---|---|---|
| `enabled` | boolean | | `false` | |
| `bandHeight` | number (px) | 20–300 | 60 | 10 |
| `dimStrength` | number (%) | 10–90 | 50 | 5 |
| `tintPreset` | `yellow` \| `blue` \| `green` \| `pink` \| `gray` \| `custom` | | `yellow` | |
| `tintCustomColor` | hex string `#rrggbb` | | `#ffeb3b` | |
| `tintStrength` | number (%) | 0–40 | 0 | 5 |
| `fullWidth` | boolean | | `true` | |
| `widthPercent` | number (%) | 30–100 | 100 | 5 |
| `fixedFraction` | number | 0–1 | 0.35 | 0.01 |
| `followCaret` | boolean | | `false` | |
| `showInMarkdown` | boolean | | `true` | |
| `showInPdf` | boolean | | `true` | |

`clampSettings(raw: unknown): RulerSettings` accepts anything that
`loadData()` may return (null, partial objects, wrong types, NaN, out-of-range
numbers, unknown preset, invalid hex) and always returns a complete, valid
settings object. Numbers are clamped to their range; `bandHeight` is rounded
to the nearest integer. Invalid values fall back to the default for that key.

Preset colours: yellow `#ffeb3b`, blue `#64b5f6`, green `#81c784`, pink
`#f48fb1`, gray `#bdbdbd`.

Every settings change goes through `clampSettings`, is applied live to all
overlays, and is persisted with a debounced `saveData` (500 ms). The save is
flushed in `onunload`.

## 6. State rules (`core/state.ts`)

`RulerModel = { settings: RulerSettings; pinned: boolean }`. The on/off state
is `settings.enabled` and is persisted with the other settings. `pinned` is
never persisted and starts as `false`.

`reduce(model, action) → RulerModel` (returns the same object when nothing
changes, so callers can skip work):

| Action | Ruler off | Ruler on |
|---|---|---|
| `toggle` | `enabled = true` | `enabled = false`, `pinned = false` |
| `togglePin` | no-op | `pinned = !pinned` |
| `thicker` | no-op | `bandHeight = min(300, bandHeight + 10)` |
| `thinner` | no-op | `bandHeight = max(20, bandHeight − 10)` |

`canApply(model, action): boolean` backs the commands' `checkCallback`, so
pin / thicker / thinner disappear from the palette while the ruler is off.

## 7. Input model (`core/input.ts`)

Each overlay has an `InputMode`:

| Mode | Entered by | Anchor |
|---|---|---|
| `fixed` | initial mode; any `touch` pointer event | `y = fixedFraction × hostHeight`, `x = hostWidth / 2` |
| `follow` | `pointermove` with `pointerType` `mouse` or `pen` | pointer position relative to host |
| `caret` | caret report, only when `followCaret` is on | `y` = vertical centre of caret line, `x = hostWidth / 2` |

`nextMode(current, event, settings)`: the last input wins. A caret report is
ignored when `followCaret` is off. While `pinned`, every input is ignored and
the anchor stays frozen; the listeners are detached anyway.

There is no desktop/mobile branch. An iPad with a trackpad or Pencil hover
produces `mouse` / `pen` events and follows; a finger produces `touch` and
returns to the fixed position. A Windows touchscreen behaves the same way.

## 8. Geometry (`core/geometry.ts`)

`computeBand({ anchorX, anchorY, hostWidth, hostHeight, settings })` returns
`{ x, y, width, height }` in host coordinates:

- `height = bandHeight`; `y = anchorY − height / 2`. **Not clamped**
  vertically: the band may be cut off at the top or bottom edge.
- Full width: `x = 0`, `width = hostWidth`.
- Custom width: `width = hostWidth × widthPercent / 100`,
  `x = clamp(anchorX − width / 2, 0, hostWidth − width)` so the width stays
  constant at the edges.
- Results are rounded to whole pixels.

## 9. Rendering and performance (`overlay.ts`, `styles.css`)

DOM per leaf:

```
view.contentEl.reading-ruler-host          (adds position: relative)
  div.reading-ruler-overlay                (absolute, inset 0, overflow hidden,
                                            pointer-events: none)
    div.reading-ruler-band                 (moved with transform only)
    div.reading-ruler-handle               (only interactive element)
```

- Dimming: `box-shadow: 0 0 0 200vmax rgb(0 0 0 / var(--rr-dim))` on the
  band. This also dims left and right of a custom-width band.
- Per frame only `transform: translate3d(x, y, 0)` on the band (and the
  handle's `translateY`) changes.
- Settings map to CSS variables on the overlay (`--rr-height`, `--rr-width`,
  `--rr-dim`, `--rr-band-bg`), written with `setCssProps` only when settings
  change.
- The tint is converted to an `rgba()` string in `core/color.ts`; no
  `color-mix()`, which is missing in older Electron / WebView versions.
- Enable/disable fades opacity over 150 ms; no transition under
  `prefers-reduced-motion: reduce`.
- Handle colours use Obsidian variables (`--interactive-accent`,
  `--background-modifier-border`, `--background-primary`) so light, dark and
  community themes work.

Listeners:

- One passive `pointermove` and one `pointerenter` on the host, plus a passive
  `pointerdown` to detect touch. Moves are coalesced with
  `host.win.requestAnimationFrame`; at most one write per frame.
- The host rect is cached on `pointerenter` and invalidated by a
  `ResizeObserver`. No layout reads inside the frame callback.
- When the ruler is off or pinned, the pointer listeners and the pending rAF
  are removed. `plugin.register()` guarantees cleanup in `onunload`.
- `onWindowMigrated` rebinds rAF and the `ResizeObserver` when a leaf moves
  to or from a popout window.

Fallback: if a Performance trace shows the large box-shadow is expensive,
replace it with four dim rectangles inside the same moving element. Only
`overlay.ts` and `styles.css` change.

Manager:

- `RulerManager.sync()` runs on `layout-change`, `active-leaf-change`,
  `window-open` and after settings changes. It creates overlays for leaves
  whose view type is enabled, and destroys overlays whose leaf is gone or
  whose view type changed or was disabled.
- Overlays are keyed by leaf in a `Map<WorkspaceLeaf, LeafOverlay>`.

## 10. Touch handle

- A pill at the inline-end edge, vertically centred on the band. Touch target
  44 × 44 px, visible pill smaller.
- Visible only in `fixed` mode while enabled and not pinned.
- The only element with `pointer-events: auto`; `touch-action: none`.
- `pointerdown`: `preventDefault()` (no focus change, no text selection) and
  `setPointerCapture`. `pointermove`: update `fixedFraction` live in all
  overlays via the manager. `pointerup` / `pointercancel`: release and save.
- `fixedFraction` is clamped to 0–1 so the handle always stays reachable.

## 11. Caret following (`caret.ts`)

- Registered with `registerEditorExtension`; an `EditorView.updateListener`
  reacts to `selectionSet` or `docChanged`, only when `followCaret` is on and
  the ruler is enabled and not pinned.
- Measurement uses `view.requestMeasure({ read })` with
  `view.coordsAtPos(head)`: CodeMirror's own measure phase, no forced layout.
- The owning leaf is found through `editorInfoField`; the manager forwards the
  viewport y to that leaf's overlay.
- Strictly read-only: never dispatches, never touches selection or focus.

## 12. Commands and controls

| Command id | Name | Icon | Available when |
|---|---|---|---|
| `toggle` | Toggle ruler | `scan-line` | always |
| `toggle-pin` | Pin or unpin ruler | `pin` | ruler on |
| `increase-band-height` | Increase band height | `plus` | ruler on |
| `decrease-band-height` | Decrease band height | `minus` | ruler on |

No default hotkeys. All commands have icons so users can add them to the
mobile toolbar. One ribbon icon toggles the ruler.

Settings tab (sentence case): Band height, Dim strength, Tint color (preset
dropdown plus colour picker when *Custom*), Tint strength, Full width, Width,
Fixed position, Follow text cursor while editing, Show in Markdown notes,
Show in PDF files.

## 13. Guidelines compliance

`registerDomEvent` / `registerEvent` / `register` for all cleanup; no
`innerHTML`; no global `app`; all styling in `styles.css`; settings via
`loadData` / `saveData`; sentence case; no default hotkeys; no network;
`eslint-plugin-obsidianmd` in the lint step.

## 14. Testing

- **Unit (Vitest, test-first):** all of `core/` — clamping edge cases (null,
  partial, NaN, wrong types, legacy data), reducer rules, geometry (horizontal
  clamp, vertical cut-off, rounding), mode arbitration, fraction ↔ px, colour
  conversion.
- **Static:** `tsc --noEmit`, ESLint with `eslint-plugin-obsidianmd`.
- **Real Obsidian, desktop, by the implementer:** test vault
  `~/Obsidian/RulerTest` (long note, large PDF, symlinked build). Drive
  Obsidian through the Chrome DevTools Protocol where possible: overlays per
  leaf (split, PDF, popout), `elementFromPoint` through the band, no listeners
  when off or pinned, Performance trace while scrolling. Report honestly what
  was and was not verified.
- **Manual, by the author:** iPad, iPhone, Android — finger, handle,
  trackpad, Pencil hover, rotation, Split View, PDF annotations. Checklist in
  the README; install through BRAT from a GitHub pre-release.

## 15. Deliverables

- Repository based on `obsidian-sample-plugin` (esbuild): `manifest.json`,
  `versions.json`, `version-bump.mjs`, `LICENSE`, `styles.css`.
- GitHub Actions workflow that creates a release with `main.js`,
  `manifest.json` and `styles.css` when a tag is pushed.
- README: installation (manual and BRAT), usage, commands, manual test
  checklists for desktop and iPad, community submission steps.
- Pushing and releasing happen only on the author's explicit request.

## 16. Implementation notes (decisions made while building)

These refine the sections above; where they differ, this section wins.

1. **Settings tab (section 12).** Obsidian 1.13.0 deprecated `display()` in
   favour of the declarative `getSettingDefinitions()` API, and the review
   lint rules do not allow disabling that warning. The settings are therefore
   described once as data and rendered twice: declaratively on 1.13.0 and
   later (which also makes them searchable), and through a `display()`
   fallback on older versions. Values flow through `getControlValue` /
   `setControlValue` into `RulerManager.updateSettings`. The fixed position is
   exposed as the virtual key `fixedPercent`.
2. **Label.** "Follow text cursor while editing" became "Follow caret while
   editing": the sentence-case lint rule treats "Cursor" as a brand name.
   "text cursor" is kept as a search alias.
3. **Caret following (section 11).** Implemented as a CodeMirror `ViewPlugin`
   instead of an update listener. A caret jump makes Obsidian scroll the
   editor asynchronously, after any measurement, so while the caret leads the
   band is re-measured on the editor's `scroll` event and stays on the caret
   line. That scroll listener only exists while the ruler is on, caret
   following is on and the ruler is not pinned, and a scroll never takes over
   from the mouse (`refreshOnly`). The host is found with
   `closest('.reading-ruler-host')`; editors outside a supported leaf are
   ignored.
4. **PDF toolbar.** `.pdf-toolbar` and `.pdf-findbar` live inside
   `view.contentEl`, so they are lifted above the overlay with a `z-index`
   rule scoped under `.reading-ruler-host`. If Obsidian renames them the only
   effect is that they are dimmed too. The Markdown search bar already sits
   above the overlay through Obsidian's own `--layer-popover`.
5. **Handle visibility (section 10)** is pure CSS: fixed mode, enabled, not
   pinned, and either Obsidian's `.is-mobile` body class or the overlay's
   `has-touch` class, which is set after the first touch event. A mouse-only
   desktop never shows the handle.
6. **Core.** `withSettings(model, settings)` was added to `core/state.ts` so
   that the rule "turning the ruler off releases the pin" also holds when the
   ruler is turned off from the settings tab.
7. **Per-frame writes (section 9).** The frame callback writes the CSS
   variables `--rr-x` and `--rr-y` on the overlay (only when changed); band and
   handle both derive their `transform` from them.
8. **Verification.** Done against a second, isolated Obsidian 1.14.2 instance
   (own `--user-data-dir`, `--remote-debugging-port`) driven through the
   Chrome DevTools Protocol, with touch input emulated through
   `Input.dispatchTouchEvent`.
9. **Dimming without a giant layer (replaces the box-shadow in section 9).**
   Measured in Obsidian 1.14.2, the `200vmax` box-shadow produced one
   compositor layer of 8872 x 8312 CSS px per pane (150 MP for two panes).
   Dimming now uses four plain rectangles (`.reading-ruler-dim.mod-top`,
   `mod-bottom`, `mod-left`, `mod-right`), each at most the size of the pane
   and with nothing but a background colour. The top piece is anchored with
   `bottom: 100%` and the left piece with `right: 100%`, so every piece is
   positioned with whole-pixel translations only and the edges meet without
   seams. The same two panes now need 6.9 MP. The side pieces only exist for a
   custom width and the band element only while a tint is set; `will-change`
   is only applied while the ruler is on. The offsets come from the pure
   `computePieces()` in `core/geometry.ts`.
10. **Transforms are written directly** on each piece (`setCssStyles`), and
    only when the value changed, instead of through custom properties on the
    overlay, which re-resolved the style of every piece on each frame.
11. **Caret scroll listener.** The scroll handler returns before measuring
    unless the caret currently leads in that pane.
12. **`minAppVersion` is `1.10.3`, not `1.0.0`.** The submission requirements ask
    for a version the plugin is known to be compatible with. 1.10.3 is the
    oldest version the plugin was actually run on (it predates the 1.13.0
    settings API, so it exercises the `display()` fallback); 1.14.2 is the
    version everything else was verified on. Nothing older was tested.
13. **Directory review (1.0.0).** The automated review passed with three
    recommendations, all addressed in 1.0.1 without dropping support for
    Obsidian before 1.13.0: the legacy settings renderer lives in
    `renderLegacy()` so the plugin never calls the deprecated `display()`
    itself; instead of the deprecated `setDynamicTooltip()` the legacy sliders
    show their value in a label next to the slider (verified in 1.10.3); and
    the release workflow attests the provenance of the release assets.
