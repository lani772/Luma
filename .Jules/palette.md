## 2025-02-28 - Custom Pressable Toggle Switch Accessibility
**Learning:** Custom React Native/Expo Web switch components built with `Pressable` lack default screen reader semantics and web ARIA states unless explicitly mapped.
**Action:** Always provide `accessibilityRole="switch"`, `accessibilityState={{ checked, disabled }}`, `accessibilityLabel`, and web attributes (`aria-checked`, `aria-disabled`, `aria-label`) on `Pressable` toggle components.
