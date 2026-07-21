# Skriva v1 Architecture Spec

Skriva v1 is a React-targeted visual representation layer for Tiptap state. Tiptap owns editor logic: state, schema, commands, plugins, input rules, paste rules, collaboration state, and interactions. Skriva owns deterministic pagination, layout, style resolution, canvas rendering, native PDF export, hit regions, visual diagnostics, and renderer conformance.

## Goals

- Keep editor and PDF output as close to 1:1 as technically practical.
- Generate PDF from native text/vector/image/link primitives, never from canvas page screenshots.
- Reach Tiptap repository parity for the local `tiptap/` package snapshot.
- Make Google Docs-like capabilities possible later through extensions rather than by expanding core prematurely.
- Keep React as the only v1 app integration target.

## Public React API

The primary app-facing integration is imported from `@openinspection/skriva/editor/react` and accepts a Tiptap `Editor` instance:

```tsx
import { useEditor } from "@tiptap/react";
import { Editor } from "@openinspection/skriva/editor/react";
import { StarterKit } from "@openinspection/skriva/enrichments/starter";

const extensions = [StarterKit];
const editor = useEditor({ extensions });

<Editor editor={editor} />;
```

App developers should own Tiptap setup with `useEditor`. Skriva should not create a competing editor state or command runtime. Lower-level adapters may exist later, but the v1 happy path is React plus a Tiptap `Editor`.

The primary React component is exported as `Editor`. Do not preserve a Skriva-owned `useEditor` alias for the legacy custom runtime; unqualified `useEditor` refers to Tiptap's hook in app code.

`<Editor />` should read Tiptap document state from the live Tiptap `Editor`. When the live editor was configured with Skriva-aware Tiptap extensions, Skriva may infer visual/export coverage from their attached `.skriva` metadata. Apps may still pass an explicit `extensions` list to override or supplement inference.

`<Editor />` should not auto-load a hidden starter kit. The minimum React path may omit `extensions` only because the caller already passed Skriva-aware extensions to Tiptap.

Skriva should diagnose mismatches between provided extensions and the Tiptap extensions/schema present in the editor or headless input. For example, missing visual coverage for StarterKit document content should suggest `@openinspection/skriva/enrichments/starter`.

Missing enrichment diagnostics should have two tiers:

- Preflight diagnostics when a Tiptap extension/schema is present without matching visual enrichment.
- Content diagnostics when the document actually contains unsupported schema or style that needs visual coverage.

Under `diagnosticPolicy="error"`, content diagnostics may throw. Preflight diagnostics should remain non-throwing by default because installed-but-unused schema can be intentional.

The React component should use the same headless projection, style, layout, scene, and renderer pipeline as server/client PDF export. React is the v1 framework shell, not a separate rendering architecture. This leaves room for future framework shells such as Vue without duplicating core behavior.

## Package Boundaries

The intended package structure should make the new architecture visible before implementation work begins.

Proposed boundaries:

- `@openinspection/skriva`: the released developer-facing package and only supported app-facing API surface.
- Headless subpath: public non-React projection, Render Model, diagnostics, and shared engine APIs exposed through `@openinspection/skriva/headless`.
- Internal core/render-model package: implementation boundary for Tiptap projection, Render Model, diagnostics, and shared types.
- Style/layout/scene package: Skriva Style Engine, Layout Engine, Scene Kernel, and Document Scene Graph.
- Canvas renderer package: first-party canvas editor renderer.
- PDF renderer package: first-party native PDF renderer.
- First-party enrichment subpath exports: Tiptap repository parity coverage exposed through `@openinspection/skriva`.
- Renderer conformance package: shared tests for native and external renderer implementors.

The exact internal folder moves can happen incrementally, but new implementation should not deepen the legacy custom document authority. Internal packages may exist for development boundaries, but developers should consume Skriva through `@openinspection/skriva`.

First-party enrichments should be available as tree-shakeable subpath exports from `@openinspection/skriva`, for example:

```ts
import { Editor } from "@openinspection/skriva/editor/react";
import { StarterKit } from "@openinspection/skriva/enrichments/starter";
import { Table } from "@openinspection/skriva/enrichments/table";
```

The root `@openinspection/skriva` import should stay small and stable. Larger surfaces such as React integration, enrichment bundles, renderer APIs, and conformance utilities should use explicit subpath exports.

The shared headless engine should be public through `@openinspection/skriva/headless`; avoid using `core` as a public subpath for implementation internals.

