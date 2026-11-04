# How to add a tool

This walkthrough builds a small **Countdown** tool (days until a date). Follow the same steps for any tool.

## 1. Scaffold

```
uv run scripts/new_tool.py countdown "Countdown" --icon hourglass
```

This creates `tools/countdown/` with a manifest, provider, settings, fake data, one card, and tests.

## 2. Describe settings (they become a form automatically)

```python
# tools/countdown/settings.py
from datetime import date
from desktop_tools.sdk import ToolSettings, Field

class CountdownSettings(ToolSettings):
    schema_version = 1
    label: str = Field("Graduation", title="Label")
    target: date = Field(date(2027, 5, 22), title="Date")
```

## 3. Produce state

```python
# tools/countdown/provider.py
from datetime import date
from desktop_tools.sdk import Provider, State

class CountdownState(State):
    label: str
    days: int

class Countdown(Provider[CountdownSettings, CountdownState]):
    interval = 3600
    async def refresh(self, ctx):
        s = ctx.settings
        return CountdownState(label=s.label, days=(s.target - ctx.clock.today()).days)
```

```python
# tools/countdown/fake.py — used in fake mode and tests
from .provider import CountdownState
FAKE = CountdownState(label="Graduation", days=200)
```

## 4. Render a card

```tsx
// tools/countdown/ui/DaysCard.tsx
import { defineCard, useProvider, Stat } from "@sdk";
export default defineCard({
  id: "days", sizes: ["S"],
  render: () => {
    const s = useProvider<CountdownState>("countdown");
    return <Stat value={s.days} unit="days" caption={s.label} />;
  },
});
```

## 5. Declare permissions and run

`manifest.json` → `"permissions": { "network": [], "system": [], "secrets": [] }` (this tool needs none).

```
uv run dt --fake          # see it with fake data
uv run pytest tools/countdown
uv run dt                 # real mode
```

The tool appears in Settings → Tools (approve it), then in the card picker of any dashboard.

## Checklist before opening a PR

- [ ] Imports only from `desktop_tools.sdk` / `@sdk`
- [ ] `fake.py` covers normal, empty and error-ish data
- [ ] Card looks right at every declared size in light and dark (screenshot test)
- [ ] Permissions are the minimum needed
- [ ] No secrets, no personal data in fixtures
- [ ] Settings model has `schema_version` and titles for every field
