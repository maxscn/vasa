# Editor Parity Roadmap

This roadmap tracks the current editor implementation against the emerging Skriva direction: Tiptap is the logic layer and Skriva is the deterministic visual representation layer. The goals are ordered: keep editor and PDF output as close to 1:1 as technically practical, reach Tiptap repository parity for v1, then make Google Docs-like capabilities possible through extensions. Google Docs is a long-term capability ceiling for canvas-based document interaction, not an exact v1 compatibility contract.

PDF parity includes structural behavior, not just visual similarity. Exported PDF must be generated from document scene/text/vector primitives rather than canvas screenshots so text remains selectable and searchable.

Some current-state notes still describe the legacy custom editor runtime because they are useful migration evidence.

## Current Architecture Snapshot

| Area           | Current state                                                                                                                                                                                                                              | Evidence                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Document model | Custom JSON tree with `type`, `attrs`, `content`, `marks`, and `text`.                                                                                                                                                                     | `packages/editor/src/index.ts`                                              |
| Editor state   | Custom session with selection, stored marks, disabled marks, undo, redo.                                                                                                                                                                   | `packages/editor/src/session.ts`                                            |
| Selection      | Path/offset selection with optional anchor, plus canvas hit testing and rendered-line movement.                                                                                                                                            | `packages/editor/src/actions.ts`, `packages/editor/src/interaction.ts`      |
| Input bridge   | Hidden textarea handles keyboard, beforeinput, paste, copy, cut, and native history events.                                                                                                                                                | `packages/editor/react/use-editor-input.ts`                                 |
| Tiptap usage   | `@tiptap/react` editor is created, and Skriva extensions expose `tiptap` metadata. Custom keymap extracts some Tiptap shortcuts.                                                                                                           | `packages/editor/react/use-editor.ts`, `packages/editor/react/keymap.ts`    |
| Rendering      | Shared layout feeds canvas outline text and PDF rendering.                                                                                                                                                                                 | `packages/editor/src/render-profile.ts`, `packages/pdf/tests/pixel.test.ts` |
| Extensions     | Existing nodes/marks include doc, paragraph, text, heading, blockquote, horizontal rule, table, SVG, bold, italic, underline, strike, code, highlight, subscript, superscript, text style, color, font family, font size, and line height. | `packages/extension-*`                                                      |

## Parity Goals

### Must Match Tiptap Logic Behavior

| Feature area               | Current status                                                                                                                                               | Target behavior                                                                                                                                                                                                                                                                  | Test targets                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Extension shape            | Partial. Extensions expose `tiptap`, layout, and renderers, but Skriva only consumes a subset of Tiptap hooks.                                               | Normal Tiptap extensions should be passed to the Tiptap editor directly; Skriva enrichments should add visual coverage without changing extension semantics.                                                                                                                     | Type tests and integration tests for direct Tiptap extension usage plus enrichment matching.                                                                                         |
| Command return semantics   | Partial. Skriva command wrappers return booleans, but only selected commands are routed.                                                                     | Commands should be owned by Tiptap. Skriva surface events should translate to Tiptap-compatible interactions through the surface adapter.                                                                                                                                        | Command and surface-adapter tests for marks, blocks, tables, undo, redo, and interaction routing.                                                                                    |
| Mark commands              | Good base for bold, italic, underline, strike, code, highlight, subscript, superscript, text style.                                                          | Tiptap should own `setMark`, `toggleMark`, `unsetMark`, active mark detection, stored marks, and mark exclusion. Skriva should render the resulting state deterministically.                                                                                                     | Golden Tiptap-state fixtures plus canvas/PDF scene output tests.                                                                                                                     |
| Text style commands        | Partial. Font family, size, line height, and color are implemented as style marks.                                                                           | Tiptap nodes and marks should contribute direct styles. The Skriva Style Engine resolves supported properties deterministically before layout.                                                                                                                                   | Tests for computed style resolution, mark stacking, inheritance, and unsupported property diagnostics.                                                                               |
| Block commands             | Partial. Paragraph, heading levels 1-3 in UI, blockquote, horizontal rule, page spacer, table insertion exist.                                               | Tiptap should own block commands. Skriva enrichments should define visual coverage for supported block semantics.                                                                                                                                                                | Tiptap command integration tests plus layout/scene tests around block boundaries.                                                                                                    |
| JSON serialization         | Partial. Skriva JSON resembles ProseMirror JSON but is not schema-validated.                                                                                 | ProseMirror/Tiptap state should be the source of truth. Skriva render models should be derived and disposable.                                                                                                                                                                   | Fixtures that project Tiptap JSON into render model and document scene graph output.                                                                                                 |
| HTML parse/render          | Partial. Clipboard HTML parse/render exists for common blocks, marks, and tables.                                                                            | Tiptap and its serialization packages should own parse/render semantics where possible; Skriva owns deterministic visual/export output.                                                                                                                                          | Round-trip tests against supported Tiptap packages plus PDF/canvas output tests.                                                                                                     |
| Keyboard shortcut mapping  | Partial. Default text/history shortcuts and some extension shortcuts are mapped.                                                                             | Tiptap extensions should own keyboard behavior. The surface adapter should expose only the small event surface needed by Skriva's canvas editor.                                                                                                                                 | Keyboard tests for adapter-to-Tiptap routing.                                                                                                                                        |
| Headless interaction layer | Early. Keyboard and pointer interaction are currently split across React handlers, keymap routing, editor interaction helpers, and Surface Adapter commands. | Horizontal **Google Docs Keyboard Navigation**, deletion behavior, extension-owned shortcut routing, and future pointer interactions should pass through a pure, package-shaped **Headless Interaction Layer** inside `packages/editor` before any workspace package extraction. | Fixture tests where **Headless Editor State** plus normalized interaction produces deterministic next **Headless Editor State**, with document and selection stored in Tiptap state. |
| Public package surface     | Early. Root package direction says `@openinspection/skriva` should be the tree-shakeable public package.                                                     | Export a stable React-targeted API centered on `<Editor editor={editor} extensions={...} />`, first-party extensions, layout, style, diagnostics, and native renderers.                                                                                                          | API snapshot tests or type tests for intended exports only.                                                                                                                          |

