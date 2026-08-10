const express = require('express');
const { authenticate, requirePermission } = require('@lead/shared');
const { withTenantScope } = require('../middleware/tenant');
const { query } = require('../database');

const router = express.Router();

// Get all keywords
router.get('/keywords', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    
    let query_str = 'SELECT * FROM mh_seo_keywords WHERE organization_id = $1';
    const params = [req.organizationId];
    let paramCount = 1;
    
    if (search) {
      query_str += ` AND keyword ILIKE $${++paramCount}`;
      params.push(`%${search}%`);
    }
    
    query_str += ` ORDER BY search_volume DESC, difficulty ASC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(query_str, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching keywords:', error);
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

// Add keyword to track
router.post('/keywords', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { keyword, target_rank, url } = req.body;
    
    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }
    
    // Simulate keyword research data
    const keywordData = await getKeywordData(keyword);
    
    const result = await query(
      `INSERT INTO mh_seo_keywords (organization_id, keyword, search_volume, difficulty, 
                                  target_rank, url, competition, cpc, trend_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        req.organizationId, keyword, keywordData.search_volume, keywordData.difficulty,
        target_rank, url, keywordData.competition, keywordData.cpc, keywordData.trend_data
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding keyword:', error);
    res.status(500).json({ error: 'Failed to add keyword' });
  }
});

// Get keyword by ID
router.get('/keywords/:id', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM mh_seo_keywords WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Keyword not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching keyword:', error);
    res.status(500).json({ error: 'Failed to fetch keyword' });
  }
});

// Update keyword
router.put('/keywords/:id', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { current_rank, target_rank, url } = req.body;
    
    const result = await query(
      `UPDATE mh_seo_keywords 
       SET current_rank = $1, target_rank = $2, url = $3, updated_at = now(), last_checked = now()
       WHERE id = $4 AND organization_id = $5
       RETURNING *`,
      [current_rank, target_rank, url, req.params.id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Keyword not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating keyword:', error);
    res.status(500).json({ error: 'Failed to update keyword' });
  }
});

// Delete keyword
router.delete('/keywords/:id', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM mh_seo_keywords WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Keyword not found' });
    }
    
    res.json({ message: 'Keyword deleted successfully' });
  } catch (error) {
    console.error('Error deleting keyword:', error);
    res.status(500).json({ error: 'Failed to delete keyword' });
  }
});

// Get SEO audits
router.get('/audits', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { audit_type, limit = 20, offset = 0 } = req.query;
    
    let query_str = 'SELECT * FROM mh_seo_audits WHERE organization_id = $1';
    const params = [req.organizationId];
    let paramCount = 1;
    
    if (audit_type) {
      query_str += ` AND audit_type = $${++paramCount}`;
      params.push(audit_type);
    }
    
    query_str += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(query_str, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching audits:', error);
    res.status(500).json({ error: 'Failed to fetch audits' });
  }
});

