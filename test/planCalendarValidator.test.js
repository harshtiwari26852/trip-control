const { test } = require('node:test');
const assert = require('node:assert');
const {
  normalizeCalendarRequest,
  preflightBudget,
  validateAndBuild
} = require('../utils/planCalendarValidator');
const { generateWindows } = require('../utils/windowGenerator');

const BASE = {
  year: 2026,
  home_city: 'Delhi',
  trip_type: 'both',
  planner_view: 'weekends',
  traveller_type: 'solo',
  travellers: 1,
  currency: 'INR',
  weekend: { radius_km: 300, trips_per_year: 12, budget_per_trip: 8000 },
  major: { count: 1, budget_per_trip: 45000, duration_days: 7 },
  total_yearly_budget: 150000,
  locked_slots: []
};

// Build a raw LLM-shaped plan from window ids.
function pick(ctx, kind, month) {
  return ctx.available_windows.find(w => w.kind === kind && w.month === month);
}

function rawPlanFromMonths(ctx, entries) {
  const months = new Map();
  for (const e of entries) {
    const window = ctx.windowById.get(e.window_id) || {
      month: e.month || 1,
      start_date: e.start_date || '2026-01-02',
      end_date: e.end_date || '2026-01-04'
    };
    if (!months.has(window.month)) months.set(window.month, { month: window.month, weekend_trips: [], major_trip: null });
    const trip = {
      window_id: e.window_id,
      destination: e.destination || '',
      state_or_country: 'Rajasthan, India',
      start_date: window.start_date,
      end_date: window.end_date,
      duration_days: e.duration_days || (e.kind === 'weekend' ? 3 : 7),
      distance_km_from_home: e.distance || 250,
      estimated_cost: e.cost,
      cost_currency: 'INR',
      short_reason: 'good weather',
      best_transport: 'Train'
    };
    if (e.kind === 'major') months.get(window.month).major_trip = trip;
    else months.get(window.month).weekend_trips.push(trip);
  }
  return { months: [...months.values()], warnings: [] };
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

// 12 weekend windows (one per month, avoiding the major window) + 1 major,
// all within budgets by default.
function validEntries(ctx) {
  const major = ctx.available_windows.find(w => w.kind === 'major' && w.month === 5);
  const entries = [];
  for (let m = 1; m <= 12; m++) {
    const candidates = ctx.available_windows.filter(w => w.kind === 'weekend' && w.month === m);
    const w = candidates.find(c => !overlaps(c.start_date, c.end_date, major.start_date, major.end_date)) || candidates[0];
    entries.push({ window_id: w.window_id, kind: 'weekend', destination: `Dest${m}`, cost: 6000, distance: 200 });
  }
  entries.push({ window_id: major.window_id, kind: 'major', destination: 'Kerala', cost: 40000, distance: 2200 });
  return entries;
}

test('normalizeCalendarRequest accepts the documented request shape and builds windows', () => {
  const { ok, ctx, errors } = normalizeCalendarRequest({ ...BASE });
  assert.strictEqual(ok, true, errors && errors.join('; '));
  assert.strictEqual(ctx.year, 2026);
  assert.strictEqual(ctx.trip_type, 'both');
  assert.strictEqual(ctx.weekend.trips_per_year, 12);
  assert.strictEqual(ctx.major.count, 1);
  assert.ok(ctx.available_windows.length > 100);
  assert.ok(ctx.windowById.size === ctx.available_windows.length);
});

test('normalizeCalendarRequest accepts flat form-style keys too', () => {
  const flat = {
    year: 2026,
    home_city: 'Delhi',
    trip_type: 'both',
    traveller_type: 'solo',
    travellers: 2,
    weekend_radius_km: 200,
    weekend_trips_per_year: 10,
    weekend_budget_per_trip: 7000,
    major_trip_budget: 40000,
    major_trips_count: 2,
    major_trip_duration_days: 8,
    total_yearly_budget: 150000
  };
  const { ok, ctx, errors } = normalizeCalendarRequest(flat);
  assert.strictEqual(ok, true, errors && errors.join('; '));
  assert.strictEqual(ctx.weekend.radius_km, 200);
  assert.strictEqual(ctx.weekend.trips_per_year, 10);
  assert.strictEqual(ctx.major.count, 2);
  assert.strictEqual(ctx.major.duration_days, 8);
  assert.strictEqual(ctx.travellers, 2);
});

test('trip_type weekend ignores major fields and vice versa', () => {
  const weekend = normalizeCalendarRequest({ ...BASE, trip_type: 'weekend' }).ctx;
  assert.strictEqual(weekend.major.count, 0);
  assert.strictEqual(weekend.weekend.trips_per_year, 12);

  const major = normalizeCalendarRequest({ ...BASE, trip_type: 'major' }).ctx;
  assert.strictEqual(major.weekend.trips_per_year, 0);
  assert.strictEqual(major.major.count, 1);
});

test('invalid inputs are rejected with messages', () => {
  const { ok, errors } = normalizeCalendarRequest({ ...BASE, trip_type: 'spaceship' });
  assert.strictEqual(ok, false);
  assert.ok(errors.some(e => e.includes('trip_type')));
});

test('preflight returns feasible targets unchanged when budgets fit', () => {
  const ctx = normalizeCalendarRequest({ ...BASE }).ctx;
  const { target, warnings, infeasible } = preflightBudget(ctx);
  assert.strictEqual(infeasible, false);
  assert.strictEqual(target.weekend, 12);
  assert.strictEqual(target.major, 1);
  assert.strictEqual(warnings.length, 0);
});

test('preflight reduces counts when counts x budgets exceed the yearly budget', () => {
  const ctx = normalizeCalendarRequest({
    ...BASE,
    weekend: { radius_km: 300, trips_per_year: 12, budget_per_trip: 8000 },
    major: { count: 2, budget_per_trip: 50000, duration_days: 7 },
    total_yearly_budget: 150000
  }).ctx;
  const minRequired = 12 * 8000 + 2 * 50000; // 196000
  assert.ok(minRequired > 150000);
  const { target, warnings, infeasible } = preflightBudget(ctx);
  assert.strictEqual(infeasible, true);
  assert.ok(target.weekend * 8000 + target.major * 50000 <= 150000);
  assert.ok(warnings.length > 0);
});

test('validateAndBuild produces a valid 12-month response for a good plan', () => {
  const ctx = normalizeCalendarRequest({ ...BASE }).ctx;
  const raw = rawPlanFromMonths(ctx, validEntries(ctx));
  const { errors, response } = validateAndBuild(raw, ctx, []);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(response.months.length, 12);
  assert.strictEqual(response.summary.total_weekend_trips, 12);
  assert.strictEqual(response.summary.total_major_trips, 1);
  assert.strictEqual(response.summary.total_estimated_cost, 12 * 6000 + 40000);
  assert.strictEqual(response.summary.budget_remaining, 150000 - (12 * 6000 + 40000));
});

test('empty months are represented with empty arrays and null majors', () => {
  const ctx = normalizeCalendarRequest({ ...BASE }).ctx;
  const raw = rawPlanFromMonths(ctx, []);
  const { errors, response } = validateAndBuild(raw, ctx, []);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(response.months.length, 12);
  for (const m of response.months) {
    assert.deepStrictEqual(m.weekend_trips, []);
    assert.strictEqual(m.major_trip, null);
  }
});

test('max-one-major-per-month is enforced', () => {
  const ctx = normalizeCalendarRequest({ ...BASE, major: { count: 2, budget_per_trip: 45000, duration_days: 7 } }).ctx;
  const a = pick(ctx, 'major', 5);
  const bAlt = ctx.available_windows.find(w => w.kind === 'major' && w.month === 5 && w.window_id !== a.window_id);
  assert.ok(a && bAlt, 'need two distinct major windows in May');
  const tripFor = (e) => {
    const window = ctx.windowById.get(e.window_id);
    return {
      window_id: e.window_id,
      destination: e.destination,
      state_or_country: 'India',
      start_date: window.start_date,
      end_date: window.end_date,
      duration_days: 7,
      distance_km_from_home: 2200,
      estimated_cost: 40000,
      cost_currency: 'INR',
      short_reason: 'nice',
      best_transport: 'Flight'
    };
  };
  const raw = {
    months: [
      { month: 5, weekend_trips: [], major_trip: tripFor({ window_id: a.window_id, destination: 'Kerala' }) },
      { month: 5, weekend_trips: [], major_trip: tripFor({ window_id: bAlt.window_id, destination: 'Goa' }) }
    ],
    warnings: []
  };
  const { errors } = validateAndBuild(raw, ctx, []);
  assert.ok(errors.some(e => e.includes('more than one major trip')), `expected major-in-month error, got ${errors.join('; ')}`);
});

test('budget sum validation: total exceeding the yearly budget is an error (feasible mode)', () => {
  const ctx = normalizeCalendarRequest({ ...BASE }).ctx;
  const entries = validEntries(ctx).map((e, i) =>
    i === 0 ? { ...e, cost: 200000 } : e); // one weekend trip blows the yearly total alone
  const raw = rawPlanFromMonths(ctx, entries);
  const { errors } = validateAndBuild(raw, ctx, []);
  assert.ok(errors.some(e => e.includes('exceeds the per-trip budget')), 'per-trip overrun should error');
});

test('per-trip budget violations become warnings when infeasible by construction', () => {
  const ctx = normalizeCalendarRequest({ ...BASE, total_yearly_budget: 30000 }).ctx;
  const entries = validEntries(ctx).map((e, i) => (i === 0 ? { ...e, cost: 9000 } : e)); // weekend over its 8000 cap
  const raw = rawPlanFromMonths(ctx, entries);
  const { errors, warnings } = validateAndBuild(raw, ctx, []);
  assert.deepStrictEqual(errors, []);
  assert.ok(warnings.some(w => w.includes('exceeds the per-trip budget')));
  assert.ok(warnings.some(w => w.includes('exceeds the yearly budget')));
});

test('unknown window_id is a hard error', () => {
  const ctx = normalizeCalendarRequest({ ...BASE }).ctx;
  const entries = validEntries(ctx).slice(0, 1).map(e => ({ ...e, window_id: 'W-1999-01-01' }));
  const raw = rawPlanFromMonths(ctx, entries);
  const { errors } = validateAndBuild(raw, ctx, []);
  assert.ok(errors.some(e => e.includes('not in the available windows')));
});

test('duplicate destinations are a hard error', () => {
  const ctx = normalizeCalendarRequest({ ...BASE }).ctx;
  const entries = validEntries(ctx).slice(0, 2).map(e => ({ ...e, destination: 'Jaipur' }));
  const raw = rawPlanFromMonths(ctx, entries);
  const { errors } = validateAndBuild(raw, ctx, []);
  assert.ok(errors.some(e => e.includes('duplicate destination')));
});

test('locked slots must be kept exactly', () => {
  const realCtx = normalizeCalendarRequest({ ...BASE }).ctx;
  const w3 = pick(realCtx, 'weekend', 3);
  const lockedCtx = normalizeCalendarRequest({
    ...BASE,
    locked_slots: [{
      window_id: w3.window_id,
      kind: 'weekend',
      destination: 'Agra',
      start_date: w3.start_date,
      end_date: w3.end_date,
      estimated_cost: 6000
    }]
  }).ctx;

  // Plan that drops the locked slot -> error.
  const missingLocked = rawPlanFromMonths(lockedCtx, validEntries(lockedCtx).filter(e => e.window_id !== w3.window_id));
  const missingCheck = validateAndBuild(missingLocked, lockedCtx, []);
  assert.ok(missingCheck.errors.some(e => e.includes('locked slot')));

  // Plan that keeps it but changes the destination -> error.
  const entries = validEntries(lockedCtx).map(e =>
    e.window_id === w3.window_id ? { ...e, destination: 'Jaipur' } : e);
  const changedCheck = validateAndBuild(rawPlanFromMonths(lockedCtx, entries), lockedCtx, []);
  assert.ok(changedCheck.errors.some(e => e.includes('locked slot')));
});

test('trips_per_year and destination counts: fewer weekend trips is a warning', () => {
  const ctx = normalizeCalendarRequest({ ...BASE }).ctx;
  const w = pick(ctx, 'weekend', 1);
  const raw = rawPlanFromMonths(ctx, [
    { window_id: w.window_id, kind: 'weekend', destination: 'Dest1', cost: 6000 }
  ]);
  const { errors, warnings } = validateAndBuild(raw, ctx, []);
  assert.deepStrictEqual(errors, []);
  assert.ok(warnings.some(w => w.includes('planned 1 of 12')));
});