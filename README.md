# Vasa

Vasa is an opinionated canvas-based rich text editor. It uses Tiptap extension metadata where it is useful, but the primary editor runtime is custom: `EditorJson`, `EditorSelection`, `EditorSession`, deterministic layout, and canvas/PDF renderers.

The goal is not to clone a DOM editor. The goal is a document editor whose authoring behavior feels familiar to Tiptap/ProseMirror users while preserving canvas/PDF parity, pagination, font metrics, and deterministic export.

## Editor Parity Roadmap

This audit compares the current editor against Tiptap/ProseMirror feature areas. It separates three kinds of parity:

- **Must match Tiptap API behavior**: public commands, extension contracts, schemas, JSON/HTML semantics, and command return behavior should be close enough that Tiptap-shaped extensions and app code behave predictably.
- **Must support equivalent user-facing editing**: the user should be able to perform the same editing task, but Vasa can implement it through canvas-native selection, layout, or PDF-first abstractions.
- **Not in scope because this editor is canvas/PDF-first**: DOM-centric behavior that would make rendering less deterministic, degrade PDF parity, or overfit to `contenteditable`.

### Current Architecture Snapshot

| Area           | Current state                                                                                                                                                                                                                              | Evidence                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Document model | Custom JSON tree with `type`, `attrs`, `content`, `marks`, and `text`.                                                                                                                                                                     | `packages/editor/src/index.ts`                                              |
| Editor state   | Custom session with selection, stored marks, disabled marks, undo, redo.                                                                                                                                                                   | `packages/editor/src/session.ts`                                            |
| Selection      | Path/offset selection with optional anchor, plus canvas hit testing and rendered-line movement.                                                                                                                                            | `packages/editor/src/actions.ts`, `packages/editor/src/interaction.ts`      |
| Input bridge   | Hidden textarea handles keyboard, beforeinput, paste, copy, cut, and native history events.                                                                                                                                                | `packages/editor/react/use-editor-input.ts`                                 |
| Tiptap usage   | `@tiptap/react` editor is created, and Vasa extensions expose `tiptap` metadata. Custom keymap extracts some Tiptap shortcuts.                                                                                                             | `packages/editor/react/use-editor.ts`, `packages/editor/react/keymap.ts`    |
| Rendering      | Shared layout feeds canvas, WebGL text fallback, and PDF rendering.                                                                                                                                                                        | `packages/editor/src/render-profile.ts`, `packages/pdf/tests/pixel.test.ts` |
| Extensions     | Existing nodes/marks include doc, paragraph, text, heading, blockquote, horizontal rule, table, SVG, bold, italic, underline, strike, code, highlight, subscript, superscript, text style, color, font family, font size, and line height. | `packages/extension-*`                                                      |

## Parity Matrix

### Must Match Tiptap API Behavior

