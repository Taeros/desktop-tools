# ADR 0001 — Core architecture decisions

Date: 2026-11-03 · Status: Accepted (pending final approval of CONCEPT.md)

Each entry: decision, alternatives considered, reason. New decisions get a new numbered file.

| # | Decision | Alternatives | Reason |
|---|----------|--------------|--------|
| 1 | Providers → State store → Surfaces, with tools as self-contained folders | Single monolithic app (A); service + web UI without the provider/card split (B) | Clean boundaries, testable in isolation, cards reusable on any surface |
| 2 | Web UI in WebView2 for every surface; thin Python shell for native window behavior | Qt/PySide6; both Qt and web | One UI codebase, fast iteration and screenshot testing, widely known; both would double UI work |
| 3 | Python engine (FastAPI) in one process with the shell | Separate service process; Node/Electron | Simple to run and debug; no extra runtime; Electron too heavy |
| 4 | React + TypeScript + Vite; built `ui/dist` committed on release | Svelte, Lit, no-build JS | Most widely known stack for handoff; types; PC needs no Node |
| 5 | Layout and settings are data edited in the UI | Config in code | Graphical customization without coding |
| 6 | Secrets in Windows Credential Manager via `keyring` | Encrypted file, env vars | OS-managed encryption, nothing on disk |
| 7 | Localhost-only server with per-launch token, Host and Origin checks | No auth; LAN access | Prevents CSRF/DNS-rebinding and network access |
| 8 | Per-user install with `uv`; data in `%LOCALAPPDATA%` | Packaged `.exe`; data in OneDrive | Works without admin on a managed laptop; avoids AV flags; keeps data off sync |
| 9 | Native Python Windows adapters (pycaw, winrt, netsh) replacing the Rainmeter PowerShell helper | Keep PowerShell helper | One language, testable, fakeable |
| 10 | Retire Rainmeter once the interactive tools (Phase 1.5) ship | Run in parallel long-term | Avoid two systems |
| 11 | GitHub private repo `desktop-tools` as source of truth | Local folder only | History, handoff, CI |
| 12 | Interpreter managed by `uv` (Python 3.12, per-user), not the system `python` | Use installed Python 3.11 | The PC's `python` on PATH resolves to a copy inside an old course folder; a uv-managed interpreter is isolated and reproducible |
| 13 | App code in `%USERPROFILE%\DesktopTools` (visible, not synced), data in `%LOCALAPPDATA%\DesktopTools\data`; updates delivered from GitHub by the developer (bridge sync now, `git pull` later) | Install inside OneDrive | Keeps `.venv` and data out of OneDrive sync; git is not installed on the PC yet |
| 14 | App name "Desktop Tools"; summon hotkey **Ctrl+Alt+Shift+D** (was Ctrl+Alt+Space, which the Claude desktop app already uses), changeable in Settings, which shows whether the shortcut is active or taken | — | Owner decision; changed 2026-11-03 after a conflict |
| 15 | v1 tools: Home, Weather, Markets, Clocks, Settings; audio and network follow in Phase 1.5 | All five tools in v1 | Build a solid base before interactive system control |
| 16 | One universal Settings page holds app-wide and cross-tool settings (units, time format, shared locations); tools read them, never duplicate them | Per-tool copies | Single source of truth, simplicity |

## Feasibility check (2026-11-03, target laptop)
Python 3.11.9 per-user present; `uv`, `git`, `node` absent; `winget` present; pypi.org, github.com, astral.sh reachable;
WebView2 156 present; no AppLocker/WDAC rules. Conclusion: per-user install via uv is feasible.
