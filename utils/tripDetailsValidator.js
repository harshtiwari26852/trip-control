// Request normalization + LLM-output validation for POST /api/trip-details.

const { validateSchema, number, string, boolean, isoDate, arrayOf, object, strictObject } = require('./schemas');
const { log } = require('./logger');

function parseISO(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function addDays(dateStr, n) {
  const d = parseISO(dateStr);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}
function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

const requestSchema = {
  trip_id: string({ min: 2, max: 60 }),
  kind: string({ enum: ['weekend', 'major'] }),
  home_city: string({ min: 1, max: 100, optional: true, default: '' }),
  destination: string({ min: 1, max: 120 }),
  start_date: isoDate(),
  end_date: isoDate(),
  duration_days: number({ min: 3, max: 10, integer: true }),
  traveller_type: string({ enum: ['solo', 'couple', 'family', 'friends'] }),
  travellers: number({ min: 1, max: 50, integer: true }),
  budget: number({ min: 0, optional: true, default: 0 }),
  currency: string({ enum: ['INR', 'USD', 'EUR'], optional: true, default: 'INR' }),
  travel_mode: string({ enum: ['flight', 'train', 'drive'], optional: true }),
  pace: string({ enum: ['relaxed', 'balanced', 'action'], optional: true }),
  regenerate: boolean({ optional: true, default: false })
};

function normalizeTripDetailsRequest(body) {
  const input = body && typeof body === 'object' ? body : {};
  const validation = validateSchema(requestSchema, input);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const p = validation.data;
  const expectedDuration = daysBetween(p.start_date, p.end_date) + 1;
  if (expectedDuration !== p.duration_days) {
    return {
      ok: false,
      errors: [`duration_days (${p.duration_days}) does not match ${p.start_date} → ${p.end_date} (${expectedDuration} days)`]
    };
  }
  if (p.kind === 'weekend' && p.duration_days !== 3) {
    return { ok: false, errors: ['kind "weekend" must have duration_days 3'] };
  }
  return { ok: true, ctx: { ...p } };
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function hasRestDay(itinerary) {
  if (!Array.isArray(itinerary)) return false;
  const words = [];
  for (const day of itinerary) {
    const title = String((day && day.title) || '').toLowerCase();
    const groups = [];
    for (const g of ['morning', 'afternoon', 'evening']) {
      if (Array.isArray(day && day[g])) {
        for (const act of day[g]) {
          if (act && typeof act === 'object' && act.activity) groups.push(String(act.activity).toLowerCase());
        }
      }
    }
    words.push(title, ...groups);
  }
  return words.some(text => /\b(rest|relax|flex|leisure|free day)\b/.test(text));
}

// Normalize and validate the model's answer. Hard errors get retried; soft
// issues only produce warnings.
function normalizeDetails(raw, ctx) {
  const errors = [];
  const warnings = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { details: null, errors: ['model response is not a JSON object'], warnings };
  }

  if (!raw.overview || typeof raw.overview !== 'object') {
    errors.push('missing "overview" object');
  }
  if (!raw.transport || typeof raw.transport !== 'object' || !Array.isArray(raw.transport.options) || !raw.transport.options.length) {
    errors.push('"transport" must exist with at least one "options" entry');
  }
  if (!raw.stay || typeof raw.stay !== 'object' || !Array.isArray(raw.stay.options)) {
    errors.push('"stay" must exist with an "options" array');
  }
  if (!raw.cost_breakdown || typeof raw.cost_breakdown !== 'object') {
    errors.push('missing "cost_breakdown" object');
  }

  const itinerary = raw.itinerary;
  if (!Array.isArray(itinerary)) {
    errors.push('"itinerary" must be an array');
  } else if (itinerary.length !== ctx.duration_days) {
    errors.push(`"itinerary" must have exactly ${ctx.duration_days} entries (got ${itinerary.length})`);
  } else {
    for (let i = 0; i < itinerary.length; i++) {
      const day = itinerary[i];
      const expectedDate = addDays(ctx.start_date, i);
      if (!day || typeof day !== 'object') {
        errors.push(`itinerary[${i}] is not an object`);
        continue;
      }
      if (day.date && day.date !== expectedDate) {
        errors.push(`itinerary[${i}].date should be ${expectedDate} (got ${day.date})`);
      }
      if (day.date && day.day !== i + 1) {
        errors.push(`itinerary[${i}].day should be ${i + 1} (got ${day.day})`);
      }
    }
  }

  if (ctx.kind === 'major' && ctx.duration_days >= 8 && itinerary && Array.isArray(itinerary)) {
    if (!hasRestDay(itinerary)) {
      warnings.push('a rest/flex day is recommended for trips of 8+ days');
    }
  }

  if (errors.length) {
    log('validate', 'trip-details response invalid', { errors });
    return { details: null, errors, warnings };
  }

  const total = num(raw.cost_breakdown.total);
  const withinBudget = raw.cost_breakdown.within_budget !== false && total <= ctx.budget;
  if (total > ctx.budget && raw.cost_breakdown.within_budget) {
    warnings.push(`estimated total (${total}) exceeds the ${ctx.budget} budget`);
  }

  const details = {
    trip_id: ctx.trip_id,
    kind: ctx.kind,
    destination: raw.destination || ctx.destination,
    overview: raw.overview,
    transport: {
      from_city: raw.transport.from_city || ctx.home_city,
      options: raw.transport.options,
      recommended_mode: raw.transport.recommended_mode || '',
      recommendation_reason: raw.transport.recommendation_reason || '',
      local_transport: raw.transport.local_transport || ''
    },
    stay: raw.stay,
    itinerary,
    places_to_visit: Array.isArray(raw.places_to_visit) ? raw.places_to_visit : [],
    food_to_try: Array.isArray(raw.food_to_try) ? raw.food_to_try : [],
    cost_breakdown: { ...raw.cost_breakdown, within_budget: withinBudget },
    packing_list: Array.isArray(raw.packing_list) ? raw.packing_list : [],
    safety_and_tips: Array.isArray(raw.safety_and_tips) ? raw.safety_and_tips : [],
    booking_notes: typeof raw.booking_notes === 'string' ? raw.booking_notes : '',
    disclaimer: typeof raw.disclaimer === 'string' ? raw.disclaimer : 'AI-generated estimates. Verify prices, timings and availability.'
  };
  if (ctx.kind === 'major') {
    details.multi_stop_route = Array.isArray(raw.multi_stop_route) ? raw.multi_stop_route : [];
  }
  return { details, errors, warnings };
}

module.exports = { normalizeTripDetailsRequest, normalizeDetails, daysBetween, addDays, parseISO, toISODate };