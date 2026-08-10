const express = require('express');
const { authenticate, requirePermission } = require('@lead/shared');
const { withTenantScope } = require('../middleware/tenant');
const { query } = require('../database');

const router = express.Router();

// Get campaign analytics dashboard
router.get('/dashboard', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Get date range based on period
    const dateRange = getDateRange(period);
    
    // Campaign performance metrics
    const campaignStats = await query(`
      SELECT 
        COUNT(*) as total_campaigns,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as completed_campaigns,
        COUNT(CASE WHEN status = 'sending' THEN 1 END) as active_campaigns,
        SUM(sent_count) as total_sent,
        SUM(delivered_count) as total_delivered,
        SUM(read_count) as total_read,
        SUM(replied_count) as total_replied,
        ROUND(AVG(CASE WHEN sent_count > 0 THEN delivered_count::float / sent_count * 100 END), 2) as avg_delivery_rate,
        ROUND(AVG(CASE WHEN delivered_count > 0 THEN read_count::float / delivered_count * 100 END), 2) as avg_open_rate,
        ROUND(AVG(CASE WHEN read_count > 0 THEN replied_count::float / read_count * 100 END), 2) as avg_response_rate
      FROM mh_campaigns 
      WHERE organization_id = $1 AND created_at >= $2
    `, [req.organizationId, dateRange.start]);
    
    // Channel performance
    const channelStats = await query(`
      SELECT 
        channel,
        COUNT(*) as campaigns_count,
        SUM(sent_count) as total_sent,
        SUM(delivered_count) as total_delivered,
        SUM(read_count) as total_read,
        SUM(replied_count) as total_replied,
        ROUND(AVG(CASE WHEN sent_count > 0 THEN delivered_count::float / sent_count * 100 END), 2) as delivery_rate,
        ROUND(AVG(CASE WHEN delivered_count > 0 THEN read_count::float / delivered_count * 100 END), 2) as open_rate
      FROM mh_campaigns 
      WHERE organization_id = $1 AND created_at >= $2
      GROUP BY channel
      ORDER BY total_sent DESC
    `, [req.organizationId, dateRange.start]);
    
    // Daily activity trends
    const dailyTrends = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as campaigns_created,
        SUM(sent_count) as messages_sent,
        SUM(delivered_count) as messages_delivered
      FROM mh_campaigns 
      WHERE organization_id = $1 AND created_at >= $2
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [req.organizationId, dateRange.start]);
    
    // Top performing campaigns
    const topCampaigns = await query(`
      SELECT 
        id, name, channel, kind,
        sent_count, delivered_count, read_count, replied_count,
        CASE WHEN sent_count > 0 THEN delivered_count::float / sent_count * 100 ELSE 0 END as delivery_rate,
        CASE WHEN delivered_count > 0 THEN read_count::float / delivered_count * 100 ELSE 0 END as open_rate,
        created_at
      FROM mh_campaigns 
      WHERE organization_id = $1 AND created_at >= $2 AND status = 'sent'
      ORDER BY (delivered_count + read_count + replied_count) DESC
      LIMIT 10
    `, [req.organizationId, dateRange.start]);
    
    res.json({
      overview: campaignStats.rows[0],
      by_channel: channelStats.rows,
      daily_trends: dailyTrends.rows.reverse(),
      top_campaigns: topCampaigns.rows,
      period: period,
      date_range: dateRange
    });
  } catch (error) {
    console.error('Error fetching analytics dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch analytics dashboard' });
  }
});

