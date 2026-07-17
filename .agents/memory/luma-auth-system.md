---
name: LUMA auth system
description: Auth architecture, username handling, token refresh, and new screen inventory added in the auth feature build.
---

## Auth guard pattern

`AuthGuard` component inside `RootLayoutNav` (in `_layout.tsx`) uses `useSegments` + `useEffect` + `router.replace`. Public routes are in a `Set`: `login`, `forgot-password`, `verify-email`, `+not-found`. All other routes require authentication.

**Why:** Expo Router requires the guard to live inside the navigation tree (where `useSegments` is valid), but still inside the providers so `useCloudAuth` resolves.

## Username handling

Backend does not store/return a `username` field (as of this build). Username is stored locally at `AsyncStorage` key `@luma/cloud_username`. It is also merged onto the `CloudUser` object in memory (`{ ...auth.user, username }`).

Login accepts email or username: presence of `@` determines which field is sent to the backend (`email` vs `username`).

**Why:** Backend register/login DTOs accept `username` but the `users/me` response does not echo it back yet. Local storage bridges the gap.

## Token auto-refresh

`apiFetch` (in `services/cloud-api.ts`) intercepts HTTP 401, calls `CloudAPI._tryRefresh()` once, and retries the original request. `_tryRefresh` serialises concurrent refresh calls via a waiter queue (`_refreshWaiters`) to avoid thundering-herd token races.

## Post-login sync

`CloudAuthContext.login` / `register` fire `CloudAPI.syncAllData()` as a background promise after setting user state — sign-in does NOT block on sync. `syncAllData` fetches devices, received invitations, and access requests in parallel via `Promise.allSettled`, caches to `@luma/cloud_sync_cache`.

`syncKey` (integer, bumped on each successful sync) is exposed from `CloudAuthContext` for downstream contexts to react to.

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
