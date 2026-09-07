const { keys, status } = require('./apiKeys');

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AI_REQUEST_TIMEOUT_MS = 30000;
const GROQ_MAX_ATTEMPTS = 3;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientProviderStatus(status) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function fetchWithTimeout(url, options, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function upcomingMonthLabel(i) {
  const d = new Date(Date.now());
  const date = new Date(d.getFullYear(), d.getMonth() + i, 1);
  return MONTH_NAMES[date.getMonth()] + " '" + String(date.getFullYear()).slice(2);
}

function haversine(a, b) {
  const R = 6371;
  const toRad = v => v * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/* Deterministic, no-API-key planner that fills a full year from the destination DB. */
function buildOfflinePlan(profile, destinations, weatherData, pricingData) {
  const weekendBudget = profile.weekendBudget;
  const majorBudget = profile.majorBudget;
  const travelers = profile.travelers || 1;
  const radius = profile.radius;
  const home = profile.home;

  const used = new Set();
  const weekendSlots = [];

  const candidates = destinations.map(d => {
    const km = d.kmFromHome != null ? d.kmFromHome : 0;
    const weekendDays = Math.max(2, Math.min(3, d.maxD));
    const weekendCost = d.cost * travelers * weekendDays;
    return { d, km, weekendDays, weekendCost, inRadius: km <= radius, underBudget: weekendCost <= weekendBudget };
  });

  const weekendPool = candidates
    .filter(c => c.inRadius && c.underBudget)
    .sort((a, b) => a.km - b.km);

  const target = Math.max(1, Math.min(12, profile.slotTarget || 12));
  let picked = 0;
  for (const c of weekendPool) {
    if (picked >= target) break;
    if (used.has(c.d.name)) continue;
    const w = weatherData && weatherData[c.d.name];
    const reason = buildReason(c.d, 'weekend', kmText(c.km), c.weekendCost, weekendBudget, w);
    weekendSlots.push({
      name: c.d.name,
      state: c.d.state,
      cost: c.weekendCost,
      days: c.weekendDays,
      month: upcomingMonthLabel(picked),
      reason
    });
    used.add(c.d.name);
    picked++;
  }

  let majorTrip = null;
  const majorPool = candidates.filter(c => !used.has(c.d.name));
  if (majorPool.length) {
    const majorCandidates = majorPool
      .map(c => {
        const days = Math.max(c.d.minD, Math.min(c.d.maxD, profile.durSlider || 7));
        const cost = c.d.cost * travelers * days;
        return { ...c, days, cost };
      })
      .filter(c => c.cost <= majorBudget)
      .sort((a, b) => b.d.maxD - a.d.maxD || b.d.cost - a.d.cost);

    const pick = majorCandidates[0] || null;
    if (pick) {
      const w = weatherData && weatherData[pick.d.name];
      majorTrip = {
        name: pick.d.name,
        state: pick.d.state,
        cost: pick.cost,
        days: pick.days,
        month: upcomingMonthLabel(target),
        reason: buildReason(pick.d, 'major', null, pick.cost, majorBudget, w),
        itinerary: buildItinerary(pick.d, pick.days)
      };
    }
  }

  const totalSpend = weekendSlots.reduce((s, x) => s + x.cost, 0) + (majorTrip ? majorTrip.cost : 0);
  const summary = `Auto-generated from the destination database without an AI key: ` +
    `${weekendSlots.length} weekend trip${weekendSlots.length === 1 ? '' : 's'} within ${radius} km of ${home} ` +
    `(${weekendSlots.length ? weekendSlots.map(s => s.name).join(', ') : 'none'})` +
    `${majorTrip ? `, plus a ${majorTrip.days}-day major trip to ${majorTrip.name}` : ''}, ` +
    `totalling about ₹${Math.round(totalSpend).toLocaleString('en-IN')}. ` +
    `Budget, distance and affinity rules were checked against your profile.`;

  return { weekendSlots, majorTrip, summary, source: 'offline' };
}

function kmText(km) {
  return km > 0 ? `${Math.round(km)} km from home` : 'near home';
}

function buildReason(d, kind, distText, cost, budget, weather) {
  let r = `${d.hl}`;
  if (distText && kind === 'weekend') r = `${distText}, ${d.cost}/day, within budget.`;
  else r = `${d.cost}/day, fits the ${kind === 'major' ? 'duration + budget' : 'budget'}.`;
  if (weather && weather.range && weather.current) {
    r += ` Best months ${weather.range}.`;
  }
  return r;
}

function buildItinerary(d, days) {
  const lines = [];
  for (let i = 1; i <= days; i++) {
    if (i === 1) lines.push(`Arrive in ${d.name}, check in and settle in.`);
    else if (i === days) lines.push(`Check out and depart from ${d.name}.`);
    else if (i === 2) lines.push(d.hl);
    else lines.push(`Freely explore ${d.name}: local food, viewpoints and neighbourhood walks.`);
  }
  return lines;
}

function asText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

// AI output is external input. Normalize it once on the server so a model
// returning a string instead of an array cannot crash either React view.
function normalizeAIPlan(raw) {
  if (!raw || typeof raw !== 'object') {
    const err = new Error('AI returned an invalid plan. Please try again.');
    err.code = 'AI_PROVIDER_FAILED';
    throw err;
  }

  const weekendSlots = Array.isArray(raw.weekendSlots)
    ? raw.weekendSlots.slice(0, 12).flatMap(slot => {
      if (!slot || typeof slot !== 'object' || !asText(slot.name)) return [];
      return [{
        name: asText(slot.name),
        state: asText(slot.state, 'India'),
        cost: Math.max(0, asNumber(slot.cost)),
        days: Math.max(1, Math.min(10, Math.round(asNumber(slot.days, 3)))),
        month: asText(slot.month),
        reason: asText(slot.reason)
      }];
    })
    : [];

  let majorTrip = null;
  if (raw.majorTrip && typeof raw.majorTrip === 'object' && asText(raw.majorTrip.name)) {
    majorTrip = {
      name: asText(raw.majorTrip.name),
      state: asText(raw.majorTrip.state, 'India'),
      cost: Math.max(0, asNumber(raw.majorTrip.cost)),
      days: Math.max(1, Math.min(14, Math.round(asNumber(raw.majorTrip.days, 7)))),
      month: asText(raw.majorTrip.month),
      reason: asText(raw.majorTrip.reason),
      itinerary: Array.isArray(raw.majorTrip.itinerary)
        ? raw.majorTrip.itinerary.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean)
        : []
    };
  }

  if (!weekendSlots.length && !majorTrip) {
    const err = new Error('AI returned an incomplete plan. Please try again.');
    err.code = 'AI_PROVIDER_FAILED';
    throw err;
  }

  return { weekendSlots, majorTrip, summary: asText(raw.summary) };
}

function parseJsonPlan(text, provider) {
  try {
    const raw = String(text);
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const unfenced = (fenced ? fenced[1] : raw).trim();
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    const candidate = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;
    return normalizeAIPlan(JSON.parse(candidate));
  } catch (cause) {
    if (cause && cause.code === 'AI_PROVIDER_FAILED') throw cause;
    const err = new Error(`${provider} returned an invalid plan. Please try again.`);
    err.code = 'AI_PROVIDER_FAILED';
    throw err;
  }
}

async function callGemini(profile) {
  const mapsGroundingEnabled = status.geminiMaps;
  const discoveryInstruction = mapsGroundingEnabled
    ? 'Use the enabled Google Maps grounding tool to discover real places in India.'
    : 'Select real, distinct destinations in India using your general travel knowledge.';
  const sourceInstruction = mapsGroundingEnabled
    ? 'Select real, distinct destinations sourced through Google Maps grounding. Never repeat a destination.'
    : 'Select real, distinct destinations. Never repeat a destination.';
  const prompt = `You are Trip Control's AI travel planner. ${discoveryInstruction} Do not use a pre-supplied destination catalogue. Produce a full-year Indian travel plan as VALID JSON ONLY.

Constraints:
- weekendSlots: 2-3 day trips, within ${profile.radius}km of ${profile.home}, each <= ₹${profile.weekendBudget}/trip.
- majorTrip: ${profile.durSlider} days, <= ₹${profile.majorBudget}.
- Total weekend + major spend <= ₹${profile.yearlyBudget}.
- ${sourceInstruction}
- Each weekend trip in a distinct upcoming month.
- Costs in INR: total = (perDayCost * days * travelers) + (flightPrice || 0).
- majorTrip must include a day-by-day "itinerary" array.

Return JSON of this exact shape:
{"weekendSlots":[{"name","state","cost","days","month","reason"}],"majorTrip":{"name","state","cost","days","month","reason","itinerary":[]},"summary"}

Profile: ${JSON.stringify(profile)}`;

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(keys.gemini);
  let res;
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        ...(mapsGroundingEnabled ? { tools: [{ googleMaps: {} }] } : {}),
        generationConfig: { temperature: 0.6, responseMimeType: 'application/json' }
      })
    });
  } catch (cause) {
    const err = new Error('Could not reach Gemini. Check your network connection and try again.');
    err.code = 'AI_PROVIDER_FAILED';
    err.cause = cause;
    throw err;
  }
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body && body.error && body.error.message ? body.error.message : '';
    } catch (_) { /* Response was not JSON. */ }
    const err = new Error(`Gemini request failed (${res.status})${detail ? `: ${detail}` : ''}`);
    err.code = 'AI_PROVIDER_FAILED';
    err.geminiQuotaLimited = res.status === 429 ||
      (res.status === 403 && /(quota|rate.?limit|resource exhausted|limit exceeded)/i.test(detail));
    throw err;
  }
  const j = await res.json();
  const candidate = j && j.candidates && j.candidates[0];
  const parts = candidate && candidate.content && Array.isArray(candidate.content.parts)
    ? candidate.content.parts
    : [];
  // Gemini can emit thought/tool parts before the JSON part. Try text parts in
  // reverse order, which preserves structured-output mode without assuming
  // that the response is always parts[0].
  const textParts = parts.map(part => part && part.text).filter(Boolean).reverse();
  if (!textParts.length) {
    const err = new Error('Gemini returned no usable plan. Try again with a simpler trip profile.');
    err.code = 'AI_PROVIDER_FAILED';
    throw err;
  }
  try {
    let parsed;
    let parseError;
    for (const text of textParts) {
      try {
        parsed = parseJsonPlan(text, 'Gemini');
        break;
      } catch (err) {
        parseError = err;
      }
    }
    if (parsed) {
      const chunks = (candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks) || [];
      parsed.mapSources = chunks
        .filter(chunk => chunk.maps && chunk.maps.uri && chunk.maps.title)
        .map(chunk => ({ title: chunk.maps.title, uri: chunk.maps.uri, placeId: chunk.maps.placeId || null }));
      if (mapsGroundingEnabled && !parsed.mapSources.length) {
        const err = new Error('Gemini did not return Google Maps-grounded places. Please try again.');
        err.code = 'AI_PROVIDER_FAILED';
        throw err;
      }
      parsed.source = mapsGroundingEnabled ? 'gemini-google-maps' : 'gemini';
      return parsed;
    }
    throw parseError;
  } catch (cause) {
    if (cause && cause.code === 'AI_PROVIDER_FAILED') throw cause;
    const err = new Error('Gemini returned an invalid plan. Please try again.');
    err.code = 'AI_PROVIDER_FAILED';
    throw err;
  }
  const err = new Error('Gemini returned an incomplete plan. Please try again.');
  err.code = 'AI_PROVIDER_FAILED';
  throw err;
}

