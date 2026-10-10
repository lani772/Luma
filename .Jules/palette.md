## 2025-05-18 - Icon-Only Toggle Buttons in Card Components
**Learning:** Icon-only interactive buttons nested inside card controls (like device toggles or mobile sidebar triggers) frequently lack explicit ARIA labels (`aria-label`, `aria-pressed`) and `focus-visible` focus indicators, rendering them unusable for screen reader and keyboard-only users.
**Action:** Always complement icon-only buttons with dynamic `aria-label`, stateful `aria-pressed` / `aria-expanded`, visual tooltip `title`, and `focus-visible:ring-2` focus rings.
