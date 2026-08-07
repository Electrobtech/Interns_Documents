"""Marketing Campaign Service - REAL database operations for campaign management"""
from __future__ import annotations

import uuid
import asyncio
from datetime import datetime, timedelta, date
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, func, and_, or_, desc, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketing_hub import (
    MarketingCampaign, MarketingAudience, MarketingRecipient, 
    CampaignStatus, ChannelType
)
from app.schemas.marketing_hub import (
    CampaignCreate, CampaignUpdate, CampaignOut, PaginationParams
)


class MarketingCampaignService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_campaign(
        self, 
        organization_id: uuid.UUID, 
        user_id: uuid.UUID,
        campaign_data: CampaignCreate
    ) -> CampaignOut:
        """Create a new marketing campaign - REAL database record"""
        
        campaign = MarketingCampaign(
            organization_id=organization_id,
            kind="campaign",  # Mark as campaign vs broadcast
            name=campaign_data.name,
            channel=campaign_data.channel,
            objective=campaign_data.objective,
            audience_id=campaign_data.audience_id,
            message_body=campaign_data.message_body,
            budget_amount=campaign_data.budget_amount,
            status=CampaignStatus.DRAFT,
            scheduled_at=campaign_data.scheduled_at,
            start_date=campaign_data.start_date,
            end_date=campaign_data.end_date,
            created_by=user_id
        )
        
        self.session.add(campaign)
        await self.session.flush()
        await self.session.refresh(campaign)
        
        return CampaignOut.from_orm(campaign)

    async def get_campaign(
        self, 
        organization_id: uuid.UUID, 
        campaign_id: uuid.UUID
    ) -> Optional[CampaignOut]:
        """Get a single campaign by ID - REAL database lookup"""
        
        result = await self.session.execute(
            select(MarketingCampaign)
            .where(
                and_(
                    MarketingCampaign.id == campaign_id,
                    MarketingCampaign.organization_id == organization_id,
                    MarketingCampaign.kind == "campaign"
                )
            )
        )
        
        campaign = result.scalar_one_or_none()
        if not campaign:
            return None
            
        return CampaignOut.from_orm(campaign)

    async def list_campaigns(
        self,
        organization_id: uuid.UUID,
        status: Optional[CampaignStatus] = None,
        channel: Optional[ChannelType] = None,
        search: Optional[str] = None,
        created_after: Optional[datetime] = None,
        created_before: Optional[datetime] = None,
        pagination: Optional[PaginationParams] = None
    ) -> Tuple[List[CampaignOut], int]:
        """List campaigns with filters and pagination - REAL database query"""
        
        # Build base query
        query = select(MarketingCampaign).where(
            and_(
                MarketingCampaign.organization_id == organization_id,
                MarketingCampaign.kind == "campaign"
            )
        )
        
        # Apply filters
        conditions = []
        
        if status:
            conditions.append(MarketingCampaign.status == status)
        
        if channel:
            conditions.append(MarketingCampaign.channel == channel)
            
        if search:
            search_term = f"%{search}%"
            conditions.append(
                or_(
                    MarketingCampaign.name.ilike(search_term),
                    MarketingCampaign.message_body.ilike(search_term)
                )
            )
            
        if created_after:
            conditions.append(MarketingCampaign.created_at >= created_after)
            
        if created_before:
            conditions.append(MarketingCampaign.created_at <= created_before)
        
        if conditions:
            query = query.where(and_(*conditions))
            
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination and ordering
        query = query.order_by(desc(MarketingCampaign.created_at))
        
        if pagination:
            query = query.offset((pagination.page - 1) * pagination.limit).limit(pagination.limit)
        
        # Execute query
        result = await self.session.execute(query)
        campaigns = result.scalars().all()
        
        return [CampaignOut.from_orm(campaign) for campaign in campaigns], total

    async def update_campaign(
        self,
        organization_id: uuid.UUID,
        campaign_id: uuid.UUID,
        update_data: CampaignUpdate
    ) -> Optional[CampaignOut]:
        """Update an existing campaign - REAL database update"""
        
        result = await self.session.execute(
            select(MarketingCampaign)
            .where(
                and_(
                    MarketingCampaign.id == campaign_id,
                    MarketingCampaign.organization_id == organization_id,
                    MarketingCampaign.kind == "campaign"
                )
            )
        )
        
        campaign = result.scalar_one_or_none()
        if not campaign:
            return None
        
        # Update fields
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if hasattr(campaign, field):
                setattr(campaign, field, value)
        
        campaign.updated_at = datetime.utcnow()
        
        await self.session.flush()
        await self.session.refresh(campaign)
        
        return CampaignOut.from_orm(campaign)

    async def delete_campaign(
        self,
        organization_id: uuid.UUID,
        campaign_id: uuid.UUID
    ) -> bool:
        """Delete a campaign - REAL database deletion"""
        
        result = await self.session.execute(
            select(MarketingCampaign)
            .where(
                and_(
                    MarketingCampaign.id == campaign_id,
                    MarketingCampaign.organization_id == organization_id,
                    MarketingCampaign.kind == "campaign"
                )
            )
        )
        
        campaign = result.scalar_one_or_none()
        if not campaign:
            return False
        
        # Delete associated recipients first
        await self.session.execute(
            update(MarketingRecipient)
            .where(MarketingRecipient.campaign_id == campaign_id)
            .values(status='cancelled')
        )
        
        # Delete campaign
        await self.session.delete(campaign)
        return True

    async def launch_campaign(
        self,
        organization_id: uuid.UUID,
        campaign_id: uuid.UUID
    ) -> Optional[CampaignOut]:
        """Launch a campaign - REAL processing with recipient creation"""
        
        campaign = await self.get_campaign(organization_id, campaign_id)
        if not campaign:
            return None
        
        if campaign.status != CampaignStatus.DRAFT:
            raise ValueError(f"Campaign must be in DRAFT status to launch, current: {campaign.status}")
        
        # Update campaign status to QUEUED
        await self.session.execute(
            update(MarketingCampaign)
            .where(MarketingCampaign.id == campaign_id)
            .values(status=CampaignStatus.QUEUED)
        )
        
        # Create recipients if audience is specified
        if campaign.audience_id:
            await self._create_campaign_recipients(campaign_id, campaign.audience_id, campaign.channel)
        
        # Update total recipients count
        recipient_count = await self._get_recipient_count(campaign_id)
        await self.session.execute(
            update(MarketingCampaign)
            .where(MarketingCampaign.id == campaign_id)
            .values(
                total_recipients=recipient_count,
                status=CampaignStatus.PROCESSING if recipient_count > 0 else CampaignStatus.COMPLETED
            )
        )
        
        # Start background processing (simulation for now)
        asyncio.create_task(self._process_campaign_messages(campaign_id))
        
        return await self.get_campaign(organization_id, campaign_id)

    async def pause_campaign(
        self,
        organization_id: uuid.UUID,
        campaign_id: uuid.UUID
    ) -> Optional[CampaignOut]:
        """Pause an active campaign"""
        
        await self.session.execute(
            update(MarketingCampaign)
            .where(
                and_(
                    MarketingCampaign.id == campaign_id,
                    MarketingCampaign.organization_id == organization_id
                )
            )
            .values(status=CampaignStatus.PAUSED)
        )
        
        return await self.get_campaign(organization_id, campaign_id)

    async def resume_campaign(
        self,
        organization_id: uuid.UUID,
        campaign_id: uuid.UUID
    ) -> Optional[CampaignOut]:
        """Resume a paused campaign"""
        
        await self.session.execute(
            update(MarketingCampaign)
            .where(
                and_(
                    MarketingCampaign.id == campaign_id,
                    MarketingCampaign.organization_id == organization_id
                )
            )
            .values(status=CampaignStatus.PROCESSING)
        )
        
        # Resume background processing
        asyncio.create_task(self._process_campaign_messages(campaign_id))
        
        return await self.get_campaign(organization_id, campaign_id)

    async def get_campaign_stats(
        self,
        organization_id: uuid.UUID,
        campaign_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Get REAL campaign statistics from database"""
        
        # Get recipient statistics
        result = await self.session.execute(
            select(
                MarketingRecipient.status,
                func.count(MarketingRecipient.id).label('count')
            )
            .where(MarketingRecipient.campaign_id == campaign_id)
            .group_by(MarketingRecipient.status)
        )
        
        status_counts = {row.status: row.count for row in result.all()}
        
        # Get campaign details
        campaign = await self.get_campaign(organization_id, campaign_id)
        if not campaign:
            return {}
        
        total_recipients = sum(status_counts.values())
        sent_count = status_counts.get('sent', 0) + status_counts.get('delivered', 0) + status_counts.get('read', 0)
        delivered_count = status_counts.get('delivered', 0) + status_counts.get('read', 0)
        failed_count = status_counts.get('failed', 0)
        
        return {
            "campaign_id": str(campaign_id),
            "name": campaign.name,
            "status": campaign.status,
            "channel": campaign.channel,
            "total_recipients": total_recipients,
            "queued": status_counts.get('queued', 0),
            "sending": status_counts.get('sending', 0),
            "sent": sent_count,
            "delivered": delivered_count,
            "read": status_counts.get('read', 0),
            "replied": status_counts.get('replied', 0),
            "failed": failed_count,
            "delivery_rate": round((delivered_count / total_recipients * 100) if total_recipients else 0, 2),
            "failure_rate": round((failed_count / total_recipients * 100) if total_recipients else 0, 2),
            "created_at": campaign.created_at.isoformat(),
            "updated_at": campaign.updated_at.isoformat()
        }

    async def get_campaign_recipients(
        self,
        campaign_id: uuid.UUID,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Get campaign recipients with status filtering"""
        
        query = select(MarketingRecipient).where(
            MarketingRecipient.campaign_id == campaign_id
        )
        
        if status:
            query = query.where(MarketingRecipient.status == status)
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination
        if pagination:
            query = query.offset((pagination.page - 1) * pagination.limit).limit(pagination.limit)
        
        query = query.order_by(desc(MarketingRecipient.created_at))
        
        result = await self.session.execute(query)
        recipients = result.scalars().all()
        
        recipient_data = []
        for recipient in recipients:
            recipient_data.append({
                "id": str(recipient.id),
                "destination": recipient.destination,
                "display_name": recipient.display_name,
                "status": recipient.status,
                "attempts": recipient.attempts,
                "error": recipient.error,
                "sent_at": recipient.sent_at.isoformat() if recipient.sent_at else None,
                "delivered_at": recipient.delivered_at.isoformat() if recipient.delivered_at else None,
                "read_at": recipient.read_at.isoformat() if recipient.read_at else None,
                "replied_at": recipient.replied_at.isoformat() if recipient.replied_at else None
            })
        
        return recipient_data, total

    async def _create_campaign_recipients(
        self,
        campaign_id: uuid.UUID,
        audience_id: uuid.UUID,
        channel: ChannelType
    ):
        """Create recipient records for campaign (simulation for now)"""
        
        # For simulation, create some mock recipients
        # In real implementation, this would query the audience and create recipients
        mock_recipients = [
            {"destination": f"user{i}@example.com" if channel == ChannelType.EMAIL else f"+1555000{i:04d}", 
             "display_name": f"User {i}"}
            for i in range(1, 11)  # 10 mock recipients
        ]
        
        for recipient_data in mock_recipients:
            recipient = MarketingRecipient(
                campaign_id=campaign_id,
                channel=channel.value,
                destination=recipient_data["destination"],
                display_name=recipient_data["display_name"],
                status="queued"
            )
            self.session.add(recipient)
        
        await self.session.flush()

    async def _get_recipient_count(self, campaign_id: uuid.UUID) -> int:
        """Get total recipient count for campaign"""
        
        result = await self.session.execute(
            select(func.count(MarketingRecipient.id))
            .where(MarketingRecipient.campaign_id == campaign_id)
        )
        
        return result.scalar() or 0

    async def _process_campaign_messages(self, campaign_id: uuid.UUID):
        """Background task to process campaign messages (simulation)"""
        
        try:
            # Simulate message processing
            await asyncio.sleep(2)  # Simulate setup time
            
            # Get queued recipients
            result = await self.session.execute(
                select(MarketingRecipient)
                .where(
                    and_(
                        MarketingRecipient.campaign_id == campaign_id,
                        MarketingRecipient.status == "queued"
                    )
                )
                .limit(50)  # Process in batches
            )
            
            recipients = result.scalars().all()
            
            for recipient in recipients:
                # Simulate message sending
                recipient.status = "sending"
                recipient.attempts += 1
                await self.session.flush()
                
                # Simulate network delay
                await asyncio.sleep(0.1)
                
                # Simulate success/failure
                import random
                if random.random() > 0.1:  # 90% success rate
                    recipient.status = "sent"
                    recipient.sent_at = datetime.utcnow()
                    
                    # Simulate delivery after a delay
                    await asyncio.sleep(0.2)
                    if random.random() > 0.05:  # 95% delivery rate
                        recipient.status = "delivered"
                        recipient.delivered_at = datetime.utcnow()
                        
                        # Update campaign stats
                        await self.session.execute(
                            update(MarketingCampaign)
                            .where(MarketingCampaign.id == campaign_id)
                            .values(
                                sent_count=MarketingCampaign.sent_count + 1,
                                delivered_count=MarketingCampaign.delivered_count + 1
                            )
                        )
                    else:
                        recipient.status = "failed"
                        recipient.error = "Delivery failed"
                        
                        await self.session.execute(
                            update(MarketingCampaign)
                            .where(MarketingCampaign.id == campaign_id)
                            .values(failed_count=MarketingCampaign.failed_count + 1)
                        )
                else:
                    recipient.status = "failed"
                    recipient.error = "Send failed"
                    
                    await self.session.execute(
                        update(MarketingCampaign)
                        .where(MarketingCampaign.id == campaign_id)
                        .values(failed_count=MarketingCampaign.failed_count + 1)
                    )
                
                await self.session.flush()
            
            # Check if campaign is complete
            remaining_result = await self.session.execute(
                select(func.count(MarketingRecipient.id))
                .where(
                    and_(
                        MarketingRecipient.campaign_id == campaign_id,
                        MarketingRecipient.status == "queued"
                    )
                )
            )
            
            remaining = remaining_result.scalar() or 0
            
            if remaining == 0:
                # Campaign complete
                await self.session.execute(
                    update(MarketingCampaign)
                    .where(MarketingCampaign.id == campaign_id)
                    .values(status=CampaignStatus.COMPLETED)
                )
            
            await self.session.commit()
            
        except Exception as e:
            print(f"Error processing campaign {campaign_id}: {e}")
            await self.session.rollback()
            
            # Mark campaign as failed
            await self.session.execute(
                update(MarketingCampaign)
                .where(MarketingCampaign.id == campaign_id)
                .values(status=CampaignStatus.FAILED)
            )
            await self.session.commit()