// Get detailed campaign analytics
router.get('/campaigns/:id', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const campaignId = req.params.id;
    
    // Campaign overview
    const campaign = await query(`
      SELECT * FROM mh_campaigns 
      WHERE id = $1 AND organization_id = $2
    `, [campaignId, req.organizationId]);
    
    if (campaign.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Recipient status breakdown
    const recipientStats = await query(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(COUNT(*)::float / (SELECT COUNT(*) FROM mh_recipients WHERE campaign_id = $1) * 100, 2) as percentage
      FROM mh_recipients 
      WHERE campaign_id = $1
      GROUP BY status
      ORDER BY count DESC
    `, [campaignId]);
    
    // Delivery events timeline
    const deliveryTimeline = await query(`
      SELECT 
        DATE_TRUNC('hour', r.created_at) as hour,
        COUNT(*) as events,
        de.event_type
      FROM mh_recipients r
      JOIN mh_delivery_events de ON de.recipient_id = r.id
      WHERE r.campaign_id = $1
      GROUP BY DATE_TRUNC('hour', r.created_at), de.event_type
      ORDER BY hour ASC
    `, [campaignId]);
    
    // Error analysis
    const errorAnalysis = await query(`
      SELECT 
        error_message,
        COUNT(*) as count
      FROM mh_recipients 
      WHERE campaign_id = $1 AND status = 'failed' AND error_message IS NOT NULL
      GROUP BY error_message
      ORDER BY count DESC
      LIMIT 10
    `, [campaignId]);
    
    res.json({
      campaign: campaign.rows[0],
      recipient_breakdown: recipientStats.rows,
      delivery_timeline: deliveryTimeline.rows,
      error_analysis: errorAnalysis.rows
    });
  } catch (error) {
    console.error('Error fetching campaign analytics:', error);
    res.status(500).json({ error: 'Failed to fetch campaign analytics' });
  }
});

// Get audience analytics
router.get('/audiences', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    // Audience performance
    const audiencePerformance = await query(`
      SELECT 
        a.id, a.name, a.size_cached,
        COUNT(c.id) as campaigns_count,
        SUM(c.sent_count) as total_sent,
        SUM(c.delivered_count) as total_delivered,
        SUM(c.read_count) as total_read,
        SUM(c.replied_count) as total_replied,
        ROUND(AVG(CASE WHEN c.sent_count > 0 THEN c.delivered_count::float / c.sent_count * 100 END), 2) as avg_delivery_rate
      FROM mh_audiences a
      LEFT JOIN mh_campaigns c ON c.audience_id = a.id
      WHERE a.organization_id = $1
      GROUP BY a.id, a.name, a.size_cached
      ORDER BY campaigns_count DESC, total_sent DESC
    `, [req.organizationId]);
    
    // Audience growth over time
    const audienceGrowth = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_audiences,
        SUM(size_cached) as total_contacts_added
      FROM mh_audiences 
      WHERE organization_id = $1
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [req.organizationId]);
    
    res.json({
      audience_performance: audiencePerformance.rows,
      audience_growth: audienceGrowth.rows.reverse()
    });
  } catch (error) {
    console.error('Error fetching audience analytics:', error);
    res.status(500).json({ error: 'Failed to fetch audience analytics' });
  }
});

// Get channel comparison
router.get('/channels/comparison', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const dateRange = getDateRange(period);
    
    const channelComparison = await query(`
      SELECT 
        channel,
        COUNT(*) as campaigns,
        SUM(sent_count) as sent,
        SUM(delivered_count) as delivered,
        SUM(read_count) as opened,
        SUM(replied_count) as replied,
        SUM(failed_count) as failed,
        ROUND(AVG(CASE WHEN sent_count > 0 THEN delivered_count::float / sent_count * 100 END), 2) as delivery_rate,
        ROUND(AVG(CASE WHEN delivered_count > 0 THEN read_count::float / delivered_count * 100 END), 2) as open_rate,
        ROUND(AVG(CASE WHEN read_count > 0 THEN replied_count::float / read_count * 100 END), 2) as response_rate,
        ROUND(AVG(CASE WHEN sent_count > 0 THEN failed_count::float / sent_count * 100 END), 2) as failure_rate
      FROM mh_campaigns 
      WHERE organization_id = $1 AND created_at >= $2
      GROUP BY channel
      ORDER BY sent DESC
    `, [req.organizationId, dateRange.start]);
    
    res.json({
      channels: channelComparison.rows,
      period: period
    });
  } catch (error) {
    console.error('Error fetching channel comparison:', error);
    res.status(500).json({ error: 'Failed to fetch channel comparison' });
  }
});

// Get performance insights
router.get('/insights', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const insights = [];
    
    // Best performing channel
    const bestChannel = await query(`
      SELECT channel, AVG(CASE WHEN sent_count > 0 THEN delivered_count::float / sent_count * 100 END) as avg_rate
      FROM mh_campaigns 
      WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY channel
      ORDER BY avg_rate DESC
      LIMIT 1
    `, [req.organizationId]);
    
    if (bestChannel.rows.length > 0) {
      insights.push({
        type: 'success',
        title: 'Best Performing Channel',
        message: `${bestChannel.rows[0].channel} has the highest delivery rate at ${bestChannel.rows[0].avg_rate.toFixed(1)}%`,
        action: `Focus more campaigns on ${bestChannel.rows[0].channel}`
      });
    }
    
    // Campaigns with low performance
    const lowPerforming = await query(`
      SELECT COUNT(*) as count
      FROM mh_campaigns 
      WHERE organization_id = $1 
        AND created_at >= NOW() - INTERVAL '7 days'
        AND sent_count > 0 
        AND delivered_count::float / sent_count < 0.8
    `, [req.organizationId]);
    
    if (parseInt(lowPerforming.rows[0].count) > 0) {
      insights.push({
        type: 'warning',
        title: 'Low Delivery Rates',
        message: `${lowPerforming.rows[0].count} campaigns have delivery rates below 80%`,
        action: 'Review audience quality and message content'
      });
    }
    
    // Growth opportunity
    const inactivePeriod = await query(`
      SELECT COUNT(*) as count
      FROM mh_campaigns 
      WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
    `, [req.organizationId]);
    
    if (parseInt(inactivePeriod.rows[0].count) === 0) {
      insights.push({
        type: 'info',
        title: 'Growth Opportunity',
        message: 'No campaigns sent in the last 7 days',
        action: 'Create a new campaign to engage your audience'
      });
    }
    
    res.json({ insights });
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// Export analytics data
router.get('/export', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { format = 'json', period = '30d' } = req.query;
    const dateRange = getDateRange(period);
    
    const exportData = await query(`
      SELECT 
        c.id, c.name, c.channel, c.kind, c.status, c.created_at,
        c.sent_count, c.delivered_count, c.read_count, c.replied_count, c.failed_count,
        a.name as audience_name, a.size_cached as audience_size,
        CASE WHEN c.sent_count > 0 THEN ROUND(c.delivered_count::float / c.sent_count * 100, 2) ELSE 0 END as delivery_rate,
        CASE WHEN c.delivered_count > 0 THEN ROUND(c.read_count::float / c.delivered_count * 100, 2) ELSE 0 END as open_rate,
        CASE WHEN c.read_count > 0 THEN ROUND(c.replied_count::float / c.read_count * 100, 2) ELSE 0 END as response_rate
      FROM mh_campaigns c
      LEFT JOIN mh_audiences a ON a.id = c.audience_id
      WHERE c.organization_id = $1 AND c.created_at >= $2
      ORDER BY c.created_at DESC
    `, [req.organizationId, dateRange.start]);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.csv');
      
      // Convert to CSV
      const headers = Object.keys(exportData.rows[0] || {});
      const csvContent = [
        headers.join(','),
        ...exportData.rows.map(row => headers.map(header => row[header]).join(','))
      ].join('\n');
      
      res.send(csvContent);
    } else {
      res.json(exportData.rows);
    }
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

function getDateRange(period) {
  const now = new Date();
  let start;
  
  switch (period) {
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  
  return {
    start: start.toISOString(),
    end: now.toISOString()
  };
}

module.exports = router;
