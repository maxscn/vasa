# Tiptap Parity Inventory

Skriva v1 targets React and uses the local `tiptap/` repository snapshot as the Tiptap parity source. This inventory classifies the packages under `tiptap/packages` by the kind of Skriva coverage they need.

This is a first-pass planning inventory. Packages marked `unknown-needs-triage` or carrying notes should be checked against their source before implementation work is scheduled.

## Coverage Categories

**visual-required**:
The package introduces document semantics that need Skriva visual coverage through style, layout, scene, canvas, native PDF export, diagnostics, or static PDF alternatives. Native PDF export is required by default for document content.

Visual-required packages need geometry parity tests for page breaks, boxes, anchors, and outer dimensions. Text-bearing or interactive packages also need native PDF structure tests where practical.

**state-only**:
The package manages editor state, metadata, collaboration, commands, or file handling without requiring document rendering of its own.

**ui-overlay**:
The package provides UI around document positions. Skriva may need overlay or surface-adapter support, but the feature is not necessarily part of core document layout.

**react-runtime**:
The package is part of the React integration target.

**runtime**:
The package is a Tiptap/ProseMirror runtime dependency rather than a document feature.

**serialization**:
The package parses, serializes, or statically renders editor content.

**bundle**:
The package groups other Tiptap packages.

**out-of-scope-framework**:
The package targets a non-React framework and is outside v1 scope.

**unknown-needs-triage**:
The package needs source inspection before Skriva can classify its coverage.

## Inventory

| Package                          | Category               | Skriva v1 note                                                                                 |
| -------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| `core`                           | runtime                | Tiptap logic-layer dependency.                                                                 |
| `pm`                             | runtime                | ProseMirror dependency bundle.                                                                 |
| `react`                          | react-runtime          | Primary v1 app integration target.                                                             |
| `vue-2`                          | out-of-scope-framework | Skriva v1 targets React.                                                                       |
| `vue-3`                          | out-of-scope-framework | Skriva v1 targets React.                                                                       |
| `extensions`                     | bundle                 | Track through the packages it re-exports.                                                      |
| `starter-kit`                    | bundle                 | Track through included extensions.                                                             |
| `html`                           | serialization          | Needs compatibility tests where used for import/export.                                        |
| `markdown`                       | serialization          | Needs compatibility tests where markdown is supported.                                         |
| `static-renderer`                | serialization          | Useful comparison/reference for non-editable rendering.                                        |
| `suggestion`                     | ui-overlay             | Likely adapter/overlay support rather than scene layout.                                       |
| `extension-audio`                | visual-required        | Media node visual coverage plus static PDF alternative preserving pagination/layout footprint. |
| `extension-blockquote`           | visual-required        | Block layout, style, pagination, canvas/PDF.                                                   |
| `extension-bold`                 | visual-required        | Mark style contribution.                                                                       |
| `extension-bubble-menu`          | ui-overlay             | UI layer around selection; not core document layout.                                           |
| `extension-bullet-list`          | visual-required        | List layout and pagination.                                                                    |
| `extension-code`                 | visual-required        | Mark style contribution and font policy.                                                       |
| `extension-code-block`           | visual-required        | Block layout, whitespace, font policy.                                                         |
| `extension-code-block-lowlight`  | visual-required        | Code block plus syntax styling.                                                                |
| `extension-collaboration`        | state-only             | Yjs/collaboration state, no visual enrichment by itself.                                       |
| `extension-collaboration-caret`  | ui-overlay             | Presence/caret overlay around document positions.                                              |
| `extension-color`                | visual-required        | Text style contribution.                                                                       |
| `extension-details`              | visual-required        | Disclosure-like document structure needs layout policy.                                        |
| `extension-document`             | visual-required        | Root document semantics.                                                                       |
| `extension-drag-handle`          | ui-overlay             | Surface adapter/overlay support.                                                               |
| `extension-drag-handle-react`    | ui-overlay             | React UI integration around drag handles.                                                      |
| `extension-drag-handle-vue-2`    | out-of-scope-framework | Skriva v1 targets React.                                                                       |
| `extension-drag-handle-vue-3`    | out-of-scope-framework | Skriva v1 targets React.                                                                       |
| `extension-emoji`                | visual-required        | Inline content/rendering and font fallback policy.                                             |
| `extension-file-handler`         | state-only             | File handling behavior; visual coverage depends on inserted nodes.                             |
| `extension-floating-menu`        | ui-overlay             | UI layer around selection; not core document layout.                                           |
| `extension-font-family`          | visual-required        | Text style contribution and font resolution.                                                   |
| `extension-hard-break`           | visual-required        | Inline line-break layout behavior.                                                             |
| `extension-heading`              | visual-required        | Block style, outline semantics, pagination.                                                    |
| `extension-highlight`            | visual-required        | Mark background/decoration style.                                                              |
| `extension-horizontal-rule`      | visual-required        | Atomic block scene node and export coverage.                                                   |
| `extension-image`                | visual-required        | Image layout, sizing, hit regions, export.                                                     |
| `extension-invisible-characters` | ui-overlay             | Visual aid likely overlay/editor-only; export policy needed.                                   |
| `extension-italic`               | visual-required        | Mark style contribution and font resolution.                                                   |
| `extension-link`                 | visual-required        | Mark style plus PDF/link annotation coverage.                                                  |
| `extension-list`                 | visual-required        | Shared list primitives and commands through Tiptap.                                            |
| `extension-mathematics`          | visual-required        | Math scene/layout/export coverage.                                                             |
| `extension-mention`              | visual-required        | Inline atom/mark rendering plus suggestion UI integration.                                     |
| `extension-node-range`           | state-only             | Selection/range utility unless it introduces visible state.                                    |
| `extension-ordered-list`         | visual-required        | List layout and numbering.                                                                     |
| `extension-paragraph`            | visual-required        | Core block flow.                                                                               |
| `extension-strike`               | visual-required        | Mark decoration style and font metric policy.                                                  |
| `extension-subscript`            | visual-required        | Mark style, baseline shift, font metrics.                                                      |
| `extension-superscript`          | visual-required        | Mark style, baseline shift, font metrics.                                                      |
| `extension-table`                | visual-required        | Table layout, pagination, editing surface geometry, export.                                    |
| `extension-table-of-contents`    | visual-required        | Document-generated block/list semantics; source inspection needed.                             |
| `extension-text`                 | visual-required        | Core inline text semantics.                                                                    |
| `extension-text-align`           | visual-required        | Block style contribution.                                                                      |
| `extension-text-style`           | visual-required        | Shared mark style carrier.                                                                     |
| `extension-twitch`               | visual-required        | Embed/media scene node plus static PDF alternative preserving pagination/layout footprint.     |
| `extension-typography`           | state-only             | Input rules/transform behavior; visual output handled by resulting text.                       |
| `extension-underline`            | visual-required        | Mark decoration style and font metric policy.                                                  |
| `extension-unique-id`            | state-only             | Metadata/state; useful for anchors but not visual itself.                                      |
| `extension-youtube`              | visual-required        | Embed/media scene node plus static PDF alternative preserving pagination/layout footprint.     |

## Open Classification Questions

- `extension-invisible-characters` may be a document overlay rather than `ui-overlay`; decide whether its symbols can be exported or are editor-only.
- `extension-table-of-contents` may require generated content, anchors, links, and pagination-aware updates; inspect before assigning implementation scope.
- Media/embed packages need static PDF alternatives, such as thumbnails with link annotations, that preserve the same pagination/layout footprint.
- `extension-typography` should stay state-only if it only transforms text, but tests should verify the resulting text and marks render normally.
