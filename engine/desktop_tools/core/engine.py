"""The engine: loads tools, runs their providers in isolation, owns settings/layout, and serves the API layer."""

from __future__ import annotations

import asyncio
import logging
import typing
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError, create_model

from desktop_tools import __version__
from desktop_tools.core import paths
from desktop_tools.core.logs import memory as log_memory
from desktop_tools.core.models import (
    DEFAULT_HOTKEY,
    DEFAULT_LOCATIONS,
    SCHEMA_VERSION,
    AppSettings,
    CardPlacement,
    Dashboard,
    Layout,
    SidebarEntry,
    ToolPrefs,
)
from desktop_tools.core.net import FakeHttp, SafeHttp
from desktop_tools.core.registry import LoadedTool, discover
from desktop_tools.core.secrets import SecretStore, ToolSecrets
from desktop_tools.core.storage import read_json, write_json
from desktop_tools.core.store import StateStore
from desktop_tools.sdk import Location, Provider, ToolError, ToolSettings

log = logging.getLogger("desktop_tools.engine")


# The v0.1 default Home dashboard; replaced by the new default if the user never changed it.
V1_HOME = sorted([("clocks/world", "M"), ("markets/watchlist", "M"), ("weather/now", "M"), ("weather/week", "M")])


class EngineError(Exception):
    """Raised for bad API requests (becomes HTTP 400)."""


class SystemClock:
    def now(self) -> datetime:
        return datetime.now().astimezone()

    def today(self) -> date:
        return date.today()


class AppView:
    """Read-only app settings as seen by tools."""

    def __init__(self, engine: Engine) -> None:
        self._e = engine

    @property
    def units(self) -> str:
        return self._e.app.units

    @property
    def time_format(self) -> str:
        return self._e.app.time_format

    @property
    def locations(self) -> list[Location]:
        return list(self._e.app.locations)

    def location(self, location_id: str | None) -> Location | None:
        return self._e.app.location(location_id)


class ToolContext:
    def __init__(self, engine: Engine, runner: ToolRunner) -> None:
        self._e, self._r = engine, runner
        t = runner.tool
        self.tool_id = t.id
        self.app = AppView(engine)
        self.clock = SystemClock()
        self.log = logging.getLogger(f"tool.{t.id}")
        self.secrets = ToolSecrets(engine.secrets, t.id, t.manifest.permissions.secrets)
        perms = t.manifest.permissions.network
        self.http = (FakeHttp(t.id, perms, t.path, t.fixtures) if engine.fake
                     else SafeHttp(t.id, perms, engine.http_client))

    @property
    def settings(self) -> ToolSettings:
        return self._r.settings

    async def update_settings(self, **changes: Any) -> None:
        await self._e.update_tool_settings(self.tool_id, {**self._r.settings.model_dump(mode="json"), **changes})

    def request_refresh(self) -> None:
        self._r.wake()