`@openinspection/skriva/headless` should expose the shared pipeline that produces a Document Scene Graph from Tiptap document input, Tiptap extensions, enrichments, page config, fonts, and diagnostics configuration. React/canvas and PDF should consume this shared scene pipeline. The normal API should accept Tiptap extensions and derive what it needs from them; explicit schema input can exist only as an advanced escape hatch.

The public scene graph contract should be available through `@openinspection/skriva/scene`; low-level renderer construction internals should remain private until a dedicated external renderer implementor API is ready.

The enrichment authoring contract should be public through `@openinspection/skriva/enrichment`.

The Skriva Style Engine contract should be public through `@openinspection/skriva/style`. Enrichment APIs may re-export style conveniences, but the style subpath is canonical.

Document Scene Graph types and JSON fixture contracts should be public through `@openinspection/skriva/scene`. Public scene types should not imply that all internal scene construction helpers are public.

Native PDF export should be public through `@openinspection/skriva/pdf` and work in both server and client environments. It should use a shared headless model based on Tiptap document input plus Tiptap extensions, enrichments, page config, fonts, and renderer configuration, not a React component or live editor requirement. Like headless, PDF should accept Tiptap extensions directly and treat explicit schema input as an advanced escape hatch.

Renderer conformance utilities should be exposed through `@openinspection/skriva/conformance`.

Optional React devtools should be exposed through `@openinspection/skriva/devtools`.

`@openinspection/skriva/enrichments/starter` should export `StarterKit`, a Skriva-aware Tiptap extension. Broader recommended bundles should use a different name.

Individual first-party enrichment subpaths should follow Tiptap package names where practical, such as `@openinspection/skriva/enrichments/bold`, `@openinspection/skriva/enrichments/paragraph`, and `@openinspection/skriva/enrichments/table`. Bundles should compose individual enrichments rather than introduce separate semantics.

## Tiptap as Logic Layer

Tiptap is the source of truth for document state and behavior. Skriva derives a disposable render model from Tiptap state and must not mutate document state except through explicit Tiptap commands or transactions.

Skriva is prerelease, so the legacy custom document authority should be removed during the migration rather than preserved as a compatibility layer. The migration should be strict: new React and Surface Adapter code must target a real Tiptap `Editor` instead of keeping a compatibility bridge to the legacy custom runtime.

Tiptap also owns the active selection. Skriva may compute visual document positions through hit testing and caret geometry, but those positions are intermediate values that must be translated into Tiptap/ProseMirror selection transactions before they become active editor state. Selection painting reads from Tiptap state projected through the Render Model rather than from separate Skriva selection state.

Tiptap extensions own:

- schema and document semantics
- commands and command return semantics
- history, stored marks, and active selection state
- keyboard shortcuts, input rules, paste rules, and ProseMirror plugins
- collaboration and state-only behavior
- interaction semantics

Skriva enrichments do not change Tiptap behavior.

## Extension Enrichments

An enrichment attaches Skriva visual coverage to a Tiptap node or mark, normally matched by canonical Tiptap schema name.

Enrichments are strictly visual. They may contribute:

- direct style contributions
- layout and scene behavior
- hit regions and anchors
- canvas rendering through shared scene output
- native PDF export or static PDF alternatives
- visual diagnostics

They must not define editor commands, schema behavior, input behavior, or document mutations. Those belong in Tiptap extensions.

## Skriva Style Engine

The Skriva Style Engine is a constrained CSS-like engine. It borrows CSS vocabulary where useful, but only supports properties Skriva can layout and export deterministically.

Style rules:

- Styles are passed directly through Tiptap nodes, marks, and enrichments.
- Arbitrary CSS selectors and browser cascade are out of scope.
- Supported properties resolve to computed style before layout.
- Conflicts resolve by deterministic source precedence, not selector specificity.
- Unsupported properties produce visual diagnostics according to the diagnostic policy.

## Render Model

The Render Model is a disposable deterministic projection of Tiptap state plus enrichment output. It exists for layout, pagination, painting, hit testing, diagnostics, and export.

The data flow is:

```text
Tiptap Editor
  -> Tiptap State
  -> Render Model
  -> Skriva Style Engine
  -> Layout Engine
  -> Document Scene Graph
  -> Canvas Renderer / PDF Renderer
```

The Render Model is not editor state and is not a document authority.

## Layout Engine and Scene Kernel

The Layout Engine defines how the document should look. Its output is a renderer-independent Document Scene Graph.

The Scene Kernel stays small and owns cross-cutting invariants:

