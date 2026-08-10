"""Marketing Template Service - Business logic for template management"""
from __future__ import annotations

import uuid
import random
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.marketing_hub import MarketingTemplate, ChannelType
from app.schemas.marketing_hub import (
    TemplateCreate, TemplateUpdate, TemplateOut, PaginationParams
)
from app.services.ai_content_generator import AIContentGenerator


class MarketingTemplateService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.ai_generator = AIContentGenerator()

    async def create_template(
        self, 
        organization_id: uuid.UUID, 
        user_id: uuid.UUID,
        template_data: TemplateCreate
    ) -> TemplateOut:
        """Create a new marketing template"""
        
        # Process template content based on channel
        processed_content = self._process_template_content(template_data.content, template_data.channel)
        
        # Generate preview data if not provided
        preview_data = template_data.preview_data or self._generate_preview_data(template_data.channel, processed_content)
        
        template = MarketingTemplate(
            organization_id=organization_id,
            name=template_data.name,
            category=template_data.category,
            channel=template_data.channel,
            content=processed_content,
            preview_data=preview_data,
            is_public=template_data.is_public,
            tags=template_data.tags,
            created_by=user_id
        )
        
        self.session.add(template)
        await self.session.flush()
        await self.session.refresh(template)
        
        return TemplateOut.from_orm(template)

    async def generate_ai_template(
        self,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        template_type: str,
        channel: ChannelType,
        industry: str,
        purpose: str,
        tone: str = "professional"
    ) -> TemplateOut:
        """Generate template using AI"""
        
        try:
            # Generate template content using AI
            if template_type == "email":
                ai_content = await self.ai_generator.generate_broadcast_message(
                    channel=channel.value,
                    message_type="template",
                    audience=f"{industry} customers",
                    product_offer=purpose,
                    urgency="medium"
                )
            elif template_type == "campaign":
                ai_content = await self.ai_generator.generate_campaign_content(
                    campaign_type="template",
                    objective=purpose,
                    target_audience=f"{industry} audience",
                    product_service=purpose,
                    tone=tone,
                    channel=channel.value
                )
            else:
                # Generic template generation
                ai_content = {
                    "subject": f"{purpose} - {industry}",
                    "content": f"AI-generated {template_type} template for {industry} - {purpose}",
                    "cta": "Take Action",
                    "generated_at": datetime.utcnow().isoformat()
                }
            
            # Create template
            template_create = TemplateCreate(
                name=f"AI {template_type.title()} - {industry}",
                category=industry.lower(),
                channel=channel,
                content=ai_content,
                is_public=False,
                tags=["ai-generated", template_type, industry.lower()]
            )
            
            return await self.create_template(organization_id, user_id, template_create)
            
        except Exception as e:
            # Fallback template if AI generation fails
            fallback_content = {
                "subject": f"{purpose} Template",
                "content": f"Template for {purpose} in {industry} industry",
                "cta": "Learn More",
                "error": f"AI generation failed: {str(e)}"
            }
            
            template_create = TemplateCreate(
                name=f"{template_type.title()} Template - {industry}",
                category=industry.lower(),
                channel=channel,
                content=fallback_content,
                tags=["fallback", template_type, industry.lower()]
            )
            
            return await self.create_template(organization_id, user_id, template_create)

    async def get_template(
        self, 
        organization_id: uuid.UUID, 
        template_id: uuid.UUID
    ) -> Optional[TemplateOut]:
        """Get single template by ID"""
        
        result = await self.session.execute(
            select(MarketingTemplate)
            .where(
                and_(
                    MarketingTemplate.id == template_id,
                    or_(
                        MarketingTemplate.organization_id == organization_id,
                        MarketingTemplate.is_public == True
                    )
                )
            )
        )
        
        template = result.scalar_one_or_none()
        if not template:
            return None
            
        return TemplateOut.from_orm(template)

    async def list_templates(
        self,
        organization_id: uuid.UUID,
        channel: Optional[ChannelType] = None,
        category: Optional[str] = None,
        is_public: Optional[bool] = None,
        tags: Optional[List[str]] = None,
        search: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> Tuple[List[TemplateOut], int]:
        """List templates with optional filters"""
        
        query = select(MarketingTemplate).where(
            or_(
                MarketingTemplate.organization_id == organization_id,
                MarketingTemplate.is_public == True
            )
        )
        
        # Apply filters
        conditions = []
        
        if channel:
            conditions.append(MarketingTemplate.channel == channel)
            
        if category:
            conditions.append(MarketingTemplate.category == category)
            
        if is_public is not None:
            conditions.append(MarketingTemplate.is_public == is_public)
            
        if tags:
            for tag in tags:
                conditions.append(MarketingTemplate.tags.contains([tag]))
                
        if search:
            search_term = f"%{search}%"
            conditions.append(
                or_(
                    MarketingTemplate.name.ilike(search_term),
                    MarketingTemplate.category.ilike(search_term)
                )
            )
        
        if conditions:
            query = query.where(and_(*conditions))
            
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination and ordering
        query = query.order_by(desc(MarketingTemplate.usage_count), desc(MarketingTemplate.updated_at))
        
        if pagination:
            query = query.offset((pagination.page - 1) * pagination.limit).limit(pagination.limit)
            
        # Execute query
        result = await self.session.execute(query)
        templates = result.scalars().all()
        
        return [TemplateOut.from_orm(template) for template in templates], total

    async def update_template(
        self,
        organization_id: uuid.UUID,
        template_id: uuid.UUID,
        update_data: TemplateUpdate
    ) -> Optional[TemplateOut]:
        """Update existing template"""
        
        result = await self.session.execute(
            select(MarketingTemplate)
            .where(
                and_(
                    MarketingTemplate.id == template_id,
                    MarketingTemplate.organization_id == organization_id
                )
            )
        )
        
        template = result.scalar_one_or_none()
        if not template:
            return None
        
        # Update fields
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if hasattr(template, field):
                if field == "content":
                    value = self._process_template_content(value, template.channel)
                setattr(template, field, value)
        
        template.updated_at = datetime.utcnow()
        
        await self.session.flush()
        await self.session.refresh(template)
        
        return TemplateOut.from_orm(template)

    async def delete_template(
        self,
        organization_id: uuid.UUID,
        template_id: uuid.UUID
    ) -> bool:
        """Delete template"""
        
        result = await self.session.execute(
            select(MarketingTemplate)
            .where(
                and_(
                    MarketingTemplate.id == template_id,
                    MarketingTemplate.organization_id == organization_id
                )
            )
        )
        
        template = result.scalar_one_or_none()
        if not template:
            return False
            
        await self.session.delete(template)
        return True

    async def duplicate_template(
        self,
        organization_id: uuid.UUID,
        template_id: uuid.UUID,
        user_id: uuid.UUID,
        new_name: Optional[str] = None
    ) -> TemplateOut:
        """Duplicate an existing template"""
        
        original = await self.get_template(organization_id, template_id)
        if not original:
            raise ValueError("Original template not found")
        
        # Create duplicate
        duplicate_data = TemplateCreate(
            name=new_name or f"{original.name} (Copy)",
            category=original.category,
            channel=ChannelType(original.channel),
            content=original.content,
            preview_data=original.preview_data,
            is_public=False,  # Duplicates are private by default
            tags=original.tags + ["duplicate"]
        )
        
        return await self.create_template(organization_id, user_id, duplicate_data)

    async def use_template(
        self,
        organization_id: uuid.UUID,
        template_id: uuid.UUID
    ) -> TemplateOut:
        """Mark template as used and increment usage count"""
        
        result = await self.session.execute(
            select(MarketingTemplate)
            .where(
                and_(
                    MarketingTemplate.id == template_id,
                    or_(
                        MarketingTemplate.organization_id == organization_id,
                        MarketingTemplate.is_public == True
                    )
                )
            )
        )
        
        template = result.scalar_one_or_none()
        if not template:
            raise ValueError("Template not found")
        
        template.usage_count += 1
        await self.session.flush()
        
        return TemplateOut.from_orm(template)

    async def get_popular_templates(
        self,
        organization_id: uuid.UUID,
        channel: Optional[ChannelType] = None,
        limit: int = 10
    ) -> List[TemplateOut]:
        """Get popular templates sorted by usage"""
        
        query = select(MarketingTemplate).where(
            or_(
                MarketingTemplate.organization_id == organization_id,
                MarketingTemplate.is_public == True
            )
        )
        
        if channel:
            query = query.where(MarketingTemplate.channel == channel)
        
        query = query.order_by(desc(MarketingTemplate.usage_count)).limit(limit)
        
        result = await self.session.execute(query)
        templates = result.scalars().all()
        
        return [TemplateOut.from_orm(template) for template in templates]

    async def get_template_categories(
        self,
        organization_id: uuid.UUID,
        channel: Optional[ChannelType] = None
    ) -> List[Dict[str, Any]]:
        """Get available template categories with counts"""
        
        query = select(MarketingTemplate.category, func.count(MarketingTemplate.id)).where(
            or_(
                MarketingTemplate.organization_id == organization_id,
                MarketingTemplate.is_public == True
            )
        )
        
        if channel:
            query = query.where(MarketingTemplate.channel == channel)
        
        query = query.group_by(MarketingTemplate.category)
        
        result = await self.session.execute(query)
        categories = result.all()
        
        return [
            {"category": cat, "count": count, "channel": channel.value if channel else "all"}
            for cat, count in categories
        ]

    def _process_template_content(self, content: Dict[str, Any], channel: ChannelType) -> Dict[str, Any]:
        """Process template content based on channel requirements"""
        
        processed = content.copy()
        
        # Add channel-specific metadata
        processed["channel"] = channel.value
        processed["template_type"] = "template"
        processed["processed_at"] = datetime.utcnow().isoformat()
        
        # Channel-specific processing
        if channel == ChannelType.EMAIL:
            # Ensure required email fields
            processed.setdefault("subject", "{{subject}}")
            processed.setdefault("preheader", "{{preheader}}")
            processed.setdefault("html_body", processed.get("content", "{{content}}"))
            processed.setdefault("text_body", processed.get("content", "{{content}}"))
            
        elif channel == ChannelType.WHATSAPP:
            # WhatsApp message structure
            processed.setdefault("type", "text")
            processed.setdefault("body", processed.get("content", "{{message}}"))
            
        elif channel == ChannelType.SMS:
            # SMS constraints
            content_text = processed.get("content", "{{message}}")
            if len(content_text) > 160:
                processed["warning"] = "Content exceeds SMS character limit"
            processed["character_count"] = len(content_text)
            
        # Extract variables for templating
        processed["variables"] = self._extract_template_variables(processed)
        
        return processed

    def _generate_preview_data(self, channel: ChannelType, content: Dict[str, Any]) -> Dict[str, Any]:
        """Generate preview data for template"""
        
        # Sample data for preview
        sample_data = {
            "company_name": "Acme Corp",
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "product_name": "Amazing Product",
            "discount": "20",
            "cta_url": "https://example.com",
            "current_date": datetime.utcnow().strftime("%B %d, %Y")
        }
        
        # Generate preview by replacing variables
        preview_content = {}
        for key, value in content.items():
            if isinstance(value, str):
                preview_value = value
                for var_name, var_value in sample_data.items():
                    preview_value = preview_value.replace(f"{{{var_name}}}", str(var_value))
                    preview_value = preview_value.replace(f"{{{{{var_name}}}}}", str(var_value))
                preview_content[key] = preview_value
            else:
                preview_content[key] = value
        
        return {
            "sample_data": sample_data,
            "rendered_content": preview_content,
            "channel": channel.value,
            "generated_at": datetime.utcnow().isoformat()
        }

    def _extract_template_variables(self, content: Dict[str, Any]) -> List[str]:
        """Extract template variables from content"""
        
        import re
        
        variables = set()
        content_str = str(content)
        
        # Find {{variable}} and {variable} patterns
        patterns = [r'\{\{(\w+)\}\}', r'\{(\w+)\}']
        for pattern in patterns:
            matches = re.findall(pattern, content_str)
            variables.update(matches)
        
        # Common marketing variables
        common_vars = ["first_name", "last_name", "company_name", "email", "product_name", "discount", "cta_url"]
        
        return list(variables) + [var for var in common_vars if var not in variables]