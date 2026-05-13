# Skriva

Skriva is a developer-first, canvas/PDF-first visual representation layer for Tiptap state that makes paginated document editing deterministic.

## Language

**Skriva**:
The released developer-facing package, `@opeinspection/skriva`, for deterministic paginated Tiptap rendering and PDF export.

**Compatibility Contract**:
The documented rules for consuming Tiptap state directly and enriching supported document semantics with deterministic visual behavior.
_Avoid_: Tiptap parity, full ProseMirror compatibility, 100% Tiptap compatibility

**Tiptap Repository Parity**:
The v1 goal of shipping first-party **Extension Enrichments** for every Tiptap extension package included in the local `tiptap/` repository snapshot where visual coverage is needed.
_Avoid_: arbitrary third-party Tiptap plugin compatibility

**PDF Parity**:
The rendering goal that editor output and exported PDF output should match as closely as technically practical.
_Avoid_: best-effort PDF export

**Native PDF Export**:
PDF generation from the **Document Scene Graph** using PDF text and vector primitives so exported text remains selectable and searchable.
_Avoid_: canvas screenshot PDF, rasterized document export

**Google Docs Trajectory**:
The long-term extensibility goal that Google Docs-like document capabilities should be possible through the **Scene Kernel** and **Extension Enrichments**.
_Avoid_: v1 Google Docs clone

**Editor Substrate**:
The reusable base layer that editor products build on for paginated layout, rendering, interaction, and export.
_Avoid_: editor app, end-user editor

**Logic Layer**:
Tiptap-owned editor state and commands, including the `useEditor` hook and ProseMirror document model.
_Avoid_: Skriva session state, custom command runtime

**Tiptap Projection**:
The deterministic derivation from live Tiptap state into Skriva's disposable **Render Model**, including document JSON, active selection, marks, schema coverage, and diagnostics inputs.
_Avoid_: editor session sync, mirrored document state

**Visual Representation Layer**:
Skriva-owned pagination, canvas/PDF layout, hit testing, selection painting, and export for the **Logic Layer** state.
_Avoid_: logic layer, document authority

**Render Model**:
A disposable deterministic projection of Tiptap state and **Extension Enrichment** output used for layout, pagination, painting, hit testing, diagnostics, and export.
_Avoid_: editor state, document model

**Layout Engine**:
The normative Skriva layer that turns the **Render Model** into renderer-independent visual instructions for how a document should look.
_Avoid_: renderer implementation, canvas renderer, PDF renderer

**Document Scene Graph**:
The renderer-independent output of the **Layout Engine**, representing paginated text, blocks, tables, images, vector-like objects, hit regions, and other document appearance primitives.
_Avoid_: CSS output, low-level display list

**Renderer Implementation**:
A target-specific implementation, such as canvas or PDF, that realizes the **Layout Engine** output.
_Avoid_: layout authority

**Renderer Conformance Suite**:
Shared tests that prove a **Renderer Implementation** follows the **Scene Kernel**, style, geometry, and structural output contracts expected by Skriva.
_Avoid_: renderer-specific folklore

**Renderer Support Level**:
The declared compatibility level for a renderer, such as full, preview-only, non-exporting, or experimental.
_Avoid_: ambiguous renderer support

**Document Overlay**:
A product or collaboration layer, such as comments or presence, that can attach to document positions without being part of core document layout.
_Avoid_: layout primitive

**Scene Kernel**:
The minimal core of the **Document Scene Graph** that defines shared invariants, traversal, pagination boundaries, and renderer contracts while leaving document-specific capabilities to extensions.
_Avoid_: full built-in document feature set

**Skriva Style Engine**:
A constrained CSS-like engine that resolves supported style properties deterministically for layout, scene generation, and renderer implementations.
_Avoid_: browser CSS engine, arbitrary CSS cascade

**Font Catalog**:
The deterministic registry of Skriva-controlled font families, faces, metrics, and checked-in manifest expectations used by the **Skriva Style Engine** before layout.
_Avoid_: renderer font fallback, ad hoc font lookup

**Controlled Google Font Family**:
A Google Fonts family that Skriva ships or exposes through its editor font catalog and validates against a checked-in manifest before rendering.
_Avoid_: partially registered Google font, best-effort Google font

**Surface Adapter**:
The small Skriva API that translates canvas surface events and geometry into Tiptap-compatible editor interactions without emulating the full ProseMirror DOM view.
_Avoid_: DOM event emulation, fake EditorView

