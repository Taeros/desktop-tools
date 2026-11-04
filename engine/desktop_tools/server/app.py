"""Local API server. Security rules (docs/SECURITY.md):

* binds to 127.0.0.1 only (enforced by the caller in __main__)
* every /api request needs the per-launch token (header X-DT-Token, or ?token= for the WebSocket)
* Host must be 127.0.0.1:<port> or localhost:<port>; Origin, when present, must be the same origin
* strict Content-Security-Policy; no CORS
"""

from __future__ import annotations

import asyncio
import hmac
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from desktop_tools.core.engine import Engine, EngineError

log = logging.getLogger(__name__)

CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
       "font-src 'self' data:; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; "
       "frame-ancestors 'none'; base-uri 'none'; form-action 'none'")


def create_app(engine: Engine, token: str, port: int, ui_dist: Path) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):  # type: ignore[no-untyped-def]
        await engine.start()
        try:
            yield
        finally:
            await engine.stop()

    app = FastAPI(title="Desktop Tools", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
    allowed_origins = {f"http://{h}" for h in allowed_hosts}

    def _origin_ok(headers: Any) -> bool:
        if headers.get("host", "") not in allowed_hosts:
            return False
        origin = headers.get("origin")
        return origin is None or origin in allowed_origins

    def _token_ok(value: str | None) -> bool:
        return bool(value) and hmac.compare_digest(value, token)  # type: ignore[arg-type]

    @app.middleware("http")
    async def guard(request: Request, call_next):  # type: ignore[no-untyped-def]
        if not _origin_ok(request.headers):
            return JSONResponse({"error": "forbidden host or origin"}, status_code=403)
        if request.url.path.startswith("/api/") and not _token_ok(request.headers.get("x-dt-token")):
            return JSONResponse({"error": "missing or wrong token"}, status_code=401)
        response: Response = await call_next(request)
        response.headers["Content-Security-Policy"] = CSP
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store" if request.url.path.startswith("/api/") else "no-cache"
        return response

    def _run(fn):  # type: ignore[no-untyped-def]
        try:
            return fn()
        except EngineError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    # ------------------------------------------------------------ REST
    @app.get("/api/bootstrap")
    async def bootstrap() -> dict:
        return engine.bootstrap()

    @app.get("/api/health")
    async def health() -> dict:
        return engine.health()

    @app.put("/api/settings/app")
    async def put_app(values: dict = Body(...)) -> dict:  # noqa: B008
        try:
            return await engine.update_app_settings(values)
        except EngineError as exc:
            raise HTTPException(400, str(exc)) from exc

    @app.put("/api/tools/{tool_id}/settings")
    async def put_tool(tool_id: str, values: dict = Body(...)) -> dict:  # noqa: B008
        try:
            return await engine.update_tool_settings(tool_id, values)
        except EngineError as exc:
            raise HTTPException(400, str(exc)) from exc

    @app.post("/api/tools/{tool_id}/actions/{name}")
    async def call_action(tool_id: str, name: str, args: dict = Body(default={})) -> dict:  # noqa: B008
        try:
            return {"result": await engine.call_action(tool_id, name, args)}
        except EngineError as exc:
            raise HTTPException(400, str(exc)) from exc

    @app.post("/api/tools/{tool_id}/refresh")
    async def refresh(tool_id: str) -> dict:
        _run(lambda: engine.refresh_tool(tool_id))
        return {"ok": True}

    @app.post("/api/tools/{tool_id}/enabled")
    async def enabled(tool_id: str, body: dict = Body(...)) -> dict:  # noqa: B008
        try:
            await engine.set_tool_enabled(tool_id, bool(body.get("enabled")))
        except EngineError as exc:
            raise HTTPException(400, str(exc)) from exc
        return {"ok": True}

    @app.post("/api/tools/{tool_id}/approve")
    async def approve(tool_id: str) -> dict:
        try:
            await engine.approve_tool(tool_id)
        except EngineError as exc:
            raise HTTPException(400, str(exc)) from exc
        return {"ok": True}

    @app.put("/api/tools/{tool_id}/secrets/{name}")
    async def put_secret(tool_id: str, name: str, body: dict = Body(...)) -> dict:  # noqa: B008
        _run(lambda: engine.set_secret(tool_id, name, body.get("value") or None))
        return {"ok": True, "set": bool(body.get("value"))}

    @app.put("/api/layout")
    async def put_layout(layout: dict = Body(...)) -> dict:  # noqa: B008
        try:
            return await engine.set_layout(layout)
        except EngineError as exc:
            raise HTTPException(400, str(exc)) from exc

    @app.get("/api/export")
    async def export() -> dict:
        return engine.export_all()

    @app.post("/api/import")
    async def import_(data: dict = Body(...)) -> dict:  # noqa: B008
        try:
            await engine.import_all(data)
        except EngineError as exc:
            raise HTTPException(400, str(exc)) from exc
        return {"ok": True}

    @app.post("/api/reset/{scope}")
    async def reset(scope: str) -> dict:
        try:
            await engine.reset(scope)
        except EngineError as exc:
            raise HTTPException(400, str(exc)) from exc
        return {"ok": True}

    # ------------------------------------------------------------ live state
    @app.websocket("/api/ws")
    async def ws(socket: WebSocket) -> None:
        if not _origin_ok(socket.headers) or not _token_ok(socket.query_params.get("token")):
            await socket.close(code=4401)
            return
        await socket.accept()
        q = engine.store.subscribe()
        try:
            await socket.send_json({"type": "snapshot", "state": engine.store.snapshot()})
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=25)
                except TimeoutError:
                    msg = {"type": "ping"}
                await socket.send_json(msg)
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            engine.store.unsubscribe(q)

    # ------------------------------------------------------------ UI (static)
    if ui_dist.exists():
        app.mount("/assets", StaticFiles(directory=ui_dist / "assets"), name="assets")

        @app.get("/{path:path}")
        async def index(path: str) -> Response:
            file = (ui_dist / path).resolve()
            if path and file.is_file() and ui_dist.resolve() in file.parents:
                return FileResponse(file)
            return FileResponse(ui_dist / "index.html")
    else:
        @app.get("/")
        async def no_ui() -> Response:
            return Response("UI not built. Run: npm --prefix ui run build", media_type="text/plain")

    return app
