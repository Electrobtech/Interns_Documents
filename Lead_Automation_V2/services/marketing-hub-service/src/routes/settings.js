const express = require('express');
const { authenticate, requirePermission } = require('@lead/shared');
const { withTenantScope } = require('../middleware/tenant');
const { query } = require('../database');

const router = express.Router();

// Get all settings by category
router.get('/:category', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { category } = req.params;
    
    const result = await query(
      'SELECT * FROM mh_settings WHERE organization_id = $1 AND category = $2 ORDER BY key',
      [req.organizationId, category]
    );
    
    // Convert to key-value object
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = {
        value: row.value,
        description: row.description,
        is_public: row.is_public,
        updated_at: row.updated_at
      };
    });
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update setting
router.put('/:category/:key', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { category, key } = req.params;
    const { value, description, is_public } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    const result = await query(
      `INSERT INTO mh_settings (organization_id, category, key, value, description, is_public)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (organization_id, category, key)
       DO UPDATE SET value = $4, description = $5, is_public = $6, updated_at = now()
       RETURNING *`,
      [req.organizationId, category, key, JSON.stringify(value), description, is_public || false]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Delete setting
router.delete('/:category/:key', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { category, key } = req.params;
    
    const result = await query(
      'DELETE FROM mh_settings WHERE organization_id = $1 AND category = $2 AND key = $3',
      [req.organizationId, category, key]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

// Get all integrations
router.get('/integrations/list', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { service_type, status } = req.query;
    
    let query_str = 'SELECT * FROM mh_integrations WHERE organization_id = $1';
    const params = [req.organizationId];
    let paramCount = 1;
    
    if (service_type) {
      query_str += ` AND service_type = $${++paramCount}`;
      params.push(service_type);
    }
    
    if (status) {
      query_str += ` AND status = $${++paramCount}`;
      params.push(status);
    }
    
    query_str += ` ORDER BY created_at DESC`;
    
    const result = await query(query_str, params);
    
    // Remove sensitive credentials from response
    const integrations = result.rows.map(integration => ({
      ...integration,
      credentials: '***hidden***'
    }));
    
    res.json(integrations);
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// Create or update integration
router.post('/integrations', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { provider, service_type, credentials, configuration, status = 'active' } = req.body;
    
    if (!provider || !service_type || !credentials) {
      return res.status(400).json({ error: 'Provider, service type, and credentials are required' });
    }
    
    const result = await query(
      `INSERT INTO mh_integrations (organization_id, provider, service_type, credentials, configuration, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        req.organizationId, provider, service_type, JSON.stringify(credentials),
        JSON.stringify(configuration || {}), status
      ]
    );
    
    // Remove credentials from response
    const integration = { ...result.rows[0], credentials: '***hidden***' };
    res.status(201).json(integration);
  } catch (error) {
    console.error('Error creating integration:', error);
    res.status(500).json({ error: 'Failed to create integration' });
  }
});
// Update integration
router.put('/integrations/:id', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { credentials, configuration, status } = req.body;
    
    const result = await query(
      `UPDATE mh_integrations 
       SET credentials = $1, configuration = $2, status = $3, updated_at = now()
       WHERE id = $4 AND organization_id = $5
       RETURNING *`,
      [
        JSON.stringify(credentials), JSON.stringify(configuration || {}), status,
        req.params.id, req.organizationId
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    
    const integration = { ...result.rows[0], credentials: '***hidden***' };
    res.json(integration);
  } catch (error) {
    console.error('Error updating integration:', error);
    res.status(500).json({ error: 'Failed to update integration' });
  }
});

// Delete integration
router.delete('/integrations/:id', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM mh_integrations WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    
    res.json({ message: 'Integration deleted successfully' });
  } catch (error) {
    console.error('Error deleting integration:', error);
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

// Test integration connection
router.post('/integrations/:id/test', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const integration = await query(
      'SELECT * FROM mh_integrations WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
    );
    
    if (integration.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    
    // Simulate connection test
    const testResult = await testIntegrationConnection(integration.rows[0]);
    
    // Update last_sync if successful
    if (testResult.success) {
      await query(
        'UPDATE mh_integrations SET last_sync = now() WHERE id = $1',
        [req.params.id]
      );
    }
    
    res.json(testResult);
  } catch (error) {
    console.error('Error testing integration:', error);
    res.status(500).json({ error: 'Failed to test integration' });
  }
});

// Get default settings template
router.get('/defaults/:category', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { category } = req.params;
    
    const defaults = getDefaultSettings(category);
    res.json(defaults);
  } catch (error) {
    console.error('Error fetching default settings:', error);
    res.status(500).json({ error: 'Failed to fetch default settings' });
  }
});

// Sync integration data
router.post('/integrations/:id/sync', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const integration = await query(
      'SELECT * FROM mh_integrations WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
    );
    
    if (integration.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    
    // Simulate data sync
    const syncResult = await syncIntegrationData(integration.rows[0]);
    
    // Update last_sync timestamp
    await query(
      'UPDATE mh_integrations SET last_sync = now() WHERE id = $1',
      [req.params.id]
    );
    
    res.json(syncResult);
  } catch (error) {
    console.error('Error syncing integration:', error);
    res.status(500).json({ error: 'Failed to sync integration' });
  }
});

// Helper functions
async function testIntegrationConnection(integration) {
  // Simulate connection test based on service type
  const { provider, service_type } = integration;
  
  // Simulate API call with random success/failure
  const success = Math.random() > 0.1; // 90% success rate
  
  return {
    success,
    message: success 
      ? `Successfully connected to ${provider} ${service_type} service`
      : `Failed to connect to ${provider}: Invalid credentials or service unavailable`,
    tested_at: new Date().toISOString(),
    response_time: Math.floor(Math.random() * 1000) + 100 // 100-1100ms
  };
}

async function syncIntegrationData(integration) {
  // Simulate data synchronization
  const { provider, service_type } = integration;
  
  const recordsSynced = Math.floor(Math.random() * 1000) + 50;
  const errors = Math.random() > 0.9 ? Math.floor(Math.random() * 5) : 0;
  
  return {
    success: true,
    records_synced: recordsSynced,
    errors: errors,
    sync_duration: Math.floor(Math.random() * 30) + 5, // 5-35 seconds
    last_record: new Date().toISOString(),
    message: `Synced ${recordsSynced} records from ${provider} ${service_type}`
  };
}

function getDefaultSettings(category) {
  const defaults = {
    general: {
      timezone: { value: 'UTC', description: 'Default timezone for campaigns' },
      language: { value: 'en', description: 'Default language for content' },
      date_format: { value: 'YYYY-MM-DD', description: 'Date format preference' },
      currency: { value: 'USD', description: 'Default currency' }
    },
    
    campaigns: {
      default_channel: { value: 'email', description: 'Default channel for new campaigns' },
      auto_pause_failed: { value: true, description: 'Auto-pause campaigns with high failure rates' },
      max_recipients: { value: 10000, description: 'Maximum recipients per campaign' },
      retry_attempts: { value: 3, description: 'Number of retry attempts for failed sends' }
    },
    
    notifications: {
      email_reports: { value: true, description: 'Send email reports' },
      campaign_completion: { value: true, description: 'Notify on campaign completion' },
      failure_alerts: { value: true, description: 'Alert on high failure rates' },
      weekly_summary: { value: false, description: 'Weekly performance summary' }
    },
    
    integrations: {
      auto_sync_interval: { value: 3600, description: 'Auto-sync interval in seconds' },
      webhook_timeout: { value: 30, description: 'Webhook timeout in seconds' },
      api_rate_limit: { value: 100, description: 'API calls per minute limit' }
    }
  };
  
  return defaults[category] || {};
}

module.exports = router;
