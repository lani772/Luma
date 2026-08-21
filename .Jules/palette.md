# Palette's UX & Accessibility Journal

## 2025-05-20 - Responsive Sidebar Toggle Accessibility
**Learning:** Icon-only toggle buttons for responsive sidebars require dynamic `aria-label` values reflecting state (e.g., 'Open navigation menu' vs 'Close navigation menu') alongside explicit `focus-visible` ring indicators for proper screen reader and keyboard accessibility.
**Action:** Always verify icon-only toggle buttons have dynamic `aria-label`s and `focus-visible:ring-2` styles.
