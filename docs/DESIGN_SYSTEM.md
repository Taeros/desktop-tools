# Design system

Aesthetic is priority #5, but consistency is cheap if it is decided once. These rules apply to every surface.

## Principles

1. **Numbers first.** Lead with the value in the display face; label in smaller, muted text. Tabular numerals everywhere.
2. **Compact, not minimal.** Cards answer one question at a glance but may carry icons, small charts and secondary
   facts. Detail lives on the tool's page. (Revised 2026-11-03: the strict Rainmeter-era minimalism no longer applies.)
3. **One bold element: the dusk range.** The cool→warm gradient (`--cool` → `--warm`) is reserved for data that spans
   cold to warm, such as the 7-day temperature range bars, where one gradient spans the whole week so a colour means the
   same temperature on every row. Don't use it as decoration.
4. **Colour means something.** Weather icons are tinted by condition (sun warm, moon pale, rain blue, snow ice, cloud
   grey). Markets use up/down green/red with trend arrows. Sky blue (`--accent`) marks interaction and rain.
5. **Calm.** Flat surfaces, hairline borders, no glow. Sentence-case card titles with an icon, never all-caps labels.
   Motion ≤ 150 ms and only in response to an action.
6. **No jumps.** Fixed card sizes; skeletons reserve space while loading; numbers don't change width.
7. **Every state designed.** Loading (skeleton), stale (dimmed + "updated 12 min ago"), error (one line + retry), empty (invitation + action).

## Typography

* **Display / numbers:** Barlow Semi Condensed (OFL, bundled in the app so it renders identically everywhere) at 300–600.
* **Text:** Segoe UI Variable (system), falling back to system-ui.

## Shared components (`@sdk`)

`CardTitle` (icon + title + detail), `Fact` (icon, label, value), `RangeBar`, `Bars` (mini bar chart), `Sparkline`
(optionally filled), `Stat`, `Segmented`, `Badge`, `Empty`. Use these before writing new markup.

## Tokens (CSS variables, themeable from the UI)

| Group | Tokens |
|-------|--------|
| Surfaces | `--bg` #11151D, `--surface-1` #181D27, `--surface-2` #212734, `--overlay` |
| Text | `--text`, `--text-2` (secondary), `--text-3` (muted) |
| Accent and semantic | `--accent` (sky), `--warm` (sunset), `--cool`, `--day`, `--night`, `--up`, `--down` |
| Shape | `--radius` (default 10px), `--border` (hairline) |
| Space | `--space-1..6` (4, 8, 12, 16, 24, 32 px) |
| Type | `--font` (Segoe UI Variable), `--font-display` (Barlow Semi Condensed), `--fs`, `--scale` |

Default theme: dark, slate surfaces, blue accent (`#7EB0DE`), sunset-orange warm accent — carried over from the
Rainmeter bar.

## Layout

* Dashboard grid: 12 columns, row height 140 px, gap 12 px.
* Card sizes: **S** = 3×1, **M** = 6×1, **L** = 6×2, **XL** = 12×2 (columns × rows; row = 140 px). Cards declare which they support.
* Sidebar: 56 px wide, icons 20 px, tooltip with name, active page = accent tint.

## Units and formats (defaults, user-changeable)

Metric everywhere (°C, km/h, mm, km). 24-hour time (`HH:MM`). Dates `Tue 3 Nov`. Percentages one decimal for
markets, none elsewhere.

## Icons

One outline icon set (Tabler), bundled locally. Never mix icon sets or emoji.
