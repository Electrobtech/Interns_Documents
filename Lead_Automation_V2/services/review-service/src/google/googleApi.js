// Google Business Profile is split across a couple of API hosts:
//  - Account Management: accounts.list
//  - Business Information: locations.list
//  - the legacy "My Business API v4" host still owns reviews (list/reply),
//    since reviews management hasn't been ported to the newer v1 APIs yet.
const ACCOUNT_MGMT = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const BUSINESS_INFO = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const MYBUSINESS_V4 = 'https://mybusiness.googleapis.com/v4';

async function googleFetch(url, accessToken, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = data?.error?.message || res.statusText || 'Google API request failed';
    const err = new Error(message);
    err.status = res.status === 401 || res.status === 403 ? 401 : 502;
    throw err;
  }
  return data;
}

// accounts.list — GET /v1/accounts
async function listAccounts(accessToken) {
  const data = await googleFetch(`${ACCOUNT_MGMT}/accounts`, accessToken);
  return (data.accounts || []).map((a) => ({
    accountId: a.name, // "accounts/{id}"
    accountName: a.accountName || a.name,
  }));
}

// locations.list — GET /v1/{accountId}/locations
async function listLocations(accessToken, accountId) {
  const readMask = 'name,title,phoneNumbers,storefrontAddress';
  const url = `${BUSINESS_INFO}/${accountId}/locations?readMask=${encodeURIComponent(readMask)}&pageSize=100`;
  const data = await googleFetch(url, accessToken);
  return (data.locations || []).map((l) => ({
    locationId: l.name, // "locations/{id}"
    locationName: l.title || l.name,
    address: formatAddress(l.storefrontAddress),
    phone: l.phoneNumbers?.primaryPhone || null,
  }));
}

function formatAddress(addr) {
  if (!addr) return null;
  const parts = [
    ...(addr.addressLines || []),
    addr.locality,
    addr.administrativeArea,
    addr.postalCode,
    addr.regionCode,
  ].filter(Boolean);
  return parts.join(', ') || null;
}

// accounts.locations.reviews.list — GET /v4/{accountId}/{locationId}/reviews
async function listReviews(accessToken, accountId, locationId, pageToken) {
  const url = new URL(`${MYBUSINESS_V4}/${accountId}/${locationId}/reviews`);
  url.searchParams.set('pageSize', '50');
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const data = await googleFetch(url.toString(), accessToken);
  return {
    reviews: (data.reviews || []).map(mapReview),
    nextPageToken: data.nextPageToken || null,
    averageRating: data.averageRating,
    totalReviewCount: data.totalReviewCount,
  };
}

function mapReview(r) {
  return {
    reviewId: r.reviewId || (r.name || '').split('/').pop(),
    reviewerName: r.reviewer?.displayName || 'Anonymous',
    reviewerPhotoUrl: r.reviewer?.profilePhotoUrl || null,
    starRating: starRatingToNumber(r.starRating),
    comment: r.comment || '',
    createTime: r.createTime || null,
    updateTime: r.updateTime || null,
    replyComment: r.reviewReply?.comment || null,
    replyUpdateTime: r.reviewReply?.updateTime || null,
  };
}

function starRatingToNumber(v) {
  const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  if (typeof v === 'number') return v;
  return map[v] || null;
}

// accounts.locations.reviews.updateReply — PUT /v4/{accountId}/{locationId}/reviews/{reviewId}/reply
async function updateReply(accessToken, accountId, locationId, reviewId, comment) {
  const url = `${MYBUSINESS_V4}/${accountId}/${locationId}/reviews/${reviewId}/reply`;
  const data = await googleFetch(url, accessToken, {
    method: 'PUT',
    body: JSON.stringify({ comment }),
  });
  return { replyComment: data.comment || comment, replyUpdateTime: data.updateTime || new Date().toISOString() };
}

// DELETE reply — DELETE /v4/{accountId}/{locationId}/reviews/{reviewId}/reply
async function deleteReply(accessToken, accountId, locationId, reviewId) {
  await googleFetch(`${MYBUSINESS_V4}/${accountId}/${locationId}/reviews/${reviewId}/reply`, accessToken, {
    method: 'DELETE',
  });
}

module.exports = { listAccounts, listLocations, listReviews, updateReply, deleteReply };
