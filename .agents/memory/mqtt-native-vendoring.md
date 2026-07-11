---
name: Vendoring a native RN library into a pnpm workspace
description: How to vendor a native React Native module (source-only, no build tooling) as a workspace package so TS resolves its imports correctly.
---

When vendoring a native RN library's source into `lib/<name>/` as a `workspace:*` package (trimmed `package.json`, no build step), its own type-checking will fail with "Cannot find module 'react-native'" even though the consuming app has react-native installed.

**Why:** pnpm's isolated `node_modules` linking does not expose a workspace package to its peerDependencies unless that package also lists them as (dev)dependencies — `peerDependencies` alone doesn't get pnpm to symlink `react-native`/`react` into the vendored package's own resolution scope, so TS can't resolve types when the app's tsconfig type-checks the vendored source directly (no prebuilt `.d.ts`).

**How to apply:** add matching versions as `devDependencies` in the vendored package's `package.json` (in addition to the `peerDependencies` declaration) and run `pnpm install` — this makes pnpm link them so both runtime and typecheck resolve. Same fix applies to any other vendored native module with react/react-native peer deps.