**Browser Input Adapter**:
An internal adapter that captures browser-native input, composition, clipboard, and focus events and emits semantic **Surface Adapter** intents without owning document state.
_Avoid_: hidden editor authority, hidden EditorView, public input surface

**Renderer Extension**:
A Skriva extension capability that describes how Tiptap document semantics are laid out, painted, and exported.
_Avoid_: Tiptap plugin, ProseMirror plugin

**Extension Enrichment**:
A Skriva-provided visual capability attached to a Tiptap extension without changing behavior, commands, or document semantics.
_Avoid_: extension wrapper, forked extension

**Enrichment Match**:
The rule that connects an **Extension Enrichment** to a Tiptap node or mark, normally by canonical schema name.
_Avoid_: implicit plugin pairing

**State-Only Extension**:
A Tiptap extension that manages editor behavior or collaboration state without introducing document semantics that require visual rendering.
_Avoid_: unsupported extension

**Visual Diagnostic**:
A configurable development warning or error that tells implementers when Tiptap document semantics lack Skriva visual coverage.
_Avoid_: silent fallback

**Diagnostic Policy**:
The implementer-configured behavior for surfacing **Visual Diagnostics**, defaulting to development warnings.
_Avoid_: hardcoded warning mode

**Editor Component**:
The app-facing Skriva integration surface that renders a Tiptap editor state with minimal product-shell wiring.
_Avoid_: custom editor runtime

**React Target**:
The v1 runtime target for Skriva app integration, excluding Vue and other framework-specific Tiptap packages from the parity scope.
_Avoid_: framework-agnostic v1 runtime

**Degraded Export**:
An explicit export mode where unsupported document semantics may be omitted, approximated, or replaced after the implementer opts in.
_Avoid_: silent export fallback

**Static PDF Alternative**:
A native PDF-rendered representation supplied by an **Extension Enrichment** for interactive or dynamic document content, preserving the same layout footprint as the canvas representation so pagination and layout do not drift.
_Avoid_: missing PDF renderer, rasterized page fallback

**Tiptap Extension**:
A Tiptap-owned extension that defines editor schema, commands, input behavior, and state semantics.
_Avoid_: renderer extension, Skriva plugin

## Relationships

