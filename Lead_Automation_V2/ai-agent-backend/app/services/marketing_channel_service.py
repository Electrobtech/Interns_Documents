"""Marketing Channel Service - Business logic for channel management"""
from __future__ import annotations

import uuid
import random
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketing_hub import MarketingChannel, ChannelType, ChannelStatus
from app.schemas.marketing_hub import (
    ChannelCreate, ChannelUpdate, ChannelOut, PaginationParams
)


class MarketingChannelService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_channel(
        self, 
        organization_id: uuid.UUID, 
        user_id: uuid.UUID,
        channel_data: ChannelCreate
    ) -> ChannelOut:
        """Create a new marketing channel"""
        
        # Generate initial metrics and configuration based on channel type
        initial_metrics = self._generate_channel_metrics(channel_data.type)
        processed_settings = self._process_channel_settings(channel_data.type, channel_data.settings)
        
        channel = MarketingChannel(
            organization_id=organization_id,
            name=channel_data.name,
            type=channel_data.type,
            credentials=channel_data.credentials,
            settings=processed_settings,
            daily_limit=channel_data.daily_limit,
            monthly_limit=channel_data.monthly_limit,
            metrics=initial_metrics,
            status=ChannelStatus.PENDING,  # Start as pending for setup
            created_by=user_id
        )
        
        self.session.add(channel)
        await self.session.flush()
        await self.session.refresh(channel)
        
        # Simulate connection test
        await self._simulate_connection_test(channel)
        
        return ChannelOut.from_orm(channel)

    async def get_channel(
        self, 
        organization_id: uuid.UUID, 
        channel_id: uuid.UUID
    ) -> Optional[ChannelOut]:
        """Get a single channel by ID"""
        
        result = await self.session.execute(
            select(MarketingChannel)
            .where(
                and_(
                    MarketingChannel.id == channel_id,
                    MarketingChannel.organization_id == organization_id
                )
            )
        )
        
        channel = result.scalar_one_or_none()
        if not channel:
            return None
            
        # Update real-time metrics
        channel.metrics = self._update_channel_metrics(channel)
        channel.current_usage = self._calculate_current_usage(channel)
        
        return ChannelOut.from_orm(channel)

    async def list_channels(
        self,
        organization_id: uuid.UUID,
        channel_type: Optional[ChannelType] = None,
        status: Optional[ChannelStatus] = None,
        pagination: Optional[PaginationParams] = None
    ) -> Tuple[List[ChannelOut], int]:
        """List channels with optional filters"""
        
        query = select(MarketingChannel).where(
            MarketingChannel.organization_id == organization_id
        )
        
        # Apply filters
        if channel_type:
            query = query.where(MarketingChannel.type == channel_type)
            
        if status:
            query = query.where(MarketingChannel.status == status)
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination
        if pagination:
            query = query.offset((pagination.page - 1) * pagination.limit).limit(pagination.limit)
            
        query = query.order_by(desc(MarketingChannel.updated_at))
        
        # Execute query
        result = await self.session.execute(query)
        channels = result.scalars().all()
        
        # Update metrics for all channels
        channel_outputs = []
        for channel in channels:
            channel.metrics = self._update_channel_metrics(channel)
            channel.current_usage = self._calculate_current_usage(channel)
            channel_outputs.append(ChannelOut.from_orm(channel))
        
        return channel_outputs, total

    async def update_channel(
        self,
        organization_id: uuid.UUID,
        channel_id: uuid.UUID,
        update_data: ChannelUpdate
    ) -> Optional[ChannelOut]:
        """Update an existing channel"""
        
        result = await self.session.execute(
            select(MarketingChannel)
            .where(
                and_(
                    MarketingChannel.id == channel_id,
                    MarketingChannel.organization_id == organization_id
                )
            )
        )
        
        channel = result.scalar_one_or_none()
        if not channel:
            return None
        
        # Update fields
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if hasattr(channel, field):
                setattr(channel, field, value)
        
        channel.updated_at = datetime.utcnow()
        
        # Re-test connection if credentials changed
        if 'credentials' in update_dict:
            await self._simulate_connection_test(channel)
        
        await self.session.flush()
        await self.session.refresh(channel)
        
        return ChannelOut.from_orm(channel)

    async def delete_channel(
        self,
        organization_id: uuid.UUID,
        channel_id: uuid.UUID
    ) -> bool:
        """Delete a channel"""
        
        result = await self.session.execute(
            select(MarketingChannel)
            .where(
                and_(
                    MarketingChannel.id == channel_id,
                    MarketingChannel.organization_id == organization_id
                )
            )
        )
        
        channel = result.scalar_one_or_none()
        if not channel:
            return False
            
        await self.session.delete(channel)
        return True

    async def test_channel_connection(
        self,
        organization_id: uuid.UUID,
        channel_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Test channel connection and return status"""
        
        channel = await self.get_channel(organization_id, channel_id)
        if not channel:
            return {"status": "error", "message": "Channel not found"}
        
        # Simulate connection test
        return await self._simulate_connection_test_result(channel.type)

    async def get_channel_usage_stats(
        self,
        organization_id: uuid.UUID,
        channel_id: uuid.UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get detailed usage statistics for a channel"""
        
        channel = await self.get_channel(organization_id, channel_id)
        if not channel:
            return {}
        
        # Generate usage statistics
        return self._generate_usage_statistics(channel, days)

    def _generate_channel_metrics(self, channel_type: ChannelType) -> Dict[str, Any]:
        """Generate initial metrics based on channel type"""
        
        base_metrics = {
            "total_messages_sent": 0,
            "delivery_rate": 0.0,
            "open_rate": 0.0,
            "click_rate": 0.0,
            "response_rate": 0.0,
            "error_rate": 0.0,
            "avg_response_time": 0.0
        }
        
        # Channel-specific metrics
        if channel_type == ChannelType.WHATSAPP:
            base_metrics.update({
                "read_rate": 0.0,
                "template_approval_rate": 95.0,
                "business_verification": "pending"
            })
        elif channel_type == ChannelType.EMAIL:
            base_metrics.update({
                "spam_score": 0.0,
                "bounce_rate": 0.0,
                "unsubscribe_rate": 0.0,
                "reputation_score": 85.0
            })
        elif channel_type == ChannelType.SMS:
            base_metrics.update({
                "carrier_delivery_rate": 98.0,
                "opt_out_rate": 0.0
            })
        
        return base_metrics

    def _process_channel_settings(self, channel_type: ChannelType, settings: Dict[str, Any]) -> Dict[str, Any]:
        """Process and validate channel settings based on type"""
        
        processed_settings = settings.copy()
        
        # Add default settings based on channel type
        if channel_type == ChannelType.WHATSAPP:
            processed_settings.setdefault("business_account_id", "")
            processed_settings.setdefault("phone_number_id", "")
            processed_settings.setdefault("webhook_verify_token", "")
            processed_settings.setdefault("template_language", "en")
            
        elif channel_type == ChannelType.EMAIL:
            processed_settings.setdefault("smtp_host", "")
            processed_settings.setdefault("smtp_port", 587)
            processed_settings.setdefault("use_tls", True)
            processed_settings.setdefault("from_name", "")
            processed_settings.setdefault("reply_to", "")
            
        elif channel_type == ChannelType.SMS:
            processed_settings.setdefault("provider", "twilio")
            processed_settings.setdefault("sender_id", "")
            processed_settings.setdefault("unicode_support", True)
            
        return processed_settings

    async def _simulate_connection_test(self, channel: MarketingChannel) -> None:
        """Simulate connection test and update channel status"""
        
        # Simulate connection success/failure
        success_rate = 0.85  # 85% success rate for simulation
        
        if random.random() < success_rate:
            channel.status = ChannelStatus.ACTIVE
            channel.last_sync = datetime.utcnow()
        else:
            channel.status = ChannelStatus.ERROR

    async def _simulate_connection_test_result(self, channel_type: ChannelType) -> Dict[str, Any]:
        """Simulate connection test and return detailed results"""
        
        # Simulate connection test
        is_success = random.random() < 0.9  # 90% success rate
        
        if is_success:
            return {
                "status": "success",
                "message": f"{channel_type.value.title()} connection successful",
                "response_time_ms": random.randint(100, 500),
                "last_tested": datetime.utcnow().isoformat(),
                "details": {
                    "api_version": "v1.0",
                    "rate_limits": {
                        "requests_per_minute": 1000,
                        "requests_per_day": 100000
                    }
                }
            }
        else:
            return {
                "status": "error",
                "message": f"Failed to connect to {channel_type.value.title()} API",
                "error_code": "AUTH_FAILED",
                "last_tested": datetime.utcnow().isoformat(),
                "suggestions": [
                    "Check API credentials",
                    "Verify account permissions",
                    "Ensure API endpoint is accessible"
                ]
            }

    def _update_channel_metrics(self, channel: MarketingChannel) -> Dict[str, Any]:
        """Update channel metrics with realistic simulation"""
        
        current_metrics = channel.metrics or {}
        
        # Simulate daily activity if channel is active
        if channel.status == ChannelStatus.ACTIVE:
            # Simulate message volume based on channel type
            daily_messages = self._get_typical_daily_volume(channel.type)
            
            current_metrics["total_messages_sent"] = current_metrics.get("total_messages_sent", 0) + daily_messages
            current_metrics["delivery_rate"] = round(random.uniform(95, 99.5), 2)
            current_metrics["error_rate"] = round(random.uniform(0.1, 2.0), 2)
            
            # Channel-specific updates
            if channel.type == ChannelType.WHATSAPP:
                current_metrics["read_rate"] = round(random.uniform(85, 95), 2)
                current_metrics["response_rate"] = round(random.uniform(15, 35), 2)
                
            elif channel.type == ChannelType.EMAIL:
                current_metrics["open_rate"] = round(random.uniform(20, 35), 2)
                current_metrics["click_rate"] = round(random.uniform(2, 8), 2)
                current_metrics["bounce_rate"] = round(random.uniform(1, 5), 2)
                
            elif channel.type == ChannelType.SMS:
                current_metrics["carrier_delivery_rate"] = round(random.uniform(96, 99), 2)
                current_metrics["response_rate"] = round(random.uniform(10, 25), 2)
        
        return current_metrics

    def _calculate_current_usage(self, channel: MarketingChannel) -> int:
        """Calculate current usage for rate limiting"""
        
        # Simulate current usage based on time of day and channel activity
        if channel.status == ChannelStatus.ACTIVE:
            base_usage = random.randint(50, 500)
            
            # Adjust for time of day (simulate business hours having higher usage)
            current_hour = datetime.utcnow().hour
            if 9 <= current_hour <= 17:  # Business hours
                base_usage = int(base_usage * 1.5)
                
            return min(base_usage, channel.daily_limit or 10000)
        
        return 0

    def _get_typical_daily_volume(self, channel_type: ChannelType) -> int:
        """Get typical daily message volume for channel type"""
        
        volumes = {
            ChannelType.WHATSAPP: random.randint(100, 1000),
            ChannelType.EMAIL: random.randint(500, 5000),
            ChannelType.SMS: random.randint(200, 2000),
            ChannelType.MESSENGER: random.randint(50, 500),
            ChannelType.INSTAGRAM: random.randint(30, 300),
            ChannelType.LINKEDIN: random.randint(20, 200)
        }
        
        return volumes.get(channel_type, 100)

    def _generate_usage_statistics(self, channel: ChannelOut, days: int) -> Dict[str, Any]:
        """Generate detailed usage statistics for the channel"""
        
        # Generate daily usage data for the specified period
        daily_stats = []
        for i in range(days):
            date = datetime.utcnow() - timedelta(days=i)
            daily_volume = self._get_typical_daily_volume(ChannelType(channel.type))
            
            daily_stats.append({
                "date": date.strftime("%Y-%m-%d"),
                "messages_sent": daily_volume,
                "delivery_rate": round(random.uniform(95, 99), 2),
                "error_rate": round(random.uniform(0.1, 2.0), 2),
                "response_rate": round(random.uniform(10, 30), 2) if channel.type in ["whatsapp", "messenger"] else 0
            })
        
        # Calculate summary statistics
        total_messages = sum(stat["messages_sent"] for stat in daily_stats)
        avg_delivery_rate = sum(stat["delivery_rate"] for stat in daily_stats) / len(daily_stats)
        avg_error_rate = sum(stat["error_rate"] for stat in daily_stats) / len(daily_stats)
        
        return {
            "period_days": days,
            "total_messages_sent": total_messages,
            "average_daily_volume": total_messages // days,
            "average_delivery_rate": round(avg_delivery_rate, 2),
            "average_error_rate": round(avg_error_rate, 2),
            "daily_breakdown": daily_stats[:7],  # Return last 7 days
            "peak_usage_day": max(daily_stats, key=lambda x: x["messages_sent"])["date"],
            "trend": "increasing" if daily_stats[0]["messages_sent"] > daily_stats[-1]["messages_sent"] else "stable"
        }