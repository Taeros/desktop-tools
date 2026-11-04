from desktop_tools.shell.windows import parse_hotkey


def test_parse_hotkey():
    assert parse_hotkey("Ctrl+Alt+Shift+D") == (0x2 | 0x1 | 0x4, ord("D"))
    assert parse_hotkey("Win+F12") == (0x8, 0x7B)
    assert parse_hotkey("Ctrl+Alt+Space") == (0x3, 0x20)
    assert parse_hotkey("Hyper+X") is None
