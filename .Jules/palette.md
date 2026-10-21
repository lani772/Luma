## 2025-05-20 - Icon-Only Action Buttons in Device Cards
**Learning:** Icon-only toggle buttons in device cards lack screen reader context and mouse hover feedback unless explicitly labeled with dynamic status (`Turn [Device Name] on/off`).
**Action:** Always complement icon-only buttons with explicit `type="button"`, dynamic `aria-label`, and `title` attributes incorporating the entity's name and target state.
