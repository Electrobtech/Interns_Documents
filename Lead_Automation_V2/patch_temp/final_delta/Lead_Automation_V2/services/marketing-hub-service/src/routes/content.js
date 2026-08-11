const express = require('express');
const { authenticate, requirePermission } = require('@lead/shared');
const { query } = require('../database');
const { complete } = require('../services/llmClient');

const router = express.Router();

// Get all content
router.get('/', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const { type, channel, status, tags, search, limit = 50, offset = 0 } = req.query;
    
    let query_str = 'SELECT * FROM mh_content_studio WHERE organization_id = $1';
    const params = [req.user.organizationId];
    let paramCount = 1;
    
    if (type) {
      query_str += ` AND type = $${++paramCount}`;
      params.push(type);
    }
    
    if (channel) {
      query_str += ` AND channel = $${++paramCount}`;
      params.push(channel);
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
      query_str += ` AND name ILIKE $${++paramCount}`;
      params.push(`%${search}%`);
    }
    
    query_str += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(query_str, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Create new content
router.post('/', authenticate, requirePermission('campaigns:write'), async (req, res) => {
  try {
    const { name, type, channel, content, scheduled_at, tags } = req.body;
    
    if (!name || !type || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await query(
      `INSERT INTO mh_content_studio (organization_id, name, type, channel, content, scheduled_at, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.organizationId, name, type, channel, content, scheduled_at, tags || []]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating content:', error);
    res.status(500).json({ error: 'Failed to create content' });
  }
});

// Get content by ID
router.get('/:id', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM mh_content_studio WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Update content
router.put('/:id', authenticate, requirePermission('campaigns:write'), async (req, res) => {
  try {
    const { name, type, channel, content, status, scheduled_at, tags } = req.body;
    
    const result = await query(
      `UPDATE mh_content_studio 
       SET name = $1, type = $2, channel = $3, content = $4, status = $5, 
           scheduled_at = $6, tags = $7, updated_at = now()
       WHERE id = $8 AND organization_id = $9
       RETURNING *`,
      [name, type, channel, content, status, scheduled_at, tags, req.params.id, req.user.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating content:', error);
    res.status(500).json({ error: 'Failed to update content' });
  }
});

// Delete content
router.delete('/:id', authenticate, requirePermission('campaigns:write'), async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM mh_content_studio WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user.organizationId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    res.json({ message: 'Content deleted successfully' });
  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({ error: 'Failed to delete content' });
  }
});

// Publish content
router.post('/:id/publish', authenticate, requirePermission('campaigns:write'), async (req, res) => {
  try {
    const result = await query(
      `UPDATE mh_content_studio 
       SET status = 'published', updated_at = now()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [req.params.id, req.user.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // Here you could trigger actual publishing to social media, email, etc.
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error publishing content:', error);
    res.status(500).json({ error: 'Failed to publish content' });
  }
});

// Get content analytics
router.get('/:id/analytics', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const result = await query(
      'SELECT performance FROM mh_content_studio WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user.organizationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    res.json(result.rows[0].performance || {});
  } catch (error) {
    console.error('Error fetching content analytics:', error);
    res.status(500).json({ error: 'Failed to fetch content analytics' });
  }
});

// Generate AI content
router.post('/generate', authenticate, requirePermission('campaigns:write'), async (req, res) => {
  try {
    const { type, channel, prompt, tone, length } = req.body;
    
    if (!type || !channel || !prompt) {
      return res.status(400).json({ error: 'Missing required fields for AI generation' });
    }
    
    // Real LLM call (Groq, OpenAI-compatible) — see services/llmClient.js.
    // Falls back to the old template only if no LLM key is configured, so
    // this endpoint degrades gracefully instead of 500ing an entire org
    // out of Content Studio if GROQ_API_KEY is ever unset.
    let generatedContent;
    let usedFallback = false;
    try {
      generatedContent = await generateAIContent(prompt, { type, channel, tone, length });
    } catch (llmErr) {
      console.error('[content.generate] LLM call failed, using template fallback:', llmErr.message);
      generatedContent = templateFallback(prompt, { type, channel, tone });
      usedFallback = true;
    }

    res.json({
      content: generatedContent,
      metadata: { type, channel, tone, length, generated_at: new Date(), usedFallback },
    });
  } catch (error) {
    console.error('Error generating AI content:', error);
    res.status(500).json({ error: 'Failed to generate AI content' });
  }
});

// Get content calendar
router.get('/calendar/view', authenticate, requirePermission('campaigns:read'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let query_str = `SELECT * FROM mh_content_studio 
                    WHERE organization_id = $1 AND scheduled_at IS NOT NULL`;
    const params = [req.user.organizationId];
    let paramCount = 1;
    
    if (start_date) {
      query_str += ` AND scheduled_at >= $${++paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      query_str += ` AND scheduled_at <= $${++paramCount}`;
      params.push(end_date);
    }
    
    query_str += ` ORDER BY scheduled_at ASC`;
    
    const result = await query(query_str, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching content calendar:', error);
    res.status(500).json({ error: 'Failed to fetch content calendar' });
  }
});

async function generateAIContent(prompt, options) {
  const { type = 'post', channel = 'whatsapp', tone = 'friendly', length = 'medium' } = options;
  const lengthGuide = { short: '1-2 short sentences', medium: '3-5 sentences', long: 'a full multi-paragraph piece' }[length] || '3-5 sentences';

  const system = [
    `You write ${channel} marketing ${type} copy for a small/mid-size business's marketing team.`,
    `Tone: ${tone}. Length: ${lengthGuide}.`,
    channel === 'whatsapp' || channel === 'sms'
      ? 'Keep it punchy and mobile-friendly. Use {{name}} as a personalization placeholder if a greeting is natural.'
      : channel === 'email'
        ? 'Include a "Subject:" line on its own first line, then a blank line, then the email body. Use {{name}} for personalization.'
        : 'Write for a social feed — hook in the first line, 1-3 relevant hashtags at the end, no more.',
    'Output ONLY the copy itself — no explanation, no markdown headers, no quotes around it.',
  ].join(' ');

  const content = await complete(system, prompt, { temperature: tone === 'formal' ? 0.4 : 0.8, maxTokens: 500 });
  return content.trim();
}

// Used only if the LLM call itself fails (bad/missing key, provider outage,
// rate limit) — a visibly-labeled template, not a silent swap, so nobody
// mistakes fallback copy for a real AI generation. See usedFallback in the
// response above.
function templateFallback(prompt, { type, channel, tone }) {
  const templates = {
    post: {
      whatsapp: `${prompt}\n\nDon't miss out! Click the link below to learn more.`,
      email: `Subject: ${prompt}\n\nHello,\n\n${prompt}\n\nBest regards,\nYour Marketing Team`,
      social: `${prompt}\n\n#Marketing #Growth`,
    },
    campaign: {
      whatsapp: `Hi {{name}}!\n\n${prompt}\n\nReady to get started? Reply YES!`,
      email: `Subject: ${prompt}\n\nDear {{name}},\n\n${prompt}\n\nClick here to take action.`,
    },
  };
  let content = templates[type]?.[channel] || prompt;
  if (tone === 'casual') content += ' 😊';
  return content;
}

module.exports = router;