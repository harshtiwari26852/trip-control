const { keys, status } = require('./apiKeys');
const { CITIES, DESTINATIONS } = require('../data/destinations');

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AI_REQUEST_TIMEOUT_MS = 30000;
const GROQ_MAX_ATTEMPTS = 3;
const GEMINI_MAX_ATTEMPTS = 3;

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

/* ---------------- Single-destination itinerary generation ---------------- */

const ITINERARY_JSON_SCHEMA = `{
  "summary": "1-2 sentence overview of the whole trip",
  "transportation": { "method": "string", "details": "string", "estimatedCost": number, "duration": "string" },
  "accommodation": { "suggestion": "string", "estimatedTotalCost": number },
  "itinerary": [
    { "day": number, "theme": "string", "activities": [ { "time": "string", "title": "string", "description": "string", "estimatedCost": number } ] }
  ],
  "budgetSummary": { "transport": number, "accommodation": number, "food": number, "activities": number, "total": number }
}`;

function buildItineraryPrompt(profile) {
  return `You are an expert travel agent. Create a detailed travel itinerary based on the following constraints:
Origin: ${profile.home}
Destination: ${profile.destination}
Duration: ${profile.duration} days
Budget: INR ${profile.totalBudget} (This must cover transport, stay, food, and activities for ${profile.travelers} traveler(s))
Travelers: ${profile.travelers} (${profile.travelerType})
Preferred Mode of Transport: ${profile.travelMode}
Pace: ${profile.pace}

Instructions:
1. Transport: Suggest how to reach the destination using the preferred travel mode. Give estimated costs (INR) and travel time. If the preferred mode is clearly impractical for this route (e.g. a short-hop flight on a route better served by a quick drive or train), gently recommend and cost the sensible alternative instead and explain it in "details".
2. Accommodation: Suggest a specific neighborhood or hotel type suitable for a ${profile.travelerType} traveler within the budget. Give the estimated total cost for the whole stay.
3. Itinerary: Create a day-by-day plan covering all ${profile.duration} days. Since the pace is '${profile.pace}', make the schedule match: 'relaxed' = at most 2 activities a day, 'balanced' = 3-4 activities a day, 'action' = a full schedule of 5+ activities. Use real, specific places and note sensible breakfast, lunch and dinner ideas.
4. Budget Breakdown: Provide an estimated cost breakdown whose total (budgetSummary.total) is less than or equal to INR ${profile.totalBudget}.

Use realistic typical Indian prices in INR. Every monetary field must be a number.

Output Format: You MUST respond ONLY in valid JSON using the exact schema below.
${ITINERARY_JSON_SCHEMA}`;
}

// AI output is external input. Normalize it once on the server so a model
// returning a string instead of an array cannot crash either React view.
function normalizeItinerary(raw) {
  if (!raw || typeof raw !== 'object') {
    const err = new Error('AI returned an invalid itinerary. Please try again.');
    err.code = 'AI_PROVIDER_FAILED';
    throw err;
  }

  const n = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : fallback;
  };

  const transportation =
    raw.transportation && typeof raw.transportation === 'object'
      ? {
          method: asText(raw.transportation.method),
          details: asText(raw.transportation.details),
          estimatedCost: n(raw.transportation.estimatedCost),
          duration: asText(raw.transportation.duration)
        }
      : null;

  const accommodation =
    raw.accommodation && typeof raw.accommodation === 'object'
      ? {
          suggestion: asText(raw.accommodation.suggestion),
          estimatedTotalCost: n(raw.accommodation.estimatedTotalCost)
        }
      : null;

  const itinerary = Array.isArray(raw.itinerary)
    ? raw.itinerary.slice(0, 30).flatMap(day => {
        const dayNumber = Math.round(asNumber(day && day.day));
        if (!day || typeof day !== 'object' || !dayNumber) return [];
        const activities = Array.isArray(day.activities)
          ? day.activities.slice(0, 12).flatMap(activity => {
              if (!activity || typeof activity !== 'object' || !asText(activity.title)) return [];
              return [{
                time: asText(activity.time),
                title: asText(activity.title),
                description: asText(activity.description),
                estimatedCost: n(activity.estimatedCost)
              }];
            })
          : [];
        return [{
          day: Math.max(1, dayNumber),
          theme: asText(day.theme, `Day ${Math.max(1, dayNumber)}`),
          activities
        }];
      })
    : [];

  const budgetSummary =
    raw.budgetSummary && typeof raw.budgetSummary === 'object'
      ? {
          transport: n(raw.budgetSummary.transport),
          accommodation: n(raw.budgetSummary.accommodation),
          food: n(raw.budgetSummary.food),
          activities: n(raw.budgetSummary.activities),
          total: n(raw.budgetSummary.total,
            n(raw.budgetSummary.transport) +
            n(raw.budgetSummary.accommodation) +
            n(raw.budgetSummary.food) +
            n(raw.budgetSummary.activities))
        }
      : null;

  if (!transportation && !accommodation && !itinerary.length && !budgetSummary) {
    const err = new Error('AI returned an incomplete itinerary. Please try again.');
    err.code = 'AI_PROVIDER_FAILED';
    throw err;
  }

  return {
    summary: asText(raw.summary),
    transportation,
    accommodation,
    itinerary,
    budgetSummary,
    currency: 'INR'
  };
}

