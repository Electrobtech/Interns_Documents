const express = require('express');
const { authenticate, requirePermission } = require('@lead/shared');
const { withTenantScope } = require('../middleware/tenant');
const { query } = require('../database');

const router = express.Router();

// Get calendar events
router.get('/events', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { start_date, end_date, event_type, status, limit = 100, offset = 0 } = req.query;
    
    let query_str = 'SELECT * FROM mh_calendar_events WHERE organization_id = $1';
    const params = [req.organizationId];
    let paramCount = 1;
    
    if (start_date) {
      query_str += ` AND start_date >= $${++paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      query_str += ` AND start_date <= $${++paramCount}`;
      params.push(end_date);
    }
    
    if (event_type) {
      query_str += ` AND event_type = $${++paramCount}`;
      params.push(event_type);
    }
    
    if (status) {
      query_str += ` AND status = $${++paramCount}`;
      params.push(status);
    }
    
    query_str += ` ORDER BY start_date ASC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(query_str, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// Create calendar event
router.post('/events', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { 
      title, description, event_type, start_date, end_date, all_day,
      campaign_id, content_id, assignees, metadata 
    } = req.body;
    
    if (!title || !event_type || !start_date) {
      return res.status(400).json({ error: 'Title, event type, and start date are required' });
    }
    
    const result = await query(
      `INSERT INTO mh_calendar_events (organization_id, title, description, event_type, 
                                      start_date, end_date, all_day, campaign_id, content_id,
                                      assignees, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        req.organizationId, title, description, event_type, start_date, end_date,
        all_day || false, campaign_id, content_id, assignees || [],
        JSON.stringify(metadata || {})
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// Get event by ID
router.get('/events/:id', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM mh_calendar_events WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching calendar event:', error);
    res.status(500).json({ error: 'Failed to fetch calendar event' });
  }
});

// Update calendar event
router.put('/events/:id', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { 
      title, description, event_type, start_date, end_date, all_day,
      status, assignees, metadata 
    } = req.body;
    
    const result = await query(
      `UPDATE mh_calendar_events 
       SET title = $1, description = $2, event_type = $3, start_date = $4, end_date = $5,
           all_day = $6, status = $7, assignees = $8, metadata = $9, updated_at = now()
       WHERE id = $10 AND organization_id = $11
       RETURNING *`,
      [
        title, description, event_type, start_date, end_date, all_day,
        status, assignees, JSON.stringify(metadata || {}),
        req.params.id, req.organizationId
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating calendar event:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});
// Delete calendar event
router.delete('/events/:id', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM mh_calendar_events WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }
    
    res.json({ message: 'Calendar event deleted successfully' });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

// Get calendar view (month/week/day)
router.get('/view/:view_type', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { view_type } = req.params;
    const { date } = req.query;
    
    const targetDate = date ? new Date(date) : new Date();
    let startDate, endDate;
    
    switch (view_type) {
      case 'day':
        startDate = new Date(targetDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(targetDate);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'week':
        const dayOfWeek = targetDate.getDay();
        startDate = new Date(targetDate);
        startDate.setDate(targetDate.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'month':
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid view type' });
    }
    
    const result = await query(
      `SELECT * FROM mh_calendar_events 
       WHERE organization_id = $1 
         AND start_date >= $2 AND start_date <= $3
       ORDER BY start_date ASC`,
      [req.organizationId, startDate.toISOString(), endDate.toISOString()]
    );
    
    res.json({
      events: result.rows,
      view_type,
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching calendar view:', error);
    res.status(500).json({ error: 'Failed to fetch calendar view' });
  }
});

// Get upcoming deadlines
router.get('/deadlines/upcoming', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(days));
    
    const result = await query(
      `SELECT * FROM mh_calendar_events 
       WHERE organization_id = $1 
         AND start_date BETWEEN NOW() AND $2
         AND event_type = 'deadline'
         AND status != 'completed'
       ORDER BY start_date ASC`,
      [req.organizationId, endDate.toISOString()]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching upcoming deadlines:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming deadlines' });
  }
});

// Get calendar statistics
router.get('/stats/overview', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }
    
    const stats = await query(
      `SELECT 
         event_type,
         status,
         COUNT(*) as count,
         COUNT(CASE WHEN start_date >= NOW() THEN 1 END) as upcoming_count
       FROM mh_calendar_events 
       WHERE organization_id = $1 AND created_at >= $2
       GROUP BY event_type, status
       ORDER BY count DESC`,
      [req.organizationId, startDate.toISOString()]
    );
    
    res.json({
      statistics: stats.rows,
      period: period
    });
  } catch (error) {
    console.error('Error fetching calendar statistics:', error);
    res.status(500).json({ error: 'Failed to fetch calendar statistics' });
  }
});

module.exports = router;
