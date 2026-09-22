# Palette's Journal - Critical UX & Accessibility Learnings

## 2025-03-02 - Accessible Icon-Only Action Buttons in Composite Controls
**Learning:** Icon-only action buttons embedded within complex UI components (such as device card controls or mobile navigation toggles) often omit explicit `type="button"`, `aria-label`, `aria-expanded`, `title` tooltips, and keyboard focus states. Screen reader users cannot discern the action without descriptive labels, and keyboard navigators lack visual feedback.
**Action:** Always provide `type="button"`, dynamic `aria-label`s, `title` tooltips, state-aware attributes (`aria-expanded`), and clear `focus-visible:ring-2` focus rings on icon-only buttons.
