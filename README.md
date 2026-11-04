# Desktop Tools

A modular, customizable desktop tools app for Windows: one engine, many tools, shown as compact cards in a
control center (and later a top bar, dock and launcher).

**v0.1:** control center with Home dashboard, Weather, Markets, Clocks and a universal Settings page.

## Run

```
uv sync && npm --prefix ui ci && npm --prefix ui run build
uv run dt --fake --no-window      # any OS, sample data, prints a browser URL
uv run dt                          # Windows: window, tray icon, Ctrl+Alt+Space
```

Install on Windows (per-user, no admin): `powershell -ExecutionPolicy Bypass -File scripts\install.ps1`

## Docs

[Concept](docs/CONCEPT.md) · [Architecture](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md) ·
[Tool guide](docs/TOOL_GUIDE.md) · [Design system](docs/DESIGN_SYSTEM.md) · [Roadmap](docs/ROADMAP.md) ·
[Decisions](docs/adr/). Contributors (human or AI): start with [AGENTS.md](AGENTS.md).
