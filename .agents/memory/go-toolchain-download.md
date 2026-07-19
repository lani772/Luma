---
name: Go toolchain download in Replit
description: How to download a newer Go toolchain (e.g. go1.25.5) when GOSUMDB=off blocks it in the Replit container environment.
---

## The rule

When `go.mod` requires a Go version newer than the container's Go binary AND `GOSUMDB=off` is set in the container environment, toolchain auto-download fails:

```
go: download go1.25.5: golang.org/toolchain@v0.0.1-go1.25.5.linux-amd64: verifying module: checksum database disabled by GOSUMDB=off
```

**Fix:** Override `GOSUMDB` back to its default for the workflow command:

```
GOSUMDB=sum.golang.org GONOSUMDB=golang.org/toolchain go run ./cmd/api
```

- `GOSUMDB=sum.golang.org` re-enables the checksum database so Go can verify the toolchain download.
- `GONOSUMDB=golang.org/toolchain` exempts the toolchain module specifically from sumdb, allowing it to install cleanly.
- `GOPROXY` stays as Replit's proxy (`http://package-firewall.replit.local/go/`) which serves the toolchain zip.

**Why:** Replit sets `GOSUMDB=off` at the container level. This normally suppresses module verification but prevents Go 1.21+ from downloading and verifying any NEW toolchain binary — a hard security requirement that GONOSUMDB=* alone cannot bypass (GOSUMDB=off takes precedence for toolchain verification specifically).

**How to apply:** Add `GOSUMDB=sum.golang.org GONOSUMDB=golang.org/toolchain` to any `go run` or `go build` workflow command where `go.mod` requires a Go version newer than 1.21.x. Also applies to the artifact-managed workflow (update the run command in artifact.toml or .replit accordingly).

**First run:** Requires downloading ~100 MB of toolchain — set `workflow_timeout` to 180s when restarting via WorkflowsRestart.
