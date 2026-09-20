// System + user prompt builders for POST /api/plan-calendar.
// The system prompt is authoritative: it declares the hard rules that the
// server re-validates in code after the model answers.

const SYSTEM_PROMPT =
  'You are TripWise, an expert Indian and international travel planner. You receive user constraints and a list of available date windows. Choose destinations and assign each trip to exactly one available window. Follow every rule strictly: correct number of weekend and major trips, at most one major trip per calendar month, every weekend destination within the radius from the home city, per-trip and total budgets respected, season-appropriate destinations, no repeated destinations, only use window_ids that were provided, respect locked_slots. Prefer long weekends for major trips. Costs must be realistic in the given currency for the given number of travellers. Respond ONLY with JSON matching the provided schema. No markdown, no commentary. If the constraints cannot all be met, return the closest valid plan and explain in `warnings`.';

const RESPONSE_SCHEMA = `{
  "months": [
    {
      "month": 1,
      "weekend_trips": [
        {
          "window_id": "W-<year>-<MM>-<DD> (must be one of the provided weekend window_ids)",
          "destination": "City/town name",
          "state_or_country": "e.g. Rajasthan, India",
          "start_date": "YYYY-MM-DD (exactly the window start)",
          "end_date": "YYYY-MM-DD (exactly the window end)",
          "duration_days": 3,
          "distance_km_from_home": 280,
          "estimated_cost": 7500,
          "cost_currency": "INR",
          "short_reason": "1 line: why this destination/date",
          "best_transport": "Train | Bus | Car | Flight"
        }
      ],
      "major_trip": null
    }
  ],
  "warnings": []
}`;

// Curate the windows shown to the model. The full set lives in
// ctx.available_windows (used by server-side validation); the prompt only ever
// shows a deterministic subset so the request stays small enough for every
// LLM provider. Locked-slot windows are always included unchanged.
function selectPromptWindows(ctx) {
  const results = new Map();
  const add = w => { if (w) results.set(w.window_id, w); };

  for (const l of ctx.locked_slots || []) add(ctx.windowById.get(l.window_id));

  const wantsWeekends = (ctx.targets.weekend || 0) > 0;
  const wantsMajors = (ctx.targets.major || 0) > 0 || ctx.planner_view !== 'weekends';

  if (wantsWeekends) {
    const weekends = (ctx.available_windows || []).filter(w => w.kind === 'weekend');
    for (const w of weekends.filter(w => w.is_long_weekend)) add(w);
    const regularByMonth = new Map();
    for (const w of weekends.filter(w => !w.is_long_weekend)) {
      if (!regularByMonth.has(w.month)) regularByMonth.set(w.month, []);
      regularByMonth.get(w.month).push(w);
    }
    for (const list of regularByMonth.values()) {
      list.sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
      add(list[0]);
    }
  }

  if (wantsMajors) {
    const majorsByMonth = new Map();
    for (const w of (ctx.available_windows || []).filter(w => w.kind === 'major' && w.is_long_weekend)) {
      if (!majorsByMonth.has(w.month)) majorsByMonth.set(w.month, []);
      majorsByMonth.get(w.month).push(w);
    }
    for (const list of majorsByMonth.values()) {
      list.sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
      list.slice(0, 3).forEach(add);
    }
  }

  return [...results.values()];
}

function formatWindow(w) {
  return `${w.window_id}|${w.kind}|${w.start_date}>${w.end_date}|m=${w.month}${w.is_long_weekend ? '|lw' : ''}${w.holiday_name ? `|h=${w.holiday_name}` : ''}`;
}

function buildPlanCalendarUserPrompt(ctx) {
  const windows = selectPromptWindows(ctx).map(formatWindow).join('\n');

  const locked = ctx.locked_slots.length ? ctx.locked_slots.map(JSON.stringify).join('\n') : 'none';

  return `Year: ${ctx.year}
Home city: ${ctx.home_city}
Trip type: ${ctx.trip_type}
Traveller type: ${ctx.traveller_type}
Travellers: ${ctx.travellers}
Currency: ${ctx.currency}

Budget:
- Weekend trip: max ${ctx.currency} ${ctx.weekend.budget_per_trip}, up to ${ctx.weekend.trips_per_year}/yr, within ${ctx.weekend.radius_km} km of ${ctx.home_city}, 3 days.
- Major trip: max ${ctx.currency} ${ctx.major.budget_per_trip}, ${ctx.major.duration_days} days.
- All trips combined must be <= ${ctx.currency} ${ctx.total_yearly_budget}.

Trip target (already reconciled with budget): ${ctx.targets.weekend} weekend + ${ctx.targets.major} major.

Locked slots (keep exactly these, same window_id/dates):
${locked}

Available windows (use ONLY these window_ids; each trip references exactly one):
${windows}

Rules:
- Weekend trip = exactly 3 days (Fri-Sun or Sat-Mon) from a weekend window.
- Major trip = exactly ${ctx.major.duration_days} days from a major window; at most one major per month; months may hold several weekend trips.
- Never reuse a window_id; selected windows must not overlap in dates; never repeat a destination in the year.
- Keep locked slots unchanged; prefer long weekends for major trips; pick season/monsoon-appropriate, budget-realistic destinations; estimated_cost scales with travellers and never exceeds the per-trip budget.

Respond with ONLY the JSON below (12 months: one entry per month, empty arrays and null for empty months):
${RESPONSE_SCHEMA.replace(/<year>/g, ctx.year)}`;
}

module.exports = { SYSTEM_PROMPT, RESPONSE_SCHEMA, buildPlanCalendarUserPrompt };