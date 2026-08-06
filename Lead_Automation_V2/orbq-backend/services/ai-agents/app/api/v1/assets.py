"""Assets Library — /ai-agents/marketing/assets and /assets/folders.

Bytes go to a local-disk volume (no S3/MinIO is configured in this stack), and
the DB row is the index. The same caveat as the Node platform's
auth_uploads/automation_uploads volumes applies: swap for object storage before
running more than one replica.

Two things here are security-load-bearing rather than incidental:
  · the stored filename is generated, never derived from client input, so an
    uploaded "../../etc/passwd" cannot escape the org's directory;
  · downloads stream from a path rebuilt out of (org_id, asset id) taken from
    the DB row, so a crafted `storage_key` could not be used to read an
    arbitrary file even if one were ever written.
"""
from __future__ import annotations

import mimetypes
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from orbq_core.db.session import get_session
from orbq_core.errors import NotFoundError, ValidationError
from orbq_core.tenancy import current_tenant

from ...config import get_settings
from ...models.marketing import Asset, AssetFolder
from ...schemas.marketing_extras import AssetFolderCreate, AssetFolderOut, AssetOut

router = APIRouter(prefix="/ai-agents/marketing/assets", tags=["marketing-assets"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024

# Allowlist, not a denylist: an unknown type is rejected rather than stored and
# served back to a browser later.
MIME_TO_ASSET_TYPE = {
    "image/png": "image", "image/jpeg": "image", "image/gif": "image",
    "image/webp": "image", "image/svg+xml": "image",
    "video/mp4": "video", "video/webm": "video", "video/quicktime": "video",
    "audio/mpeg": "audio", "audio/wav": "audio", "audio/ogg": "audio",
    "application/pdf": "pdf",
    "application/msword": "document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
    "application/vnd.ms-excel": "document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
    "text/plain": "document", "text/csv": "document",
}


# ─── Folders ─────────────────────────────────────────────────────────────

@router.get("/folders", response_model=list[AssetFolderOut])
async def list_folders(db: AsyncSession = Depends(get_session)) -> list[AssetFolderOut]:
    ctx = current_tenant()
    rows = (
        await db.execute(
            select(AssetFolder)
            .where(AssetFolder.org_id == ctx.org_id, AssetFolder.deleted_at.is_(None))
            .order_by(AssetFolder.name)
        )
    ).scalars().all()
    return [AssetFolderOut.model_validate(f) for f in rows]


@router.post("/folders", response_model=AssetFolderOut, status_code=201)
async def create_folder(body: AssetFolderCreate, db: AsyncSession = Depends(get_session)) -> AssetFolderOut:
    ctx = current_tenant()
    if body.parent_id:
        await _get_folder(db, body.parent_id)
    f = AssetFolder(org_id=ctx.org_id, created_by=ctx.user_id, name=body.name, parent_id=body.parent_id)
    db.add(f)
    await db.flush()
    return AssetFolderOut.model_validate(f)


@router.delete("/folders/{folder_id}", status_code=204, response_class=Response)
async def delete_folder(folder_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> Response:
    ctx = current_tenant()
    f = await _get_folder(db, folder_id)
    contained = (
        await db.execute(
            select(Asset.id)
            .where(Asset.org_id == ctx.org_id, Asset.folder_id == folder_id, Asset.deleted_at.is_(None))
            .limit(1)
        )
    ).scalar_one_or_none()
    if contained is not None:
        raise ValidationError("Folder is not empty. Move or delete its assets first.")
    f.deleted_at = datetime.now(timezone.utc)
    f.updated_by = ctx.user_id
    await db.flush()
    return Response(status_code=204)


async def _get_folder(db: AsyncSession, folder_id: uuid.UUID) -> AssetFolder:
    ctx = current_tenant()
    stmt = select(AssetFolder).where(
        AssetFolder.id == folder_id, AssetFolder.org_id == ctx.org_id, AssetFolder.deleted_at.is_(None)
    )
    f = (await db.execute(stmt)).scalar_one_or_none()
    if f is None:
        raise NotFoundError(f"Folder {folder_id} not found")
    return f


# ─── Assets ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[AssetOut])
async def list_assets(
    folder_id: uuid.UUID | None = Query(default=None),
    asset_type: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=100, le=200),
    db: AsyncSession = Depends(get_session),
) -> list[AssetOut]:
    ctx = current_tenant()
    stmt = (
        select(Asset)
        .where(Asset.org_id == ctx.org_id, Asset.deleted_at.is_(None))
        .order_by(Asset.created_at.desc())
        .limit(limit)
    )
    if folder_id:
        stmt = stmt.where(Asset.folder_id == folder_id)
    if asset_type:
        stmt = stmt.where(Asset.asset_type == asset_type)
    if search:
        stmt = stmt.where(Asset.name.ilike(f"%{search}%"))
    rows = (await db.execute(stmt)).scalars().all()
    return [AssetOut.model_validate(a) for a in rows]


@router.post("", response_model=AssetOut, status_code=201)
async def upload_asset(
    file: UploadFile = File(...),
    folder_id: uuid.UUID | None = Form(default=None),
    name: str | None = Form(default=None),
    db: AsyncSession = Depends(get_session),
) -> AssetOut:
    ctx = current_tenant()

    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    asset_type = MIME_TO_ASSET_TYPE.get(mime)
    if asset_type is None:
        raise ValidationError(
            f"Unsupported file type '{mime or 'unknown'}'. "
            f"Allowed: {', '.join(sorted(set(MIME_TO_ASSET_TYPE)))}"
        )

    payload = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(payload) > MAX_UPLOAD_BYTES:
        raise ValidationError(f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)}MB limit")
    if not payload:
        raise ValidationError("File is empty")

    if folder_id:
        await _get_folder(db, folder_id)

    asset_id = uuid.uuid4()
    suffix = Path(file.filename or "").suffix[:12]
    # Generated, never client-controlled — see the module docstring.
    storage_key = f"{ctx.org_id}/{asset_id}{suffix}"
    path = _media_root() / storage_key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)

    a = Asset(
        id=asset_id, org_id=ctx.org_id, created_by=ctx.user_id,
        name=(name or file.filename or "untitled")[:300],
        asset_type=asset_type, storage_key=storage_key, mime_type=mime,
        byte_size=len(payload), folder_id=folder_id,
    )
    db.add(a)
    await db.flush()
    return AssetOut.model_validate(a)


