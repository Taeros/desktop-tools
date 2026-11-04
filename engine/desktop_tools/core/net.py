"""Network access for tools: real (SafeHttp) and fake (FakeHttp). Both enforce the manifest's domain allowlist."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx

from desktop_tools.sdk import ToolError

log = logging.getLogger(__name__)
MAX_BYTES = 5_000_000
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DesktopTools/0.1"


class PermissionDenied(ToolError):
    pass


def _check(url: str, allowed: list[str]) -> str:
    parts = urlsplit(url)
    if parts.scheme != "https":
        raise PermissionDenied(f"Only https is allowed ({url.split('?')[0]})")
    host = (parts.hostname or "").lower()
    if host not in allowed:
        raise PermissionDenied(f"{host} is not in this tool's network permissions")
    return host


class SafeHttp:
    def __init__(self, tool_id: str, allowed: list[str], client: httpx.AsyncClient) -> None:
        self.tool_id, self.allowed, self.client = tool_id, [d.lower() for d in allowed], client

    async def get_json(self, url: str, params: dict[str, Any] | None = None,
                       headers: dict[str, str] | None = None) -> Any:
        _check(url, self.allowed)
        try:
            resp = await self.client.get(url, params=params, headers={"User-Agent": USER_AGENT, **(headers or {})})
        except httpx.HTTPError as exc:
            raise ToolError(f"Network error: {type(exc).__name__}") from exc
        if resp.status_code >= 400:
            raise ToolError(f"{urlsplit(url).hostname} answered {resp.status_code}")
        if len(resp.content) > MAX_BYTES:
            raise ToolError("Response too large")
        try:
            return resp.json()
        except ValueError as exc:
            raise ToolError("Response was not valid JSON") from exc


class FakeHttp:
    """Serves recorded responses from tools/<id>/fixtures/. Mapping lives in the tool's fake.py:

        FIXTURES = {"api.open-meteo.com/v1/forecast": "forecast.json"}

    Longest matching "host/path" prefix wins. Same permission checks as SafeHttp.
    """

    def __init__(self, tool_id: str, allowed: list[str], tool_dir: Path, fixtures: dict[str, str]) -> None:
        self.tool_id, self.allowed, self.dir, self.fixtures = tool_id, [d.lower() for d in allowed], tool_dir, fixtures

    async def get_json(self, url: str, params: dict[str, Any] | None = None,
                       headers: dict[str, str] | None = None) -> Any:
        host = _check(url, self.allowed)
        key = host + urlsplit(url).path
        matches = [k for k in self.fixtures if key.startswith(k)]
        if not matches:
            raise ToolError(f"No fake fixture for {key}")
        name = self.fixtures[max(matches, key=len)]
        if callable(name):
            return name(url=url, params=params or {})
        return json.loads((self.dir / "fixtures" / name).read_text(encoding="utf-8"))
