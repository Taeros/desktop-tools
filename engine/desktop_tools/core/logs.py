"""Logging with secret redaction. Every log record passes through RedactFilter before it is written."""

from __future__ import annotations

import logging
import re
from collections import deque
from logging.handlers import RotatingFileHandler
from pathlib import Path

_PATTERNS = [
    re.compile(r"(?i)\b(token|api[_-]?key|key|secret|password|authorization|bearer)\b([\"'=:\s]+)([^\s\"'&,;]{6,})"),
    re.compile(r"\b[A-Za-z0-9_\-]{32,}\b"),  # long opaque strings (API keys, tokens)
]


def redact(text: str) -> str:
    text = _PATTERNS[0].sub(lambda m: f"{m.group(1)}{m.group(2)}[redacted]", text)
    return _PATTERNS[1].sub("[redacted]", text)


class RedactFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact(record.getMessage())
        record.args = ()
        return True


class MemoryHandler(logging.Handler):
    """Keeps the last N formatted records for the System health page."""

    def __init__(self, size: int = 300) -> None:
        super().__init__()
        self.records: deque[dict[str, str]] = deque(maxlen=size)

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append({
            "time": self.formatter.formatTime(record, "%Y-%m-%d %H:%M:%S") if self.formatter else "",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        })


memory = MemoryHandler()


def setup(log_dir: Path, verbose: bool = False) -> None:
    root = logging.getLogger()
    root.setLevel(logging.DEBUG if verbose else logging.INFO)
    fmt = logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s")
    redactor = RedactFilter()
    handlers: list[logging.Handler] = [
        RotatingFileHandler(log_dir / "desktop-tools.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8"),
        logging.StreamHandler(),
        memory,
    ]
    for h in handlers:
        h.setFormatter(fmt)
        h.addFilter(redactor)
        root.addHandler(h)
    for noisy in ("httpx", "httpcore", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
