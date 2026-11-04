# Desktop Tools — Architecture

> Status: **Draft for approval**. Read [CONCEPT.md](CONCEPT.md) first for vocabulary.

## 1. Big picture

```
            ┌───────────────────────── one Python process ─────────────────────────┐
            │                                                                       │
 Windows ◄──┤  Adapters (audio, media, radios, wifi, vpn …)   ◄── real or fake       │
 Web APIs ◄─┤  SafeHttp (per-tool domain allowlist)                                 │
            │        ▲                                                              │
            │  Providers (one asyncio task each, isolated, supervised)              │
            │        │ publish(state)            ▲ actions                          │
            │        ▼                           │                                  │
            │  State store + event bus  ──────►  Action router (validates,          │
            │        │                           checks permissions)                │
            │        ▼                           ▲                                  │
            │  Local API server (127.0.0.1, token): REST + WebSocket                │
            │        │                                                              │
            │  Shell: pywebview windows (surfaces), tray icon, hotkeys, autostart   │
            └────────┼──────────────────────────────────────────────────────────────┘
                     ▼
        WebView2 pages (control center, later bar/dock/launcher)
        React + TypeScript cards ◄── live state over WebSocket
```

**Data flows one way** (provider → store → UI). **Commands flow the other way** (UI → action router → provider).
The UI never talks to Windows or the internet directly.

## 2. Technology

| Layer | Choice | Why |
|-------|--------|-----|
| Language (engine) | Python 3.12 (uv-managed) | Readable, rich Windows libraries, easy handoff |
| Env / deps | `uv` with `uv.lock` (hash-pinned) | Per-user install, reproducible, no admin |
| API server | FastAPI + Uvicorn (REST + WebSocket) | Typed, fast, widely known |
| Models / schemas | Pydantic v2 | One definition → validation + JSON Schema + TS types |
| Windows shell | pywebview (Edge WebView2), pystray, ctypes/pywin32 | Borderless/topmost windows, tray, hotkeys, no admin |
| Windows data | pycaw/comtypes (audio), `winrt-*` packages (media session, radios), `netsh` (Wi-Fi), NetworkInterface (VPN) | Native APIs, no PowerShell helper |
| Secrets | `keyring` → Windows Credential Manager (DPAPI) | Encrypted per-user, never on disk in plain text |
| UI | React 18 + TypeScript + Vite; CSS variables design tokens; no UI framework dependency | Most widely known stack; typed contracts |
| Layout editing | `react-grid-layout` | Drag to move; sizes S/M/L/XL picked from a menu (no free resize, for consistency) |
| Tests | pytest (engine), Vitest (UI), Playwright (screenshots in fake mode) | Run anywhere without Windows |
| Quality | ruff, mypy, eslint, prettier, gitleaks (pre-commit + CI) | Consistency, secret scanning |

The built UI (`ui/dist`) is committed on release so the PC needs **only Python** (no Node.js).

## 3. Repository layout

```
desktop-tools/
├── AGENTS.md                ← start here if you are an AI or new developer
├── README.md
├── docs/                    ← concept, architecture, tool guide, security, design system, ADRs
├── engine/                  ← Python package `desktop_tools`
│   ├── core/                ← store, bus, supervisor, actions, settings, secrets, http, permissions
│   ├── server/              ← FastAPI app, auth, websocket
│   ├── shell/               ← pywebview windows, tray, hotkeys, autostart
│   ├── adapters/            ← Windows integrations, each with a fake twin
│   └── sdk/                 ← the ONLY API tools may import (Provider base, decorators, types)
├── tools/                   ← one folder per tool (engine + UI halves together)
│   └── weather/
│       ├── manifest.json
│       ├── provider.py
│       ├── settings.py      ← pydantic settings model → auto form
│       ├── fake.py          ← fixture data for fake mode
│       ├── ui/              ← cards and optional page (TSX)
│       └── tests/
├── ui/                      ← surface shells, design system, card host, layout editor
├── scripts/                 ← install.ps1, run, build, codegen
└── tests/                   ← cross-cutting tests, screenshot baselines
```

## 4. The tool contract

A tool is a folder in `tools/`. The core discovers it at start-up; nothing else is registered by hand.

### 4.1 `manifest.json`

```json
{
  "id": "weather",
  "name": "Weather",
  "version": "1.0.0",
  "icon": "cloud",
  "category": "Information",
  "providers": ["weather"],
  "page": true,
  "cards": [
    { "id": "now",   "sizes": ["S", "M"], "surfaces": ["control", "bar"] },
    { "id": "week",  "sizes": ["M", "L"], "surfaces": ["control"] }
  ],
  "permissions": {
    "network": ["api.open-meteo.com", "geocoding-api.open-meteo.com", "ipwho.is"],
    "system": [],
    "secrets": []
  }
}
```

