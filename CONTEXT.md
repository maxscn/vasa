# Skriva

Skriva is a developer-first, canvas/PDF-first visual representation layer for Tiptap state that makes paginated document editing deterministic.

## Language

**Skriva**:
The released developer-facing package, `@openinspection/skriva`, for deterministic paginated Tiptap rendering and PDF export.
_Avoid_: @openinspection/skriva

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

**PDF Export API**:
The public `@openinspection/skriva/pdf` capability for exporting Skriva/Tiptap document content through the shared headless render pipeline.
_Avoid_: general React PDF renderer, public PDF reconciler

**PDF Reconciler**:
An internal implementation tool that can turn React-like PDF primitives into layout input for tests or internal rendering work.
_Avoid_: public PDF primitive API

**PDF Hook**:
The React convenience hook exported as `usePdf` that derives PDF output from a live Tiptap editor through the same headless render pipeline.
_Avoid_: PDF authority, React-only PDF export

**Headless Render Layer**:
The non-React Skriva pipeline that derives layout, scene, canvas, and PDF output from Tiptap document input and visual configuration.
_Avoid_: React renderer, interaction layer

**Headless Interaction Layer**:
The non-React Skriva layer that resolves UI-independent editor interactions against Tiptap state and visual context into deterministic ProseMirror/Tiptap-native transactions, delegated commands, or state transitions.
_Avoid_: browser event handler, canvas editor runtime, second document model

**Headless Editor State**:
A testable wrapper around Tiptap editor state plus Skriva visual interaction context and pending side effects, with Tiptap remaining the document and selection authority.
_Avoid_: parallel document state, custom editor session, React component state

**Google Docs Trajectory**:
The long-term extensibility goal that Google Docs-like document capabilities should be possible through the **Scene Kernel** and **Extension Enrichments**.
_Avoid_: v1 Google Docs clone

**Google Docs Keyboard Navigation**:
The target editing feel for caret movement, selection extension, and document navigation semantics, using platform-aware shortcut chords where browsers and operating systems allow them.
_Avoid_: browser-native shortcut parity, OS-level shortcut override, contenteditable shortcut cloning

**Canvas Editing Feasibility**:
The working assumption that Google Docs-level document interaction can be implemented on a canvas surface when the editor supplies sufficient semantic input, selection, layout, and accessibility adapters.
_Avoid_: canvas interaction ceiling, impossible because canvas

**Editor Substrate**:
The reusable base layer that editor products build on for paginated layout, rendering, interaction, and export.
_Avoid_: editor app, end-user editor

**Public Package Seam**:
The rule that apps consume Skriva only through `@openinspection/skriva` subpath exports instead of importing implementation files from internal packages or demo apps.
_Avoid_: app-to-app editor imports, internal package imports

**Root Public Export**:
The deliberately small `@openinspection/skriva` entrypoint for durable app-facing types and defaults that should remain stable across internal package reshaping.
_Avoid_: public barrel, convenience export for every module

**Rich Editor Shell**:
The product-level toolbar, rails, inspector, PDF preview, and workflow controls composed around the public **Editor Component**.
_Avoid_: core editor component, demo-only shell

**Editor Primitive**:
A stable public Skriva React hook, component, context, action, or type used by apps to compose editor products.
_Avoid_: product toolbar component, product inspector component

**Skriva React Hook**:
The public `useSkriva` hook that binds a live Tiptap editor to Skriva visual surface state, actions, layout, and export inputs.
_Avoid_: useEditor, useSkrivaEditor

**Skriva Surface Context**:
The React context established by the public **Editor Component** so composed shell components can call `useSkriva()` without prop-threading the surface object.
_Avoid_: separate toolbar editor, duplicated editor instance

**Hidden Provider Pattern**:
The React composition pattern where the public **Editor Component** provides Skriva context internally instead of requiring app code to render a separate provider.
_Avoid_: visible provider ceremony

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

**Scene Contract**:
The public, serializable **Document Scene Graph** shape and fixture format that external tools may read without depending on Skriva's layout or renderer internals.
_Avoid_: layout API, renderer internals

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

**Semantic Keyboard Movement**:
Supported caret and selection movement behavior expressed in editor terms, independent of whether a browser or operating system delivers a particular physical shortcut chord.
_Avoid_: native shortcut parity, physical key guarantee

**Renderer Extension**:
A Skriva extension capability that describes how Tiptap document semantics are laid out, painted, and exported.
_Avoid_: Tiptap plugin, ProseMirror plugin

