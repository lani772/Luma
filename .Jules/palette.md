# Palette's Journal - Critical UX & Accessibility Learnings

## 2025-05-18 - Accessibility for Dashboard Card Action Triggers
**Learning:** Icon-only action buttons inside dashboard cards (such as quick power toggles or collapse triggers) frequently omit ARIA state attributes (`aria-label`, `aria-pressed`, `aria-expanded`). Without dynamic descriptive labels and state markers, screen reader users cannot determine what target component is being controlled or whether the toggle is currently active.
**Action:** Always complement icon-only buttons with contextual dynamic labels (e.g., `aria-label={`Turn ${device.name} ${device.on ? 'off' : 'on'}`}`) and state indicators (`aria-pressed`, `aria-expanded`, `focus-visible:ring-*`).
