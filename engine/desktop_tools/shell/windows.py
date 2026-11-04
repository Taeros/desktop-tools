"""Native Windows behaviour: control-center window (WebView2), tray icon, global hotkey, start at login.

Everything here is per-user and reversible: no admin rights, no registry edits; start-at-login is a shortcut in
the user's Startup folder.
"""

from __future__ import annotations

import ctypes
import logging
import os
import subprocess
import sys
import threading
import time
import webbrowser
from ctypes import wintypes
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

APP_NAME = "Desktop Tools"
WM_HOTKEY, WM_APP_RELOAD = 0x0312, 0x8001
MODS = {"ctrl": 0x2, "control": 0x2, "alt": 0x1, "shift": 0x4, "win": 0x8}
NAMED_KEYS = {"space": 0x20, "enter": 0x0D, "tab": 0x09, "esc": 0x1B, "escape": 0x1B, "home": 0x24, "end": 0x23,
              "insert": 0x2D, "delete": 0x2E, "pageup": 0x21, "pagedown": 0x22, "up": 0x26, "down": 0x28,
              "left": 0x25, "right": 0x27, "`": 0xC0, ";": 0xBA}
MOD_NOREPEAT = 0x4000


def parse_hotkey(text: str) -> tuple[int, int] | None:
    """'Ctrl+Alt+Space' -> (modifiers, virtual key). None if it can't be parsed."""
    parts = [p.strip().lower() for p in text.split("+") if p.strip()]
    if not parts:
        return None
    mods, key = 0, parts[-1]
    for p in parts[:-1]:
        if p not in MODS:
            return None
        mods |= MODS[p]
    if key in NAMED_KEYS:
        vk = NAMED_KEYS[key]
    elif len(key) == 1 and key.isalnum():
        vk = ord(key.upper())
    elif key.startswith("f") and key[1:].isdigit() and 1 <= int(key[1:]) <= 24:
        vk = 0x6F + int(key[1:])
    else:
        return None
    return mods, vk


class HotkeyThread(threading.Thread):
    def __init__(self, get_hotkey: Any, on_press: Any) -> None:
        super().__init__(daemon=True, name="hotkey")
        self.get_hotkey, self.on_press = get_hotkey, on_press
        self.thread_id = 0
        self.current = ""

    def _register(self) -> None:
        user32 = ctypes.windll.user32  # type: ignore[attr-defined]
        user32.UnregisterHotKey(None, 1)
        self.current = self.get_hotkey()
        parsed = parse_hotkey(self.current)
        if not parsed:
            log.warning("Hotkey '%s' is not valid", self.current)
            return
        if not user32.RegisterHotKey(None, 1, parsed[0] | MOD_NOREPEAT, parsed[1]):
            log.warning("Hotkey '%s' is already used by another app", self.current)
        else:
            log.info("Hotkey %s registered", self.current)

    def run(self) -> None:
        user32 = ctypes.windll.user32  # type: ignore[attr-defined]
        self.thread_id = ctypes.windll.kernel32.GetCurrentThreadId()  # type: ignore[attr-defined]
        self._register()
        msg = wintypes.MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
            if msg.message == WM_HOTKEY:
                self.on_press()
            elif msg.message == WM_APP_RELOAD:
                self._register()

    def reload(self) -> None:
        if self.thread_id:
            ctypes.windll.user32.PostThreadMessageW(self.thread_id, WM_APP_RELOAD, 0, 0)  # type: ignore[attr-defined]


# ---------------------------------------------------------------- start at login
def _startup_shortcut() -> Path:
    return Path(os.environ["APPDATA"]) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup" / \
        f"{APP_NAME}.lnk"


def set_start_at_login(enabled: bool) -> None:
    lnk = _startup_shortcut()
    if not enabled:
        if lnk.exists():
            lnk.unlink()
            log.info("Removed start-at-login shortcut")
        return
    target = Path(sys.executable).with_name("pythonw.exe")
    if not target.exists():
        target = Path(sys.executable)
    if lnk.exists():
        return
    ps = (
        "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:DT_LNK);"
        "$s.TargetPath=$env:DT_TARGET;$s.Arguments='-m desktop_tools';"
        "$s.WorkingDirectory=$env:DT_WD;$s.Description='Desktop Tools';$s.Save()"
    )
    env = {**os.environ, "DT_LNK": str(lnk), "DT_TARGET": str(target), "DT_WD": str(Path.cwd())}
    subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps], env=env, check=False,
                   creationflags=0x08000000, timeout=20)  # CREATE_NO_WINDOW
    log.info("Created start-at-login shortcut")


# ---------------------------------------------------------------- tray icon
def _tray_image() -> Any:
    from PIL import Image, ImageDraw  # noqa: PLC0415

    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((4, 4, 60, 60), radius=14, fill=(24, 28, 37, 255))
    for i, (x, y) in enumerate([(14, 14), (34, 14), (14, 34), (34, 34)]):
        color = (126, 176, 222, 255) if i != 3 else (240, 140, 70, 255)
        d.rounded_rectangle((x, y, x + 16, y + 16), radius=4, fill=color)
    return img


def run_shell(url: str, engine: Any, server: Any) -> None:
    import pystray  # noqa: PLC0415
    import webview  # noqa: PLC0415

    webview.settings["ALLOW_DOWNLOADS"] = True  # settings export
    state = {"visible": True, "quitting": False}
    window = webview.create_window(APP_NAME, url, width=1200, height=780, min_size=(900, 600),
                                   background_color="#11141B", text_select=True)

    def show() -> None:
        window.show()
        window.restore()
        state["visible"] = True

    def hide() -> None:
        window.hide()
        state["visible"] = False

    def toggle() -> None:
        hide() if state["visible"] else show()

    def on_closing() -> bool:
        if state["quitting"]:
            return True
        hide()  # the close button hides to the tray; Quit is in the tray menu
        return False

    window.events.closing += on_closing

    def quit_app(icon: Any = None, _item: Any = None) -> None:
        state["quitting"] = True
        if icon:
            icon.stop()
        window.destroy()

    menu = pystray.Menu(
        pystray.MenuItem("Open", lambda *_: show(), default=True),
        pystray.MenuItem("Open in browser", lambda *_: webbrowser.open(url)),
        pystray.MenuItem("Open data folder", lambda *_: os.startfile(engine.data_dir)),  # type: ignore[attr-defined]  # noqa: S606
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", quit_app),
    )
    tray = pystray.Icon("desktop-tools", _tray_image(), APP_NAME, menu)
    tray.run_detached()

    hotkey = HotkeyThread(lambda: engine.app.hotkey, toggle)
    hotkey.start()

    def watch_settings() -> None:
        last_login = None
        while not state["quitting"]:
            try:
                if engine.app.hotkey != hotkey.current:
                    hotkey.reload()
                if engine.app.start_at_login != last_login:
                    last_login = engine.app.start_at_login
                    set_start_at_login(last_login)
            except Exception:  # noqa: BLE001
                log.exception("Settings watcher")
            time.sleep(2)

    threading.Thread(target=watch_settings, daemon=True, name="settings-watch").start()
    webview.start(private_mode=False, storage_path=str(engine.data_dir / "cache" / "webview"))
    state["quitting"] = True
    try:
        tray.stop()
    except Exception:  # noqa: BLE001
        pass
