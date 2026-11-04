"""Weather from Open-Meteo (no API key). Publishes numbers and ISO times; the UI formats them (units, 12/24 h)."""

from __future__ import annotations

import math
import time

from desktop_tools.sdk import Field, Provider, State, ToolError, ToolSettings, action

FORECAST = "https://api.open-meteo.com/v1/forecast"

# WMO weather code -> (label, icon, precipitation kind)
WMO: dict[int, tuple[str, str, str | None]] = {
    0: ("Clear", "sun", None), 1: ("Mostly clear", "sun", None), 2: ("Partly cloudy", "cloud-sun", None),
    3: ("Overcast", "cloud", None), 45: ("Fog", "mist", None), 48: ("Freezing fog", "mist", None),
    51: ("Light drizzle", "cloud-rain", "rain"), 53: ("Drizzle", "cloud-rain", "rain"),
    55: ("Heavy drizzle", "cloud-rain", "rain"), 56: ("Freezing drizzle", "cloud-rain", "ice"),
    57: ("Freezing drizzle", "cloud-rain", "ice"), 61: ("Light rain", "cloud-rain", "rain"),
    63: ("Rain", "cloud-rain", "rain"), 65: ("Heavy rain", "cloud-rain", "rain"),
    66: ("Freezing rain", "cloud-rain", "ice"), 67: ("Freezing rain", "cloud-rain", "ice"),
    71: ("Light snow", "snowflake", "snow"), 73: ("Snow", "snowflake", "snow"), 75: ("Heavy snow", "snowflake", "snow"),
    77: ("Snow grains", "snowflake", "snow"), 80: ("Light showers", "cloud-rain", "rain"),
    81: ("Showers", "cloud-rain", "rain"), 82: ("Heavy showers", "cloud-rain", "rain"),
    85: ("Snow showers", "snowflake", "snow"), 86: ("Heavy snow showers", "snowflake", "snow"),
    95: ("Thunderstorms", "cloud-storm", "storm"), 96: ("T-storms, hail", "cloud-storm", "storm"),
    99: ("T-storms, hail", "cloud-storm", "storm"),
}
KIND_RANK = {"rain": 1, "snow": 2, "ice": 3, "storm": 4}
KIND_NAME = {"rain": "Rain", "snow": "Snow", "ice": "Freezing rain", "storm": "Thunderstorms"}
SYNODIC, KNOWN_NEW_MOON = 29.530588853, 947182440  # days; 2000-01-06 18:14 UTC


def uv_level(x: float | None) -> str:
    if x is None:
        return "--"
    x = round(x)
    return "Low" if x <= 2 else "Moderate" if x <= 5 else "High" if x <= 7 else "Very high" if x <= 10 else "Extreme"


def moon(now_ts: float) -> tuple[float, str]:
    age = ((now_ts - KNOWN_NEW_MOON) / 86400) % SYNODIC
    lit = (1 - math.cos(2 * math.pi * age / SYNODIC)) / 2
    names = [(1, "New moon"), (6.4, "Waxing crescent"), (8.4, "First quarter"), (13.8, "Waxing gibbous"),
             (15.8, "Full moon"), (21.1, "Waning gibbous"), (23.1, "Last quarter"), (28.5, "Waning crescent")]
    phase = next((n for limit, n in names if age < limit), "New moon")
    return lit, phase


class WeatherSettings(ToolSettings):
    location_id: str = Field("", title="Location", description="A saved place, or 'My location'",
                             json_schema_extra={"x-widget": "location", "x-allow-me": True})


class Now(State):
    temp: float
    feels: float
    code: int
    condition: str
    icon: str
    is_day: bool
    wind: float
    gust: float
    humidity: float
    uv: float | None


class Today(State):
    high: float
    low: float
    uv_max: float | None
    uv_now_level: str
    uv_max_level: str
    sunrise: str
    sunset: str


class Outlook(State):
    kind: str | None  # rain | snow | ice | storm | None (dry)
    label: str
    start: str | None
    end: str | None  # None = continues past 24 h
    max_pop: float
    freezing: bool
    gust_warning: float | None


class NightLight(State):
    percent: float
    moon_percent: float
    phase: str
    cloud_percent: float


class Day(State):
    date: str
    high: float
    low: float
    pop: float
    code: int
    condition: str
    icon: str


class Hour(State):
    time: str
    temp: float
    pop: float
    code: int
    icon: str


class Place(State):
    name: str
    region: str
    is_me: bool


class WeatherState(State):
    place: Place
    now: Now
    today: Today
    outlook: Outlook
    night: NightLight
    days: list[Day]
    hours: list[Hour]
    units: dict[str, str]


def _get(arr: list, i: int, default: float = 0.0) -> float:
    try:
        v = arr[i]
        return default if v is None else float(v)
    except (IndexError, TypeError, ValueError):
        return default


