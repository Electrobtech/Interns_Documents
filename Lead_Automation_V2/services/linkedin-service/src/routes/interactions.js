import express from 'express';
import pool from '../db/client.js';
import loadConnection from '../lib/loadConnection.js';
import { linkedinClient, callLinkedIn } from '../lib/linkedinApi.js';

const router = express.Router();
router.use(loadConnection);

async function ownedPost(req, res) {
  const { rows } = await pool.query(
    'SELECT * FROM linkedin_posts WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user?.id || 'default_user']
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'not_found' });
    return null;
  }
  return rows[0];
}

// GET /posts/:id/comments — comments on one of our posts (Community
// Management API — reading YOUR OWN post's comments works with
// w_member_social; reading an organization post's comments needs the
// partner-gated r_organization_social scope, same as posting does).
router.get('/posts/:id/comments', async (req, res) => {
  const post = await ownedPost(req, res);
  if (!post) return;

  const client = linkedinClient(req.linkedinConnection.access_token);
  const result = await callLinkedIn(() => client.get(
    `/rest/socialActions/${encodeURIComponent(post.post_urn)}/comments`
  ));
  if (!result.ok) {
    return res.status(result.status).json({ error: 'linkedin_comments_failed', detail: result.body });
  }
  const comments = result.data?.elements || [];

  // Cache locally so the thread is viewable even if a later live call fails.
  await pool.query(
    'UPDATE linkedin_posts SET comments_cache = $1, comments_synced_at = NOW() WHERE id = $2',
    [JSON.stringify(comments), post.id]
  );
  res.json({ comments });
});

// POST /posts/:id/comments — reply to / comment on our own post.
router.post('/posts/:id/comments', async (req, res) => {
  const post = await ownedPost(req, res);
  if (!post) return;
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

  const client = linkedinClient(req.linkedinConnection.access_token);
  const result = await callLinkedIn(() => client.post(
    `/rest/socialActions/${encodeURIComponent(post.post_urn)}/comments`,
    { actor: post.author_urn, message: { text } }
  ));
  if (!result.ok) {
    return res.status(result.status).json({ error: 'linkedin_comment_failed', detail: result.body });
  }
  res.status(201).json(result.data || { status: 'posted' });
});

// GET /posts/:id/reactions — who liked/reacted to the post + total count.
router.get('/posts/:id/reactions', async (req, res) => {
  const post = await ownedPost(req, res);
  if (!post) return;

  const client = linkedinClient(req.linkedinConnection.access_token);
  const result = await callLinkedIn(() => client.get(
    `/rest/socialActions/${encodeURIComponent(post.post_urn)}/likes`
  ));
  if (!result.ok) {
    return res.status(result.status).json({ error: 'linkedin_reactions_failed', detail: result.body });
  }
  res.json({ reactions: result.data?.elements || [], total: result.data?.paging?.total ?? 0 });
});

// POST /posts/:id/reactions — like our own post (mostly useful for testing
// the interaction loop end-to-end).
router.post('/posts/:id/reactions', async (req, res) => {
  const post = await ownedPost(req, res);
  if (!post) return;

  const client = linkedinClient(req.linkedinConnection.access_token);
  const result = await callLinkedIn(() => client.post(
    `/rest/socialActions/${encodeURIComponent(post.post_urn)}/likes`,
    { actor: post.author_urn }
  ));
  if (!result.ok) {
    return res.status(result.status).json({ error: 'linkedin_reaction_failed', detail: result.body });
  }
  res.status(201).json({ status: 'liked' });
});

export default router;
