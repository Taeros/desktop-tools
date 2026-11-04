"""Filesystem locations. User data lives OUTSIDE the repository and outside OneDrive (see docs/SECURITY.md)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
TOOLS_DIR = REPO_ROOT / "tools"
UI_DIST = REPO_ROOT / "ui" / "dist"


def default_data_dir() -> Path:
    override = os.environ.get("DT_DATA_DIR")
    if override:
        return Path(override)
    if sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        return Path(base) / "DesktopTools" / "data"
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "desktop-tools"


def ensure_data_dir(path: Path) -> Path:
    for sub in ("settings", "logs", "cache"):
        (path / sub).mkdir(parents=True, exist_ok=True)
    return path