function parseJsonItinerary(text, provider) {
  try {
    const raw = String(text);
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const unfenced = (fenced ? fenced[1] : raw).trim();
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    const candidate = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;
    return normalizeItinerary(JSON.parse(candidate));
  } catch (cause) {
    if (cause && cause.code === 'AI_PROVIDER_FAILED') throw cause;
    const err = new Error(`${provider} returned an invalid itinerary. Please try again.`);
    err.code = 'AI_PROVIDER_FAILED';
    throw err;
  }
}

async function callGeminiItinerary(profile) {
  const prompt = buildItineraryPrompt(profile);
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(keys.gemini);
  let res;
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
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
  const textParts = parts.map(part => part && part.text).filter(Boolean).reverse();
  if (!textParts.length) {
    const err = new Error('Gemini returned no usable itinerary. Please try again.');
    err.code = 'AI_PROVIDER_FAILED';
    throw err;
  }
  let parsed;
  let parseError;
  for (const text of textParts) {
    try {
      parsed = parseJsonItinerary(text, 'Gemini');
      break;
    } catch (err) {
      parseError = err;
    }
  }
  if (parsed) {
    parsed.source = 'gemini';
    return parsed;
  }
  throw parseError;
}

async function callGroqItinerary(profile) {
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const isReasoningModel = /gpt-oss|qwen\/qwen3/.test(model);
  const requestBody = {
    model,
    messages: [
      { role: 'system', content: 'You return strictly valid JSON and follow the requested schema.' },
      { role: 'user', content: buildItineraryPrompt(profile) }
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
        const err = new Error(`Groq request failed (${res.status}). Please try again.`);
        err.code = 'AI_PROVIDER_FAILED';
        err.retryable = isTransientProviderStatus(res.status);
        throw err;
      }
      const body = await res.json();
      const text = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
      if (!text) {
        const err = new Error('Groq returned no usable itinerary. Please try again.');
        err.code = 'AI_PROVIDER_FAILED';
        err.retryable = true;
        throw err;
      }
      const parsed = parseJsonItinerary(text, 'Groq');
      parsed.source = 'groq';
      return parsed;
    } catch (cause) {
      const isNetworkError = cause && (cause.name === 'AbortError' || cause.name === 'TypeError');
      const retryable = isNetworkError || (cause && cause.retryable);
      if (!retryable || attempt === GROQ_MAX_ATTEMPTS) {
        if (cause && cause.code === 'AI_PROVIDER_FAILED') throw cause;
        break;
      }
      await delay(2000 * attempt);
    }
  }
  const err = new Error('Could not reach Groq. Check your network connection and try again.');
  err.code = 'AI_PROVIDER_FAILED';
  throw err;
}

