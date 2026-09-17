## 2025-03-05 - Accessible Switch Semantics for Quick-Toggle Card Actions
**Learning:** Icon-only toggle buttons embedded in clickable cards (like device cards) leave screen readers without context about which specific device is being toggled or whether the button is currently in an active or inactive state.
**Action:** Always supply `role="switch"`, `aria-checked`, a device-specific `aria-label`, a visible hover/focus tooltip (`title`), and `focus-visible` outline styles on card quick-toggle buttons.
