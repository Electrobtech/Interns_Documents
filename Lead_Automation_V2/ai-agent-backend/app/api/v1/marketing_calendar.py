"""Marketing Hub - Marketing Calendar API"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.models.marketing_hub import EventType, EventStatus
from app.schemas.marketing_hub import (
    CalendarEventCreate, CalendarEventUpdate, CalendarEventOut, 
    PaginationParams, PaginatedResponse
)
from app.services.marketing_calendar_service import MarketingCalendarService
from app.services.audit_service import log_audit

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/calendar/events", response_model=CalendarEventOut)
async def create_event(
    body: CalendarEventCreate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> CalendarEventOut:
    """Create a new calendar event"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingCalendarService(session)
    
    try:
        event = await service.create_event(organization_id, user_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    await log_audit(
        session, 
        organization_id, 
        user_id, 
        "marketing_hub.calendar.event.create", 
        {
            "event_id": str(event.id), 
            "title": event.title,
            "event_type": event.event_type.value,
            "start_date": event.start_date.isoformat()
        }
    )
    await session.commit()
    
    return event


@router.get("/calendar/events/{event_id}", response_model=CalendarEventOut)
async def get_event(
    event_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> CalendarEventOut:
    """Get single event by ID"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingCalendarService(session)
    event = await service.get_event(organization_id, event_id)
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return event


@router.get("/calendar/events", response_model=PaginatedResponse)
async def list_events(
    # Pagination
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    
    # Date filters
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    
    # Other filters
    event_type: Optional[EventType] = Query(None),
    status: Optional[EventStatus] = Query(None),
    campaign_id: Optional[uuid.UUID] = Query(None),
    assignee_id: Optional[uuid.UUID] = Query(None),
    tags: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
    
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> PaginatedResponse:
    """List events with filters and pagination"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    pagination = PaginationParams(page=page, limit=limit)
    
    service = MarketingCalendarService(session)
    events, total = await service.list_events(
        organization_id,
        start_date=start_date,
        end_date=end_date,
        event_type=event_type,
        status=status,
        campaign_id=campaign_id,
        assignee_id=assignee_id,
        tags=tags or [],
        search=search,
        pagination=pagination
    )
    
    return PaginatedResponse(
        items=events,
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit
    )


@router.put("/calendar/events/{event_id}", response_model=CalendarEventOut)
async def update_event(
    event_id: uuid.UUID,
    body: CalendarEventUpdate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> CalendarEventOut:
    """Update existing event"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingCalendarService(session)
    
    try:
        event = await service.update_event(organization_id, event_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.calendar.event.update",
        {"event_id": str(event_id), "changes": body.dict(exclude_unset=True)}
    )
    await session.commit()
    
    return event


@router.delete("/calendar/events/{event_id}")
async def delete_event(
    event_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Delete event"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingCalendarService(session)
    success = await service.delete_event(organization_id, event_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Event not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.calendar.event.delete",
        {"event_id": str(event_id)}
    )
    await session.commit()
    
    return {"message": "Event deleted successfully"}


@router.get("/calendar/view")
async def get_calendar_view(
    start_date: date = Query(..., description="Calendar view start date"),
    end_date: date = Query(..., description="Calendar view end date"),
    view_type: str = Query("month", description="Calendar view type"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get calendar view with events organized by date"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    # Validate date range
    if end_date <= start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    
    if (end_date - start_date).days > 366:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 1 year")
    
    service = MarketingCalendarService(session)
    calendar_data = await service.get_calendar_view(
        organization_id, start_date, end_date, view_type
    )
    
    return calendar_data


@router.get("/calendar/upcoming")
async def get_upcoming_events(
    days_ahead: int = Query(7, ge=1, le=30, description="Days ahead to look"),
    limit: int = Query(10, ge=1, le=50, description="Max events to return"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get upcoming events within specified days"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingCalendarService(session)
    events = await service.get_upcoming_events(organization_id, days_ahead, limit)
    
    return {
        "upcoming_events": events,
        "days_ahead": days_ahead,
        "total_count": len(events)
    }


@router.post("/calendar/check-conflicts")
async def check_event_conflicts(
    start_date: datetime,
    end_date: datetime,
    assignee_ids: Optional[List[uuid.UUID]] = None,
    exclude_event_id: Optional[uuid.UUID] = None,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Check for conflicting events in the given time range"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    if end_date <= start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    
    service = MarketingCalendarService(session)
    conflicts = await service.get_event_conflicts(
        organization_id, start_date, end_date, assignee_ids, exclude_event_id
    )
    
    return {
        "has_conflicts": len(conflicts) > 0,
        "conflict_count": len(conflicts),
        "conflicting_events": conflicts
    }


@router.get("/calendar/workload")
async def get_team_workload(
    start_date: date = Query(..., description="Analysis start date"),
    end_date: date = Query(..., description="Analysis end date"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get team workload analysis"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    if end_date <= start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    
    if (end_date - start_date).days > 90:
        raise HTTPException(status_code=400, detail="Analysis period cannot exceed 90 days")
    
    service = MarketingCalendarService(session)
    workload = await service.get_team_workload(organization_id, start_date, end_date)
    
    return workload


@router.get("/calendar/dashboard")
async def get_calendar_dashboard(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get calendar dashboard with overview statistics"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingCalendarService(session)
    
    # Get data for different time periods
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    month_start = today.replace(day=1)
    next_month = (month_start + timedelta(days=32)).replace(day=1)
    month_end = next_month - timedelta(days=1)
    
    # This week's events
    week_events, _ = await service.list_events(
        organization_id,
        start_date=week_start,
        end_date=week_end
    )
    
    # This month's events
    month_events, _ = await service.list_events(
        organization_id,
        start_date=month_start,
        end_date=month_end
    )
    
    # Upcoming events
    upcoming = await service.get_upcoming_events(organization_id, 7, 5)
    
    # Team workload
    workload = await service.get_team_workload(organization_id, today, today + timedelta(days=30))
    
    # Generate insights
    insights = []
    
    if len(week_events) > 10:
        insights.append({
            "type": "warning",
            "message": f"You have {len(week_events)} events this week. Consider prioritizing.",
            "action": "Review weekly schedule"
        })
    
    overdue_events = [e for e in month_events 
                     if e.end_date.date() < today and e.status not in [EventStatus.COMPLETED, EventStatus.CANCELLED]]
    
    if overdue_events:
        insights.append({
            "type": "alert",
            "message": f"You have {len(overdue_events)} overdue events that need attention.",
            "action": "Update event status"
        })
    
    upcoming_launches = [e for e in upcoming if e.event_type == EventType.LAUNCH]
    if upcoming_launches:
        insights.append({
            "type": "info",
            "message": f"You have {len(upcoming_launches)} product launches coming up.",
            "action": "Review launch readiness"
        })
    
    return {
        "overview": {
            "this_week_events": len(week_events),
            "this_month_events": len(month_events),
            "upcoming_deadlines": len([e for e in upcoming if e.event_type == EventType.DEADLINE]),
            "overdue_events": len(overdue_events),
            "active_campaigns": len([e for e in month_events if e.event_type == EventType.CAMPAIGN and e.status == EventStatus.ACTIVE])
        },
        "upcoming_events": upcoming[:5],  # Top 5 upcoming
        "team_workload_summary": {
            "total_team_members": len(workload["team_workload"]),
            "average_workload": workload["average_workload"],
            "busiest_member": max(workload["team_workload"], key=lambda x: x["workload_score"]) if workload["team_workload"] else None
        },
        "insights": insights,
        "quick_actions": [
            {"action": "create_event", "label": "Create New Event", "icon": "plus"},
            {"action": "view_week", "label": "View This Week", "icon": "calendar-week"},
            {"action": "check_deadlines", "label": "Check Deadlines", "icon": "clock"},
            {"action": "team_workload", "label": "Team Workload", "icon": "users"}
        ]
    }


@router.get("/calendar/templates")
async def get_event_templates(
    user: AuthUser = Depends(_can_manage),
) -> dict:
    """Get predefined event templates for quick creation"""
    
    templates = {
        "campaign_launch": {
            "title": "{{Campaign Name}} Launch",
            "description": "Launch campaign with all marketing channels activated",
            "event_type": EventType.LAUNCH,
            "duration_days": 1,
            "all_day": False,
            "default_tags": ["campaign", "launch"],
            "checklist": [
                "Prepare all marketing materials",
                "Set up tracking and analytics",
                "Schedule social media posts", 
                "Brief the team on launch strategy",
                "Monitor performance metrics"
            ]
        },
        "content_creation": {
            "title": "Content Creation: {{Content Type}}",
            "description": "Create and review content for {{Channel}}",
            "event_type": EventType.CONTENT_CREATION,
            "duration_days": 3,
            "all_day": True,
            "default_tags": ["content", "creation"],
            "checklist": [
                "Define content objectives",
                "Create initial draft",
                "Review and iterate",
                "Get stakeholder approval",
                "Prepare for publishing"
            ]
        },
        "campaign_planning": {
            "title": "{{Campaign Name}} Planning Sprint",
            "description": "Strategic planning session for upcoming campaign",
            "event_type": EventType.CAMPAIGN,
            "duration_days": 5,
            "all_day": True,
            "default_tags": ["planning", "strategy"],
            "checklist": [
                "Define campaign objectives",
                "Identify target audience",
                "Select marketing channels",
                "Create content calendar",
                "Set budget and timelines"
            ]
        },
        "social_media": {
            "title": "Social Media Posts - {{Platform}}",
            "description": "Schedule and publish social media content",
            "event_type": EventType.SOCIAL_POST,
            "duration_days": 1,
            "all_day": False,
            "default_tags": ["social", "content"],
            "checklist": [
                "Create engaging visuals",
                "Write compelling copy",
                "Schedule optimal posting times",
                "Monitor engagement",
                "Respond to comments"
            ]
        },
        "review_meeting": {
            "title": "{{Campaign/Project}} Review",
            "description": "Review progress and plan next steps",
            "event_type": EventType.MEETING,
            "duration_days": 1,
            "all_day": False,
            "default_tags": ["review", "meeting"],
            "checklist": [
                "Prepare performance data",
                "Analyze results vs goals",
                "Identify improvement areas",
                "Plan optimization actions",
                "Document key decisions"
            ]
        },
        "deadline_reminder": {
            "title": "DEADLINE: {{Task/Deliverable}}",
            "description": "Important deadline that requires attention",
            "event_type": EventType.DEADLINE,
            "duration_days": 1,
            "all_day": True,
            "default_tags": ["deadline", "urgent"],
            "checklist": [
                "Confirm completion status",
                "Prepare final deliverables",
                "Get necessary approvals",
                "Submit on time",
                "Follow up on next steps"
            ]
        }
    }
    
    return {
        "event_templates": templates,
        "usage_tips": {
            "variables": "Use {{Variable Name}} for customizable fields",
            "duration": "Adjust duration_days based on your needs",
            "tags": "Add relevant tags for better organization",
            "checklist": "Customize checklist items for your workflow"
        },
        "common_tags": [
            "campaign", "launch", "content", "social", "email", "review", 
            "planning", "deadline", "meeting", "urgent", "strategy", "creative"
        ]
    }