| Feature area              | Current status                                                                                                 | Target behavior                                                                                                                                                                                                                                                               | Test targets                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extension shape           | Partial. Extensions expose `tiptap`, layout, and renderers, but Vasa only consumes a subset of Tiptap hooks.   | Define the supported Tiptap-compatible contract for `Node.create`, `Mark.create`, `Extension.create`, `addCommands`, `addKeyboardShortcuts`, `parseHTML`, `renderHTML`, `addAttributes`, names, options, and storage. Unsupported hooks should fail clearly or be documented. | Unit tests that instantiate each Vasa extension and assert exposed command/shortcut names match the corresponding Tiptap extension where claimed.               |
| Command return semantics  | Partial. Vasa command wrappers return booleans, but only selected commands are routed.                         | Commands should return `true` only when handled, `false` when unavailable, and preserve chainability or provide an intentional Vasa equivalent.                                                                                                                               | Command contract tests for mark toggles, block type commands, blockquote, heading, paragraph, horizontal rule, table operations, undo, redo.                    |
| Mark commands             | Good base for bold, italic, underline, strike, code, highlight, subscript, superscript, text style.            | Match Tiptap behavior for `setMark`, `toggleMark`, `unsetMark`, active mark detection, stored marks at a collapsed cursor, and mark exclusion where supported.                                                                                                                | Golden JSON tests for collapsed selection, expanded selection, partial mark ranges, mark removal, adjacent text merge, and stored mark typing.                  |
| Text style commands       | Partial. Font family, size, line height, and color are implemented as style marks.                             | Match Tiptap-style text-style behavior for setting/unsetting attributes without erasing unrelated attributes.                                                                                                                                                                 | Tests for combining `fontId`, `fontSize`, `lineHeight`, `color`, `backgroundColor`, `fontWeight`, `fontStyle`, decoration, vertical align, and code attributes. |
| Block commands            | Partial. Paragraph, heading levels 1-3 in UI, blockquote, horizontal rule, page spacer, table insertion exist. | Match claimed Tiptap commands for `setParagraph`, `toggleHeading`, blockquote wrap/lift/toggle, and horizontal rule insertion semantics.                                                                                                                                      | JSON transition tests around block boundaries, empty blocks, nested blockquote children, and Enter/Backspace around block nodes.                                |
| JSON serialization        | Partial. Vasa JSON resembles ProseMirror JSON but is not schema-validated.                                     | Public import/export should accept and emit a documented ProseMirror-like JSON subset with deterministic normalization.                                                                                                                                                       | Round-trip tests for every supported node/mark, invalid input tests, and schema fixture snapshots.                                                              |
| HTML parse/render         | Partial. Clipboard HTML parse/render exists for common blocks, marks, and tables.                              | For supported nodes/marks, `parseHTML` and `renderHTML` should match documented Tiptap-compatible semantics.                                                                                                                                                                  | Clipboard fixture tests from HTML to Vasa JSON to HTML, including nested marks, style marks, blockquote, heading, tables, and horizontal rules.                 |
| Keyboard shortcut mapping | Partial. Default text/history shortcuts and some extension shortcuts are mapped.                               | Shortcuts claimed by extensions should match Tiptap names and key behavior, with platform-aware `Mod`, `Alt`, `Shift` normalization.                                                                                                                                          | Keyboard event tests for all extension shortcuts and text/history shortcuts.                                                                                    |
| Public package surface    | Early. Root package direction says `@opeinspection/vasa` should be the tree-shakeable public package.          | Export a stable, documented API that apps can consume without reaching into internal packages.                                                                                                                                                                                | API snapshot tests or type tests for intended exports only.                                                                                                     |

### Must Support Equivalent User-Facing Editing

| Feature area                | Current status                                                                                                             | Target editing behavior                                                                                                                                              | Test targets                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Basic typing                | Implemented through hidden textarea and custom mutations.                                                                  | Text entry should handle printable keys, beforeinput, IME composition, pasted text, multiline text, and selection replacement.                                       | Browser tests for typing, paste, composition events, newline, paragraph split, and replacing selected text.                                      |
| Selection and caret         | Good base. Supports path/offset, drag selection, double/triple click selection, rendered-line hit testing, caret painting. | Selection should feel native across wrapped lines, pages, blocks, tables, SVG/horizontal rule boundaries, and high DPI canvas scaling.                               | Playwright tests for click, drag, shift-arrow, word movement, line movement, vertical movement, select all, multi-click, page boundary movement. |
| Deletion                    | Partial to good. Character, word, and line deletion exist, with custom large-block boundary logic.                         | Backspace/Delete should handle text, selected ranges, empty paragraphs, block joins, tables, horizontal rules, SVG, blockquotes, and page spacers consistently.      | JSON transition tests for all boundary cases plus browser tests for visible caret/result.                                                        |
| Undo/redo                   | Basic custom stacks exist.                                                                                                 | Undo/redo should group user intents similarly to native editors: typing batches, paste as one step, mark changes as one step, table commands as one step.            | Session history tests for grouping, redo invalidation, selection restoration, and history limit.                                                 |
| Clipboard                   | Partial. Plain text, Vasa JSON MIME, and HTML are supported.                                                               | Copy/cut/paste should preserve supported marks, block structure, tables, line breaks, and plain-text fallback.                                                       | Clipboard unit tests plus Playwright copy/paste across Vasa instances and paste from external HTML.                                              |
| Input rules and paste rules | Not implemented as a first-class system.                                                                                   | Support common authoring transforms where useful: smart quotes if desired, markdown-style heading/list shortcuts if supported, link-like rules if links enter scope. | Rule runner tests with before/after JSON and browser tests for trigger timing.                                                                   |
| Lists                       | Missing.                                                                                                                   | Equivalent user-facing bullet, ordered, nested list, split list item, lift/sink list item, and keyboard behavior if lists are in scope for authoring.                | JSON and browser tests for Enter, Shift-Tab/Tab, Backspace at list start, copy/paste nested lists, PDF/canvas parity.                            |
| Links                       | Missing.                                                                                                                   | Link mark editing, open/edit/remove UI hooks, paste/autolink behavior if links are in scope.                                                                         | Mark command tests, clipboard round-trip tests, PDF text extraction/link annotation tests if PDF links are supported.                            |
| Tables                      | Basic table rendering and row/column insert/delete exist.                                                                  | User should be able to navigate cells, select cells, edit cell content, add/delete rows/columns, delete table, and preserve table layout in PDF/canvas.              | Table command tests, keyboard navigation tests, clipboard tests, renderer parity tests, row/column edge cases.                                   |
| Block nodes                 | Horizontal rule, SVG, and page spacers exist.                                                                              | Atomic-ish blocks should be selectable, movable around with keyboard, deletable, copied, pasted, and rendered identically in canvas/PDF.                             | Boundary selection tests, delete tests, clipboard tests, renderer snapshots.                                                                     |
| Text formatting UI          | Existing app controls cover font, size, line height, color, highlights, marks, block style, tables, PDF export.            | Toolbar state should reflect mixed selections and stored marks, and commands should keep focus in the editor.                                                        | React/browser tests for toolbar active states, collapsed cursor stored marks, and mixed style selections.                                        |
| Pagination                  | Core differentiator. Page geometry, page gaps, page margin guides, and page breaks exist.                                  | Page breaks, margins, caret movement, selection painting, and PDF export should stay deterministic across fonts and render modes.                                    | Canvas/PDF pixel parity, text extraction, page break insertion, margin drag tests.                                                               |
| Accessibility               | Minimal because canvas editor uses hidden textarea.                                                                        | Provide keyboard access, focus behavior, screen reader fallbacks where practical, and app-level labels for controls.                                                 | Browser accessibility smoke tests, keyboard-only workflow tests, focus restoration tests.                                                        |
| Performance                 | Not yet benchmarked deeply.                                                                                                | Large documents should keep typing, selection, layout, and export responsive.                                                                                        | Benchmarks for layout, render, text measurement, PDF generation, and large history stacks.                                                       |

