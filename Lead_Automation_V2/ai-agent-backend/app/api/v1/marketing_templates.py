"""Marketing Hub - Templates Management API"""
from __future__ import annotations

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.models.marketing_hub import ChannelType
from app.schemas.marketing_hub import (
    TemplateCreate, TemplateUpdate, TemplateOut, PaginationParams, PaginatedResponse
)
from app.services.marketing_template_service import MarketingTemplateService
from app.services.audit_service import log_audit

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/templates", response_model=TemplateOut)
async def create_template(
    body: TemplateCreate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> TemplateOut:
    """Create a new marketing template"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingTemplateService(session)
    template = await service.create_template(organization_id, user_id, body)
    
    await log_audit(
        session, 
        organization_id, 
        user_id, 
        "marketing_hub.template.create", 
        {
            "template_id": str(template.id), 
            "name": template.name, 
            "channel": template.channel,
            "category": template.category
        }
    )
    await session.commit()
    
    return template


@router.post("/templates/generate", response_model=TemplateOut)
async def generate_ai_template(
    template_type: str = Body(...),
    channel: ChannelType = Body(...),
    industry: str = Body(...),
    purpose: str = Body(...),
    tone: str = Body("professional"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> TemplateOut:
    """Generate template using AI"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingTemplateService(session)
    
    try:
        template = await service.generate_ai_template(
            organization_id, user_id, template_type, channel, industry, purpose, tone
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"AI template generation failed: {str(e)}")
    
    await log_audit(
        session, 
        organization_id, 
        user_id, 
        "marketing_hub.template.ai_generate", 
        {
            "template_id": str(template.id),
            "type": template_type,
            "industry": industry,
            "channel": channel.value
        }
    )
    await session.commit()
    
    return template


@router.get("/templates/{template_id}", response_model=TemplateOut)
async def get_template(
    template_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> TemplateOut:
    """Get single template by ID"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingTemplateService(session)
    template = await service.get_template(organization_id, template_id)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template


@router.get("/templates", response_model=PaginatedResponse)
async def list_templates(
    # Pagination
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    
    # Filters
    channel: Optional[ChannelType] = Query(None),
    category: Optional[str] = Query(None),
    is_public: Optional[bool] = Query(None),
    tags: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
    
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> PaginatedResponse:
    """List templates with filters and pagination"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    pagination = PaginationParams(page=page, limit=limit)
    
    service = MarketingTemplateService(session)
    templates, total = await service.list_templates(
        organization_id,
        channel=channel,
        category=category,
        is_public=is_public,
        tags=tags or [],
        search=search,
        pagination=pagination
    )
    
    return PaginatedResponse(
        items=templates,
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit
    )


@router.put("/templates/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: uuid.UUID,
    body: TemplateUpdate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> TemplateOut:
    """Update existing template"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingTemplateService(session)
    template = await service.update_template(organization_id, template_id, body)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.template.update",
        {"template_id": str(template_id), "changes": body.dict(exclude_unset=True)}
    )
    await session.commit()
    
    return template


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Delete template"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingTemplateService(session)
    success = await service.delete_template(organization_id, template_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.template.delete",
        {"template_id": str(template_id)}
    )
    await session.commit()
    
    return {"message": "Template deleted successfully"}


@router.post("/templates/{template_id}/duplicate", response_model=TemplateOut)
async def duplicate_template(
    template_id: uuid.UUID,
    new_name: Optional[str] = Body(None, embed=True),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> TemplateOut:
    """Duplicate an existing template"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingTemplateService(session)
    
    try:
        template = await service.duplicate_template(
            organization_id, template_id, user_id, new_name
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.template.duplicate",
        {"original_id": str(template_id), "duplicate_id": str(template.id)}
    )
    await session.commit()
    
    return template


@router.post("/templates/{template_id}/use", response_model=TemplateOut)
async def use_template(
    template_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> TemplateOut:
    """Mark template as used and increment usage count"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingTemplateService(session)
    
    try:
        template = await service.use_template(organization_id, template_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.template.use",
        {"template_id": str(template_id)}
    )
    await session.commit()
    
    return template


@router.get("/templates/popular")
async def get_popular_templates(
    channel: Optional[ChannelType] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get popular templates sorted by usage"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingTemplateService(session)
    templates = await service.get_popular_templates(organization_id, channel, limit)
    
    return {"popular_templates": templates}


@router.get("/templates/categories")
async def get_template_categories(
    channel: Optional[ChannelType] = Query(None),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get available template categories with counts"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingTemplateService(session)
    categories = await service.get_template_categories(organization_id, channel)
    
    return {"categories": categories}


@router.get("/templates/library")
async def get_template_library(
    user: AuthUser = Depends(_can_manage),
) -> dict:
    """Get comprehensive template library with predefined templates"""
    
    # Predefined template library organized by channel and category
    template_library = {
        "whatsapp": {
            "promotional": [
                {
                    "name": "Flash Sale Alert",
                    "description": "Time-sensitive promotional message with discount",
                    "content": {
                        "body": "🔥 Flash Sale Alert!\n\nGet {{discount}}% OFF on {{product_name}} for the next {{hours}} hours only!\n\nUse code: {{promo_code}}\n\n👉 Shop now: {{shop_url}}\n\n*Limited time offer. T&C apply.",
                        "type": "text"
                    },
                    "variables": ["discount", "product_name", "hours", "promo_code", "shop_url"],
                    "tags": ["promotion", "urgent", "discount"]
                },
                {
                    "name": "Product Launch",
                    "description": "Announce new product launches with excitement",
                    "content": {
                        "body": "🎉 Exciting News!\n\nIntroducing {{product_name}} - {{product_description}}\n\n✨ Key Features:\n• {{feature_1}}\n• {{feature_2}}\n• {{feature_3}}\n\nBe among the first to try it!\n{{cta_url}}",
                        "type": "text"
                    },
                    "variables": ["product_name", "product_description", "feature_1", "feature_2", "feature_3", "cta_url"],
                    "tags": ["launch", "product", "announcement"]
                }
            ],
            "customer_service": [
                {
                    "name": "Order Confirmation",
                    "description": "Confirm customer orders with details",
                    "content": {
                        "body": "✅ Order Confirmed!\n\nHi {{customer_name}},\n\nYour order #{{order_id}} has been confirmed.\n\n📦 Items: {{items}}\n💰 Total: {{total_amount}}\n🚚 Expected delivery: {{delivery_date}}\n\nTrack your order: {{tracking_url}}\n\nThank you for choosing {{company_name}}!",
                        "type": "text"
                    },
                    "variables": ["customer_name", "order_id", "items", "total_amount", "delivery_date", "tracking_url", "company_name"],
                    "tags": ["order", "confirmation", "service"]
                }
            ]
        },
        "email": {
            "newsletter": [
                {
                    "name": "Monthly Newsletter",
                    "description": "Regular newsletter template with sections",
                    "content": {
                        "subject": "{{company_name}} Newsletter - {{month}} {{year}}",
                        "html_body": "<h1>What's New This Month</h1><p>Dear {{first_name}},</p><p>{{intro_message}}</p><h2>Featured Content</h2><ul><li>{{feature_1}}</li><li>{{feature_2}}</li><li>{{feature_3}}</li></ul><p>{{closing_message}}</p>",
                        "preheader": "Your monthly update from {{company_name}}"
                    },
                    "variables": ["company_name", "month", "year", "first_name", "intro_message", "feature_1", "feature_2", "feature_3", "closing_message"],
                    "tags": ["newsletter", "monthly", "update"]
                }
            ],
            "ecommerce": [
                {
                    "name": "Abandoned Cart Recovery",
                    "description": "Win back customers who left items in cart",
                    "content": {
                        "subject": "You left something in your cart, {{first_name}}",
                        "html_body": "<h1>Don't miss out!</h1><p>Hi {{first_name}},</p><p>You have {{item_count}} item(s) waiting in your cart worth {{cart_total}}.</p><p>Complete your purchase now and save {{discount}}%!</p><a href='{{cart_url}}' style='background: #007bff; color: white; padding: 10px 20px; text-decoration: none;'>Complete Purchase</a>",
                        "preheader": "Complete your purchase and save {{discount}}%"
                    },
                    "variables": ["first_name", "item_count", "cart_total", "discount", "cart_url"],
                    "tags": ["ecommerce", "cart", "recovery", "discount"]
                }
            ]
        },
        "sms": {
            "alerts": [
                {
                    "name": "Appointment Reminder",
                    "description": "Remind customers of upcoming appointments",
                    "content": {
                        "body": "Reminder: Your appointment with {{company_name}} is tomorrow at {{time}}. Reply CONFIRM to confirm or RESCHEDULE to change. {{address}}"
                    },
                    "variables": ["company_name", "time", "address"],
                    "tags": ["appointment", "reminder", "confirmation"]
                }
            ],
            "verification": [
                {
                    "name": "OTP Verification",
                    "description": "Send OTP codes for verification",
                    "content": {
                        "body": "Your {{company_name}} verification code is: {{otp_code}}. Valid for {{validity}} minutes. Do not share this code with anyone."
                    },
                    "variables": ["company_name", "otp_code", "validity"],
                    "tags": ["otp", "verification", "security"]
                }
            ]
        }
    }
    
    # Template generation prompts
    generation_prompts = {
        "promotional": {
            "whatsapp": "Create an engaging WhatsApp promotional message with emojis and clear call-to-action",
            "email": "Generate a promotional email with compelling subject line and professional HTML layout",
            "sms": "Write a concise promotional SMS under 160 characters with strong CTA"
        },
        "transactional": {
            "whatsapp": "Create a professional transactional WhatsApp message with order/service details",
            "email": "Generate a transactional email with clear information and next steps",
            "sms": "Write a brief transactional SMS with essential information only"
        },
        "engagement": {
            "whatsapp": "Create an engaging WhatsApp message to boost customer interaction and loyalty",
            "email": "Generate an engagement email with valuable content and clear value proposition",
            "sms": "Write an engaging SMS that drives customer action and response"
        }
    }
    
    return {
        "template_library": template_library,
        "generation_prompts": generation_prompts,
        "available_channels": list(template_library.keys()),
        "template_count": sum(len(cats) for channel in template_library.values() for cats in channel.values()),
        "usage_tips": {
            "whatsapp": "Keep messages personal and conversational. Use emojis appropriately.",
            "email": "Focus on compelling subject lines and mobile-friendly design.",
            "sms": "Be concise and include clear opt-out instructions.",
            "messenger": "Use quick replies and buttons for better engagement.",
            "instagram": "Focus on visual content and use relevant hashtags.",
            "linkedin": "Maintain professional tone and provide business value."
        }
    }