class ToolRunner:
    """Runs one provider: periodic refresh, wake-ups, error backoff. Failures stay inside this runner."""

    def __init__(self, engine: Engine, tool: LoadedTool, settings: ToolSettings) -> None:
        assert tool.provider_cls is not None
        self.engine, self.tool, self.settings = engine, tool, settings
        self.provider: Provider = tool.provider_cls()
        self.ctx = ToolContext(engine, self)
        self._wake = asyncio.Event()
        self._task: asyncio.Task | None = None
        self.failures = 0

    @property
    def interval(self) -> float:
        return float(self.tool.provider_cls.interval)  # type: ignore[union-attr]

    def start(self) -> None:
        self._task = asyncio.create_task(self._loop(), name=f"tool:{self.tool.id}")

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass

    def wake(self) -> None:
        self._wake.set()

    async def _loop(self) -> None:
        store, tid = self.engine.store, self.tool.id
        store.set_status(tid, "loading", interval=self.interval)
        while True:
            self._wake.clear()
            try:
                state = await asyncio.wait_for(self.provider.refresh(self.ctx), timeout=60)
                store.publish(tid, state.model_dump(mode="json"), self.interval)
                self.failures = 0
                delay = self.interval
            except asyncio.CancelledError:
                raise
            except ToolError as exc:
                self.failures += 1
                store.fail(tid, str(exc), self.interval)
                log.warning("%s: %s", tid, exc)
                delay = min(self.interval, 15 * 2 ** min(self.failures, 5))
            except Exception as exc:  # noqa: BLE001
                self.failures += 1
                store.fail(tid, "Something went wrong. See System health for details.", self.interval)
                log.exception("%s refresh failed: %s", tid, exc)
                delay = min(self.interval, 15 * 2 ** min(self.failures, 5))
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=max(delay, 1))
            except TimeoutError:
                pass

    async def call(self, name: str, args: dict[str, Any]) -> Any:
        fn = self.tool.provider_cls.actions().get(name)  # type: ignore[union-attr]
        if fn is None:
            raise EngineError(f"{self.tool.id} has no action '{name}'")
        hints = typing.get_type_hints(fn)
        import inspect  # noqa: PLC0415

        fields = {}
        for p in list(inspect.signature(fn).parameters.values())[2:]:  # skip self, ctx
            ann = hints.get(p.name, Any)
            fields[p.name] = (ann, ... if p.default is inspect.Parameter.empty else p.default)
        model: type[BaseModel] = create_model(f"{self.tool.id}_{name}_args", **fields)  # type: ignore[call-overload]
        try:
            parsed = model.model_validate(args)
        except ValidationError as exc:
            raise EngineError(f"Invalid arguments for {name}: {exc.errors()[0]['msg']}") from exc
        try:
            return await fn(self.provider, self.ctx, **parsed.model_dump())
        except ToolError as exc:
            raise EngineError(str(exc)) from exc