### Not In Scope Because This Editor Is Canvas/PDF-First

| Feature area                                             | Reason                                                                                                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pixel-perfect DOM `contenteditable` parity               | Vasa intentionally renders through deterministic canvas/PDF layout, not browser DOM layout.                                                                             |
| Arbitrary ProseMirror plugin compatibility               | ProseMirror plugins often depend on DOM views, decorations, transactions, plugin state, and editor view internals that conflict with Vasa's custom runtime.             |
| Full `EditorView` / transaction API clone                | Vasa should expose a stable editing API, but cloning ProseMirror transactions would pull the project toward DOM-editor internals.                                       |
| Node views as DOM components                             | Canvas/PDF rendering needs layout/render extensions, not arbitrary DOM node views. DOM previews can exist at the app layer, but are not the canonical document surface. |
| Browser-native selection objects as source of truth      | Canvas hit testing and path/offset selections are the source of truth. Native `Selection` should remain an input bridge detail.                                         |
| CSS cascade as document layout engine                    | Text metrics, wrapping, font metadata, and marks must resolve before layout so canvas and PDF stay aligned.                                                             |
| Unlimited HTML/CSS paste fidelity                        | Clipboard import should normalize into supported document semantics, not preserve arbitrary HTML/CSS that cannot export deterministically.                              |
| Collaborative editing parity with ProseMirror collab/Yjs | Collaboration is valuable later, but it should be designed around Vasa's document/session model and deterministic rendering constraints.                                |
| Mobile platform editor parity                            | Touch editing and mobile keyboard support can be staged later, but desktop/document authoring and PDF parity come first.                                                |

## Staged Roadmap

### Stage 0: Define the Compatibility Contract

Goal: make "Tiptap parity" precise enough to test.

- Write a supported-feature spec for nodes, marks, commands, shortcut names, JSON, HTML, clipboard MIME, and extension hooks.
- Decide which APIs are public under `@opeinspection/vasa` and which packages remain internal.
- Add type/API snapshot tests for the intended public exports.
- Add fixture folders for Tiptap-compatible JSON and HTML examples.

Validation:

- `vp check`
- `vp test`
- Type tests for public exports.

### Stage 1: Lock Down Core Text Editing

Goal: make the custom runtime as predictable as a native rich text editor for plain text and marks.

- Expand unit tests for `insertText`, `insertTextWithMarks`, `deleteBackward`, `deleteForward`, `splitParagraph`, `selectAllDocument`, word/line movement, and stored marks.
- Add command parity tests for `setMark`, `toggleMark`, `unsetMark`, mark active state, and text style attribute merging.
- Add browser tests for typing, paste, cut/copy, undo/redo, select all, drag selection, double/triple click, and arrow movement.
- Add IME/composition tests before relying on hidden-textarea behavior for broader input.

