# Release a Single Public Package With Subpath Exports

Skriva will expose `@opeinspection/skriva` as the released developer-facing package and the only supported app-facing API surface. Internal packages may exist for implementation boundaries, but React integration, first-party enrichments, renderer APIs, and conformance utilities should be exposed through explicit subpath exports instead of separate public packages.

**Considered Options**

- Publish separate public packages for each internal module and enrichment.
- Publish one public package with tree-shakeable subpath exports.

**Consequences**

The root `@opeinspection/skriva` import should stay small and stable, while larger surfaces use explicit subpaths such as `@opeinspection/skriva/react` and `@opeinspection/skriva/enrichments/starter`. `<SkrivaEditor />` comes from `@opeinspection/skriva/react` even though React is the only v1 framework target. Internal package boundaries can change without becoming consumer-facing API.
