"""Secrets live in the OS credential store (Windows Credential Manager via keyring), never in files.

Tools can only read secrets whose names are declared in their manifest. Values never cross the API: the UI can
set a value and see whether one is set, nothing else.
"""

from __future__ import annotations

import logging

log = logging.getLogger(__name__)
SERVICE = "DesktopTools"


class SecretStore:
    def __init__(self, memory_only: bool = False) -> None:
        self._mem: dict[str, str] = {}
        self._kr = None
        if not memory_only:
            try:
                import keyring  # noqa: PLC0415

                keyring.get_keyring()
                self._kr = keyring
            except Exception as exc:  # noqa: BLE001
                log.warning("OS credential store unavailable (%s); secrets will not persist", type(exc).__name__)

    def _service(self, tool_id: str) -> str:
        return f"{SERVICE}/{tool_id}"

    def get(self, tool_id: str, name: str) -> str | None:
        if self._kr:
            try:
                return self._kr.get_password(self._service(tool_id), name)
            except Exception:  # noqa: BLE001
                return None
        return self._mem.get(f"{tool_id}/{name}")

    def set(self, tool_id: str, name: str, value: str | None) -> None:
        if self._kr:
            if value:
                self._kr.set_password(self._service(tool_id), name, value)
            else:
                try:
                    self._kr.delete_password(self._service(tool_id), name)
                except Exception:  # noqa: BLE001
                    pass
            return
        if value:
            self._mem[f"{tool_id}/{name}"] = value
        else:
            self._mem.pop(f"{tool_id}/{name}", None)

    def is_set(self, tool_id: str, name: str) -> bool:
        return bool(self.get(tool_id, name))


class ToolSecrets:
    """The view handed to a tool: only its declared names."""

    def __init__(self, store: SecretStore, tool_id: str, declared: list[str]) -> None:
        self._store, self._tool, self._declared = store, tool_id, set(declared)

    def get(self, name: str) -> str | None:
        if name not in self._declared:
            raise PermissionError(f"Secret '{name}' is not declared in the {self._tool} manifest")
        return self._store.get(self._tool, name)
