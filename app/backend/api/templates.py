"""Templates and presets API."""
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_db
import engines.template_engine as tmpl_engine

log              = logging.getLogger("avsp.templates")
router           = APIRouter()
presets_router   = APIRouter()


# ── Request models ─────────────────────────────────────────────────────────────

class SaveTemplateRequest(BaseModel):
    name:             str
    category:         str  = "custom"
    description:      str  = ""
    aspect_ratio:     str
    width:            int
    height:           int
    fps:              float
    text_clips:       list[dict]
    preview_gradient: list[str] | None = None


class ApplyTemplateRequest(BaseModel):
    project_id: str


class SavePresetRequest(BaseModel):
    name:  str
    style: dict


# ── Template routes ───────────────────────────────────────────────────────────

@router.get("")
async def list_templates():
    return {"templates": tmpl_engine.list_all_templates()}


@router.get("/{template_id}")
async def get_template(template_id: str):
    tmpl = tmpl_engine.get_template(template_id)
    if not tmpl:
        raise HTTPException(404, f"Template '{template_id}' not found")
    return tmpl


@router.post("", status_code=201)
async def create_template(body: SaveTemplateRequest):
    tmpl = tmpl_engine.save_user_template(
        name=body.name,
        category=body.category,
        description=body.description,
        aspect_ratio=body.aspect_ratio,
        width=body.width,
        height=body.height,
        fps=body.fps,
        text_clips=body.text_clips,
        preview_gradient=body.preview_gradient,
    )
    return tmpl


@router.delete("/{template_id}", status_code=204)
async def delete_template(template_id: str):
    tmpl = tmpl_engine.get_template(template_id)
    if not tmpl:
        raise HTTPException(404, f"Template '{template_id}' not found")
    if tmpl.get("is_builtin"):
        raise HTTPException(400, "Cannot delete a built-in template")
    deleted = tmpl_engine.delete_user_template(template_id)
    if not deleted:
        raise HTTPException(404, "Template file not found")


@router.post("/{template_id}/apply")
async def apply_template(template_id: str, body: ApplyTemplateRequest):
    """
    Apply a template to a new project — saves the initial timeline state to DB.
    Call this right after creating the project, before navigating to the editor.
    """
    tmpl = tmpl_engine.get_template(template_id)
    if not tmpl:
        raise HTTPException(404, f"Template '{template_id}' not found")

    # Verify project exists
    async with get_db() as db:
        rows = await db.execute_fetchall(
            "SELECT id FROM projects WHERE id=?", (body.project_id,)
        )
    if not rows:
        raise HTTPException(404, f"Project '{body.project_id}' not found")

    # Build initial timeline state from template
    state = tmpl_engine.build_initial_timeline(tmpl, body.project_id)
    now   = datetime.now(timezone.utc).isoformat()

    async with get_db() as db:
        await db.execute(
            """INSERT INTO timelines (project_id, state, version, saved_at) VALUES (?,?,1,?)
               ON CONFLICT(project_id) DO UPDATE SET
                 state=excluded.state, version=1, saved_at=excluded.saved_at""",
            (body.project_id, json.dumps(state), now),
        )
        # Also update project settings to match template format
        await db.execute(
            "UPDATE projects SET aspect_ratio=?, width=?, height=?, fps=?, updated_at=? WHERE id=?",
            (tmpl["aspect_ratio"], tmpl["width"], tmpl["height"], tmpl["fps"], now, body.project_id),
        )
        await db.commit()

    return {"applied": True, "template_id": template_id, "state": state}


# ── Text preset routes ────────────────────────────────────────────────────────

@presets_router.get("/text")
async def list_text_presets():
    return {"presets": tmpl_engine.list_text_presets()}


@presets_router.post("/text", status_code=201)
async def save_text_preset(body: SavePresetRequest):
    preset = tmpl_engine.save_text_preset(body.name, body.style)
    return preset


@presets_router.delete("/text/{preset_id}", status_code=204)
async def delete_text_preset(preset_id: str):
    deleted = tmpl_engine.delete_text_preset(preset_id)
    if not deleted:
        raise HTTPException(404, f"Preset '{preset_id}' not found or is built-in")
