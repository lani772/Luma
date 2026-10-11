## 2025-05-18 - Icon Quick-Toggle Accessibility in Link Cards
**Learning:** Quick-action icon buttons nested inside clickable card components (like device cards) are invisible to screen readers without descriptive `aria-label` and `title` attributes. Keyboard users also need distinct `focus-visible` styles to navigate quick actions without triggering card navigation.
**Action:** Always provide explicit action-specific ARIA labels (`aria-label={`Turn ${on ? 'off' : 'on'} ${name}`}`) and focus rings (`focus-visible:ring-2`) on inline card controls.
