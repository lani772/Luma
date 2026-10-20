# Palette's UX & Accessibility Journal

## 2025-05-18 - Mobile Navigation Toggle Accessibility

**Learning:** Icon-only overlay toggles (such as mobile sidebar navigation buttons) lack semantic screen reader labels and expanded state indicators unless explicit `aria-label` and `aria-expanded` attributes are provided.
**Action:** Always specify dynamic `aria-label` ("Open..." vs "Close...") and `aria-expanded` attributes along with `type="button"` on icon-only menu triggers.
