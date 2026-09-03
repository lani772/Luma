# Palette Agent Journal

## 2025-05-18 - Switch Accessibility in Custom Expo/React Native Toggle Components
**Learning:** Custom toggle switch components created using `Pressable` in React Native/Expo Web lack accessible semantics by default. Screen readers treat them as plain pressable elements rather than interactive switch controls. Adding `accessibilityRole="switch"`, `accessibilityState={{ checked, disabled }}`, `accessibilityLabel`, and web `aria-*` attributes ensures screen reader users receive proper announcement of the switch's role, state, and target context.
**Action:** When creating or extending custom toggle switches in React Native / Expo cross-platform apps, always include `accessibilityRole="switch"`, `accessibilityState`, and pass through contextual `accessibilityLabel` and `aria-*` props to the root `Pressable`.
