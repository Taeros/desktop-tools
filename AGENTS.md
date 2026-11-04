# AGENTS.md — read this first

Instructions for any AI assistant or new developer continuing this project.

## What this is
A modular Windows desktop tools app. Read, in order: `docs/CONCEPT.md` → `docs/ARCHITECTURE.md` →
`docs/SECURITY.md` → `docs/TOOL_GUIDE.md` → `docs/DESIGN_SYSTEM.md`. Decisions and their reasons are in `docs/adr/`.

## Priorities (resolve conflicts in this order)
1. Security · 2. Simplicity (one click to any tool) · 3. Modularity · 4. Robustness · 5. Aesthetic

## Ground rules
- Never commit secrets or personal data. Use fake values in tests and fixtures. Run `pre-commit` before committing.
- Tools import only `desktop_tools.sdk` (Python) and `@sdk` (UI). Do not reach into core internals or other tools.
- Every provider must run in fake mode (`uv run dt --fake`). Develop UI against fake mode.
- Anything a user might want to change belongs in a settings model or the layout, not in code.
- Changing the SDK, permissions model, server security, or data formats requires a new ADR in `docs/adr/`.
- Keep diffs small and focused; update docs in the same change as the code.

## Commands
```
uv sync                      # install engine deps
npm --prefix ui ci           # install UI deps (dev only)
uv run dt --fake             # run everything with fake data
uv run dt                    # run for real (Windows)
uv run pytest                # engine + tool tests
npm --prefix ui test         # UI unit tests
npm --prefix ui run shots    # Playwright screenshots in fake mode
uv run scripts/new_tool.py   # scaffold a tool
```

## Definition of done
Lint, types and tests pass; screenshot of affected cards in light and dark; docs updated; no new permissions
without a manifest change; CHANGELOG entry.

## Context
- Owner: Nicolas (Windows 11 Enterprise, managed laptop, 150 % scaling, standard user, no admin).
- Defaults: metric units, 24-hour time, dark theme.
- Predecessor: a Rainmeter "Dashboard Bar" with the same tools; its behavior is the reference for v1 tools.
