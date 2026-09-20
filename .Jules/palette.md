# Palette's Journal - Critical Learnings

## 2025-05-15 - Icon-only device toggle buttons require explicit ARIA attributes and color theme safety
**Learning:** Icon-only toggle buttons on interactive device cards in Next.js/React components can lack semantic labels and focus indicators, preventing screen reader and keyboard accessibility. Additionally, theme object properties like `COLORS.textMuted` must be accurately referenced to maintain type safety and visual hierarchy.
**Action:** Always provide `aria-label`, `aria-pressed`, `title`, and `focus-visible` ring utilities on interactive icon buttons.
