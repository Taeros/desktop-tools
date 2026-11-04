"""Loads tools the same way the engine does so tool tests can import `dt_tools.<id>`."""
from desktop_tools.core.paths import TOOLS_DIR
from desktop_tools.core.registry import discover


def test_all_tools_load():
    tools = discover(TOOLS_DIR)
    assert tools and all(not t.error for t in tools), [t.error for t in tools if t.error]
