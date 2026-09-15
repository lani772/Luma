## 2025-05-18 - Icon-Only Toggle Buttons inside Interactive Cards
**Learning:** Icon-only action buttons embedded within card components (like device power toggles inside clickable card links) lack accessible text for screen readers and focus rings for keyboard navigation.
**Action:** Always add `type="button"`, dynamic `aria-label` describing the specific action and target name (e.g., `Turn off Living Room Light`), `aria-pressed`, `title` tooltip, and `focus-visible:ring-2` to nested icon buttons.
