# Palette's Journal - Critical UX & Accessibility Learnings

## 2025-05-18 - Accessible Mobile Navigation Toggle
**Learning:** Icon-only navigation toggle buttons on mobile views frequently lack proper `aria-label`, `aria-expanded`, and `aria-controls` attributes, leaving screen reader users without state or target context when opening or closing drawers/sidebars.
**Action:** Always complement mobile icon buttons (`<Menu />`, `<X />`) with dynamic `aria-label`, `aria-expanded={isOpen}`, and `aria-controls={targetId}` attributes linked to the target container.
