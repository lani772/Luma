## 2025-05-18 - Icon-Only Card Action Controls Accessibility

**Learning:** Interactive icon-only buttons in card headers (e.g. device toggle switches) lack accessible names (`aria-label`) and visual keyboard focus rings (`focus-visible:ring-*`), rendering them invisible or ambiguous for screen readers and keyboard-only users.
**Action:** Always complement icon-only buttons with dynamic `aria-label`s reflecting target entity states (e.g., `Turn off [Name]`), hover `title` tooltips, and explicit `focus-visible` outline rings.
