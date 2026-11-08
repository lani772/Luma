## 2026-07-20 - Contextual Labels and Focus Visibility on Interactive Action Cards

**Learning:** In reusable cards (such as SceneCard or DeviceCard), generic titles like "Edit scene" or "Activate scene" on icon-only buttons create confusion when multiple cards are rendered on the same screen. Screen reader users hear repetitive identical buttons without knowing which entity is affected. Furthermore, without explicit focus-visible ring styles, keyboard navigation fails to provide clear visual cues on dark UI surfaces.
**Action:** Always provide dynamic contextual `aria-label` attributes incorporating the entity name (e.g., `aria-label={\`Activate \${name} scene\`}`), mark inner icons with `aria-hidden="true"`, and apply `focus-visible:outline-none focus-visible:ring-2` styling.
