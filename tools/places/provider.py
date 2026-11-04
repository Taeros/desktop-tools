"""Places: search by name (Open-Meteo geocoding) and approximate current location (IP-based).

Has no page or cards; the universal Settings page uses its actions to manage the shared Saved places list.
"""

from __future__ import annotations

import re

from desktop_tools.sdk import Provider, State, ToolError, ToolSettings, action

US_STATES = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA", "colorado": "CO",
    "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
    "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS", "kentucky": "KY", "louisiana": "LA",
    "maine": "ME", "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
    "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
    "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA",
    "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", "tennessee": "TN", "texas": "TX",
    "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
    "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC", "puerto rico": "PR",
}
ABBR_TO_STATE = {v: k for k, v in US_STATES.items()}


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "place"


def region_label(country_code: str, admin1: str, country: str) -> str:
    if country_code == "US":
        return US_STATES.get(admin1.lower(), admin1)
    return country if len(country) <= 14 else country_code


class PlacesSettings(ToolSettings):
    pass


class PlacesState(State):
    ready: bool = True


class Places(Provider[PlacesSettings, PlacesState]):
    Settings = PlacesSettings
    interval = 86400

    async def refresh(self, ctx):  # nothing to poll
        return PlacesState()

    @action
    async def search(self, ctx, query: str) -> list[dict]:
        query = query.strip()
        if len(query) < 2:
            return []
        name, _, region = (p.strip() for p in query.partition(","))
        data = await ctx.http.get_json("https://geocoding-api.open-meteo.com/v1/search",
                                       params={"name": name, "count": 20, "language": "en", "format": "json"})
        results = data.get("results") or []
        if region:
            r_low, r_up = region.lower(), region.upper()
            full = ABBR_TO_STATE.get(r_up, "")

            def score(r: dict) -> int:
                a1, cc, co = (r.get("admin1") or "").lower(), r.get("country_code", ""), (r.get("country") or "").lower()
                return int(cc == r_up or a1 == r_low or (full and cc == "US" and a1 == full) or co == r_low
                           or a1.startswith(r_low))

            results.sort(key=score, reverse=True)
        out = []
        for r in results[:8]:
            reg = region_label(r.get("country_code", ""), r.get("admin1") or "", r.get("country") or "")
            out.append({"id": slug(f"{r['name']}-{reg}"), "name": r["name"], "region": reg,
                        "lat": round(float(r["latitude"]), 5), "lon": round(float(r["longitude"]), 5),
                        "tz": r.get("timezone") or "UTC",
                        "detail": ", ".join(x for x in (r.get("admin1"), r.get("country")) if x)})
        return out

    @action
    async def my_location(self, ctx) -> dict:
        r = await ctx.http.get_json("https://ipwho.is/")
        if not r.get("success", True) or "latitude" not in r:
            raise ToolError("Approximate location unavailable")
        reg = region_label(r.get("country_code", ""), r.get("region") or "", r.get("country") or "")
        return {"id": "my-location", "name": r.get("city") or "My location", "region": reg,
                "lat": float(r["latitude"]), "lon": float(r["longitude"]),
                "tz": (r.get("timezone") or {}).get("id", "UTC")}
