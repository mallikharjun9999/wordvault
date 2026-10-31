/**
 * Provider abstraction. A "client" exposes: { provider, model, complete({system, user, maxTokens}) -> Promise<string> }.
 * Providers: 'anthropic' (Messages API) and 'openai' (any OpenAI-compatible /chat/completions endpoint).
 * No SDK dependency, no automatic retries (explicit user retry only, to control cost).
 * Keys exist only server-side.
 */
import { config } from '../config/env.js';
import { unavailable, AppError } from '../utils/AppError.js';

const overrides = {}; // test hook: setLlmOverride('ai', client | null)
export const setLlmOverride = (purpose, client) => { if (client) overrides[purpose] = client; else delete overrides[purpose]; };

async function postJson(url, headers, body, timeoutMs) {
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    throw new AppError(504, timeout ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNREACHABLE', timeout ? 'The AI provider took too long to respond.' : 'Could not reach the AI provider.');
  }
  if (!res.ok) {
    const code = res.status === 401 || res.status === 403 ? 'PROVIDER_AUTH_FAILED' : res.status === 429 ? 'PROVIDER_RATE_LIMITED' : 'PROVIDER_ERROR';
    throw new AppError(502, code, `The AI provider returned an error (HTTP ${res.status}).`); // provider body deliberately not echoed
  }
  try { return await res.json(); } catch { throw new AppError(502, 'PROVIDER_BAD_RESPONSE', 'The AI provider returned an unreadable response.'); }
}

function anthropicClient(c) {
  return {
    provider: 'anthropic', model: c.model,
    async complete({ system, user, maxTokens = 4000 }) {
      const data = await postJson(c.baseUrl || 'https://api.anthropic.com/v1/messages',
        { 'x-api-key': c.apiKey, 'anthropic-version': '2023-06-01' },
        { model: c.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }, c.timeoutMs);
      return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    },
  };
}
function openaiClient(c) {
  const base = (c.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  return {
    provider: 'openai', model: c.model,
    async complete({ system, user, maxTokens = 4000 }) {
      const data = await postJson(`${base}/chat/completions`, c.apiKey ? { authorization: `Bearer ${c.apiKey}` } : {},
        { model: c.model, max_tokens: maxTokens, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }, c.timeoutMs);
      return data?.choices?.[0]?.message?.content ?? '';
    },
  };
}

export function getClient(purpose = 'ai') {
  if (overrides[purpose]) return overrides[purpose];
  const c = config.ai;
  if (!c.provider) throw unavailable('AI generation is not configured. Set AI_PROVIDER, AI_MODEL and AI_API_KEY in .env. You can still add and edit words manually.', 'AI_NOT_CONFIGURED');
  if (!c.model) throw unavailable('AI_MODEL is not set in .env.', 'AI_NOT_CONFIGURED');
  if (c.provider === 'anthropic') {
    if (!c.apiKey) throw unavailable('AI_API_KEY is not set in .env.', 'AI_NOT_CONFIGURED');
    return anthropicClient(c);
  }
  if (c.provider === 'openai') {
    // Local servers (Ollama) need no key; hosted ones do.
    if (!c.apiKey && !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(c.baseUrl)) throw unavailable('AI_API_KEY is not set in .env.', 'AI_NOT_CONFIGURED');
    return openaiClient(c);
  }
  throw unavailable(`Unknown AI provider "${c.provider}". Use "anthropic" or "openai".`, 'AI_NOT_CONFIGURED');
}
export function aiStatus(purpose = 'ai') {
  try { const c = getClient(purpose); return { configured: true, provider: c.provider, model: c.model }; }
  catch (e) { return { configured: false, reason: e.message }; }
}

/** Extracts and parses a JSON object from model text (tolerates code fences / leading prose). */
export function parseJsonLoose(text) {
  if (typeof text !== 'string' || !text.trim()) throw new AppError(502, 'PROVIDER_EMPTY', 'The AI provider returned an empty response.');
  if (text.length > 200_000) throw new AppError(502, 'PROVIDER_TOO_LARGE', 'The AI response was too large.');
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = stripped.indexOf('{'); const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AppError(502, 'PROVIDER_INVALID_JSON', 'The AI response was not valid JSON.');
  try { return JSON.parse(stripped.slice(start, end + 1)); }
  catch { throw new AppError(502, 'PROVIDER_INVALID_JSON', 'The AI response was not valid JSON.'); }
}
