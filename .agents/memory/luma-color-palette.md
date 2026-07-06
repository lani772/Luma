---
name: LUMA color palette lever
description: How app-wide color/aesthetic changes are applied in the LUMA Smart Home Expo app
---

All 15+ screens in `artifacts/luma-smart-home` import a shared `C` color object from `constants/colors.ts` (bg, surface, elevated, accent, on/off/warn, txt/sec/mute, etc.) rather than hardcoding colors per-screen.

**Why:** This means a full app-wide visual refresh (e.g. switching from a blue/gold palette to a purple/indigo/cyan glass aesthetic on a dark navy background) can be done by editing just this one file's values — no need to touch every screen's styles.

**How to apply:** When asked for an app-wide color/theme change, update `constants/colors.ts` values first (and add any new gradient/role tokens needed), then only touch individual screens if new UI structure (not just color) is required. Watch for hardcoded hex/icon names that don't map to a valid icon set (e.g. Feather has no "crown" icon — use "star" instead) when introducing new iconography tied to a palette (e.g. role badges).
