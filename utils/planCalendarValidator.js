// Request normalization + LLM-output validation for POST /api/plan-calendar.
//
// The AI's answer is untrusted input. Every hard rule (window_ids must exist,
// windows must not be reused or overlap, at most one major trip per month, exact
// destination counts, per-trip and total budgets, no duplicate destinations and
// locked slots must be honoured) is re-checked here in plain code. Budget-total
// overruns that are impossible by construction (counts × per-trip budget > yearly
// budget) are handled by preflight(): we reduce the trip counts to a feasible
// target and surface `warnings` instead of failing the request.

const { getIndianHolidays } = require('./holidays');
const { generateWindows } = require('./windowGenerator');
const { validateSchema, number, string, boolean, isoDate, arrayOf, object, strictObject } = require('./schemas');
const { log } = require('./logger');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function currentYear() {
  return new Date().getFullYear();
}

const requestSchema = {
  year: number({ min: 2000, max: 2100, integer: true, optional: true, default: undefined }),
  home_city: string({ min: 1, max: 100 }),
  trip_type: string({ enum: ['weekend', 'major', 'both'] }),
  planner_view: string({ enum: ['weekends', 'major'], optional: true, default: 'weekends' }),
  traveller_type: string({ enum: ['solo', 'couple', 'family', 'friends'] }),
  travellers: number({ min: 1, max: 50, integer: true }),
  currency: string({ enum: ['INR', 'USD', 'EUR'], optional: true, default: 'INR' }),
  weekend_radius_km: number({ min: 0, max: 50000, integer: true, optional: true }),
  weekend_trips_per_year: number({ min: 0, max: 60, integer: true, optional: true }),
  weekend_budget_per_trip: number({ min: 0, optional: true }),
  major_trip_budget: number({ min: 0, optional: true }),
  major_trips_count: number({ min: 0, max: 24, integer: true, optional: true }),
  major_trip_duration_days: number({ min: 7, max: 10, integer: true, optional: true }),
  total_yearly_budget: number({ min: 0 }),
  locked_slots: arrayOf(
    strictObject({
      window_id: string({ min: 2, max: 40 }),
      kind: string({ enum: ['weekend', 'major'] }),
      destination: string({ min: 1, max: 120 }),
      start_date: isoDate(),
      end_date: isoDate(),
      estimated_cost: number({ min: 0, optional: true })
    }),
    { optional: true }
  ),
  weekend: object({
    radius_km: number({ min: 0, max: 50000, integer: true, optional: true }),
    trips_per_year: number({ min: 0, max: 60, integer: true, optional: true }),
    budget_per_trip: number({ min: 0, optional: true }),
    duration_days: number({ min: 3, max: 4, integer: true, optional: true })
  }, { optional: true }),
  major: object({
    count: number({ min: 0, max: 24, integer: true, optional: true }),
    budget_per_trip: number({ min: 0, optional: true }),
    duration_days: number({ min: 7, max: 10, integer: true, optional: true })
  }, { optional: true })
};

function normalizeCalendarRequest(body) {
  const input = body && typeof body === 'object' ? body : {};
  const validation = validateSchema(requestSchema, input);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const p = validation.data;
  const year = p.year || currentYear();
  const weekend = {
    radius_km: p.weekend_radius_km ?? p.weekend?.radius_km ?? 300,
    trips_per_year: p.weekend_trips_per_year ?? p.weekend?.trips_per_year ?? 12,
    budget_per_trip: p.weekend_budget_per_trip ?? p.weekend?.budget_per_trip ?? 8000,
    duration_days: p.weekend?.duration_days ?? 3
  };
  const major = {
    count: p.major_trips_count ?? p.major?.count ?? 1,
    budget_per_trip: p.major_trip_budget ?? p.major?.budget_per_trip ?? 45000,
    duration_days: p.major_trip_duration_days ?? p.major?.duration_days ?? 7
  };

  // trip_type drives what is planned and what is ignored.
  if (p.trip_type === 'weekend') {
    major.count = 0;
  } else if (p.trip_type === 'major') {
    weekend.trips_per_year = 0;
  }

  const { available_windows } = generateWindows(year, major.duration_days);
  const windowById = new Map(available_windows.map(w => [w.window_id, w]));

  const locked = (p.locked_slots || []).map(s => ({
    window_id: s.window_id,
    kind: s.kind,
    destination: s.destination,
    start_date: s.start_date,
    end_date: s.end_date,
    estimated_cost: typeof s.estimated_cost === 'number' ? s.estimated_cost : null
  }));

  const ctx = {
    year,
    home_city: p.home_city,
    trip_type: p.trip_type,
    planner_view: p.planner_view,
    traveller_type: p.traveller_type,
    travellers: p.travellers,
    currency: p.currency,
    weekend,
    major,
    total_yearly_budget: p.total_yearly_budget,
    locked_slots: locked,
    windowById,
    available_windows
  };
  return { ok: true, ctx };
}

