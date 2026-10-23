## 2025-05-18 - Smart Home Interactive Control Accessibility

**Learning:** Icon-only toggle buttons on device cards and mobile navigation toggles lack screen reader context and focus visible indicators by default, causing accessibility gaps for keyboard and screen reader users.
**Action:** Always provide `aria-label` with state context (e.g., `currently on/off`), `aria-pressed` or `aria-expanded`, tooltip `title`, and explicit `focus-visible` ring styles for all icon-only control buttons.
