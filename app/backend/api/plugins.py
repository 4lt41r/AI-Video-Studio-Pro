"""Plugin management API — list, enable, disable, delete, view error logs."""
from fastapi import APIRouter, HTTPException
from engines import plugin_engine

router = APIRouter()


@router.get("")
async def list_plugins():
    return {"plugins": plugin_engine.get_all_manifests()}


@router.post("/{plugin_id}/enable")
async def enable_plugin(plugin_id: str):
    ok = plugin_engine.set_plugin_enabled(plugin_id, True)
    if not ok:
        raise HTTPException(404, f"Plugin '{plugin_id}' not found")
    return {"plugin_id": plugin_id, "enabled": True, "restart_required": True}


@router.post("/{plugin_id}/disable")
async def disable_plugin(plugin_id: str):
    ok = plugin_engine.set_plugin_enabled(plugin_id, False)
    if not ok:
        raise HTTPException(404, f"Plugin '{plugin_id}' not found")
    return {"plugin_id": plugin_id, "enabled": False, "restart_required": True}


@router.delete("/{plugin_id}", status_code=204)
async def delete_plugin(plugin_id: str):
    manifests = plugin_engine.get_all_manifests()
    m = next((x for x in manifests if x["id"] == plugin_id), None)
    if not m:
        raise HTTPException(404, f"Plugin '{plugin_id}' not found")
    if m.get("builtin"):
        raise HTTPException(400, "Cannot delete a built-in plugin")
    if not plugin_engine.delete_plugin_folder(plugin_id):
        raise HTTPException(500, "Failed to delete plugin folder")


@router.get("/{plugin_id}/log")
async def get_plugin_log(plugin_id: str):
    content = plugin_engine.get_error_log(plugin_id)
    return {"plugin_id": plugin_id, "content": content, "has_log": content is not None}
