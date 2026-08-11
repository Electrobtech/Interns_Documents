const express = require('express');
const { authenticate, requirePermission } = require('@lead/shared');
const { query } = require('../database');

const router = express.Router();

// Get all templates
router.get('/', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const { category, channel, search, limit = 50, offset = 0 } = req.query;
    
    let query_str = `SELECT t.*, COUNT(c.id) as usage_count_actual
                    FROM mh_templates t
                    LEFT JOIN mh_campaigns c ON c.message_body LIKE '%' || t.name || '%'
                    WHERE t.organization_id = $1`;
    const params = [req.user.organizationId];
    let paramCount = 1;
    
    if (category) {
      query_str += ` AND t.category = $${++paramCount}`;
      params.push(category);
    }
    
    if (channel) {
      query_str += ` AND t.channel = $${++paramCount}`;
      params.push(channel);
    }
    
    if (search) {
      query_str += ` AND t.name ILIKE $${++paramCount}`;
      params.push(`%${search}%`);
    }
    
    query_str += ` GROUP BY t.id ORDER BY t.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(query_str, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Create new template
router.post('/', authenticate, requirePermission('campaigns:write'), async (req, res) => {
  try {
    const { name, category, channel, content, is_public = false } = req.body;
    
    if (!name || !category || !channel || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await query(
      `INSERT INTO mh_templates (organization_id, name, category, channel, content, is_public)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.organizationId, name, category, channel, content, is_public]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Get template by ID
router.get('/:id', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM mh_templates WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Update template
router.put('/:id', authenticate, requirePermission('campaigns:write'), async (req, res) => {
  try {
    const { name, category, channel, content, is_public } = req.body;
    
    const result = await query(
      `UPDATE mh_templates 
       SET name = $1, category = $2, channel = $3, content = $4, is_public = $5, updated_at = now()
       WHERE id = $6 AND organization_id = $7
       RETURNING *`,
      [name, category, channel, content, is_public, req.params.id, req.user.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete template
router.delete('/:id', authenticate, requirePermission('campaigns:write'), async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM mh_templates WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user.organizationId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Get template categories
router.get('/categories/list', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const result = await query(
      `SELECT category, COUNT(*) as count 
       FROM mh_templates 
       WHERE organization_id = $1 
       GROUP BY category 
       ORDER BY count DESC`,
      [req.user.organizationId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Use template (increment usage count)
router.post('/:id/use', authenticate, requirePermission('campaigns:write'), async (req, res) => {
  try {
    const result = await query(
      `UPDATE mh_templates 
       SET usage_count = usage_count + 1, updated_at = now()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [req.params.id, req.user.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error using template:', error);
    res.status(500).json({ error: 'Failed to use template' });
  }
});

// Get popular templates
router.get('/popular/list', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const { channel, limit = 10 } = req.query;
    
    let query_str = `SELECT * FROM mh_templates WHERE organization_id = $1`;
    const params = [req.user.organizationId];
    let paramCount = 1;
    
    if (channel) {
      query_str += ` AND channel = $${++paramCount}`;
      params.push(channel);
    }
    
    query_str += ` ORDER BY usage_count DESC, created_at DESC LIMIT $${++paramCount}`;
    params.push(parseInt(limit));
    
    const result = await query(query_str, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching popular templates:', error);
    res.status(500).json({ error: 'Failed to fetch popular templates' });
  }
});

module.exports = router;