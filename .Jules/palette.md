## 2025-03-02 - Icon-Only Toggle Buttons in Cards and Navigation Drawers
**Learning:** Interactive icon-only buttons (such as quick-toggle buttons on device cards and mobile navigation menu toggles) are inaccessible to screen reader users and keyboard-only users when missing `aria-label`, `aria-expanded`/`aria-controls`, and visible focus rings (`focus-visible:ring-2`).
**Action:** Always provide descriptive dynamic `aria-label`s (e.g. `Turn off Lamp`), state indicators (`aria-expanded`), and explicit `focus-visible` ring styles on all icon-only button elements.
