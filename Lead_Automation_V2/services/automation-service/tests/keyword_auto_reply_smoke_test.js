// Pure logic smoke test (no database) for keywordMatcher.js and the
// keyword_auto_reply node's self-looping walk behavior, mirroring the style
// of smoke_test.js.
const assert = require('assert');
const { normalizeText, buildReply } = require('../src/services/keywordMatcher');
const flow = require('../src/seeds/instagram-keyword-auto-reply.json');

// --- normalizeText -----------------------------------------------------
assert.strictEqual(
  normalizeText('Hi, can you tell me your PRICE?'),
  'hi can you tell me your price',
  'normalizeText mismatch'
);
console.log('normalizeText OK');

// --- single-category match ----------------------------------------------
const node = flow.nodes.find((n) => n.id === 'node_keyword_router');
const single = buildReply({
  rawText: 'What is your pricing?',
  categories: node.data.categories,
  defaultResponse: node.data.defaultResponse,
});
assert.deepStrictEqual(single.matchedCategories, ['Pricing'], 'single-category match mismatch');
console.log('Single-category match:', single.matchedCategories);

// --- multi-category match, combined without duplication -----------------
const combined = buildReply({
  rawText: 'What are your services and pricing?',
  categories: node.data.categories,
  defaultResponse: node.data.defaultResponse,
});
assert.deepStrictEqual(combined.matchedCategories, ['Pricing', 'Services'], 'multi-category match mismatch');
assert.ok(combined.replyText.includes('999'), 'combined reply missing pricing response');
assert.ok(combined.replyText.includes('Lead Automation'), 'combined reply missing services response');
console.log('Multi-category combined reply:\n', combined.replyText);

// --- no match -> default response ---------------------------------------
const noMatch = buildReply({
  rawText: 'asdkjasndkj random gibberish',
  categories: node.data.categories,
  defaultResponse: node.data.defaultResponse,
});
assert.deepStrictEqual(noMatch.matchedCategories, [], 'expected no category matches');
assert.strictEqual(noMatch.replyText, node.data.defaultResponse, 'expected default response');
console.log('No-match default response OK');

// --- word-boundary safety: "cost" must not match inside "forecaster" ----
const noFalseMatch = buildReply({
  rawText: 'I am a forecaster by trade',
  categories: node.data.categories,
  defaultResponse: node.data.defaultResponse,
});
assert.deepStrictEqual(noFalseMatch.matchedCategories, [], 'false positive substring match on "cost"');
console.log('Word-boundary match OK (no false positive on "forecaster")');

// --- self-loop: node's own nextNodeId points back at itself --------------
assert.strictEqual(node.data.nextNodeId, node.id, 'keyword_auto_reply node must self-loop');
console.log('Self-loop wiring OK');

console.log('All keyword_auto_reply assertions passed.');