### Must Support Equivalent User-Facing Editing

| Feature area                | Current status                                                                                                             | Target editing behavior                                                                                                                                                                                                                                                                                                | Test targets                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Basic typing                | Implemented through hidden textarea and custom mutations.                                                                  | Tiptap should handle text entry, IME composition, pasted text, multiline text, and selection replacement; Skriva should render the resulting state.                                                                                                                                                                    | Browser tests for typing, paste, composition events, newline, paragraph split, and replacing selected text.                                      |
| Selection and caret         | Good base. Supports path/offset, drag selection, double/triple click selection, rendered-line hit testing, caret painting. | Selection should follow **Google Docs Keyboard Navigation** semantics across wrapped lines, pages, blocks, tables, SVG/horizontal rule boundaries, and high DPI canvas scaling. The first keyboard slice is horizontal caret movement and selection extension before broader vertical, document, and table navigation. | Playwright tests for click, drag, shift-arrow, word movement, line movement, vertical movement, select all, multi-click, page boundary movement. |
| Deletion                    | Partial to good. Character, word, and line deletion exist, with custom large-block boundary logic.                         | Tiptap should own deletion semantics; Skriva should keep surface mapping, caret painting, layout, and selection feedback deterministic.                                                                                                                                                                                | Tiptap integration tests plus browser tests for visible caret/result.                                                                            |
| Undo/redo                   | Basic custom stacks exist.                                                                                                 | Tiptap history should own undo/redo behavior unless a different Tiptap extension is supplied.                                                                                                                                                                                                                          | Integration tests for history behavior and selection restoration.                                                                                |
| Clipboard                   | Partial. Plain text, Skriva JSON MIME, and HTML are supported.                                                             | Tiptap should own semantic clipboard behavior where possible; Skriva should preserve deterministic visual/export coverage for supported semantics.                                                                                                                                                                     | Clipboard unit tests plus Playwright copy/paste across Skriva instances and paste from external HTML.                                            |
| Input rules and paste rules | Not implemented as a first-class system.                                                                                   | Tiptap extensions should own input and paste rules.                                                                                                                                                                                                                                                                    | Rule integration tests with before/after Tiptap state and browser tests for trigger timing.                                                      |
| Lists                       | Missing.                                                                                                                   | Equivalent user-facing bullet, ordered, nested list, split list item, lift/sink list item, and keyboard behavior through Tiptap list extensions.                                                                                                                                                                       | JSON/state and browser tests for Enter, Shift-Tab/Tab, Backspace at list start, copy/paste nested lists, PDF/canvas parity.                      |
| Links                       | Missing.                                                                                                                   | Link mark editing, open/edit/remove UI hooks, paste/autolink behavior through Tiptap link semantics when included.                                                                                                                                                                                                     | Mark command tests, clipboard round-trip tests, PDF text extraction/link annotation tests if PDF links are supported.                            |
| Tables                      | Basic table rendering and row/column insert/delete exist.                                                                  | User should be able to navigate cells, select cells, edit cell content, add/delete rows/columns, delete table, and preserve table layout in PDF/canvas.                                                                                                                                                                | Table command tests, keyboard navigation tests, clipboard tests, renderer parity tests, row/column edge cases.                                   |
| Block nodes                 | Horizontal rule, SVG, and page spacers exist.                                                                              | Atomic-ish blocks should be selectable, movable around with keyboard, deletable, copied, pasted, and rendered identically in canvas/PDF.                                                                                                                                                                               | Boundary selection tests, delete tests, clipboard tests, renderer snapshots.                                                                     |
| Text formatting UI          | Existing app controls cover font, size, line height, color, highlights, marks, block style, tables, PDF export.            | App-level UI should call Tiptap commands; Skriva should reflect mixed selections and direct style contributions.                                                                                                                                                                                                       | React/browser tests for toolbar active states, collapsed cursor stored marks, and mixed style selections.                                        |
| Pagination                  | Core differentiator. Page geometry, page gaps, page margin guides, and page breaks exist.                                  | Page breaks, margins, caret movement, selection painting, and PDF export should stay deterministic across fonts and render modes.                                                                                                                                                                                      | Canvas/PDF pixel parity, text extraction, page break insertion, margin drag tests.                                                               |
| Accessibility               | Minimal because canvas editor uses hidden textarea.                                                                        | Provide keyboard access, focus behavior, screen reader fallbacks where practical, and app-level labels for controls.                                                                                                                                                                                                   | Browser accessibility smoke tests, keyboard-only workflow tests, focus restoration tests.                                                        |
| Performance                 | Not yet benchmarked deeply.                                                                                                | Large documents should keep typing, selection, layout, and export responsive.                                                                                                                                                                                                                                          | Benchmarks for layout, render, text measurement, PDF generation, and large history stacks.                                                       |

