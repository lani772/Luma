# Palette's Journal

## 2025-03-04 - Screen Reader support for Custom Toggles and Adjustable Sliders
**Learning:** Custom UI components such as switches built with `Pressable` and custom sliders built with `PanResponder` in React Native are completely invisible or un-interactive to screen readers (VoiceOver/TalkBack) unless they explicitly implement `accessibilityRole`, `accessibilityState`, and `onAccessibilityAction`.
**Action:** Always decorate custom toggles with `accessibilityRole="switch"` and `accessibilityState`, and custom sliders with `accessibilityRole="adjustable"` along with custom `accessibilityActions` and `onAccessibilityAction`.
