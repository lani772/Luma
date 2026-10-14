## 2025-05-20 - Custom Pressable Toggle Switch Accessibility Semantics
**Learning:** Custom toggle switch components built with `Pressable` in React Native / Expo Web often lack native switch semantics, preventing screen readers from correctly announcing role, state (checked/disabled), and accessible labels.
**Action:** Always provide `accessibilityRole="switch"`, `accessibilityState={{ checked, disabled }}`, `accessibilityLabel`, and web `aria-*` attributes (`aria-checked`, `aria-disabled`, `aria-label`) on custom `Pressable` switch components.