- page geometry, margins, fragments, and page coordinates
- text measurement contracts, line boxes, baselines, and font resolution
- flow containers and pagination boundaries
- scene node protocol: bounds, transforms, clipping, z-order, and hit regions
- anchors back to Tiptap positions
- renderer contracts and diagnostics

Document-specific capabilities should be extension-provided where practical.

## Document Scene Graph

The Document Scene Graph is the source of truth for document appearance. It should support full future parity through extensible scene nodes rather than a tiny display list or a full browser CSS engine.

If a feature changes document appearance, geometry, pagination, hit testing, or export, it belongs in the Document Scene Graph. If it only annotates or coordinates UI around existing document positions, it may remain a Document Overlay.

## Document Overlays

Comments, collaborator presence, search highlights, selection handles, suggestion popovers, and similar UI can live outside the Layout Engine when they do not change document flow or export geometry.

If an overlay needs exported representation or affects pagination/layout, the exported or geometry-affecting part becomes scene graph territory.

## Surface Adapter

Skriva uses a small Surface Adapter instead of emulating the full ProseMirror DOM `EditorView`.

The Surface Adapter is a framework-neutral module in the Editor Substrate. React wires browser events, refs, focus, and lifecycle into it, but the interaction rules should not depend on React.

The Surface Adapter implementation should live under `packages/editor/src/surface/` with small modules for the adapter interface, selection projection, clipboard adaptation, and browser input adaptation. The external seam remains `createSkrivaSurfaceAdapter`; the folder split is for implementation locality, not multiple app-facing seams.

The Surface Adapter exposes semantic visual intents rather than raw DOM events. Examples include placing or extending selection at a visual document point, selecting a word or line, inserting text, splitting a block, deleting forward or backward with a declared granularity, running a shortcut, and invoking clipboard intents. Each intent either dispatches a Tiptap command or ProseMirror transaction, or returns `false`; it never mutates a Skriva document model directly.

Formatting controls such as toggling marks, setting text style, or changing block type should stay outside the Surface Adapter. Toolbars and product UI call Tiptap commands directly, while the Surface Adapter handles surface-originated interactions.

Clipboard handling belongs behind semantic clipboard intents on the Surface Adapter, but serialization and parsing should be delegated to a Clipboard Adapter or Tiptap-owned command flow. The Surface Adapter decides when copy, cut, or paste occurs and which Tiptap selection is active; it should not own the clipboard payload format as document authority.

A Browser Input Adapter may exist behind the Surface Adapter to capture browser-native input, composition, clipboard, and focus events. A hidden textarea is an acceptable implementation detail when it has no document semantics. The Browser Input Adapter emits semantic intents and must not become a public seam or a second editor authority.

Hidden or offscreen `EditorView` reuse is outside the v1 core contract. It may be revisited as a future experiment but must not become a second document authority.

## Renderer Implementations

The only first-party v1 renderers are:

- canvas editor rendering
- native PDF export

Renderers must consume Layout Engine scene geometry rather than redefining document layout. Canvas and PDF may render different internals for dynamic content, but they must consume the same outer geometry so pagination and layout do not drift.

WebGL and other render targets are out of v1 first-party scope.

## Native PDF Export

PDF parity includes structural behavior, not only visual similarity.

Native PDF export must:

- preserve selectable/searchable text
- use native PDF text/vector/image/link primitives
- avoid rasterizing canvas pages as document export
- preserve layout footprint for dynamic or interactive content
- include link annotations or other structural PDF features where relevant

Interactive or dynamic document content needs a Static PDF Alternative. For example, a YouTube embed may render as a live preview in the editor and as a same-footprint thumbnail plus clickable link in PDF.

Export should fail for document content when native PDF coverage or a required Static PDF Alternative is missing.

## Diagnostics

Visual diagnostics surface missing or unexpected visual coverage without surprising developers in production.

Default policy:

- warn in development
- off in production unless the app opts in
- configurable by implementers
- support stricter error reporting
- allow intentional suppression for known fallbacks
- log by default in development and expose diagnostics through an app callback

Diagnostics should be based primarily on actual document content, with optional extension-level preflight hints.

Missing-enrichment diagnostics should name the Tiptap package or schema name and suggest the matching `@openinspection/skriva` subpath import when one exists.

`onDiagnostic` should fire once per stable issue by default, keyed by diagnostic code plus relevant Tiptap package, schema name, path, or feature identity. Diagnostics should not repeat on every render/projection pass.

Example:

