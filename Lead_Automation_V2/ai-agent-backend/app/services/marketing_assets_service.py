"""Marketing Assets Service - REAL file storage and database operations"""
from __future__ import annotations

import uuid
import os
import hashlib
import mimetypes
import shutil
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple, BinaryIO
from pathlib import Path
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketing_hub import MarketingAsset, AssetType
from app.schemas.marketing_hub import (
    AssetCreate, AssetUpdate, AssetOut, PaginationParams
)


class MarketingAssetsService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.upload_base_path = Path("uploads/marketing/assets")
        self.upload_base_path.mkdir(parents=True, exist_ok=True)
        
        self.allowed_mime_types = {
            AssetType.IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
            AssetType.VIDEO: ['video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/quicktime'],
            AssetType.AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac'],
            AssetType.DOCUMENT: ['application/pdf', 'text/plain', 'application/msword', 
                               'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            AssetType.TEMPLATE: ['text/html', 'text/css', 'application/json'],
            AssetType.OTHER: ['*/*']
        }
        self.size_limits = {
            AssetType.IMAGE: 10 * 1024 * 1024,  # 10MB
            AssetType.VIDEO: 100 * 1024 * 1024,  # 100MB
            AssetType.AUDIO: 50 * 1024 * 1024,   # 50MB
            AssetType.DOCUMENT: 25 * 1024 * 1024, # 25MB
            AssetType.TEMPLATE: 5 * 1024 * 1024,  # 5MB
            AssetType.OTHER: 50 * 1024 * 1024    # 50MB
        }

    async def create_asset_from_upload(
        self, 
        organization_id: uuid.UUID, 
        user_id: uuid.UUID,
        file_name: str,
        file_content: bytes,
        name: Optional[str] = None,
        tags: Optional[List[str]] = None,
        is_public: bool = False
    ) -> AssetOut:
        """Create asset from uploaded file content - ACTUALLY stores file to disk"""
        
        # Validate file
        file_size = len(file_content)
        mime_type = mimetypes.guess_type(file_name)[0] or 'application/octet-stream'
        asset_type = self._determine_asset_type(mime_type)
        
        self._validate_file(mime_type, file_size, asset_type)
        
        # Generate unique file path
        file_path = self._generate_file_path(file_name, organization_id)
        file_hash = hashlib.sha256(file_content).hexdigest()
        
        # ACTUALLY SAVE FILE TO DISK
        full_path = Path(file_path)
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(full_path, 'wb') as f:
            f.write(file_content)
        
        # Create database record
        asset = MarketingAsset(
            organization_id=organization_id,
            name=name or file_name,
            filename=file_name,
            file_path=str(file_path),
            file_size=file_size,
            mime_type=mime_type,
            asset_type=asset_type,
            file_hash=file_hash,
            tags=tags or [],
            metadata=self._extract_metadata(file_name, mime_type, file_size),
            is_public=is_public,
            created_by=user_id
        )
        
        self.session.add(asset)
        await self.session.flush()
        await self.session.refresh(asset)
        
        return AssetOut.from_orm(asset)

    async def get_asset(
        self, 
        organization_id: uuid.UUID, 
        asset_id: uuid.UUID
    ) -> Optional[AssetOut]:
        """Get single asset by ID"""
        
        result = await self.session.execute(
            select(MarketingAsset)
            .where(
                and_(
                    MarketingAsset.id == asset_id,
                    MarketingAsset.organization_id == organization_id
                )
            )
        )
        
        asset = result.scalar_one_or_none()
        if not asset:
            return None
            
        return AssetOut.from_orm(asset)

    async def get_asset_file_path(
        self,
        organization_id: uuid.UUID,
        asset_id: uuid.UUID
    ) -> Optional[str]:
        """Get the actual file path for serving the file"""
        
        asset = await self.get_asset(organization_id, asset_id)
        if not asset:
            return None
            
        # Check if file exists
        if os.path.exists(asset.file_path):
            return asset.file_path
        
        return None

    async def delete_asset(
        self,
        organization_id: uuid.UUID,
        asset_id: uuid.UUID
    ) -> bool:
        """Delete asset and its file from disk"""
        
        result = await self.session.execute(
            select(MarketingAsset)
            .where(
                and_(
                    MarketingAsset.id == asset_id,
                    MarketingAsset.organization_id == organization_id
                )
            )
        )
        
        asset = result.scalar_one_or_none()
        if not asset:
            return False
        
        # DELETE ACTUAL FILE FROM DISK
        try:
            if os.path.exists(asset.file_path):
                os.remove(asset.file_path)
        except Exception as e:
            print(f"Error deleting file {asset.file_path}: {e}")
        
        # Delete database record
        await self.session.delete(asset)
        return True

    async def list_assets(
        self,
        organization_id: uuid.UUID,
        asset_type: Optional[AssetType] = None,
        tags: Optional[List[str]] = None,
        search: Optional[str] = None,
        is_public: Optional[bool] = None,
        created_after: Optional[datetime] = None,
        created_before: Optional[datetime] = None,
        pagination: Optional[PaginationParams] = None
    ) -> Tuple[List[AssetOut], int]:
        """List assets with optional filters"""
        
        query = select(MarketingAsset).where(
            MarketingAsset.organization_id == organization_id
        )
        
        # Apply filters
        conditions = []
        
        if asset_type:
            conditions.append(MarketingAsset.asset_type == asset_type)
            
        if tags:
            for tag in tags:
                conditions.append(MarketingAsset.tags.contains([tag]))
                
        if search:
            search_term = f"%{search}%"
            conditions.append(
                or_(
                    MarketingAsset.name.ilike(search_term),
                    MarketingAsset.filename.ilike(search_term)
                )
            )
            
        if is_public is not None:
            conditions.append(MarketingAsset.is_public == is_public)
            
        if created_after:
            conditions.append(MarketingAsset.created_at >= created_after)
            
        if created_before:
            conditions.append(MarketingAsset.created_at <= created_before)
        
        if conditions:
            query = query.where(and_(*conditions))
            
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination and ordering
        query = query.order_by(desc(MarketingAsset.created_at))
        
        if pagination:
            query = query.offset((pagination.page - 1) * pagination.limit).limit(pagination.limit)
            
        # Execute query
        result = await self.session.execute(query)
        assets = result.scalars().all()
        
        return [AssetOut.from_orm(asset) for asset in assets], total

    async def update_asset(
        self,
        organization_id: uuid.UUID,
        asset_id: uuid.UUID,
        update_data: AssetUpdate
    ) -> Optional[AssetOut]:
        """Update existing asset metadata (not file content)"""
        
        result = await self.session.execute(
            select(MarketingAsset)
            .where(
                and_(
                    MarketingAsset.id == asset_id,
                    MarketingAsset.organization_id == organization_id
                )
            )
        )
        
        asset = result.scalar_one_or_none()
        if not asset:
            return None
        
        # Update fields (file content cannot be updated)
        update_dict = update_data.dict(exclude_unset=True, exclude={'filename', 'file_size', 'mime_type'})
        for field, value in update_dict.items():
            if hasattr(asset, field):
                setattr(asset, field, value)
        
        asset.updated_at = datetime.utcnow()
        
        await self.session.flush()
        await self.session.refresh(asset)
        
        return AssetOut.from_orm(asset)

    async def bulk_delete_assets(
        self,
        organization_id: uuid.UUID,
        asset_ids: List[uuid.UUID]
    ) -> Dict[str, int]:
        """Delete multiple assets and their files"""
        
        result = await self.session.execute(
            select(MarketingAsset)
            .where(
                and_(
                    MarketingAsset.id.in_(asset_ids),
                    MarketingAsset.organization_id == organization_id
                )
            )
        )
        
        assets = result.scalars().all()
        deleted_count = 0
        
        for asset in assets:
            try:
                # Delete file from disk
                if os.path.exists(asset.file_path):
                    os.remove(asset.file_path)
                
                # Delete from database
                await self.session.delete(asset)
                deleted_count += 1
            except Exception as e:
                print(f"Error deleting asset {asset.id}: {e}")
        
        return {
            "requested": len(asset_ids),
            "deleted": deleted_count,
            "not_found": len(asset_ids) - deleted_count
        }

    async def get_storage_usage(
        self,
        organization_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Get REAL storage usage statistics"""
        
        # Get actual usage by asset type from database
        result = await self.session.execute(
            select(
                MarketingAsset.asset_type,
                func.count(MarketingAsset.id).label('count'),
                func.sum(MarketingAsset.file_size).label('total_size')
            )
            .where(MarketingAsset.organization_id == organization_id)
            .group_by(MarketingAsset.asset_type)
        )
        
        usage_by_type = {}
        total_files = 0
        total_size = 0
        
        for asset_type, count, size in result.all():
            size = size or 0
            usage_by_type[asset_type.value] = {
                "count": count,
                "size_bytes": size,
                "size_mb": round(size / (1024 * 1024), 2)
            }
            total_files += count
            total_size += size
        
        # Recent uploads (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_result = await self.session.execute(
            select(func.count(MarketingAsset.id))
            .where(
                and_(
                    MarketingAsset.organization_id == organization_id,
                    MarketingAsset.created_at >= thirty_days_ago
                )
            )
        )
        recent_uploads = recent_result.scalar()
        
        return {
            "total_files": total_files,
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "usage_by_type": usage_by_type,
            "recent_uploads": recent_uploads,
            "storage_limit_mb": 10240,  # 10GB limit
            "usage_percentage": round((total_size / (10240 * 1024 * 1024)) * 100, 2)
        }

    async def get_assets_by_type(
        self,
        organization_id: uuid.UUID,
        asset_type: AssetType
    ) -> List[AssetOut]:
        """Get assets by type for quick filtering"""
        
        result = await self.session.execute(
            select(MarketingAsset)
            .where(
                and_(
                    MarketingAsset.organization_id == organization_id,
                    MarketingAsset.asset_type == asset_type
                )
            )
            .order_by(desc(MarketingAsset.created_at))
        )
        
        assets = result.scalars().all()
        return [AssetOut.from_orm(asset) for asset in assets]

    async def search_assets(
        self,
        organization_id: uuid.UUID,
        search_query: str
    ) -> List[AssetOut]:
        """Search assets by name and filename"""
        
        search_term = f"%{search_query}%"
        
        result = await self.session.execute(
            select(MarketingAsset)
            .where(
                and_(
                    MarketingAsset.organization_id == organization_id,
                    or_(
                        MarketingAsset.name.ilike(search_term),
                        MarketingAsset.filename.ilike(search_term),
                        MarketingAsset.tags.contains([search_query])
                    )
                )
            )
            .order_by(desc(MarketingAsset.created_at))
        )
        
        assets = result.scalars().all()
        return [AssetOut.from_orm(asset) for asset in assets]

    def _determine_asset_type(self, mime_type: str) -> AssetType:
        """Determine asset type from MIME type"""
        
        if mime_type.startswith('image/'):
            return AssetType.IMAGE
        elif mime_type.startswith('video/'):
            return AssetType.VIDEO
        elif mime_type.startswith('audio/'):
            return AssetType.AUDIO
        elif mime_type in ['application/pdf', 'text/plain', 'application/msword', 
                          'application/vnd.openxmlformats-officedocument.wordprocessingml.document']:
            return AssetType.DOCUMENT
        elif mime_type in ['text/html', 'text/css', 'application/json']:
            return AssetType.TEMPLATE
        else:
            return AssetType.OTHER

    def _validate_file(self, mime_type: str, file_size: int, asset_type: AssetType):
        """Validate file type and size"""
        
        # Check MIME type
        allowed_types = self.allowed_mime_types[asset_type]
        if '*/*' not in allowed_types and mime_type not in allowed_types:
            raise ValueError(f"File type {mime_type} not allowed for {asset_type.value}")
        
        # Check file size
        max_size = self.size_limits[asset_type]
        if file_size > max_size:
            raise ValueError(f"File size {file_size} exceeds limit of {max_size} bytes")

    def _generate_file_path(self, filename: str, organization_id: uuid.UUID) -> str:
        """Generate unique file path"""
        
        # Extract file extension
        _, ext = os.path.splitext(filename)
        
        # Generate unique filename
        unique_id = str(uuid.uuid4())
        new_filename = f"{unique_id}{ext}"
        
        # Create path structure: uploads/marketing/assets/{org_id}/{year}/{month}/{filename}
        now = datetime.utcnow()
        path = self.upload_base_path / str(organization_id) / str(now.year) / f"{now.month:02d}" / new_filename
        
        return str(path)

    def _extract_metadata(self, filename: str, mime_type: str, file_size: int) -> Dict[str, Any]:
        """Extract metadata from file"""
        
        metadata = {
            "original_filename": filename,
            "upload_timestamp": datetime.utcnow().isoformat(),
            "file_extension": os.path.splitext(filename)[1].lower(),
            "mime_type": mime_type,
            "file_size": file_size
        }
        
        return metadata