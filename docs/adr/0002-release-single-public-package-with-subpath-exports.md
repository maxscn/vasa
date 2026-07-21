# Release a Single Public Package With Subpath Exports

Skriva will expose `@openinspection/skriva` as the released developer-facing package and the only supported app-facing API surface. Internal packages may exist for implementation boundaries, but React integration, first-party enrichments, renderer APIs, and conformance utilities should be exposed through explicit subpath exports instead of separate public packages.

**Considered Options**

- Publish separate public packages for each internal module and enrichment.
- Publish one public package with tree-shakeable subpath exports.

**Consequences**

The root `@openinspection/skriva` import should stay small and stable, while larger surfaces use explicit subpaths such as `@openinspection/skriva/editor/react`, `@openinspection/skriva/pdf`, `@openinspection/skriva/scene`, and `@openinspection/skriva/enrichments/starter`. The primary React editor component is exported as `Editor` from `@openinspection/skriva/editor/react` even though React is the only v1 framework target. First-party public enrichment exports are Skriva-aware Tiptap extensions, so apps can pass the same objects to Tiptap and Skriva can read attached visual/export metadata. Internal package boundaries can change without becoming consumer-facing API.
