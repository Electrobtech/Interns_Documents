const { pool } = require('@lead/shared');

// ---------- Accounts ----------

async function upsertAccounts(organizationId, accounts) {
  for (const a of accounts) {
    await pool.query(
      `INSERT INTO google_accounts (organization_id, account_id, account_name)
       VALUES ($1,$2,$3)
       ON CONFLICT (organization_id, account_id) DO UPDATE SET account_name=EXCLUDED.account_name`,
      [organizationId, a.accountId, a.accountName]
    );
  }
}

async function listAccounts(organizationId) {
  const { rows } = await pool.query(
    `SELECT account_id AS "accountId", account_name AS "accountName", created_at AS "createdAt"
     FROM google_accounts WHERE organization_id=$1 ORDER BY created_at`,
    [organizationId]
  );
  return rows;
}

// ---------- Locations ----------

async function upsertLocations(organizationId, accountId, locations) {
  for (const l of locations) {
    await pool.query(
      `INSERT INTO google_locations (organization_id, account_id, location_id, location_name, address, phone)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (organization_id, location_id) DO UPDATE SET
         account_id=EXCLUDED.account_id, location_name=EXCLUDED.location_name,
         address=EXCLUDED.address, phone=EXCLUDED.phone`,
      [organizationId, accountId, l.locationId, l.locationName, l.address, l.phone]
    );
  }
}

