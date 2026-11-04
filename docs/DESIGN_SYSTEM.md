# Design system

Aesthetic is priority #5, but consistency is cheap if it is decided once. These rules apply to every surface.

## Principles

1. **Numbers first.** Lead with the value; label in smaller, muted text. Tabular numerals everywhere.
2. **Concise.** A card answers one question at a glance. Detail lives on the tool's page.
3. **Calm.** Flat surfaces, hairline borders, one accent color, no gradients/glow. Motion ≤ 150 ms, never decorative.
4. **No jumps.** Fixed card sizes; skeletons reserve space while loading; numbers don't change width (tabular).
5. **Every state designed.** Loading (skeleton), stale (dimmed + "updated 12 min ago"), error (one line + retry), empty (invitation + action).

## Tokens (CSS variables, themeable from the UI)

| Group | Tokens |
|-------|--------|
| Surfaces | `--bg`, `--surface-1`, `--surface-2`, `--overlay` |
| Text | `--text`, `--text-2` (secondary), `--text-3` (muted) |
| Accent and semantic | `--accent`, `--up`, `--down`, `--warn`, `--info` |
| Shape | `--radius` (default 10px), `--border` (hairline) |
| Space | `--space-1..6` (4, 8, 12, 16, 24, 32 px) |
| Type | `--font` (Segoe UI Variable), `--font-num` (tabular), sizes `--fs-xs..xl` |

Default theme: dark, slate surfaces, blue accent (`#7EB0DE`), sunset-orange warm accent — carried over from the
Rainmeter bar.

## Layout

* Dashboard grid: 12 columns, row height 124 px, gap 12 px.
* Card sizes: **S** = 3×1, **M** = 6×1, **L** = 6×2, **XL** = 12×2 (columns × rows; row = 124 px). Cards declare which they support.
* Sidebar: 56 px wide, icons 20 px, tooltip with name, active page = accent tint.

## Units and formats (defaults, user-changeable)

Metric everywhere (°C, km/h, mm, km). 24-hour time (`HH:MM`). Dates `Tue 3 Nov`. Percentages one decimal for
markets, none elsewhere.

## Icons

One outline icon set (Tabler), bundled locally. Never mix icon sets or emoji.
