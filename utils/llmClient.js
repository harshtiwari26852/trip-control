// Generic structured-JSON LLM client used by the TripWise endpoints.
//
// It reuses the project's provider wiring (Gemini, Groq and OpenAI/ChatGPT,
// keys read from the environment, never shipped to the browser). Every call:
//   - sends a system + user prompt with response_mime_type json_object
//   - applies a timeout (default 60s)
//   - strips Markdown fences and braces the raw text into the first JSON object
//   - retries once on a JSON-parse failure and on quota/transient errors
//   - if a provider fails, automatically moves on to the next enabled provider
//     (Gemini → Groq → OpenAI), so a single outage never 502s the request.
// Returns { data, source, raw }.
//
// No API keys are ever logged.

const { keys, status } = require('./apiKeys');
const { log } = require('./logger');

const DEFAULT_TIMEOUT_MS = 60 * 1000;
const MAX_PARSE_ATTEMPTS = 2;
// Cap the sleep before a Gemini quota retry so a long rate-limit window cannot
// block a request for minutes.
const MAX_QUOTA_WAIT_MS = 15 * 1000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientStatus(statusCode) {
  return statusCode === 408 || statusCode === 409 || statusCode === 429 || statusCode >= 500;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Extract the first balanced JSON object from model text, tolerating fences,
// leading prose and trailing noise. Returns the parsed value or throws.
function extractJson(text, provider) {
  const raw = String(text || '');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  let candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) candidate = candidate.slice(start, end + 1);
  try {
    return { value: JSON.parse(candidate) };
  } catch (cause) {
    const err = new Error(`${provider} returned text that is not valid JSON`);
    err.code = 'AI_PROVIDER_FAILED';
    err.retryable = true;
    err.cause = cause;
    throw err;
  }
}

function isQuotaError(status, detail) {
  return status === 429 ||
    (status === 403 && /(quota|rate.?limit|resource exhausted|limit exceeded)/i.test(detail || ''));
}

async function callGemini({ systemPrompt, userPrompt, temperature, timeoutMs, model }) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(keys.gemini);
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res;
    try {
      res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature, responseMimeType: 'application/json' }
        })
      }, timeoutMs);
    } catch (cause) {
      const err = new Error('Could not reach Gemini (network or timeout).');
      err.code = 'AI_PROVIDER_FAILED';
      err.retryable = true;
      err.cause = cause;
      throw err;
    }
    if (!res.ok) {
      let detail = '';
      let retryAfterMs = 0;
      try {
        const body = await res.json();
        detail = body && body.error && body.error.message ? body.error.message : '';
        const m = detail && detail.match(/retry in (\d+(?:\.\d+)?)/i);
        if (m) retryAfterMs = Math.round(parseFloat(m[1]) * 1000);
      } catch (_) { /* not JSON */ }
      const header = res.headers.get('retry-after');
      if (header && /^\d+(?:\.\d+)?$/.test(header)) retryAfterMs = Math.max(retryAfterMs, Math.round(parseFloat(header) * 1000));
      retryAfterMs = Math.min(retryAfterMs, MAX_QUOTA_WAIT_MS);
      const err = new Error(`Gemini request failed (${res.status})${detail ? `: ${detail}` : ''}`);
      err.code = 'AI_PROVIDER_FAILED';
      err.geminiQuotaLimited = isQuotaError(res.status, detail);
      err.retryable = isTransientStatus(res.status);
      if (err.geminiQuotaLimited && retryAfterMs > 0 && attempt === 1) {
        log('llm', `gemini quota-limited, waiting ${Math.ceil(retryAfterMs / 1000)}s before retry`);
        await delay(retryAfterMs);
        continue;
      }
      throw err;
    }
    const j = await res.json();
    const candidate = j && j.candidates && j.candidates[0];
    const parts = candidate && candidate.content && Array.isArray(candidate.content.parts)
      ? candidate.content.parts
      : [];
    // Gemini may emit thought/tool parts ahead of the JSON; try text parts in
    // reverse so the last (final-answer) part wins.
    const textParts = parts.map(p => p && p.text).filter(Boolean).reverse();
    if (!textParts.length) {
      const err = new Error('Gemini returned no usable answer text.');
      err.code = 'AI_PROVIDER_FAILED';
      err.retryable = true;
      throw err;
    }
    let lastParseError;
    for (let i = 0; i < MAX_PARSE_ATTEMPTS; i++) {
      for (const text of textParts) {
        try {
          return { value: extractJson(text, 'Gemini').value, raw: text };
        } catch (err) {
          lastParseError = err;
        }
      }
      if (i < MAX_PARSE_ATTEMPTS - 1) await delay(800);
    }
    throw lastParseError;
  }
}