**Extension Enrichment**:
A Tiptap-shaped Skriva visual/export capability attached to a Tiptap extension without changing behavior, commands, or document semantics.
_Avoid_: extension wrapper, forked extension, plugin

**Extension Kit**:
A first-party convenience export that pairs matching **Tiptap Extensions** with their **Extension Enrichments** while keeping the two arrays separate.
_Avoid_: mixed extension array, enrichment that owns behavior

**Skriva-Aware Tiptap Extension**:
A public Tiptap extension object with non-primary Skriva metadata attached so Tiptap can consume it normally while Skriva can extract visual coverage.
_Avoid_: fake Tiptap extension, mixed internal extension

**File Handler Enrichment**:
A general editor capability for dropped and pasted files that routes file ingestion into app or enrichment-specific Tiptap commands.
_Avoid_: SVG-only drop handler, node-specific file drop API

**Skriva Extension List**:
The public `extensions` array passed to Skriva editor and PDF APIs, normally containing **Skriva-Aware Tiptap Extensions** from which Skriva extracts visual coverage.
_Avoid_: plugins, enrichments prop

**Extension Coverage Inference**:
The React editor behavior where Skriva reads `.skriva` metadata from the live Tiptap editor's configured extensions when no explicit **Skriva Extension List** is supplied.
_Avoid_: automatic built-in defaults, hidden starter kit

**Explicit Extension Composition**:
The rule that app developers must pass the Skriva extensions they want instead of relying on built-in defaults or automatic inference.
_Avoid_: default extension bundle, automatic enrichment loading

**Starter Kit**:
The explicitly imported first-party **Extension Kit** that mirrors common Tiptap starter document semantics for quick setup.
_Avoid_: default extensions, implicit built-ins, starter enrichments

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
The app-facing Skriva React component exported as `Editor` that renders a Tiptap editor state with minimal product-shell wiring.
_Avoid_: custom editor runtime, SkrivaEditor

**Editor Defaults**:
The built-in page, font, and text rendering choices that let the public **Editor Component** work without mandatory visual configuration.
_Avoid_: demo config, required setup object

**Editor Visual Options**:
The optional public overrides for **Editor Defaults**, separate from Tiptap setup and the **Skriva Extension List**.
_Avoid_: everything config, Tiptap options

**Advanced Renderer Options**:
Low-level canvas, PDF, measurement, or diagnostic knobs that are intentionally outside the public **Editor Component** happy path.
_Avoid_: top-level editor props for unstable renderer tuning