// Reconcile requested trip counts with the total yearly budget. When the sum of
// per-trip budgets across all trips exceeds the yearly budget, the counts are
// reduced to the largest feasible set and warnings explain what changed.
function preflightBudget(ctx) {
  const { weekend, major, total_yearly_budget } = ctx;
  const requested = {
    weekend: ctx.trip_type === 'major' ? 0 : weekend.trips_per_year,
    major: ctx.trip_type === 'weekend' ? 0 : major.count
  };
  const warnings = [];

  if (weekend.budget_per_trip <= 0 && weekend.trips_per_year > 0) {
    warnings.push(`Weekend budget per trip is 0; no weekend trips can be planned.`);
  }
  if (major.budget_per_trip <= 0 && major.count > 0) {
    warnings.push(`Major trip budget per trip is 0; no major trips can be planned.`);
  }

  const weekendTotal = requested.weekend * weekend.budget_per_trip;
  const majorTotal = requested.major * major.budget_per_trip;
  const minimumRequired = weekendTotal + majorTotal;

  let target = { ...requested };

  if (minimumRequired <= total_yearly_budget) {
    return { target, warnings, infeasible: false };
  }

  // Infeasible by construction: trim counts so the plan can still be produced.
  const majorsAlone = requested.major * major.budget_per_trip;
  if (majorsAlone > total_yearly_budget) {
    target.major = major.budget_per_trip > 0
      ? Math.floor(total_yearly_budget / major.budget_per_trip)
      : 0;
    target.weekend = 0;
    warnings.push(
      `Major-trip budget (${major.count} × ${major.budget_per_trip}) alone exceeds the yearly budget (${total_yearly_budget}); ` +
      `planning ${target.major} major trip(s) instead.`
    );
  } else {
    const roomForWeekends = total_yearly_budget - majorsAlone;
    target.weekend = weekend.budget_per_trip > 0
      ? Math.min(requested.weekend, Math.floor(roomForWeekends / weekend.budget_per_trip))
      : 0;
    warnings.push(
      `Total requested budget (${requested.weekend} × ${weekend.budget_per_trip} + ${requested.major} × ${major.budget_per_trip}) ` +
      `exceeds the yearly budget (${total_yearly_budget}); planning ${target.weekend} weekend trip(s) and ` +
      `${target.major} major trip(s) instead.`
    );
  }
  return { target, warnings, infeasible: true };
}

const LOCKED_MATCH_FIELDS = ['kind', 'destination', 'start_date', 'end_date'];