```tsx
<Editor
  editor={editor}
  diagnosticPolicy="warn"
  onDiagnostic={(diagnostic) => {
    reportDiagnostic(diagnostic);
  }}
/>
```

The v1 API should start with an editor-wide diagnostic policy. Per-diagnostic or per-enrichment suppression can be added later if real usage shows it is needed.

The v1 policy values are:

```ts
type DiagnosticPolicy = "off" | "warn" | "error";
```

`onDiagnostic` observes diagnostics; `diagnosticPolicy` controls default handling.

The default policy should be `"warn"` in development and `"off"` in production. Apps can still collect production diagnostics by providing `onDiagnostic`; policy controls default handling, while the callback controls observation.

When `diagnosticPolicy` is `"error"`, deterministic configuration or document-content diagnostics may throw during projection/render setup. Runtime recoverable diagnostics should still be reported without crashing the editor.

Missing native PDF coverage or a missing required Static PDF Alternative for document content is a deterministic content diagnostic. Under `"error"`, it should fail before export and preferably during projection/render setup.

## Devtools

Skriva should provide an optional React debug component inspired by TanStack Query Devtools:

```tsx
import { SkrivaDevtools } from "@openinspection/skriva/devtools"

<Editor editor={editor} />
<SkrivaDevtools editor={editor} />
```

Devtools should be optional and dev-oriented so production bundles do not need to include them.

`SkrivaDevtools` should auto-discover nearby Skriva editor context when available. Explicit props should remain available for tests and unusual app layouts.

The underlying debug snapshot should come from `@openinspection/skriva/headless`; React devtools should render that data rather than owning the debug model.

Headless debug snapshots should be JSON-serializable so they can be used in tests, CI artifacts, server logs, and bug reports. Large assets should be referenced by stable IDs rather than embedded.

Debug snapshots should support privacy modes. Devtools may show document content by default in the local interactive panel, but log/export snapshots should redact text content unless explicitly enabled.

Redacted snapshots should preserve text lengths or equivalent metadata, layout boxes, page breaks, style, geometry, diagnostics, and coverage data so debugging remains useful without exposing document text.

The redacted debug snapshot can evolve into a first-class bug report artifact format for layout and renderer issues, but that should not block v1.

Useful panels include:

- installed Tiptap extensions and schema
- matched and missing enrichments
- diagnostics grouped by preflight, content, and runtime
- current selection, anchors, and hit regions
- page geometry and pagination stats
- selected page or node scene graph
- renderer capabilities and native PDF coverage
- projection, layout, and render timings
- export readiness, including missing Static PDF Alternatives

## Renderer Conformance

Skriva should provide a renderer conformance suite for native and external renderer implementors.

Visual-required enrichments need:

- geometry parity tests for page breaks, boxes, anchors, and outer dimensions
- native PDF structure tests where practical, such as selectable text or link annotations
- diagnostics for missing renderer support

Renderer conformance should include diagnostic behavior for unsupported scene nodes, unsupported style properties, missing native PDF coverage, and missing Static PDF Alternatives.

Conformance fixtures should be split:

- Scene Graph fixtures for renderer contract tests, suitable for external renderer implementors without requiring Tiptap.
- Tiptap-state fixtures for Skriva full-pipeline tests from editor state through style, layout, scene, canvas, and PDF.

Scene Graph conformance fixtures should be JSON-serializable. Non-JSON resources such as fonts, images, or binary assets should be referenced by stable IDs or fixture manifests.

The runtime Document Scene Graph should be serializable by design where practical, but it may use richer internal objects for performance. The public conformance format is the JSON-serializable contract.

External renderers may declare partial support levels such as full, preview-only, non-exporting, or experimental. First-party renderers in the repository should be fully compatible.

## Tiptap Repository Parity

Skriva v1 targets the local `tiptap/` repository snapshot. Every package under `tiptap/packages` should be classified in the parity inventory as visual-required, state-only, ui-overlay, react-runtime, runtime, serialization, bundle, out-of-scope-framework, or unknown-needs-triage.

Skriva v1 should ship first-party enrichments for every visual-required package in the supported React scope. State-only packages should work through Tiptap without fake visual enrichments. Vue-specific packages are out of v1 scope.

## Definition of Done

A visual feature is v1-complete when:

- it is classified in the Tiptap parity inventory
- it has Tiptap state projection coverage
- it has direct style and scene behavior where needed
- it has geometry parity tests
- it has native PDF export coverage or a required Static PDF Alternative
- it emits diagnostics for missing coverage
- it preserves deterministic pagination and layout
