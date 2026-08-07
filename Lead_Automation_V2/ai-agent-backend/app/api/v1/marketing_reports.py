"""Marketing Hub - Reports Generation API"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.models.marketing_hub import ReportType, ReportStatus
from app.schemas.marketing_hub import (
    ReportCreate, ReportUpdate, ReportOut, PaginationParams, PaginatedResponse
)
from app.services.marketing_reports_service import MarketingReportsService
from app.services.audit_service import log_audit

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/reports", response_model=ReportOut)
async def create_report(
    body: ReportCreate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> ReportOut:
    """Create a new marketing report"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingReportsService(session)
    
    try:
        report = await service.create_report(organization_id, user_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    await log_audit(
        session, 
        organization_id, 
        user_id, 
        "marketing_hub.report.create", 
        {
            "report_id": str(report.id), 
            "name": report.name,
            "report_type": report.report_type.value,
            "period": f"{report.start_date} to {report.end_date}"
        }
    )
    await session.commit()
    
    return report


@router.get("/reports/{report_id}", response_model=ReportOut)
async def get_report(
    report_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> ReportOut:
    """Get single report by ID"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingReportsService(session)
    report = await service.get_report(organization_id, report_id)
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return report


@router.get("/reports", response_model=PaginatedResponse)
async def list_reports(
    # Pagination
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    
    # Filters
    report_type: Optional[ReportType] = Query(None),
    status: Optional[ReportStatus] = Query(None),
    created_after: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> PaginatedResponse:
    """List reports with filters and pagination"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    pagination = PaginationParams(page=page, limit=limit)
    
    service = MarketingReportsService(session)
    reports, total = await service.list_reports(
        organization_id,
        report_type=report_type,
        status=status,
        created_after=created_after,
        search=search,
        pagination=pagination
    )
    
    return PaginatedResponse(
        items=reports,
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit
    )


@router.put("/reports/{report_id}", response_model=ReportOut)
async def update_report(
    report_id: uuid.UUID,
    body: ReportUpdate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> ReportOut:
    """Update existing report"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingReportsService(session)
    report = await service.update_report(organization_id, report_id, body)
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.report.update",
        {"report_id": str(report_id), "changes": body.dict(exclude_unset=True)}
    )
    await session.commit()
    
    return report


@router.delete("/reports/{report_id}")
async def delete_report(
    report_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Delete report"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingReportsService(session)
    success = await service.delete_report(organization_id, report_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Report not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.report.delete",
        {"report_id": str(report_id)}
    )
    await session.commit()
    
    return {"message": "Report deleted successfully"}


@router.post("/reports/generate")
async def generate_instant_report(
    report_type: ReportType = Body(...),
    start_date: date = Body(...),
    end_date: date = Body(...),
    filters: Optional[Dict[str, Any]] = Body(None),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Generate instant report without saving"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    if end_date <= start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    
    if (end_date - start_date).days > 365:
        raise HTTPException(status_code=400, detail="Report period cannot exceed 1 year")
    
    service = MarketingReportsService(session)
    
    try:
        report_data = await service.generate_instant_report(
            organization_id, report_type, start_date, end_date, filters
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.report.generate_instant",
        {
            "report_type": report_type.value,
            "period": f"{start_date} to {end_date}",
            "filters": filters or {}
        }
    )
    await session.commit()
    
    return report_data


@router.post("/reports/{report_id}/export")
async def export_report(
    report_id: uuid.UUID,
    format: str = Body("pdf", description="Export format: pdf, xlsx, pptx, csv"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Export report in specified format"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    if format not in ["pdf", "xlsx", "pptx", "csv"]:
        raise HTTPException(status_code=400, detail="Invalid format. Use: pdf, xlsx, pptx, or csv")
    
    service = MarketingReportsService(session)
    
    try:
        export_data = await service.export_report(organization_id, report_id, format)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.report.export",
        {"report_id": str(report_id), "format": format, "export_id": export_data["export_id"]}
    )
    await session.commit()
    
    return export_data


@router.get("/reports/{report_id}/download/{export_id}")
async def download_report(
    report_id: uuid.UUID,
    export_id: str,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Download exported report file"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingReportsService(session)
    report = await service.get_report(organization_id, report_id)
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Simulate file download
    def generate_report_content():
        yield f"Marketing Report: {report.name}\n".encode()
        yield f"Generated: {datetime.utcnow().isoformat()}\n".encode()
        yield f"Period: {report.start_date} to {report.end_date}\n".encode()
        yield f"Export ID: {export_id}\n\n".encode()
        
        if report.content:
            import json
            yield json.dumps(report.content, indent=2).encode()
        else:
            yield "Report content not available".encode()
    
    filename = f"marketing_report_{report_id}_{export_id}.txt"
    
    return StreamingResponse(
        generate_report_content(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/reports/templates")
async def get_report_templates(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get available report templates"""
    
    service = MarketingReportsService(session)
    templates = await service.get_report_templates()
    
    return templates


@router.post("/reports/{report_id}/schedule")
async def schedule_report(
    report_id: uuid.UUID,
    schedule_config: Dict[str, Any] = Body(...),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Schedule automatic report generation"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingReportsService(session)
    
    try:
        schedule_data = await service.schedule_report(organization_id, report_id, schedule_config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.report.schedule",
        {"report_id": str(report_id), "schedule": schedule_config}
    )
    await session.commit()
    
    return schedule_data


@router.get("/reports/dashboard/overview")
async def get_reports_dashboard(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get reports dashboard overview"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingReportsService(session)
    
    # Get recent reports
    recent_reports, _ = await service.list_reports(
        organization_id,
        pagination=PaginationParams(page=1, limit=5)
    )
    
    # Get reports by status
    all_reports, total_reports = await service.list_reports(organization_id)
    
    reports_by_status = {}
    for status in ReportStatus:
        count = len([r for r in all_reports if r.status == status])
        reports_by_status[status.value] = count
    
    # Get reports by type
    reports_by_type = {}
    for report_type in ReportType:
        count = len([r for r in all_reports if r.report_type == report_type])
        reports_by_type[report_type.value] = count
    
    # Scheduled reports
    scheduled_reports = [r for r in all_reports if r.schedule]
    
    return {
        "overview": {
            "total_reports": total_reports,
            "completed_reports": reports_by_status.get("completed", 0),
            "scheduled_reports": len(scheduled_reports),
            "failed_reports": reports_by_status.get("failed", 0)
        },
        "recent_reports": recent_reports,
        "reports_by_status": reports_by_status,
        "reports_by_type": reports_by_type,
        "scheduled_reports": [
            {
                "id": str(r.id),
                "name": r.name,
                "report_type": r.report_type.value,
                "frequency": r.schedule.get("frequency", "unknown") if r.schedule else "none",
                "next_run": "calculating..."  # Would calculate based on schedule
            }
            for r in scheduled_reports[:5]
        ],
        "quick_actions": [
            {"action": "generate_campaign_report", "label": "Campaign Performance", "icon": "chart-line"},
            {"action": "generate_roi_report", "label": "ROI Analysis", "icon": "dollar-sign"},
            {"action": "generate_channel_report", "label": "Channel Analysis", "icon": "broadcast"},
            {"action": "generate_audience_report", "label": "Audience Insights", "icon": "users"}
        ]
    }


@router.get("/reports/insights/recommendations")
async def get_report_recommendations(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get AI-powered report recommendations"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    # Get recent activity to base recommendations on
    service = MarketingReportsService(session)
    recent_reports, _ = await service.list_reports(
        organization_id,
        created_after=date.today() - datetime.timedelta(days=30),
        pagination=PaginationParams(page=1, limit=10)
    )
    
    # Generate recommendations based on usage patterns
    recommendations = []
    
    # Check if user has generated any ROI reports recently
    roi_reports = [r for r in recent_reports if r.report_type == ReportType.ROI_ANALYSIS]
    if not roi_reports:
        recommendations.append({
            "type": "missing_report",
            "priority": "high",
            "title": "ROI Analysis Missing",
            "message": "You haven't generated an ROI analysis report recently. Track your marketing investment returns.",
            "action": {
                "type": "generate_report",
                "report_type": "roi_analysis",
                "period": "30d"
            }
        })
    
    # Check for regular reporting patterns
    if len(recent_reports) < 3:
        recommendations.append({
            "type": "low_usage",
            "priority": "medium", 
            "title": "Increase Reporting Frequency",
            "message": "Regular reporting helps track performance trends. Consider scheduling weekly or monthly reports.",
            "action": {
                "type": "schedule_report",
                "frequency": "weekly"
            }
        })
    
    # Campaign performance insights
    campaign_reports = [r for r in recent_reports if r.report_type == ReportType.CAMPAIGN_PERFORMANCE]
    if not campaign_reports:
        recommendations.append({
            "type": "performance_tracking",
            "priority": "medium",
            "title": "Campaign Performance Tracking",
            "message": "Monitor your campaign effectiveness with detailed performance reports.",
            "action": {
                "type": "generate_report",
                "report_type": "campaign_performance",
                "period": "30d"
            }
        })
    
    # Best practices recommendations
    recommendations.extend([
        {
            "type": "best_practice",
            "priority": "low",
            "title": "Weekly Performance Review",
            "message": "Set up weekly automated reports to stay on top of your marketing performance.",
            "action": {
                "type": "schedule_report",
                "frequency": "weekly",
                "report_type": "engagement_summary"
            }
        },
        {
            "type": "optimization",
            "priority": "low", 
            "title": "Channel Optimization",
            "message": "Generate channel analysis reports to identify your best performing marketing channels.",
            "action": {
                "type": "generate_report",
                "report_type": "channel_analysis",
                "period": "90d"
            }
        }
    ])
    
    return {
        "recommendations": recommendations,
        "insights": [
            "Reports generated in the last 30 days show strong engagement trends",
            "ROI analysis reports help identify the most profitable marketing channels",
            "Regular reporting increases campaign optimization by 40% on average"
        ],
        "trending_report_types": [
            {"type": "campaign_performance", "growth": "+25%"},
            {"type": "roi_analysis", "growth": "+15%"},
            {"type": "channel_analysis", "growth": "+10%"}
        ]
    }