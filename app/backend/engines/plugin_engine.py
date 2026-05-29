"""Plugin engine — discovers, loads, and manages plugins from ROOT/plugins/."""
import importlib.util
import json
import logging
import shutil
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

import config

log = logging.getLogger("avsp.plugins")

_REQUIRED_KEYS = {"id", "name", "version", "entry_point"}

# Runtime registry: plugin_id → {"manifest": dict, "loaded": bool, "error": str|None}
_registry: dict[str, dict] = {}


def scan_plugins() -> list[dict]:
    """Return all plugin manifests found in ROOT/plugins/, sorted by id."""
    manifests = []
    if not config.PLUGINS_DIR.exists():
        return manifests
    for plugin_dir in sorted(config.PLUGINS_DIR.iterdir()):
        if not plugin_dir.is_dir():
            continue
        manifest_path = plugin_dir / "manifest.json"
        if not manifest_path.exists():
            continue
        try:
            m = json.loads(manifest_path.read_text(encoding="utf-8"))
            if not _REQUIRED_KEYS.issubset(m.keys()):
                log.warning("Plugin %s missing required keys — skipping", plugin_dir.name)
                continue
            m["_dir"] = str(plugin_dir)
            manifests.append(m)
        except Exception as exc:
            log.warning("Could not read manifest for %s: %s", plugin_dir.name, exc)
    return manifests


def _append_error_log(plugin_id: str, exc: Exception) -> None:
    log_path = config.LOGS_DIR / f"plugin-{plugin_id}-error.log"
    try:
        ts = datetime.now(timezone.utc).isoformat()
        tb = traceback.format_exc()
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"\n--- {ts} ---\n{type(exc).__name__}: {exc}\n{tb}\n")
    except Exception:
        pass


def _load_one(manifest: dict):
    """Import a plugin's entry_point and return its FastAPI router, or None on error."""
    plugin_id  = manifest["id"]
    plugin_dir = Path(manifest["_dir"])
    ep_path    = plugin_dir / manifest["entry_point"]

    if not ep_path.exists():
        err = FileNotFoundError(f"Entry point '{ep_path}' not found")
        _append_error_log(plugin_id, err)
        return None, str(err)

    try:
        mod_name = f"avsp_plugin_{plugin_id}"
        spec     = importlib.util.spec_from_file_location(mod_name, ep_path)
        module   = importlib.util.module_from_spec(spec)
        sys.modules[mod_name] = module
        spec.loader.exec_module(module)

        router = getattr(module, "router", None)
        if router is None:
            raise AttributeError("Plugin module must export a FastAPI APIRouter named 'router'")

        log.info("Plugin '%s' loaded — %s v%s", plugin_id, manifest["name"], manifest.get("version", "?"))
        return router, None
    except Exception as exc:
        log.error("Plugin '%s' failed to load: %s", plugin_id, exc)
        _append_error_log(plugin_id, exc)
        return None, str(exc)


def load_all_plugins() -> list[tuple[dict, object]]:
    """
    Load all enabled plugins at startup.
    Returns list of (manifest, router) pairs for inclusion in the FastAPI app.
    Also populates the runtime registry.
    """
    results = []
    for manifest in scan_plugins():
        pid = manifest["id"]
        if not manifest.get("enabled", True):
            log.info("Plugin '%s' is disabled — skipping", pid)
            _registry[pid] = {"manifest": {k: v for k, v in manifest.items() if not k.startswith("_")},
                               "loaded": False, "error": None}
            continue

        router, err = _load_one(manifest)
        clean = {k: v for k, v in manifest.items() if not k.startswith("_")}
        _registry[pid] = {"manifest": clean, "loaded": router is not None, "error": err}

        if router is not None:
            results.append((manifest, router))

    return results


def get_all_manifests() -> list[dict]:
    """Return all manifests with runtime status (enabled/disabled, loaded, error)."""
    manifests = scan_plugins()
    out = []
    for m in manifests:
        pid   = m["id"]
        clean = {k: v for k, v in m.items() if not k.startswith("_")}
        reg   = _registry.get(pid, {})
        clean["runtime_loaded"] = reg.get("loaded", False)
        clean["runtime_error"]  = reg.get("error")
        clean["has_error_log"]  = (config.LOGS_DIR / f"plugin-{pid}-error.log").exists()
        out.append(clean)
    return out


def set_plugin_enabled(plugin_id: str, enabled: bool) -> bool:
    """Persist enabled state to manifest.json on disk. Returns True if found."""
    plugin_dir    = config.PLUGINS_DIR / plugin_id
    manifest_path = plugin_dir / "manifest.json"
    if not manifest_path.exists():
        return False
    try:
        m = json.loads(manifest_path.read_text(encoding="utf-8"))
        m["enabled"] = enabled
        manifest_path.write_text(json.dumps(m, indent=2, ensure_ascii=False), encoding="utf-8")
        # Update registry entry if present
        if plugin_id in _registry:
            _registry[plugin_id]["manifest"]["enabled"] = enabled
        return True
    except Exception:
        return False


def delete_plugin_folder(plugin_id: str) -> bool:
    """Permanently remove a plugin's directory. Returns True if successful."""
    plugin_dir = config.PLUGINS_DIR / plugin_id
    if not plugin_dir.exists():
        return False
    try:
        shutil.rmtree(plugin_dir)
        _registry.pop(plugin_id, None)
        return True
    except Exception:
        return False


def get_error_log(plugin_id: str) -> str | None:
    """Return error log content for a plugin, or None if none exists."""
    log_path = config.LOGS_DIR / f"plugin-{plugin_id}-error.log"
    if not log_path.exists():
        return None
    try:
        return log_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None
