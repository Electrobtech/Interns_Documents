import express from 'express';
import multer from 'multer';
import pool from '../db/client.js';
import loadConnection from '../lib/loadConnection.js';
import { requireScope } from '../lib/scopes.js';
import { linkedinClient, callLinkedIn } from '../lib/linkedinApi.js';
import { uploadImage, uploadVideo } from '../lib/mediaUpload.js';

const router = express.Router();
router.use(loadConnection);

// In-memory is fine here — the file is immediately streamed on to LinkedIn
// and never needs to touch our own disk. 200MB covers LinkedIn's own image
// (36MB) and typical short-form video limits with headroom.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

// POST /posts/media — upload an image or video to LinkedIn ahead of
// publishing, so the compose UI can preview it before the post is sent. The
// returned urn gets passed back on POST /posts to attach it.
router.post('/posts/media', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  const isVideo = req.file.mimetype.startsWith('video/');
  const isImage = req.file.mimetype.startsWith('image/');
  if (!isVideo && !isImage) {
    return res.status(400).json({ error: 'unsupported_file_type', message: 'Only image/* or video/* files are supported.' });
  }

  const author = authorUrn(req.linkedinConnection, req.body.as_organization === 'true');
  if (!author) {
    return res.status(400).json({ error: 'no_organization_connected', message: 'No LinkedIn organization page is connected.' });
  }

  const result = isVideo
    ? await uploadVideo(req.linkedinConnection.access_token, author, req.file.buffer)
    : await uploadImage(req.linkedinConnection.access_token, author, req.file.buffer);

  if (!result.ok) {
    return res.status(result.status || 502).json({ error: 'linkedin_media_upload_failed', detail: result.body });
  }
  res.status(201).json({ urn: result.urn, type: result.type });
});

function authorUrn(conn, asOrganization) {
  if (asOrganization) {
    if (!conn.linkedin_org_urn) return null;
    return conn.linkedin_org_urn.startsWith('urn:li:organization:')
      ? conn.linkedin_org_urn
      : `urn:li:organization:${conn.linkedin_org_urn}`;
  }
  return `urn:li:person:${conn.linkedin_user_id}`;
}

// POST /posts — publish a post. Member posts (w_member_social) work for any
// connected app instantly; organization posts (as_organization: true) need
// w_organization_social, which requireScope gates behind partner approval.
router.post('/posts', async (req, res) => {
  const { text, as_organization, media_urn, media_type } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  if (as_organization) {
    const granted = req.linkedinConnection.granted_scopes || [];
    if (!granted.includes('w_organization_social')) {
      return res.status(403).json({
        error: 'linkedin_partner_access_required',
        scope: 'w_organization_social',
        message: 'Posting as your organization page needs LinkedIn Marketing Developer Platform approval for the "w_organization_social" scope.',
      });
    }
  }

  const author = authorUrn(req.linkedinConnection, as_organization);
  if (!author) {
    return res.status(400).json({ error: 'no_organization_connected', message: 'No LinkedIn organization page is connected.' });
  }

  const client = linkedinClient(req.linkedinConnection.access_token);
  const result = await callLinkedIn(() => client.post('/rest/posts', {
    author,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
    // Attaches whatever /posts/media returned. `id` must be an urn:li:image
    // or urn:li:video from a completed upload — LinkedIn rejects the post
    // outright if the media isn't finished processing yet.
    ...(media_urn ? { content: { media: { id: media_urn } } } : {}),
  }));

  if (!result.ok) {
    return res.status(result.status).json({ error: 'linkedin_post_failed', detail: result.body });
  }

  // LinkedIn returns the new post's URN in the x-restli-id response header,
  // not the body, on a 201 Created.
  const postUrn = result.data?.id || result.headers?.['x-restli-id'] || null;

  const { rows } = await pool.query(`
    INSERT INTO linkedin_posts (user_id, post_urn, author_urn, as_organization, text, status, media_urn, media_type, published_at)
    VALUES ($1, $2, $3, $4, $5, 'published', $6, $7, NOW())
    RETURNING *
  `, [req.user?.id || 'default_user', postUrn, author, !!as_organization, text, media_urn || null, media_type || null]);

  res.status(201).json(rows[0]);
});

// GET /posts — our published posts, most recent first (from local cache;
// call /posts/:id/sync to refresh metrics for any one of them from LinkedIn).
router.get('/posts', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM linkedin_posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user?.id || 'default_user']
    );
    res.json({ posts: rows });
  } catch (error) {
    console.error('List posts error:', error);
    res.status(500).json({ error: 'Failed to list posts' });
  }
});

// GET /posts/:id — one post, refreshed live from LinkedIn if reachable
// (falls back to the last cached copy if the live call fails).
router.get('/posts/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM linkedin_posts WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user?.id || 'default_user']
  );
  const post = rows[0];
  if (!post) return res.status(404).json({ error: 'not_found' });

  const client = linkedinClient(req.linkedinConnection.access_token);
  const result = await callLinkedIn(() => client.get(`/rest/posts/${encodeURIComponent(post.post_urn)}`));
  if (result.ok) {
    return res.json({ ...post, live: result.data });
  }
  res.json({ ...post, live: null, live_error: result.body });
});

// POST /posts/:id/sync — pull the post's current social-action counts
// (likes/comments/shares) from LinkedIn and cache them.
router.post('/posts/:id/sync', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM linkedin_posts WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user?.id || 'default_user']
  );
  const post = rows[0];
  if (!post) return res.status(404).json({ error: 'not_found' });

  const client = linkedinClient(req.linkedinConnection.access_token);
  const result = await callLinkedIn(() => client.get(
    `/rest/socialActions/${encodeURIComponent(post.post_urn)}`
  ));
  if (!result.ok) {
    return res.status(result.status).json({ error: 'linkedin_sync_failed', detail: result.body });
  }

  const metrics = {
    likes_count: result.data?.likesSummary?.totalLikes ?? 0,
    comments_count: result.data?.commentsSummary?.totalFirstLevelComments ?? 0,
  };
  const { rows: updated } = await pool.query(
    'UPDATE linkedin_posts SET metrics = $1, last_synced_at = NOW() WHERE id = $2 RETURNING *',
    [metrics, post.id]
  );
  res.json(updated[0]);
});

// DELETE /posts/:id — remove from LinkedIn and our cache.
router.delete('/posts/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM linkedin_posts WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user?.id || 'default_user']
  );
  const post = rows[0];
  if (!post) return res.status(404).json({ error: 'not_found' });

  const client = linkedinClient(req.linkedinConnection.access_token);
  const result = await callLinkedIn(() => client.delete(`/rest/posts/${encodeURIComponent(post.post_urn)}`));
  if (!result.ok && result.status !== 404) {
    return res.status(result.status).json({ error: 'linkedin_delete_failed', detail: result.body });
  }

  await pool.query('DELETE FROM linkedin_posts WHERE id = $1', [post.id]);
  res.json({ status: 'deleted' });
});

export default router;
