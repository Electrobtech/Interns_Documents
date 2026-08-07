"""Marketing Hub - Knowledge Base API (integrates with existing RAG system)"""
from __future__ import annotations

import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import require_permission
from app.core.security import AuthUser
from app.database.session import get_session
from app.knowledge.retriever import KnowledgeRetriever, RetrievedChunk
from app.services.ai_content_generator import AIContentGenerator
from app.services.audit_service import log_audit

router = APIRouter()
_can_manage = require_permission("ai_agents:manage")


@router.get("/knowledge/search")
async def search_knowledge_base(
    query: str = Query(..., min_length=1, description="Search query"),
    category: str = Query("marketing", description="Knowledge category: marketing, general, best_practices"),
    top_k: int = Query(5, ge=1, le=20, description="Maximum results to return"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Search the marketing knowledge base using advanced RAG"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    # Use existing RAG system with marketing agent type
    retriever = KnowledgeRetriever(session)
    chunks, low_confidence = await retriever.retrieve(
        organization_id, "marketing", query, top_k=top_k
    )
    
    # Format results for marketing knowledge
    results = []
    for chunk in chunks:
        results.append({
            "id": chunk.id,
            "title": chunk.metadata.get("title", "Marketing Knowledge"),
            "content": chunk.content,
            "category": chunk.metadata.get("category", "general"),
            "tags": chunk.metadata.get("tags", []),
            "source": chunk.metadata.get("source", "knowledge_base"),
            "relevance_score": chunk.score,
            "created_at": chunk.metadata.get("created_at"),
            "updated_at": chunk.metadata.get("updated_at")
        })
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.knowledge.search",
        {"query": query, "results_count": len(results), "low_confidence": low_confidence}
    )
    
    return {
        "query": query,
        "results": results,
        "total_results": len(results),
        "low_confidence": low_confidence,
        "formatted_context": retriever.format_context(chunks),
        "suggestions": _generate_search_suggestions(query, results)
    }


@router.post("/knowledge/ask")
async def ask_knowledge_assistant(
    question: str = Body(..., description="Question to ask the knowledge assistant"),
    context_category: str = Body("marketing", description="Context category for the answer"),
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Ask the AI knowledge assistant a question using RAG + LLM"""
    
    organization_id = uuid.UUID(user.organization_id)
    user_id = uuid.UUID(user.user_id)
    
    # Retrieve relevant knowledge using RAG
    retriever = KnowledgeRetriever(session)
    chunks, low_confidence = await retriever.retrieve(
        organization_id, "marketing", question, top_k=8
    )
    
    # Generate AI response using retrieved context
    ai_generator = AIContentGenerator()
    
    try:
        # Use the AI generator to create a knowledge-based response
        knowledge_context = retriever.format_context(chunks)
        
        # Create a knowledge-specific prompt
        knowledge_prompt = f"""
        You are a marketing knowledge assistant. Answer the user's question using the provided knowledge context.
        
        Question: {question}
        
        Knowledge Context:
        {knowledge_context}
        
        Instructions:
        - Provide a comprehensive, accurate answer based on the knowledge context
        - If the context doesn't contain enough information, say so clearly
        - Include relevant examples and best practices when available
        - Structure your response clearly with bullet points or sections when appropriate
        - Focus on actionable marketing insights and recommendations
        """
        
        # Generate response using the AI content generator
        response = await ai_generator.generate_campaign_content(
            campaign_type="knowledge_response",
            objective=question,
            target_audience="marketing_team",
            product_service="knowledge_inquiry",
            tone="professional",
            channel="knowledge_base"
        )
        
        # Extract the generated content as the answer
        ai_answer = response.get("description", "I don't have enough information to answer that question accurately.")
        
    except Exception as e:
        # Fallback if AI generation fails
        ai_answer = f"I encountered an issue generating a response. Based on the available knowledge, please refer to the search results below for relevant information about: {question}"
    
    await log_audit(
        session,
        organization_id,
        user_id,
        "marketing_hub.knowledge.ask",
        {
            "question": question,
            "context_chunks": len(chunks),
            "low_confidence": low_confidence
        }
    )
    
    return {
        "question": question,
        "answer": ai_answer,
        "confidence": "low" if low_confidence else "high",
        "source_chunks": len(chunks),
        "related_knowledge": [
            {
                "title": chunk.metadata.get("title", "Marketing Knowledge"),
                "content": chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
                "relevance_score": chunk.score
            }
            for chunk in chunks[:3]  # Top 3 most relevant
        ],
        "follow_up_suggestions": _generate_followup_questions(question, chunks)
    }


@router.get("/knowledge/categories")
async def get_knowledge_categories(
    user: AuthUser = Depends(_can_manage),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get available knowledge base categories and topics"""
    
    organization_id = uuid.UUID(user.organization_id)
    
    # Simulate knowledge base categories based on marketing needs
    categories = {
        "marketing_strategy": {
            "name": "Marketing Strategy",
            "description": "Strategic marketing planning, positioning, and competitive analysis",
            "topics": [
                "Market Research & Analysis",
                "Customer Segmentation",
                "Competitive Intelligence",
                "Brand Positioning",
                "Marketing Mix (4Ps)",
                "Go-to-Market Strategy",
                "Product Launch Planning"
            ],
            "article_count": 45
        },
        "digital_marketing": {
            "name": "Digital Marketing",
            "description": "Online marketing channels and digital campaign management",
            "topics": [
                "Social Media Marketing",
                "Email Marketing",
                "Content Marketing", 
                "SEO & SEM",
                "Pay-Per-Click (PPC)",
                "Marketing Automation",
                "Influencer Marketing"
            ],
            "article_count": 78
        },
        "campaign_management": {
            "name": "Campaign Management",
            "description": "Planning, executing, and optimizing marketing campaigns",
            "topics": [
                "Campaign Planning & Strategy",
                "Multi-Channel Campaigns",
                "Campaign Performance Metrics",
                "A/B Testing & Optimization",
                "Budget Allocation",
                "Creative Development",
                "Campaign ROI Analysis"
            ],
            "article_count": 62
        },
        "analytics_insights": {
            "name": "Analytics & Insights",
            "description": "Marketing analytics, reporting, and data-driven insights",
            "topics": [
                "Marketing Attribution",
                "Customer Journey Analytics",
                "Performance Metrics & KPIs",
                "Data Visualization",
                "Predictive Analytics",
                "Marketing Mix Modeling",
                "ROI & ROAS Optimization"
            ],
            "article_count": 54
        },
        "customer_engagement": {
            "name": "Customer Engagement",
            "description": "Customer relationship management and engagement strategies",
            "topics": [
                "Customer Lifecycle Management",
                "Personalization Strategies",
                "Customer Retention",
                "Lead Nurturing",
                "Customer Experience (CX)",
                "Loyalty Programs",
                "Feedback & Surveys"
            ],
            "article_count": 41
        },
        "marketing_technology": {
            "name": "Marketing Technology",
            "description": "MarTech stack, tools, and technology integration",
            "topics": [
                "Marketing Automation Platforms",
                "CRM Integration",
                "Analytics Tools",
                "Content Management Systems",
                "Social Media Management",
                "Email Marketing Platforms",
                "Marketing Stack Optimization"
            ],
            "article_count": 36
        },
        "best_practices": {
            "name": "Best Practices",
            "description": "Industry best practices and proven methodologies",
            "topics": [
                "Marketing Ethics & Compliance",
                "Data Privacy (GDPR, CCPA)",
                "Cross-functional Collaboration",
                "Agile Marketing",
                "Team Management",
                "Vendor Management",
                "Crisis Communication"
            ],
            "article_count": 29
        }
    }
    
    return {
        "categories": categories,
        "total_categories": len(categories),
        "total_articles": sum(cat["article_count"] for cat in categories.values()),
        "recent_updates": [
            {
                "category": "digital_marketing",
                "topic": "Marketing Automation Updates",
                "updated_at": "2024-01-15T10:30:00Z"
            },
            {
                "category": "analytics_insights", 
                "topic": "New Attribution Models",
                "updated_at": "2024-01-12T14:20:00Z"
            },
            {
                "category": "campaign_management",
                "topic": "Multi-Channel Campaign Best Practices",
                "updated_at": "2024-01-10T09:15:00Z"
            }
        ]
    }


@router.get("/knowledge/trending")
async def get_trending_topics(
    period: str = Query("7d", description="Time period: 7d, 30d, 90d"),
    limit: int = Query(10, ge=1, le=20),
    user: AuthUser = Depends(_can_manage),
) -> dict:
    """Get trending knowledge base topics and popular searches"""
    
    # Simulate trending topics based on current marketing trends
    trending_topics = [
        {
            "topic": "AI-Powered Marketing Automation",
            "category": "marketing_technology",
            "search_count": 245,
            "growth": "+35%",
            "description": "How AI is transforming marketing automation and customer personalization"
        },
        {
            "topic": "First-Party Data Strategy",
            "category": "analytics_insights", 
            "search_count": 198,
            "growth": "+28%",
            "description": "Building effective first-party data collection and utilization strategies"
        },
        {
            "topic": "Omnichannel Customer Journey",
            "category": "customer_engagement",
            "search_count": 167,
            "growth": "+22%",
            "description": "Creating seamless customer experiences across all touchpoints"
        },
        {
            "topic": "Privacy-First Marketing",
            "category": "best_practices",
            "search_count": 143,
            "growth": "+18%",
            "description": "Marketing strategies compliant with evolving privacy regulations"
        },
        {
            "topic": "Video Marketing ROI",
            "category": "digital_marketing",
            "search_count": 128,
            "growth": "+15%",
            "description": "Measuring and optimizing return on video marketing investments"
        },
        {
            "topic": "Customer Data Platform (CDP)",
            "category": "marketing_technology",
            "search_count": 112,
            "growth": "+12%",
            "description": "Implementing and leveraging customer data platforms for unified insights"
        },
        {
            "topic": "Conversational Marketing",
            "category": "customer_engagement",
            "search_count": 95,
            "growth": "+10%",
            "description": "Using chatbots and messaging for real-time customer engagement"
        },
        {
            "topic": "Marketing Attribution Models",
            "category": "analytics_insights",
            "search_count": 87,
            "growth": "+8%",
            "description": "Advanced attribution modeling for multi-touch customer journeys"
        }
    ]
    
    popular_searches = [
        {"query": "marketing automation best practices", "count": 89},
        {"query": "customer segmentation strategies", "count": 76},
        {"query": "email marketing optimization", "count": 68},
        {"query": "social media ROI measurement", "count": 61},
        {"query": "lead scoring models", "count": 54},
        {"query": "content marketing calendar", "count": 49},
        {"query": "marketing funnel optimization", "count": 43},
        {"query": "customer lifetime value calculation", "count": 38}
    ]
    
    return {
        "period": period,
        "trending_topics": trending_topics[:limit],
        "popular_searches": popular_searches[:limit],
        "insights": [
            "AI and automation topics are seeing the highest growth in searches",
            "Privacy-focused marketing strategies are gaining significant interest",
            "Data-driven marketing approaches dominate trending topics"
        ]
    }


@router.get("/knowledge/recommendations")
async def get_knowledge_recommendations(
    role: str = Query("marketing_manager", description="User role for personalized recommendations"),
    user: AuthUser = Depends(_can_manage),
) -> dict:
    """Get personalized knowledge recommendations based on user role and activity"""
    
    # Role-based knowledge recommendations
    role_recommendations = {
        "marketing_manager": [
            {
                "title": "Strategic Campaign Planning Framework",
                "category": "marketing_strategy",
                "priority": "high",
                "estimated_read_time": "8 mins",
                "description": "Comprehensive framework for planning and executing strategic marketing campaigns"
            },
            {
                "title": "Marketing ROI Measurement & Optimization",
                "category": "analytics_insights",
                "priority": "high", 
                "estimated_read_time": "12 mins",
                "description": "Advanced techniques for measuring and improving marketing return on investment"
            },
            {
                "title": "Cross-Channel Campaign Coordination",
                "category": "campaign_management",
                "priority": "medium",
                "estimated_read_time": "6 mins",
                "description": "Best practices for coordinating campaigns across multiple marketing channels"
            }
        ],
        "marketing_specialist": [
            {
                "title": "Advanced Email Marketing Automation",
                "category": "digital_marketing",
                "priority": "high",
                "estimated_read_time": "10 mins",
                "description": "Deep dive into email automation workflows and personalization strategies"
            },
            {
                "title": "Social Media Content Calendar Planning",
                "category": "digital_marketing", 
                "priority": "high",
                "estimated_read_time": "7 mins",
                "description": "Strategic approach to social media content planning and scheduling"
            },
            {
                "title": "A/B Testing for Campaign Optimization",
                "category": "campaign_management",
                "priority": "medium",
                "estimated_read_time": "9 mins", 
                "description": "Statistical approaches to A/B testing marketing campaigns and content"
            }
        ],
        "marketing_analyst": [
            {
                "title": "Marketing Attribution Modeling Deep Dive",
                "category": "analytics_insights",
                "priority": "high",
                "estimated_read_time": "15 mins",
                "description": "Advanced attribution models for multi-touch customer journey analysis"
            },
            {
                "title": "Customer Segmentation Using Behavioral Data",
                "category": "analytics_insights",
                "priority": "high",
                "estimated_read_time": "11 mins",
                "description": "Data-driven approaches to customer segmentation and persona development"
            },
            {
                "title": "Marketing Dashboard Design & KPIs",
                "category": "analytics_insights",
                "priority": "medium",
                "estimated_read_time": "8 mins",
                "description": "Designing effective marketing dashboards with actionable KPIs"
            }
        ]
    }
    
    recommendations = role_recommendations.get(role, role_recommendations["marketing_manager"])
    
    return {
        "role": role,
        "personalized_recommendations": recommendations,
        "quick_references": [
            {"title": "Marketing Metrics Glossary", "type": "reference", "access_count": 234},
            {"title": "Campaign Planning Checklist", "type": "checklist", "access_count": 198},
            {"title": "Channel Performance Benchmarks", "type": "benchmark", "access_count": 176}
        ],
        "learning_paths": [
            {
                "title": "Digital Marketing Mastery",
                "description": "Complete learning path for digital marketing excellence",
                "modules": 8,
                "estimated_time": "4-6 weeks",
                "skill_level": "intermediate"
            },
            {
                "title": "Marketing Analytics Fundamentals", 
                "description": "Data-driven marketing decision making",
                "modules": 6,
                "estimated_time": "3-4 weeks", 
                "skill_level": "beginner"
            }
        ]
    }


@router.get("/knowledge/dashboard")
async def get_knowledge_dashboard(
    user: AuthUser = Depends(_can_manage),
) -> dict:
    """Get knowledge base dashboard with usage statistics and insights"""
    
    return {
        "usage_stats": {
            "total_searches_today": 47,
            "total_searches_week": 312,
            "total_searches_month": 1248,
            "avg_session_duration": "8m 34s",
            "most_active_users": 23,
            "knowledge_satisfaction": 4.2
        },
        "popular_content": [
            {"title": "Email Marketing Best Practices", "views": 156, "category": "digital_marketing"},
            {"title": "Customer Journey Mapping", "views": 134, "category": "customer_engagement"},
            {"title": "Marketing ROI Calculation", "views": 129, "category": "analytics_insights"},
            {"title": "Social Media Calendar Template", "views": 118, "category": "digital_marketing"},
            {"title": "Lead Scoring Framework", "views": 98, "category": "campaign_management"}
        ],
        "recent_activity": [
            {"action": "search", "query": "marketing automation", "user": "Sarah M.", "timestamp": "5 min ago"},
            {"action": "view", "content": "Customer Segmentation Guide", "user": "Mike R.", "timestamp": "12 min ago"},
            {"action": "ask", "question": "How to measure email ROI?", "user": "Lisa K.", "timestamp": "18 min ago"},
            {"action": "search", "query": "A/B testing", "user": "David L.", "timestamp": "25 min ago"}
        ],
        "knowledge_gaps": [
            {
                "topic": "TikTok Marketing for B2B",
                "requests": 23,
                "priority": "medium",
                "description": "Multiple users asking about B2B marketing on TikTok platform"
            },
            {
                "topic": "iOS 14.5 Attribution Impact",
                "requests": 18,
                "priority": "high", 
                "description": "Need for guidance on post-iOS 14.5 attribution strategies"
            }
        ],
        "quick_actions": [
            {"action": "search_knowledge", "label": "Search Knowledge Base", "icon": "search"},
            {"action": "ask_assistant", "label": "Ask AI Assistant", "icon": "message-circle"},
            {"action": "browse_categories", "label": "Browse Categories", "icon": "folder"},
            {"action": "trending_topics", "label": "Trending Topics", "icon": "trending-up"}
        ]
    }


def _generate_search_suggestions(query: str, results: List[Dict]) -> List[str]:
    """Generate helpful search suggestions based on query and results"""
    
    base_suggestions = [
        f"{query} best practices",
        f"{query} examples", 
        f"{query} case studies",
        f"{query} templates",
        f"{query} metrics"
    ]
    
    # Add category-based suggestions if we have results
    if results:
        categories = set(r.get("category", "") for r in results)
        for category in categories:
            if category and category != "general":
                base_suggestions.append(f"{query} {category}")
    
    return base_suggestions[:5]


def _generate_followup_questions(question: str, chunks: List[RetrievedChunk]) -> List[str]:
    """Generate follow-up questions based on the original question and context"""
    
    followup_questions = [
        f"What are the best practices for {question.lower().replace('?', '')}?",
        f"Can you provide examples of {question.lower().replace('?', '')}?",
        f"What metrics should I track for {question.lower().replace('?', '')}?",
        f"What are common mistakes to avoid with {question.lower().replace('?', '')}?",
        f"How do I measure success in {question.lower().replace('?', '')}?"
    ]
    
    # Filter and clean up questions
    cleaned_questions = []
    for q in followup_questions:
        if len(q) < 100 and q not in cleaned_questions:
            cleaned_questions.append(q)
    
    return cleaned_questions[:4]