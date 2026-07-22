// services/automation-service/src/services/keywordMatcher.js
//
// Pure, DB-free keyword-matching logic for the `keyword_auto_reply` node
// type (see workflowEngine.js and flow-schema.md §keyword_auto_reply).
//
// A `keyword_auto_reply` node lets an organization configure a set of
// categories (Pricing, Services, Contact, ...), each with its own keyword
// list and canned response. An inbound free-text message is normalized,
// matched against every category, and every matched category's response is
// combined (deduplicated) into a single outbound message — falling back to
// a configurable default response when nothing matches. This mirrors the
// behavior requested for the standalone Instagram DM auto-reply spec, just
// implemented as one more node type inside the existing flow engine so it
// gets sessions, multi-tenancy, conversation logging, and delivery for free.

/**
 * Normalizes a raw message for matching:
 *  - lowercases
 *  - strips punctuation (keeps letters, digits, and whitespace)
 *  - collapses repeated whitespace
 *  - trims
 *
 * "Hi, can you tell me your PRICE?" -> "hi can you tell me your price"
 */
function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // strip punctuation, keep unicode letters/digits
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes a single keyword the same way messages are normalized, so a
 * multi-word keyword like "working hours" matches correctly regardless of
 * the punctuation/casing the org configured it with.
 */
function normalizeKeyword(keyword) {
  return normalizeText(keyword);
}

/**
 * Returns true if `normalizedText` contains `normalizedKeyword` as a
 * word-boundary-respecting substring (so "cost" doesn't match "forecaster").
 * Falls back to a plain substring test for keywords containing characters
 * word-boundary regex can't cleanly wrap (defensive; normalizeText already
 * strips punctuation so this should be rare).
 */
function containsKeyword(normalizedText, normalizedKeyword) {
  if (!normalizedKeyword) return false;
  try {
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`, 'u');
    return pattern.test(` ${normalizedText} `);
  } catch {
    return normalizedText.includes(normalizedKeyword);
  }
}

/**
 * Matches normalized message text against every configured category.
 *
 * @param {string} normalizedText
 * @param {Array<{id?: string, name: string, keywords: string[], response: string}>} categories
 * @returns {Array<{id?: string, name: string, response: string}>} every category that matched, in configured order
 */
function matchCategories(normalizedText, categories = []) {
  const matched = [];
  for (const category of categories) {
    const keywords = category.keywords || [];
    const hit = keywords.some((kw) => containsKeyword(normalizedText, normalizeKeyword(kw)));
    if (hit) matched.push(category);
  }
  return matched;
}

/**
 * Builds the final outbound reply text for an inbound message:
 *  - normalizes the message
 *  - matches every category
 *  - joins each matched category's response, in configured category order,
 *    deduplicating identical response strings so e.g. two categories that
 *    happen to share a response don't repeat it
 *  - falls back to `defaultResponse` when nothing matched
 *
 * @param {Object} params
 * @param {string} params.rawText - the customer's raw message text
 * @param {Array} params.categories
 * @param {string} params.defaultResponse
 * @param {string} [params.separator] - joiner between combined responses (default: two newlines)
 * @returns {{ replyText: string, matchedCategories: string[], normalizedText: string }}
 */
function buildReply({ rawText, categories = [], defaultResponse, separator = '\n\n' }) {
  const normalizedText = normalizeText(rawText);
  const matched = matchCategories(normalizedText, categories);

  if (matched.length === 0) {
    return {
      replyText: defaultResponse || "Thank you for your message. We couldn't identify your request. Please describe your question in more detail or contact our support team.",
      matchedCategories: [],
      normalizedText,
    };
  }

  const seen = new Set();
  const parts = [];
  for (const category of matched) {
    const response = (category.response || '').trim();
    if (!response || seen.has(response)) continue;
    seen.add(response);
    parts.push(response);
  }

  return {
    replyText: parts.join(separator),
    matchedCategories: matched.map((c) => c.name),
    normalizedText,
  };
}

module.exports = { normalizeText, normalizeKeyword, containsKeyword, matchCategories, buildReply };