Validation:

- `vp test packages/editor`
- `vp test packages/extension-bold packages/extension-italic packages/extension-underline packages/extension-strike packages/extension-text-style`
- Browser tests in `apps/editor/tests/browser`.

### Stage 2: Normalize Serialization and Clipboard

Goal: make documents portable and clipboard behavior boring in the best way.

- Define the canonical Vasa JSON subset and normalization rules.
- Make HTML parse/render behavior explicit for every supported node and mark.
- Preserve supported marks and blocks through copy/paste, while degrading unsupported HTML to deterministic text/blocks.
- Add round-trip tests for JSON, HTML, text, and the Vasa clipboard MIME type.

Validation:

- Unit tests around `parseEditorHtml`, `serializeEditorHtml`, `getSelectedContent`, `getSelectedHtml`, and `insertEditorContent`.
- Cross-editor Playwright paste tests.
- External HTML paste fixtures.

### Stage 3: Complete Block Editing

Goal: make block-level authoring feel coherent without sacrificing layout determinism.

- Finish paragraph, heading, blockquote, horizontal rule, SVG, and page-spacer boundary behavior.
- Decide whether lists and links are in authoring scope. If yes, add extensions, commands, shortcuts, serialization, clipboard, canvas rendering, and PDF rendering together.
- Add input-rule infrastructure only for scoped transformations that can be represented deterministically.
- Improve undo grouping for block commands and paste.

Validation:

- JSON transition tests for every block command and boundary.
- Browser tests for Enter, Backspace, Delete, arrow movement, selection, and clipboard around block nodes.
- Canvas/PDF parity tests for each block fixture.

### Stage 4: Tables as a First-Class Editing Surface

Goal: move tables from renderable blocks to a complete editing experience.

- Add cell navigation, selection, insertion/deletion behavior, and clipboard semantics.
- Decide the supported subset for colspan, rowspan, colwidth, headers, and cell background.
- Add row/column command parity tests and browser navigation tests.
- Keep table layout and borders shared between canvas and PDF.

Validation:

- `packages/extension-table` unit tests for structure and renderers.
- Browser tests for editing inside cells, row/column commands, deleting tables, and exiting tables.
- Canvas/PDF pixel parity and PDF text extraction for table fixtures.

### Stage 5: Rendering, Fonts, and Pagination Guarantees

Goal: keep the thing that makes Vasa different: the editor and exported PDF agree.

- Expand fixtures for font family, font size, line height, bold, italic, underline, strike, subscript, superscript, highlight, and code geometry.
- Keep text style resolution before layout and use font metadata for mark geometry where available.
- Add page-break and margin-guide tests that verify selection, layout, canvas, and PDF output together.
- Benchmark layout and rendering on large documents.

Validation:

- `packages/layout` text and pagination tests.
- `packages/pdf` pixel and text extraction tests.
- `apps/editor` browser renderer comparison tests across Chromium, Firefox, and WebKit.
- Performance tests in `packages/editor/tests/performance.test.ts`.

### Stage 6: Public API and Package Hardening

Goal: make the editor usable as a real package without exposing internals by accident.

- Consolidate the public API through `@opeinspection/vasa`.
- Document extension authoring for Vasa: Tiptap-compatible metadata plus layout/render hooks.
- Add examples for React usage, PDF export, custom marks, custom nodes, and app-level toolbar integration.
- Add compatibility notes for unsupported Tiptap/ProseMirror APIs.

Validation:

- Public API snapshot tests.
- Example app build tests.
- Tree-shaking smoke tests.
- `vp check`
- `vp test`
- `vp run build -r`

## Working Definition of Done

A feature counts as parity-complete when all of these are true:

- It has a documented API contract or documented reason it is user-facing only.
- It has JSON transition tests for core behavior.
- It has browser tests for the user workflow when interaction is involved.
- It round-trips through supported clipboard/serialization paths when applicable.
- It renders consistently in canvas and PDF, with pixel or structural tests where practical.
- It preserves deterministic text layout and font behavior.

## Validation Checklist

After changing editor behavior, run:

- `vp install` after pulling remote changes.
- `vp check`
- `vp test`
- Any relevant `vite.config.ts` tasks or `package.json` scripts via `vp run <script>`.
- Browser renderer comparisons when layout, selection painting, pagination, fonts, canvas, WebGL, or PDF output changes.
