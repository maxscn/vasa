<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.

<!--VITE PLUS END-->

## Learned User Preferences

- Prefer formal/spec-based regression tests over visual guessing for text, font rendering, and inline mark boundary issues (e.g. bold/italic collisions).

## Learned Workspace Facts

- `@openinspection/skriva` is the intended tree-shakeable public package; other workspace packages are internal and the main package re-exports what `apps/web` needs.
- PDF and canvas parity is a core rendering goal; use shared outline-aware inline measurement and paint data (including synthetic bold/italic), not per-target padding or browser measurement APIs.
- Text mark styling belongs in `packages/editor` extensible stylesheet/style resolvers before layout/Pretext; metrics-affecting styles must not live only in canvas/PDF paint paths.
- Font mark geometry should use font metadata such as `OS/2` and `post` tables when available for strikethrough, underline, subscript, superscript, and italic.
- New page breaks in the editor/web should preserve the current font instead of resetting to the default.
- Native editor behavior belongs in `packages/editor`: text style resolution, mark semantics, default DOM-like editing behavior, font/measurement policy, and canvas/PDF paint resolvers should be package defaults, not reimplemented per app. App packages such as `apps/web` should focus on actual UI composition, configuration, routing, and product-specific shell behavior.
- When a Tiptap/ProseMirror parity matrix item in `README.md` is completed, update the matrix and staged roadmap in the same change so the documented status stays current.

## Agent skills

### Issue tracker

Issues and PRDs are tracked as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default five-label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses a multi-context layout, with `CONTEXT-MAP.md` at the repo root pointing to context-specific docs. See `docs/agents/domain.md`.
