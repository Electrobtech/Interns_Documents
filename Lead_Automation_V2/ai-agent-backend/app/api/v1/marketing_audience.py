"""Marketing Hub - Audience Management API"""
from __future__ import annotations

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.schemas.marketing_hub import (
    AudienceSegmentCreate, AudienceSegmentUpdate, AudienceSegmentOut, 
    PaginationParams, PaginatedResponse
)
from app.services.marketing_audience_service import MarketingAudienceService
from app.services.audit_service import log_audit

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/audience-segments", response_model=AudienceSegmentOut)
async def create_audience_segment(
    body: AudienceSegmentCreate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> AudienceSegmentOut:
    """Create a new audience segment"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingAudienceService(session)
    segment = await service.create_audience_segment(organization_id, user_id, body)
    
    await log_audit(
        session, 
        organization_id, 
        user_id, 
        "marketing_hub.audience.create", 
        {
            "segment_id": str(segment.id), 
            "name": segment.name, 
            "is_dynamic": segment.is_dynamic,
            "estimated_size": segment.estimated_size
        }
    )
    await session.commit()
    
    return segment


@router.get("/audience-segments/{segment_id}", response_model=AudienceSegmentOut)
async def get_audience_segment(
    segment_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> AudienceSegmentOut:
    """Get a single audience segment by ID"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingAudienceService(session)
    segment = await service.get_audience_segment(organization_id, segment_id)
    
    if not segment:
        raise HTTPException(status_code=404, detail="Audience segment not found")
    
    return segment


@router.get("/audience-segments", response_model=PaginatedResponse)
async def list_audience_segments(
    # Pagination
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    
    # Filters
    is_dynamic: Optional[bool] = Query(None),
    tags: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
    
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> PaginatedResponse:
    """List audience segments with filters and pagination"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    pagination = PaginationParams(page=page, limit=limit)
    
    service = MarketingAudienceService(session)
    segments, total = await service.list_audience_segments(
        organization_id,
        is_dynamic=is_dynamic,
        tags=tags or [],
        search=search,
        pagination=pagination
    )
    
    return PaginatedResponse(
        items=segments,
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit
    )


@router.put("/audience-segments/{segment_id}", response_model=AudienceSegmentOut)
async def update_audience_segment(
    segment_id: uuid.UUID,
    body: AudienceSegmentUpdate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> AudienceSegmentOut:
    """Update an existing audience segment"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingAudienceService(session)
    segment = await service.update_audience_segment(organization_id, segment_id, body)
    
    if not segment:
        raise HTTPException(status_code=404, detail="Audience segment not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.audience.update",
        {"segment_id": str(segment_id), "changes": body.dict(exclude_unset=True)}
    )
    await session.commit()
    
    return segment


@router.delete("/audience-segments/{segment_id}")
async def delete_audience_segment(
    segment_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Delete an audience segment"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingAudienceService(session)
    success = await service.delete_audience_segment(organization_id, segment_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Audience segment not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.audience.delete",
        {"segment_id": str(segment_id)}
    )
    await session.commit()
    
    return {"message": "Audience segment deleted successfully"}


@router.post("/audience-segments/overlap-analysis")
async def calculate_segment_overlap(
    segment_ids: List[uuid.UUID] = Body(..., embed=True),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Calculate overlap between multiple audience segments"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingAudienceService(session)
    
    try:
        overlap_analysis = await service.calculate_segment_overlap(organization_id, segment_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.audience.overlap_analysis",
        {"segment_ids": [str(sid) for sid in segment_ids]}
    )
    await session.commit()
    
    return overlap_analysis


@router.post("/audience-segments/{segment_id}/export")
async def export_segment_contacts(
    segment_id: uuid.UUID,
    format_type: str = Body("csv", embed=True),
    include_fields: Optional[List[str]] = Body(None, embed=True),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Export contacts from an audience segment"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    if format_type not in ["csv", "xlsx", "json"]:
        raise HTTPException(status_code=400, detail="Unsupported export format")
    
    service = MarketingAudienceService(session)
    
    try:
        export_info = await service.export_segment_contacts(
            organization_id, segment_id, format_type, include_fields
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.audience.export",
        {
            "segment_id": str(segment_id),
            "format": format_type,
            "contact_count": export_info.get("total_contacts", 0)
        }
    )
    await session.commit()
    
    return export_info


@router.get("/audience-segments/{segment_id}/insights")
async def get_segment_insights(
    segment_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get detailed insights about an audience segment"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingAudienceService(session)
    
    try:
        insights = await service.get_segment_insights(organization_id, segment_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return insights


@router.get("/audience-segments/{segment_id}/suggestions")
async def get_segment_suggestions(
    segment_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get suggestions for improving segment criteria"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingAudienceService(session)
    
    try:
        suggestions = await service.suggest_segment_improvements(organization_id, segment_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return suggestions


@router.get("/audience-segments/dashboard-overview")
async def get_audience_dashboard_overview(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get audience dashboard overview statistics"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingAudienceService(session)
    segments, total = await service.list_audience_segments(organization_id)
    
    # Calculate overview statistics
    total_segments = total
    dynamic_segments = sum(1 for s in segments if s.is_dynamic)
    static_segments = total_segments - dynamic_segments
    
    total_contacts = sum(s.estimated_size or 0 for s in segments)
    avg_segment_size = total_contacts // total_segments if total_segments > 0 else 0
    
    # Group by tags
    all_tags = []
    for segment in segments:
        all_tags.extend(segment.tags or [])
    
    tag_usage = {}
    for tag in all_tags:
        tag_usage[tag] = tag_usage.get(tag, 0) + 1
    
    # Top segments by size
    top_segments = sorted(segments, key=lambda s: s.estimated_size or 0, reverse=True)[:5]
    
    # Calculate growth metrics (simulated)
    import random
    growth_metrics = {
        "new_contacts_this_month": random.randint(500, 5000),
        "segment_growth_rate": round(random.uniform(2, 15), 1),
        "engagement_score": random.randint(70, 90)
    }
    
    return {
        "total_segments": total_segments,
        "dynamic_segments": dynamic_segments,
        "static_segments": static_segments,
        "total_contacts": total_contacts,
        "average_segment_size": avg_segment_size,
        "growth_metrics": growth_metrics,
        "top_segments": [
            {
                "id": str(s.id),
                "name": s.name,
                "size": s.estimated_size,
                "type": "Dynamic" if s.is_dynamic else "Static"
            } for s in top_segments
        ],
        "popular_tags": sorted(tag_usage.items(), key=lambda x: x[1], reverse=True)[:10],
        "segment_health": {
            "healthy_segments": sum(1 for s in segments if (s.estimated_size or 0) > 100),
            "small_segments": sum(1 for s in segments if (s.estimated_size or 0) <= 100),
            "large_segments": sum(1 for s in segments if (s.estimated_size or 0) > 10000)
        },
        "recommendations": [
            "Create behavioral segments for better targeting" if dynamic_segments < total_segments * 0.3 else None,
            "Review small segments for potential merging" if sum(1 for s in segments if (s.estimated_size or 0) <= 100) > 5 else None,
            "Add more demographic criteria to large segments" if sum(1 for s in segments if (s.estimated_size or 0) > 10000) > 3 else None
        ]
    }


@router.get("/audience-criteria-builder")
async def get_criteria_builder_config(
    user: AuthUser = Depends(_can_manage),
) -> dict:
    """Get configuration for the audience criteria builder UI"""
    
    # Available fields for segmentation
    available_fields = {
        "contact_info": [
            {"field": "email", "label": "Email Address", "type": "string", "operators": ["equals", "contains", "not_equals", "not_contains"]},
            {"field": "phone", "label": "Phone Number", "type": "string", "operators": ["equals", "contains", "not_equals"]},
            {"field": "first_name", "label": "First Name", "type": "string", "operators": ["equals", "contains", "not_equals"]},
            {"field": "last_name", "label": "Last Name", "type": "string", "operators": ["equals", "contains", "not_equals"]}
        ],
        "demographics": [
            {"field": "age", "label": "Age", "type": "number", "operators": ["equals", "greater_than", "less_than", "between"]},
            {"field": "gender", "label": "Gender", "type": "select", "operators": ["equals", "not_equals"], "options": ["male", "female", "other"]},
            {"field": "location_city", "label": "City", "type": "string", "operators": ["equals", "contains", "not_equals"]},
            {"field": "location_state", "label": "State", "type": "string", "operators": ["equals", "contains", "not_equals"]},
            {"field": "location_country", "label": "Country", "type": "select", "operators": ["equals", "not_equals"], "options": ["India", "USA", "UK", "Canada", "Australia"]}
        ],
        "behavior": [
            {"field": "last_activity_date", "label": "Last Activity", "type": "date", "operators": ["after", "before", "between", "within_days"]},
            {"field": "email_opened_count", "label": "Emails Opened", "type": "number", "operators": ["equals", "greater_than", "less_than", "between"]},
            {"field": "email_clicked_count", "label": "Email Clicks", "type": "number", "operators": ["equals", "greater_than", "less_than", "between"]},
            {"field": "website_visits", "label": "Website Visits", "type": "number", "operators": ["equals", "greater_than", "less_than", "between"]},
            {"field": "page_views", "label": "Page Views", "type": "number", "operators": ["equals", "greater_than", "less_than", "between"]}
        ],
        "purchase": [
            {"field": "total_orders", "label": "Total Orders", "type": "number", "operators": ["equals", "greater_than", "less_than", "between"]},
            {"field": "total_spent", "label": "Total Spent", "type": "number", "operators": ["equals", "greater_than", "less_than", "between"]},
            {"field": "avg_order_value", "label": "Average Order Value", "type": "number", "operators": ["equals", "greater_than", "less_than", "between"]},
            {"field": "last_purchase_date", "label": "Last Purchase", "type": "date", "operators": ["after", "before", "between", "within_days"]},
            {"field": "preferred_category", "label": "Preferred Category", "type": "select", "operators": ["equals", "not_equals"], "options": ["Electronics", "Clothing", "Books", "Home", "Sports"]}
        ],
        "engagement": [
            {"field": "engagement_score", "label": "Engagement Score", "type": "number", "operators": ["equals", "greater_than", "less_than", "between"]},
            {"field": "email_subscription_status", "label": "Email Subscription", "type": "select", "operators": ["equals", "not_equals"], "options": ["subscribed", "unsubscribed", "bounced"]},
            {"field": "whatsapp_opt_in", "label": "WhatsApp Opt-in", "type": "boolean", "operators": ["equals"]},
            {"field": "sms_opt_in", "label": "SMS Opt-in", "type": "boolean", "operators": ["equals"]}
        ]
    }
    
    # Predefined segment templates
    templates = [
        {
            "id": "high-value-customers",
            "name": "High-Value Customers",
            "description": "Customers who have spent more than ₹10,000 and made 3+ orders",
            "criteria": {
                "operator": "AND",
                "rules": [
                    {"field": "total_spent", "operator": "greater_than", "value": 10000},
                    {"field": "total_orders", "operator": "greater_than", "value": 3}
                ]
            }
        },
        {
            "id": "engaged-subscribers",
            "name": "Engaged Email Subscribers",
            "description": "Subscribers who opened emails in the last 30 days",
            "criteria": {
                "operator": "AND", 
                "rules": [
                    {"field": "email_subscription_status", "operator": "equals", "value": "subscribed"},
                    {"field": "last_activity_date", "operator": "within_days", "value": 30}
                ]
            }
        },
        {
            "id": "cart-abandoners",
            "name": "Cart Abandoners",
            "description": "Users who visited in last 7 days but didn't purchase",
            "criteria": {
                "operator": "AND",
                "rules": [
                    {"field": "website_visits", "operator": "greater_than", "value": 0, "timeframe": {"days": 7}},
                    {"field": "last_purchase_date", "operator": "before", "value": "7_days_ago"}
                ]
            }
        },
        {
            "id": "new-subscribers",
            "name": "New Subscribers",
            "description": "Subscribers who joined in the last 14 days",
            "criteria": {
                "operator": "AND",
                "rules": [
                    {"field": "created_date", "operator": "within_days", "value": 14},
                    {"field": "email_subscription_status", "operator": "equals", "value": "subscribed"}
                ]
            }
        }
    ]
    
    return {
        "available_fields": available_fields,
        "templates": templates,
        "operators": {
            "string": ["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with"],
            "number": ["equals", "not_equals", "greater_than", "less_than", "between"],
            "date": ["equals", "before", "after", "between", "within_days", "within_weeks", "within_months"],
            "boolean": ["equals"],
            "select": ["equals", "not_equals", "in", "not_in"]
        },
        "logical_operators": ["AND", "OR"],
        "validation_rules": {
            "max_rules_per_segment": 10,
            "max_nested_groups": 3,
            "required_fields": ["field", "operator", "value"]
        }
    }