**Editor React Subpath**:
The public React editor integration subpath, `@openinspection/skriva/editor/react`, for the primary **Editor Component** and editor-specific React helpers.
_Avoid_: @openinspection/skriva/react

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
- The **Headless Render Layer** owns deterministic visual output without owning user interaction semantics.
- The **Headless Interaction Layer** owns UI-independent interaction resolution by reducing **Headless Editor State** without owning document state.
- **Headless Editor State** wraps Tiptap state for deterministic testing and effects, but Tiptap remains the source of truth for document and selection.
- The **Layout Engine** defines how the document should look before target-specific rendering.
- The **Document Scene Graph** is the layout source of truth for document appearance and should leave room for Google Docs-like rich objects.
- The **Scene Contract** is the first public contract for **Document Scene Graph** consumers; layout and renderer construction APIs should stay private until a dedicated implementor API is ready.
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
- **Canvas Editing Feasibility** means the canvas surface is not a reason to rule out Google Docs-level interaction, but each behavior still needs explicit semantic input, selection, layout, and accessibility support.
- **Google Docs Keyboard Navigation** is the target user-facing interaction model for text navigation and selection, while the **Surface Adapter** remains the architectural seam for routing those interactions into the **Logic Layer**.
- The **Surface Adapter** lets Skriva forward canvas interactions to Tiptap without owning interaction semantics.
- The **Browser Input Adapter** is an implementation detail behind the **Surface Adapter** and must not become a second document authority.
- **Semantic Keyboard Movement** belongs to the supported editor behavior contract, while physical shortcut delivery remains subject to browser and operating-system event routing.
- The **Editor Substrate** provides foundations for editor implementations without owning their product shell.
- The **Public Package Seam** keeps app packages such as `apps/web` from depending on private demo shells or internal workspace package paths.
- The **Root Public Export** should stay smaller than the full **Public Package Seam**; substantial capabilities belong on explicit subpaths.
- The **Editor Component** should let app developers render Tiptap state without manually coordinating the **Render Model**.
- The **Editor Component** should work with **Editor Defaults** and expose **Editor Visual Options** only for overrides.
- **Editor Visual Options** should be named top-level override props for stable concepts such as page, fonts, and text defaults.
- **Editor Visual Options** must not contain Tiptap setup or the **Skriva Extension List**; apps pass the **Logic Layer** handle and visual extensions explicitly.
- **Advanced Renderer Options** may exist behind an explicitly named advanced or experimental object rather than expanding the primary **Editor Component** prop surface.
- A **Rich Editor Shell** may be recomposed in an app, but it must use public Skriva APIs rather than private demo-app imports.
- **Editor Primitives** belong in `@openinspection/skriva/editor/react`; **Rich Editor Shell** UI belongs in app packages such as `apps/web`.
- The **Skriva React Hook** accepts the **Logic Layer** handle and an explicit **Skriva Extension List**; it must not create a competing Tiptap editor.
- The **Skriva Surface Context** lets app-owned shell components compose around one **Logic Layer** handle; toolbar components must not call Tiptap's `useEditor()` to create separate editor instances.
- The **Hidden Provider Pattern** is the normal React API: `<Editor>` establishes context for child shell components, and visible providers are advanced escape hatches only.
- The **Editor React Subpath** is the canonical import location for the primary React **Editor Component**.
- The primary React **Editor Component** accepts a Tiptap `Editor` instance as the **Logic Layer** handle.
- The **React Target** scopes v1 app integration and Tiptap package parity to React.
- The **Compatibility Contract** defines how the **Visual Representation Layer** integrates with the **Logic Layer** without becoming a separate document authority.
- **PDF Parity** is the rendering quality bar across Skriva's editor and export surfaces.
- **Native PDF Export** is required; PDF output must not be generated by rasterizing canvas pages.
- The **PDF Export API** should expose document export through the shared **Document Scene Graph**, not a general-purpose public **PDF Reconciler**.
- The **PDF Reconciler** may remain as an internal tool, but publishing it would create a separate product surface from Skriva's document export promise.
- The **PDF Hook** is a React convenience over **Native PDF Export**, not a replacement for headless/server PDF APIs.
- **Tiptap Repository Parity** is a v1 goal for first-party enrichments, scoped to the local `tiptap/` package snapshot until a versioned support policy replaces it.
- **Google Docs Trajectory** follows after **Tiptap Repository Parity** and should be enabled through extensions rather than broadening the core prematurely.
- A **Renderer Extension** complements a **Tiptap Extension** when document semantics need deterministic layout, canvas painting, or PDF export.
- An **Extension Enrichment** lets Skriva add renderer behavior while preserving direct compatibility with **Tiptap Extensions**.
- An **Extension Enrichment** is strictly visual; state changes and editing behavior belong in **Tiptap Extensions**.
- An **Extension Kit** may improve first-party setup ergonomics, but private packages should keep their **Tiptap Extensions** and **Extension Enrichments** separate.
- A **Skriva-Aware Tiptap Extension** is the preferred public composition shape for first-party exports: Tiptap sees a normal extension, while Skriva can read attached `.skriva` metadata.
- Public **Skriva-Aware Tiptap Extensions** may be passed to Tiptap directly, but their attached Skriva metadata must not make the extension own visual rendering behavior in the **Logic Layer**.
- A **File Handler Enrichment** should handle dropped and pasted files as a general editor input seam; SVG import may consume it but should not define the generic drop API.
- **Extension Enrichments** compose with app ergonomics similar to Tiptap extensions, but remain separate from the **Logic Layer**.
- The **Skriva Extension List** uses the public option name `extensions`; `enrichments` remains architectural language rather than the React prop name.
- **Explicit Extension Composition** applies to both editor rendering and PDF export; Skriva should not load built-in defaults or infer all visual coverage from a Tiptap editor.
- **Extension Coverage Inference** may avoid duplicate React props when apps already configured Tiptap with **Skriva-Aware Tiptap Extensions**, but it must not auto-load unconfigured coverage.
- Headless and server-side **PDF Export API** calls should require an explicit **Skriva Extension List** unless they receive a real **Logic Layer** handle that can be inspected.
- The **Starter Kit** may be offered as a convenience, but it must be imported explicitly and must not make Skriva appear to have implicit default visual coverage.
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
