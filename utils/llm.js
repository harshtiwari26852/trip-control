const { keys, status } = require('./apiKeys');

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

async function callGemini(profile) {
  const prompt = `You are Trip Control's AI travel planner. Use the enabled Google Maps grounding tool to discover real places in India. Do not use a pre-supplied destination catalogue. Produce a full-year Indian travel plan as VALID JSON ONLY.

Constraints:
- weekendSlots: 2-3 day trips, within ${profile.radius}km of ${profile.home}, each <= ₹${profile.weekendBudget}/trip.
- majorTrip: ${profile.durSlider} days, <= ₹${profile.majorBudget}.
- Total weekend + major spend <= ₹${profile.yearlyBudget}.
- Select real, distinct destinations sourced through Google Maps grounding. Never repeat a destination.
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
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleMaps: {} }],
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
    throw err;
  }
  const j = await res.json();
  const candidate = j && j.candidates && j.candidates[0];
  const text = candidate && candidate.content && candidate.content.parts &&
    candidate.content.parts[0] && candidate.content.parts[0].text;
  if (!text) {
    const err = new Error('Gemini returned no usable plan. Try again with a simpler trip profile.');
    err.code = 'AI_PROVIDER_FAILED';
    throw err;
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && (Array.isArray(parsed.weekendSlots) || parsed.majorTrip)) {
      const chunks = (candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks) || [];
      parsed.mapSources = chunks
        .filter(chunk => chunk.maps && chunk.maps.uri && chunk.maps.title)
        .map(chunk => ({ title: chunk.maps.title, uri: chunk.maps.uri, placeId: chunk.maps.placeId || null }));
      if (!parsed.mapSources.length) {
        const err = new Error('Gemini did not return Google Maps-grounded places. Please try again.');
        err.code = 'AI_PROVIDER_FAILED';
        throw err;
      }
      parsed.source = 'gemini-google-maps';
      return parsed;
    }
  } catch (_) {
    const err = new Error('Gemini returned an invalid plan. Please try again.');
    err.code = 'AI_PROVIDER_FAILED';
    throw err;
  }
  const err = new Error('Gemini returned an incomplete plan. Please try again.');
  err.code = 'AI_PROVIDER_FAILED';
  throw err;
}

async function getAIPlan(userProfile) {
  if (!status.gemini) {
    const err = new Error('Gemini is not configured. Add a valid GEMINI_API_KEY to .env and restart the server.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  return callGemini(userProfile);
}

module.exports = { getAIPlan };