async function listLocations(organizationId, accountId) {
  const params = [organizationId];
  let sql = `SELECT account_id AS "accountId", location_id AS "locationId", location_name AS "locationName",
                    address, phone, is_selected AS "isSelected", created_at AS "createdAt"
             FROM google_locations WHERE organization_id=$1`;
  if (accountId) { params.push(accountId); sql += ` AND account_id=$${params.length}`; }
  sql += ` ORDER BY created_at`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function selectLocation(organizationId, locationId) {
  await pool.query(
    `UPDATE google_locations SET is_selected=false WHERE organization_id=$1`,
    [organizationId]
  );
  const { rows } = await pool.query(
    `UPDATE google_locations SET is_selected=true WHERE organization_id=$1 AND location_id=$2 RETURNING *`,
    [organizationId, locationId]
  );
  if (!rows[0]) {
    const err = new Error('Location not found');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function getAccountForLocation(organizationId, locationId) {
  const { rows } = await pool.query(
    `SELECT account_id AS "accountId" FROM google_locations WHERE organization_id=$1 AND location_id=$2`,
    [organizationId, locationId]
  );
  return rows[0]?.accountId || null;
}

// ---------- Reviews ----------

async function upsertReviews(organizationId, locationId, reviews) {
  let inserted = 0;
  let updated = 0;
  for (const r of reviews) {
    const { rows } = await pool.query(
      `INSERT INTO google_reviews (
         organization_id, location_id, review_id, reviewer_name, reviewer_photo_url,
         star_rating, comment, create_time, update_time, reply_comment, reply_update_time, synced_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
       ON CONFLICT (organization_id, review_id) DO UPDATE SET
         reviewer_name=EXCLUDED.reviewer_name,
         reviewer_photo_url=EXCLUDED.reviewer_photo_url,
         star_rating=EXCLUDED.star_rating,
         comment=EXCLUDED.comment,
         update_time=EXCLUDED.update_time,
         reply_comment=EXCLUDED.reply_comment,
         reply_update_time=EXCLUDED.reply_update_time,
         synced_at=now()
       RETURNING (xmax = 0) AS inserted`,
      [
        organizationId, locationId, r.reviewId, r.reviewerName, r.reviewerPhotoUrl,
        r.starRating, r.comment, r.createTime, r.updateTime, r.replyComment, r.replyUpdateTime,
      ]
    );
    if (rows[0]?.inserted) inserted += 1; else updated += 1;
  }
  return { inserted, updated };
}

async function listReviews(organizationId, { locationId, rating, replied, search, sort, page = 1, limit = 20 } = {}) {
  const params = [organizationId];
  let where = `organization_id=$1`;

  if (locationId) { params.push(locationId); where += ` AND location_id=$${params.length}`; }
  if (rating) { params.push(Number(rating)); where += ` AND star_rating=$${params.length}`; }
  if (replied === 'replied') where += ` AND reply_comment IS NOT NULL`;
  if (replied === 'pending') where += ` AND reply_comment IS NULL`;
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (reviewer_name ILIKE $${params.length} OR comment ILIKE $${params.length})`;
  }

  const countSql = `SELECT COUNT(*) FROM google_reviews WHERE ${where}`;

  let sql = `SELECT id, location_id AS "locationId", review_id AS "reviewId", reviewer_name AS "reviewerName",
                    reviewer_photo_url AS "reviewerPhotoUrl", star_rating AS "starRating", comment,
                    create_time AS "createTime", update_time AS "updateTime",
                    reply_comment AS "replyComment", reply_update_time AS "replyUpdateTime"
             FROM google_reviews WHERE ${where}`;

  sql += sort === 'oldest' ? ` ORDER BY create_time ASC` : ` ORDER BY create_time DESC`;
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  params.push(safeLimit, (safePage - 1) * safeLimit);
  sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(sql, params),
    pool.query(countSql, params.slice(0, params.length - 2)),
  ]);

  return { rows, total: Number(countRows[0]?.count || 0), page: safePage, limit: safeLimit };
}

async function getStatistics(organizationId, locationId) {
  const params = [organizationId];
  let where = `organization_id=$1`;
  if (locationId) { params.push(locationId); where += ` AND location_id=$${params.length}`; }

  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COALESCE(AVG(star_rating), 0)::float AS "averageRating",
       COUNT(*) FILTER (WHERE star_rating = 5)::int AS "star5",
       COUNT(*) FILTER (WHERE star_rating = 4)::int AS "star4",
       COUNT(*) FILTER (WHERE star_rating = 3)::int AS "star3",
       COUNT(*) FILTER (WHERE star_rating = 2)::int AS "star2",
       COUNT(*) FILTER (WHERE star_rating = 1)::int AS "star1",
       COUNT(*) FILTER (WHERE reply_comment IS NULL)::int AS "pendingReplies",
       COUNT(*) FILTER (WHERE reply_comment IS NOT NULL)::int AS "completedReplies",
       MAX(create_time) AS "latestReviewAt"
     FROM google_reviews WHERE ${where}`,
    params
  );

  const { rows: monthly } = await pool.query(
    `SELECT to_char(date_trunc('month', create_time), 'YYYY-MM') AS month, COUNT(*)::int AS count
     FROM google_reviews WHERE ${where} AND create_time IS NOT NULL
     GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
    params
  );

  const { rows: replyTrend } = await pool.query(
    `SELECT to_char(date_trunc('month', reply_update_time), 'YYYY-MM') AS month, COUNT(*)::int AS count
     FROM google_reviews WHERE ${where} AND reply_update_time IS NOT NULL
     GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
    params
  );

  return { ...rows[0], monthlyReviews: monthly.reverse(), replyTrend: replyTrend.reverse() };
}

async function setReply(organizationId, reviewId, replyComment, replyUpdateTime) {
  const { rows } = await pool.query(
    `UPDATE google_reviews SET reply_comment=$3, reply_update_time=$4
     WHERE organization_id=$1 AND review_id=$2 RETURNING *`,
    [organizationId, reviewId, replyComment, replyUpdateTime]
  );
  return rows[0] || null;
}

async function getReview(organizationId, reviewId) {
  const { rows } = await pool.query(
    `SELECT * FROM google_reviews WHERE organization_id=$1 AND review_id=$2`,
    [organizationId, reviewId]
  );
  return rows[0] || null;
}

module.exports = {
  upsertAccounts, listAccounts,
  upsertLocations, listLocations, selectLocation, getAccountForLocation,
  upsertReviews, listReviews, getStatistics, setReply, getReview,
};
