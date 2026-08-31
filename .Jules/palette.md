## 2025-08-31 - Icon-Only Toggle Buttons in Device Cards
**Learning:** Icon-only toggle buttons in device cards lack screen-reader context and visible focus indicators for keyboard navigation.
**Action:** Always include a dynamic `aria-label` and `title` tooltip (e.g. `Turn off ${device.name}`) and focus ring classes (`focus-visible:ring-2 focus-visible:ring-primary-blue focus-visible:outline-none`) on icon-only interactive elements.
