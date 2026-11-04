"""Latest state per provider plus health metadata, with fan-out to subscribers (WebSocket clients)."""

from __future__ import annotations

import asyncio
import time
from typing import Any, Literal

Status = Literal["loading", "ok", "error", "disabled"]


class StateStore:
    def __init__(self) -> None:
        self._entries: dict[str, dict[str, Any]] = {}
        self._subs: set[asyncio.Queue] = set()

    def snapshot(self) -> dict[str, dict[str, Any]]:
        return dict(self._entries)

    def get(self, tool_id: str) -> dict[str, Any] | None:
        return self._entries.get(tool_id)

    def _put(self, tool_id: str, entry: dict[str, Any]) -> None:
        self._entries[tool_id] = entry
        self.broadcast({"type": "state", "tool": tool_id, "entry": entry})

    def set_status(self, tool_id: str, status: Status, error: str = "", interval: float = 0) -> None:
        prev = self._entries.get(tool_id, {})
        self._put(tool_id, {**prev, "status": status, "error": error,
                            "interval": interval or prev.get("interval", 0)})

    def publish(self, tool_id: str, data: dict[str, Any], interval: float) -> None:
        self._put(tool_id, {"status": "ok", "error": "", "data": data,
                            "updated_at": time.time(), "interval": interval})

    def fail(self, tool_id: str, error: str, interval: float) -> None:
        prev = self._entries.get(tool_id, {})
        # keep the last good data so cards can show it dimmed as stale
        self._put(tool_id, {**prev, "status": "error", "error": error, "interval": interval,
                            "failed_at": time.time()})

    # ------------------------------------------------------------ pub/sub
    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subs.discard(q)

    def broadcast(self, message: dict[str, Any]) -> None:
        for q in list(self._subs):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:  # a stuck client must not block the engine
                self._subs.discard(q)
