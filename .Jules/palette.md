## 2025-05-18 - Accessible Icon Toggle Buttons on Device Cards
**Learning:** Icon-only action buttons (e.g. lightbulb toggle on device cards) in IoT dashboards present major screen reader and keyboard accessibility gaps if missing `aria-label`, visible focus rings, and disabled states for offline devices.
**Action:** Always provide dynamic `aria-label` and `title` attributes reflecting device state, focus-visible outline indicators for keyboard users, and explicit `disabled` attributes when device is offline.
