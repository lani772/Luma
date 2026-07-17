---
name: LUMA cloud backend URL routing
description: How the Go cloud backend is accessed from the mobile app, what ports each service uses, and how to open the Expo preview.
---

# Rule
The Go cloud backend (`artifacts/luma-cloud-backend`) runs on port **8090** with base path `/cloud`. Replit's artifact proxy routes all `/cloud/...` requests from the main domain to port 8090 (configured in `.replit-artifact/artifact.toml`).

**Mobile app URL pattern:** `https://${EXPO_PUBLIC_DOMAIN}/cloud/<path>` — this goes through the Replit proxy to port 8090.

**Required env vars:**
- `SESSION_SECRET` — already set as a Replit secret; used to derive JWT signing keys.
- `DATABASE_URL` — auto-managed by Replit.

**Why:** The mobile app's `EXPO_PUBLIC_DOMAIN` env var is set to `$REPLIT_DEV_DOMAIN` by the Expo workflow command. Using `/cloud` as the path prefix avoids port conflicts with the Node/Express api-server on port 8080 (`/api`).

**How to apply:** `services/cloud-api.ts` constructs the base URL as `https://${EXPO_PUBLIC_DOMAIN}/cloud` (fallback: `http://localhost:8090/cloud` for local dev outside Replit).

# Ports
| Service | Port | Route prefix | Workflow command |
|---|---|---|---|
| LUMA Smart Home (Expo) | 20792 | `/` | `PORT=20792 pnpm --filter @workspace/luma-smart-home run dev` |
| API Server (Express) | 8080 | `/api` | `PORT=8080 pnpm --filter @workspace/api-server run dev` |
| Cloud Backend (Go/Gin) | 8090 | `/cloud` | `cd artifacts/luma-cloud-backend && CLOUD_API_PORT=8090 go run ./cmd/api` |

Keep these aligned with `artifact.toml` files. A mismatch (e.g., Go on 8099) causes Replit's proxy to return HTTP 502.

# Expo preview URLs
- The public Expo URL is `https://$REPLIT_EXPO_DEV_DOMAIN/_expo/loading`.
- If you open it directly in a browser, Expo's CLI requires a `?platform=ios|android|web` query parameter or an `expo-platform` header; otherwise it returns HTTP 500 with `CommandError: Must specify "expo-platform" header or "platform" query parameter`.
- The Replit editor's built-in preview iframe handles this automatically. If the URL is stale after a workflow restart, reload from the editor or use the QR/URL printed by the Expo CLI.
