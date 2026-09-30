## 2025-05-20 - Custom React Native Pressable Switch Accessibility
**Learning:** Custom toggle switch components built with React Native `Pressable` lack native screen reader switch traits and web ARIA attributes by default, making them invisible or unannounced as toggles to assistive technologies.
**Action:** Always provide `accessibilityRole="switch"`, `accessibilityState={{ checked, disabled }}`, `accessibilityLabel`, and `aria-*` web fallback attributes (`aria-checked`, `aria-disabled`, `aria-label`) on custom Pressable switches.
