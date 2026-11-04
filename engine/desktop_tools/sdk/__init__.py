"""The public API for tools. Tools may import ONLY from this package (see docs/TOOL_GUIDE.md).

Everything here is a stability boundary: changing it requires an ADR in docs/adr/.
"""

from __future__ import annotations

import inspect
from collections.abc import Awaitable, Callable
from datetime import date, datetime
from typing import Any, ClassVar, Generic, Protocol, TypeVar

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "Field",
    "State",
    "ToolSettings",
    "Provider",
    "action",
    "Context",
    "Http",
    "Secrets",
    "AppView",
    "Location",
    "ToolError",
]


class ToolError(Exception):
    """Raise for expected, user-explainable failures (shown on the card as one line)."""


class State(BaseModel):
    """Base class for the data a provider publishes. Must be JSON-serialisable."""

    model_config = ConfigDict(extra="forbid")


class ToolSettings(BaseModel):
    """Base class for a tool's user-editable settings. The UI renders a form from its JSON Schema.

    Give every field a `title` (and `description` where useful). Bump `schema_version` when the shape
    changes and implement `migrate`.
    """

    model_config = ConfigDict(extra="ignore", validate_assignment=True)
    schema_version: ClassVar[int] = 1

    @classmethod
    def migrate(cls, data: dict[str, Any], from_version: int) -> dict[str, Any]:
        """Upgrade stored settings written by an older schema_version. Default: keep what still fits."""
        return data


class Location(BaseModel):
    """A saved place, shared by all tools (managed in the universal Settings page)."""

    id: str
    name: str
    region: str = ""
    lat: float
    lon: float
    tz: str = Field("UTC", description="IANA time zone, e.g. America/New_York")


class AppView(Protocol):
    """Read-only view of app-wide settings that tools may use."""

    @property
    def units(self) -> str: ...  # "metric" | "imperial"
    @property
    def time_format(self) -> str: ...  # "24h" | "12h"
    @property
    def locations(self) -> list[Location]: ...
    def location(self, location_id: str | None) -> Location | None: ...


class Http(Protocol):
    """Network access restricted to the domains in the tool's manifest."""

    async def get_json(self, url: str, params: dict[str, Any] | None = None,
                       headers: dict[str, str] | None = None) -> Any: ...


class Secrets(Protocol):
    """Access to secrets declared in the manifest. Values never leave the engine."""

    def get(self, name: str) -> str | None: ...


class Clock(Protocol):
    def now(self) -> datetime: ...
    def today(self) -> date: ...


class Context(Protocol):
    tool_id: str
    settings: Any  # the tool's ToolSettings instance (typed by the Provider generic)
    app: AppView
    http: Http
    secrets: Secrets
    clock: Clock
    log: Any  # logging.Logger with secret redaction

    async def update_settings(self, **changes: Any) -> None: ...
    def request_refresh(self) -> None: ...


S = TypeVar("S", bound=ToolSettings)
T = TypeVar("T", bound=State)


def action(fn: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
    """Mark a provider coroutine method as an action callable from the UI.

    Signature: `async def name(self, ctx, **typed_kwargs) -> JSON-serialisable | None`. Arguments are
    validated against the type hints before the call.
    """
    if not inspect.iscoroutinefunction(fn):
        raise TypeError(f"@action {fn.__name__} must be async")
    fn.__dt_action__ = True  # type: ignore[attr-defined]
    return fn


class Provider(Generic[S, T]):
    """Base class for a tool's background logic.

    Subclasses set `Settings` (a ToolSettings subclass) and implement `refresh`. The core calls `refresh`
    every `interval` seconds (and when settings change or `ctx.request_refresh()` is called), publishes the
    returned State, and isolates failures from the rest of the app.
    """

    Settings: ClassVar[type[ToolSettings]] = ToolSettings
    interval: ClassVar[float] = 60.0
    #: Settings keys of the *app* (e.g. "units", "locations") whose change should trigger a refresh.
    watches_app: ClassVar[tuple[str, ...]] = ()

    async def refresh(self, ctx: Context) -> T:  # pragma: no cover - abstract
        raise NotImplementedError

    @classmethod
    def actions(cls) -> dict[str, Callable[..., Awaitable[Any]]]:
        out = {}
        for name, member in inspect.getmembers(cls, predicate=inspect.iscoroutinefunction):
            if getattr(member, "__dt_action__", False):
                out[name] = member
        return out