// Extract the trips the AI produced, applying structural checks along the way.
function extractTrips(raw, ctx) {
  const trips = [];
  const errors = [];
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.months)) {
    return { trips, errors: ['response has no "months" array'] };
  }
  for (const month of raw.months) {
    if (!month || typeof month !== 'object') continue;
    const weekendTrips = Array.isArray(month.weekend_trips) ? month.weekend_trips : [];
    for (const box of weekendTrips) {
      if (!box || typeof box !== 'object') continue;
      trips.push({ kind: 'weekend', ...box });
    }
    if (month.major_trip && typeof month.major_trip === 'object') {
      trips.push({ kind: 'major', ...month.major_trip });
    }
  }
  return { trips, errors };
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Validate the extracted trips against every hard rule. Returns normalized
// trips with errors and soft warnings separated.
function validateTrips(trips, ctx, target, infeasible) {
  const errors = [];
  const warnings = [];
  const seenWindows = new Set();
  const seenDestinations = new Set();
  const byWindow = new Map();
  const monthMajorCount = new Map();

  for (const trip of trips) {
    const id = trip.window_id;
    const window = ctx.windowById.get(id);
    if (!window) {
      errors.push(`window_id "${id || '(missing)'}" is not in the available windows`);
      continue;
    }
    if (window.kind !== trip.kind) {
      errors.push(`trip "${trip.destination || id}" uses a ${window.kind} window but is declared ${trip.kind}`);
      continue;
    }
    if (trip.start_date !== window.start_date || trip.end_date !== window.end_date) {
      errors.push(`trip "${id}" dates (${trip.start_date} → ${trip.end_date}) do not match window (${window.start_date} → ${window.end_date})`);
      continue;
    }
    if (!trip.destination || !String(trip.destination).trim()) {
      errors.push(`trip "${id}" has no destination`);
      continue;
    }
    const destKey = String(trip.destination).trim().toLowerCase();
    if (seenDestinations.has(destKey)) {
      errors.push(`duplicate destination "${trip.destination}"`);
      continue;
    }
    seenDestinations.add(destKey);
    if (seenWindows.has(id)) {
      errors.push(`window "${id}" is reused across trips`);
      continue;
    }
    seenWindows.add(id);

    const durationDays = Math.round(num(trip.duration_days, trip.kind === 'weekend' ? 3 : ctx.major.duration_days));
    if (trip.kind === 'weekend' && durationDays !== 3) {
      errors.push(`weekend trip "${id}" must be 3 days (got ${durationDays})`);
      continue;
    }
    if (trip.kind === 'major' && durationDays !== ctx.major.duration_days) {
      errors.push(`major trip "${id}" must be ${ctx.major.duration_days} days (got ${durationDays})`);
      continue;
    }
    if (window.kind === 'major') {
      const count = (monthMajorCount.get(window.month) || 0) + 1;
      if (count > 1) {
        errors.push(`month ${window.month} has more than one major trip`);
        continue;
      }
      monthMajorCount.set(window.month, count);
    }

    byWindow.set(id, trip);
  }

  // Chosen windows must not overlap in date ranges.
  const chosen = [...byWindow.values()].map(t => ({ t, w: ctx.windowById.get(t.window_id) }))
    .filter(x => x.w).sort((a, b) => (a.w.start_date < b.w.start_date ? -1 : 1));
  for (let i = 1; i < chosen.length; i++) {
    if (chosen[i].w.start_date <= chosen[i - 1].w.end_date) {
      errors.push(`windows of "${chosen[i - 1].t.destination}" and "${chosen[i].t.destination}" overlap`);
      break;
    }
  }

  // Locked slots must appear in the response, unchanged.
  for (const locked of ctx.locked_slots) {
    const trip = byWindow.get(locked.window_id);
    if (!trip) {
      errors.push(`locked slot "${locked.window_id}" (${locked.destination}) is missing from the plan`);
      continue;
    }
    for (const field of LOCKED_MATCH_FIELDS) {
      if (trip[field] !== locked[field]) {
        errors.push(`locked slot "${locked.window_id}" was changed (${field} ${locked[field]} → ${trip[field]})`);
      }
    }
  }

  const weekendTrips = trips.filter(t => byWindow.has(t.window_id) && t.kind === 'weekend');
  const majorTrips = trips.filter(t => byWindow.has(t.window_id) && t.kind === 'major');

  const budgetKind = kind => (kind === 'major' ? ctx.major.budget_per_trip : ctx.weekend.budget_per_trip);
  let totalCost = 0;
  for (const t of weekendTrips) {
    const cost = num(t.estimated_cost);
    totalCost += cost;
    if (cost > ctx.weekend.budget_per_trip) {
      const msg = `weekend trip "${t.destination}" costs ${cost} which exceeds the per-trip budget ${ctx.weekend.budget_per_trip}`;
      infeasible ? warnings.push(msg) : errors.push(msg);
    }
    const km = num(t.distance_km_from_home);
    if (km && km > ctx.weekend.radius_km) {
      warnings.push(`"${t.destination}" is ~${Math.round(km)} km away, beyond the ${ctx.weekend.radius_km} km weekend radius`);
    }
  }
  for (const t of majorTrips) {
    const cost = num(t.estimated_cost);
    totalCost += cost;
    if (cost > ctx.major.budget_per_trip) {
      const msg = `major trip "${t.destination}" costs ${cost} which exceeds the per-trip budget ${ctx.major.budget_per_trip}`;
      infeasible ? warnings.push(msg) : errors.push(msg);
    }
  }
  if (totalCost > ctx.total_yearly_budget) {
    const msg = `total estimated cost (${totalCost}) exceeds the yearly budget (${ctx.total_yearly_budget})`;
    infeasible ? warnings.push(msg) : errors.push(msg);
  }

  if (weekendTrips.length > target.weekend) {
    const msg = `too many weekend trips (${weekendTrips.length}; target ${target.weekend})`;
    infeasible ? warnings.push(msg) : errors.push(msg);
  } else if (weekendTrips.length < target.weekend) {
    warnings.push(`planned ${weekendTrips.length} of ${target.weekend} requested weekend trips; ${ctx.weekend.radius_km} km radius and budgets may limit distinct destinations`);
  }
  if (majorTrips.length > target.major) {
    const msg = `too many major trips (${majorTrips.length}; target ${target.major})`;
    infeasible ? warnings.push(msg) : errors.push(msg);
  } else if (majorTrips.length < target.major && ctx.trip_type !== 'weekend') {
    warnings.push(`planned ${majorTrips.length} of ${target.major} requested major trips`);
  }

  const normalized = [...weekendTrips, ...majorTrips];
  return { normalized, errors, warnings, totalCost };
}