async function callGroq({ systemPrompt, userPrompt, temperature, timeoutMs, model }) {
  const isReasoningModel = /gpt-oss|qwen\/qwen3/.test(model);
  const requestBody = {
    model,
    messages: [
      { role: 'system', content: 'You return strictly valid JSON matching the requested schema. No markdown, no prose outside the JSON.' },
      { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
    ],
    temperature,
    response_format: { type: 'json_object' }
  };
  if (isReasoningModel) {
    requestBody.include_reasoning = false;
    requestBody.reasoning_effort = 'low';
  }
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res;
    try {
      res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keys.groq}` },
        body: JSON.stringify(requestBody)
      }, timeoutMs);
    } catch (cause) {
      lastError = new Error('Could not reach Groq (network or timeout).');
      lastError.code = 'AI_PROVIDER_FAILED';
      lastError.retryable = true;
      lastError.cause = cause;
      if (attempt === 1) { await delay(1500); continue; }
      throw lastError;
    }
    if (!res.ok) {
      let detail = '';
      let code = '';
      try {
        const body = await res.json();
        code = body && body.error && body.error.code ? String(body.error.code) : '';
        detail = body && body.error && body.error.message ? body.error.message : '';
      } catch (_) { /* not JSON */ }
      const jsonValidateFailed = res.status === 400 && /json_validate_failed/.test(`${code} ${detail}`);
      lastError = new Error(`Groq request failed (${res.status})${detail ? `: ${detail}` : ''}`);
      lastError.code = 'AI_PROVIDER_FAILED';
      lastError.retryable = isTransientStatus(res.status) || jsonValidateFailed;
      if (!lastError.retryable || attempt === 2) throw lastError;
      // Groq's strict json_object mode rejects noisy-but-recoverable answers;
      // retry without it so extractJson can strip fences/braces the reply.
      if (jsonValidateFailed) delete requestBody.response_format;
      await delay(1500 * attempt);
      continue;
    }
    const body = await res.json();
    const text = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
    if (!text) {
      lastError = new Error('Groq returned an empty answer.');
      lastError.code = 'AI_PROVIDER_FAILED';
      lastError.retryable = true;
      if (attempt === 2) throw lastError;
      await delay(1500);
      continue;
    }
    try {
      const parsed = extractJson(text, 'Groq').value;
      const good = parsed && typeof parsed === 'object' && !Array.isArray(parsed);
      if (good) return { value: parsed, raw: text };
      const err = new Error('Groq returned a non-object answer.');
      err.code = 'AI_PROVIDER_FAILED';
      err.retryable = true;
      throw err;
    } catch (err) {
      lastError = err;
      if (!lastError.retryable || attempt === 2) throw lastError;
      await delay(1500 * attempt);
    }
  }
  throw lastError;
}

async function callOpenAI({ systemPrompt, userPrompt, temperature, timeoutMs, model }) {
  const requestBody = {
    model,
    messages: [
      { role: 'system', content: 'You return strictly valid JSON matching the requested schema. No markdown, no prose outside the JSON.' },
      { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
    ],
    temperature,
    response_format: { type: 'json_object' },
    max_tokens: 6000
  };
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res;
    try {
      res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keys.openai}` },
        body: JSON.stringify(requestBody)
      }, timeoutMs);
    } catch (cause) {
      lastError = new Error('Could not reach OpenAI (network or timeout).');
      lastError.code = 'AI_PROVIDER_FAILED';
      lastError.retryable = true;
      lastError.cause = cause;
      if (attempt === 1) { await delay(1500); continue; }
      throw lastError;
    }
    if (!res.ok) {
      let detail = '';
      let code = '';
      try {
        const body = await res.json();
        code = body && body.error && body.error.code ? String(body.error.code) : '';
        detail = body && body.error && body.error.message ? body.error.message : '';
      } catch (_) { /* not JSON */ }
      const jsonValidateFailed = res.status === 400 && /json_validate_failed/.test(`${code} ${detail}`);
      lastError = new Error(`OpenAI request failed (${res.status})${detail ? `: ${detail}` : ''}`);
      lastError.code = 'AI_PROVIDER_FAILED';
      lastError.retryable = isTransientStatus(res.status) || jsonValidateFailed;
      if (!lastError.retryable || attempt === 2) throw lastError;
      // Strict json_object mode rejects noisy-but-recoverable answers; retry
      // without it so extractJson can strip fences/braces the reply.
      if (jsonValidateFailed) delete requestBody.response_format;
      await delay(1500 * attempt);
      continue;
    }
    const body = await res.json();
    const text = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
    if (!text) {
      lastError = new Error('OpenAI returned an empty answer.');
      lastError.code = 'AI_PROVIDER_FAILED';
      lastError.retryable = true;
      if (attempt === 2) throw lastError;
      await delay(1500);
      continue;
    }
    try {
      const parsed = extractJson(text, 'OpenAI').value;
      const good = parsed && typeof parsed === 'object' && !Array.isArray(parsed);
      if (good) return { value: parsed, raw: text };
      const err = new Error('OpenAI returned a non-object answer.');
      err.code = 'AI_PROVIDER_FAILED';
      err.retryable = true;
      throw err;
    } catch (err) {
      lastError = err;
      if (!lastError.retryable || attempt === 2) throw lastError;
      await delay(1500 * attempt);
    }
  }
  throw lastError;
}

async function generateJSON({ systemPrompt, userPrompt, temperature = 0.7, timeoutMs = DEFAULT_TIMEOUT_MS, label = 'plan' }) {
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const candidates = [];
  if (status.gemini) candidates.push({ name: 'gemini', model: geminiModel, run: () => callGemini({ systemPrompt, userPrompt, temperature, timeoutMs, model: geminiModel }) });
  if (status.groq) candidates.push({ name: 'groq', model: groqModel, run: () => callGroq({ systemPrompt, userPrompt, temperature, timeoutMs, model: groqModel }) });
  if (status.openai) candidates.push({ name: 'openai', model: openaiModel, run: () => callOpenAI({ systemPrompt, userPrompt, temperature, timeoutMs, model: openaiModel }) });

  if (!candidates.length) {
    const err = new Error('No AI provider is configured. Add GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY to .env and restart the server.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  let lastError = null;
  for (const c of candidates) {
    try {
      const out = await c.run();
      log('llm', `${label} generated via ${c.name} (${c.model})`);
      return { ...out, source: c.name, model: c.model };
    } catch (err) {
      log('llm', `${label} ${c.name} failed: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError || new Error('All AI providers failed.');
}

module.exports = { generateJSON, extractJson, DEFAULT_TIMEOUT_MS };