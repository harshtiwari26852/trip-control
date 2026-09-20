const { test } = require('node:test');
const assert = require('node:assert');
const { normalizeTripDetailsRequest, normalizeDetails } = require('../utils/tripDetailsValidator');

const REQUEST = {
  trip_id: 'T-2026-01-W1',
  kind: 'weekend',
  home_city: 'Delhi',
  destination: 'Jaipur',
  start_date: '2026-01-16',
  end_date: '2026-01-18',
  duration_days: 3,
  traveller_type: 'solo',
  travellers: 1,
  budget: 8000,
  currency: 'INR',
  regenerate: false
};

function validRaw(overrides = {}) {
  return {
    overview: {
      summary: 'A quick winter escape into Rajasthan.',
      best_time_note: 'Cool and dry.',
      weather: { avg_temp_c_min: 8, avg_temp_c_max: 22, conditions: 'Dry' }
    },
    transport: {
      from_city: 'Delhi',
      options: [
        { mode: 'Train', details: 'Fast', duration_hours: 4.5, estimated_cost_per_person: 900, pros: [], cons: [] }
      ],
      recommended_mode: 'Train',
      recommendation_reason: 'Fastest',
      local_transport: 'Auto'
    },
    stay: {
      area_recommendation: 'Old City',
      options: [{ name: 'Hotel X', category: 'budget', area: 'Old City', price_per_night_estimate: 1500, why_good: 'Centrally located', suits: 'solo' }],
      total_stay_cost_estimate: 3000
    },
    itinerary: [
      { day: 1, date: '2026-01-16', title: 'Arrival', morning: [], afternoon: [], evening: [], meals: {}, day_cost_estimate: 2000 },
      { day: 2, date: '2026-01-17', title: 'Forts', morning: [], afternoon: [], evening: [], meals: {}, day_cost_estimate: 1500 },
      { day: 3, date: '2026-01-18', title: 'Return', morning: [], afternoon: [], evening: [], meals: {}, day_cost_estimate: 1000 }
    ],
    places_to_visit: [{ name: 'Amer Fort', type: 'Historical', why_visit: '', time_needed_hours: 3, entry_fee_estimate: 200, best_time: 'Morning' }],
    food_to_try: [{ dish: 'Pyaaz kachori', where: 'Old City' }],
    cost_breakdown: { transport: 1800, stay: 3000, food: 1500, activities: 600, local_transport: 500, miscellaneous: 300, total: 7700, within_budget: true },
    packing_list: ['Power bank'],
    safety_and_tips: [],
    booking_notes: 'Book early.',
    disclaimer: 'Estimates only.'
  };
}

test('trip-details request validates and computes duration from dates', () => {
  const { ok, ctx, errors } = normalizeTripDetailsRequest(REQUEST);
  assert.strictEqual(ok, true, errors && errors.join('; '));
  assert.strictEqual(ctx.duration_days, 3);
});

test('trip-details request rejects a duration mismatch', () => {
  const { ok, errors } = normalizeTripDetailsRequest({ ...REQUEST, duration_days: 5 });
  assert.strictEqual(ok, false);
  assert.ok(errors.some(e => e.includes('does not match')));
});

test('trip-details request rejects weekend kind with non-3 duration', () => {
  const { ok, errors } = normalizeTripDetailsRequest({
    ...REQUEST,
    start_date: '2026-01-16',
    end_date: '2026-01-20',
    duration_days: 5
  });
  assert.strictEqual(ok, false);
  assert.ok(errors.some(e => e.includes('weekend')));
});

test('normalizeDetails keeps a valid itinerary and sets within_budget', () => {
  const { ok, ctx } = normalizeTripDetailsRequest(REQUEST);
  const { details, errors, warnings } = normalizeDetails(validRaw(), ctx);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(details.itinerary.length, 3);
  assert.strictEqual(details.cost_breakdown.within_budget, true);
  assert.deepStrictEqual(warnings, []);
});

test('normalizeDetails rejects wrong itinerary length', () => {
  const { ctx } = normalizeTripDetailsRequest(REQUEST);
  const raw = validRaw();
  raw.itinerary = raw.itinerary.slice(0, 2);
  const { errors } = normalizeDetails(raw, ctx);
  assert.ok(errors.some(e => e.includes('exactly 3 entries')));
});

test('normalizeDetails rejects a date that does not continue day by day', () => {
  const { ctx } = normalizeTripDetailsRequest(REQUEST);
  const raw = validRaw();
  raw.itinerary[1].date = '2026-01-20';
  const { errors } = normalizeDetails(raw, ctx);
  assert.ok(errors.some(e => e.includes('itinerary[1].date')));
});

test('normalizeDetails rejects a missing transport section', () => {
  const { ctx } = normalizeTripDetailsRequest(REQUEST);
  const raw = validRaw();
  delete raw.transport;
  const { errors } = normalizeDetails(raw, ctx);
  assert.ok(errors.some(e => e.includes('transport')));
});

test('major trips of 8+ days get a soft warning when no rest day is planned', () => {
  const majorReq = {
    ...REQUEST,
    kind: 'major',
    trip_id: 'T-2026-05-M1',
    start_date: '2026-05-09',
    end_date: '2026-05-16',
    duration_days: 8,
    budget: 45000
  };
  const { ctx } = normalizeTripDetailsRequest(majorReq);
  const raw = validRaw();
  raw.itinerary = Array.from({ length: 8 }, (_, i) => ({
    day: i + 1,
    date: `2026-05-${String(9 + i).padStart(2, '0')}`,
    title: 'Full day of sightseeing',
    morning: [{ time: '09:00', activity: 'Sightseeing', place: null, duration_hours: 4, cost_estimate: 500, tip: '' }],
    afternoon: [],
    evening: [],
    meals: {},
    day_cost_estimate: 1500
  }));
  raw.cost_breakdown.total = 30000;
  raw.multi_stop_route = [{ city: 'Munnar', nights: 3, transport_between: 'Cab' }];
  const { details, errors, warnings } = normalizeDetails(raw, ctx);
  assert.deepStrictEqual(errors, []);
  assert.ok(details.multi_stop_route.length === 1);
  assert.ok(warnings.some(w => w.includes('rest/flex')));
});

test('major trip of 8+ days with a rest day gets no warning', () => {
  const majorReq = {
    ...REQUEST,
    kind: 'major',
    trip_id: 'T-2026-05-M1',
    start_date: '2026-05-09',
    end_date: '2026-05-16',
    duration_days: 8,
    budget: 45000
  };
  const { ctx } = normalizeTripDetailsRequest(majorReq);
  const raw = validRaw();
  raw.itinerary = Array.from({ length: 8 }, (_, i) => ({
    day: i + 1,
    date: `2026-05-${String(9 + i).padStart(2, '0')}`,
    title: i === 3 ? 'Rest and relax by the lake' : 'Sightseeing',
    morning: [{ time: '09:00', activity: 'Explore', place: null, duration_hours: 4, cost_estimate: 500, tip: '' }],
    afternoon: [],
    evening: [],
    meals: {},
    day_cost_estimate: 1500
  }));
  raw.cost_breakdown.total = 30000;
  const { errors, warnings } = normalizeDetails(raw, ctx);
  assert.deepStrictEqual(errors, []);
  assert.ok(!warnings.some(w => w.includes('rest/flex')));
});

test('non-object responses are rejected', () => {
  const { ctx } = normalizeTripDetailsRequest(REQUEST);
  const { errors } = normalizeDetails('oops', ctx);
  assert.ok(errors.length > 0);
});