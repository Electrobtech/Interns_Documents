"""Marketing Hub - Assets Library API"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.models.marketing_hub import AssetType
from app.schemas.marketing_hub import (
    AssetCreate, AssetUpdate, AssetOut, PaginationParams, PaginatedResponse
)
from app.services.marketing_assets_service import MarketingAssetsService
from app.services.audit_service import log_audit

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/assets/upload", response_model=AssetOut)
async def upload_asset(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # JSON string of tags array
    is_public: bool = Form(False),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> AssetOut:
    """Upload a new marketing asset - ACTUALLY saves file to disk"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Read file content - REAL file upload
    file_content = await file.read()
    
    # Parse tags if provided
    tags_list = []
    if tags:
        try:
            import json
            tags_list = json.loads(tags)
        except:
            tags_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
    
    service = MarketingAssetsService(session)
    
    try:
        # Use the REAL file upload method that saves to disk
        asset = await service.create_asset_from_upload(
            organization_id=organization_id,
            user_id=user_id,
            file_name=file.filename,
            file_content=file_content,
            name=name or file.filename,
            tags=tags_list,
            is_public=is_public
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    await log_audit(
        session, 
        organization_id, 
        user_id, 
        "marketing_hub.asset.upload", 
        {
            "asset_id": str(asset.id), 
            "filename": asset.filename,
            "file_size": asset.file_size,
            "asset_type": asset.asset_type
        }
    )
    await session.commit()
    
    return asset


@router.get("/assets/{asset_id}", response_model=AssetOut)
async def get_asset(
    asset_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> AssetOut:
    """Get single asset by ID"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingAssetsService(session)
    asset = await service.get_asset(organization_id, asset_id)
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    return asset


@router.get("/assets", response_model=PaginatedResponse)
async def list_assets(
    # Pagination
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    
    # Filters
    asset_type: Optional[AssetType] = Query(None),
    tags: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
    is_public: Optional[bool] = Query(None),
    created_after: Optional[datetime] = Query(None),
    created_before: Optional[datetime] = Query(None),
    
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> PaginatedResponse:
    """List assets with filters and pagination"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    pagination = PaginationParams(page=page, limit=limit)
    
    service = MarketingAssetsService(session)
    assets, total = await service.list_assets(
        organization_id,
        asset_type=asset_type,
        tags=tags or [],
        search=search,
        is_public=is_public,
        created_after=created_after,
        created_before=created_before,
        pagination=pagination
    )
    
    return PaginatedResponse(
        items=assets,
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit
    )


@router.put("/assets/{asset_id}", response_model=AssetOut)
async def update_asset(
    asset_id: uuid.UUID,
    body: AssetUpdate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> AssetOut:
    """Update asset metadata (not file content)"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingAssetsService(session)
    asset = await service.update_asset(organization_id, asset_id, body)
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.asset.update",
        {"asset_id": str(asset_id), "changes": body.dict(exclude_unset=True)}
    )
    await session.commit()
    
    return asset


@router.delete("/assets/{asset_id}")
async def delete_asset(
    asset_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Delete asset"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingAssetsService(session)
    success = await service.delete_asset(organization_id, asset_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.asset.delete",
        {"asset_id": str(asset_id)}
    )
    await session.commit()
    
    return {"message": "Asset deleted successfully"}


@router.get("/assets/{asset_id}/download")
async def download_asset(
    asset_id: uuid.UUID,
    expires: Optional[str] = Query(None),
    signature: Optional[str] = Query(None),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Download asset file - REAL file serving from disk"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingAssetsService(session)
    
    # Get actual file path from disk
    file_path = await service.get_asset_file_path(organization_id, asset_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="Asset not found or file missing")
    
    asset = await service.get_asset(organization_id, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Validate signature if provided (for signed URLs)
    if expires and signature:
        import hashlib
        expected_signature = hashlib.md5(f"{asset_id}{expires}".encode()).hexdigest()
        if signature != expected_signature:
            raise HTTPException(status_code=403, detail="Invalid signature")
        
        # Check expiration
        try:
            expires_dt = datetime.fromisoformat(expires.replace('Z', '+00:00'))
            if datetime.utcnow() > expires_dt:
                raise HTTPException(status_code=410, detail="Download link expired")
        except:
            raise HTTPException(status_code=400, detail="Invalid expiration format")
    
    # Stream ACTUAL file content from disk
    def generate_file_content():
        try:
            with open(file_path, 'rb') as f:
                while True:
                    chunk = f.read(8192)  # 8KB chunks
                    if not chunk:
                        break
                    yield chunk
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="File not found on disk")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")
    
    return StreamingResponse(
        generate_file_content(),
        media_type=asset.mime_type,
        headers={"Content-Disposition": f"attachment; filename={asset.filename}"}
    )


@router.get("/assets/{asset_id}/url")
async def get_asset_url(
    asset_id: uuid.UUID,
    expires_in: Optional[int] = Query(3600, description="URL expiration in seconds"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get secure URL for asset access"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingAssetsService(session)
    url = await service.get_asset_url(organization_id, asset_id, expires_in)
    
    if not url:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    return {
        "url": url,
        "expires_in": expires_in,
        "expires_at": (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
    }


@router.delete("/assets/bulk")
async def bulk_delete_assets(
    asset_ids: List[uuid.UUID],
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Delete multiple assets"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    if len(asset_ids) > 100:
        raise HTTPException(status_code=400, detail="Cannot delete more than 100 assets at once")
    
    service = MarketingAssetsService(session)
    result = await service.bulk_delete_assets(organization_id, asset_ids)
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.asset.bulk_delete",
        {"asset_ids": [str(aid) for aid in asset_ids], "result": result}
    )
    await session.commit()
    
    return result


@router.get("/assets/storage/usage")
async def get_storage_usage(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get storage usage statistics"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingAssetsService(session)
    usage = await service.get_storage_usage(organization_id)
    
    return usage


@router.get("/assets/tags/popular")
async def get_popular_tags(
    limit: int = Query(20, ge=1, le=50),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get most used asset tags"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingAssetsService(session)
    tags = await service.get_popular_tags(organization_id, limit)
    
    return {"popular_tags": tags}


@router.get("/assets/library/info")
async def get_library_info(
    user: AuthUser = Depends(_can_manage),
) -> dict:
    """Get asset library information and guidelines"""
    
    return {
        "supported_formats": {
            "images": ["JPEG", "PNG", "GIF", "WebP", "SVG"],
            "videos": ["MP4", "WebM", "AVI", "MOV", "QuickTime"],
            "audio": ["MP3", "WAV", "OGG", "AAC"],
            "documents": ["PDF", "TXT", "DOC", "DOCX"],
            "templates": ["HTML", "CSS", "JSON"]
        },
        "size_limits": {
            "images": "10 MB",
            "videos": "100 MB", 
            "audio": "50 MB",
            "documents": "25 MB",
            "templates": "5 MB",
            "other": "50 MB"
        },
        "recommended_dimensions": {
            "whatsapp_image": {"width": 1080, "height": 1080},
            "email_header": {"width": 600, "height": 200},
            "instagram_post": {"width": 1080, "height": 1080},
            "linkedin_post": {"width": 1200, "height": 627},
            "facebook_cover": {"width": 1200, "height": 315}
        },
        "best_practices": [
            "Use descriptive filenames and tags for better organization",
            "Optimize images for web to reduce file sizes",
            "Use consistent naming conventions across your team",
            "Tag assets with campaign names for easy filtering",
            "Keep original high-resolution versions for print materials",
            "Use version numbers for iterative designs"
        ],
        "organization_features": {
            "total_storage": "10 GB",
            "max_file_size": "100 MB",
            "concurrent_uploads": 5,
            "cdn_delivery": True,
            "auto_optimization": True,
            "backup_retention": "90 days"
        }
    }