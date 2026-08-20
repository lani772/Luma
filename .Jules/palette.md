## 2025-05-20 - Accessible Action Triggers on Interactive Cards
**Learning:** Icon-only action buttons embedded within clickable card links (e.g. device power toggles) must have explicit dynamic `aria-label` and `title` attributes along with clear `focus-visible` ring indicators so screen readers and keyboard users can discern the exact target and state of the action.
**Action:** Always provide explicit action context in `aria-label` (e.g. `Turn off Living Room Lamp`) and visible focus states when creating interactive buttons inside clickable list/card components.
