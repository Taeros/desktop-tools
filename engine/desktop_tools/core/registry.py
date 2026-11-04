"""Discovers tools in tools/<id>/ and loads them in isolation. A broken tool is reported, never fatal."""

from __future__ import annotations

import importlib.util
import json
import logging
import sys
from dataclasses import dataclass, field
from pathlib import Path
from types import ModuleType

from desktop_tools.core.models import Manifest
from desktop_tools.sdk import Provider

log = logging.getLogger(__name__)
PKG = "dt_tools"


@dataclass
class LoadedTool:
    manifest: Manifest
    path: Path
    provider_cls: type[Provider] | None = None
    fixtures: dict = field(default_factory=dict)
    error: str = ""

    @property
    def id(self) -> str:
        return self.manifest.id


def _import(name: str, file: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, file, submodule_search_locations=[str(file.parent)]
                                                  if file.name == "__init__.py" else None)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {file}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def discover(tools_dir: Path) -> list[LoadedTool]:
    if PKG not in sys.modules:
        pkg = ModuleType(PKG)
        pkg.__path__ = [str(tools_dir)]  # type: ignore[attr-defined]
        sys.modules[PKG] = pkg
    out: list[LoadedTool] = []
    for mf in sorted(tools_dir.glob("*/manifest.json")):
        folder = mf.parent
        try:
            manifest = Manifest.model_validate(json.loads(mf.read_text(encoding="utf-8")))
        except Exception as exc:  # noqa: BLE001
            log.error("Skipping tool in %s: invalid manifest (%s)", folder.name, exc)
            continue
        if manifest.id != folder.name:
            log.error("Skipping tool %s: manifest id '%s' must match folder name", folder.name, manifest.id)
            continue
        tool = LoadedTool(manifest=manifest, path=folder)
        try:
            pkg_name = f"{PKG}.{manifest.id.replace('-', '_')}"
            init = folder / "__init__.py"
            if init.exists():
                _import(pkg_name, init)
            else:
                pkg = ModuleType(pkg_name)
                pkg.__path__ = [str(folder)]  # type: ignore[attr-defined]
                sys.modules[pkg_name] = pkg
            mod = _import(f"{pkg_name}.provider", folder / "provider.py")
            classes = [c for c in vars(mod).values()
                       if isinstance(c, type) and issubclass(c, Provider) and c is not Provider
                       and c.__module__ == mod.__name__]
            if len(classes) != 1:
                raise ImportError(f"provider.py must define exactly one Provider subclass (found {len(classes)})")
            tool.provider_cls = classes[0]
            fake = folder / "fake.py"
            if fake.exists():
                tool.fixtures = getattr(_import(f"{pkg_name}.fake", fake), "FIXTURES", {})
        except Exception as exc:  # noqa: BLE001
            tool.error = f"{type(exc).__name__}: {exc}"
            log.exception("Tool %s failed to load", manifest.id)
        out.append(tool)
    return out
