"""Marketing Hub - Analytics Dashboard API"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.models.marketing_hub import ChannelType
from app.services.marketing_analytics_service import MarketingAnalyticsService

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.get("/analytics/dashboard")
async def get_dashboard_overview(
    period: str = Query("30d", description="Time period: 7d, 30d, 90d"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get comprehensive marketing dashboard overview"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    if period not in ["7d", "30d", "90d"]:
        raise HTTPException(status_code=400, detail="Invalid period. Use: 7d, 30d, or 90d")
    
    service = MarketingAnalyticsService(session)
    dashboard = await service.get_dashboard_overview(organization_id, period)
    
    return dashboard


@router.get("/analytics/campaigns")
async def get_campaign_analytics(
    campaign_id: Optional[uuid.UUID] = Query(None, description="Specific campaign ID"),
    start_date: Optional[date] = Query(None, description="Analytics start date"),
    end_date: Optional[date] = Query(None, description="Analytics end date"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get comprehensive campaign analytics"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    # Validate date range
    if start_date and end_date and end_date <= start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    
    if start_date and end_date and (end_date - start_date).days > 365:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 1 year")
    
    service = MarketingAnalyticsService(session)
    analytics = await service.get_campaign_analytics(
        organization_id, campaign_id, start_date, end_date
    )
    
    return analytics


@router.get("/analytics/channels")
async def get_channel_analytics(
    channel_type: Optional[ChannelType] = Query(None, description="Specific channel type"),
    start_date: Optional[date] = Query(None, description="Analytics start date"),
    end_date: Optional[date] = Query(None, description="Analytics end date"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get comprehensive channel analytics"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    # Validate date range
    if start_date and end_date and end_date <= start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    
    service = MarketingAnalyticsService(session)
    analytics = await service.get_channel_analytics(
        organization_id, channel_type, start_date, end_date
    )
    
    return analytics


@router.get("/analytics/audience")
async def get_audience_analytics(
    segment_id: Optional[uuid.UUID] = Query(None, description="Specific segment ID"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get audience analytics and insights"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingAnalyticsService(session)
    analytics = await service.get_audience_analytics(organization_id, segment_id)
    
    return analytics


@router.get("/analytics/broadcasts")
async def get_broadcast_analytics(
    broadcast_id: Optional[uuid.UUID] = Query(None, description="Specific broadcast ID"),
    start_date: Optional[date] = Query(None, description="Analytics start date"),
    end_date: Optional[date] = Query(None, description="Analytics end date"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get broadcast performance analytics"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    # Validate date range
    if start_date and end_date and end_date <= start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    
    service = MarketingAnalyticsService(session)
    analytics = await service.get_broadcast_analytics(
        organization_id, broadcast_id, start_date, end_date
    )
    
    return analytics


@router.get("/analytics/roi")
async def get_roi_analytics(
    start_date: Optional[date] = Query(None, description="Analytics start date"),
    end_date: Optional[date] = Query(None, description="Analytics end date"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get ROI and revenue analytics"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    # Validate date range
    if start_date and end_date and end_date <= start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    
    service = MarketingAnalyticsService(session)
    analytics = await service.get_roi_analytics(organization_id, start_date, end_date)
    
    return analytics


@router.get("/analytics/charts/performance")
async def get_performance_charts(
    period: str = Query("30d", description="Time period for charts"),
    metric: str = Query("all", description="Specific metric: reach, engagement, conversions, revenue"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get chart data for performance metrics"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    if period not in ["7d", "30d", "90d"]:
        raise HTTPException(status_code=400, detail="Invalid period. Use: 7d, 30d, or 90d")
    
    if metric not in ["all", "reach", "engagement", "conversions", "revenue"]:
        raise HTTPException(status_code=400, detail="Invalid metric")
    
    # Calculate date range
    end_date = date.today()
    if period == "7d":
        start_date = end_date - timedelta(days=7)
        days = 7
    elif period == "30d":
        start_date = end_date - timedelta(days=30)
        days = 30
    else:  # 90d
        start_date = end_date - timedelta(days=90)
        days = 90
    
    service = MarketingAnalyticsService(session)
    trends = service._generate_trends_data(days)
    
    # Filter by metric if specified
    if metric != "all":
        filtered_trends = []
        for trend in trends:
            filtered_trend = {"date": trend["date"]}
            if metric in trend:
                filtered_trend[metric] = trend[metric]
            filtered_trends.append(filtered_trend)
        trends = filtered_trends
    
    return {
        "chart_data": trends,
        "period": period,
        "metric": metric,
        "total_data_points": len(trends)
    }


@router.get("/analytics/reports/summary")
async def get_analytics_summary_report(
    period: str = Query("30d", description="Report period"),
    format: str = Query("json", description="Report format: json, csv"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get summary analytics report"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    if period not in ["7d", "30d", "90d"]:
        raise HTTPException(status_code=400, detail="Invalid period")
    
    if format not in ["json", "csv"]:
        raise HTTPException(status_code=400, detail="Invalid format")
    
    service = MarketingAnalyticsService(session)
    
    # Get all analytics data
    dashboard = await service.get_dashboard_overview(organization_id, period)
    campaign_analytics = await service.get_campaign_analytics(organization_id)
    channel_analytics = await service.get_channel_analytics(organization_id)
    roi_analytics = await service.get_roi_analytics(organization_id)
    
    summary_report = {
        "report_meta": {
            "generated_at": datetime.utcnow().isoformat(),
            "period": period,
            "format": format,
            "organization_id": str(organization_id)
        },
        "executive_summary": {
            "total_campaigns": campaign_analytics["overview"]["total_campaigns"],
            "total_reach": campaign_analytics["overview"]["total_reach"],
            "overall_engagement_rate": campaign_analytics["overview"]["avg_engagement_rate"],
            "conversion_rate": campaign_analytics["overview"]["conversion_rate"],
            "total_revenue": roi_analytics["overview"]["total_revenue"],
            "overall_roi": roi_analytics["overview"]["overall_roi"],
            "active_channels": channel_analytics["overview"]["active_channels"],
            "best_performing_channel": channel_analytics["insights"]["best_performing_channel"]
        },
        "key_metrics": {
            "campaigns": campaign_analytics["overview"],
            "channels": channel_analytics["overview"],
            "roi": roi_analytics["overview"]
        },
        "performance_insights": dashboard["quick_insights"],
        "recommendations": [
            "Focus on high-performing channels for better ROI",
            "Optimize underperforming campaigns with A/B testing",
            "Increase engagement through personalized content",
            "Monitor conversion funnels for optimization opportunities"
        ]
    }
    
    if format == "csv":
        # In a real implementation, this would generate CSV format
        summary_report["csv_download_url"] = f"/api/v1/marketing-hub/analytics/reports/download?report_id=summary_{period}"
    
    return summary_report


@router.get("/analytics/real-time")
async def get_real_time_analytics(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get real-time analytics data"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    # Simulate real-time data
    import random
    
    real_time_data = {
        "current_timestamp": datetime.utcnow().isoformat(),
        "active_campaigns": random.randint(3, 12),
        "live_broadcasts": random.randint(0, 5),
        "real_time_engagement": {
            "last_5_minutes": random.randint(50, 300),
            "last_hour": random.randint(500, 2000),
            "trend": "up" if random.choice([True, False]) else "down"
        },
        "active_visitors": {
            "website": random.randint(20, 200),
            "landing_pages": random.randint(10, 100),
            "social_media": random.randint(30, 250)
        },
        "conversion_activity": {
            "last_hour_conversions": random.randint(5, 50),
            "conversion_value": round(random.uniform(200, 2000), 2),
            "top_converting_source": random.choice(["email", "whatsapp", "social", "direct"])
        },
        "alerts": [
            {
                "type": "info",
                "message": f"Campaign 'Summer Sale' performing {random.randint(15, 40)}% above average",
                "timestamp": (datetime.utcnow() - timedelta(minutes=random.randint(5, 30))).isoformat()
            }
        ]
    }
    
    return real_time_data


@router.get("/analytics/export")
async def export_analytics_data(
    data_type: str = Query(..., description="Data type: campaigns, channels, broadcasts, audience"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    format: str = Query("csv", description="Export format: csv, xlsx, json"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Export analytics data in specified format"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    if data_type not in ["campaigns", "channels", "broadcasts", "audience"]:
        raise HTTPException(status_code=400, detail="Invalid data type")
    
    if format not in ["csv", "xlsx", "json"]:
        raise HTTPException(status_code=400, detail="Invalid format")
    
    # Generate export metadata
    export_id = str(uuid.uuid4())
    filename = f"{data_type}_analytics_{export_id}.{format}"
    
    # In a real implementation, this would:
    # 1. Generate the actual file
    # 2. Store it in cloud storage
    # 3. Return a download URL
    
    return {
        "export_id": export_id,
        "filename": filename,
        "data_type": data_type,
        "format": format,
        "status": "processing",
        "estimated_completion": (datetime.utcnow() + timedelta(minutes=2)).isoformat(),
        "download_url": f"/api/v1/marketing-hub/analytics/download/{export_id}",
        "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat()
    }


@router.get("/analytics/insights")
async def get_ai_insights(
    focus_area: str = Query("overall", description="Focus area: overall, campaigns, channels, audience"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get AI-generated insights and recommendations"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    if focus_area not in ["overall", "campaigns", "channels", "audience"]:
        raise HTTPException(status_code=400, detail="Invalid focus area")
    
    service = MarketingAnalyticsService(session)
    dashboard = await service.get_dashboard_overview(organization_id, "30d")
    
    # Generate AI insights based on data
    insights = {
        "focus_area": focus_area,
        "generated_at": datetime.utcnow().isoformat(),
        "insights": [],
        "recommendations": [],
        "opportunities": [],
        "warnings": []
    }
    
    # Simulate AI-generated insights
    if focus_area == "overall":
        insights["insights"] = [
            f"Your marketing performance shows {dashboard['growth_metrics']['engagement_growth']}% engagement growth",
            f"ROI of {dashboard['kpis']['roi']}% indicates {'strong' if dashboard['kpis']['roi'] > 100 else 'moderate'} campaign effectiveness",
            f"Best performing channel: {dashboard['channel_summary']['best_performing']}"
        ]
        
        insights["recommendations"] = [
            "Focus budget allocation on high-performing channels",
            "Implement A/B testing for underperforming campaigns",
            "Increase content personalization to boost engagement"
        ]
        
        if dashboard["kpis"]["roi"] < 100:
            insights["warnings"].append({
                "severity": "high",
                "message": "ROI below break-even point - review campaign strategy"
            })
    
    elif focus_area == "campaigns":
        campaign_analytics = await service.get_campaign_analytics(organization_id)
        insights["insights"] = [
            f"You have {campaign_analytics['overview']['active_campaigns']} active campaigns",
            f"Average engagement rate: {campaign_analytics['overview']['avg_engagement_rate']}%",
            f"Top campaign reach: {max([c['reach'] for c in campaign_analytics['top_campaigns']], default=0):,}"
        ]
    
    elif focus_area == "channels":
        channel_analytics = await service.get_channel_analytics(organization_id)
        insights["insights"] = [
            f"Best performing channel: {channel_analytics['insights']['best_performing_channel']}",
            f"Most cost effective: {channel_analytics['insights']['most_cost_effective']}",
            f"Active channels: {channel_analytics['overview']['active_channels']}"
        ]
        
        insights["recommendations"] = channel_analytics["recommendations"]
    
    elif focus_area == "audience":
        audience_analytics = await service.get_audience_analytics(organization_id)
        insights["insights"] = [
            f"Total audience segments: {audience_analytics['overview']['total_segments']}",
            f"Total contacts: {audience_analytics['overview']['total_contacts']:,}",
            f"Active contact rate: {(audience_analytics['overview']['total_active_contacts'] / audience_analytics['overview']['total_contacts'] * 100):.1f}%"
        ]
        
        insights["recommendations"] = audience_analytics["recommendations"]
    
    return insights