function buildGroqPrompt(profile) {
  return `You are Trip Control's AI travel planner. Select real, distinct destinations in India and produce a full-year travel plan as VALID JSON ONLY. Do not include Markdown or any text outside the JSON.

Constraints:
- weekendSlots: 2-3 day trips, within ${profile.radius}km of ${profile.home}, each <= INR ${profile.weekendBudget}/trip.
- majorTrip: ${profile.durSlider} days, <= INR ${profile.majorBudget}.
- Total weekend + major spend <= INR ${profile.yearlyBudget}.
- Each weekend trip must be in a distinct upcoming month. Never repeat a destination.
- Costs are total INR estimates for all ${profile.travelers || 1} traveler(s).
- majorTrip must include a day-by-day "itinerary" array.

Return JSON of this exact shape:
{"weekendSlots":[{"name":"","state":"","cost":0,"days":0,"month":"","reason":""}],"majorTrip":{"name":"","state":"","cost":0,"days":0,"month":"","reason":"","itinerary":[]},"summary":""}

Profile: ${JSON.stringify(profile)}`;
}

function mapSearchUrl(name, state) {
  const query = [name, state, 'India'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function parseGroqPlan(text) {
  const parsed = parseJsonPlan(text, 'Groq');
  const places = [
    ...(Array.isArray(parsed.weekendSlots) ? parsed.weekendSlots : []),
    ...(parsed.majorTrip ? [parsed.majorTrip] : [])
  ];
  const seen = new Set();
  parsed.mapSources = status.googleMaps ? places.filter(place => {
    const id = `${place.name || ''}|${place.state || ''}`.toLowerCase();
    if (!place.name || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map(place => ({
    title: `${place.name}${place.state ? `, ${place.state}` : ''}`,
    uri: mapSearchUrl(place.name, place.state),
    placeId: null
  })) : [];
  parsed.source = 'groq';
  return parsed;
}

async function callGroq(profile) {
  // The pre-2026 llama-3.3-70b-versatile models were retired from Groq's
  // catalog. Current production text models are the OpenAI GPT-OSS family;
  // they are reasoning models, so reasoning must be excluded from the output
  // (and kept cheap) or they burn the token budget on thinking and return an
  // empty answer instead of the JSON plan.
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const isReasoningModel = /gpt-oss|qwen\/qwen3/.test(model);
  let lastError;

  const requestBody = {
    model,
    messages: [
      { role: 'system', content: 'You return strictly valid JSON and follow the requested schema.' },
      { role: 'user', content: buildGroqPrompt(profile) }
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' }
  };
  if (isReasoningModel) {
    requestBody.include_reasoning = false;
    requestBody.reasoning_effort = 'low';
  }

  for (let attempt = 1; attempt <= GROQ_MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${keys.groq}`
      },
      body: JSON.stringify(requestBody)
      });
      if (!res.ok) {
        let detail = '';
        let code = '';
        try {
          const body = await res.json();
          detail = body && body.error && body.error.message || '';
          code = body && body.error && body.error.code || '';
        } catch (_) { /* non-JSON response */ }
        const err = new Error(`Groq request failed (${res.status})${detail ? `: ${detail}` : ''}`);
        err.code = 'AI_PROVIDER_FAILED';
        if (code === 'model_not_found') {
          err.message += ' The configured GROQ_MODEL is not available for this account; set GROQ_MODEL to openai/gpt-oss-20b or openai/gpt-oss-120b.';
          err.retryable = false;
        } else {
          // GPT-OSS in JSON mode intermittently runs out of reasoning budget and
          // answers with empty/uneditable content (json_validate_failed). Retry.
          err.retryable = isTransientProviderStatus(res.status) || code === 'json_validate_failed';
        }
        throw err;
      }
      const body = await res.json();
      const text = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
      if (!text) {
        const err = new Error('Groq returned no usable plan. Please try again.');
        err.code = 'AI_PROVIDER_FAILED';
        err.retryable = true;
        throw err;
      }
      return parseGroqPlan(text);
    } catch (cause) {
      const isNetworkError = cause && (cause.name === 'AbortError' || cause.name === 'TypeError');
      const retryable = isNetworkError || (cause && cause.retryable);
      lastError = cause;
      if (!retryable || attempt === GROQ_MAX_ATTEMPTS) break;
      // Space out retries so the 8K tokens/min free tier can recover.
      await delay(2000 * attempt);
    }
  }

  const err = lastError && lastError.code === 'AI_PROVIDER_FAILED'
    ? lastError
    : new Error('Could not reach Groq. Check your network connection and try again.');
  err.code = 'AI_PROVIDER_FAILED';
  throw err;
}

async function getAIPlan(userProfile) {
  if (status.gemini) {
    try {
      return await callGemini(userProfile);
    } catch (err) {
      if (!status.groq) throw err;
      const plan = await callGroq(userProfile);
      plan.fallbackReason = err.geminiQuotaLimited
        ? 'Gemini quota or rate limit reached; generated with Groq.'
        : 'Gemini was temporarily unavailable; generated with Groq.';
      return plan;
    }
  }
  if (status.groq) return callGroq(userProfile);
  {
    const err = new Error('No AI provider is configured. Add GEMINI_API_KEY, GROQ_API_KEY, or both to .env and restart the server.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }
}

module.exports = { getAIPlan, normalizeAIPlan };
