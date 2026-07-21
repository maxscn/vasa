# Use a Headless Interaction Layer for Deterministic Editing

Skriva will route UI-driven navigation and editing through a pure, package-shaped Headless Interaction Layer that reduces Headless Editor State from normalized interactions. Headless Editor State wraps Tiptap editor state, Skriva visual interaction context, and pending side effects, so tests can assert `state + interaction = next state` while Tiptap remains the document and selection authority.

**Considered Options**

- Keep keyboard and pointer behavior distributed across React handlers, keymap routing, interaction helpers, and Surface Adapter commands.
- Extract a pure Headless Interaction Layer inside `packages/editor`, then consider a workspace package or public headless export only after the boundary stabilizes.

**Consequences**

The layer may depend on visual context such as render lines, page geometry, hit regions, and text measurement, but it must stay independent of React, DOM events, and app shell code. Its API should use a generic interaction union from the start, with keyboard interactions implemented first and pointer/clipboard interactions added as later variants. The returned state should keep document and selection in ProseMirror/Tiptap-native state wherever possible, using Skriva visual selections as intermediate context rather than as the primary output authority. Interaction tests should assert deterministic next Headless Editor State rather than relying primarily on browser-level event delivery. Extension-owned shortcuts such as bold and italic may delegate to Tiptap internally, but the returned Headless Editor State should reflect the applied Tiptap state so formatting behavior remains directly testable.
