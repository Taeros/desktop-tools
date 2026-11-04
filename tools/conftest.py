def pytest_configure(config):
    from desktop_tools.core.paths import TOOLS_DIR
    from desktop_tools.core.registry import discover

    discover(TOOLS_DIR)
