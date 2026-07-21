# Skriva

Skriva is a React-targeted, canvas/PDF-first visual representation layer for Tiptap state. Tiptap owns the logic layer: editor state, schema, commands, plugins, and interactions. Skriva owns deterministic pagination, layout, canvas rendering, PDF export, hit regions, and visual diagnostics.

The v1 direction is to render normal Tiptap editors through a small public API:

```tsx
import { useEditor } from "@tiptap/react";
import { Editor } from "@openinspection/skriva/editor/react";
import { StarterKit } from "@openinspection/skriva/enrichments/starter";

const extensions = [StarterKit];
const editor = useEditor({ extensions });

<Editor editor={editor} />;
```

Skriva-aware Tiptap extensions are normal Tiptap extensions with hidden Skriva visual/export metadata. Tiptap owns behavior; Skriva reads the metadata to add deterministic pagination, canvas rendering, and native PDF export.

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
