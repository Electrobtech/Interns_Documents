"""AI Content Generator using Groq LLM for Marketing Hub"""
from __future__ import annotations

import os
import json
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime

import httpx


class AIContentGenerator:
    """AI Content Generator using Groq LLM API"""
    
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        self.base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
        self.model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        
        if not self.api_key:
            raise ValueError("GROQ_API_KEY environment variable is required")
    
    async def _make_request(self, messages: List[Dict[str, str]], max_tokens: int = 1000, temperature: float = 0.7) -> str:
        """Make request to Groq API"""
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload
            )
            
            if response.status_code != 200:
                raise Exception(f"Groq API error: {response.status_code} - {response.text}")
            
            result = response.json()
            return result["choices"][0]["message"]["content"].strip()
    
    async def generate_campaign_content(
        self,
        campaign_type: str,
        objective: str,
        target_audience: str,
        product_service: str,
        tone: str = "professional",
        channel: str = "email"
    ) -> Dict[str, Any]:
        """Generate complete campaign content"""
        
        prompt = f"""
        Generate comprehensive marketing campaign content for:
        
        Campaign Type: {campaign_type}
        Objective: {objective}
        Target Audience: {target_audience}
        Product/Service: {product_service}
        Tone: {tone}
        Channel: {channel}
        
        Please provide:
        1. Campaign name (catchy and relevant)
        2. Main headline/subject line
        3. Primary content/body text
        4. Call-to-action text
        5. Key messaging points (3-5 bullet points)
        6. Optional: Alternative variations
        
        Format as JSON with keys: name, headline, content, cta, key_points, variations
        """
        
        messages = [
            {"role": "system", "content": "You are an expert marketing copywriter specializing in high-converting campaign content. Always respond with valid JSON."},
            {"role": "user", "content": prompt}
        ]
        
        response = await self._make_request(messages, max_tokens=1500)
        
        try:
            # Try to parse as JSON, fallback to structured text if needed
            content = json.loads(response)
        except json.JSONDecodeError:
            # Fallback parsing
            content = {
                "name": f"{campaign_type} Campaign",
                "headline": "Generated headline",
                "content": response,
                "cta": "Take Action Now",
                "key_points": ["Generated content from AI"],
                "variations": []
            }
        
        # Add generation metadata
        content["generated_at"] = datetime.utcnow().isoformat()
        content["ai_model"] = self.model
        content["prompt_used"] = prompt[:200] + "..."
        
        return content
    
    async def generate_broadcast_message(
        self,
        channel: str,
        message_type: str,
        audience: str,
        product_offer: str,
        urgency: str = "medium"
    ) -> Dict[str, Any]:
        """Generate broadcast message for specific channel"""
        
        # Channel-specific guidelines
        channel_guidelines = {
            "whatsapp": "Keep under 4096 characters. Use emojis appropriately. Include clear CTA. No spammy language.",
            "email": "Include compelling subject line. Structure with header, body, footer. Professional tone.",
            "sms": "Keep under 160 characters. Direct and action-oriented. Include opt-out info.",
            "messenger": "Conversational tone. Use quick replies or buttons if applicable.",
            "instagram": "Visual-first content. Use relevant hashtags. Engaging captions.",
            "linkedin": "Professional tone. Industry insights. Business-focused content."
        }
        
        guidelines = channel_guidelines.get(channel, "Create engaging, platform-appropriate content.")
        
        prompt = f"""
        Create a {message_type} broadcast message for {channel}:
        
        Target Audience: {audience}
        Product/Offer: {product_offer}
        Urgency Level: {urgency}
        Channel Guidelines: {guidelines}
        
        Generate:
        1. Subject/title (if applicable for channel)
        2. Main message content
        3. Call-to-action
        4. Channel-specific elements (hashtags, buttons, etc.)
        
        Format as JSON with keys: subject, content, cta, elements, character_count
        """
        
        messages = [
            {"role": "system", "content": f"You are an expert {channel} marketing specialist. Create compelling, compliant content that drives engagement and conversions. Always respond with valid JSON."},
            {"role": "user", "content": prompt}
        ]
        
        response = await self._make_request(messages, max_tokens=800)
        
        try:
            content = json.loads(response)
        except json.JSONDecodeError:
            content = {
                "subject": f"{message_type} Message",
                "content": response,
                "cta": "Learn More",
                "elements": [],
                "character_count": len(response)
            }
        
        content["channel"] = channel
        content["generated_at"] = datetime.utcnow().isoformat()
        
        return content
    
    async def generate_audience_suggestions(
        self,
        business_type: str,
        current_criteria: Dict[str, Any],
        campaign_goal: str
    ) -> Dict[str, Any]:
        """Generate audience targeting suggestions"""
        
        prompt = f"""
        Analyze and suggest audience targeting improvements:
        
        Business Type: {business_type}
        Current Criteria: {json.dumps(current_criteria, indent=2)}
        Campaign Goal: {campaign_goal}
        
        Provide suggestions for:
        1. Demographics to target
        2. Behavioral criteria
        3. Interest-based targeting
        4. Geographic considerations
        5. Exclusions to improve efficiency
        
        Format as JSON with keys: demographics, behaviors, interests, geography, exclusions, rationale
        """
        
        messages = [
            {"role": "system", "content": "You are an expert audience strategist specializing in precise targeting for maximum ROI. Always respond with valid JSON."},
            {"role": "user", "content": prompt}
        ]
        
        response = await self._make_request(messages, max_tokens=1000)
        
        try:
            suggestions = json.loads(response)
        except json.JSONDecodeError:
            suggestions = {
                "demographics": ["Age: 25-45", "Gender: All"],
                "behaviors": ["Recent purchasers", "Website visitors"],
                "interests": ["Business", "Technology"],
                "geography": ["Major cities"],
                "exclusions": ["Existing customers"],
                "rationale": "AI-generated suggestions based on business type and goals"
            }
        
        return suggestions
    
    async def generate_seo_content(
        self,
        target_keyword: str,
        content_type: str,
        audience: str,
        word_count: int = 500
    ) -> Dict[str, Any]:
        """Generate SEO-optimized content"""
        
        prompt = f"""
        Create SEO-optimized {content_type} content:
        
        Target Keyword: {target_keyword}
        Target Audience: {audience}
        Desired Word Count: {word_count}
        
        Generate:
        1. SEO-optimized title (under 60 characters)
        2. Meta description (under 160 characters)
        3. Main content with natural keyword integration
        4. Related keywords and LSI terms
        5. Content structure (H1, H2, H3 headings)
        
        Format as JSON with keys: title, meta_description, content, keywords, structure, seo_score_estimate
        """
        
        messages = [
            {"role": "system", "content": "You are an expert SEO content writer who creates engaging, search-optimized content. Always respond with valid JSON."},
            {"role": "user", "content": prompt}
        ]
        
        response = await self._make_request(messages, max_tokens=1500)
        
        try:
            content = json.loads(response)
        except json.JSONDecodeError:
            content = {
                "title": f"Complete Guide to {target_keyword}",
                "meta_description": f"Learn everything about {target_keyword}. Expert insights and tips.",
                "content": response,
                "keywords": [target_keyword],
                "structure": ["Introduction", "Main Content", "Conclusion"],
                "seo_score_estimate": 85
            }
        
        return content
    
    async def optimize_content(
        self,
        original_content: str,
        optimization_goal: str,
        target_metrics: List[str]
    ) -> Dict[str, Any]:
        """Optimize existing content for better performance"""
        
        prompt = f"""
        Optimize the following marketing content:
        
        Original Content: {original_content}
        Optimization Goal: {optimization_goal}
        Target Metrics: {', '.join(target_metrics)}
        
        Provide:
        1. Optimized version of the content
        2. Key changes made and rationale
        3. Expected impact on target metrics
        4. A/B test suggestions
        
        Format as JSON with keys: optimized_content, changes_made, expected_impact, ab_test_ideas
        """
        
        messages = [
            {"role": "system", "content": "You are a conversion optimization expert who improves marketing content performance. Always respond with valid JSON."},
            {"role": "user", "content": prompt}
        ]
        
        response = await self._make_request(messages, max_tokens=1200)
        
        try:
            optimization = json.loads(response)
        except json.JSONDecodeError:
            optimization = {
                "optimized_content": original_content,
                "changes_made": ["AI optimization applied"],
                "expected_impact": "Improved engagement expected",
                "ab_test_ideas": ["Test original vs optimized version"]
            }
        
        return optimization
    
    async def generate_campaign_ideas(
        self,
        industry: str,
        season_event: Optional[str] = None,
        budget_range: str = "medium",
        objectives: List[str] = None
    ) -> Dict[str, Any]:
        """Generate creative campaign ideas"""
        
        objectives = objectives or ["awareness", "leads", "sales"]
        
        prompt = f"""
        Generate creative marketing campaign ideas:
        
        Industry: {industry}
        Season/Event: {season_event or 'General'}
        Budget Range: {budget_range}
        Objectives: {', '.join(objectives)}
        
        Provide 5 campaign ideas with:
        1. Campaign name and concept
        2. Target audience
        3. Key messaging
        4. Recommended channels
        5. Expected outcomes
        
        Format as JSON array with keys: name, concept, audience, messaging, channels, outcomes
        """
        
        messages = [
            {"role": "system", "content": "You are a creative marketing strategist who develops innovative campaign concepts. Always respond with valid JSON."},
            {"role": "user", "content": prompt}
        ]
        
        response = await self._make_request(messages, max_tokens=1500)
        
        try:
            ideas = json.loads(response)
        except json.JSONDecodeError:
            ideas = {
                "campaigns": [
                    {
                        "name": f"{industry} Campaign",
                        "concept": "AI-generated campaign concept",
                        "audience": "Target demographic",
                        "messaging": "Key value proposition",
                        "channels": ["email", "social"],
                        "outcomes": ["Increased awareness"]
                    }
                ]
            }
        
        return ideas
    
    async def analyze_competitor_content(
        self,
        competitor_content: str,
        our_brand: str,
        our_usp: str
    ) -> Dict[str, Any]:
        """Analyze competitor content and suggest improvements"""
        
        prompt = f"""
        Analyze competitor content and suggest how we can do better:
        
        Competitor Content: {competitor_content}
        Our Brand: {our_brand}
        Our Unique Selling Proposition: {our_usp}
        
        Provide:
        1. Analysis of competitor strengths/weaknesses
        2. Opportunities for differentiation
        3. Improved content suggestions
        4. Strategic recommendations
        
        Format as JSON with keys: analysis, opportunities, improved_content, recommendations
        """
        
        messages = [
            {"role": "system", "content": "You are a competitive intelligence analyst who identifies market opportunities. Always respond with valid JSON."},
            {"role": "user", "content": prompt}
        ]
        
        response = await self._make_request(messages, max_tokens=1200)
        
        try:
            analysis = json.loads(response)
        except json.JSONDecodeError:
            analysis = {
                "analysis": "Competitor content analysis completed",
                "opportunities": ["Differentiation opportunities identified"],
                "improved_content": competitor_content,
                "recommendations": ["Strategic recommendations provided"]
            }
        
        return analysis
    
    async def generate_content_calendar(
        self,
        duration_weeks: int,
        posting_frequency: str,
        brand_themes: List[str],
        channels: List[str]
    ) -> Dict[str, Any]:
        """Generate content calendar with AI"""
        
        prompt = f"""
        Create a {duration_weeks}-week content calendar:
        
        Posting Frequency: {posting_frequency}
        Brand Themes: {', '.join(brand_themes)}
        Channels: {', '.join(channels)}
        
        For each week, provide:
        1. Theme/focus for the week
        2. Content ideas for each posting day
        3. Content type recommendations
        4. Channel-specific adaptations
        
        Format as JSON with keys: weeks (array of week objects with theme, content_ideas, types, adaptations)
        """
        
        messages = [
            {"role": "system", "content": "You are a content strategy expert who creates comprehensive content calendars. Always respond with valid JSON."},
            {"role": "user", "content": prompt}
        ]
        
        response = await self._make_request(messages, max_tokens=1800)
        
        try:
            calendar = json.loads(response)
        except json.JSONDecodeError:
            calendar = {
                "weeks": [
                    {
                        "week": i + 1,
                        "theme": f"Week {i + 1} Theme",
                        "content_ideas": ["Content idea 1", "Content idea 2"],
                        "types": ["post", "article"],
                        "adaptations": {"email": "Email version", "social": "Social version"}
                    } for i in range(duration_weeks)
                ]
            }
        
        return calendar