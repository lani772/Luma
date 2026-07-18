---
name: LUMA auth system
description: Auth architecture, username handling, token refresh, platform validation, font-loading resilience, and new screen inventory.
---

## Auth guard pattern

`AuthGuard` component inside `RootLayoutNav` (in `_layout.tsx`) uses `useSegments` + `useEffect` + `router.replace`. Public routes are in a `Set`: `login`, `forgot-password`, `verify-email`, `+not-found`. All other routes require authentication.

**Why:** Expo Router requires the guard to live inside the navigation tree (where `useSegments` is valid), but still inside the providers so `useCloudAuth` resolves.

## Username handling

The Go backend now stores `username` in the `users` table (unique, nullable) and returns it in the `UserDTO`/`AccountDTO` responses. The mobile app prefers the backend username and falls back to the locally stored one.

- `RegisterRequest` requires `username` (3–20 chars, alphanumeric + underscore).
- `LoginRequest` accepts either `email` or `username`.
- `users/me` profile and account deletion endpoints are implemented.

**Why:** Earlier the backend ignored the username field, so the app had to store it locally. Now the backend owns it and enforces uniqueness.

## Platform validation

The Go backend requires `platform` to be one of `ios`, `android`, `web`, or `other`. The mobile app sends `Platform.OS` (which is exactly one of those values on React Native) instead of the invalid `"mobile"`.

**Why:** Sending `"mobile"` caused `RegisterRequest.Platform` validation to fail with the `oneof` tag.

## Font-loading resilience

`app/_layout.tsx` uses `expo-font` `Font.loadAsync` with a 4-second timeout and try/catch fallback instead of the `@expo-google-fonts/inter` `useFonts` hook. If the Inter fonts fail to load, the app still renders with system fonts rather than crashing with a `fontfaceobserver` timeout.

## Token auto-refresh

`apiFetch` (in `services/cloud-api.ts`) intercepts HTTP 401, calls `CloudAPI._tryRefresh()` once, and retries the original request. `_tryRefresh` serialises concurrent refresh calls via a waiter queue (`_refreshWaiters`) to avoid thundering-herd token races.

## Post-login sync

`CloudAuthContext.login` / `register` fire `CloudAPI.syncAllData()` as a background promise after setting user state — sign-in does NOT block on sync. `syncAllData` fetches devices, received invitations, and access requests in parallel via `Promise.allSettled`, caches to `@luma/cloud_sync_cache`.

`syncKey` (integer, bumped after each successful sync) is exposed from `CloudAuthContext` for downstream contexts to react to.

## Backend auth endpoints

| Method | Path | Status |
|---|---|---|
| POST | `/cloud/auth/register` | Stores username, email, full name, password hash; returns tokens |
| POST | `/cloud/auth/login` | Accepts email or username; returns tokens |
| POST | `/cloud/auth/logout` | Revokes refresh token |
| DELETE | `/cloud/users/me` | Soft-deletes account (optional password confirmation) |
| GET | `/cloud/users/me` | Returns profile including username |
| PATCH | `/cloud/users/me` | Updates full name and/or username (uniqueness checked) |

## New screens added

| Route | File | Notes |
|---|---|---|
| `/login` | `app/login.tsx` | Full rewrite: Sign In + Create Account tabs, validation, password strength |
| `/forgot-password` | `app/forgot-password.tsx` | Email enum-safe (always shows "sent") |
| `/verify-email` | `app/verify-email.tsx` | Resend + continue |
| `/no-devices` | `app/no-devices.tsx` | Post-register empty state with 4 action cards |
| `/profile` | `app/profile.tsx` | View + edit fullName/username, account info, links to danger zone |
| `/security-settings` | `app/security-settings.tsx` | Change password, sessions list + revoke |
| `/delete-account` | `app/delete-account.tsx` | Requires typing "DELETE MY ACCOUNT" + optional password |
| `/invitations` | `app/invitations.tsx` | Received/Sent tabs, accept/decline/withdraw |
| `/ownership-transfer` | `app/ownership-transfer.tsx` | Device picker + email + keep-admin toggle |

## Optional backend endpoints

All invitation/access-request/session endpoints use `apiFetchOptional` and gracefully return `[]` on 404/501/405. The app works even when these endpoints are not yet implemented.

## Real user data surfaces

- `app/(tabs)/index.tsx` — greeting uses `user.fullName.split(" ")[0]`
- `app/(tabs)/more.tsx` — profile card shows real name/email/role/initials; quick links for Invitations, Security, Sign Out
