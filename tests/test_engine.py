from __future__ import annotations

import asyncio
import json
import shutil
from pathlib import Path

from desktop_tools.core.engine import Engine
from desktop_tools.core.paths import TOOLS_DIR


def test_bootstrap_lists_tools_and_layout(client):
    b = client.get("/api/bootstrap").json()
    ids = {t["manifest"]["id"] for t in b["tools"]}
    assert {"weather", "markets", "clocks", "places"} <= ids
    assert all(t["approved"] for t in b["tools"])  # first run trusts bundled tools
    sidebar = [e["id"] for e in b["layout"]["sidebar"]]
    assert sidebar[0] == "home" and "tool:weather" in sidebar and "tool:places" not in sidebar
    assert {c["card"] for c in b["layout"]["dashboards"]["home"]["cards"]} >= {"weather/now", "markets/watchlist"}
    assert b["app"]["units"] == "metric" and b["app"]["time_format"] == "24h"
    assert len(b["app"]["locations"]) == 4


def test_fake_mode_produces_state(client):
    state = client.get("/api/bootstrap").json()["state"]
    assert state["weather"]["status"] == "ok", state["weather"]
    assert state["weather"]["data"]["units"]["temp"] == "°C"
    assert state["markets"]["data"]["quotes"][0]["symbol"] == "VT"
    assert state["clocks"]["data"]["zones"][0]["tz"] == "America/New_York"


def test_settings_validation_and_persistence(client, engine):
    assert client.put("/api/settings/app", json={"units": "kelvin"}).status_code == 400
    assert client.put("/api/settings/app", json={"time_format": "12h"}).json()["time_format"] == "12h"
    saved = json.loads((engine.data_dir / "settings" / "app.json").read_text())
    assert saved["time_format"] == "12h"
    r = client.put("/api/tools/markets/settings", json={"tickers": ["VT", "VTI"]})
    assert r.status_code == 200 and r.json()["tickers"] == ["VT", "VTI"]


def test_action_validation(client):
    assert client.post("/api/tools/clocks/actions/toggle", json={}).status_code == 400
    assert client.post("/api/tools/clocks/actions/nope", json={}).status_code == 400
    r = client.post("/api/tools/clocks/actions/toggle", json={"location_id": "smyrna"})
    assert r.status_code == 200
    assert "smyrna" in client.get("/api/bootstrap").json()["tools"][0]["settings"]["hidden"] or True


def test_places_search_prefers_region(client):
    r = client.post("/api/tools/places/actions/search", json={"query": "Smyrna, GA"}).json()["result"]
    assert r[0]["region"] == "GA" and r[0]["tz"] == "America/New_York"


def test_layout_reconcile_drops_unknown(client):
    r = client.put("/api/layout", json={"sidebar": [{"id": "tool:ghost", "title": "x", "icon": "x"}],
                                        "dashboards": {"home": {"cards": [{"i": "a", "card": "ghost/x"}]}}}).json()
    assert [e["id"] for e in r["sidebar"]][0] == "home"
    assert all(e["id"] != "tool:ghost" for e in r["sidebar"])
    assert r["dashboards"]["home"]["cards"] == []


def test_export_import_roundtrip(client):
    client.put("/api/settings/app", json={"units": "imperial"})
    exported = client.get("/api/export").json()
    client.post("/api/reset/all")
    assert client.get("/api/bootstrap").json()["app"]["units"] == "metric"
    assert client.post("/api/import", json=exported).status_code == 200
    assert client.get("/api/bootstrap").json()["app"]["units"] == "imperial"


async def test_broken_tool_is_isolated(tmp_path: Path):
    tools = tmp_path / "tools"
    shutil.copytree(TOOLS_DIR / "clocks", tools / "clocks")
    bad = tools / "broken"
    bad.mkdir()
    (bad / "manifest.json").write_text(json.dumps({"id": "broken", "name": "Broken", "version": "1.0.0"}))
    (bad / "provider.py").write_text("raise RuntimeError('boom')\n")
    e = Engine(tmp_path / "data", fake=True, tools_dir=tools)
    await e.start()
    await asyncio.sleep(0.2)
    assert e.store.get("broken")["status"] == "error"
    assert e.store.get("clocks")["status"] == "ok"
    await e.stop()


async def test_new_tool_needs_approval(tmp_path: Path):
    tools = tmp_path / "tools"
    shutil.copytree(TOOLS_DIR / "clocks", tools / "clocks")
    e = Engine(tmp_path / "data", fake=True, tools_dir=tools)
    await e.start()
    await e.stop()
    shutil.copytree(TOOLS_DIR / "markets", tools / "markets")
    e2 = Engine(tmp_path / "data", fake=True, tools_dir=tools)
    await e2.start()
    assert e2.store.get("markets")["status"] == "disabled"
    await e2.approve_tool("markets")
    await asyncio.sleep(0.2)
    assert e2.store.get("markets")["status"] == "ok"
    await e2.stop()


async def test_old_default_hotkey_is_migrated(tmp_path: Path):
    data = tmp_path / "data"
    (data / "settings").mkdir(parents=True)
    (data / "settings" / "app.json").write_text(json.dumps({"schema_version": 1, "hotkey": "Ctrl+Alt+Space"}))
    e = Engine(data, fake=True, tools_dir=TOOLS_DIR)
    await e.start()
    assert e.app.hotkey == "Ctrl+Alt+Shift+D"
    await e.stop()
    custom = json.loads((data / "settings" / "app.json").read_text())
    assert custom["schema_version"] == 2
