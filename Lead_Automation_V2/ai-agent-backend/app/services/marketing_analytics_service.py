"""Marketing Analytics Service - Business logic for analytics and metrics"""
from __future__ import annotations

import uuid
import random
from datetime import datetime, timedelta, date
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketing_hub import (
    MarketingCampaign, MarketingChannel, 
    MarketingAudience, ChannelType, CampaignStatus, BroadcastStatus
)


class MarketingAnalyticsService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_campaign_analytics(
        self,
        organization_id: uuid.UUID,
        campaign_id: Optional[uuid.UUID] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Get comprehensive campaign analytics"""
        
        # Base query
        query = select(MarketingCampaign).where(
            MarketingCampaign.organization_id == organization_id
        )
        
        if campaign_id:
            query = query.where(MarketingCampaign.id == campaign_id)
        
        if start_date:
            query = query.where(MarketingCampaign.created_at >= datetime.combine(start_date, datetime.min.time()))
        
        if end_date:
            query = query.where(MarketingCampaign.created_at <= datetime.combine(end_date, datetime.max.time()))
        
        result = await self.session.execute(query)
        campaigns = result.scalars().all()
        
        # Generate analytics data
        total_campaigns = len(campaigns)
        active_campaigns = len([c for c in campaigns if c.status == CampaignStatus.ACTIVE])
        completed_campaigns = len([c for c in campaigns if c.status == CampaignStatus.COMPLETED])
        
        # Simulate metrics
        total_reach = sum(random.randint(1000, 50000) for _ in campaigns)
        total_engagement = sum(random.randint(100, 5000) for _ in campaigns)
        total_conversions = sum(random.randint(10, 500) for _ in campaigns)
        total_revenue = sum(random.uniform(1000, 25000) for _ in campaigns)
        
        # Performance by status
        performance_by_status = {}
        for status in CampaignStatus:
            status_campaigns = [c for c in campaigns if c.status == status]
            performance_by_status[status.value] = {
                "count": len(status_campaigns),
                "avg_reach": sum(random.randint(1000, 50000) for _ in status_campaigns) // max(len(status_campaigns), 1),
                "avg_engagement_rate": round(random.uniform(2.5, 8.5), 2)
            }
        
        # Top performing campaigns
        top_campaigns = []
        for campaign in campaigns[:5]:  # Top 5
            top_campaigns.append({
                "id": str(campaign.id),
                "name": campaign.name,
                "status": campaign.status.value,
                "reach": random.randint(5000, 50000),
                "engagement_rate": round(random.uniform(3.0, 12.0), 2),
                "conversions": random.randint(50, 800),
                "roas": round(random.uniform(1.5, 8.0), 2)
            })
        
        return {
            "overview": {
                "total_campaigns": total_campaigns,
                "active_campaigns": active_campaigns,
                "completed_campaigns": completed_campaigns,
                "total_reach": total_reach,
                "total_engagement": total_engagement,
                "total_conversions": total_conversions,
                "total_revenue": round(total_revenue, 2),
                "avg_engagement_rate": round((total_engagement / max(total_reach, 1)) * 100, 2),
                "conversion_rate": round((total_conversions / max(total_reach, 1)) * 100, 3),
                "overall_roas": round(total_revenue / max(sum(random.uniform(500, 15000) for _ in campaigns), 1), 2)
            },
            "performance_by_status": performance_by_status,
            "top_campaigns": top_campaigns,
            "trends": self._generate_trends_data(30),
            "period": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None
            }
        }

    async def get_channel_analytics(
        self,
        organization_id: uuid.UUID,
        channel_type: Optional[ChannelType] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Get comprehensive channel analytics"""
        
        query = select(MarketingChannel).where(
            MarketingChannel.organization_id == organization_id
        )
        
        if channel_type:
            query = query.where(MarketingChannel.channel_type == channel_type)
        
        result = await self.session.execute(query)
        channels = result.scalars().all()
        
        # Generate channel performance data
        channel_performance = {}
        total_messages = 0
        total_reach = 0
        total_engagement = 0
        
        for channel in channels:
            channel_type_str = channel.channel_type.value
            
            # Simulate metrics based on channel type
            if channel_type_str == "whatsapp":
                messages = random.randint(500, 5000)
                reach = random.randint(400, 4500)
                engagement = random.randint(200, 2000)
                delivery_rate = round(random.uniform(95, 99), 2)
            elif channel_type_str == "email":
                messages = random.randint(1000, 10000)
                reach = random.randint(800, 8000)
                engagement = random.randint(100, 1500)
                delivery_rate = round(random.uniform(92, 97), 2)
            elif channel_type_str == "sms":
                messages = random.randint(200, 2000)
                reach = random.randint(180, 1800)
                engagement = random.randint(50, 400)
                delivery_rate = round(random.uniform(96, 99), 2)
            else:
                messages = random.randint(100, 1000)
                reach = random.randint(80, 900)
                engagement = random.randint(20, 200)
                delivery_rate = round(random.uniform(85, 95), 2)
            
            channel_performance[channel_type_str] = {
                "channel_id": str(channel.id),
                "channel_name": channel.name,
                "messages_sent": messages,
                "reach": reach,
                "engagement": engagement,
                "delivery_rate": delivery_rate,
                "engagement_rate": round((engagement / max(reach, 1)) * 100, 2),
                "cost_per_message": round(random.uniform(0.01, 0.5), 3),
                "status": channel.status.value
            }
            
            total_messages += messages
            total_reach += reach
            total_engagement += engagement
        
        # Cross-channel insights
        best_performing_channel = max(
            channel_performance.values(),
            key=lambda x: x["engagement_rate"],
            default={}
        )
        
        most_cost_effective = min(
            channel_performance.values(),
            key=lambda x: x["cost_per_message"],
            default={}
        )
        
        return {
            "overview": {
                "total_channels": len(channels),
                "active_channels": len([c for c in channels if c.status.value == "active"]),
                "total_messages_sent": total_messages,
                "total_reach": total_reach,
                "total_engagement": total_engagement,
                "avg_engagement_rate": round((total_engagement / max(total_reach, 1)) * 100, 2)
            },
            "channel_performance": channel_performance,
            "insights": {
                "best_performing_channel": best_performing_channel.get("channel_name", "N/A"),
                "best_engagement_rate": best_performing_channel.get("engagement_rate", 0),
                "most_cost_effective": most_cost_effective.get("channel_name", "N/A"),
                "lowest_cost_per_message": most_cost_effective.get("cost_per_message", 0)
            },
            "recommendations": self._generate_channel_recommendations(channel_performance)
        }

    async def get_audience_analytics(
        self,
        organization_id: uuid.UUID,
        segment_id: Optional[uuid.UUID] = None
    ) -> Dict[str, Any]:
        """Get audience analytics and insights"""
        
        query = select(MarketingAudience).where(
            MarketingAudience.organization_id == organization_id
        )
        
        if segment_id:
            query = query.where(MarketingAudience.id == segment_id)
        
        result = await self.session.execute(query)
        audiences = result.scalars().all()
        
        # Generate audience insights
        total_contacts = sum(random.randint(100, 10000) for _ in audiences)
        
        # Demographics simulation
        demographics = {
            "age_groups": {
                "18-24": round(random.uniform(15, 25), 1),
                "25-34": round(random.uniform(25, 35), 1),
                "35-44": round(random.uniform(20, 30), 1),
                "45-54": round(random.uniform(15, 25), 1),
                "55+": round(random.uniform(5, 15), 1)
            },
            "gender": {
                "male": round(random.uniform(40, 60), 1),
                "female": round(random.uniform(40, 60), 1),
                "other": round(random.uniform(0, 2), 1)
            },
            "locations": {
                "north_america": round(random.uniform(30, 50), 1),
                "europe": round(random.uniform(20, 35), 1),
                "asia": round(random.uniform(15, 30), 1),
                "other": round(random.uniform(5, 15), 1)
            }
        }
        
        # Behavioral insights
        behavior = {
            "engagement_levels": {
                "highly_engaged": round(random.uniform(15, 25), 1),
                "moderately_engaged": round(random.uniform(35, 50), 1),
                "low_engaged": round(random.uniform(25, 40), 1),
                "inactive": round(random.uniform(5, 15), 1)
            },
            "preferred_channels": {
                "email": round(random.uniform(40, 60), 1),
                "whatsapp": round(random.uniform(20, 35), 1),
                "sms": round(random.uniform(10, 25), 1),
                "social": round(random.uniform(15, 30), 1)
            },
            "purchase_behavior": {
                "frequent_buyers": round(random.uniform(10, 20), 1),
                "occasional_buyers": round(random.uniform(30, 45), 1),
                "browsers": round(random.uniform(25, 40), 1),
                "new_prospects": round(random.uniform(15, 25), 1)
            }
        }
        
        # Segment performance
        segment_performance = []
        for audience in audiences:
            segment_performance.append({
                "id": str(audience.id),
                "name": audience.name,
                "size": random.randint(100, 5000),
                "growth_rate": round(random.uniform(-2, 15), 2),
                "engagement_score": round(random.uniform(6.5, 9.2), 1),
                "conversion_rate": round(random.uniform(2.1, 8.5), 2),
                "lifetime_value": round(random.uniform(150, 800), 2)
            })
        
        return {
            "overview": {
                "total_segments": len(audiences),
                "total_contacts": total_contacts,
                "avg_segment_size": total_contacts // max(len(audiences), 1),
                "total_active_contacts": int(total_contacts * random.uniform(0.7, 0.9))
            },
            "demographics": demographics,
            "behavior": behavior,
            "segment_performance": segment_performance,
            "growth_trends": self._generate_audience_growth_trends(),
            "recommendations": self._generate_audience_recommendations(segment_performance)
        }

    async def get_broadcast_analytics(
        self,
        organization_id: uuid.UUID,
        broadcast_id: Optional[uuid.UUID] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Get broadcast performance analytics"""
        
        query = select(MarketingCampaign).where(
            MarketingCampaign.organization_id == organization_id,
            MarketingCampaign.kind == "broadcast"
        )
        
        if broadcast_id:
            query = query.where(MarketingCampaign.id == broadcast_id)
        
        if start_date:
            query = query.where(MarketingCampaign.created_at >= datetime.combine(start_date, datetime.min.time()))
        
        if end_date:
            query = query.where(MarketingCampaign.created_at <= datetime.combine(end_date, datetime.max.time()))
        
        result = await self.session.execute(query)
        broadcasts = result.scalars().all()
        
        # Calculate metrics
        total_broadcasts = len(broadcasts)
        sent_broadcasts = len([b for b in broadcasts if b.status == BroadcastStatus.SENT])
        
        total_sent = sum(random.randint(100, 5000) for _ in broadcasts)
        total_delivered = int(total_sent * random.uniform(0.92, 0.98))
        total_opened = int(total_delivered * random.uniform(0.20, 0.35))
        total_clicked = int(total_opened * random.uniform(0.15, 0.30))
        total_conversions = int(total_clicked * random.uniform(0.08, 0.20))
        
        # Performance by channel
        performance_by_channel = {}
        for channel_type in ChannelType:
            channel_broadcasts = [b for b in broadcasts if b.channel == channel_type]
            if channel_broadcasts:
                sent = sum(random.randint(100, 2000) for _ in channel_broadcasts)
                delivered = int(sent * random.uniform(0.90, 0.98))
                
                if channel_type in [ChannelType.EMAIL]:
                    opened = int(delivered * random.uniform(0.18, 0.35))
                    clicked = int(opened * random.uniform(0.12, 0.28))
                elif channel_type in [ChannelType.WHATSAPP, ChannelType.SMS]:
                    opened = int(delivered * random.uniform(0.70, 0.95))
                    clicked = int(opened * random.uniform(0.08, 0.18))
                else:
                    opened = int(delivered * random.uniform(0.30, 0.60))
                    clicked = int(opened * random.uniform(0.05, 0.15))
                
                performance_by_channel[channel_type.value] = {
                    "broadcasts": len(channel_broadcasts),
                    "sent": sent,
                    "delivered": delivered,
                    "opened": opened,
                    "clicked": clicked,
                    "delivery_rate": round((delivered / max(sent, 1)) * 100, 2),
                    "open_rate": round((opened / max(delivered, 1)) * 100, 2),
                    "click_rate": round((clicked / max(opened, 1)) * 100, 2)
                }
        
        # Top performing broadcasts
        top_broadcasts = []
        for broadcast in broadcasts[:5]:
            sent = random.randint(500, 5000)
            opened = int(sent * random.uniform(0.15, 0.40))
            clicked = int(opened * random.uniform(0.10, 0.25))
            
            top_broadcasts.append({
                "id": str(broadcast.id),
                "name": broadcast.name,
                "channel": broadcast.channel.value,
                "sent_at": broadcast.sent_at.isoformat() if broadcast.sent_at else None,
                "sent": sent,
                "open_rate": round((opened / max(sent, 1)) * 100, 2),
                "click_rate": round((clicked / max(opened, 1)) * 100, 2),
                "conversions": random.randint(5, 100)
            })
        
        return {
            "overview": {
                "total_broadcasts": total_broadcasts,
                "sent_broadcasts": sent_broadcasts,
                "scheduled_broadcasts": len([b for b in broadcasts if b.status == BroadcastStatus.SCHEDULED]),
                "total_sent": total_sent,
                "total_delivered": total_delivered,
                "total_opened": total_opened,
                "total_clicked": total_clicked,
                "total_conversions": total_conversions,
                "avg_delivery_rate": round((total_delivered / max(total_sent, 1)) * 100, 2),
                "avg_open_rate": round((total_opened / max(total_delivered, 1)) * 100, 2),
                "avg_click_rate": round((total_clicked / max(total_opened, 1)) * 100, 2),
                "conversion_rate": round((total_conversions / max(total_sent, 1)) * 100, 3)
            },
            "performance_by_channel": performance_by_channel,
            "top_broadcasts": top_broadcasts,
            "delivery_trends": self._generate_delivery_trends()
        }

    async def get_roi_analytics(
        self,
        organization_id: uuid.UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Get ROI and revenue analytics"""
        
        # Simulate comprehensive ROI data
        total_spend = random.uniform(10000, 100000)
        total_revenue = random.uniform(25000, 300000)
        overall_roi = ((total_revenue - total_spend) / total_spend) * 100
        
        # ROI by channel
        roi_by_channel = {}
        for channel in ChannelType:
            spend = random.uniform(1000, 15000)
            revenue = random.uniform(2000, 35000)
            roi_by_channel[channel.value] = {
                "spend": round(spend, 2),
                "revenue": round(revenue, 2),
                "roi": round(((revenue - spend) / spend) * 100, 2),
                "roas": round(revenue / spend, 2)
            }
        
        # ROI trends over time
        roi_trends = []
        base_date = (end_date or date.today()) - timedelta(days=30)
        for i in range(30):
            current_date = base_date + timedelta(days=i)
            roi_trends.append({
                "date": current_date.isoformat(),
                "spend": round(random.uniform(200, 2000), 2),
                "revenue": round(random.uniform(500, 5000), 2),
                "roi": round(random.uniform(-10, 150), 2)
            })
        
        # Cost analysis
        cost_breakdown = {
            "ad_spend": round(total_spend * 0.60, 2),
            "content_creation": round(total_spend * 0.15, 2),
            "tools_and_software": round(total_spend * 0.10, 2),
            "team_costs": round(total_spend * 0.10, 2),
            "other": round(total_spend * 0.05, 2)
        }
        
        return {
            "overview": {
                "total_spend": round(total_spend, 2),
                "total_revenue": round(total_revenue, 2),
                "net_profit": round(total_revenue - total_spend, 2),
                "overall_roi": round(overall_roi, 2),
                "overall_roas": round(total_revenue / total_spend, 2),
                "break_even_point": round(total_spend, 2)
            },
            "roi_by_channel": roi_by_channel,
            "roi_trends": roi_trends,
            "cost_breakdown": cost_breakdown,
            "profitability_insights": {
                "most_profitable_channel": max(roi_by_channel.keys(), key=lambda k: roi_by_channel[k]["roi"]),
                "least_profitable_channel": min(roi_by_channel.keys(), key=lambda k: roi_by_channel[k]["roi"]),
                "avg_cost_per_acquisition": round(total_spend / max(random.randint(50, 500), 1), 2),
                "customer_lifetime_value": round(random.uniform(200, 1200), 2)
            }
        }

    async def get_dashboard_overview(
        self,
        organization_id: uuid.UUID,
        period: str = "30d"
    ) -> Dict[str, Any]:
        """Get comprehensive marketing dashboard overview"""
        
        # Calculate date range based on period
        end_date = date.today()
        if period == "7d":
            start_date = end_date - timedelta(days=7)
        elif period == "30d":
            start_date = end_date - timedelta(days=30)
        elif period == "90d":
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)
        
        # Get analytics from all services
        campaign_analytics = await self.get_campaign_analytics(organization_id, start_date=start_date, end_date=end_date)
        channel_analytics = await self.get_channel_analytics(organization_id, start_date=start_date, end_date=end_date)
        audience_analytics = await self.get_audience_analytics(organization_id)
        broadcast_analytics = await self.get_broadcast_analytics(organization_id, start_date=start_date, end_date=end_date)
        roi_analytics = await self.get_roi_analytics(organization_id, start_date=start_date, end_date=end_date)
        
        # Key performance indicators
        kpis = {
            "total_reach": campaign_analytics["overview"]["total_reach"],
            "engagement_rate": campaign_analytics["overview"]["avg_engagement_rate"],
            "conversion_rate": campaign_analytics["overview"]["conversion_rate"],
            "roi": roi_analytics["overview"]["overall_roi"],
            "active_campaigns": campaign_analytics["overview"]["active_campaigns"],
            "total_revenue": roi_analytics["overview"]["total_revenue"]
        }
        
        # Growth metrics (simulated comparison with previous period)
        growth_metrics = {
            "reach_growth": round(random.uniform(-5, 25), 2),
            "engagement_growth": round(random.uniform(-3, 18), 2),
            "conversion_growth": round(random.uniform(-8, 30), 2),
            "revenue_growth": round(random.uniform(-10, 40), 2)
        }
        
        # Alerts and insights
        alerts = []
        if kpis["engagement_rate"] < 2.0:
            alerts.append({
                "type": "warning",
                "message": "Engagement rate is below industry average",
                "action": "Review content strategy and audience targeting"
            })
        
        if kpis["conversion_rate"] < 1.0:
            alerts.append({
                "type": "alert",
                "message": "Conversion rate needs improvement",
                "action": "Optimize landing pages and call-to-actions"
            })
        
        if kpis["roi"] < 100:
            alerts.append({
                "type": "critical",
                "message": "ROI is below break-even point",
                "action": "Review budget allocation and channel performance"
            })
        
        return {
            "period": {"start": start_date.isoformat(), "end": end_date.isoformat(), "duration": period},
            "kpis": kpis,
            "growth_metrics": growth_metrics,
            "campaign_summary": {
                "total": campaign_analytics["overview"]["total_campaigns"],
                "active": campaign_analytics["overview"]["active_campaigns"],
                "completed": campaign_analytics["overview"]["completed_campaigns"]
            },
            "channel_summary": {
                "total": channel_analytics["overview"]["total_channels"],
                "active": channel_analytics["overview"]["active_channels"],
                "best_performing": channel_analytics["insights"]["best_performing_channel"]
            },
            "audience_summary": {
                "total_segments": audience_analytics["overview"]["total_segments"],
                "total_contacts": audience_analytics["overview"]["total_contacts"],
                "active_contacts": audience_analytics["overview"]["total_active_contacts"]
            },
            "recent_performance": {
                "broadcasts_sent": broadcast_analytics["overview"]["sent_broadcasts"],
                "avg_open_rate": broadcast_analytics["overview"]["avg_open_rate"],
                "avg_click_rate": broadcast_analytics["overview"]["avg_click_rate"]
            },
            "alerts": alerts,
            "quick_insights": [
                f"Your best performing channel is {channel_analytics['insights']['best_performing_channel']}",
                f"ROI increased by {abs(growth_metrics['revenue_growth'])}% this period" if growth_metrics['revenue_growth'] > 0 else f"ROI decreased by {abs(growth_metrics['revenue_growth'])}% this period",
                f"Engagement is {'up' if growth_metrics['engagement_growth'] > 0 else 'down'} {abs(growth_metrics['engagement_growth'])}% compared to last period"
            ]
        }

    def _generate_trends_data(self, days: int) -> List[Dict[str, Any]]:
        """Generate trend data for charts"""
        
        trends = []
        base_date = date.today() - timedelta(days=days)
        
        for i in range(days):
            current_date = base_date + timedelta(days=i)
            trends.append({
                "date": current_date.isoformat(),
                "reach": random.randint(500, 5000),
                "engagement": random.randint(50, 800),
                "conversions": random.randint(5, 100),
                "spend": round(random.uniform(100, 1000), 2)
            })
        
        return trends

    def _generate_channel_recommendations(self, channel_performance: Dict) -> List[Dict[str, str]]:
        """Generate channel optimization recommendations"""
        
        recommendations = []
        
        for channel, perf in channel_performance.items():
            if perf["engagement_rate"] < 2.0:
                recommendations.append({
                    "channel": channel,
                    "type": "improvement",
                    "message": f"{channel.title()} engagement is low. Consider A/B testing content formats.",
                    "priority": "high"
                })
            
            if perf["cost_per_message"] > 0.2:
                recommendations.append({
                    "channel": channel,
                    "type": "cost_optimization",
                    "message": f"{channel.title()} costs are high. Review targeting and bidding strategies.",
                    "priority": "medium"
                })
        
        return recommendations

    def _generate_audience_growth_trends(self) -> List[Dict[str, Any]]:
        """Generate audience growth trend data"""
        
        trends = []
        base_size = random.randint(1000, 10000)
        
        for i in range(12):  # 12 months
            growth = random.uniform(-0.05, 0.15)  # -5% to +15% growth
            base_size = int(base_size * (1 + growth))
            
            month_date = date.today().replace(day=1) - timedelta(days=30 * (11 - i))
            trends.append({
                "month": month_date.strftime("%Y-%m"),
                "total_contacts": base_size,
                "new_contacts": int(base_size * abs(growth)) if growth > 0 else 0,
                "churned_contacts": int(base_size * abs(growth)) if growth < 0 else random.randint(10, 100),
                "growth_rate": round(growth * 100, 2)
            })
        
        return trends

    def _generate_audience_recommendations(self, segment_performance: List[Dict]) -> List[Dict[str, str]]:
        """Generate audience optimization recommendations"""
        
        recommendations = []
        
        if segment_performance:
            # Find underperforming segments
            avg_engagement = sum(s["engagement_score"] for s in segment_performance) / len(segment_performance)
            
            for segment in segment_performance:
                if segment["engagement_score"] < avg_engagement - 1.0:
                    recommendations.append({
                        "segment": segment["name"],
                        "type": "engagement",
                        "message": f"Segment '{segment['name']}' has low engagement. Consider refreshing content strategy.",
                        "priority": "medium"
                    })
                
                if segment["conversion_rate"] < 2.0:
                    recommendations.append({
                        "segment": segment["name"],
                        "type": "conversion",
                        "message": f"Low conversion rate in '{segment['name']}'. Review targeting criteria.",
                        "priority": "high"
                    })
        
        return recommendations

    def _generate_delivery_trends(self) -> List[Dict[str, Any]]:
        """Generate delivery performance trends"""
        
        trends = []
        base_date = date.today() - timedelta(days=7)
        
        for i in range(7):
            current_date = base_date + timedelta(days=i)
            trends.append({
                "date": current_date.isoformat(),
                "sent": random.randint(1000, 5000),
                "delivered": random.randint(950, 4900),
                "bounced": random.randint(10, 100),
                "delivery_rate": round(random.uniform(95, 99), 2)
            })
        
        return trends