async function getAIItinerary(profile) {
  if (status.gemini) {
    try {
      return await callGeminiItinerary(profile);
    } catch (err) {
      if (!status.groq) throw err;
      const itinerary = await callGroqItinerary(profile);
      itinerary.fallbackReason = err.geminiQuotaLimited
        ? 'Gemini quota or rate limit reached; generated with Groq.'
        : 'Gemini was temporarily unavailable; generated with Groq.';
      return itinerary;
    }
  }
  if (status.groq) return callGroqItinerary(profile);
  {
    const err = new Error('No AI provider is configured. Add GEMINI_API_KEY, GROQ_API_KEY, or both to .env and restart the server.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }
}

/* ---------------- Yearly weekend getaway calendar generation ---------------- */

const WEEKEND_CALENDAR_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const WEEKEND_CALENDAR_JSON_SCHEMA = `{
  "calendar": [
    {
      "month": "String (e.g., 'Sep')",
      "trips": [
        {
          "destination": "String (e.g., 'Chikmagalur')",
          "distanceFromHome": "Number (Must be <= the radius)",
          "duration": "String (always '3 Days')",
          "estimatedBudget": "Number (Must be <= the per-trip budget)",
          "vibe": "String (e.g., 'Monsoon Trek & Coffee')"
        }
      ]
    }
  ]
}`;

function buildWeekendCalendarPrompt(profile) {
  const withTwo = profile.slotTarget - 12;
  const withOne = 24 - profile.slotTarget;
  return `You are an expert travel planner generating a yearly weekend getaway strategy.

Constraints:
- Origin: ${profile.home}
- Total Trips: Exactly ${profile.slotTarget} distinct trips.
- Trip Duration: Exactly 3 days each.
- Maximum Distance: ${profile.radius} km radius from ${profile.home} (popular weekend getaways include Coorg, Wayanad, Ooty, Pondicherry, Hampi, Sakleshpur).
- Budget: Maximum INR ${profile.weekendBudget} per trip for ${profile.travelers} traveler(s).
- Travelers: ${profile.travelers} (${profile.travelerType})

Cost Estimation:
- "estimatedBudget" must be the estimated all-in cost of the entire 3-day trip for all ${profile.travelers} traveler(s), in INR: return travel fare (train/bus fare or fuel for a drive), stay, food and activities. Use realistic typical Indian prices. Never exceed the maximum per-trip budget.

Distribution Instructions:
Spread exactly ${profile.slotTarget} trips across the 12 calendar months (Jan to Dec) following seasonality around ${profile.home}:
- Monsoon (Jun-Sep): favour Western Ghats and waterfall destinations (e.g. Agumbe, Sakleshpur, Chikmagalur).
- Winter (Oct-Feb): schedule longer drives such as Hampi, Gokarna or Pondicherry when the weather is cool and dry.
- Summer (Mar-May): allocate high-altitude escapes such as Ooty, Kodaikanal or Coonoor.
Because there are ${profile.slotTarget} trips and 12 months, exactly ${withTwo} months must contain an array of 2 trips, and exactly ${withOne} months must contain an array of 1 trip. Never leave a month empty and never put more than 2 trips in a month. Pick real, distinct destinations that are popular weekend getaways from ${profile.home}.

Output Format: You MUST respond ONLY in valid JSON using the exact schema below.
${WEEKEND_CALENDAR_JSON_SCHEMA}`;
}

function normalizeWeekendCalendar(raw, profile) {
  if (!raw || typeof raw !== 'object') {
    const err = new Error('AI returned an invalid weekend calendar. Please try again.');
    err.code = 'AI_PROVIDER_FAILED';
    throw err;
  }

  const slotTarget = Math.min(24, Math.max(12, Math.round(asNumber(profile && profile.slotTarget, 20) || 20)));
  const maxDistance = Math.max(0, asNumber(profile && profile.radius, 430) || 430);
  const maxBudget = Math.max(0, asNumber(profile && profile.weekendBudget, 20000) || 20000);
  const extrasLeft = slotTarget - 12;

  const seen = new Set();
  const pool = [];
  const rawMonths = Array.isArray(raw.calendar) ? raw.calendar : [];
  for (const month of rawMonths) {
    const label = asText(month && month.month);
    const monthIndex = WEEKEND_CALENDAR_MONTHS.findIndex(x => x.toLowerCase() === label.toLowerCase());
    const rawTrips = month && Array.isArray(month.trips) ? month.trips : [];
    for (const item of rawTrips) {
      if (!item || typeof item !== 'object' || !asText(item.destination)) continue;
      const key = asText(item.destination).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const rawDistance = item.distanceFromHome !== undefined ? item.distanceFromHome : item.distanceFromBangalore;
      pool.push({
        monthIndex,
        trip: {
          destination: asText(item.destination),
          distanceFromHome: Math.round(Math.min(maxDistance, Math.max(0, asNumber(rawDistance, 0)))),
          duration: asText(item.duration, '3 Days'),
          estimatedBudget: Math.round(Math.min(maxBudget, Math.max(0, asNumber(item.estimatedBudget, 0)))),
          vibe: asText(item.vibe)
        }
      });
    }
  }

  // AI output is external input. Rather than trusting the model to return 12
  // months with exactly slotTarget trips, re-balance whatever it produces:
  // 1) keep each month's seasonally assigned first trip,
  // 2) never leave a month empty,
  // 3) cap every month at 2 trips and hit the required slotTarget total.
  const calendar = WEEKEND_CALENDAR_MONTHS.map(() => []);

  for (const item of pool) {
    if (item.monthIndex >= 0 && calendar[item.monthIndex].length === 0) {
      item.taken = true;
      calendar[item.monthIndex].push(item.trip);
    }
  }

  for (const item of pool) {
    if (item.taken) continue;
    const empty = calendar.findIndex(month => month.length === 0);
    if (empty < 0) break;
    item.taken = true;
    calendar[empty].push(item.trip);
  }

  let extras = extrasLeft;
  for (const item of pool) {
    if (extras <= 0) break;
    if (item.taken) continue;
    if (item.monthIndex >= 0 && calendar[item.monthIndex].length === 1) {
      item.taken = true;
      calendar[item.monthIndex].push(item.trip);
      extras--;
    }
  }

  for (const item of pool) {
    if (extras <= 0) break;
    if (item.taken) continue;
    const target = calendar.findIndex(month => month.length === 1);
    if (target < 0) break;
    item.taken = true;
    calendar[target].push(item.trip);
    extras--;
  }

  const totalTrips = calendar.reduce((sum, month) => sum + month.length, 0);
  if (!totalTrips) {
    const err = new Error('AI returned an incomplete weekend calendar. Please try again.');
    err.code = 'AI_PROVIDER_FAILED';
    throw err;
  }

  const doubleMonths = calendar.filter(month => month.length > 1).length;
  const summary = asText(raw.summary) ||
    `Your yearly weekend getaway plan fits ${totalTrips} trips across 12 months — ` +
    `${doubleMonths} months host two getaways and ${12 - doubleMonths} host one. ` +
    `Every trip is 3 days, within ${maxDistance} km of your home and under INR ${maxBudget.toLocaleString('en-IN')}.`;

  return {
    calendar: calendar.map((trips, i) => ({ month: WEEKEND_CALENDAR_MONTHS[i], trips })),
    summary,
    currency: 'INR'
  };
}

function parseJsonWeekendCalendar(text, provider, profile) {
  try {
    const raw = String(text);
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const unfenced = (fenced ? fenced[1] : raw).trim();
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    const candidate = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;
    return normalizeWeekendCalendar(JSON.parse(candidate), profile);
  } catch (cause) {
    if (cause && cause.code === 'AI_PROVIDER_FAILED') throw cause;
    const err = new Error(`${provider} returned an invalid weekend calendar. Please try again.`);
    err.code = 'AI_PROVIDER_FAILED';
    throw err;
  }
}

async function callGeminiWeekendCalendar(profile) {
  const prompt = buildWeekendCalendarPrompt(profile);
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(keys.gemini);
  let lastError;
  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
        })
      });
    } catch (cause) {
      lastError = new Error('Could not reach Gemini. Check your network connection and try again.');
      lastError.code = 'AI_PROVIDER_FAILED';
      lastError.retryable = true;
      if (attempt === GEMINI_MAX_ATTEMPTS) break;
      await delay(2000 * attempt);
      continue;
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
      err.retryable = isTransientProviderStatus(res.status);
      lastError = err;
      if (!err.retryable || attempt === GEMINI_MAX_ATTEMPTS) break;
      await delay(2000 * attempt);
      continue;
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
      lastError = new Error('Gemini returned no usable weekend calendar. Please try again.');
      lastError.code = 'AI_PROVIDER_FAILED';
      lastError.retryable = true;
      if (attempt === GEMINI_MAX_ATTEMPTS) break;
      await delay(2000 * attempt);
      continue;
    }
    let parsed;
    let parseError;
    for (const text of textParts) {
      try {
        parsed = parseJsonWeekendCalendar(text, 'Gemini', profile);
        break;
      } catch (err) {
        parseError = err;
      }
    }
    if (parsed) {
      parsed.source = 'gemini';
      return parsed;
    }
    lastError = parseError || lastError;
    if (attempt === GEMINI_MAX_ATTEMPTS) break;
    await delay(2000 * attempt);
  }
  const err = lastError && lastError.code === 'AI_PROVIDER_FAILED'
    ? lastError
    : new Error('Gemini could not generate a weekend calendar. Please try again.');
  err.code = 'AI_PROVIDER_FAILED';
  throw err;
}

