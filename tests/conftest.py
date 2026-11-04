from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from desktop_tools.core.engine import Engine
from desktop_tools.server.app import create_app
from fastapi.testclient import TestClient

TOKEN = "test-token-not-a-secret"
PORT = 4747


@pytest.fixture
def engine(tmp_path: Path):
    return Engine(tmp_path / "data", fake=True)


@pytest.fixture
def client(engine: Engine):
    app = create_app(engine, TOKEN, PORT, Path("/nonexistent"))
    with TestClient(app, base_url=f"http://127.0.0.1:{PORT}") as c:
        c.headers["X-DT-Token"] = TOKEN
        c.portal.call(asyncio.sleep, 0.3)  # let first refreshes complete
        yield c


def pytest_configure(config):
    # make tools importable as dt_tools.<id> for tool unit tests
    from desktop_tools.core.paths import TOOLS_DIR
    from desktop_tools.core.registry import discover

    discover(TOOLS_DIR)
