## 2025-05-20 - Custom Toggle Switch Accessibility Semantics
**Learning:** Custom toggle components created using React Native's `Pressable` lack default screen reader roles and state annotations on both native mobile and Expo Web platforms.
**Action:** Always populate `accessibilityRole="switch"`, `accessibilityState={{ checked, disabled }}`, `accessibilityLabel`, along with `aria-checked`, `aria-disabled`, and `aria-label` on the root `Pressable` element of custom toggle switches.
