-- =====================================================================
-- Seed data for SEO, AEO, and Competitor Analytics
-- Organization: Electrobtech Innovations (11111111-1111-1111-1111-111111111111)
-- =====================================================================

-- ---------- SEO Keywords (at least 5 entries) ----------
INSERT INTO mh_seo_keywords (organization_id, keyword, search_volume, difficulty, current_rank, target_rank, url, competition, cpc, trend_data, last_checked)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'digital marketing services', 12000, 65, 12, 5, 'https://electrobtech.com/services/digital-marketing', 0.72, 8.50, '{"jan": 9500, "feb": 10500, "mar": 11200, "apr": 11800, "may": 12000, "jun": 12500}', now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111111', 'lead generation software', 8500, 58, 8, 3, 'https://electrobtech.com/products/lead-gen', 0.65, 12.30, '{"jan": 7200, "feb": 7800, "mar": 8100, "apr": 8300, "may": 8500, "jun": 8700}', now() - interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 'marketing automation tools', 15000, 72, 15, 7, 'https://electrobtech.com/solutions/automation', 0.78, 15.75, '{"jan": 13000, "feb": 14000, "mar": 14500, "apr": 14800, "may": 15000, "jun": 15200}', now() - interval '3 days'),
  ('11111111-1111-1111-1111-111111111111', 'CRM integration', 6200, 45, 5, 2, 'https://electrobtech.com/integrations/crm', 0.52, 6.80, '{"jan": 5500, "feb": 5800, "mar": 6000, "apr": 6100, "may": 6200, "jun": 6300}', now() - interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 'business intelligence solutions', 4800, 52, 18, 10, 'https://electrobtech.com/analytics/bi', 0.58, 9.20, '{"jan": 4200, "feb": 4500, "mar": 4600, "apr": 4700, "may": 4800, "jun": 4900}', now() - interval '4 days'),
  ('11111111-1111-1111-1111-111111111111', 'sales funnel optimization', 3200, 38, 3, 1, 'https://electrobtech.com/guides/sales-funnel', 0.42, 5.50, '{"jan": 2800, "feb": 2900, "mar": 3000, "apr": 3100, "may": 3200, "jun": 3250}', now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111111', 'customer engagement platform', 9500, 68, 22, 8, 'https://electrobtech.com/platform/engagement', 0.70, 11.40, '{"jan": 8200, "feb": 8600, "mar": 8900, "apr": 9200, "may": 9500, "jun": 9700}', now() - interval '5 days')
ON CONFLICT DO NOTHING;

-- ---------- SEO Audits (at least 5 entries) ----------
INSERT INTO mh_seo_audits (organization_id, url, audit_type, score, issues, recommendations, audit_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'https://electrobtech.com', 'technical', 78, 
   '[{"severity": "high", "issue": "Missing meta descriptions on 3 pages"}, {"severity": "medium", "issue": "Slow page load time on mobile"}, {"severity": "low", "issue": "Broken links detected"}]',
   '[{"priority": "high", "action": "Add meta descriptions to all pages"}, {"priority": "medium", "action": "Optimize images and enable compression"}, {"priority": "low", "action": "Fix broken internal links"}]',
   '{"pages_crawled": 45, "pages_with_errors": 8, "avg_load_time": 3.2, "mobile_score": 72}'),
  ('11111111-1111-1111-1111-111111111111', 'https://electrobtech.com/blog', 'content', 85,
   '[{"severity": "medium", "issue": "Thin content on 5 blog posts"}, {"severity": "low", "issue": "Missing alt tags on images"}]',
   '[{"priority": "medium", "action": "Expand blog posts to minimum 800 words"}, {"priority": "low", "action": "Add descriptive alt text to all images"}]',
   '{"total_posts": 32, "avg_word_count": 650, "keyword_density": 2.1}'),
  ('11111111-1111-1111-1111-111111111111', 'https://electrobtech.com/services', 'backlinks', 62,
   '[{"severity": "high", "issue": "Low domain authority"}, {"severity": "medium", "issue": "Few quality backlinks"}]',
   '[{"priority": "high", "action": "Build relationships with industry blogs"}, {"priority": "medium", "action": "Create shareable infographics"}]',
   '{"total_backlinks": 142, "referring_domains": 38, "domain_authority": 28}'),
  ('11111111-1111-1111-1111-111111111111', 'https://electrobtech.com/products', 'performance', 71,
   '[{"severity": "medium", "issue": "Large image files slowing load time"}, {"severity": "medium", "issue": "No CDN configured"}]',
   '[{"priority": "medium", "action": "Compress and optimize product images"}, {"priority": "medium", "action": "Implement CDN for static assets"}]',
   '{"lighthouse_score": 71, "first_contentful_paint": 2.8, "largest_contentful_paint": 4.2}'),
  ('11111111-1111-1111-1111-111111111111', 'https://electrobtech.com/about', 'technical', 88,
   '[{"severity": "low", "issue": "Minor HTML validation errors"}]',
   '[{"priority": "low", "action": "Fix HTML validation warnings"}]',
   '{"pages_crawled": 1, "validation_errors": 3, "accessibility_score": 92}')
ON CONFLICT DO NOTHING;

-- ---------- AEO Optimization (at least 5 entries) ----------
INSERT INTO mh_aeo_optimization (organization_id, query, answer_type, current_content, optimized_content, optimization_tips, performance, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'how to improve lead generation', 'featured_snippet', 
   'Lead generation can be improved through various marketing strategies...',
   'To improve lead generation, implement these 5 proven strategies: 1) Create targeted landing pages, 2) Use lead magnets like ebooks, 3) Optimize forms for conversion, 4) Implement email nurturing sequences, 5) Use retargeting ads. Our data shows these tactics can increase leads by 40%.',
 '["Use numbered lists for structure", "Include specific statistics", "Add a clear call-to-action"]'::jsonb,
   '{"impressions": 4500, "clicks": 890, "ctr": 19.8, "position": 1.2}', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'best marketing automation tools', 'featured_snippet',
   'There are many marketing automation tools available in the market...',
   'The best marketing automation tools for 2024 include: 1) HubSpot for all-in-one marketing, 2) Marketo for enterprise B2B, 3) Pardot for Salesforce integration, 4) ActiveCampaign for small businesses, 5) Mailchimp for email marketing. Each tool offers unique features for different business needs.',
 '["Include current year for freshness", "Categorize by business size", "Add comparison criteria"]'::jsonb,
   '{"impressions": 3200, "clicks": 640, "ctr": 20.0, "position": 1.5}', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'digital marketing agency near me', 'local_pack',
   'We are a digital marketing agency serving clients nationwide...',
   'Electrobtech Innovations is a top-rated digital marketing agency located in Mumbai, serving businesses across India. Services include SEO, PPC, social media marketing, and web development. Contact: +91-22-1234-5678 | Rating: 4.8/5 based on 150+ reviews.',
 '["Include local phone number", "Add customer ratings", "Mention service area"]'::jsonb,
   '{"impressions": 1800, "clicks": 420, "ctr": 23.3, "position": 2.1}', 'monitoring'),
  ('11111111-1111-1111-1111-111111111111', 'what is CRM integration', 'knowledge_panel',
   'CRM integration refers to connecting customer relationship management systems...',
   'CRM integration is the process of connecting your CRM software with other business applications to create a unified customer data ecosystem. Benefits include: 360-degree customer view, automated data sync, improved sales productivity, better customer insights, and reduced manual data entry.',
 '["Define the concept clearly", "List key benefits", "Use simple language"]'::jsonb,
   '{"impressions": 2100, "clicks": 380, "ctr": 18.1, "position": 3.5}', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'sales funnel examples', 'featured_snippet',
   'Sales funnels help convert prospects into customers...',
   '5 Effective Sales Funnel Examples: 1) Awareness Stage - Blog posts & social media content, 2) Interest Stage - Lead magnets & webinars, 3) Consideration Stage - Case studies & demos, 4) Intent Stage - Free trials & consultations, 5) Evaluation Stage - Comparison guides & pricing pages. Each stage nurtures leads toward conversion.',
 '["Use stage-by-stage breakdown", "Include concrete examples", "Add visual structure indicators"]'::jsonb,
   '{"impressions": 2800, "clicks": 560, "ctr": 20.0, "position": 1.8}', 'monitoring'),
  ('11111111-1111-1111-1111-111111111111', 'marketing automation benefits', 'featured_snippet',
   'Marketing automation offers several advantages for businesses...',
   'Top 7 Marketing Automation Benefits: 1) Save 10+ hours weekly on repetitive tasks, 2) Increase lead conversion by 20%, 3) Improve customer retention with personalized journeys, 4) Better ROI on marketing campaigns, 5) Enhanced lead scoring accuracy, 6) Streamlined sales and marketing alignment, 7) Data-driven decision making.',
 '["Use specific statistics", "Number the benefits clearly", "Focus on business outcomes"]'::jsonb,
   '{"impressions": 1900, "clicks": 410, "ctr": 21.6, "position": 1.3}', 'completed')
ON CONFLICT DO NOTHING;

-- ---------- Competitors (at least 5 entries) ----------
INSERT INTO mh_competitors (organization_id, name, domain, industry, channels, tracking_keywords, social_handles, metadata, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'TechGrowth Solutions', 'techgrowth.com', 'Marketing Technology', 
   ARRAY['website', 'linkedin', 'twitter', 'facebook'], 
   ARRAY['marketing automation', 'lead generation', 'CRM integration', 'digital marketing'],
   '{"linkedin": "techgrowth-solutions", "twitter": "@techgrowth", "facebook": "TechGrowthSolutions"}',
   '{"founded": 2018, "employees": 150, "funding": "Series B", "market_cap": null}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'MarketPro Digital', 'marketpro.com', 'Digital Marketing Agency',
   ARRAY['website', 'linkedin', 'instagram', 'youtube'],
   ARRAY['digital marketing services', 'SEO services', 'PPC advertising', 'social media marketing'],
   '{"linkedin": "marketpro-digital", "instagram": "@marketpro", "youtube": "MarketProDigital"}',
   '{"founded": 2015, "employees": 200, "funding": "Bootstrapped", "market_cap": null}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'SalesForce Plus', 'salesforceplus.com', 'CRM & Sales Tools',
   ARRAY['website', 'linkedin', 'twitter'],
   ARRAY['CRM software', 'sales automation', 'customer engagement', 'sales pipeline'],
   '{"linkedin": "salesforce-plus", "twitter": "@salesforceplus"}',
   '{"founded": 2016, "employees": 300, "funding": "Series C", "market_cap": null}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'LeadGenius Inc', 'leadgenius.com', 'Lead Generation Platform',
   ARRAY['website', 'linkedin', 'facebook', 'twitter'],
   ARRAY['lead generation software', 'B2B lead generation', 'prospecting tools', 'email outreach'],
   '{"linkedin": "leadgenius-inc", "twitter": "@leadgenius", "facebook": "LeadGeniusInc"}',
   '{"founded": 2017, "employees": 120, "funding": "Series A", "market_cap": null}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'AutomateHub', 'automatehub.com', 'Marketing Automation',
   ARRAY['website', 'linkedin', 'youtube', 'twitter'],
   ARRAY['marketing automation', 'workflow automation', 'email marketing automation', 'campaign management'],
   '{"linkedin": "automatehub", "youtube": "AutomateHubChannel", "twitter": "@automatehub"}',
   '{"founded": 2019, "employees": 80, "funding": "Seed", "market_cap": null}',
   true),
  ('11111111-1111-1111-1111-111111111111', 'ConversionMax', 'conversionmax.com', 'Conversion Optimization',
   ARRAY['website', 'linkedin', 'blog'],
   ARRAY['conversion rate optimization', 'landing page optimization', 'A/B testing', 'sales funnel'],
   '{"linkedin": "conversionmax", "blog": "blog.conversionmax.com"}',
   '{"founded": 2020, "employees": 45, "funding": "Bootstrapped", "market_cap": null}',
   true)
ON CONFLICT DO NOTHING;

-- ---------- Competitor Analysis (at least 5 entries) ----------
INSERT INTO mh_competitor_analysis (competitor_id, analysis_type, metrics, insights, recommendations, analysis_date)
SELECT 
  c.id,
  v.analysis_type,
  v.metrics::jsonb,
  v.insights::jsonb,
  v.recommendations,
  now() - (v.days_ago || ' days')::interval
FROM mh_competitors c
CROSS JOIN (VALUES
  ('TechGrowth Solutions', 'seo', '{"organic_traffic": 45000, "avg_position": 8.5, "backlinks": 5200, "domain_authority": 45}', '{"strength": "Strong content strategy", "weakness": "Low mobile optimization"}', ARRAY['Improve mobile page speed', 'Build more backlinks', 'Optimize for featured snippets']::text[], 5),
  ('TechGrowth Solutions', 'content', '{"blog_posts": 180, "avg_word_count": 1200, "social_shares": 25000, "engagement_rate": 3.8}', '{"strength": "High-quality long-form content", "weakness": "Low video content"}', ARRAY['Add more video content', 'Increase publishing frequency', 'Improve social promotion']::text[], 10),
  ('MarketPro Digital', 'seo', '{"organic_traffic": 62000, "avg_position": 6.2, "backlinks": 8900, "domain_authority": 52}', '{"strength": "High domain authority", "weakness": "Slow page load times"}', ARRAY['Optimize page speed', 'Target long-tail keywords', 'Improve technical SEO']::text[], 3),
  ('MarketPro Digital', 'social', '{"followers": 45000, "avg_engagement": 4.2, "post_frequency": 5, "reach": 120000}', '{"strength": "High engagement rate", "weakness": "Low LinkedIn presence"}', ARRAY['Increase LinkedIn activity', 'Use more video content', 'Run social ads']::text[], 7),
  ('SalesForce Plus', 'seo', '{"organic_traffic": 38000, "avg_position": 12.5, "backlinks": 3200, "domain_authority": 38}', '{"strength": "Good technical SEO", "weakness": "Thin content"}', ARRAY['Expand content depth', 'Build more backlinks', 'Improve keyword targeting']::text[], 12),
  ('SalesForce Plus', 'features', '{"total_features": 45, "unique_features": 12, "integration_count": 35, "pricing_tier": 5}', '{"strength": "Wide integration ecosystem", "weakness": "Complex pricing structure"}', ARRAY['Simplify pricing tiers', 'Highlight unique features', 'Improve onboarding experience']::text[], 8),
  ('LeadGenius Inc', 'seo', '{"organic_traffic": 28000, "avg_position": 15.8, "backlinks": 2100, "domain_authority": 32}', '{"strength": "Niche keyword targeting", "weakness": "Low content volume"}', ARRAY['Increase content production', 'Build authority backlinks', 'Expand keyword coverage']::text[], 15),
  ('LeadGenius Inc', 'ads', '{"ad_spend": 25000, "impressions": 1500000, "clicks": 45000, "conversion_rate": 2.8}', '{"strength": "High ad spend efficiency", "weakness": "Limited ad creative variety"}', ARRAY['Test more ad creatives', 'Expand to new channels', 'Optimize landing pages']::text[], 6),
  ('AutomateHub', 'seo', '{"organic_traffic": 15000, "avg_position": 18.2, "backlinks": 950, "domain_authority": 25}', '{"strength": "Fast-growing startup", "weakness": "Low domain authority"}', ARRAY['Focus on content marketing', 'Build strategic partnerships', 'Invest in PR']::text[], 20),
  ('AutomateHub', 'pricing', '{"starting_price": 49, "avg_contract_value": 1200, "discount_offered": 15, "free_trial": 14}', '{"strength": "Competitive pricing", "weakness": "Low average contract value"}', ARRAY['Introduce enterprise tier', 'Add annual discount', 'Improve upselling strategy']::text[], 4),
  ('ConversionMax', 'seo', '{"organic_traffic": 12000, "avg_position": 22.5, "backlinks": 680, "domain_authority": 22}', '{"strength": "Strong niche focus", "weakness": "Limited brand awareness"}', ARRAY['Increase brand visibility', 'Guest blog on industry sites', 'Leverage case studies']::text[], 25),
  ('ConversionMax', 'content', '{"blog_posts": 65, "avg_word_count": 1800, "social_shares": 8500, "engagement_rate": 5.1}', '{"strength": "Very high engagement rate", "weakness": "Low content volume"}', ARRAY['Increase publishing frequency', 'Repurpose content for social', 'Build email newsletter']::text[], 9)
) AS v(company, analysis_type, metrics, insights, recommendations, days_ago)
WHERE c.name = v.company
ON CONFLICT DO NOTHING;