async function callGroqWeekendCalendar(profile) {
  const calendarPrompt = buildWeekendCalendarPrompt(profile);
  return callGroqWithRetry(profile, calendarPrompt, GROQ_MAX_ATTEMPTS)
    .then(parseGroqWeekendCalendar(text, 'Groq', profile))
    .then(plan => { plan.source = 'groq'; return plan; });
}

async function callGeminiWeekendCalendar(profile) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  let lastErr;
  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    let out;
    try {
      const response = await callGemini(profile, buildWeekendCalendarPrompt(profile), { temp: 0.4, json: true });
      for (const text of response.textParts.reverse()) {
        try { out = normalizeWeekendCalendar(parseWeekendCalendarJson(text, 'Gemini'), profile); break; }
        catch (_) { /* try next text part */ }
      }
      if (!out) { const e = new Error('Gemini returned an invalid weekend calendar. Please try again.'); e.code = 'AI_PROVIDER_FAILED'; e.retryable = true; throw e; }
      return out;
    } catch (cause) {
      if (attempt === GEMINI_MAX_ATTEMPTS) throw cause;
      if (!cause || cause.code === 'MISSING_API_KEY') throw cause;
      if (!cause.retryable && cause.rateLimited) { const derr = new Error(cause.message); derr.geminiQuotaLimited = true; derr.code = cause.code; throw derr; }
      lastErr = cause;
      await delay(2500 * attempt);
    }
  }
  throw lastErr;
}
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const isReasoningModel = /gpt-oss|qwen\/qwen3/.test(model);
  const requestBody = {
    model,
    messages: [
      { role: 'system', content: 'You return strictly valid JSON and follow the requested schema.' },
      { role: 'user', content: buildWeekendCalendarPrompt(profile) }
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
        const err = new Error(`Groq request failed (${res.status}). Please try again.`);
        err.code = 'AI_PROVIDER_FAILED';
        err.retryable = isTransientProviderStatus(res.status);
        throw err;
      }
      const body = await res.json();
      const text = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
      if (!text) {
        const err = new Error('Groq returned no usable weekend calendar. Please try again.');
        err.code = 'AI_PROVIDER_FAILED';
        err.retryable = true;
        throw err;
      }
      const parsed = parseJsonWeekendCalendar(text, 'Groq', profile);
      parsed.source = 'groq';
      return parsed;
    } catch (cause) {
      const isNetworkError = cause && (cause.name === 'AbortError' || cause.name === 'TypeError');
      const retryable = isNetworkError || (cause && cause.retryable);
      if (!retryable || attempt === GROQ_MAX_ATTEMPTS) {
        if (cause && cause.code === 'AI_PROVIDER_FAILED') throw cause;
        break;
      }
      await delay(2000 * attempt);
    }
  }
  const err = new Error('Could not reach Groq. Check your network connection and try again.');
  err.code = 'AI_PROVIDER_FAILED';
  throw err;
}

