import axios from 'axios';

// LinkedIn's current REST API (as opposed to the legacy /v2/* endpoints,
// most of which are sunset) requires a LinkedIn-Version header pinned to a
// specific monthly release. Centralized here so every route talks to the
// same API surface the same way.
const API_VERSION = process.env.LINKEDIN_API_VERSION || '202606';

export function linkedinClient(accessToken) {
  return axios.create({
    baseURL: 'https://api.linkedin.com',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
  });
}

// Wraps a LinkedIn API call so a token/permission failure surfaces as a
// clean { status, body } the route can forward, instead of an unhandled
// axios rejection turning into a bare 500.
export async function callLinkedIn(fn) {
  try {
    const resp = await fn();
    return { ok: true, data: resp.data, status: resp.status, headers: resp.headers };
  } catch (err) {
    const status = err.response?.status || 502;
    const body = err.response?.data || { message: err.message };
    console.error('LinkedIn API error:', status, JSON.stringify(body).slice(0, 500));
    return { ok: false, status, body };
  }
}
