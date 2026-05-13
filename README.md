# Skriva

Skriva is a React-targeted, canvas/PDF-first visual representation layer for Tiptap state. Tiptap owns the logic layer: editor state, schema, commands, plugins, and interactions. Skriva owns deterministic pagination, layout, canvas rendering, PDF export, hit regions, and visual diagnostics.

The v1 direction is to render normal Tiptap editors through a small public API:

```tsx
<SkrivaEditor editor={editor} enrichments={enrichments} />
```

Skriva enrichments add visual coverage for Tiptap nodes and marks without changing Tiptap behavior. The layout engine is the source of truth for how a document should look, and native renderers such as canvas and PDF implement that output.

## Documentation

- [Domain language](./CONTEXT.md)
- [V1 architecture spec](./docs/v1-architecture-spec.md)
- [Editor parity roadmap](./docs/editor-parity-roadmap.md)
- [Tiptap parity inventory](./docs/tiptap-parity-inventory.md)
- [Architecture decisions](./docs/adr/)

## Validation

After changing editor behavior, run:

- `vp install` after pulling remote changes
- `vp check`
- `vp test`
- Any relevant `vite.config.ts` tasks or `package.json` scripts via `vp run <script>`
- Browser renderer comparisons when layout, selection painting, pagination, fonts, canvas, or PDF output changes
