"""Marketing Hub - Channels Management API"""
from __future__ import annotations

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.models.marketing_hub import ChannelType, ChannelStatus
from app.schemas.marketing_hub import (
    ChannelCreate, ChannelUpdate, ChannelOut, PaginationParams, PaginatedResponse
)
from app.services.marketing_channel_service import MarketingChannelService
from app.services.audit_service import log_audit

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/channels", response_model=ChannelOut)
async def create_channel(
    body: ChannelCreate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> ChannelOut:
    """Create a new marketing channel"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingChannelService(session)
    channel = await service.create_channel(organization_id, user_id, body)
    
    await log_audit(
        session, 
        organization_id, 
        user_id, 
        "marketing_hub.channel.create", 
        {"channel_id": str(channel.id), "name": channel.name, "type": channel.type}
    )
    await session.commit()
    
    return channel


@router.get("/channels/{channel_id}", response_model=ChannelOut)
async def get_channel(
    channel_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> ChannelOut:
    """Get a single channel by ID"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingChannelService(session)
    channel = await service.get_channel(organization_id, channel_id)
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    return channel


@router.get("/channels", response_model=PaginatedResponse)
async def list_channels(
    # Pagination
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    
    # Filters
    channel_type: Optional[ChannelType] = Query(None, alias="type"),
    status: Optional[ChannelStatus] = Query(None),
    
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> PaginatedResponse:
    """List channels with filters and pagination"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    pagination = PaginationParams(page=page, limit=limit)
    
    service = MarketingChannelService(session)
    channels, total = await service.list_channels(
        organization_id, 
        channel_type=channel_type, 
        status=status, 
        pagination=pagination
    )
    
    return PaginatedResponse(
        items=channels,
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit
    )


@router.put("/channels/{channel_id}", response_model=ChannelOut)
async def update_channel(
    channel_id: uuid.UUID,
    body: ChannelUpdate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> ChannelOut:
    """Update an existing channel"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingChannelService(session)
    channel = await service.update_channel(organization_id, channel_id, body)
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.channel.update",
        {"channel_id": str(channel_id), "changes": body.dict(exclude_unset=True)}
    )
    await session.commit()
    
    return channel


@router.delete("/channels/{channel_id}")
async def delete_channel(
    channel_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Delete a channel"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingChannelService(session)
    success = await service.delete_channel(organization_id, channel_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.channel.delete",
        {"channel_id": str(channel_id)}
    )
    await session.commit()
    
    return {"message": "Channel deleted successfully"}


@router.post("/channels/{channel_id}/test-connection")
async def test_channel_connection(
    channel_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Test channel connection"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingChannelService(session)
    result = await service.test_channel_connection(organization_id, channel_id)
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.channel.test_connection",
        {"channel_id": str(channel_id), "result": result["status"]}
    )
    await session.commit()
    
    return result


@router.get("/channels/{channel_id}/usage-stats")
async def get_channel_usage_stats(
    channel_id: uuid.UUID,
    days: int = Query(30, ge=1, le=90),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get detailed usage statistics for a channel"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingChannelService(session)
    stats = await service.get_channel_usage_stats(organization_id, channel_id, days)
    
    if not stats:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    return stats


@router.get("/channels/overview")
async def get_channels_overview(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get overview of all channels with summary statistics"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingChannelService(session)
    channels, total = await service.list_channels(organization_id)
    
    # Calculate overview statistics
    active_channels = sum(1 for ch in channels if ch.status == "active")
    error_channels = sum(1 for ch in channels if ch.status == "error")
    total_usage = sum(ch.current_usage for ch in channels)
    
    # Group by type
    by_type = {}
    for channel in channels:
        channel_type = channel.type
        if channel_type not in by_type:
            by_type[channel_type] = {"count": 0, "active": 0, "total_usage": 0}
        
        by_type[channel_type]["count"] += 1
        if channel.status == "active":
            by_type[channel_type]["active"] += 1
        by_type[channel_type]["total_usage"] += channel.current_usage
    
    # Calculate health score
    health_score = (active_channels / total * 100) if total > 0 else 100
    
    return {
        "total_channels": total,
        "active_channels": active_channels,
        "error_channels": error_channels,
        "pending_channels": total - active_channels - error_channels,
        "total_current_usage": total_usage,
        "health_score": round(health_score, 1),
        "channels_by_type": by_type,
        "recommendations": [
            "Set up daily limits for high-usage channels" if total_usage > 50000 else None,
            "Fix connection issues for error channels" if error_channels > 0 else None,
            "Consider adding backup channels for reliability" if active_channels < 2 else None
        ]
    }


@router.get("/channel-types")
async def get_supported_channel_types(
    user: AuthUser = Depends(_can_manage),
) -> dict:
    """Get list of supported channel types with their capabilities"""
    
    channel_types = {
        "whatsapp": {
            "name": "WhatsApp Business API",
            "description": "Send messages via WhatsApp Business API",
            "capabilities": ["text", "media", "templates", "interactive"],
            "rate_limits": {"messages_per_second": 20, "messages_per_day": 100000},
            "required_fields": ["business_account_id", "phone_number_id", "access_token"],
            "setup_complexity": "medium"
        },
        "email": {
            "name": "Email Marketing",
            "description": "Send marketing emails via SMTP or API",
            "capabilities": ["html", "text", "attachments", "templates"],
            "rate_limits": {"messages_per_hour": 10000},
            "required_fields": ["smtp_host", "smtp_port", "username", "password"],
            "setup_complexity": "easy"
        },
        "sms": {
            "name": "SMS Marketing",
            "description": "Send SMS messages via carrier APIs",
            "capabilities": ["text", "unicode", "delivery_reports"],
            "rate_limits": {"messages_per_minute": 100},
            "required_fields": ["provider_api_key", "sender_id"],
            "setup_complexity": "easy"
        },
        "messenger": {
            "name": "Facebook Messenger",
            "description": "Send messages via Facebook Messenger API",
            "capabilities": ["text", "media", "quick_replies", "buttons"],
            "rate_limits": {"messages_per_second": 5},
            "required_fields": ["page_access_token", "app_secret"],
            "setup_complexity": "medium"
        },
        "instagram": {
            "name": "Instagram Direct",
            "description": "Send direct messages on Instagram",
            "capabilities": ["text", "media", "stories"],
            "rate_limits": {"messages_per_hour": 1000},
            "required_fields": ["instagram_account_id", "access_token"],
            "setup_complexity": "medium"
        },
        "linkedin": {
            "name": "LinkedIn Messaging",
            "description": "Send messages via LinkedIn API",
            "capabilities": ["text", "sponsored_content"],
            "rate_limits": {"messages_per_day": 500},
            "required_fields": ["client_id", "client_secret", "access_token"],
            "setup_complexity": "hard"
        }
    }
    
    return {
        "supported_types": list(channel_types.keys()),
        "channel_details": channel_types,
        "recommended_setup_order": ["email", "sms", "whatsapp", "messenger", "instagram", "linkedin"]
    }