function resolvedCityCoords(home) {
  const alias = { Bangalore: 'Bengaluru' };
  const key = Object.prototype.hasOwnProperty.call(alias, home) ? alias[home] : home;
  return CITIES[key] || null;
}

// The AI can legitimately return fewer distinct trips than slotTarget (partial
// output, quota hits, or a small radius/budget). Rather than leaving "Open
// slot" cards, top the calendar up from the local destination catalogue so the
// monthly distribution still holds: every month keeps >= 1 trip and the total
// reaches slotTarget with never more than 2 trips per month.
function fillMissingTrips(calendar, profile) {
  const slotTarget = Math.min(24, Math.max(12, Math.round(asNumber(profile && profile.slotTarget, 20) || 20)));
  const maxDistance = Math.max(0, asNumber(profile && profile.radius, 430) || 430);
  const maxBudget = Math.max(0, asNumber(profile && profile.weekendBudget, 20000) || 20000);
  const travelers = Math.max(1, Math.round(asNumber(profile && profile.travelers, 1) || 1));
  const home = resolvedCityCoords(profile && profile.home);
  const existing = new Set(calendar.flatMap(month => month.trips.map(t => t.destination.toLowerCase())));
  let missing = slotTarget - calendar.reduce((sum, month) => sum + month.trips.length, 0);
  if (missing <= 0 || !home) return;

  const pool = DESTINATIONS
    .map(d => {
      const km = haversine(home, d);
      const cost = Math.round(d.cost * travelers * 3);
      return { d, km, cost, fits: km <= maxDistance && cost <= maxBudget && !existing.has(d.name.toLowerCase()) };
    })
    .filter(entry => entry.fits)
    .sort((a, b) => a.km - b.km);

  let pick = 0;
  for (const month of calendar) {
    if (missing <= 0) break;
    if (month.trips.length >= 2) continue;
    while (pick < pool.length && existing.has(pool[pick].d.name.toLowerCase())) pick++;
    if (pick >= pool.length) break;
    const entry = pool[pick];
    existing.add(entry.d.name.toLowerCase());
    month.trips.push({
      destination: entry.d.name,
      distanceFromHome: Math.round(entry.km),
      duration: '3 Days',
      estimatedBudget: entry.cost,
      vibe: entry.d.hl
    });
    pick++;
    missing--;
  }
}

