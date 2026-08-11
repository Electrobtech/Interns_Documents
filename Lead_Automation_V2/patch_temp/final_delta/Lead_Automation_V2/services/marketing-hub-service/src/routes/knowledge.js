const express = require('express');
const { authenticate, requirePermission } = require('@lead/shared');
const { query } = require('../database');

const router = express.Router();

// Get all knowledge articles
router.get('/', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const { category, status, search, tags, limit = 50, offset = 0 } = req.query;
    
    let query_str = 'SELECT * FROM mh_knowledge_articles WHERE organization_id = $1';
    const params = [req.user.organizationId];
    let paramCount = 1;
    
    if (category) {
      query_str += ` AND category = $${++paramCount}`;
      params.push(category);
    }
    
    if (status) {
      query_str += ` AND status = $${++paramCount}`;
      params.push(status);
    }
    
    if (tags) {
      query_str += ` AND tags && $${++paramCount}`;
      params.push(tags.split(','));
    }
    
    if (search) {
      query_str += ` AND (title ILIKE $${++paramCount} OR content ILIKE $${++paramCount})`;
      params.push(`%${search}%`, `%${search}%`);
      paramCount++;
    }
    
    query_str += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(query_str, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching knowledge articles:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge articles' });
  }
});

// Create knowledge article
router.post('/', authenticate, requirePermission('campaigns:write'), async (req, res) => {
  try {
    const { title, content, category, tags, status = 'draft', metadata } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    // Generate search vector for full-text search
    const searchVector = `to_tsvector('english', $3 || ' ' || $4)`;
    
    const result = await query(
      `INSERT INTO mh_knowledge_articles (organization_id, title, content, category, tags, 
                                         author_id, status, search_vector, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ${searchVector}, $8) RETURNING *`,
      [
        req.user.organizationId, title, content, category, tags || [],
        req.userId, status, JSON.stringify(metadata || {})
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating knowledge article:', error);
    res.status(500).json({ error: 'Failed to create knowledge article' });
  }
});

// Get article by ID
router.get('/:id', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const result = await query(
      `SELECT ka.*, u.name as author_name 
       FROM mh_knowledge_articles ka
       LEFT JOIN users u ON u.id = ka.author_id
       WHERE ka.id = $1 AND ka.organization_id = $2`,
      [req.params.id, req.user.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Knowledge article not found' });
    }
    
    // Increment view count
    await query(
      'UPDATE mh_knowledge_articles SET view_count = view_count + 1 WHERE id = $1',
      [req.params.id]
    );
    
    const article = result.rows[0];
    article.view_count = parseInt(article.view_count) + 1;
    
    res.json(article);
  } catch (error) {
    console.error('Error fetching knowledge article:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge article' });
  }
});

// Update knowledge article
router.put('/:id', authenticate, requirePermission('campaigns:write'), async (req, res) => {
  try {
    const { title, content, category, tags, status, metadata } = req.body;
    
    const searchVector = `to_tsvector('english', $2 || ' ' || $3)`;
    
    const result = await query(
      `UPDATE mh_knowledge_articles 
       SET title = $1, content = $2, category = $3, tags = $4, status = $5,
           search_vector = ${searchVector}, metadata = $6, updated_at = now()
       WHERE id = $7 AND organization_id = $8
       RETURNING *`,
      [
        title, content, category, tags, status,
        JSON.stringify(metadata || {}), req.params.id, req.user.organizationId
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Knowledge article not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating knowledge article:', error);
    res.status(500).json({ error: 'Failed to update knowledge article' });
  }
});
// Delete knowledge article
router.delete('/:id', authenticate, requirePermission('campaigns:write'), async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM mh_knowledge_articles WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user.organizationId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Knowledge article not found' });
    }
    
    res.json({ message: 'Knowledge article deleted successfully' });
  } catch (error) {
    console.error('Error deleting knowledge article:', error);
    res.status(500).json({ error: 'Failed to delete knowledge article' });
  }
});

// Search knowledge articles
router.post('/search', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const { query: searchQuery, limit = 20 } = req.body;
    
    if (!searchQuery) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const result = await query(
      `SELECT *, ts_rank(search_vector, plainto_tsquery('english', $2)) as rank
       FROM mh_knowledge_articles 
       WHERE organization_id = $1 
         AND search_vector @@ plainto_tsquery('english', $2)
         AND status = 'published'
       ORDER BY rank DESC, view_count DESC
       LIMIT $3`,
      [req.user.organizationId, searchQuery, parseInt(limit)]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error searching knowledge articles:', error);
    res.status(500).json({ error: 'Failed to search knowledge articles' });
  }
});

// Get knowledge categories
router.get('/categories/list', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const result = await query(
      `SELECT category, COUNT(*) as article_count 
       FROM mh_knowledge_articles 
       WHERE organization_id = $1 AND status = 'published'
       GROUP BY category 
       ORDER BY article_count DESC`,
      [req.user.organizationId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching knowledge categories:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge categories' });
  }
});

// Get popular articles
router.get('/popular/list', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const result = await query(
      `SELECT id, title, category, view_count, helpful_count, created_at
       FROM mh_knowledge_articles 
       WHERE organization_id = $1 AND status = 'published'
       ORDER BY view_count DESC, helpful_count DESC
       LIMIT $2`,
      [req.user.organizationId, parseInt(limit)]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching popular articles:', error);
    res.status(500).json({ error: 'Failed to fetch popular articles' });
  }
});

// Mark article as helpful
router.post('/:id/helpful', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const result = await query(
      `UPDATE mh_knowledge_articles 
       SET helpful_count = helpful_count + 1, updated_at = now()
       WHERE id = $1 AND organization_id = $2
       RETURNING helpful_count`,
      [req.params.id, req.user.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Knowledge article not found' });
    }
    
    res.json({ helpful_count: result.rows[0].helpful_count });
  } catch (error) {
    console.error('Error marking article as helpful:', error);
    res.status(500).json({ error: 'Failed to mark article as helpful' });
  }
});

// Get knowledge statistics
router.get('/stats/overview', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const stats = await query(
      `SELECT 
         COUNT(*) as total_articles,
         COUNT(CASE WHEN status = 'published' THEN 1 END) as published_articles,
         COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_articles,
         SUM(view_count) as total_views,
         SUM(helpful_count) as total_helpful,
         COUNT(DISTINCT category) as categories_count
       FROM mh_knowledge_articles 
       WHERE organization_id = $1`,
      [req.user.organizationId]
    );
    
    const recentActivity = await query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as articles_created
       FROM mh_knowledge_articles 
       WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [req.user.organizationId]
    );
    
    res.json({
      overview: stats.rows[0],
      recent_activity: recentActivity.rows
    });
  } catch (error) {
    console.error('Error fetching knowledge statistics:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge statistics' });
  }
});

module.exports = router;