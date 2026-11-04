"""Security requirements from docs/SECURITY.md. These must never be weakened."""

from __future__ import annotations

import logging

import pytest
from desktop_tools.core.logs import RedactFilter, redact
from desktop_tools.core.net import FakeHttp, PermissionDenied

from .conftest import TOKEN


def test_api_requires_token(client):
    r = client.get("/api/bootstrap", headers={"X-DT-Token": ""})
    assert r.status_code == 401
    r = client.get("/api/bootstrap", headers={"X-DT-Token": "wrong"})
    assert r.status_code == 401
    assert client.get("/api/bootstrap").status_code == 200


def test_rejects_foreign_host_dns_rebinding(client):
    r = client.get("/api/bootstrap", headers={"Host": "evil.example:4747"})
    assert r.status_code == 403


def test_rejects_foreign_origin_csrf(client):
    r = client.put("/api/settings/app", json={"units": "imperial"}, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403


def test_security_headers(client):
    r = client.get("/api/bootstrap")
    assert "default-src 'self'" in r.headers["content-security-policy"]
    assert r.headers["x-content-type-options"] == "nosniff"


def test_websocket_requires_token(client):
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect), client.websocket_connect("ws://127.0.0.1:4747/api/ws?token=wrong") as ws:
        ws.receive_json()
    with client.websocket_connect(f"ws://127.0.0.1:4747/api/ws?token={TOKEN}") as ws:
        assert ws.receive_json()["type"] == "snapshot"


async def test_http_allowlist(tmp_path):
    http = FakeHttp("t", ["api.example.com"], tmp_path, {})
    with pytest.raises(PermissionDenied):
        await http.get_json("https://other.example.com/x")
    with pytest.raises(PermissionDenied):
        await http.get_json("http://api.example.com/x")  # plain http refused


def test_log_redaction():
    assert "abc123secretvalue" not in redact("api_key=abc123secretvalue")
    assert "[redacted]" in redact("Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789")
    assert redact("Hotkey Ctrl+Alt+Shift+D registered") == "Hotkey Ctrl+Alt+Shift+D registered"
    rec = logging.LogRecord("x", logging.INFO, "f", 1, "token=%s", ("supersecret99",), None)
    RedactFilter().filter(rec)
    assert "supersecret99" not in rec.getMessage()


def test_secrets_never_in_bootstrap_or_files(client, engine):
    data = client.get("/api/bootstrap").text
    assert TOKEN not in data
    for f in engine.data_dir.rglob("*.json"):
        assert TOKEN not in f.read_text()
