---
name: pnpm exec in workspace dev scripts
description: pnpm 10 `pnpm exec` fails with ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL when called from a script invoked via --filter; use direct binary path instead.
---

# Rule
Never use `pnpm exec <cmd>` inside a workspace package's `scripts` entry when that script is called via `pnpm --filter @workspace/pkg run dev`. It fails with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "<cmd>" not found` in pnpm 10.

**Why:** pnpm 10 changed how `exec` resolves binaries in filtered/recursive invocations. The binary is present in `node_modules/.bin/` but the recursive context breaks the lookup.

**How to apply:** Replace `pnpm exec expo start` (or any `pnpm exec <bin>`) in `package.json` scripts with `./node_modules/.bin/expo start`. This works regardless of how the script is invoked.

**Fixed in:** `artifacts/luma-smart-home/package.json` dev script — changed `pnpm exec expo start` → `./node_modules/.bin/expo start`.
