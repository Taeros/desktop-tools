import subprocess
import sys

from desktop_tools.shell.windows import parse_hotkey


def test_parse_hotkey():
    assert parse_hotkey("Ctrl+Alt+Shift+D") == (0x2 | 0x1 | 0x4, ord("D"))
    assert parse_hotkey("Win+F12") == (0x8, 0x7B)
    assert parse_hotkey("Ctrl+Alt+Space") == (0x3, 0x20)
    assert parse_hotkey("Hyper+X") is None


def test_starts_without_console_streams(tmp_path):
    """Regression: pythonw.exe has no stdout/stderr; startup must not crash (it did in v0.1.0)."""
    code = ("import sys; sys.stdout = None; sys.stderr = None; "
            "from desktop_tools.__main__ import _ensure_std_streams; _ensure_std_streams(); "
            "import uvicorn; from desktop_tools.server.app import create_app; from desktop_tools.core.engine import Engine; "
            f"from pathlib import Path; e = Engine(Path(r'{tmp_path}'), fake=True); "
            "uvicorn.Config(create_app(e, 't', 1, Path('x')), log_config=None).configure_logging(); "
            "sys.__stdout__.write('ok')")
    r = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=60)
    assert r.stdout.endswith("ok"), r.stderr