function buildResponse(ctx, trips, warnings) {
  const months = MONTH_NAMES.map((name, i) => ({ month: i + 1, month_name: name, weekend_trips: [], major_trip: null }));

  const weekendCounter = { n: 0 };
  const majorCounter = { n: 0 };

  for (const trip of trips) {
    const window = ctx.windowById.get(trip.window_id);
    if (!window) continue;
    const monthObj = months[window.month - 1];
    const counter = trip.kind === 'major' ? majorCounter : weekendCounter;
    counter.n += 1;
    const tripId = `T-${ctx.year}-${String(window.month).padStart(2, '0')}-${trip.kind === 'major' ? 'M' : 'W'}${counter.n}`;
    const entry = {
      trip_id: tripId,
      window_id: trip.window_id,
      kind: trip.kind,
      destination: String(trip.destination).trim(),
      state_or_country: String(trip.state_or_country || (trip.kind === 'major' ? 'India' : 'India')).trim(),
      start_date: window.start_date,
      end_date: window.end_date,
      duration_days: trip.kind === 'weekend' ? 3 : ctx.major.duration_days,
      distance_km_from_home: Math.round(num(trip.distance_km_from_home)),
      estimated_cost: Math.round(num(trip.estimated_cost)),
      cost_currency: ctx.currency,
      short_reason: String(trip.short_reason || '').trim(),
      best_transport: String(trip.best_transport || '').trim()
    };
    if (trip.kind === 'major') {
      if (Array.isArray(trip.multi_stop_route) && trip.multi_stop_route.length) {
        entry.multi_stop_route = trip.multi_stop_route;
      }
      monthObj.major_trip = entry;
    } else {
      monthObj.weekend_trips.push(entry);
    }
  }

  for (const month of months) {
    month.weekend_trips.sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
  }

  const totalCost = trips.reduce((s, t) => s + Math.round(num(t.estimated_cost)), 0);
  const weekendCount = trips.filter(t => t.kind === 'weekend').length;
  const majorCount = trips.filter(t => t.kind === 'major').length;

  return {
    year: ctx.year,
    months,
    summary: {
      total_weekend_trips: weekendCount,
      total_major_trips: majorCount,
      total_estimated_cost: totalCost,
      total_yearly_budget: ctx.total_yearly_budget,
      budget_remaining: ctx.total_yearly_budget - totalCost
    },
    warnings
  };
}

// Orchestration used by the controller: preflight -> (retry loop) -> validate -> build.
function validateAndBuild(rawPlan, ctx, previousErrors) {
  const preflight = preflightBudget(ctx);
  const { trips, errors: extractionErrors } = extractTrips(rawPlan, ctx);
  const { normalized, errors: tripErrors, warnings, totalCost } = validateTrips(trips, ctx, preflight.target, preflight.infeasible);
  const errors = [...extractionErrors, ...tripErrors];

  if (errors.length) {
    log('validate', 'plan-calendar response invalid', { errors, previousErrors: previousErrors || [] });
    return { errors, warnings, preflight };
  }

  const response = buildResponse(ctx, normalized, [...preflight.warnings, ...warnings]);
  return { errors: [], warnings, preflight, response };
}

module.exports = {
  normalizeCalendarRequest,
  preflightBudget,
  validateAndBuild,
  generateWindows,
  getIndianHolidays,
  MONTH_NAMES,
  requestSchema
};