### 4.2 Provider (engine side)

```python
from desktop_tools.sdk import Provider, action, ctx_types as t
from .settings import WeatherSettings
from .models import WeatherState

class Weather(Provider[WeatherSettings, WeatherState]):
    interval = 900                      # seconds between refresh() calls; 0 = event-driven

    async def refresh(self, ctx: t.Context) -> WeatherState:
        data = await ctx.http.get_json("https://api.open-meteo.com/v1/forecast", params={...})
        return WeatherState.from_api(data, ctx.settings)

    @action
    async def set_location(self, ctx: t.Context, name: str, lat: float, lon: float) -> None:
        await ctx.settings.update(location=dict(name=name, lat=lat, lon=lon))
        await self.refresh_now()
```

The core supplies `ctx`: `settings` (typed, persisted), `secrets` (get/set by declared name), `http`
(allowlisted), `adapters` (only those the manifest permits), `log` (redacting), `clock`.

### 4.3 Cards (UI side)

```tsx
import { defineCard, useProvider, Stat } from "@sdk";

export default defineCard({
  id: "now",
  sizes: ["S", "M"],
  render: ({ size }) => {
    const w = useProvider<WeatherState>("weather");   // typed; live via WebSocket
    return <Stat value={w.temp} unit="°" caption={w.condition} />;
  },
});
```

Cards get loading / stale / error / empty states for free from the card host; they render only the happy path.

### 4.4 Rules for tools

1. Import only from `desktop_tools.sdk` (engine) and `@sdk` (UI). Never from another tool or the core internals.
2. All network access goes through `ctx.http`; all OS access through `ctx.adapters`.
3. Every provider ships `fake.py`; every card renders against it.
4. State and settings are Pydantic models. The UI mirrors State as a TypeScript interface at the top of
   `ui/index.tsx` (generation from the Pydantic models is planned; keep the mirror in sync by hand until then).
5. Settings changes happen through settings models (auto forms), never hand-built settings UIs unless unavoidable.

## 5. Core services

| Service | Responsibility |
|---------|----------------|
| **Supervisor** | Starts each provider as its own task; catches exceptions; exponential backoff; marks state `stale`/`error` with a reason. |
| **State store / bus** | Latest state per provider + metadata (`updated_at`, `status`). Pushes diffs to subscribed UIs. |
| **Action router** | `POST /api/actions/{provider}/{action}`; validates args against the action's signature; checks permissions; rate-limits. |
| **Settings** | Per-tool typed settings + app settings + layout, stored as versioned JSON in the data folder, with migrations. |
| **Layout** | Sidebar entries and dashboard grids as data (`layout.json`). The UI editor writes it; tools never do. |
| **Secrets** | Windows Credential Manager via `keyring`; UI only ever sees `set` / `not set`. |
| **SafeHttp** | httpx client restricted to the tool's declared domains; timeouts; retries; response size cap. |
| **Logging** | Rotating files in the data folder; redaction filter (tokens, keys, IPs optional). |

## 6. Processes, start-up, files

* One process: Uvicorn runs in a background thread; pywebview owns the main thread (WebView2 requirement).
* Start at login via a shortcut in the user's Startup folder (no registry, no admin).
* Data folder `%LOCALAPPDATA%\DesktopTools\`: `settings/`, `layout.json`, `logs/`, `cache/`. Never inside the repo
  or OneDrive.
* **Fake mode** (`--fake`): every adapter and provider uses its fake twin; runs on any OS. Used for UI development,
  screenshots and CI.

## 7. Versioning and compatibility

* Semantic versions for the app and each tool. Settings files carry `schema_version`; migrations live next to
  the settings model.
* The SDK is the stability boundary: changes to `desktop_tools.sdk` / `@sdk` require an ADR in `docs/adr/`.

## 8. Deployment

| What | Where |
|------|-------|
| Source of truth | GitHub private repo `desktop-tools` |
| App on the PC | `%USERPROFILE%\DesktopTools` (code + `.venv` created by `uv sync`; uv and Python under `%LOCALAPPDATA%\DesktopTools`) |
| User data | `%LOCALAPPDATA%\DesktopTools\data` |
| Install / update | `scripts/install.ps1`: installs `uv` per-user if missing, `uv sync`, creates Startup shortcut. Re-run to update. |
