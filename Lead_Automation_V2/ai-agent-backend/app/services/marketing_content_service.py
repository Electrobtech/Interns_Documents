"""Marketing Content Service - Business logic for AI-powered content creation and management"""
from __future__ import annotations

import uuid
import random
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketing_hub import MarketingContent, ContentType, ContentStatus, ChannelType
from app.schemas.marketing_hub import (
    ContentCreate, ContentUpdate, ContentOut, ContentFilters, PaginationParams
)
from app.services.ai_content_generator import AIContentGenerator


class MarketingContentService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.ai_generator = AIContentGenerator()

    async def create_content(
        self, 
        organization_id: uuid.UUID, 
        user_id: uuid.UUID,
        content_data: ContentCreate
    ) -> ContentOut:
        """Create new marketing content"""
        
        # Process content based on type
        processed_content = await self._process_content_data(content_data.content, content_data.type, content_data.channel)
        
        content = MarketingContent(
            organization_id=organization_id,
            name=content_data.name,
            type=content_data.type,
            channel=content_data.channel,
            content=processed_content,
            ai_generated=bool(content_data.ai_prompt),
            ai_prompt=content_data.ai_prompt,
            scheduled_at=content_data.scheduled_at,
            tags=content_data.tags,
            category=content_data.category,
            performance=self._init_performance_metrics(),
            created_by=user_id,
            updated_by=user_id
        )
        
        self.session.add(content)
        await self.session.flush()
        await self.session.refresh(content)
        
        return ContentOut.from_orm(content)

    async def generate_ai_content(
        self,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        content_type: str,
        channel: Optional[str],
        ai_prompt: str,
        context: Dict[str, Any]
    ) -> ContentOut:
        """Generate content using AI"""
        
        # Extract parameters from context
        campaign_type = context.get("campaign_type", "awareness")
        objective = context.get("objective", "engagement")
        target_audience = context.get("target_audience", "general audience")
        product_service = context.get("product_service", "our product")
        tone = context.get("tone", "professional")
        
        try:
            # Generate content using AI
            if content_type == "campaign":
                ai_content = await self.ai_generator.generate_campaign_content(
                    campaign_type=campaign_type,
                    objective=objective,
                    target_audience=target_audience,
                    product_service=product_service,
                    tone=tone,
                    channel=channel or "email"
                )
            elif content_type == "broadcast":
                ai_content = await self.ai_generator.generate_broadcast_message(
                    channel=channel or "email",
                    message_type=context.get("message_type", "promotional"),
                    audience=target_audience,
                    product_offer=product_service,
                    urgency=context.get("urgency", "medium")
                )
            elif content_type == "seo":
                ai_content = await self.ai_generator.generate_seo_content(
                    target_keyword=context.get("keyword", "marketing"),
                    content_type="blog_post",
                    audience=target_audience,
                    word_count=context.get("word_count", 500)
                )
            else:
                # Generic content generation
                ai_content = {
                    "name": f"AI Generated {content_type.title()}",
                    "content": f"Generated content based on prompt: {ai_prompt}",
                    "generated_at": datetime.utcnow().isoformat()
                }
            
            # Create content record
            content_create = ContentCreate(
                name=ai_content.get("name", f"AI Generated {content_type.title()}"),
                type=ContentType(content_type) if content_type in [e.value for e in ContentType] else ContentType.POST,
                channel=ChannelType(channel) if channel and channel in [e.value for e in ChannelType] else None,
                content=ai_content,
                ai_prompt=ai_prompt,
                category=context.get("category", "ai-generated")
            )
            
            return await self.create_content(organization_id, user_id, content_create)
            
        except Exception as e:
            # Fallback content if AI generation fails
            fallback_content = {
                "error": f"AI generation failed: {str(e)}",
                "fallback_content": f"Content generated for: {ai_prompt}",
                "generated_at": datetime.utcnow().isoformat()
            }
            
            content_create = ContentCreate(
                name=f"Content - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
                type=ContentType.POST,
                content=fallback_content,
                ai_prompt=ai_prompt,
                category="ai-generated"
            )
            
            return await self.create_content(organization_id, user_id, content_create)

    async def get_content(
        self, 
        organization_id: uuid.UUID, 
        content_id: uuid.UUID
    ) -> Optional[ContentOut]:
        """Get single content item by ID"""
        
        result = await self.session.execute(
            select(MarketingContent)
            .where(
                and_(
                    MarketingContent.id == content_id,
                    MarketingContent.organization_id == organization_id,
                    MarketingContent.deleted_at.is_(None)
                )
            )
        )
        
        content = result.scalar_one_or_none()
        if not content:
            return None
            
        # Update performance metrics if content is published
        if content.status == ContentStatus.PUBLISHED:
            content.performance = self._update_performance_metrics(content)
            
        return ContentOut.from_orm(content)

    async def list_content(
        self,
        organization_id: uuid.UUID,
        filters: ContentFilters,
        pagination: PaginationParams
    ) -> Tuple[List[ContentOut], int]:
        """List content items with filters and pagination"""
        
        query = select(MarketingContent).where(
            and_(
                MarketingContent.organization_id == organization_id,
                MarketingContent.deleted_at.is_(None)
            )
        )
        
        # Apply filters
        conditions = []
        
        if filters.status:
            conditions.append(MarketingContent.status == filters.status)
        
        if filters.type:
            conditions.append(MarketingContent.type == filters.type)
            
        if filters.channel:
            conditions.append(MarketingContent.channel == filters.channel)
            
        if filters.category:
            conditions.append(MarketingContent.category == filters.category)
            
        if filters.ai_generated is not None:
            conditions.append(MarketingContent.ai_generated == filters.ai_generated)
            
        if filters.tags:
            for tag in filters.tags:
                conditions.append(MarketingContent.tags.contains([tag]))
                
        if filters.search:
            search_term = f"%{filters.search}%"
            conditions.append(
                or_(
                    MarketingContent.name.ilike(search_term),
                    MarketingContent.content.op('::text').ilike(search_term)
                )
            )
        
        if conditions:
            query = query.where(and_(*conditions))
            
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination and ordering
        query = query.order_by(desc(MarketingContent.updated_at))
        query = query.offset((pagination.page - 1) * pagination.limit).limit(pagination.limit)
        
        # Execute query
        result = await self.session.execute(query)
        content_items = result.scalars().all()
        
        # Update metrics and build outputs
        content_outputs = []
        for content in content_items:
            if content.status == ContentStatus.PUBLISHED:
                content.performance = self._update_performance_metrics(content)
            content_outputs.append(ContentOut.from_orm(content))
        
        return content_outputs, total

    async def update_content(
        self,
        organization_id: uuid.UUID,
        content_id: uuid.UUID,
        update_data: ContentUpdate
    ) -> Optional[ContentOut]:
        """Update existing content"""
        
        result = await self.session.execute(
            select(MarketingContent)
            .where(
                and_(
                    MarketingContent.id == content_id,
                    MarketingContent.organization_id == organization_id,
                    MarketingContent.deleted_at.is_(None)
                )
            )
        )
        
        content = result.scalar_one_or_none()
        if not content:
            return None
        
        # Update fields
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if hasattr(content, field):
                setattr(content, field, value)
        
        content.updated_at = datetime.utcnow()
        content.version += 1
        
        # Handle status changes
        if update_data.status == ContentStatus.PUBLISHED and content.published_at is None:
            content.published_at = datetime.utcnow()
        
        await self.session.flush()
        await self.session.refresh(content)
        
        return ContentOut.from_orm(content)

    async def delete_content(
        self,
        organization_id: uuid.UUID,
        content_id: uuid.UUID
    ) -> bool:
        """Soft delete content"""
        
        result = await self.session.execute(
            select(MarketingContent)
            .where(
                and_(
                    MarketingContent.id == content_id,
                    MarketingContent.organization_id == organization_id,
                    MarketingContent.deleted_at.is_(None)
                )
            )
        )
        
        content = result.scalar_one_or_none()
        if not content:
            return False
            
        content.deleted_at = datetime.utcnow()
        return True

    async def optimize_content(
        self,
        organization_id: uuid.UUID,
        content_id: uuid.UUID,
        optimization_goal: str,
        target_metrics: List[str]
    ) -> Dict[str, Any]:
        """Optimize content using AI"""
        
        content = await self.get_content(organization_id, content_id)
        if not content:
            raise ValueError("Content not found")
        
        original_text = str(content.content.get("content", ""))
        
        optimization = await self.ai_generator.optimize_content(
            original_content=original_text,
            optimization_goal=optimization_goal,
            target_metrics=target_metrics
        )
        
        return optimization

    async def generate_content_variations(
        self,
        organization_id: uuid.UUID,
        content_id: uuid.UUID,
        variation_count: int = 3
    ) -> List[Dict[str, Any]]:
        """Generate variations of existing content"""
        
        content = await self.get_content(organization_id, content_id)
        if not content:
            raise ValueError("Content not found")
        
        variations = []
        original_content = str(content.content.get("content", ""))
        
        for i in range(variation_count):
            try:
                optimization = await self.ai_generator.optimize_content(
                    original_content=original_content,
                    optimization_goal=f"variation_{i+1}",
                    target_metrics=["engagement", "conversion"]
                )
                
                variation = {
                    "variation_number": i + 1,
                    "content": optimization.get("optimized_content", original_content),
                    "changes": optimization.get("changes_made", []),
                    "expected_impact": optimization.get("expected_impact", "")
                }
                variations.append(variation)
                
            except Exception as e:
                # Fallback variation
                variation = {
                    "variation_number": i + 1,
                    "content": original_content,
                    "changes": [f"Variation {i+1} generated"],
                    "expected_impact": "Similar performance expected",
                    "error": str(e)
                }
                variations.append(variation)
        
        return variations

    async def get_content_insights(
        self,
        organization_id: uuid.UUID,
        content_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Get detailed insights about content performance"""
        
        content = await self.get_content(organization_id, content_id)
        if not content:
            raise ValueError("Content not found")
        
        # Generate comprehensive insights
        insights = {
            "content_id": str(content_id),
            "performance_summary": content.performance,
            "engagement_score": self._calculate_engagement_score(content.performance),
            "optimization_suggestions": await self._generate_optimization_suggestions(content),
            "trend_analysis": self._analyze_performance_trends(content),
            "comparative_analysis": await self._get_comparative_performance(organization_id, content)
        }
        
        return insights

    async def _process_content_data(
        self, 
        content: Dict[str, Any], 
        content_type: ContentType, 
        channel: Optional[ChannelType]
    ) -> Dict[str, Any]:
        """Process and enrich content data"""
        
        processed = content.copy()
        
        # Add metadata
        processed["type"] = content_type.value
        processed["channel"] = channel.value if channel else None
        processed["processed_at"] = datetime.utcnow().isoformat()
        
        # Channel-specific processing
        if channel == ChannelType.WHATSAPP:
            processed["character_count"] = len(str(content.get("body", "")))
            processed["estimated_read_time"] = max(1, len(str(content.get("body", ""))) // 200)
            
        elif channel == ChannelType.EMAIL:
            processed["word_count"] = len(str(content.get("body", "")).split())
            processed["estimated_read_time"] = max(1, len(str(content.get("body", "")).split()) // 200)
            
        return processed

    def _init_performance_metrics(self) -> Dict[str, Any]:
        """Initialize performance metrics for new content"""
        
        return {
            "views": 0,
            "shares": 0,
            "likes": 0,
            "comments": 0,
            "clicks": 0,
            "conversions": 0,
            "engagement_rate": 0.0,
            "click_through_rate": 0.0,
            "conversion_rate": 0.0,
            "last_updated": datetime.utcnow().isoformat()
        }

    def _update_performance_metrics(self, content: MarketingContent) -> Dict[str, Any]:
        """Update performance metrics with simulated data"""
        
        current_metrics = content.performance or self._init_performance_metrics()
        
        # Simulate performance based on content age and type
        days_since_published = 1
        if content.published_at:
            days_since_published = (datetime.utcnow() - content.published_at).days + 1
        
        # Simulate growth
        base_views = random.randint(100, 1000) * days_since_published
        engagement_rate = random.uniform(2, 15)  # 2-15% engagement
        
        current_metrics.update({
            "views": base_views,
            "likes": int(base_views * random.uniform(0.02, 0.08)),
            "shares": int(base_views * random.uniform(0.005, 0.02)),
            "comments": int(base_views * random.uniform(0.001, 0.01)),
            "clicks": int(base_views * random.uniform(0.01, 0.05)),
            "conversions": int(base_views * random.uniform(0.001, 0.005)),
            "engagement_rate": round(engagement_rate, 2),
            "click_through_rate": round(random.uniform(1, 8), 2),
            "conversion_rate": round(random.uniform(0.5, 5), 2),
            "last_updated": datetime.utcnow().isoformat()
        })
        
        return current_metrics

    def _calculate_engagement_score(self, performance: Dict[str, Any]) -> int:
        """Calculate overall engagement score (0-100)"""
        
        views = performance.get("views", 0)
        if views == 0:
            return 0
        
        engagement_rate = performance.get("engagement_rate", 0)
        ctr = performance.get("click_through_rate", 0)
        conversion_rate = performance.get("conversion_rate", 0)
        
        # Weighted scoring
        score = (
            engagement_rate * 30 +  # 30% weight
            ctr * 40 +              # 40% weight  
            conversion_rate * 30    # 30% weight
        )
        
        return min(100, max(0, int(score)))

    async def _generate_optimization_suggestions(self, content: ContentOut) -> List[str]:
        """Generate AI-powered optimization suggestions"""
        
        suggestions = []
        performance = content.performance or {}
        
        # Engagement-based suggestions
        engagement_rate = performance.get("engagement_rate", 0)
        if engagement_rate < 5:
            suggestions.append("Consider adding more interactive elements to boost engagement")
            suggestions.append("Try using more compelling headlines or calls-to-action")
        
        # CTR-based suggestions
        ctr = performance.get("click_through_rate", 0)
        if ctr < 3:
            suggestions.append("Strengthen your call-to-action to improve click-through rate")
            suggestions.append("Consider A/B testing different button colors or text")
        
        # Channel-specific suggestions
        if content.channel == "email":
            suggestions.append("Test subject line variations to improve open rates")
            suggestions.append("Consider personalizing content based on user segments")
        elif content.channel == "whatsapp":
            suggestions.append("Add relevant emojis to make messages more engaging")
            suggestions.append("Consider using multimedia content for better engagement")
        
        # AI-generated suggestions
        if len(suggestions) < 3:
            try:
                content_text = str(content.content.get("content", ""))
                ai_optimization = await self.ai_generator.optimize_content(
                    original_content=content_text,
                    optimization_goal="engagement",
                    target_metrics=["clicks", "conversions"]
                )
                suggestions.extend(ai_optimization.get("ab_test_ideas", [])[:2])
            except:
                suggestions.append("Consider refreshing content with current trends")
        
        return suggestions[:5]  # Return top 5 suggestions

    def _analyze_performance_trends(self, content: ContentOut) -> Dict[str, Any]:
        """Analyze performance trends"""
        
        return {
            "trend": "stable",  # Could be "growing", "declining", "stable"
            "peak_engagement_time": "2:00 PM - 4:00 PM",
            "best_performing_element": "Call-to-action button",
            "recommended_posting_time": "Tuesday 2:30 PM",
            "seasonal_factor": "Standard performance expected"
        }

    async def _get_comparative_performance(
        self, 
        organization_id: uuid.UUID, 
        content: ContentOut
    ) -> Dict[str, Any]:
        """Get comparative performance against similar content"""
        
        # This would typically query similar content and compare metrics
        return {
            "vs_similar_content": {
                "engagement_rate": "+15%",
                "ctr": "+5%", 
                "conversion_rate": "-2%"
            },
            "industry_benchmark": {
                "engagement_rate": "Above average",
                "ctr": "Average",
                "conversion_rate": "Below average"
            },
            "ranking": "Top 25% in category"
        }