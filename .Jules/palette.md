# Palette Journal - Critical UX & Accessibility Learnings

## 2025-05-20 - Icon-Only Card Action & Navigation Toggles
**Learning:** Icon-only interactive buttons (such as light toggle switches on device cards and mobile navigation toggles) lack accessible names for screen readers and missing keyboard focus state feedback without explicit `aria-label`, state descriptors (`aria-pressed`/`aria-expanded`), and `focus-visible` styling.
**Action:** Always complement icon-only buttons with explicit `type="button"`, `aria-label`, toggle state attributes, title tooltips, and visible `focus-visible` focus rings.
