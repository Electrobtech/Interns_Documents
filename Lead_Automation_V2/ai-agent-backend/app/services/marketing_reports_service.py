"""Marketing Reports Service - Business logic for report generation and management"""
from __future__ import annotations

import uuid
import json
from datetime import datetime, timedelta, date
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketing_hub import MarketingReport, ReportType, ReportStatus
from app.schemas.marketing_hub import (
    ReportCreate, ReportUpdate, ReportOut, PaginationParams
)
from app.services.marketing_analytics_service import MarketingAnalyticsService


class MarketingReportsService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.analytics_service = MarketingAnalyticsService(session)

    async def create_report(
        self, 
        organization_id: uuid.UUID, 
        user_id: uuid.UUID,
        report_data: ReportCreate
    ) -> ReportOut:
        """Create a new marketing report"""
        
        # Validate date range
        if report_data.end_date <= report_data.start_date:
            raise ValueError("End date must be after start date")
        
        if (report_data.end_date - report_data.start_date).days > 365:
            raise ValueError("Report period cannot exceed 1 year")
        
        # Generate report configuration
        config = self._generate_report_config(report_data)
        
        report = MarketingReport(
            organization_id=organization_id,
            name=report_data.name,
            description=report_data.description,
            report_type=report_data.report_type,
            start_date=report_data.start_date,
            end_date=report_data.end_date,
            filters=report_data.filters or {},
            configuration=config,
            status=ReportStatus.PENDING,
            recipients=report_data.recipients or [],
            schedule=report_data.schedule,
            created_by=user_id
        )
        
        self.session.add(report)
        await self.session.flush()
        await self.session.refresh(report)
        
        # Generate report content asynchronously
        await self._generate_report_content(report)
        
        return ReportOut.from_orm(report)

    async def get_report(
        self, 
        organization_id: uuid.UUID, 
        report_id: uuid.UUID
    ) -> Optional[ReportOut]:
        """Get single report by ID"""
        
        result = await self.session.execute(
            select(MarketingReport)
            .where(
                and_(
                    MarketingReport.id == report_id,
                    MarketingReport.organization_id == organization_id
                )
            )
        )
        
        report = result.scalar_one_or_none()
        if not report:
            return None
            
        return ReportOut.from_orm(report)

    async def list_reports(
        self,
        organization_id: uuid.UUID,
        report_type: Optional[ReportType] = None,
        status: Optional[ReportStatus] = None,
        created_after: Optional[date] = None,
        search: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> Tuple[List[ReportOut], int]:
        """List reports with optional filters"""
        
        query = select(MarketingReport).where(
            MarketingReport.organization_id == organization_id
        )
        
        # Apply filters
        conditions = []
        
        if report_type:
            conditions.append(MarketingReport.report_type == report_type)
            
        if status:
            conditions.append(MarketingReport.status == status)
            
        if created_after:
            conditions.append(MarketingReport.created_at >= datetime.combine(created_after, datetime.min.time()))
            
        if search:
            search_term = f"%{search}%"
            conditions.append(
                or_(
                    MarketingReport.name.ilike(search_term),
                    MarketingReport.description.ilike(search_term)
                )
            )
        
        if conditions:
            query = query.where(and_(*conditions))
            
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination and ordering
        query = query.order_by(desc(MarketingReport.created_at))
        
        if pagination:
            query = query.offset((pagination.page - 1) * pagination.limit).limit(pagination.limit)
            
        # Execute query
        result = await self.session.execute(query)
        reports = result.scalars().all()
        
        return [ReportOut.from_orm(report) for report in reports], total

    async def update_report(
        self,
        organization_id: uuid.UUID,
        report_id: uuid.UUID,
        update_data: ReportUpdate
    ) -> Optional[ReportOut]:
        """Update existing report"""
        
        result = await self.session.execute(
            select(MarketingReport)
            .where(
                and_(
                    MarketingReport.id == report_id,
                    MarketingReport.organization_id == organization_id
                )
            )
        )
        
        report = result.scalar_one_or_none()
        if not report:
            return None
        
        # Update fields
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if hasattr(report, field):
                setattr(report, field, value)
        
        report.updated_at = datetime.utcnow()
        
        await self.session.flush()
        await self.session.refresh(report)
        
        return ReportOut.from_orm(report)

    async def delete_report(
        self,
        organization_id: uuid.UUID,
        report_id: uuid.UUID
    ) -> bool:
        """Delete report"""
        
        result = await self.session.execute(
            select(MarketingReport)
            .where(
                and_(
                    MarketingReport.id == report_id,
                    MarketingReport.organization_id == organization_id
                )
            )
        )
        
        report = result.scalar_one_or_none()
        if not report:
            return False
            
        await self.session.delete(report)
        return True

    async def generate_instant_report(
        self,
        organization_id: uuid.UUID,
        report_type: ReportType,
        start_date: date,
        end_date: date,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate instant report without saving"""
        
        if end_date <= start_date:
            raise ValueError("End date must be after start date")
        
        # Generate report based on type
        if report_type == ReportType.CAMPAIGN_PERFORMANCE:
            return await self._generate_campaign_performance_report(
                organization_id, start_date, end_date, filters
            )
        elif report_type == ReportType.CHANNEL_ANALYSIS:
            return await self._generate_channel_analysis_report(
                organization_id, start_date, end_date, filters
            )
        elif report_type == ReportType.AUDIENCE_INSIGHTS:
            return await self._generate_audience_insights_report(
                organization_id, filters
            )
        elif report_type == ReportType.ROI_ANALYSIS:
            return await self._generate_roi_analysis_report(
                organization_id, start_date, end_date, filters
            )
        elif report_type == ReportType.ENGAGEMENT_SUMMARY:
            return await self._generate_engagement_summary_report(
                organization_id, start_date, end_date, filters
            )
        elif report_type == ReportType.CONVERSION_FUNNEL:
            return await self._generate_conversion_funnel_report(
                organization_id, start_date, end_date, filters
            )
        else:
            return await self._generate_comprehensive_report(
                organization_id, start_date, end_date, filters
            )

    async def export_report(
        self,
        organization_id: uuid.UUID,
        report_id: uuid.UUID,
        format: str = "pdf"
    ) -> Dict[str, Any]:
        """Export report in specified format"""
        
        report = await self.get_report(organization_id, report_id)
        if not report:
            raise ValueError("Report not found")
        
        # Generate export metadata
        export_id = str(uuid.uuid4())
        filename = f"{report.name.replace(' ', '_')}_{export_id}.{format}"
        
        # Simulate export process
        return {
            "export_id": export_id,
            "report_id": str(report_id),
            "filename": filename,
            "format": format,
            "status": "processing",
            "download_url": f"/api/v1/marketing-hub/reports/{report_id}/download/{export_id}",
            "estimated_completion": (datetime.utcnow() + timedelta(minutes=3)).isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat()
        }

    async def get_report_templates(self) -> Dict[str, Any]:
        """Get available report templates"""
        
        templates = {
            "campaign_performance": {
                "name": "Campaign Performance Report",
                "description": "Comprehensive analysis of campaign metrics and ROI",
                "sections": [
                    "Executive Summary",
                    "Campaign Overview", 
                    "Performance Metrics",
                    "Channel Breakdown",
                    "Audience Analysis",
                    "ROI Analysis",
                    "Recommendations"
                ],
                "default_filters": {},
                "recommended_period": "30d"
            },
            "channel_analysis": {
                "name": "Channel Analysis Report", 
                "description": "Deep dive into channel performance and optimization",
                "sections": [
                    "Channel Overview",
                    "Performance Comparison",
                    "Cost Analysis",
                    "Engagement Metrics",
                    "Optimization Opportunities"
                ],
                "default_filters": {"channel_types": ["email", "whatsapp", "sms"]},
                "recommended_period": "90d"
            },
            "audience_insights": {
                "name": "Audience Insights Report",
                "description": "Comprehensive audience behavior and segmentation analysis",
                "sections": [
                    "Audience Overview",
                    "Demographic Analysis",
                    "Behavioral Patterns",
                    "Segment Performance",
                    "Growth Trends",
                    "Engagement Analysis"
                ],
                "default_filters": {},
                "recommended_period": "60d"
            },
            "roi_analysis": {
                "name": "ROI Analysis Report",
                "description": "Financial performance and return on marketing investment",
                "sections": [
                    "Financial Summary",
                    "ROI by Channel",
                    "Cost Breakdown",
                    "Revenue Attribution",
                    "Profitability Analysis",
                    "Investment Recommendations"
                ],
                "default_filters": {},
                "recommended_period": "90d"
            },
            "engagement_summary": {
                "name": "Engagement Summary Report",
                "description": "Customer engagement metrics across all touchpoints",
                "sections": [
                    "Engagement Overview",
                    "Channel Engagement",
                    "Content Performance",
                    "User Journey Analysis",
                    "Engagement Trends"
                ],
                "default_filters": {},
                "recommended_period": "30d"
            }
        }
        
        return {
            "templates": templates,
            "custom_options": {
                "sections": [
                    "Executive Summary",
                    "Campaign Analysis", 
                    "Channel Performance",
                    "Audience Insights",
                    "ROI Metrics",
                    "Engagement Data",
                    "Conversion Funnel",
                    "Recommendations",
                    "Appendix"
                ],
                "chart_types": ["line", "bar", "pie", "funnel", "heatmap"],
                "export_formats": ["pdf", "xlsx", "pptx", "csv"]
            }
        }

    async def schedule_report(
        self,
        organization_id: uuid.UUID,
        report_id: uuid.UUID,
        schedule_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Schedule automatic report generation"""
        
        report = await self.get_report(organization_id, report_id)
        if not report:
            raise ValueError("Report not found")
        
        # Validate schedule configuration
        frequency = schedule_config.get("frequency", "monthly")
        if frequency not in ["daily", "weekly", "monthly", "quarterly"]:
            raise ValueError("Invalid frequency")
        
        # Update report schedule
        report_model = await self.session.execute(
            select(MarketingReport).where(MarketingReport.id == uuid.UUID(str(report.id)))
        )
        report_obj = report_model.scalar_one()
        report_obj.schedule = schedule_config
        report_obj.updated_at = datetime.utcnow()
        
        await self.session.flush()
        
        # Calculate next run time
        next_run = self._calculate_next_run_time(frequency)
        
        return {
            "report_id": str(report.id),
            "schedule_status": "active",
            "frequency": frequency,
            "next_run": next_run.isoformat(),
            "recipients": schedule_config.get("recipients", []),
            "delivery_format": schedule_config.get("format", "pdf")
        }

    async def _generate_report_content(self, report: MarketingReport):
        """Generate report content based on type"""
        
        try:
            # Simulate report generation
            report.status = ReportStatus.PROCESSING
            await self.session.flush()
            
            # Generate content based on report type
            content = await self.generate_instant_report(
                report.organization_id,
                report.report_type,
                report.start_date,
                report.end_date,
                report.filters
            )
            
            # Update report with generated content
            report.content = content
            report.file_url = f"/api/v1/marketing-hub/reports/{report.id}/download"
            report.status = ReportStatus.COMPLETED
            report.generated_at = datetime.utcnow()
            
        except Exception as e:
            report.status = ReportStatus.FAILED
            report.content = {"error": str(e)}
        
        await self.session.flush()

    def _generate_report_config(self, report_data: ReportCreate) -> Dict[str, Any]:
        """Generate report configuration"""
        
        config = {
            "report_type": report_data.report_type.value,
            "period": {
                "start_date": report_data.start_date.isoformat(),
                "end_date": report_data.end_date.isoformat(),
                "duration_days": (report_data.end_date - report_data.start_date).days
            },
            "filters": report_data.filters or {},
            "sections": self._get_default_sections(report_data.report_type),
            "charts": self._get_default_charts(report_data.report_type),
            "format_options": {
                "include_charts": True,
                "include_raw_data": False,
                "include_recommendations": True
            }
        }
        
        return config

    def _get_default_sections(self, report_type: ReportType) -> List[str]:
        """Get default sections for report type"""
        
        section_mapping = {
            ReportType.CAMPAIGN_PERFORMANCE: [
                "executive_summary", "campaign_overview", "performance_metrics", 
                "roi_analysis", "recommendations"
            ],
            ReportType.CHANNEL_ANALYSIS: [
                "channel_overview", "performance_comparison", "cost_analysis", 
                "optimization_opportunities"
            ],
            ReportType.AUDIENCE_INSIGHTS: [
                "audience_overview", "demographic_analysis", "behavioral_patterns", 
                "segment_performance"
            ],
            ReportType.ROI_ANALYSIS: [
                "financial_summary", "roi_breakdown", "cost_analysis", 
                "profitability_analysis"
            ],
            ReportType.ENGAGEMENT_SUMMARY: [
                "engagement_overview", "channel_engagement", "content_performance", 
                "engagement_trends"
            ]
        }
        
        return section_mapping.get(report_type, ["overview", "analysis", "recommendations"])

    def _get_default_charts(self, report_type: ReportType) -> List[str]:
        """Get default charts for report type"""
        
        chart_mapping = {
            ReportType.CAMPAIGN_PERFORMANCE: ["performance_trends", "roi_comparison", "channel_breakdown"],
            ReportType.CHANNEL_ANALYSIS: ["channel_performance", "cost_comparison", "engagement_rates"],
            ReportType.AUDIENCE_INSIGHTS: ["demographic_distribution", "behavior_patterns", "segment_growth"],
            ReportType.ROI_ANALYSIS: ["roi_trends", "cost_breakdown", "revenue_attribution"],
            ReportType.ENGAGEMENT_SUMMARY: ["engagement_trends", "channel_engagement", "content_performance"]
        }
        
        return chart_mapping.get(report_type, ["overview_chart", "trends_chart"])

    async def _generate_campaign_performance_report(
        self, organization_id: uuid.UUID, start_date: date, end_date: date, filters: Optional[Dict]
    ) -> Dict[str, Any]:
        """Generate campaign performance report"""
        
        analytics = await self.analytics_service.get_campaign_analytics(
            organization_id, start_date=start_date, end_date=end_date
        )
        
        return {
            "report_type": "campaign_performance",
            "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "summary": analytics["overview"],
            "performance_by_status": analytics["performance_by_status"],
            "top_campaigns": analytics["top_campaigns"],
            "trends": analytics["trends"],
            "generated_at": datetime.utcnow().isoformat()
        }

    async def _generate_channel_analysis_report(
        self, organization_id: uuid.UUID, start_date: date, end_date: date, filters: Optional[Dict]
    ) -> Dict[str, Any]:
        """Generate channel analysis report"""
        
        analytics = await self.analytics_service.get_channel_analytics(
            organization_id, start_date=start_date, end_date=end_date
        )
        
        return {
            "report_type": "channel_analysis",
            "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "overview": analytics["overview"],
            "channel_performance": analytics["channel_performance"],
            "insights": analytics["insights"],
            "recommendations": analytics["recommendations"],
            "generated_at": datetime.utcnow().isoformat()
        }

    async def _generate_audience_insights_report(
        self, organization_id: uuid.UUID, filters: Optional[Dict]
    ) -> Dict[str, Any]:
        """Generate audience insights report"""
        
        analytics = await self.analytics_service.get_audience_analytics(organization_id)
        
        return {
            "report_type": "audience_insights",
            "overview": analytics["overview"],
            "demographics": analytics["demographics"],
            "behavior": analytics["behavior"],
            "segment_performance": analytics["segment_performance"],
            "growth_trends": analytics["growth_trends"],
            "recommendations": analytics["recommendations"],
            "generated_at": datetime.utcnow().isoformat()
        }

    async def _generate_roi_analysis_report(
        self, organization_id: uuid.UUID, start_date: date, end_date: date, filters: Optional[Dict]
    ) -> Dict[str, Any]:
        """Generate ROI analysis report"""
        
        analytics = await self.analytics_service.get_roi_analytics(
            organization_id, start_date=start_date, end_date=end_date
        )
        
        return {
            "report_type": "roi_analysis",
            "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "overview": analytics["overview"],
            "roi_by_channel": analytics["roi_by_channel"],
            "roi_trends": analytics["roi_trends"],
            "cost_breakdown": analytics["cost_breakdown"],
            "profitability_insights": analytics["profitability_insights"],
            "generated_at": datetime.utcnow().isoformat()
        }

    async def _generate_engagement_summary_report(
        self, organization_id: uuid.UUID, start_date: date, end_date: date, filters: Optional[Dict]
    ) -> Dict[str, Any]:
        """Generate engagement summary report"""
        
        broadcast_analytics = await self.analytics_service.get_broadcast_analytics(
            organization_id, start_date=start_date, end_date=end_date
        )
        
        return {
            "report_type": "engagement_summary",
            "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "overview": broadcast_analytics["overview"],
            "performance_by_channel": broadcast_analytics["performance_by_channel"],
            "top_broadcasts": broadcast_analytics["top_broadcasts"],
            "delivery_trends": broadcast_analytics["delivery_trends"],
            "generated_at": datetime.utcnow().isoformat()
        }

    async def _generate_conversion_funnel_report(
        self, organization_id: uuid.UUID, start_date: date, end_date: date, filters: Optional[Dict]
    ) -> Dict[str, Any]:
        """Generate conversion funnel report"""
        
        # Simulate conversion funnel data
        import random
        
        funnel_stages = [
            {"stage": "awareness", "visitors": 10000, "conversion_rate": 100.0},
            {"stage": "interest", "visitors": 3500, "conversion_rate": 35.0},
            {"stage": "consideration", "visitors": 1200, "conversion_rate": 34.3},
            {"stage": "purchase", "visitors": 240, "conversion_rate": 20.0},
            {"stage": "retention", "visitors": 180, "conversion_rate": 75.0}
        ]
        
        return {
            "report_type": "conversion_funnel",
            "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "funnel_stages": funnel_stages,
            "overall_conversion_rate": 2.4,
            "drop_off_analysis": {
                "highest_drop_off": "interest_to_consideration",
                "optimization_opportunity": "consideration_stage"
            },
            "channel_funnels": {
                "email": {"conversion_rate": 3.2, "total_conversions": 120},
                "whatsapp": {"conversion_rate": 2.8, "total_conversions": 85},
                "sms": {"conversion_rate": 1.9, "total_conversions": 35}
            },
            "generated_at": datetime.utcnow().isoformat()
        }

    async def _generate_comprehensive_report(
        self, organization_id: uuid.UUID, start_date: date, end_date: date, filters: Optional[Dict]
    ) -> Dict[str, Any]:
        """Generate comprehensive marketing report"""
        
        dashboard = await self.analytics_service.get_dashboard_overview(organization_id, "30d")
        campaign_analytics = await self.analytics_service.get_campaign_analytics(organization_id, start_date=start_date, end_date=end_date)
        channel_analytics = await self.analytics_service.get_channel_analytics(organization_id, start_date=start_date, end_date=end_date)
        roi_analytics = await self.analytics_service.get_roi_analytics(organization_id, start_date=start_date, end_date=end_date)
        
        return {
            "report_type": "comprehensive",
            "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "executive_summary": {
                "kpis": dashboard["kpis"],
                "growth_metrics": dashboard["growth_metrics"],
                "key_insights": dashboard["quick_insights"]
            },
            "campaign_analysis": campaign_analytics,
            "channel_analysis": channel_analytics,
            "roi_analysis": roi_analytics,
            "recommendations": [
                "Focus on high-performing channels",
                "Optimize underperforming campaigns",
                "Increase audience segmentation",
                "Implement A/B testing strategy"
            ],
            "generated_at": datetime.utcnow().isoformat()
        }

    def _calculate_next_run_time(self, frequency: str) -> datetime:
        """Calculate next report run time based on frequency"""
        
        now = datetime.utcnow()
        
        if frequency == "daily":
            return now + timedelta(days=1)
        elif frequency == "weekly":
            return now + timedelta(weeks=1)
        elif frequency == "monthly":
            return now + timedelta(days=30)
        elif frequency == "quarterly":
            return now + timedelta(days=90)
        else:
            return now + timedelta(days=30)  # Default to monthly