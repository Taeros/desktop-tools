# Security

Security is priority #1. These rules are **requirements**; CI enforces what it can.

## Threat model (what we defend against)

| Threat | Defence |
|--------|---------|
| Secrets committed to GitHub | Secrets never live in files. `.gitignore` covers data folders. **gitleaks** runs as a pre-commit hook and in CI; a hit fails the build. |
| Secrets leaking through logs, UI, crash reports | Secrets accessed only via `ctx.secrets`; never returned by any API; logging filter redacts token-like strings; UI shows only "set / not set". |
| Secrets readable on disk | Stored in Windows Credential Manager (DPAPI, per-user). Never in `settings/*.json`, never in OneDrive. |
| Another device on the network controlling the PC | Server binds to `127.0.0.1` only. No LAN mode in v1. |
| A malicious website in the user's browser calling the local API (CSRF / DNS rebinding) | Every request needs a per-launch random token; `Host` header must be `127.0.0.1:<port>`; `Origin` must match; WebSocket checks the same. CORS disabled. |
| A buggy or hostile tool | Tools declare permissions in `manifest.json` (network domains, system capabilities, secret names). The core enforces them: `ctx.http` refuses undeclared domains, `ctx.adapters` exposes only granted adapters. New tools are disabled until the user approves their permissions in the UI. |
| Supply-chain (dependencies) | `uv.lock` / `package-lock.json` with hashes; Dependabot; minimal dependency count; no runtime downloads of code. |
| Injected content in the UI (XSS) | Strict Content-Security-Policy (`default-src 'self'`); no remote scripts/fonts; no `eval`; React escaping; data from APIs is never rendered as HTML. |
| Device-policy issues on a managed laptop | No admin, no registry edits outside per-user Startup shortcut, no shell replacement, no unsigned executables. |

## Rules for contributors (human or AI)

1. Never paste a real key, token, password, or personal identifier into code, tests, fixtures, docs, issues, or commit messages. Use obviously fake values (`TEST_KEY_123`).
2. New network domains or system capabilities require a manifest change, which is reviewed.
3. Do not add telemetry, analytics, or remote error reporting.
4. Do not widen the server bind address or disable token/Origin checks — not even "temporarily".
5. If you find a leak: rotate the secret first, then remove it from history (`git filter-repo`), then record it in `docs/adr/`.

## Where things live

| Kind | Location |
|------|----------|
| Code, docs, fake fixtures | Git repository |
| Settings, layout, logs, cache | `%LOCALAPPDATA%\DesktopTools\` (git-ignored, not synced) |
| Secrets | Windows Credential Manager, service name `DesktopTools/<tool-id>` |
