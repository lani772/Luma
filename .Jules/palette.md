# Palette's Journal - Critical Learnings

## 2025-05-18 - Icon-Only Toggle Buttons in Card Components
**Learning:** Icon-only toggle buttons embedded inside interactive card containers require explicit `aria-label`, `title`, and `aria-pressed` states so screen reader users understand the exact action and current state without triggering the parent container navigation.
**Action:** Always provide explicit `aria-label`, `title`, `aria-pressed`, and visible focus rings (`focus-visible:ring-2`) on nested action buttons inside card links.
