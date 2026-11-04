"""Entry point: `dt` (or `python -m desktop_tools`).

  dt                 run for real (Windows: window, tray icon, hotkey)
  dt --fake          every tool uses recorded data (any OS)
  dt --no-window     server only; prints the URL to open in a browser on this PC
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import secrets
import socket
import sys
import tempfile
import threading
from pathlib import Path

import uvicorn

from desktop_tools import __version__
from desktop_tools.core import logs, paths
from desktop_tools.core.engine import Engine
from desktop_tools.server.app import create_app

log = logging.getLogger("desktop_tools")


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


class SingleInstance:
    """Prevents two copies running against the same data folder."""

    def __init__(self, data_dir: Path) -> None:
        self.path = data_dir / "instance.lock"
        self.fh = open(self.path, "a+")  # noqa: SIM115

    def acquire(self) -> bool:
        try:
            if sys.platform == "win32":
                import msvcrt  # noqa: PLC0415

                msvcrt.locking(self.fh.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl  # noqa: PLC0415

                fcntl.flock(self.fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except OSError:
            return False


class ServerThread(threading.Thread):
    def __init__(self, engine: Engine, token: str, port: int) -> None:
        super().__init__(daemon=True, name="server")
        self.engine, self.port = engine, port
        app = create_app(engine, token, port, paths.UI_DIST)
        config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", access_log=False,
                                ws_max_size=1_000_000)
        self.server = uvicorn.Server(config)
        self.ready = threading.Event()

    def run(self) -> None:
        asyncio.run(self._serve())

    async def _serve(self) -> None:
        task = asyncio.create_task(self.server.serve())
        while not self.server.started and not task.done():
            await asyncio.sleep(0.05)
        self.ready.set()
        await task

    def stop(self) -> None:
        self.server.should_exit = True


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="dt", description="Desktop Tools")
    ap.add_argument("--fake", action="store_true", help="use recorded data for every tool")
    ap.add_argument("--no-window", action="store_true", help="run the server only")
    ap.add_argument("--port", type=int, default=0)
    ap.add_argument("--data-dir", type=Path, default=None)
    ap.add_argument("--token", default=None, help=argparse.SUPPRESS)  # tests and screenshots only
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args(argv)

    if args.data_dir:
        data_dir = args.data_dir
    elif args.fake:
        data_dir = Path(tempfile.gettempdir()) / "desktop-tools-fake"
    else:
        data_dir = paths.default_data_dir()
    paths.ensure_data_dir(data_dir)
    logs.setup(data_dir / "logs", args.verbose)

    lock = SingleInstance(data_dir)
    if not lock.acquire():
        log.error("Desktop Tools is already running (data folder %s). Use the hotkey or tray icon.", data_dir)
        return 1

    token = args.token or secrets.token_urlsafe(32)
    port = args.port or _free_port()
    engine = Engine(data_dir, fake=args.fake)
    server = ServerThread(engine, token, port)
    server.start()
    if not server.ready.wait(30):
        log.error("Server did not start")
        return 1
    url = f"http://127.0.0.1:{port}/#token={token}"
    log.info("Desktop Tools %s ready on 127.0.0.1:%d", __version__, port)

    if args.no_window or sys.platform != "win32":
        # The token is printed to the console only (never logged to file) so you can open it in a browser.
        print(f"\nOpen in a browser on this PC:\n  {url}\n", flush=True)  # noqa: T201
        try:
            server.join()
        except KeyboardInterrupt:
            server.stop()
        return 0

    from desktop_tools.shell.windows import run_shell  # noqa: PLC0415

    try:
        run_shell(url=url, engine=engine, server=server)
    finally:
        server.stop()
        server.join(10)
    os._exit(0)


if __name__ == "__main__":
    sys.exit(main())