// Create SEO audit
router.post('/audits', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { url, audit_type } = req.body;
    
    if (!url || !audit_type) {
      return res.status(400).json({ error: 'URL and audit type are required' });
    }
    
    // Simulate SEO audit
    const auditResults = await performSEOAudit(url, audit_type);
    
    const result = await query(
      `INSERT INTO mh_seo_audits (organization_id, url, audit_type, score, issues, recommendations, audit_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        req.organizationId, url, audit_type, auditResults.score,
        JSON.stringify(auditResults.issues), JSON.stringify(auditResults.recommendations),
        JSON.stringify(auditResults.data)
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating audit:', error);
    res.status(500).json({ error: 'Failed to create audit' });
  }
});

// Get keyword suggestions
router.post('/keywords/suggestions', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { seed_keyword, limit = 10 } = req.body;
    
    if (!seed_keyword) {
      return res.status(400).json({ error: 'Seed keyword is required' });
    }
    
    // Simulate keyword suggestions
    const suggestions = await getKeywordSuggestions(seed_keyword, limit);
    
    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching keyword suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch keyword suggestions' });
  }
});

// Get SEO insights
router.get('/insights', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    // Get keyword performance
    const keywordInsights = await query(
      `SELECT 
         COUNT(*) as total_keywords,
         COUNT(CASE WHEN current_rank IS NOT NULL AND current_rank <= target_rank THEN 1 END) as ranking_targets_met,
         COUNT(CASE WHEN current_rank IS NOT NULL AND current_rank > target_rank THEN 1 END) as ranking_targets_missed,
         AVG(difficulty) as avg_difficulty,
         SUM(search_volume) as total_search_volume
       FROM mh_seo_keywords 
       WHERE organization_id = $1`,
      [req.organizationId]
    );
    
    // Get recent audit summary
    const auditInsights = await query(
      `SELECT 
         audit_type,
         AVG(score) as avg_score,
         COUNT(*) as audit_count
       FROM mh_seo_audits 
       WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY audit_type`,
      [req.organizationId]
    );
    
    res.json({
      keywords: keywordInsights.rows[0],
      audits: auditInsights.rows,
      recommendations: generateSEORecommendations(keywordInsights.rows[0], auditInsights.rows)
    });
  } catch (error) {
    console.error('Error fetching SEO insights:', error);
    res.status(500).json({ error: 'Failed to fetch SEO insights' });
  }
});

// Keyword research
router.post('/research', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { keyword, include_related = true } = req.body;
    
    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }
    
    const research = await performKeywordResearch(keyword, include_related);
    
    res.json(research);
  } catch (error) {
    console.error('Error performing keyword research:', error);
    res.status(500).json({ error: 'Failed to perform keyword research' });
  }
});

// Simulate SEO functions
async function getKeywordData(keyword) {
  // Simulate keyword research API
  return {
    search_volume: Math.floor(Math.random() * 50000) + 1000,
    difficulty: Math.floor(Math.random() * 100) + 1,
    competition: Math.random(),
    cpc: Math.random() * 10 + 0.5,
    trend_data: {
      monthly: Array.from({ length: 12 }, () => Math.floor(Math.random() * 1000))
    }
  };
}

async function performSEOAudit(url, audit_type) {
  // Simulate SEO audit
  const issues = [];
  const recommendations = [];
  let score = Math.floor(Math.random() * 40) + 60; // 60-100
  
  if (audit_type === 'technical') {
    issues.push(
      { type: 'missing_meta_description', severity: 'medium', count: 3 },
      { type: 'slow_loading', severity: 'high', pages: 2 },
      { type: 'broken_links', severity: 'low', count: 1 }
    );
    recommendations.push(
      'Add meta descriptions to 3 pages',
      'Optimize images to improve page load speed',
      'Fix 1 broken internal link'
    );
  }
  
  return {
    score,
    issues,
    recommendations,
    data: {
      url,
      audit_type,
      timestamp: new Date().toISOString(),
      details: `Detailed ${audit_type} audit results for ${url}`
    }
  };
}

async function getKeywordSuggestions(seed_keyword, limit) {
  // Simulate keyword suggestion API
  const suggestions = [];
  const variations = ['best', 'top', 'how to', 'free', 'online', 'guide', 'tips', 'tools'];
  
  for (let i = 0; i < limit; i++) {
    const variation = variations[i % variations.length];
    const keyword = `${variation} ${seed_keyword}`;
    const data = await getKeywordData(keyword);
    
    suggestions.push({
      keyword,
      ...data,
      relevance_score: Math.random()
    });
  }
  
  return suggestions;
}

async function performKeywordResearch(keyword, includeRelated) {
  const mainKeyword = await getKeywordData(keyword);
  const research = {
    main_keyword: { keyword, ...mainKeyword },
    related_keywords: [],
    questions: [],
    competitors: []
  };
  
  if (includeRelated) {
    research.related_keywords = await getKeywordSuggestions(keyword, 5);
    research.questions = [
      `What is ${keyword}?`,
      `How to ${keyword}?`,
      `Best ${keyword} tools`,
      `${keyword} vs alternatives`
    ].map(q => ({ question: q, search_volume: Math.floor(Math.random() * 1000) + 100 }));
  }
  
  return research;
}

function generateSEORecommendations(keywordData, auditData) {
  const recommendations = [];
  
  if (parseInt(keywordData.ranking_targets_missed) > parseInt(keywordData.ranking_targets_met)) {
    recommendations.push({
      type: 'keyword_optimization',
      priority: 'high',
      message: 'Focus on improving rankings for underperforming keywords',
      action: 'Create targeted content for low-ranking keywords'
    });
  }
  
  if (parseFloat(keywordData.avg_difficulty) > 70) {
    recommendations.push({
      type: 'keyword_strategy',
      priority: 'medium',
      message: 'Consider targeting lower difficulty keywords',
      action: 'Research long-tail keywords with lower competition'
    });
  }
  
  const techAudit = auditData.find(a => a.audit_type === 'technical');
  if (techAudit && parseFloat(techAudit.avg_score) < 80) {
    recommendations.push({
      type: 'technical_seo',
      priority: 'high',
      message: 'Technical SEO issues need attention',
      action: 'Run a complete technical audit and fix critical issues'
    });
  }
  
  return recommendations;
}

module.exports = router;