### Not In Scope for the Skriva Visual Layer

| Feature area                                | Reason                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pixel-perfect DOM `contenteditable` parity  | Skriva intentionally renders through deterministic canvas/PDF layout, not browser DOM layout.                                                                |
| Universal ProseMirror view compatibility    | ProseMirror plugins often depend on DOM views, decorations, transactions, plugin state, and editor view internals that conflict with a focused canvas layer. |
| Full `EditorView` / transaction API clone   | Skriva uses a surface adapter instead of emulating the full ProseMirror DOM view.                                                                            |
| Node views as canonical document rendering  | Skriva visual coverage should come through enrichments and the layout engine. DOM previews can exist at the app layer.                                       |
| Browser-native selection as source of truth | Canvas hit testing and Tiptap state should drive the visual surface. Native `Selection` remains an input bridge detail.                                      |
| Arbitrary browser CSS cascade               | The Skriva Style Engine uses direct structured style contributions, not arbitrary selectors or browser-dependent cascade behavior.                           |
| Unlimited HTML/CSS paste fidelity           | Clipboard import should normalize into supported document semantics, not preserve arbitrary HTML/CSS that cannot export deterministically.                   |
| Non-React framework targets in v1           | Skriva v1 targets React. Vue-specific Tiptap packages are out of scope for v1 parity.                                                                        |
| WebGL renderer in v1                        | Skriva v1 first-party renderer scope is canvas editor rendering and native PDF export. WebGL can be revisited as an external or later renderer.              |

## Staged Roadmap

### Stage 0: Define the Compatibility Contract

Goal: make Tiptap repository parity precise enough to test.

- Define PDF parity as the rendering quality bar for editor/PDF output.
- Define native PDF export as a hard constraint: no rasterized canvas-page export for document text.
- Define the public React API around a Tiptap `Editor` instance and Skriva enrichments.
- Define the enrichment API for direct Tiptap node/mark style and scene contributions.
- Define the Skriva Style Engine: supported properties, inheritance, direct style contributions, and deterministic precedence.
- Define the Render Model, Layout Engine, Document Scene Graph, Scene Kernel, renderer contract, diagnostics, and overlays.
- Classify the local `tiptap/` package snapshot into parity coverage categories.
- Decide which APIs are public under `@openinspection/skriva` and which packages remain internal.
- Add type/API snapshot tests for the intended public exports.
- Add fixture folders for Tiptap-compatible state, style, scene, canvas, and PDF examples.

Validation:

- `vp check`
- `vp test`
- Type tests for public exports.

### Stage 1: Lock Down Tiptap State Projection