class Engine:
    def __init__(self, data_dir: Path, fake: bool = False, tools_dir: Path = paths.TOOLS_DIR) -> None:
        self.data_dir = paths.ensure_data_dir(data_dir)
        self.fake, self.tools_dir = fake, tools_dir
        self.store = StateStore()
        self.secrets = SecretStore(memory_only=fake)
        self.tools: dict[str, LoadedTool] = {}
        self.runners: dict[str, ToolRunner] = {}
        self.tool_settings: dict[str, ToolSettings] = {}
        self.app = AppSettings()
        self.layout = Layout()
        self.http_client: httpx.AsyncClient | None = None
        self._lock = asyncio.Lock()
        self.loop: asyncio.AbstractEventLoop | None = None
        # Reported by the Windows shell, e.g. {"hotkey": "active"|"conflict"|"invalid", "hotkey_text": "..."}
        self.shell_status: dict[str, Any] = {}

    def set_shell_status(self, **values: Any) -> None:
        """Thread-safe: called from the shell's threads."""
        self.shell_status.update(values)
        if self.loop:
            self.loop.call_soon_threadsafe(self.store.broadcast, {"type": "shell", "shell": dict(self.shell_status)})

    # ------------------------------------------------------------ files
    @property
    def _app_file(self) -> Path:
        return self.data_dir / "settings" / "app.json"

    @property
    def _layout_file(self) -> Path:
        return self.data_dir / "layout.json"

    def _tool_file(self, tool_id: str) -> Path:
        return self.data_dir / "settings" / f"{tool_id}.json"

    # ------------------------------------------------------------ lifecycle
    async def start(self) -> None:
        self.loop = asyncio.get_running_loop()
        self.http_client = httpx.AsyncClient(timeout=httpx.Timeout(15.0), follow_redirects=False)
        raw = read_json(self._app_file)
        first_run = raw is None
        try:
            self.app = AppSettings.model_validate(raw or {})
        except ValidationError as exc:
            log.warning("App settings invalid (%s); using defaults", exc.errors()[0]["msg"])
            self.app = AppSettings()
        if first_run:
            self.app.locations = list(DEFAULT_LOCATIONS)
        elif int((raw or {}).get("schema_version", 1)) < 2 and self.app.hotkey == "Ctrl+Alt+Space":
            self.app.hotkey = DEFAULT_HOTKEY  # v1 default clashed with the Claude desktop app
        self.app.schema_version = SCHEMA_VERSION

        for tool in discover(self.tools_dir):
            self.tools[tool.id] = tool
            prefs = self.app.tools.get(tool.id)
            if prefs is None:
                # Tools present on first run ship with the app and are trusted; later additions need approval.
                prefs = ToolPrefs(enabled=True, approved=tool.manifest.permissions.digest() if first_run else "")
                self.app.tools[tool.id] = prefs
            if tool.provider_cls:
                self.tool_settings[tool.id] = self._load_tool_settings(tool)
        self._save_app()
        raw_layout = read_json(self._layout_file) or {}
        if int(raw_layout.get("schema_version", 1)) < 2:
            home = (raw_layout.get("dashboards") or {}).get("home", {}).get("cards", [])
            if sorted((c.get("card"), c.get("size")) for c in home) == V1_HOME:
                raw_layout.get("dashboards", {}).pop("home", None)  # untouched v1 default -> new default
        raw_layout["schema_version"] = 2
        self.layout = self._reconcile_layout(Layout.model_validate(raw_layout))
        write_json(self._layout_file, self.layout.model_dump())
        for tool in self.tools.values():
            self._start_or_block(tool)
        log.info("Engine started (%s mode) with %d tools", "fake" if self.fake else "live", len(self.tools))

    async def stop(self) -> None:
        for r in list(self.runners.values()):
            await r.stop()
        self.runners.clear()
        if self.http_client:
            await self.http_client.aclose()

    def _start_or_block(self, tool: LoadedTool) -> None:
        tid = tool.id
        if tid in self.runners:
            return
        if tool.error or not tool.provider_cls:
            self.store.set_status(tid, "error", tool.error or "Tool failed to load")
            return
        prefs = self.app.tools[tid]
        if not prefs.enabled:
            self.store.set_status(tid, "disabled", "Disabled in Settings")
            return
        if prefs.approved != tool.manifest.permissions.digest():
            self.store.set_status(tid, "disabled", "Waiting for you to approve its permissions in Settings")
            return
        runner = ToolRunner(self, tool, self.tool_settings[tid])
        self.runners[tid] = runner
        runner.start()

    async def _stop_tool(self, tool_id: str, reason: str) -> None:
        runner = self.runners.pop(tool_id, None)
        if runner:
            await runner.stop()
        self.store.set_status(tool_id, "disabled", reason)

    # ------------------------------------------------------------ settings
    def _load_tool_settings(self, tool: LoadedTool) -> ToolSettings:
        cls = tool.provider_cls.Settings  # type: ignore[union-attr]
        raw = read_json(self._tool_file(tool.id)) or {}
        stored_version = int(raw.pop("_schema_version", cls.schema_version))
        if stored_version < cls.schema_version:
            raw = cls.migrate(raw, stored_version)
        try:
            return cls.model_validate(raw)
        except ValidationError as exc:
            log.warning("%s settings invalid (%s); using defaults", tool.id, exc.errors()[0]["msg"])
            return cls()

    def _save_tool_settings(self, tool_id: str) -> None:
        s = self.tool_settings[tool_id]
        write_json(self._tool_file(tool_id), {"_schema_version": type(s).schema_version, **s.model_dump(mode="json")})

    def _save_app(self) -> None:
        write_json(self._app_file, self.app.model_dump(mode="json"))

    async def update_app_settings(self, values: dict[str, Any]) -> dict[str, Any]:
        async with self._lock:
            merged = {**self.app.model_dump(mode="json"), **values, "tools": self.app.model_dump(mode="json")["tools"]}
            try:
                new = AppSettings.model_validate(merged)
            except ValidationError as exc:
                raise EngineError(f"Invalid setting: {exc.errors()[0]['loc']} {exc.errors()[0]['msg']}") from exc
            changed = {k for k in values if getattr(self.app, k, None) != getattr(new, k, None)}
            self.app = new
            self._save_app()
        for runner in self.runners.values():
            if changed & set(runner.tool.provider_cls.watches_app):  # type: ignore[union-attr]
                runner.wake()
        self.store.broadcast({"type": "app", "app": self.app_public()})
        return self.app_public()

    async def update_tool_settings(self, tool_id: str, values: dict[str, Any]) -> dict[str, Any]:
        if tool_id not in self.tool_settings:
            raise EngineError(f"Unknown tool {tool_id}")
        cls = type(self.tool_settings[tool_id])
        try:
            new = cls.model_validate(values)
        except ValidationError as exc:
            raise EngineError(f"Invalid setting: {exc.errors()[0]['loc']} {exc.errors()[0]['msg']}") from exc
        self.tool_settings[tool_id] = new
        if tool_id in self.runners:
            self.runners[tool_id].settings = new
            self.runners[tool_id].wake()
        self._save_tool_settings(tool_id)
        payload = new.model_dump(mode="json")
        self.store.broadcast({"type": "tool_settings", "tool": tool_id, "settings": payload})
        return payload

    # ------------------------------------------------------------ tools management
    async def set_tool_enabled(self, tool_id: str, enabled: bool) -> None:
        tool = self._tool(tool_id)
        self.app.tools[tool_id].enabled = enabled
        self._save_app()
        if enabled:
            self._start_or_block(tool)
        else:
            await self._stop_tool(tool_id, "Disabled in Settings")
        self.store.broadcast({"type": "app", "app": self.app_public()})

    async def approve_tool(self, tool_id: str) -> None:
        tool = self._tool(tool_id)
        self.app.tools[tool_id].approved = tool.manifest.permissions.digest()
        self._save_app()
        self._start_or_block(tool)
        self.store.broadcast({"type": "app", "app": self.app_public()})

    def refresh_tool(self, tool_id: str) -> None:
        if tool_id in self.runners:
            self.runners[tool_id].wake()

    async def call_action(self, tool_id: str, name: str, args: dict[str, Any]) -> Any:
        runner = self.runners.get(tool_id)
        if not runner:
            raise EngineError(f"{tool_id} is not running")
        return await runner.call(name, args)

    def set_secret(self, tool_id: str, name: str, value: str | None) -> None:
        tool = self._tool(tool_id)
        if name not in tool.manifest.permissions.secrets:
            raise EngineError(f"'{name}' is not a declared secret of {tool_id}")
        self.secrets.set(tool_id, name, value)
        self.refresh_tool(tool_id)

    def _tool(self, tool_id: str) -> LoadedTool:
        if tool_id not in self.tools:
            raise EngineError(f"Unknown tool {tool_id}")
        return self.tools[tool_id]

    # ------------------------------------------------------------ layout
    def _reconcile_layout(self, layout: Layout) -> Layout:
        known = {f"tool:{t.id}" for t in self.tools.values() if t.manifest.page}
        entries = [e for e in layout.sidebar
                   if e.id == "home" or e.id in known or (e.id.startswith("dash:") and e.id[5:] in layout.dashboards)]
        ids = {e.id for e in entries}
        if "home" not in ids:
            entries.insert(0, SidebarEntry(id="home", title="Home", icon="home"))
        for t in sorted(self.tools.values(), key=lambda x: (x.manifest.order, x.manifest.name)):
            if t.manifest.page and f"tool:{t.id}" not in ids:
                entries.append(SidebarEntry(id=f"tool:{t.id}", title=t.manifest.name, icon=t.manifest.icon))
        cards = {f"{t.id}/{c.id}" for t in self.tools.values() for c in t.manifest.cards}
        dashboards = {k: Dashboard(cards=[c for c in d.cards if c.card in cards]) for k, d in layout.dashboards.items()}
        if "home" not in dashboards:
            dashboards["home"] = Dashboard(cards=self._default_home(cards))
        return Layout(sidebar=entries, dashboards=dashboards)

    @staticmethod
    def _default_home(available: set[str]) -> list[CardPlacement]:
        wanted = [("weather/now", "L", 0, 0), ("clocks/world", "L", 6, 0),
                  ("weather/week", "L", 0, 2), ("markets/watchlist", "L", 6, 2)]
        return [CardPlacement(i=uuid.uuid4().hex[:8], card=c, size=s, x=x, y=y)  # type: ignore[arg-type]
                for c, s, x, y in wanted if c in available]

    async def set_layout(self, data: dict[str, Any]) -> dict[str, Any]:
        try:
            layout = Layout.model_validate(data)
        except ValidationError as exc:
            raise EngineError(f"Invalid layout: {exc.errors()[0]['msg']}") from exc
        self.layout = self._reconcile_layout(layout)
        write_json(self._layout_file, self.layout.model_dump())
        self.store.broadcast({"type": "layout", "layout": self.layout.model_dump()})
        return self.layout.model_dump()

    # ------------------------------------------------------------ export / import / reset
    def export_all(self) -> dict[str, Any]:
        return {"format": "desktop-tools-settings", "version": 1, "app": self.app.model_dump(mode="json"),
                "tools": {k: v.model_dump(mode="json") for k, v in self.tool_settings.items()},
                "layout": self.layout.model_dump()}

    async def import_all(self, data: dict[str, Any]) -> None:
        if data.get("format") != "desktop-tools-settings":
            raise EngineError("That file is not a Desktop Tools settings export")
        app = dict(data.get("app") or {})
        app.pop("tools", None)  # permissions approvals are never imported
        await self.update_app_settings(app)
        for tid, values in (data.get("tools") or {}).items():
            if tid in self.tool_settings:
                await self.update_tool_settings(tid, values)
        await self.set_layout(data.get("layout") or {})

    async def reset(self, scope: str) -> None:
        if scope == "layout":
            await self.set_layout({})
        elif scope in self.tool_settings:
            await self.update_tool_settings(scope, {})
        elif scope == "all":
            keep_tools = self.app.model_dump(mode="json")["tools"]
            await self.update_app_settings({**AppSettings().model_dump(mode="json"),
                                            "locations": [loc.model_dump() for loc in DEFAULT_LOCATIONS]})
            self.app.tools = {k: ToolPrefs(**v) for k, v in keep_tools.items()}
            for tid in list(self.tool_settings):
                await self.update_tool_settings(tid, {})
            await self.set_layout({})
        else:
            raise EngineError(f"Unknown reset scope {scope}")

    # ------------------------------------------------------------ views for the API
    def app_public(self) -> dict[str, Any]:
        return self.app.model_dump(mode="json")

    def bootstrap(self) -> dict[str, Any]:
        tools = []
        for t in self.tools.values():
            prefs = self.app.tools.get(t.id, ToolPrefs())
            s = self.tool_settings.get(t.id)
            tools.append({
                "manifest": t.manifest.model_dump(),
                "enabled": prefs.enabled,
                "approved": prefs.approved == t.manifest.permissions.digest(),
                "error": t.error,
                "settings": s.model_dump(mode="json") if s else None,
                "settings_schema": type(s).model_json_schema() if s else None,
                "actions": sorted(t.provider_cls.actions()) if t.provider_cls else [],
                "secrets": {n: self.secrets.is_set(t.id, n) for n in t.manifest.permissions.secrets},
            })
        return {
            "version": __version__,
            "fake": self.fake,
            "app": self.app_public(),
            "app_schema": AppSettings.model_json_schema(),
            "layout": self.layout.model_dump(),
            "tools": tools,
            "state": self.store.snapshot(),
            "data_dir": str(self.data_dir),
            "shell": dict(self.shell_status),
        }

    def health(self) -> dict[str, Any]:
        return {"state": {k: {kk: vv for kk, vv in v.items() if kk != "data"} for k, v in self.store.snapshot().items()},
                "logs": list(log_memory.records)[-200:]}
