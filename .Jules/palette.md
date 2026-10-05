## 2026-03-31 - Mobile Navigation Toggle Accessibility
**Learning:** Icon-only mobile navigation buttons should include dynamic `aria-label`, `aria-expanded`, and `aria-controls` referencing the target navigation container `id` to ensure screen reader users can navigate responsive sidebars.
**Action:** Always verify mobile overlay toggles have `type="button"`, dynamic `aria-label` (e.g. Open/Close menu), `aria-expanded`, and explicit `aria-controls`.