Goal: make the derived Skriva Render Model predictable and disposable.

- Replace Skriva's custom document authority with projection from a real Tiptap `Editor`.
- Remove the old custom document authority rather than preserving compatibility; Skriva is prerelease.
- Project Tiptap state into the Render Model without creating a second document authority.
- Add fixture tests for common Tiptap nodes and marks from the local `tiptap/` snapshot.
- Add diagnostics for missing visual coverage, unsupported style properties, and unsupported export semantics.
- Verify state-only extensions do not require visual enrichments.

Validation:

- Unit tests for Tiptap state projection.
- Diagnostic policy tests.
- Type/API snapshot tests.

### Stage 2: Skriva Style Engine and Text Layout

Goal: make supported CSS-like style deterministic across canvas and PDF.

- Implement direct style contribution resolution from Tiptap nodes, marks, and enrichments.
- Support deterministic source precedence instead of selector specificity.
- Expand fixtures for font family, font size, line height, bold, italic, underline, strike, subscript, superscript, highlight, code, color, and text alignment.
- Keep text style resolution before layout and use font metadata for mark geometry where available.

Validation:

- Style computation tests.
- `packages/layout` text and pagination tests.
- `packages/pdf` pixel and text extraction tests.

### Stage 3: Scene Kernel and Native Renderers

Goal: make the layout engine the source of truth for document appearance.

- Define the minimal Document Scene Graph kernel: pages, fragments, text containers, boxes, hit regions, anchors, transforms, clipping, and z-order.
- Ensure canvas and PDF consume the same scene output.
- Define a renderer conformance suite for native and external renderer implementors.
- Add renderer capability diagnostics and degraded export opt-in behavior.
- Add browser renderer comparisons when layout, selection painting, pagination, fonts, canvas, or PDF output changes.

Validation:

- Canvas/PDF parity tests.
- Scene graph snapshot tests.
- Renderer conformance tests.
- Export failure/degraded export tests.

### Stage 4: Tiptap Repository Parity Enrichments

Goal: ship first-party enrichments for every visual-required package in the local `tiptap/` snapshot.

- Implement visual enrichments for document, text, paragraph, headings, marks, lists, links, tables, media, details, math, and other visual-required Tiptap packages.
- Provide overlay or adapter support for UI-overlay packages where useful.
- Keep framework-specific non-React packages out of v1 scope.
- Maintain the parity inventory as package coverage changes.

Validation:

- One fixture per supported Tiptap package.
- Canvas/PDF output tests for visual-required packages.
- Diagnostics for missing enrichments.

### Stage 5: Google Docs Trajectory

Goal: prove that Google Docs-like capabilities can be added through extensions without bloating the core.

- Exercise rich objects through extensions: drawings, vector-like shapes, positioned objects, embeds, and advanced annotations.
- Keep comments, presence, suggestions, and other non-flow UI as overlays unless they affect appearance, geometry, pagination, hit testing, or export.
- Add extension APIs where needed rather than folding every capability into the Scene Kernel.
- Preserve PDF parity for every capability that affects exported document appearance.

Validation:

- Extension-authored scene fixtures.
- Canvas/PDF parity tests for rich objects.
- Overlay tests for features that stay outside layout.

### Stage 6: Public API and Package Hardening

Goal: make the editor usable as a real package without exposing internals by accident.

- Consolidate the public API through `@openinspection/skriva`.
- Document React usage, Tiptap editor setup, first-party enrichments, custom enrichments, PDF export, and diagnostics.
- Add examples for custom marks, custom nodes, overlays, and app-level toolbar integration.
- Add compatibility notes for unsupported ProseMirror view APIs.

Validation:

- Public API snapshot tests.
- Example app build tests.
- Tree-shaking smoke tests.
- `vp check`
- `vp test`
- `vp run build -r`

## Working Definition of Done

A feature counts as parity-complete when all of these are true:

- It is classified in the Tiptap parity inventory.
- It has a documented API contract or documented reason it is state-only, overlay-only, serialization-only, or out of scope.
- It has Tiptap state projection tests for core behavior.
- It has browser tests for the user workflow when interaction is involved.
- Every visual-required enrichment has geometry parity tests for page breaks, boxes, anchors, and outer dimensions.
- Text-bearing or interactive visual-required enrichments have native PDF structure tests where practical, such as selectable text or link annotations.
- It renders consistently through the Document Scene Graph in canvas and PDF, with pixel or structural tests where practical.
- It round-trips through supported clipboard/serialization paths when applicable.
- It preserves deterministic text layout and font behavior.
