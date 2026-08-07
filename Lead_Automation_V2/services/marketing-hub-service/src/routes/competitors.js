const express = require('express');
const { authenticate, requirePermission } = require('@lead/shared');
const { withTenantScope } = require('../middleware/tenant');
const { query } = require('../database');

const router = express.Router();

// Get all competitors
router.get('/', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { industry, is_active, limit = 50, offset = 0 } = req.query;
    
    let query_str = 'SELECT * FROM mh_competitors WHERE organization_id = $1';
    const params = [req.organizationId];
    let paramCount = 1;
    
    if (industry) {
      query_str += ` AND industry = $${++paramCount}`;
      params.push(industry);
    }
    
    if (is_active !== undefined) {
      query_str += ` AND is_active = $${++paramCount}`;
      params.push(is_active === 'true');
    }
    
    query_str += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(query_str, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching competitors:', error);
    res.status(500).json({ error: 'Failed to fetch competitors' });
  }
});

// Add new competitor
router.post('/', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { name, domain, industry, channels, tracking_keywords, social_handles, metadata } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const result = await query(
      `INSERT INTO mh_competitors (organization_id, name, domain, industry, channels, 
                                  tracking_keywords, social_handles, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.organizationId, name, domain, industry, channels || [],
        tracking_keywords || [], JSON.stringify(social_handles || {}),
        JSON.stringify(metadata || {})
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding competitor:', error);
    res.status(500).json({ error: 'Failed to add competitor' });
  }
});

// Get competitor by ID
router.get('/:id', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM mh_competitors WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Competitor not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching competitor:', error);
    res.status(500).json({ error: 'Failed to fetch competitor' });
  }
});

// Update competitor
router.put('/:id', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { name, domain, industry, channels, tracking_keywords, social_handles, metadata, is_active } = req.body;
    
    const result = await query(
      `UPDATE mh_competitors 
       SET name = $1, domain = $2, industry = $3, channels = $4, tracking_keywords = $5,
           social_handles = $6, metadata = $7, is_active = $8, updated_at = now()
       WHERE id = $9 AND organization_id = $10
       RETURNING *`,
      [
        name, domain, industry, channels, tracking_keywords,
        JSON.stringify(social_handles), JSON.stringify(metadata), is_active,
        req.params.id, req.organizationId
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Competitor not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating competitor:', error);
    res.status(500).json({ error: 'Failed to update competitor' });
  }
});
// Delete competitor
router.delete('/:id', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM mh_competitors WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Competitor not found' });
    }
    
    res.json({ message: 'Competitor deleted successfully' });
  } catch (error) {
    console.error('Error deleting competitor:', error);
    res.status(500).json({ error: 'Failed to delete competitor' });
  }
});

// Get competitor analysis
router.get('/:id/analysis', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { analysis_type } = req.query;
    
    let query_str = `SELECT ca.* FROM mh_competitor_analysis ca 
                    JOIN mh_competitors c ON c.id = ca.competitor_id
                    WHERE c.id = $1 AND c.organization_id = $2`;
    const params = [req.params.id, req.organizationId];
    let paramCount = 2;
    
    if (analysis_type) {
      query_str += ` AND ca.analysis_type = $${++paramCount}`;
      params.push(analysis_type);
    }
    
    query_str += ` ORDER BY ca.analysis_date DESC`;
    
    const result = await query(query_str, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching competitor analysis:', error);
    res.status(500).json({ error: 'Failed to fetch competitor analysis' });
  }
});

// Create competitor analysis
router.post('/:id/analysis', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { analysis_type } = req.body;
    
    if (!analysis_type) {
      return res.status(400).json({ error: 'Analysis type is required' });
    }
    
    // Check if competitor exists and belongs to organization
    const competitorCheck = await query(
      'SELECT id FROM mh_competitors WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
    );
    
    if (competitorCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Competitor not found' });
    }
    
    // Generate analysis data
    const analysisData = await generateCompetitorAnalysis(req.params.id, analysis_type);
    
    const result = await query(
      `INSERT INTO mh_competitor_analysis (competitor_id, analysis_type, metrics, insights, recommendations)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        req.params.id, analysis_type, JSON.stringify(analysisData.metrics),
        JSON.stringify(analysisData.insights), analysisData.recommendations
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating competitor analysis:', error);
    res.status(500).json({ error: 'Failed to create competitor analysis' });
  }
});

