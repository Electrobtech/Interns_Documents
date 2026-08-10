/**
 * src/contactWriter.js
 *
 * Transactional "records -> contacts table" writer. Extracted out of
 * importRoutes.js (POST /contacts/import) so the Google Sheets import
 * (sheetsRoutes.js) can write through the exact same insert/update/dedupe
 * path instead of re-implementing it — one place to fix if the matching or
 * COALESCE rules ever need to change.
 *
 * Callers are responsible for BEGIN/COMMIT/ROLLBACK on the client they pass
 * in, and for building `records` via importer.js's buildRecords() +
 * markInFileDuplicates() first.
 */

/**
 * @param {import('pg').PoolClient} client - inside an open transaction
 * @param {string} organizationId
 * @param {Array} records - unique records from markInFileDuplicates().unique
 * @param {'skip'|'update'} onDuplicate
 * @returns {Promise<{result: object, failures: Array}>}
 */
async function writeContacts(client, organizationId, records, onDuplicate) {
  const result = { inserted: 0, updated: 0, skipped: 0, failed: 0 };
  const failures = [];

  for (const rec of records) {
    try {
      // Match an existing contact on either reachable identity. Phone/email
      // are the real identities. For rows that carry neither, fall back to
      // name+source so re-running the same import does not duplicate them
      // on every pass.
      const { rows: found } = rec.phone || rec.email
        ? await client.query(
          `SELECT id FROM contacts
            WHERE organization_id = $1
              AND ( ($2::text IS NOT NULL AND phone = $2)
                 OR ($3::text IS NOT NULL AND lower(email) = lower($3)) )
            LIMIT 1`,
          [organizationId, rec.phone, rec.email]
        )
        : await client.query(
          `SELECT id FROM contacts
            WHERE organization_id = $1 AND name IS NOT DISTINCT FROM $2
              AND source IS NOT DISTINCT FROM $3
            LIMIT 1`,
          [organizationId, rec.name, rec.source]
        );

      if (found.length) {
        if (onDuplicate === 'update') {
          // COALESCE so an empty cell in the source never blanks existing data.
          await client.query(
            `UPDATE contacts SET
               name   = COALESCE($2, name),
               email  = COALESCE($3, email),
               phone  = COALESCE($4, phone),
               source = COALESCE($5, source),
               notes  = COALESCE($6, notes),
               tags   = (SELECT ARRAY(SELECT DISTINCT unnest(tags || $7::text[])))
             WHERE id = $1`,
            [found[0].id, rec.name, rec.email, rec.phone, rec.source, rec.notes, rec.tags]
          );
          result.updated++;
        } else {
          result.skipped++;
        }
        continue;
      }

      await client.query(
        `INSERT INTO contacts (organization_id, name, email, phone, source, notes, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [organizationId, rec.name, rec.email, rec.phone, rec.source, rec.notes, rec.tags]
      );
      result.inserted++;
    } catch (rowErr) {
      // One malformed row must not lose the rest of the import.
      result.failed++;
      failures.push({ rowNumber: rec.rowNumber, level: 'error', message: rowErr.message });
      console.error('[contact-import] row failed', { row: rec.rowNumber, err: rowErr.message });
    }
  }

  return { result, failures };
}

/** Same identity rule as writeContacts' match, used for the preview's "already in DB" count. */
async function countExisting(pool, organizationId, records) {
  const phones = records.map((r) => r.phone).filter(Boolean);
  const emails = records.map((r) => r.email).filter(Boolean);
  if (!phones.length && !emails.length) return { matched: 0 };

  const { rows } = await pool.query(
    `SELECT phone, lower(email) AS email FROM contacts
      WHERE organization_id = $1
        AND (phone = ANY($2::text[]) OR lower(email) = ANY($3::text[]))`,
    [organizationId, phones, emails.map((e) => e.toLowerCase())]
  );
  const existingPhones = new Set(rows.map((r) => r.phone).filter(Boolean));
  const existingEmails = new Set(rows.map((r) => r.email).filter(Boolean));

  let matched = 0;
  for (const r of records) {
    if ((r.phone && existingPhones.has(r.phone)) || (r.email && existingEmails.has(r.email.toLowerCase()))) matched++;
  }
  return { matched };
}

module.exports = { writeContacts, countExisting };
