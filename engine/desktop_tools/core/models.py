"""Data models owned by the core: app-wide settings, tool manifests, layout."""

from __future__ import annotations

import hashlib
import json
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from desktop_tools.sdk import Location

SCHEMA_VERSION = 2
DEFAULT_HOTKEY = "Ctrl+Alt+Shift+D"  # Ctrl+Alt+Space clashed with the Claude desktop app


# ---------------------------------------------------------------- app-wide (universal) settings
class ThemeSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    mode: Literal["dark", "light"] = Field("dark", title="Mode")
    accent: str = Field("#7EB0DE", title="Accent color", json_schema_extra={"format": "color"})
    warm: str = Field("#F08C46", title="Warm accent", json_schema_extra={"format": "color"})
    density: Literal["comfortable", "compact"] = Field("comfortable", title="Density")
    font_scale: float = Field(1.0, ge=0.8, le=1.4, title="Text size", json_schema_extra={"step": 0.05})
    radius: int = Field(10, ge=0, le=20, title="Corner radius")


class AppSettings(BaseModel):
    """Universal settings: things that belong to the app or are shared by several tools."""

    model_config = ConfigDict(extra="ignore")
    schema_version: int = SCHEMA_VERSION
    # General
    hotkey: str = Field(DEFAULT_HOTKEY, title="Summon hotkey", description="Shows or hides the control center from anywhere")
    start_at_login: bool = Field(True, title="Start at login")
    start_page: str = Field("home", title="Start page")
    # Units and formats
    units: Literal["metric", "imperial"] = Field("metric", title="Units")
    time_format: Literal["24h", "12h"] = Field("24h", title="Time format")
    date_style: Literal["day-month", "month-day"] = Field("day-month", title="Date style")
    first_day: Literal["monday", "sunday"] = Field("monday", title="First day of week")
    # Shared locations
    locations: list[Location] = Field(default_factory=list, title="Saved places",
                                      json_schema_extra={"x-widget": "locations"})
    use_my_location: bool = Field(True, title="Offer 'my location' (approximate, from IP address)")
    # Appearance
    theme: ThemeSettings = Field(default_factory=ThemeSettings, title="Appearance")
    # Tools: approvals are keyed by a hash of the permissions the user approved
    tools: dict[str, ToolPrefs] = Field(default_factory=dict)

    def location(self, location_id: str | None) -> Location | None:
        for loc in self.locations:
            if loc.id == location_id:
                return loc
        return self.locations[0] if self.locations else None


class ToolPrefs(BaseModel):
    enabled: bool = True
    approved: str = ""  # permissions hash the user approved


AppSettings.model_rebuild()

DEFAULT_LOCATIONS = [
    Location(id="west-point", name="West Point", region="NY", lat=41.3915, lon=-73.956, tz="America/New_York"),
    Location(id="smyrna", name="Smyrna", region="GA", lat=33.884, lon=-84.5144, tz="America/New_York"),
    Location(id="st-andrews", name="St Andrews", region="GB", lat=56.33871, lon=-2.79902, tz="Europe/London"),
    Location(id="bogota", name="Bogotá", region="Colombia", lat=4.60971, lon=-74.08175, tz="America/Bogota"),
]


# ---------------------------------------------------------------- tool manifest
class Permissions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    network: list[str] = []
    system: list[str] = []
    secrets: list[str] = []

    def digest(self) -> str:
        return hashlib.sha256(json.dumps(self.model_dump(), sort_keys=True).encode()).hexdigest()[:16]


class CardSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    sizes: list[Literal["S", "M", "L", "XL"]]
    surfaces: list[str] = ["control"]


class Manifest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(pattern=r"^[a-z][a-z0-9-]{1,30}$")
    name: str
    version: str
    description: str = ""
    icon: str = "box"
    category: str = "Tools"
    order: int = 100  # default position in the sidebar (lower = higher up)
    page: bool = True
    cards: list[CardSpec] = []
    permissions: Permissions = Permissions()


# ---------------------------------------------------------------- layout
class CardPlacement(BaseModel):
    i: str  # unique id within the dashboard
    card: str  # "<tool>/<card>"
    size: Literal["S", "M", "L", "XL"] = "M"
    x: int = 0
    y: int = 0


class Dashboard(BaseModel):
    cards: list[CardPlacement] = []


class SidebarEntry(BaseModel):
    id: str  # "home", "tool:weather", "dash:<uuid>"
    title: str
    icon: str
    hidden: bool = False


LAYOUT_VERSION = 2


class Layout(BaseModel):
    schema_version: int = LAYOUT_VERSION
    sidebar: list[SidebarEntry] = []
    dashboards: dict[str, Dashboard] = {}
