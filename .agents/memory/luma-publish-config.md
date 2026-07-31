---
name: LUMA publish configuration
description: Production publishing must explicitly target the Expo static build rather than relying on monorepo auto-detection.
---

The LUMA monorepo contains Go and Node services alongside the mobile app, so publishing without explicit commands can auto-detect Go at the repository root and fail because there is no root `go.mod`. Configure publishing to run the mobile package's `build` and `serve` scripts. The Expo build uses a configurable Metro port so it can avoid collisions with other workspace services.

**Why:** Replit's default language detection selected the wrong service during publishing and failed before the app build started.

**How to apply:** When changing the LUMA deployment, preserve the explicit filtered `@workspace/luma-smart-home` build/run commands and keep Metro isolated from other services.