// Get competitive overview
router.get('/overview/dashboard', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    // Get competitors count
    const competitorsCount = await query(
      'SELECT COUNT(*) as total, COUNT(CASE WHEN is_active THEN 1 END) as active FROM mh_competitors WHERE organization_id = $1',
      [req.organizationId]
    );
    
    // Get recent analysis
    const recentAnalysis = await query(
      `SELECT ca.analysis_type, COUNT(*) as count, AVG(array_length(ca.recommendations, 1)) as avg_recommendations
       FROM mh_competitor_analysis ca
       JOIN mh_competitors c ON c.id = ca.competitor_id
       WHERE c.organization_id = $1 AND ca.analysis_date >= NOW() - INTERVAL '30 days'
       GROUP BY ca.analysis_type`,
      [req.organizationId]
    );
    
    res.json({
      competitors: competitorsCount.rows[0],
      recent_analysis: recentAnalysis.rows,
      recommendations: generateCompetitiveRecommendations(competitorsCount.rows[0], recentAnalysis.rows)
    });
  } catch (error) {
    console.error('Error fetching competitive overview:', error);
    res.status(500).json({ error: 'Failed to fetch competitive overview' });
  }
});

// Simulate competitor analysis functions
async function generateCompetitorAnalysis(competitorId, analysisType) {
  const metrics = {};
  const insights = {};
  const recommendations = [];
  
  switch (analysisType) {
    case 'seo':
      metrics.domain_authority = Math.floor(Math.random() * 40) + 40;
      metrics.organic_keywords = Math.floor(Math.random() * 5000) + 1000;
      metrics.organic_traffic = Math.floor(Math.random() * 100000) + 10000;
      insights.top_keywords = ['marketing automation', 'lead generation', 'email marketing'];
      recommendations.push('Target their low-competition keywords');
      recommendations.push('Improve content for their top-ranking topics');
      break;
      
    case 'content':
      metrics.content_frequency = Math.floor(Math.random() * 20) + 5;
      metrics.avg_engagement = Math.random() * 10 + 2;
      metrics.content_types = { blog: 60, video: 25, infographic: 15 };
      insights.popular_topics = ['AI marketing', 'automation tools', 'lead scoring'];
      recommendations.push('Increase content publishing frequency');
      recommendations.push('Create more video content');
      break;
      
    case 'social':
      metrics.followers = { linkedin: 15000, twitter: 8000, facebook: 12000 };
      metrics.engagement_rate = Math.random() * 5 + 1;
      metrics.posting_frequency = Math.floor(Math.random() * 10) + 3;
      insights.peak_times = ['9AM-11AM', '1PM-3PM', '6PM-8PM'];
      recommendations.push('Post during their peak engagement times');
      recommendations.push('Engage with their audience');
      break;
  }
  
  return { metrics, insights, recommendations };
}

function generateCompetitiveRecommendations(competitorStats, analysisStats) {
  const recommendations = [];
  
  if (parseInt(competitorStats.total) < 3) {
    recommendations.push({
      type: 'research',
      priority: 'medium',
      message: 'Add more competitors for better insights',
      action: 'Research and add 3-5 key competitors in your industry'
    });
  }
  
  const seoAnalysis = analysisStats.find(a => a.analysis_type === 'seo');
  if (!seoAnalysis) {
    recommendations.push({
      type: 'seo_analysis',
      priority: 'high',
      message: 'Run SEO competitive analysis',
      action: 'Analyze competitor SEO strategies to identify opportunities'
    });
  }
  
  return recommendations;
}

module.exports = router;
