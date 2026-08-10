"""Marketing Hub - Broadcasts System API"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.models.marketing_hub import BroadcastType, BroadcastStatus, ChannelType
from app.schemas.marketing_hub import (
    BroadcastCreate, BroadcastUpdate, BroadcastOut, PaginationParams, PaginatedResponse
)
from app.services.marketing_broadcast_service import MarketingBroadcastService
from app.services.audit_service import log_audit

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/broadcasts", response_model=BroadcastOut)
async def create_broadcast(
    body: BroadcastCreate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> BroadcastOut:
    """Create a new marketing broadcast"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingBroadcastService(session)
    broadcast = await service.create_broadcast(organization_id, user_id, body)
    
    await log_audit(
        session, 
        organization_id, 
        user_id, 
        "marketing_hub.broadcast.create", 
        {
            "broadcast_id": str(broadcast.id), 
            "name": broadcast.name, 
            "channel": broadcast.channel,
            "type": broadcast.type
        }
    )
    await session.commit()
    
    return broadcast


@router.get("/broadcasts/{broadcast_id}", response_model=BroadcastOut)
async def get_broadcast(
    broadcast_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> BroadcastOut:
    """Get a single broadcast by ID"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingBroadcastService(session)
    broadcast = await service.get_broadcast(organization_id, broadcast_id)
    
    if not broadcast:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    
    return broadcast


@router.get("/broadcasts", response_model=PaginatedResponse)
async def list_broadcasts(
    # Pagination
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    
    # Filters
    campaign_id: Optional[uuid.UUID] = Query(None),
    status: Optional[BroadcastStatus] = Query(None),
    channel: Optional[ChannelType] = Query(None),
    broadcast_type: Optional[BroadcastType] = Query(None, alias="type"),
    
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> PaginatedResponse:
    """List broadcasts with filters and pagination"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    pagination = PaginationParams(page=page, limit=limit)
    
    service = MarketingBroadcastService(session)
    broadcasts, total = await service.list_broadcasts(
        organization_id,
        campaign_id=campaign_id,
        status=status,
        channel=channel,
        broadcast_type=broadcast_type,
        pagination=pagination
    )
    
    return PaginatedResponse(
        items=broadcasts,
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit
    )


@router.put("/broadcasts/{broadcast_id}", response_model=BroadcastOut)
async def update_broadcast(
    broadcast_id: uuid.UUID,
    body: BroadcastUpdate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> BroadcastOut:
    """Update an existing broadcast"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingBroadcastService(session)
    
    try:
        broadcast = await service.update_broadcast(organization_id, broadcast_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if not broadcast:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.broadcast.update",
        {"broadcast_id": str(broadcast_id), "changes": body.dict(exclude_unset=True)}
    )
    await session.commit()
    
    return broadcast


@router.delete("/broadcasts/{broadcast_id}")
async def delete_broadcast(
    broadcast_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Delete a broadcast (only if not sent)"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingBroadcastService(session)
    
    try:
        success = await service.delete_broadcast(organization_id, broadcast_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if not success:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.broadcast.delete",
        {"broadcast_id": str(broadcast_id)}
    )
    await session.commit()
    
    return {"message": "Broadcast deleted successfully"}


@router.post("/broadcasts/{broadcast_id}/send", response_model=BroadcastOut)
async def send_broadcast_now(
    broadcast_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> BroadcastOut:
    """Send a broadcast immediately"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingBroadcastService(session)
    
    try:
        broadcast = await service.send_broadcast_now(organization_id, broadcast_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.broadcast.send_now",
        {"broadcast_id": str(broadcast_id)}
    )
    await session.commit()
    
    return broadcast


@router.post("/broadcasts/{broadcast_id}/schedule", response_model=BroadcastOut)
async def schedule_broadcast(
    broadcast_id: uuid.UUID,
    scheduled_time: datetime = Body(..., embed=True),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> BroadcastOut:
    """Schedule a broadcast for later sending"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingBroadcastService(session)
    
    try:
        broadcast = await service.schedule_broadcast(organization_id, broadcast_id, scheduled_time)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.broadcast.schedule",
        {"broadcast_id": str(broadcast_id), "scheduled_time": scheduled_time.isoformat()}
    )
    await session.commit()
    
    return broadcast


@router.post("/broadcasts/{broadcast_id}/cancel", response_model=BroadcastOut)
async def cancel_broadcast(
    broadcast_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> BroadcastOut:
    """Cancel a scheduled broadcast"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingBroadcastService(session)
    
    try:
        broadcast = await service.cancel_broadcast(organization_id, broadcast_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.broadcast.cancel",
        {"broadcast_id": str(broadcast_id)}
    )
    await session.commit()
    
    return broadcast


@router.post("/broadcasts/{broadcast_id}/duplicate", response_model=BroadcastOut)
async def duplicate_broadcast(
    broadcast_id: uuid.UUID,
    new_name: Optional[str] = Body(None, embed=True),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> BroadcastOut:
    """Duplicate an existing broadcast"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingBroadcastService(session)
    
    try:
        broadcast = await service.duplicate_broadcast(organization_id, broadcast_id, user_id, new_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.broadcast.duplicate",
        {"original_id": str(broadcast_id), "duplicate_id": str(broadcast.id)}
    )
    await session.commit()
    
    return broadcast


@router.get("/broadcasts/{broadcast_id}/preview")
async def get_broadcast_preview(
    broadcast_id: uuid.UUID,
    recipient_sample: Optional[dict] = Body(None),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get a preview of how the broadcast will look"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingBroadcastService(session)
    
    try:
        preview = await service.get_broadcast_preview(organization_id, broadcast_id, recipient_sample)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return preview


@router.get("/broadcasts/dashboard-stats")
async def get_broadcasts_dashboard_stats(
    days: int = Query(30, ge=1, le=90),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get broadcast statistics for dashboard"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingBroadcastService(session)
    broadcasts, total = await service.list_broadcasts(organization_id)
    
    # Calculate statistics
    total_broadcasts = total
    sent_broadcasts = sum(1 for b in broadcasts if b.status == "sent")
    scheduled_broadcasts = sum(1 for b in broadcasts if b.status == "scheduled")
    draft_broadcasts = sum(1 for b in broadcasts if b.status == "draft")
    
    # Calculate engagement metrics
    total_sent = sum(b.metrics.get("sent_count", 0) for b in broadcasts if b.status == "sent")
    total_delivered = sum(b.metrics.get("delivered_count", 0) for b in broadcasts if b.status == "sent")
    total_opened = sum(b.metrics.get("opened_count", 0) for b in broadcasts if b.status == "sent")
    total_clicked = sum(b.metrics.get("clicked_count", 0) for b in broadcasts if b.status == "sent")
    
    # Calculate averages
    avg_delivery_rate = (total_delivered / total_sent * 100) if total_sent > 0 else 0
    avg_open_rate = (total_opened / total_delivered * 100) if total_delivered > 0 else 0
    avg_click_rate = (total_clicked / total_opened * 100) if total_opened > 0 else 0
    
    # Group by channel
    by_channel = {}
    for broadcast in broadcasts:
        channel = broadcast.channel
        if channel not in by_channel:
            by_channel[channel] = {
                "count": 0, 
                "sent": 0, 
                "total_recipients": 0,
                "avg_open_rate": 0
            }
        
        by_channel[channel]["count"] += 1
        if broadcast.status == "sent":
            by_channel[channel]["sent"] += 1
            by_channel[channel]["total_recipients"] += broadcast.metrics.get("total_recipients", 0)
            by_channel[channel]["avg_open_rate"] = broadcast.metrics.get("open_rate", 0)
    
    return {
        "total_broadcasts": total_broadcasts,
        "sent_broadcasts": sent_broadcasts,
        "scheduled_broadcasts": scheduled_broadcasts,
        "draft_broadcasts": draft_broadcasts,
        "performance": {
            "total_messages_sent": total_sent,
            "average_delivery_rate": round(avg_delivery_rate, 2),
            "average_open_rate": round(avg_open_rate, 2),
            "average_click_rate": round(avg_click_rate, 2),
            "total_recipients_reached": total_delivered
        },
        "by_channel": by_channel,
        "trends": {
            "broadcasts_this_month": total_broadcasts,  # Simplified for demo
            "growth_rate": "+12%",  # Simulated
            "best_performing_channel": max(by_channel.keys(), key=lambda k: by_channel[k]["avg_open_rate"]) if by_channel else None
        }
    }


@router.get("/broadcasts/templates")
async def get_broadcast_templates(
    channel: Optional[ChannelType] = Query(None),
    user: AuthUser = Depends(_can_manage),
) -> dict:
    """Get available broadcast templates by channel"""
    
    # Simulated broadcast templates
    templates = {
        "whatsapp": [
            {
                "id": "welcome-series",
                "name": "Welcome Series",
                "description": "Multi-part welcome sequence for new customers",
                "content": {
                    "type": "text",
                    "body": "Welcome to {{company_name}}! We're excited to have you on board. Here's what you can expect..."
                },
                "variables": ["company_name", "first_name"],
                "category": "onboarding"
            },
            {
                "id": "flash-sale",
                "name": "Flash Sale Alert",
                "description": "Time-sensitive promotional message",
                "content": {
                    "type": "text", 
                    "body": "🔥 Flash Sale Alert! Get {{discount}}% off {{product_name}} for the next 24 hours. Use code: {{promo_code}}"
                },
                "variables": ["discount", "product_name", "promo_code"],
                "category": "promotion"
            }
        ],
        "email": [
            {
                "id": "newsletter",
                "name": "Monthly Newsletter",
                "description": "Regular newsletter template with sections",
                "content": {
                    "subject": "{{company_name}} Newsletter - {{month}} {{year}}",
                    "html_body": "<h1>What's New This Month</h1><p>Dear {{first_name}},</p>...",
                    "text_body": "What's New This Month\n\nDear {{first_name}},\n..."
                },
                "variables": ["company_name", "month", "year", "first_name"],
                "category": "newsletter"
            },
            {
                "id": "abandoned-cart",
                "name": "Abandoned Cart Recovery", 
                "description": "Recover abandoned shopping carts",
                "content": {
                    "subject": "You left something in your cart, {{first_name}}",
                    "html_body": "<p>Hi {{first_name}},</p><p>You have {{item_count}} items waiting in your cart...</p>",
                    "text_body": "Hi {{first_name}},\n\nYou have {{item_count}} items waiting in your cart..."
                },
                "variables": ["first_name", "item_count", "cart_total"],
                "category": "ecommerce"
            }
        ],
        "sms": [
            {
                "id": "appointment-reminder",
                "name": "Appointment Reminder",
                "description": "Remind customers of upcoming appointments",
                "content": {
                    "body": "Reminder: Your appointment with {{company_name}} is tomorrow at {{time}}. Reply CONFIRM to confirm."
                },
                "variables": ["company_name", "time", "date"],
                "category": "reminder"
            }
        ]
    }
    
    if channel:
        return {"templates": templates.get(channel.value, [])}
    
    return {"templates": templates}