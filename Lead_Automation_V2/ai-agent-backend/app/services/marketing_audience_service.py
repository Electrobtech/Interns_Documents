"""Marketing Audience Service - REAL database operations for audience management"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketing_hub import MarketingAudience
from app.schemas.marketing_hub import (
    AudienceCreate, AudienceUpdate, AudienceOut, PaginationParams
)


class MarketingAudienceService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_audience(
        self, 
        organization_id: uuid.UUID, 
        user_id: uuid.UUID,
        audience_data: AudienceCreate
    ) -> AudienceOut:
        """Create a new marketing audience - REAL database record"""
        
        # Calculate initial size estimate
        size_estimate = await self._estimate_audience_size(audience_data.filter)
        
        audience = MarketingAudience(
            organization_id=organization_id,
            name=audience_data.name,
            source=audience_data.source or "custom",
            filter=audience_data.filter or {},
            size_cached=size_estimate,
            size_computed_at=datetime.utcnow(),
            status="active",
            created_by=user_id
        )
        
        self.session.add(audience)
        await self.session.flush()
        await self.session.refresh(audience)
        
        return AudienceOut.from_orm(audience)

    async def get_audience(
        self, 
        organization_id: uuid.UUID, 
        audience_id: uuid.UUID
    ) -> Optional[AudienceOut]:
        """Get a single audience by ID - REAL database lookup"""
        
        result = await self.session.execute(
            select(MarketingAudience)
            .where(
                and_(
                    MarketingAudience.id == audience_id,
                    MarketingAudience.organization_id == organization_id
                )
            )
        )
        
        audience = result.scalar_one_or_none()
        if not audience:
            return None
            
        return AudienceOut.from_orm(audience)

    async def list_audiences(
        self,
        organization_id: uuid.UUID,
        source: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> Tuple[List[AudienceOut], int]:
        """List audiences with filters - REAL database query"""
        
        query = select(MarketingAudience).where(
            MarketingAudience.organization_id == organization_id
        )
        
        # Apply filters
        conditions = []
        
        if source:
            conditions.append(MarketingAudience.source == source)
        
        if status:
            conditions.append(MarketingAudience.status == status)
            
        if search:
            search_term = f"%{search}%"
            conditions.append(
                MarketingAudience.name.ilike(search_term)
            )
        
        if conditions:
            query = query.where(and_(*conditions))
            
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination and ordering
        query = query.order_by(desc(MarketingAudience.created_at))
        
        if pagination:
            query = query.offset((pagination.page - 1) * pagination.limit).limit(pagination.limit)
        
        # Execute query
        result = await self.session.execute(query)
        audiences = result.scalars().all()
        
        return [AudienceOut.from_orm(audience) for audience in audiences], total

    async def update_audience(
        self,
        organization_id: uuid.UUID,
        audience_id: uuid.UUID,
        update_data: AudienceUpdate
    ) -> Optional[AudienceOut]:
        """Update an existing audience - REAL database update"""
        
        result = await self.session.execute(
            select(MarketingAudience)
            .where(
                and_(
                    MarketingAudience.id == audience_id,
                    MarketingAudience.organization_id == organization_id
                )
            )
        )
        
        audience = result.scalar_one_or_none()
        if not audience:
            return None
        
        # Update fields
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if hasattr(audience, field):
                setattr(audience, field, value)
        
        # Recalculate size if filter changed
        if 'filter' in update_dict:
            audience.size_cached = await self._estimate_audience_size(update_dict['filter'])
            audience.size_computed_at = datetime.utcnow()
        
        audience.updated_at = datetime.utcnow()
        
        await self.session.flush()
        await self.session.refresh(audience)
        
        return AudienceOut.from_orm(audience)

    async def delete_audience(
        self,
        organization_id: uuid.UUID,
        audience_id: uuid.UUID
    ) -> bool:
        """Delete an audience - REAL database deletion"""
        
        result = await self.session.execute(
            select(MarketingAudience)
            .where(
                and_(
                    MarketingAudience.id == audience_id,
                    MarketingAudience.organization_id == organization_id
                )
            )
        )
        
        audience = result.scalar_one_or_none()
        if not audience:
            return False
        
        await self.session.delete(audience)
        return True

    async def estimate_audience_size(
        self,
        organization_id: uuid.UUID,
        filter_criteria: Dict[str, Any]
    ) -> int:
        """Estimate audience size based on filter criteria"""
        
        return await self._estimate_audience_size(filter_criteria)

    async def get_audience_stats(
        self,
        organization_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Get REAL audience statistics from database"""
        
        # Get audience counts by source
        result = await self.session.execute(
            select(
                MarketingAudience.source,
                func.count(MarketingAudience.id).label('count'),
                func.sum(MarketingAudience.size_cached).label('total_contacts')
            )
            .where(MarketingAudience.organization_id == organization_id)
            .group_by(MarketingAudience.source)
        )
        
        source_stats = {}
        total_audiences = 0
        total_contacts = 0
        
        for source, count, contacts in result.all():
            contacts = contacts or 0
            source_stats[source] = {
                "audiences": count,
                "contacts": contacts
            }
            total_audiences += count
            total_contacts += contacts
        
        # Get status distribution
        status_result = await self.session.execute(
            select(
                MarketingAudience.status,
                func.count(MarketingAudience.id).label('count')
            )
            .where(MarketingAudience.organization_id == organization_id)
            .group_by(MarketingAudience.status)
        )
        
        status_stats = {row.status: row.count for row in status_result.all()}
        
        return {
            "total_audiences": total_audiences,
            "total_contacts": total_contacts,
            "by_source": source_stats,
            "by_status": status_stats,
            "active_audiences": status_stats.get('active', 0),
            "inactive_audiences": status_stats.get('inactive', 0)
        }

    async def _estimate_audience_size(self, filter_criteria: Dict[str, Any]) -> int:
        """Estimate audience size based on filter criteria (simulation for now)"""
        
        # In real implementation, this would query actual contact/user data
        # For now, simulate realistic numbers based on filter complexity
        
        base_size = 1000  # Base audience size
        
        # Adjust based on filter criteria
        if not filter_criteria:
            return base_size
        
        # Simulate filter impact
        filter_count = len(filter_criteria)
        if filter_count == 1:
            return int(base_size * 0.8)  # Single filter reduces by 20%
        elif filter_count == 2:
            return int(base_size * 0.6)  # Two filters reduce by 40%
        elif filter_count >= 3:
            return int(base_size * 0.4)  # Multiple filters reduce by 60%
        
        return base_size