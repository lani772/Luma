## 2026-10-26 - Accessible Mobile Drawer Navigation Controls
**Learning:** Icon-only mobile navigation toggles without dynamic ARIA labels and focus indicators prevent screen reader and keyboard users from identifying the menu state or controlling the drawer.
**Action:** Always provide dynamic `aria-label` ("Open navigation menu" / "Close navigation menu"), `aria-expanded`, and `aria-controls` linking to the drawer's `id`, along with `focus-visible` ring styling on icon-only toggle buttons.
