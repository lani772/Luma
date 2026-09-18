## 2025-02-18 - Accessibility on Icon-Only Buttons in Next.js Cards
**Learning:** Icon-only buttons (such as device power toggles, edit buttons, and mobile menu triggers) lack accessible names by default, rendering them unannounced or ambiguous to screen readers and keyboard users.
**Action:** Always provide explicit `aria-label`, state-aware attributes (`aria-pressed`, `aria-expanded`), hover tooltips (`title`), and explicit focus rings (`focus-visible:ring-2 focus-visible:ring-primary-blue`) on icon-only interactive elements.
