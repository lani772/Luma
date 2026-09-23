## 2025-03-08 - Icon-Only Action Buttons in Cards
**Learning:** Icon-only action buttons embedded inside clickable cards (like device cards or scene cards) require descriptive `aria-label`s specifying the target entity name and action (e.g. `Turn Living Room Lamp off`) to give clear context to screen reader users, along with explicit hover tooltips (`title`) and `focus-visible` outline rings for keyboard navigation.
**Action:** Always complement icon buttons within card components with dynamic `aria-label`, `title`, and `focus-visible:ring-2` styles.