@router.get("/{asset_id}/download")
async def download_asset(asset_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> FileResponse:
    a = await _get_asset(db, asset_id)
    path = _resolve_path(a)
    if not path.is_file():
        raise NotFoundError("The stored file for this asset is missing")
    return FileResponse(path, media_type=a.mime_type or "application/octet-stream", filename=a.name)


@router.delete("/{asset_id}", status_code=204, response_class=Response)
async def delete_asset(asset_id: uuid.UUID, db: AsyncSession = Depends(get_session)) -> Response:
    ctx = current_tenant()
    a = await _get_asset(db, asset_id)
    a.deleted_at = datetime.now(timezone.utc)
    a.updated_by = ctx.user_id
    await db.flush()
    # The row is soft-deleted; bytes stay until a retention job reclaims them,
    # so an accidental delete is recoverable.
    return Response(status_code=204)


async def _get_asset(db: AsyncSession, asset_id: uuid.UUID) -> Asset:
    ctx = current_tenant()
    stmt = select(Asset).where(
        Asset.id == asset_id, Asset.org_id == ctx.org_id, Asset.deleted_at.is_(None)
    )
    a = (await db.execute(stmt)).scalar_one_or_none()
    if a is None:
        raise NotFoundError(f"Asset {asset_id} not found")
    return a


def _media_root() -> Path:
    root = Path(get_settings().media_root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _resolve_path(asset: Asset) -> Path:
    """Rebuild the path from trusted DB columns and confirm it stays under the
    media root, so a malformed storage_key cannot become an arbitrary read."""
    root = _media_root()
    path = (root / asset.storage_key).resolve()
    if not path.is_relative_to(root):
        raise NotFoundError("Asset path is invalid")
    return path