- The **Logic Layer** owns document state and command semantics.
- **Tiptap Projection** is the only path from the **Logic Layer** into the **Render Model**.
- The **Render Model** is derived from the **Logic Layer** and must not become a second document authority.
- The **Layout Engine** defines how the document should look before target-specific rendering.
- The **Document Scene Graph** is the layout source of truth for document appearance and should leave room for Google Docs-like rich objects.
- The **Scene Kernel** should stay small and let **Extension Enrichments** provide additional scene capabilities where practical.
- The **Skriva Style Engine** borrows CSS vocabulary where useful but only supports properties Skriva can layout and export deterministically.
- The **Skriva Style Engine** resolves direct style contributions from Tiptap nodes, marks, and **Extension Enrichments** rather than arbitrary selectors.
- The **Font Catalog** is the only source of truth for resolving controlled font family, weight, style, metrics, and outline data before text layout.
- A **Controlled Google Font Family** must be complete according to the checked-in Google Fonts manifest before the **Skriva Style Engine** may resolve or render it.
- The **Skriva Style Engine** must not synthesize missing bold, italic, or bold-italic faces for **Controlled Google Font Families**.
- Style conflicts resolve by deterministic source precedence, not CSS selector specificity.
- A **Renderer Implementation** must follow the **Layout Engine** output rather than redefining document layout.
- A **Renderer Conformance Suite** should define expectations for native and external renderer implementors.
- A **Renderer Support Level** may describe partial external renderers, but first-party repository renderers should be fully compatible.
- Canvas editor rendering and native PDF export are the only first-party **Renderer Implementations** targeted for v1.
- Canvas and PDF may render different internals for dynamic content, but they must consume the same outer scene geometry from the **Layout Engine**.
- The **Scene Kernel** owns page geometry, text measurement contracts, flow containers, scene node protocol, renderer contracts, diagnostics, and anchors back to Tiptap positions.
- The **Scene Kernel** built-in `box` and `text` scene node kinds have implicit first-party PDF coverage through the shared **Skriva Style Engine** and renderer contracts.
- A **Document Overlay** may live outside the **Layout Engine** when it does not change document flow or export geometry.
- If a feature changes document appearance, geometry, pagination, hit testing, or export, it belongs in the **Document Scene Graph**; otherwise it may remain a **Document Overlay**.
- **Extension Enrichments** for document content require native PDF export coverage by default, including **Static PDF Alternatives** for interactive or dynamic content, unless explicitly classified as editor-only overlays.
- The **Visual Representation Layer** presents and edits the **Logic Layer** state with deterministic pagination.
- The **Surface Adapter** lets Skriva forward canvas interactions to Tiptap without owning interaction semantics.
- The **Browser Input Adapter** is an implementation detail behind the **Surface Adapter** and must not become a second document authority.
- The **Editor Substrate** provides foundations for editor implementations without owning their product shell.
- The **Editor Component** should let app developers render Tiptap state without manually coordinating the **Render Model**.
- The primary React **Editor Component** accepts a Tiptap `Editor` instance as the **Logic Layer** handle.
- The **React Target** scopes v1 app integration and Tiptap package parity to React.
- The **Compatibility Contract** defines how the **Visual Representation Layer** integrates with the **Logic Layer** without becoming a separate document authority.
- **PDF Parity** is the rendering quality bar across Skriva's editor and export surfaces.
- **Native PDF Export** is required; PDF output must not be generated by rasterizing canvas pages.
- **Tiptap Repository Parity** is a v1 goal for first-party enrichments, scoped to the local `tiptap/` package snapshot until a versioned support policy replaces it.
- **Google Docs Trajectory** follows after **Tiptap Repository Parity** and should be enabled through extensions rather than broadening the core prematurely.
- A **Renderer Extension** complements a **Tiptap Extension** when document semantics need deterministic layout, canvas painting, or PDF export.
- An **Extension Enrichment** lets Skriva add renderer behavior while preserving direct compatibility with **Tiptap Extensions**.
- An **Extension Enrichment** is strictly visual; state changes and editing behavior belong in **Tiptap Extensions**.
- A **State-Only Extension** can work without an **Extension Enrichment** when it does not affect document layout, rendering, or export semantics.
- An **Enrichment Match** uses Tiptap node and mark names by default, with explicit overrides for renamed or composed semantics.
- A **Visual Diagnostic** should surface immediately by default when Skriva sees document semantics without visual coverage.
- A **Diagnostic Policy** may promote diagnostics to errors or intentionally suppress known fallbacks.
- Export should fail for document content when native PDF coverage or a required **Static PDF Alternative** is missing.

## Example Dialogue

> **Dev:** "Does this count as Tiptap parity?"
> **Domain expert:** "Only if the **Visual Representation Layer** preserves the **Logic Layer** semantics while adding deterministic pagination."

## Flagged Ambiguities

- "Tiptap parity" can imply full API or DOM behavior compatibility; resolved: use **Compatibility Contract** for the supported subset Skriva commits to.
- "Editor state" can mean either Tiptap state or Skriva session state; resolved: the **Logic Layer** owns editor state, while Skriva owns visual representation.
- "Plugin" can mean a Tiptap extension or a Skriva renderer capability; resolved: use **Tiptap Extension** for logic/state semantics and **Renderer Extension** for visual/export semantics.
- "Skriva extension" can imply wrapping or forking Tiptap extensions; resolved: prefer **Extension Enrichment** so developers can pass normal **Tiptap Extensions** directly into Skriva.
- "Visual interaction" can drift into Skriva-owned editing behavior; resolved: **Extension Enrichment** remains visual-only and delegates mutations to **Tiptap Extensions**.
- "Renderer" can mean layout authority or target-specific drawing; resolved: the **Layout Engine** is normative, while each **Renderer Implementation** realizes its output.
- "Tiptap interaction compatibility" can imply full ProseMirror DOM view emulation; resolved: use a smaller **Surface Adapter** for the common interaction surface.
- "Hidden textarea" can sound like the architectural seam; resolved: use **Browser Input Adapter** for the internal browser event capture adapter, and keep the **Surface Adapter** as the semantic interaction seam.
- "100% compatible with Tiptap" can imply arbitrary ProseMirror view/plugin compatibility; resolved: promise direct **Tiptap Extension** input, not universal ProseMirror-view compatibility.
- "Unsupported extension" can include harmless state-only behavior or missing document rendering; resolved: **State-Only Extensions** are allowed, while missing visual coverage emits a **Visual Diagnostic**.
- "Fallback export" can hide missing visual coverage; resolved: document content requires native PDF coverage or a **Static PDF Alternative**.
