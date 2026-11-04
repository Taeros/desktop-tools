"""Clocks: UTC offsets for local time and the saved places. The UI ticks every second from these offsets."""

from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from desktop_tools.sdk import Field, Provider, State, ToolSettings, action


class ClocksSettings(ToolSettings):
    hidden: list[str] = Field(default_factory=list, title="Hidden places",
                              description="Saved places not shown on the clock",
                              json_schema_extra={"x-widget": "location-toggles"})
    show_seconds: bool = Field(False, title="Show seconds")


class Zone(State):
    id: str
    name: str
    region: str
    tz: str
    offset_min: int
    abbr: str
    hidden: bool


class ClocksState(State):
    local_tz: str
    local_offset_min: int
    zones: list[Zone]


def offset_of(tz: str, now: datetime) -> tuple[int, str]:
    try:
        z = now.astimezone(ZoneInfo(tz))
    except (ZoneInfoNotFoundError, ValueError):
        return 0, "UTC"
    off = z.utcoffset()
    return int(off.total_seconds() // 60) if off else 0, z.tzname() or ""


class Clocks(Provider[ClocksSettings, ClocksState]):
    Settings = ClocksSettings
    interval = 600  # offsets only change at DST transitions
    watches_app = ("locations",)

    async def refresh(self, ctx) -> ClocksState:
        now = datetime.now(UTC)
        local = now.astimezone()
        lo = local.utcoffset()
        hidden = set(ctx.settings.hidden)
        zones = []
        for loc in ctx.app.locations:
            off, abbr = offset_of(loc.tz, now)
            zones.append(Zone(id=loc.id, name=loc.name, region=loc.region, tz=loc.tz, offset_min=off, abbr=abbr,
                              hidden=loc.id in hidden))
        return ClocksState(local_tz=str(local.tzname() or ""), local_offset_min=int(lo.total_seconds() // 60) if lo else 0,
                           zones=zones)

    @action
    async def toggle(self, ctx, location_id: str) -> None:
        hidden = set(ctx.settings.hidden)
        hidden.symmetric_difference_update({location_id})
        await ctx.update_settings(hidden=sorted(hidden))
