# Roadmap

Phases are ordered by the priorities in [CONCEPT.md](CONCEPT.md). Each phase ends with something usable.

## Phase 0 — Foundations
- Repo, docs, CI (lint, types, tests, gitleaks), pre-commit hooks
- Feasibility on the target laptop: per-user Python via `uv`, WebView2, network access to package index
- Engine skeleton: supervisor, store, action router, settings, secrets, SafeHttp, logging, fake mode
- Server with token / Host / Origin checks; WebSocket state stream
- UI shell: control center with sidebar and empty pages; design tokens; card host with all states

## Phase 1 — Control center v1
- Tools: Weather, Markets, Clocks, Audio and media, Network/VPN
- Home dashboard; dashboard edit mode (add / move / resize / remove cards)
- Sidebar editor; auto-generated settings forms; theme editor; import/export settings
- System health page; start at login; tray icon; summon hotkey
- Retire Rainmeter

## Phase 2 — Top bar
- Bar surface reusing cards at S size; bar layout editor

## Phase 3 — Dock and launcher
- Dock with pinned apps and tool shortcuts; taskbar auto-hide toggle
- Launcher with commands contributed by tools

## Backlog (to evaluate)
- No-code tools: Quick links, Custom number (JSON URL), Note
- User's tool ideas (pending)
