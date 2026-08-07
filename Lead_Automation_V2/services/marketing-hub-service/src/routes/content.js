const express = require('express');
const { authenticate, requirePermission } = require('@lead/shared');
const { withTenantScope } = require('../middleware/tenant');
const { query } = require('../database');

const router = express.Router();

// Get all content
router.get('/', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { type, channel, status, tags, search, limit = 50, offset = 0 } = req.query;
    
    let query_str = 'SELECT * FROM mh_content_studio WHERE organization_id = $1';
    const params = [req.organizationId];
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
router.post('/', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { name, type, channel, content, scheduled_at, tags } = req.body;
    
    if (!name || !type || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await query(
      `INSERT INTO mh_content_studio (organization_id, name, type, channel, content, scheduled_at, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.organizationId, name, type, channel, content, scheduled_at, tags || []]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating content:', error);
    res.status(500).json({ error: 'Failed to create content' });
  }
});

// Get content by ID
router.get('/:id', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM mh_content_studio WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
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
router.put('/:id', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { name, type, channel, content, status, scheduled_at, tags } = req.body;
    
    const result = await query(
      `UPDATE mh_content_studio 
       SET name = $1, type = $2, channel = $3, content = $4, status = $5, 
           scheduled_at = $6, tags = $7, updated_at = now()
       WHERE id = $8 AND organization_id = $9
       RETURNING *`,
      [name, type, channel, content, status, scheduled_at, tags, req.params.id, req.organizationId]
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
router.delete('/:id', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM mh_content_studio WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
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
router.post('/:id/publish', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      `UPDATE mh_content_studio 
       SET status = 'published', updated_at = now()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [req.params.id, req.organizationId]
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
router.get('/:id/analytics', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const result = await query(
      'SELECT performance FROM mh_content_studio WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organizationId]
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
router.post('/generate', authenticate, requirePermission('campaigns:write'), withTenantScope, async (req, res) => {
  try {
    const { content_type, channel, ai_prompt, context } = req.body;
    
    if (!content_type || !ai_prompt) {
      return res.status(400).json({ error: 'Missing required fields for AI generation' });
    }
    
    // Call AI agent backend for real LLM generation
    const generatedContent = await generateAIContent(ai_prompt, { content_type, channel, context }, req.headers.authorization);
    
    res.json({ 
      content: generatedContent,
      generated_content: generatedContent,
      metadata: { content_type, channel, generated_at: new Date() }
    });
  } catch (error) {
    console.error('Error generating AI content:', error);
    res.status(500).json({ error: 'Failed to generate AI content' });
  }
});

// Get content calendar
router.get('/calendar/view', authenticate, requirePermission('campaigns:read'), withTenantScope, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let query_str = `SELECT * FROM mh_content_studio 
                    WHERE organization_id = $1 AND scheduled_at IS NOT NULL`;
    const params = [req.organizationId];
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

async function generateAIContent(prompt, options, authHeader) {
  // Real AI content generation using AI Agent Backend
  try {
    const { content_type, channel, context } = options;
    
    // Build the prompt for the AI
    const systemPrompt = `You are an expert marketing copywriter. Generate high-converting marketing content based on the user's requirements.`;
    
    const userPrompt = `Generate ${content_type} content for ${channel || 'general'} channel.
    
Requirements: ${prompt}

Context: ${JSON.stringify(context || {})}

Please generate compelling, professional marketing content that follows best practices for the specified channel. Include:
- Attention-grabbing headline/subject
- Clear value proposition
- Strong call-to-action
- Appropriate formatting for the channel`;

    // Call AI Agent Backend (AI Overview Service has LLM capabilities)
    const aiServiceUrl = process.env.AI_OVERVIEW_SERVICE_URL || 'http://ai-overview-service:4020';
    
    const response = await fetch(`${aiServiceUrl}/ai-agents/marketing-content/generate-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        prompt: userPrompt,
        content_type: content_type,
        channel: channel,
        context: context
      })
    });

    if (!response.ok) {
      throw new Error(`AI service returned ${response.status}`);
    }

    const data = await response.json();
    return data.content || data.generated_content || data.result || userPrompt;
    
  } catch (error) {
    console.error('AI generation error, falling back to template:', error);
    
    // Fallback to template-based generation
    const { content_type, channel } = options;
    const templates = {
      social_post: {
        whatsapp: `🔥 ${prompt}\n\nDon't miss out! Click the link below to learn more.\n\n#Marketing #Business`,
        email: `Subject: ${prompt}\n\nHello,\n\nI hope this email finds you well. ${prompt}\n\nBest regards,\nYour Marketing Team`,
        social: `${prompt} 🚀\n\n#Marketing #Growth #Business`,
        instagram: `${prompt} ✨\n\nDouble tap if you agree! �\n\n#Marketing #Business #Growth`,
        linkedin: `${prompt}\n\nWhat are your thoughts? 👇\n\n#Professional #Business #Growth`
      },
      email: {
        email: `Subject: ${prompt}\n\nHi there,\n\n${prompt}\n\nBest regards,\nThe Team`
      },
      ad_copy: {
        ads: `${prompt}\n\nLimited time offer. Act now!`
      },
      blog_outline: {
        blog: `# ${prompt}\n\n## Introduction\n- Hook\n- Thesis\n\n## Main Points\n- Point 1\n- Point 2\n- Point 3\n\n## Conclusion\n- Summary\n- Call to action`
      },
      whatsapp_message: {
        whatsapp: `👋 ${prompt}\n\nReply to learn more!`
      }
    };
    
    const channelTemplates = templates[content_type] || templates.social_post;
    return channelTemplates[channel] || channelTemplates.social || `${prompt}`;
  }
}

module.exports = router;
