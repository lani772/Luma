## 2025-05-18 - Custom Switch Toggle Accessibility in React Native/Expo Web
**Learning:** Custom `Pressable` toggle components lack inherent screen reader roles (`switch`) and state indicators (`checked`, `disabled`), causing screen readers to read them as plain unlabelled pressable elements.
**Action:** Always provide `accessibilityRole="switch"`, `accessibilityState={{ checked, disabled }}`, `accessibilityLabel`, and `aria-*` attributes (`aria-checked`, `aria-disabled`, `aria-label`) on custom `Pressable` switches.
