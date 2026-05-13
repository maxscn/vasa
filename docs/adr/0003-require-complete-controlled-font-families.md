# Require Complete Controlled Font Families

Skriva-controlled Google font families will be validated against a checked-in manifest before rendering. A controlled family is usable only when every Google Fonts face in the manifest for that family is registered with real font data. Missing faces fail immediately during font catalog or render profile creation.

The Skriva Style Engine must resolve text to an actual registered font face before layout. Renderer implementations must not synthesize missing bold, italic, or bold-italic geometry through embolden, skew, nearest-face fallback, or other renderer-local approximation.

**Considered Options**

- Allow partial families and synthesize missing bold or italic geometry in canvas/PDF renderers.
- Allow partial families but surface a visual diagnostic before rendering or export.
- Require complete controlled font families and fail immediately when the manifest and registered fonts disagree.

**Consequences**

PDF parity is protected by making font face resolution deterministic before layout. Layout, canvas, and PDF consume the same real font face, metrics, and outline data instead of rediscovering or approximating style per renderer.

Skriva's local font assets and editor font configuration must either register the complete manifest face set for a controlled Google font family or stop exposing that family as controlled. System and native fallback fonts may still exist outside this controlled Google font contract, but they must not be treated as complete controlled families.

This decision makes configuration stricter and may require adding more checked-in font files, but it concentrates font completeness errors at the Font Catalog seam instead of letting visual drift appear later in renderer output.