async function getAIWeekendCalendar(profile) {
  let plan;
  if (status.gemini) {
    try {
      plan = await callGeminiWeekendCalendar(profile);
    } catch (err) {
      if (!status.groq) throw err;
      plan = await callGroqWeekendCalendar(profile);
      plan.fallbackReason = err.geminiQuotaLimited
        ? 'Gemini quota or rate limit reached; generated with Groq.'
        : 'Gemini was temporarily unavailable; generated with Groq.';
    }
  } else if (status.groq) {
    plan = await callGroqWeekendCalendar(profile);
  } else {
    const err = new Error('No AI provider is configured. Add GEMINI_API_KEY, GROQ_API_KEY, or both to .env and restart the server.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  fillMissingTrips(plan.calendar, profile);
  const totalTrips = plan.calendar.reduce((sum, month) => sum + month.trips.length, 0);
  if (totalTrips < (Math.min(24, Math.max(12, Math.round(asNumber(profile.slotTarget, 20) || 20))))) {
    plan.paddedWarning = `Only ${totalTrips} distinct trips fit within ${profile.radius} km and the per-trip budget.`;
  }
  return plan;
}

module.exports = { getAIPlan, normalizeAIPlan, getAIItinerary, normalizeItinerary, getAIWeekendCalendar, normalizeWeekendCalendar };
