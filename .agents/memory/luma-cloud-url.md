---
name: LUMA cloud backend URL routing
description: How the Go cloud backend is accessed from the mobile app and what env vars it needs.
---

# Rule
The Go cloud backend (`artifacts/luma-cloud-backend`) runs on port **8090** with base path `/cloud`. Replit's artifact proxy routes all `/cloud/...` requests from the main domain to port 8090 (configured in `.replit-artifact/artifact.toml`).

**Mobile app URL pattern:** `https://${EXPO_PUBLIC_DOMAIN}/cloud/<path>` — this goes through the Replit proxy to port 8090.

**Required env vars:**
- `SESSION_SECRET` — already set as a Replit secret; used to derive JWT signing keys.
- `DATABASE_URL` — auto-managed by Replit.

**Why:** The mobile app's `EXPO_PUBLIC_DOMAIN` env var is set to `$REPLIT_DEV_DOMAIN` by the Expo workflow command. Using `/cloud` as the path prefix avoids port conflicts with the Node/Express api-server on port 8080 (`/api`).

**How to apply:** `services/cloud-api.ts` constructs the base URL as `https://${EXPO_PUBLIC_DOMAIN}/cloud` (fallback: `http://localhost:8090/cloud` for local dev outside Replit).