class Weather(Provider[WeatherSettings, WeatherState]):
    Settings = WeatherSettings
    interval = 900
    watches_app = ("units", "locations")

    def __init__(self) -> None:
        self._me: tuple[float, dict] | None = None  # (fetched_at, place)

    async def _place(self, ctx) -> tuple[Place, float, float]:
        if ctx.settings.location_id == "@me":
            if not self._me or time.time() - self._me[0] > 1800:
                r = await ctx.http.get_json("https://ipwho.is/")
                if "latitude" not in r:
                    raise ToolError("Approximate location unavailable")
                self._me = (time.time(), r)
            r = self._me[1]
            region = r.get("region_code") if r.get("country_code") == "US" else r.get("country", "")
            return Place(name=r.get("city") or "My location", region=region or "", is_me=True), \
                float(r["latitude"]), float(r["longitude"])
        loc = ctx.app.location(ctx.settings.location_id or None)
        if not loc:
            raise ToolError("Add a place in Settings → Saved places")
        return Place(name=loc.name, region=loc.region, is_me=False), loc.lat, loc.lon

    async def refresh(self, ctx) -> WeatherState:
        place, lat, lon = await self._place(ctx)
        metric = ctx.app.units == "metric"
        data = await ctx.http.get_json(FORECAST, params={
            "latitude": lat, "longitude": lon, "timezone": "auto", "forecast_days": 8,
            "current": "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,wind_gusts_10m,"
                       "relative_humidity_2m,uv_index",
            "hourly": "temperature_2m,precipitation_probability,weather_code,wind_gusts_10m,cloud_cover",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,"
                     "sunrise,sunset,uv_index_max",
            "temperature_unit": "celsius" if metric else "fahrenheit",
            "wind_speed_unit": "kmh" if metric else "mph",
        })
        return self.parse(data, place, metric)

    @staticmethod
    def parse(data: dict, place: Place, metric: bool = True) -> WeatherState:
        try:
            cur, hourly, daily = data["current"], data["hourly"], data["daily"]
        except KeyError as exc:
            raise ToolError("Forecast response was incomplete") from exc
        code = int(cur.get("weather_code") or 0)
        label, icon, _ = WMO.get(code, ("Unknown", "cloud", None))
        now = Now(temp=cur["temperature_2m"], feels=cur["apparent_temperature"], code=code, condition=label,
                  icon=icon, is_day=bool(cur.get("is_day", 1)), wind=cur.get("wind_speed_10m") or 0,
                  gust=cur.get("wind_gusts_10m") or 0, humidity=cur.get("relative_humidity_2m") or 0,
                  uv=cur.get("uv_index"))
        uv_max = daily["uv_index_max"][0] if daily.get("uv_index_max") else None
        today = Today(high=_get(daily["temperature_2m_max"], 0), low=_get(daily["temperature_2m_min"], 0),
                      uv_max=uv_max, uv_now_level=uv_level(now.uv), uv_max_level=uv_level(uv_max),
                      sunrise=daily["sunrise"][0], sunset=daily["sunset"][0])

        times = hourly["time"]
        now_hour = str(cur.get("time", ""))[:13]
        start = next((i for i, t in enumerate(times) if t[:13] >= now_hour), 0)
        last = min(start + 24, len(times))
        pops, codes = hourly["precipitation_probability"], hourly["weather_code"]
        temps, gusts, clouds = hourly["temperature_2m"], hourly["wind_gusts_10m"], hourly.get("cloud_cover", [])

        first = last_wet = None
        kind, max_pop, low, gust = None, 0.0, math.inf, 0.0
        for i in range(start, last):
            p = _get(pops, i)
            max_pop = max(max_pop, p)
            low = min(low, _get(temps, i, math.inf))
            gust = max(gust, _get(gusts, i))
            if p >= 40:
                first = i if first is None else first
                last_wet = i
                k = WMO.get(int(_get(codes, i)), ("", "", "rain"))[2] or "rain"
                if kind is None or KIND_RANK[k] > KIND_RANK[kind]:
                    kind = k
        if first is not None:
            outlook_label = KIND_NAME[kind or "rain"]
            o_start = times[first]
            o_end = times[last_wet + 1] if last_wet is not None and last_wet + 1 < last else None
        else:
            outlook_label = "Slight chance of precipitation" if max_pop >= 20 else "Dry next 24 h"
            o_start = o_end = None
        gust_limit = 40 if metric else 25
        outlook = Outlook(kind=kind, label=outlook_label, start=o_start, end=o_end, max_pop=max_pop,
                          freezing=low <= (0 if metric else 32), gust_warning=gust if gust >= gust_limit else None)

        # night light = moon illumination tonight x clear sky between sunset and next sunrise
        lit, phase = moon(time.time() + 6 * 3600)
        now_iso = str(cur.get("time", ""))
        from_t = daily["sunset"][0] if now_iso < daily["sunset"][0] else now_iso
        to_t = daily["sunrise"][1] if len(daily["sunrise"]) > 1 else "9999"
        night_clouds = [_get(clouds, i) for i, t in enumerate(times) if from_t[:13] <= t < to_t] if clouds else []
        cloud = sum(night_clouds) / len(night_clouds) if night_clouds else 0.0
        night = NightLight(percent=round(lit * (1 - cloud / 100) * 100), moon_percent=round(lit * 100), phase=phase,
                           cloud_percent=round(cloud))

        days = []
        for i, d in enumerate(daily["time"][:7]):
            c = int(_get(daily["weather_code"], i))
            lbl, ic, _ = WMO.get(c, ("Unknown", "cloud", None))
            days.append(Day(date=d, high=_get(daily["temperature_2m_max"], i), low=_get(daily["temperature_2m_min"], i),
                            pop=_get(daily["precipitation_probability_max"], i), code=c, condition=lbl, icon=ic))
        hours = [Hour(time=times[i], temp=_get(temps, i), pop=_get(pops, i), code=int(_get(codes, i)),
                      icon=WMO.get(int(_get(codes, i)), ("", "cloud", None))[1]) for i in range(start, last)]
        return WeatherState(place=place, now=now, today=today, outlook=outlook, night=night, days=days, hours=hours,
                            units={"temp": "°C" if metric else "°F", "wind": "km/h" if metric else "mph"})

    @action
    async def set_location(self, ctx, location_id: str) -> None:
        await ctx.update_settings(location_id=location_id)
