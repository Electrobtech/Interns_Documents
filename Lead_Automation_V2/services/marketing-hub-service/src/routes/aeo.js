const express = require('express');
const { authenticate, requirePermission } = require('@lead/shared');
const { withTenantScope } = require('../middleware/tenant');
const { query } = require('../database');

const router = express.Router();

// Get all AEO optimizations
router.get('/', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { status, answer_type, search, limit = 50, offset = 0 } = req.query;
    
    let query_str = 'SELECT * FROM mh_aeo_optimization WHERE organization_id = $1';
    const params = [req.organizationId];
    let paramCount = 1;
    
    if (status) {
      query_str += ` AND status = $${++paramCount}`;
      params.push(status);
    }
    
    if (answer_type) {
      query_str += ` AND answer_type = $${++paramCount}`;
      params.push(answer_type);
    }
    
    if (search) {
      query_str += ` AND query ILIKE $${++paramCount}`;
      params.push(`%${search}%`);
    }
    
    query_str += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(query_str, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching AEO optimizations:', error);
    res.status(500).json({ error: 'Failed to fetch AEO optimizations' });
  }
});

// Create new AEO optimization
router.post('/', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { query: searchQuery, answer_type, current_content } = req.body;
    
    if (!searchQuery) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Generate AEO optimization suggestions
    const optimization = await generateAEOOptimization(searchQuery, answer_type, current_content);
    
    const result = await query(
      `INSERT INTO mh_aeo_optimization (organization_id, query, answer_type, current_content, 
                                       optimized_content, optimization_tips, performance)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        req.organizationId, searchQuery, answer_type, current_content,
        optimization.optimized_content, JSON.stringify(optimization.tips),
        JSON.stringify(optimization.performance)
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating AEO optimization:', error);
    res.status(500).json({ error: 'Failed to create AEO optimization' });
  }
});

// Get AEO optimization by ID
router.get('/:id', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM mh_aeo_optimization WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'AEO optimization not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching AEO optimization:', error);
    res.status(500).json({ error: 'Failed to fetch AEO optimization' });
  }
});

// Update AEO optimization
router.put('/:id', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { optimized_content, status, performance } = req.body;
    
    const result = await query(
      `UPDATE mh_aeo_optimization 
       SET optimized_content = $1, status = $2, performance = $3, updated_at = now()
       WHERE id = $4 AND organization_id = $5
       RETURNING *`,
      [optimized_content, status, JSON.stringify(performance || {}), req.params.id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'AEO optimization not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating AEO optimization:', error);
    res.status(500).json({ error: 'Failed to update AEO optimization' });
  }
});
// Delete AEO optimization
router.delete('/:id', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM mh_aeo_optimization WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'AEO optimization not found' });
    }
    
    res.json({ message: 'AEO optimization deleted successfully' });
  } catch (error) {
    console.error('Error deleting AEO optimization:', error);
    res.status(500).json({ error: 'Failed to delete AEO optimization' });
  }
});

// Analyze query for AEO potential
router.post('/analyze', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { query: searchQuery } = req.body;
    
    if (!searchQuery) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const analysis = await analyzeQueryForAEO(searchQuery);
    
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing query:', error);
    res.status(500).json({ error: 'Failed to analyze query' });
  }
});

// Get AEO insights
router.get('/insights/overview', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const insights = await query(
      `SELECT 
         status,
         answer_type,
         COUNT(*) as count,
         AVG(CASE 
           WHEN performance->>'click_rate' IS NOT NULL 
           THEN (performance->>'click_rate')::float 
           ELSE 0 
         END) as avg_click_rate
       FROM mh_aeo_optimization 
       WHERE organization_id = $1 
       GROUP BY status, answer_type
       ORDER BY count DESC`,
      [req.organizationId]
    );
    
    res.json({
      status_distribution: insights.rows,
      recommendations: generateAEORecommendations(insights.rows)
    });
  } catch (error) {
    console.error('Error fetching AEO insights:', error);
    res.status(500).json({ error: 'Failed to fetch AEO insights' });
  }
});

// Simulate AEO functions
async function generateAEOOptimization(searchQuery, answerType, currentContent) {
  // Simulate AEO optimization based on answer engine requirements
  const optimization = {
    optimized_content: '',
    tips: [],
    performance: { estimated_visibility: Math.random() }
  };
  
  if (answerType === 'featured_snippet') {
    optimization.optimized_content = `**${searchQuery}**\n\n${currentContent || 'Optimized answer content goes here.'}\n\nKey points:\n• Bullet point 1\n• Bullet point 2\n• Bullet point 3`;
    optimization.tips = [
      'Use clear, concise language',
      'Structure content with bullet points or numbered lists',
      'Include the exact question in the answer',
      'Keep answer under 58 words for snippet optimization'
    ];
  } else if (answerType === 'local_pack') {
    optimization.optimized_content = `${currentContent || 'Local business information'}\n\nLocation: [Your Business Address]\nHours: [Business Hours]\nPhone: [Phone Number]`;
    optimization.tips = [
      'Include complete NAP (Name, Address, Phone)',
      'Add business hours and contact information',
      'Use local keywords naturally',
      'Encourage customer reviews'
    ];
  } else {
    optimization.optimized_content = currentContent || 'Optimized content for answer engines';
    optimization.tips = [
      'Focus on direct, factual answers',
      'Use structured data markup',
      'Optimize for voice search queries',
      'Include related questions and answers'
    ];
  }
  
  return optimization;
}

async function analyzeQueryForAEO(searchQuery) {
  // Simulate query analysis for AEO potential
  const analysis = {
    query: searchQuery,
    aeo_potential: Math.random() * 100,
    recommended_answer_types: [],
    competition_level: Math.random() > 0.5 ? 'low' : 'medium',
    search_intent: determineSearchIntent(searchQuery),
    optimization_priority: Math.random() > 0.7 ? 'high' : 'medium'
  };
  
  // Determine recommended answer types based on query
  if (searchQuery.includes('how to') || searchQuery.includes('what is')) {
    analysis.recommended_answer_types.push('featured_snippet');
  }
  
  if (searchQuery.includes('near me') || searchQuery.includes('local')) {
    analysis.recommended_answer_types.push('local_pack');
  }
  
  if (searchQuery.includes('best') || searchQuery.includes('top')) {
    analysis.recommended_answer_types.push('knowledge_panel');
  }
  
  return analysis;
}

function determineSearchIntent(query) {
  const lowercaseQuery = query.toLowerCase();
  
  if (lowercaseQuery.includes('buy') || lowercaseQuery.includes('price') || lowercaseQuery.includes('cost')) {
    return 'transactional';
  }
  
  if (lowercaseQuery.includes('how') || lowercaseQuery.includes('what') || lowercaseQuery.includes('why')) {
    return 'informational';
  }
  
  if (lowercaseQuery.includes('best') || lowercaseQuery.includes('vs') || lowercaseQuery.includes('review')) {
    return 'commercial';
  }
  
  return 'navigational';
}

function generateAEORecommendations(insights) {
  const recommendations = [];
  
  const completedCount = insights.filter(i => i.status === 'completed').length;
  const totalCount = insights.reduce((sum, i) => sum + parseInt(i.count), 0);
  
  if (completedCount < totalCount * 0.5) {
    recommendations.push({
      type: 'completion',
      priority: 'high',
      message: 'Complete pending AEO optimizations',
      action: 'Focus on finishing incomplete optimizations for better search visibility'
    });
  }
  
  const snippetOptimizations = insights.filter(i => i.answer_type === 'featured_snippet');
  if (snippetOptimizations.length === 0) {
    recommendations.push({
      type: 'featured_snippet',
      priority: 'medium',
      message: 'Add featured snippet optimizations',
      action: 'Target question-based queries for featured snippet opportunities'
    });
  }
  
  return recommendations;
}

module.exports = router;
