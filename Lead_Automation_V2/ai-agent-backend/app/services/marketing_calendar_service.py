"""Marketing Calendar Service - Business logic for calendar and event management"""
from __future__ import annotations

import uuid
import random
from datetime import datetime, timedelta, date
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, func, and_, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketing_hub import MarketingCalendarEvent, EventType, EventStatus
from app.schemas.marketing_hub import (
    CalendarEventCreate, CalendarEventUpdate, CalendarEventOut, PaginationParams
)


class MarketingCalendarService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_event(
        self, 
        organization_id: uuid.UUID, 
        user_id: uuid.UUID,
        event_data: CalendarEventCreate
    ) -> CalendarEventOut:
        """Create a new calendar event"""
        
        # Validate dates
        if event_data.start_date >= event_data.end_date:
            raise ValueError("End date must be after start date")
        
        # Generate event metadata
        metadata = self._generate_event_metadata(event_data)
        
        event = MarketingCalendarEvent(
            organization_id=organization_id,
            title=event_data.title,
            description=event_data.description,
            event_type=event_data.event_type,
            status=event_data.status or EventStatus.DRAFT,
            start_date=event_data.start_date,
            end_date=event_data.end_date,
            all_day=event_data.all_day,
            campaign_id=event_data.campaign_id,
            assignees=event_data.assignees or [],
            tags=event_data.tags or [],
            metadata=metadata,
            created_by=user_id
        )
        
        self.session.add(event)
        await self.session.flush()
        await self.session.refresh(event)
        
        return CalendarEventOut.from_orm(event)

    async def get_event(
        self, 
        organization_id: uuid.UUID, 
        event_id: uuid.UUID
    ) -> Optional[CalendarEventOut]:
        """Get single event by ID"""
        
        result = await self.session.execute(
            select(MarketingCalendarEvent)
            .where(
                and_(
                    MarketingCalendarEvent.id == event_id,
                    MarketingCalendarEvent.organization_id == organization_id
                )
            )
        )
        
        event = result.scalar_one_or_none()
        if not event:
            return None
            
        return CalendarEventOut.from_orm(event)

    async def list_events(
        self,
        organization_id: uuid.UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        event_type: Optional[EventType] = None,
        status: Optional[EventStatus] = None,
        campaign_id: Optional[uuid.UUID] = None,
        assignee_id: Optional[uuid.UUID] = None,
        tags: Optional[List[str]] = None,
        search: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> Tuple[List[CalendarEventOut], int]:
        """List events with optional filters"""
        
        query = select(MarketingCalendarEvent).where(
            MarketingCalendarEvent.organization_id == organization_id
        )
        
        # Apply filters
        conditions = []
        
        if start_date:
            conditions.append(MarketingCalendarEvent.start_date >= start_date)
            
        if end_date:
            conditions.append(MarketingCalendarEvent.end_date <= end_date)
            
        if event_type:
            conditions.append(MarketingCalendarEvent.event_type == event_type)
            
        if status:
            conditions.append(MarketingCalendarEvent.status == status)
            
        if campaign_id:
            conditions.append(MarketingCalendarEvent.campaign_id == campaign_id)
            
        if assignee_id:
            conditions.append(MarketingCalendarEvent.assignees.contains([str(assignee_id)]))
            
        if tags:
            for tag in tags:
                conditions.append(MarketingCalendarEvent.tags.contains([tag]))
                
        if search:
            search_term = f"%{search}%"
            conditions.append(
                or_(
                    MarketingCalendarEvent.title.ilike(search_term),
                    MarketingCalendarEvent.description.ilike(search_term)
                )
            )
        
        if conditions:
            query = query.where(and_(*conditions))
            
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination and ordering
        query = query.order_by(asc(MarketingCalendarEvent.start_date))
        
        if pagination:
            query = query.offset((pagination.page - 1) * pagination.limit).limit(pagination.limit)
            
        # Execute query
        result = await self.session.execute(query)
        events = result.scalars().all()
        
        return [CalendarEventOut.from_orm(event) for event in events], total

    async def update_event(
        self,
        organization_id: uuid.UUID,
        event_id: uuid.UUID,
        update_data: CalendarEventUpdate
    ) -> Optional[CalendarEventOut]:
        """Update existing event"""
        
        result = await self.session.execute(
            select(MarketingCalendarEvent)
            .where(
                and_(
                    MarketingCalendarEvent.id == event_id,
                    MarketingCalendarEvent.organization_id == organization_id
                )
            )
        )
        
        event = result.scalar_one_or_none()
        if not event:
            return None
        
        # Update fields
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if hasattr(event, field):
                setattr(event, field, value)
        
        # Validate dates if both are provided
        if hasattr(event, 'start_date') and hasattr(event, 'end_date'):
            if event.start_date >= event.end_date:
                raise ValueError("End date must be after start date")
        
        event.updated_at = datetime.utcnow()
        
        await self.session.flush()
        await self.session.refresh(event)
        
        return CalendarEventOut.from_orm(event)

    async def delete_event(
        self,
        organization_id: uuid.UUID,
        event_id: uuid.UUID
    ) -> bool:
        """Delete event"""
        
        result = await self.session.execute(
            select(MarketingCalendarEvent)
            .where(
                and_(
                    MarketingCalendarEvent.id == event_id,
                    MarketingCalendarEvent.organization_id == organization_id
                )
            )
        )
        
        event = result.scalar_one_or_none()
        if not event:
            return False
            
        await self.session.delete(event)
        return True

    async def get_calendar_view(
        self,
        organization_id: uuid.UUID,
        start_date: date,
        end_date: date,
        view_type: str = "month"
    ) -> Dict[str, Any]:
        """Get calendar view with events organized by date"""
        
        events, _ = await self.list_events(
            organization_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Organize events by date
        calendar_data = {}
        current_date = start_date
        
        while current_date <= end_date:
            date_str = current_date.isoformat()
            calendar_data[date_str] = {
                "date": date_str,
                "events": [],
                "event_count": 0,
                "has_deadlines": False,
                "has_launches": False
            }
            current_date += timedelta(days=1)
        
        # Add events to appropriate dates
        for event in events:
            event_start = event.start_date.date() if isinstance(event.start_date, datetime) else event.start_date
            event_end = event.end_date.date() if isinstance(event.end_date, datetime) else event.end_date
            
            # Add event to each day it spans
            current = event_start
            while current <= event_end and current <= end_date:
                if current >= start_date:
                    date_str = current.isoformat()
                    if date_str in calendar_data:
                        calendar_data[date_str]["events"].append(event)
                        calendar_data[date_str]["event_count"] += 1
                        
                        # Mark special event types
                        if event.event_type == EventType.DEADLINE:
                            calendar_data[date_str]["has_deadlines"] = True
                        elif event.event_type == EventType.LAUNCH:
                            calendar_data[date_str]["has_launches"] = True
                
                current += timedelta(days=1)
        
        return {
            "view_type": view_type,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "calendar_data": calendar_data,
            "total_events": len(events),
            "summary": self._generate_calendar_summary(events)
        }

    async def get_upcoming_events(
        self,
        organization_id: uuid.UUID,
        days_ahead: int = 7,
        limit: int = 10
    ) -> List[CalendarEventOut]:
        """Get upcoming events within specified days"""
        
        start_date = date.today()
        end_date = start_date + timedelta(days=days_ahead)
        
        events, _ = await self.list_events(
            organization_id,
            start_date=start_date,
            end_date=end_date,
            pagination=PaginationParams(page=1, limit=limit)
        )
        
        # Sort by urgency and start date
        events_with_urgency = []
        for event in events:
            urgency_score = self._calculate_urgency_score(event)
            events_with_urgency.append((event, urgency_score))
        
        events_with_urgency.sort(key=lambda x: (x[1], x[0].start_date), reverse=True)
        
        return [event for event, _ in events_with_urgency]

    async def get_event_conflicts(
        self,
        organization_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime,
        assignee_ids: Optional[List[uuid.UUID]] = None,
        exclude_event_id: Optional[uuid.UUID] = None
    ) -> List[CalendarEventOut]:
        """Check for conflicting events in the given time range"""
        
        query = select(MarketingCalendarEvent).where(
            and_(
                MarketingCalendarEvent.organization_id == organization_id,
                MarketingCalendarEvent.start_date < end_date,
                MarketingCalendarEvent.end_date > start_date
            )
        )
        
        if exclude_event_id:
            query = query.where(MarketingCalendarEvent.id != exclude_event_id)
        
        result = await self.session.execute(query)
        events = result.scalars().all()
        
        conflicts = []
        for event in events:
            # Check assignee conflicts if specified
            if assignee_ids:
                event_assignees = set(event.assignees or [])
                requested_assignees = set(str(aid) for aid in assignee_ids)
                if event_assignees.intersection(requested_assignees):
                    conflicts.append(CalendarEventOut.from_orm(event))
            else:
                conflicts.append(CalendarEventOut.from_orm(event))
        
        return conflicts

    async def get_team_workload(
        self,
        organization_id: uuid.UUID,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """Get team workload analysis"""
        
        events, _ = await self.list_events(
            organization_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # Calculate workload by assignee
        workload = {}
        for event in events:
            for assignee_id in (event.assignees or []):
                if assignee_id not in workload:
                    workload[assignee_id] = {
                        "assignee_id": assignee_id,
                        "total_events": 0,
                        "events_by_type": {},
                        "events_by_status": {},
                        "workload_score": 0
                    }
                
                workload[assignee_id]["total_events"] += 1
                
                # Count by type
                event_type = event.event_type.value
                workload[assignee_id]["events_by_type"][event_type] = \
                    workload[assignee_id]["events_by_type"].get(event_type, 0) + 1
                
                # Count by status
                status = event.status.value
                workload[assignee_id]["events_by_status"][status] = \
                    workload[assignee_id]["events_by_status"].get(status, 0) + 1
                
                # Calculate workload score (weighted by event type and duration)
                duration_days = (event.end_date - event.start_date).days + 1
                type_weight = {
                    EventType.CAMPAIGN: 3,
                    EventType.LAUNCH: 4,
                    EventType.DEADLINE: 2,
                    EventType.MEETING: 1,
                    EventType.CONTENT_CREATION: 2,
                    EventType.REVIEW: 1,
                    EventType.SOCIAL_POST: 1
                }.get(event.event_type, 2)
                
                workload[assignee_id]["workload_score"] += duration_days * type_weight
        
        return {
            "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "team_workload": list(workload.values()),
            "total_events": len(events),
            "average_workload": sum(w["workload_score"] for w in workload.values()) / len(workload) if workload else 0
        }

    def _generate_event_metadata(self, event_data: CalendarEventCreate) -> Dict[str, Any]:
        """Generate metadata for event"""
        
        duration_days = (event_data.end_date - event_data.start_date).days + 1
        
        metadata = {
            "duration_days": duration_days,
            "is_recurring": False,  # Could be extended for recurring events
            "created_at": datetime.utcnow().isoformat(),
            "event_category": self._categorize_event(event_data.event_type),
            "priority_level": self._calculate_priority_level(event_data)
        }
        
        # Add type-specific metadata
        if event_data.event_type == EventType.CAMPAIGN:
            metadata["campaign_phase"] = "planning"
            metadata["expected_deliverables"] = []
        elif event_data.event_type == EventType.LAUNCH:
            metadata["launch_checklist"] = []
            metadata["go_live_time"] = None
        elif event_data.event_type == EventType.CONTENT_CREATION:
            metadata["content_type"] = "general"
            metadata["approval_required"] = True
        
        return metadata

    def _categorize_event(self, event_type: EventType) -> str:
        """Categorize event for organization"""
        
        categories = {
            EventType.CAMPAIGN: "strategic",
            EventType.LAUNCH: "strategic", 
            EventType.DEADLINE: "operational",
            EventType.MEETING: "operational",
            EventType.CONTENT_CREATION: "creative",
            EventType.REVIEW: "operational",
            EventType.SOCIAL_POST: "creative"
        }
        
        return categories.get(event_type, "general")

    def _calculate_priority_level(self, event_data: CalendarEventCreate) -> str:
        """Calculate priority level based on event characteristics"""
        
        # Calculate days until start
        days_until_start = (event_data.start_date.date() - date.today()).days
        
        # Priority based on event type and timing
        if event_data.event_type in [EventType.LAUNCH, EventType.DEADLINE]:
            if days_until_start <= 3:
                return "critical"
            elif days_until_start <= 7:
                return "high"
            else:
                return "medium"
        elif event_data.event_type == EventType.CAMPAIGN:
            if days_until_start <= 7:
                return "high"
            else:
                return "medium"
        else:
            return "low"

    def _calculate_urgency_score(self, event: CalendarEventOut) -> int:
        """Calculate urgency score for prioritizing events"""
        
        days_until_start = (event.start_date.date() - date.today()).days
        
        # Base score from days until event
        urgency = max(0, 10 - days_until_start)
        
        # Boost score based on event type
        type_boost = {
            EventType.DEADLINE: 5,
            EventType.LAUNCH: 4,
            EventType.CAMPAIGN: 3,
            EventType.MEETING: 1,
            EventType.CONTENT_CREATION: 2,
            EventType.REVIEW: 2,
            EventType.SOCIAL_POST: 1
        }.get(event.event_type, 1)
        
        urgency += type_boost
        
        # Boost for overdue events
        if days_until_start < 0:
            urgency += abs(days_until_start) * 2
        
        return urgency

    def _generate_calendar_summary(self, events: List[CalendarEventOut]) -> Dict[str, Any]:
        """Generate summary statistics for calendar period"""
        
        summary = {
            "total_events": len(events),
            "events_by_type": {},
            "events_by_status": {},
            "upcoming_deadlines": 0,
            "active_campaigns": 0,
            "overdue_events": 0
        }
        
        today = date.today()
        
        for event in events:
            # Count by type
            event_type = event.event_type.value
            summary["events_by_type"][event_type] = \
                summary["events_by_type"].get(event_type, 0) + 1
            
            # Count by status
            status = event.status.value
            summary["events_by_status"][status] = \
                summary["events_by_status"].get(status, 0) + 1
            
            # Special counts
            if event.event_type == EventType.DEADLINE:
                summary["upcoming_deadlines"] += 1
            elif event.event_type == EventType.CAMPAIGN and event.status == EventStatus.ACTIVE:
                summary["active_campaigns"] += 1
            
            # Check for overdue events
            event_date = event.end_date.date() if isinstance(event.end_date, datetime) else event.end_date
            if event_date < today and event.status not in [EventStatus.COMPLETED, EventStatus.CANCELLED]:
                summary["overdue_events"] += 1
        
        return summary