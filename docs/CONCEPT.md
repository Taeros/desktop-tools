# Desktop Tools — Concept

> Status: **Approved** (name, hotkey, v1 scope confirmed 2026-11-03). Owner: Nicolas Lamps. Last updated: 2026-11-03.
> This document says *what* we are building and *why*. [ARCHITECTURE.md](ARCHITECTURE.md) says *how*.

## 1. Vision

A personal Windows desktop experience made of tools. One background engine collects information (weather,
markets, time zones, audio, network, VPN …) and controls the PC; several **surfaces** show that information as
compact, number-first **cards**. The user arranges pages, cards and settings graphically. New tools drop in as
self-contained folders.

It layers *on top of* stock Windows. It never replaces the Windows shell, needs no administrator rights, and
closing it returns the PC to normal.

## 2. Priorities (in order — earlier wins when they conflict)

| # | Priority | What it means in practice |
|---|----------|---------------------------|
| 1 | **Security** | No secret (API key, token, password) ever reaches the repository, logs, the UI, or a synced folder. The engine is reachable only from this PC and only with a per-launch token. Tools get only the permissions they declare. |
| 2 | **Simplicity** | Every tool is reachable in **one click** from anywhere in the app. Defaults work with zero setup. |
| 3 | **Modularity** | A tool is one folder. Adding, removing, rearranging or re-skinning tools needs no changes to the core. Layout lives in data, not code. |
| 4 | **Robustness** | One tool failing never breaks another or the app. Every tool runs with fake data for development and testing. Settings survive upgrades. |
| 5 | **Aesthetic** | Modern, concise, consistent. Numbers first, minimal chrome, no layout jumps or flicker, every state (loading, stale, error, empty) designed. |

## 3. Vocabulary

| Term | Meaning | Example |
|------|---------|---------|
| **Provider** | Background code that gathers data or performs actions. Knows nothing about display. | `weather` provider calls Open-Meteo every 15 min. |
| **State** | The latest data a provider publishes, with a timestamp and health status. | `{temp: 16, hi: 21, ...}` |
| **Action** | A named, validated command a provider accepts. | `audio.set_volume(40)` |
| **Card** | A UI component that renders one provider's state (or several) at a fixed size. | Weather card, size S/M/L. |
| **Tool** | The unit you install: a folder bundling providers, cards, an optional full page, settings and a manifest. | `tools/weather/` |
| **Page** | What the sidebar opens. Either a tool's own full page or a **dashboard** (a grid of cards). | "Home" dashboard. |
| **Surface** | A place cards appear: control center, top bar, dock, launcher. | |

## 4. Surfaces

| Surface | Role | Phase |
|---------|------|-------|
| **Control center** | Main window. Left icon sidebar; the page loads on the right. Summoned by hotkey or tray icon. | **v1** |
| **Top bar** | Thin always-visible strip at the screen top, showing small cards. Replaces the Rainmeter bar. | v2 |
| **Dock** | Pinned apps and tool shortcuts; the Windows taskbar stays on auto-hide. | v3 |
| **Launcher** | Hotkey → type → act ("vol 40", "weather bogota", "spotify"). | v3 |

All surfaces are web pages rendered by Windows' built-in WebView2, so a card written once works on every surface.
The control center can also be opened in a normal browser on the same PC (`http://127.0.0.1:<port>`); it has the
same abilities there because the engine, not the page, does the work.

## 5. Control center layout

```
┌────┬──────────────────────────────────────────────┐
│ ⌂  │  Page title                     ⟳  ⚙  ✎ edit │
│ ☁  │ ┌────────┐ ┌────────┐ ┌──────────────────┐    │
│ $  │ │ card S │ │ card S │ │     card M       │    │
│ ♪  │ └────────┘ └────────┘ └──────────────────┘    │
│ ⌁  │ ┌───────────────────┐ ┌────────┐              │
│ ◷  │ │      card L       │ │ card S │              │
│    │ └───────────────────┘ └────────┘              │
│ ⚙  │                                               │
└────┴──────────────────────────────────────────────┘
```

* **Sidebar**: one icon per page, tooltips on hover. Order, icons, names and visibility are user-editable.
  Beyond ~10 pages, entries group into collapsible categories, still one click away (groups expand on hover).
* **Pages**: a tool's full page, or a dashboard grid of cards. "Home" is a dashboard by default.
* **Header**: page title, refresh, page settings, and **Edit** (layout mode).
* **Settings** page: always the last sidebar entry.

## 6. Customization without code (design goal)

Everything below is done in the UI and saved as data. Nothing requires editing files.

| Area | v1 | Later |
|------|----|-------|
| Sidebar | Reorder (drag), rename, change icon, hide/show, add a dashboard page | Categories |
| Dashboards | Edit mode: add a card from a picker, drag to move, choose size S/M/L, remove | Multiple columns presets, per-page background |
| Tool settings | Auto-generated forms from each tool's settings schema (units, locations, tickers …) | |
| Look | Theme: accent color, light/dark, density, font scale, corner radius; presets | Theme import/export, wallpaper-derived palette |
| Global | Universal Settings page: units, time format, hotkey, start at login, shared locations | |
| Data | Export / import all settings as one file; reset a tool; reset everything | |
| No-code tools | — | "Quick links" (launch apps/URLs/files), "Custom number" card (value from a JSON URL), "Note" card |
| Other surfaces | — | Same layout editor for top bar and dock |

## 7. v1 scope (approved 2026-11-03)

A small, solid base first; interactive system-control tools come after the foundations are proven.

1. **Home**: a dashboard page with cards from every installed tool.
2. **Weather**: now, outlook, 7 days, UV now/peak, sunrise/sunset, night light, locations (search, favorites, my location).
3. **Markets**: watchlist with % change over 1D/1W/1M/1Y (VT by default).
4. **Clocks**: local time plus chosen saved locations (independent show/hide).
5. **Settings**: the universal settings page (below), plus per-tool settings and system health.

Next, once the base is solid: Audio and media, Network/VPN, then further tool ideas (see [ROADMAP.md](ROADMAP.md)).

### Universal settings

One **Settings** page, always the last sidebar entry, for everything that belongs to the app rather than one tool,
or that several tools share. Tools read shared values and never duplicate them.

| Group | Settings |
|-------|----------|
| General | Summon hotkey (default **Ctrl+Alt+Shift+D**), start at login, open on start-up page |
| Units and formats | Metric / imperial (default metric), 24 / 12-hour time (default 24), date style, first day of week |
| Locations | Saved places shared by Weather and Clocks; "my location" on/off |
| Appearance | Theme (accent, light/dark, density, font scale, corner radius), presets |
| Layout | Sidebar order/names/icons/visibility; reset layout |
| Tools | Enable/disable, approve permissions, open each tool's own settings |
| Data and privacy | Export / import settings, reset, open data folder, stored secrets (names only) |
| System | Health of each provider, logs, version, check for updates |

## 8. Non-goals

* Replacing `explorer.exe` / the Windows shell, or any change needing admin rights.
* Cloud accounts, telemetry, or remote access. The app talks only to the public data APIs its tools declare.
* Running on macOS/Linux (development and tests run anywhere in **fake mode**, but the product targets Windows 11).

## 9. Constraints

* Target device: managed (Entra-joined) Windows 11 Enterprise laptop, 150 % display scaling, standard user.
* Install entirely per-user; data in `%LOCALAPPDATA%\DesktopTools` (deliberately **not** OneDrive).
* No unsigned `.exe` downloads; runs from a per-user Python environment.
