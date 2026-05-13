# Use a Surface Adapter Instead of ProseMirror DOM View Emulation

Skriva will use a small surface adapter to translate canvas events, hit regions, and document positions into Tiptap-compatible interactions instead of emulating ProseMirror's DOM `EditorView`. Tiptap remains the logic layer for state, commands, plugins, and interaction semantics, while Skriva owns pagination, layout, painting, and export. This avoids rebuilding a contenteditable DOM editor inside the canvas layer while still covering the common interaction surface needed for paginated editing.

**Considered Options**

- Use `prosemirror-view` directly or through a hidden/offscreen view to reuse its DOM event handling.
- Build a focused Skriva surface adapter that forwards only the interaction primitives Skriva can represent deterministically.

**Consequences**

Skriva will not promise universal ProseMirror view/plugin compatibility. Tiptap extensions that depend on DOM node views or full `EditorView` behavior may need Skriva visual enrichments or adapter-specific integration points.

Hidden or offscreen `EditorView` reuse is outside the Stage 0 core contract. It may be revisited as a future experiment for edge-case compatibility, but it must not become a second document authority.
