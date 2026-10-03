## 2025-05-18 - Accessibility for Icon-Only Dashboard Buttons
**Learning:** Icon-only interactive buttons (such as device toggles and mobile nav menu toggles) lack screen reader accessible context and focus indicators when using basic HTML `<button>` elements wrapped inside cards or headers.
**Action:** Always include explicit `aria-label`, state indicators (`aria-pressed` or `aria-expanded`), hover `title` tooltips, and keyboard focus visible rings (`focus-visible:ring-2`) on icon-only buttons.
