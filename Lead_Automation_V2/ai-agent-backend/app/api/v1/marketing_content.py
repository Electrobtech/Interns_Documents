"""Marketing Hub - Content Studio API with AI Generation"""
from __future__ import annotations

import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.models.marketing_hub import ContentType, ContentStatus, ChannelType
from app.schemas.marketing_hub import (
    ContentCreate, ContentUpdate, ContentOut, ContentFilters, 
    PaginationParams, PaginatedResponse
)
from app.services.marketing_content_service import MarketingContentService
from app.services.ai_content_generator import AIContentGenerator
from app.services.audit_service import log_audit
from app.llm.factory import get_llm_provider

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.post("/generate-content")
@router.post("/marketing-content/generate-content")
async def generate_content_simple(
    prompt: str = Body(...),
    content_type: str = Body(...),
    channel: Optional[str] = Body(None),
    context: Dict[str, Any] = Body(default_factory=dict),
    user: AuthUser = Depends(_can_manage),
) -> Dict[str, Any]:
    """Simple content generation endpoint using LLM"""
    
    try:
        llm = get_llm_provider()
        
        # Build the system prompt based on content type
        system_prompts = {
            "social_post": "You are an expert social media marketer. Create engaging, platform-appropriate content with emojis and hashtags.",
            "email": "You are an expert email marketer. Create compelling email copy with strong subject lines and clear CTAs.",
            "ad_copy": "You are an expert advertising copywriter. Create high-converting ad copy with attention-grabbing headlines.",
            "blog_outline": "You are an expert content strategist. Create comprehensive blog post outlines with clear structure.",
            "whatsapp_message": "You are an expert WhatsApp marketer. Create conversational, engaging messages that drive responses."
        }
        
        system_prompt = system_prompts.get(content_type, "You are an expert marketing copywriter.")
        
        # Build the full user prompt
        user_prompt = f"""Generate {content_type} content for {channel or 'general'} channel.

Requirements: {prompt}

Context: {context if context else 'General marketing'}

Please generate compelling, professional marketing content that:
- Grabs attention immediately
- Clearly communicates value
- Has a strong call-to-action
- Is optimized for the specified channel"""

        # Call the LLM
        from app.llm.base import ChatMessage
        messages = [
            ChatMessage(role="system", content=system_prompt),
            ChatMessage(role="user", content=user_prompt)
        ]
        
        response = await llm.agenerate(messages, max_tokens=1500, temperature=0.7)
        generated_content = response.content
        
        return {
            "content": generated_content,
            "generated_content": generated_content,
            "metadata": {
                "content_type": content_type,
                "channel": channel,
                "model": llm.__class__.__name__
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Content generation failed: {str(e)}")


@router.post("/content", response_model=ContentOut)
async def create_content(
    body: ContentCreate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> ContentOut:
    """Create new marketing content"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingContentService(session)
    content = await service.create_content(organization_id, user_id, body)
    
    await log_audit(
        session, 
        organization_id, 
        user_id, 
        "marketing_hub.content.create", 
        {
            "content_id": str(content.id), 
            "name": content.name, 
            "type": content.type,
            "ai_generated": content.ai_generated
        }
    )
    await session.commit()
    
    return content


@router.post("/content/generate", response_model=ContentOut)
async def generate_ai_content(
    content_type: str = Body(...),
    channel: Optional[str] = Body(None),
    ai_prompt: str = Body(...),
    context: Dict[str, Any] = Body(default_factory=dict),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> ContentOut:
    """Generate content using AI"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingContentService(session)
    
    try:
        content = await service.generate_ai_content(
            organization_id, user_id, content_type, channel, ai_prompt, context
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"AI generation failed: {str(e)}")
    
    await log_audit(
        session, 
        organization_id, 
        user_id, 
        "marketing_hub.content.ai_generate", 
        {
            "content_id": str(content.id),
            "prompt": ai_prompt[:200],
            "type": content_type,
            "channel": channel
        }
    )
    await session.commit()
    
    return content


@router.get("/content/{content_id}", response_model=ContentOut)
async def get_content(
    content_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> ContentOut:
    """Get single content item by ID"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingContentService(session)
    content = await service.get_content(organization_id, content_id)
    
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    return content


@router.get("/content", response_model=PaginatedResponse)
async def list_content(
    # Pagination
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    
    # Filters
    status: Optional[ContentStatus] = Query(None),
    content_type: Optional[ContentType] = Query(None, alias="type"),
    channel: Optional[ChannelType] = Query(None),
    category: Optional[str] = Query(None),
    ai_generated: Optional[bool] = Query(None),
    tags: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),
    
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> PaginatedResponse:
    """List content items with filters and pagination"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    pagination = PaginationParams(page=page, limit=limit)
    filters = ContentFilters(
        status=status,
        type=content_type,
        channel=channel,
        category=category,
        ai_generated=ai_generated,
        tags=tags or [],
        search=search
    )
    
    service = MarketingContentService(session)
    content_items, total = await service.list_content(organization_id, filters, pagination)
    
    return PaginatedResponse(
        items=content_items,
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit
    )


@router.put("/content/{content_id}", response_model=ContentOut)
async def update_content(
    content_id: uuid.UUID,
    body: ContentUpdate,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> ContentOut:
    """Update existing content"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingContentService(session)
    content = await service.update_content(organization_id, content_id, body)
    
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.content.update",
        {"content_id": str(content_id), "changes": body.dict(exclude_unset=True)}
    )
    await session.commit()
    
    return content


@router.delete("/content/{content_id}")
async def delete_content(
    content_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Delete content"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingContentService(session)
    success = await service.delete_content(organization_id, content_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Content not found")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.content.delete",
        {"content_id": str(content_id)}
    )
    await session.commit()
    
    return {"message": "Content deleted successfully"}


@router.post("/content/{content_id}/optimize")
async def optimize_content(
    content_id: uuid.UUID,
    optimization_goal: str = Body(...),
    target_metrics: List[str] = Body(...),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Optimize content using AI"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingContentService(session)
    
    try:
        optimization = await service.optimize_content(
            organization_id, content_id, optimization_goal, target_metrics
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Optimization failed: {str(e)}")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.content.optimize",
        {"content_id": str(content_id), "goal": optimization_goal}
    )
    await session.commit()
    
    return optimization


@router.post("/content/{content_id}/variations")
async def generate_content_variations(
    content_id: uuid.UUID,
    variation_count: int = Body(3, ge=1, le=10),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Generate variations of existing content"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    service = MarketingContentService(session)
    
    try:
        variations = await service.generate_content_variations(
            organization_id, content_id, variation_count
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Variation generation failed: {str(e)}")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.content.generate_variations",
        {"content_id": str(content_id), "count": variation_count}
    )
    await session.commit()
    
    return {"variations": variations}


@router.get("/content/{content_id}/insights")
async def get_content_insights(
    content_id: uuid.UUID,
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get detailed insights about content performance"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingContentService(session)
    
    try:
        insights = await service.get_content_insights(organization_id, content_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    return insights


@router.post("/ai/campaign-ideas")
async def generate_campaign_ideas(
    industry: str = Body(...),
    season_event: Optional[str] = Body(None),
    budget_range: str = Body("medium"),
    objectives: List[str] = Body(default_factory=list),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Generate AI-powered campaign ideas"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    ai_generator = AIContentGenerator()
    
    try:
        ideas = await ai_generator.generate_campaign_ideas(
            industry, season_event, budget_range, objectives
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"AI generation failed: {str(e)}")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.ai.campaign_ideas",
        {"industry": industry, "objectives": objectives}
    )
    await session.commit()
    
    return ideas


@router.post("/ai/content-calendar")
async def generate_content_calendar(
    duration_weeks: int = Body(..., ge=1, le=52),
    posting_frequency: str = Body(...),
    brand_themes: List[str] = Body(...),
    channels: List[str] = Body(...),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Generate AI-powered content calendar"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    ai_generator = AIContentGenerator()
    
    try:
        calendar = await ai_generator.generate_content_calendar(
            duration_weeks, posting_frequency, brand_themes, channels
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Calendar generation failed: {str(e)}")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.ai.content_calendar",
        {"weeks": duration_weeks, "channels": channels}
    )
    await session.commit()
    
    return calendar


@router.post("/ai/competitor-analysis")
async def analyze_competitor_content(
    competitor_content: str = Body(...),
    our_brand: str = Body(...),
    our_usp: str = Body(...),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Analyze competitor content using AI"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    ai_generator = AIContentGenerator()
    
    try:
        analysis = await ai_generator.analyze_competitor_content(
            competitor_content, our_brand, our_usp
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Analysis failed: {str(e)}")
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.ai.competitor_analysis",
        {"brand": our_brand}
    )
    await session.commit()
    
    return analysis


@router.get("/content/dashboard-stats")
async def get_content_dashboard_stats(
    days: int = Query(30, ge=1, le=90),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get content dashboard statistics"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    service = MarketingContentService(session)
    
    # Get recent content for stats
    filters = ContentFilters()
    pagination = PaginationParams(page=1, limit=100)
    content_items, total = await service.list_content(organization_id, filters, pagination)
    
    # Calculate statistics
    total_content = total
    ai_generated = sum(1 for c in content_items if c.ai_generated)
    published_content = sum(1 for c in content_items if c.status == "published")
    draft_content = sum(1 for c in content_items if c.status == "draft")
    
    # Performance metrics
    total_views = sum(c.performance.get("views", 0) for c in content_items)
    total_engagement = sum(c.performance.get("likes", 0) + c.performance.get("shares", 0) for c in content_items)
    avg_engagement_rate = sum(c.performance.get("engagement_rate", 0) for c in content_items) / len(content_items) if content_items else 0
    
    # Content by type
    by_type = {}
    for content in content_items:
        content_type = content.type
        if content_type not in by_type:
            by_type[content_type] = {"count": 0, "published": 0}
        by_type[content_type]["count"] += 1
        if content.status == "published":
            by_type[content_type]["published"] += 1
    
    # Top performing content
    top_content = sorted(content_items, key=lambda c: c.performance.get("engagement_rate", 0), reverse=True)[:5]
    
    return {
        "total_content": total_content,
        "ai_generated_count": ai_generated,
        "published_content": published_content,
        "draft_content": draft_content,
        "performance": {
            "total_views": total_views,
            "total_engagement": total_engagement,
            "average_engagement_rate": round(avg_engagement_rate, 2),
            "ai_content_performance": "+23% vs manual content"  # Simulated
        },
        "content_by_type": by_type,
        "top_performing": [
            {
                "id": str(c.id),
                "name": c.name,
                "type": c.type,
                "engagement_rate": c.performance.get("engagement_rate", 0),
                "views": c.performance.get("views", 0)
            } for c in top_content
        ],
        "ai_usage_stats": {
            "total_generations": ai_generated,
            "success_rate": "94%",  # Simulated
            "avg_generation_time": "3.2s",  # Simulated
            "popular_prompts": [
                "Generate promotional email",
                "Create WhatsApp campaign",
                "Write blog post intro"
            ]
        },
        "recommendations": [
            "AI-generated content shows 23% higher engagement" if ai_generated > 5 else "Try AI generation for better performance",
            "Publish more content to increase reach" if published_content < total_content * 0.5 else None,
            "Focus on video content for better engagement" if by_type.get("video", {}).get("count", 0) < 3 else None
        ]
    }


@router.get("/ai/generation-templates")
async def get_ai_generation_templates(
    user: AuthUser = Depends(_can_manage),
) -> dict:
    """Get available AI generation templates and prompts"""
    
    templates = {
        "campaign": [
            {
                "id": "awareness-campaign",
                "name": "Brand Awareness Campaign",
                "description": "Generate comprehensive brand awareness campaign content",
                "prompt_template": "Create a brand awareness campaign for {product} targeting {audience} with {tone} tone",
                "required_fields": ["product", "audience", "tone"],
                "channels": ["email", "whatsapp", "social"]
            },
            {
                "id": "product-launch",
                "name": "Product Launch Campaign",
                "description": "Launch campaign for new products or services",
                "prompt_template": "Create a product launch campaign for {product} highlighting {features} for {target_market}",
                "required_fields": ["product", "features", "target_market"],
                "channels": ["email", "whatsapp", "social", "sms"]
            }
        ],
        "broadcast": [
            {
                "id": "promotional-message",
                "name": "Promotional Message",
                "description": "Create promotional broadcast messages",
                "prompt_template": "Generate a promotional message for {offer} targeting {audience} with {urgency} urgency",
                "required_fields": ["offer", "audience", "urgency"],
                "channels": ["whatsapp", "sms", "messenger"]
            },
            {
                "id": "newsletter",
                "name": "Newsletter Content",
                "description": "Generate newsletter content and sections",
                "prompt_template": "Create newsletter content about {topic} for {audience} including {sections}",
                "required_fields": ["topic", "audience", "sections"],
                "channels": ["email"]
            }
        ],
        "seo": [
            {
                "id": "blog-post",
                "name": "SEO Blog Post",
                "description": "Generate SEO-optimized blog content",
                "prompt_template": "Write SEO blog post about {keyword} for {audience} with {word_count} words",
                "required_fields": ["keyword", "audience", "word_count"],
                "channels": ["website", "blog"]
            },
            {
                "id": "landing-page",
                "name": "Landing Page Copy",
                "description": "Create high-converting landing page content",
                "prompt_template": "Generate landing page copy for {product} targeting {keyword} with {cta} call-to-action",
                "required_fields": ["product", "keyword", "cta"],
                "channels": ["website"]
            }
        ]
    }
    
    return {
        "templates": templates,
        "ai_capabilities": [
            "Campaign content generation",
            "Multi-channel adaptation",
            "SEO optimization",
            "A/B test variations",
            "Performance optimization",
            "Competitor analysis",
            "Content calendar creation"
        ],
        "supported_tones": ["professional", "casual", "friendly", "urgent", "informative", "persuasive"],
        "supported_languages": ["English", "Hindi", "Spanish", "French", "German"],
        "generation_limits": {
            "daily_requests": 1000,
            "max_content_length": 5000,
            "concurrent_requests": 5
        }
    }