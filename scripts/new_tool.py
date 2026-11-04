"""Scaffold a new tool:  uv run scripts/new_tool.py <id> "<Name>" [--icon box]

Creates tools/<id>/ with a manifest, provider, settings, fake fixture mapping, one card, a page and a test.
See docs/TOOL_GUIDE.md for what to change next.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[1] / "tools"

PROVIDER = '''"""{name}: describe what this tool does and where its data comes from."""

from __future__ import annotations

from desktop_tools.sdk import Field, Provider, State, ToolSettings


class {cls}Settings(ToolSettings):
    label: str = Field("{name}", title="Label")


class {cls}State(State):
    label: str
    value: int


class {cls}(Provider[{cls}Settings, {cls}State]):
    Settings = {cls}Settings
    interval = 300

    async def refresh(self, ctx) -> {cls}State:
        # Network access: data = await ctx.http.get_json("https://<domain in manifest>/...")
        return {cls}State(label=ctx.settings.label, value=42)
'''

UI = '''import {{ defineCard, defineTool, Stat, useProvider, type CardProps }} from "@sdk";

interface S {{ label: string; value: number }}  // mirrors {cls}State

function Main({{ size }}: CardProps) {{
  const s = useProvider<S>("{id}");
  return <div><div className="card-title">{{s.label}}</div><Stat value={{s.value}} caption={{size === "S" ? undefined : "example"}} /></div>;
}}

function Page() {{
  return <section className="panel"><Main size="M" /></section>;
}}

export default defineTool({{ cards: [defineCard({{ id: "main", render: Main }})], Page }});
'''

TEST = '''async def test_refresh_returns_state():
    from dt_tools.{mod}.provider import {cls}, {cls}Settings

    class Ctx:
        settings = {cls}Settings()

    state = await {cls}().refresh(Ctx())
    assert state.value == 42
'''


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("id")
    ap.add_argument("name")
    ap.add_argument("--icon", default="box")
    a = ap.parse_args()
    if not re.match(r"^[a-z][a-z0-9-]{1,30}$", a.id):
        raise SystemExit("id must be lowercase letters, digits and dashes")
    folder = TOOLS / a.id
    if folder.exists():
        raise SystemExit(f"{folder} already exists")
    cls = "".join(p.capitalize() for p in a.id.split("-"))
    for sub in ("fixtures", "tests", "ui"):
        (folder / sub).mkdir(parents=True)
    (folder / "__init__.py").write_text("")
    manifest = {"id": a.id, "name": a.name, "version": "0.1.0", "description": "", "icon": a.icon,
                "category": "Tools", "order": 100, "page": True,
                "cards": [{"id": "main", "name": a.name, "sizes": ["S", "M"], "surfaces": ["control"]}],
                "permissions": {"network": [], "system": [], "secrets": []}}
    (folder / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (folder / "provider.py").write_text(PROVIDER.format(name=a.name, cls=cls))
    (folder / "fake.py").write_text('"""Recorded responses for fake mode: {"host/path": "file-in-fixtures.json"}."""\nFIXTURES: dict = {}\n')
    (folder / "ui" / "index.tsx").write_text(UI.format(cls=cls, id=a.id))
    (folder / "tests" / f"test_{a.id.replace('-', '_')}.py").write_text(TEST.format(cls=cls, mod=a.id.replace("-", "_")))
    print(f"Created {folder}. Next: edit provider.py, then `uv run dt --fake` and approve it in Settings → Tools.")


if __name__ == "__main__":
    main()
