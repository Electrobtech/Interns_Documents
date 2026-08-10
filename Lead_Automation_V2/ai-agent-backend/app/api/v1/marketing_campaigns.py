"""Marketing Hub - Campaigns Management API"""
from __future__ import annotations

import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.models.marketing_hub import CampaignStatus
from app.schemas.marketing_hub import (
    CampaignCreate, CampaignUpdate, CampaignOut, CampaignSummary,
    CampaignFilters, PaginationParams, PaginatedResponse
)
from app.services.marketing_campaign_service import MarketingCampaignService
from app.services.audit_service import log_audit

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/campaigns", response_model=CampaignOut)
async def create_campaign(
    body: CampaignCreate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> CampaignOut:
    """Create a new marketing campaign"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingCampaignService(session)
    campaign = await service.create_campaign(organization_id, user_id, body)
    
    await log_audit(
        session, 
        organization_id, 
        user_id, 
        "marketing_hub.campaign.create", 
        {"campaign_id": str(campaign.id), "name": campaign.name}
    )
    await session.commit()
    
    return campaign


@router.get("/campaigns/{campaign_id}", response_model=CampaignOut)
async def get_campaign(
    campaign_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> CampaignOut:
    """Get a single campaign by ID"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingCampaignService(session)
    campaign = await service.get_campaign(organization_id, campaign_id)
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return campaign


@router.get("/campaigns", response_model=PaginatedResponse)
async def list_campaigns(
    # Pagination
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    
    # Filters
    status: CampaignStatus = Query(None),
    type: str = Query(None),
    objective: str = Query(None),
    channel: str = Query(None),
    start_date_from: str = Query(None),
    start_date_to: str = Query(None),
    tags: List[str] = Query(None),
    search: str = Query(None),
    
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> PaginatedResponse:
    """List campaigns with filters and pagination"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    pagination = PaginationParams(page=page, limit=limit)
    filters = CampaignFilters(
        status=status,
        type=type,
        objective=objective,
        channel=channel,
        tags=tags or [],
        search=search
    )
    
    service = MarketingCampaignService(session)
    campaigns, total = await service.list_campaigns(organization_id, filters, pagination)
    
    return PaginatedResponse(
        items=campaigns,
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit
    )


@router.put("/campaigns/{campaign_id}", response_model=CampaignOut)
async def update_campaign(
    campaign_id: uuid.UUID,
    body: CampaignUpdate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> CampaignOut:
    """Update an existing campaign"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingCampaignService(session)
    campaign = await service.update_campaign(organization_id, campaign_id, user_id, body)
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.campaign.update",
        {"campaign_id": str(campaign_id), "changes": body.dict(exclude_unset=True)}
    )
    await session.commit()
    
    return campaign


@router.patch("/campaigns/{campaign_id}/status", response_model=CampaignOut)
async def update_campaign_status(
    campaign_id: uuid.UUID,
    new_status: CampaignStatus,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> CampaignOut:
    """Update campaign status"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingCampaignService(session)
    
    try:
        campaign = await service.update_campaign_status(
            organization_id, campaign_id, user_id, new_status
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.campaign.status_change",
        {"campaign_id": str(campaign_id), "new_status": new_status.value}
    )
    await session.commit()
    
    return campaign


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Delete a campaign (soft delete)"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingCampaignService(session)
    success = await service.delete_campaign(organization_id, campaign_id, user_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.campaign.delete",
        {"campaign_id": str(campaign_id)}
    )
    await session.commit()
    
    return {"message": "Campaign deleted successfully"}


@router.get("/campaigns/{campaign_id}/metrics", response_model=dict)
async def get_campaign_metrics(
    campaign_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get detailed campaign metrics and performance data"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingCampaignService(session)
    campaign = await service.get_campaign(organization_id, campaign_id)
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Return enhanced metrics with additional calculated fields
    metrics = campaign.metrics or {}
    
    # Add some calculated metrics
    enhanced_metrics = {
        **metrics,
        "budget_utilization": (campaign.budget_spent / campaign.budget_total * 100) if campaign.budget_total else 0,
        "cost_per_acquisition": (campaign.budget_spent / metrics.get("conversions", 1)) if metrics.get("conversions") else 0,
        "efficiency_score": min(100, (metrics.get("roas", 0) * metrics.get("ctr", 0)) / 100),
        "campaign_health": "excellent" if metrics.get("roas", 0) > 5 else "good" if metrics.get("roas", 0) > 3 else "needs_improvement"
    }
    
    return enhanced_metrics


@router.post("/campaigns/bulk-status-update")
async def bulk_update_campaign_status(
    campaign_ids: List[uuid.UUID],
    new_status: CampaignStatus,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Bulk update status for multiple campaigns"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingCampaignService(session)
    updated_campaigns = []
    failed_campaigns = []
    
    for campaign_id in campaign_ids:
        try:
            campaign = await service.update_campaign_status(
                organization_id, campaign_id, user_id, new_status
            )
            if campaign:
                updated_campaigns.append(str(campaign_id))
        except Exception:
            failed_campaigns.append(str(campaign_id))
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.campaign.bulk_status_update",
        {
            "campaign_ids": [str(cid) for cid in campaign_ids],
            "new_status": new_status.value,
            "updated": len(updated_campaigns),
            "failed": len(failed_campaigns)
        }
    )
    await session.commit()
    
    return {
        "updated": updated_campaigns,
        "failed": failed_campaigns,
        "total_updated": len(updated_campaigns),
        "total_failed": len(failed_campaigns)
    }