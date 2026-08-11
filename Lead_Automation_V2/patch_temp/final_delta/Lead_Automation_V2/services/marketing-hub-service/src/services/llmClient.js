/**
 * src/services/llmClient.js
 *
 * The one real external call this service is allowed to make, per the
 * project's own constraint: no WhatsApp/Meta/LinkedIn business API keys
 * yet (see providers/*.js + deliverySimulator.js for how sends are
 * stubbed), but an LLM API key already exists in .env (LLM_PROVIDER=groq,
 * GROQ_API_KEY / GROQ_BASE_URL / GROQ_MODEL). Content Studio's "Generate"
 * and Campaigns' "AI Optimize" both route through here instead of
 * fabricating text client-side or with a hardcoded template.
 *
 * Talks OpenAI-compatible /chat/completions — Groq's API is an
 * OpenAI-compatible superset, so this same client works unmodified if
 * LLM_PROVIDER is later pointed at any other OpenAI-compatible endpoint
 * (including a local Ollama via LLM_FALLBACK_PROVIDER).
 */

const BASE_URL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
const API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/**
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {{ temperature?: number, maxTokens?: number, json?: boolean }} opts
 * @returns {Promise<string>} the model's raw text reply
 */
async function complete(systemPrompt, userPrompt, opts = {}) {
  if (!API_KEY) {
    throw new Error('No LLM API key configured (GROQ_API_KEY is missing from the environment).');
  }

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 700,
  };
  if (opts.json) body.response_format = { type: 'json_object' };

  const resp = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`LLM request failed (${resp.status}): ${text.slice(0, 300)}`);
  }

  const data = await resp.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error('LLM returned an empty response.');
  return reply;
}

/** Convenience wrapper that expects (and parses) a strict JSON object reply. */
async function completeJSON(systemPrompt, userPrompt, opts = {}) {
  const raw = await complete(systemPrompt, userPrompt, { ...opts, json: true });
  try {
    return JSON.parse(raw);
  } catch {
    // Some models still wrap JSON in ```fences even when asked not to.
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('LLM did not return valid JSON.');
  }
}

module.exports = { complete, completeJSON };
