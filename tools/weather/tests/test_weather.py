import json
from pathlib import Path

from dt_tools.weather.provider import Place, Weather, moon, uv_level

FIX = Path(__file__).parents[1] / "fixtures" / "forecast.json"


def state():
    return Weather.parse(json.loads(FIX.read_text()), Place(name="West Point", region="NY", is_me=False))


def test_outlook_finds_rain_window():
    s = state()
    assert s.outlook.kind == "rain"
    assert s.outlook.start == "2026-11-03T20:00" and s.outlook.end == "2026-11-04T03:00"
    assert s.outlook.max_pop >= 70


def test_days_and_hours():
    s = state()
    assert len(s.days) == 7 and len(s.hours) == 24
    assert s.hours[0].time == "2026-11-03T17:00"
    assert s.units["temp"] == "°C"


def test_uv_levels_and_moon():
    assert [uv_level(x) for x in (0, 3, 6, 9, 12)] == ["Low", "Moderate", "High", "Very high", "Extreme"]
    lit, phase = moon(947182440)  # the reference new moon
    assert lit < 0.01 and phase == "New moon"
