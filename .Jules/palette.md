## 2025-05-20 - Custom Switch Accessibility in React Native/Expo Web

**Learning:** Custom toggle switch components created with `Pressable` in React Native / Expo Web require explicit native accessibility props (`accessibilityRole="switch"`, `accessibilityState={{ checked, disabled }}`) along with web ARIA attributes (`aria-checked`, `aria-disabled`, `aria-label`) to ensure assistive technology correctly reads the control's semantics and state across all platforms.

**Action:** When designing or refactoring custom toggle controls in cross-platform React Native components, always pass both native accessibility props and web `aria-*` attributes.
