// System + user prompt builders for POST /api/trip-details.

const SYSTEM_PROMPT =
  'You are TripWise, a detailed trip planner. Given a destination, dates, home city, traveller type and budget, produce a practical day-by-day plan that matches the requested duration exactly. Include realistic transport options from the home city with times and costs, a recommended mode with reasons, stay options in a mix of categories with neighbourhoods and estimated nightly prices, places to visit, food to try, cost breakdown, packing list and tips. Tailor to traveller_type (solo, couple, family, friends). When a travel mode preference or pace is given, prefer transport options that match the travel mode and schedule activities/days at that pace. Keep total cost within the budget where possible; if not possible, set within_budget=false and say why. Never invent booking URLs or claim live availability; mark all prices as estimates. Respond ONLY with JSON matching the provided schema.';

const RESPONSE_SCHEMA = `{
  "overview": {
    "summary": "2-3 sentence pitch of the trip",
    "best_time_note": "Why these exact dates work",
    "weather": { "avg_temp_c_min": 8, "avg_temp_c_max": 22, "conditions": "Cool, dry, sunny" }
  },
  "transport": {
    "from_city": "home city",
    "options": [
      { "mode": "Train", "details": "…", "duration_hours": 4.5, "estimated_cost_per_person": 900, "pros": ["…"], "cons": ["…"] }
    ],
    "recommended_mode": "Train",
    "recommendation_reason": "why",
    "local_transport": "auto/cab apps, prepaid taxis"
  },
  "stay": {
    "area_recommendation": "neighbourhood(s) and why",
    "options": [
      { "name": "…", "category": "budget|mid-range|luxury", "area": "neighbourhood", "price_per_night_estimate": 1800, "why_good": "…", "suits": "solo|couple|family|friends" }
    ],
    "total_stay_cost_estimate": 3600
  },
  "itinerary": [
    {
      "day": 1,
      "date": "YYYY-MM-DD (day 1 = the trip start date; increment by 1 each day)",
      "title": "Arrival and Old City",
      "morning": [{ "time": "08:00", "activity": "…", "place": null, "duration_hours": 4.5, "cost_estimate": 900, "tip": "" }],
      "afternoon": [],
      "evening": [],
      "meals": { "breakfast": "", "lunch": "…", "dinner": "…" },
      "day_cost_estimate": 2500
    }
  ],
  "places_to_visit": [
    { "name": "…", "type": "Historical", "why_visit": "…", "time_needed_hours": 3, "entry_fee_estimate": 200, "best_time": "Morning" }
  ],
  "food_to_try": [{ "dish": "…", "where": "…" }],
  "cost_breakdown": {
    "transport": 1800, "stay": 3600, "food": 1500, "activities": 600,
    "local_transport": 500, "miscellaneous": 300, "total": 8300, "within_budget": false
  },
  "packing_list": ["…", "…"],
  "safety_and_tips": ["…", "…"],
  "booking_notes": "…",
  "disclaimer": "AI-generated estimates…"
}`;

function buildTripDetailsUserPrompt(ctx) {
  const extra = ctx.kind === 'major'
    ? 'This is a MAJOR trip. Give the plan exactly ' + ctx.duration_days +
      ' days. If you cover more than one place, include a "multi_stop_route" array of { city, nights, transport_between }. When duration is >= 8 days, include one rest/flex day with light activities. Plan enough buffer around travel days.\n'
    : 'This is a WEEKEND trip (3 days, Fri evening to Sun evening or Sat to Mon). Morning of day 1 is the outbound journey, day 3 evening is the return journey.\n';

  return `Trip id: ${ctx.trip_id}
Kind: ${ctx.kind}
Home city: ${ctx.home_city}
Destination: ${ctx.destination}
Start date: ${ctx.start_date}
End date: ${ctx.end_date}
Duration (days): ${ctx.duration_days}
Traveller type: ${ctx.traveller_type}
Travellers: ${ctx.travellers}
Budget for the whole trip: ${ctx.currency} ${ctx.budget}
Travel mode preference: ${ctx.travel_mode || 'not specified'}
Pace / vibe: ${ctx.pace || 'not specified'}

${extra}The itinerary array MUST contain exactly ${ctx.duration_days} entries and the dates MUST run consecutively from ${ctx.start_date} to ${ctx.end_date} (day 1 date = ${ctx.start_date}).

All monetary values are numbers in ${ctx.currency} and are total estimates for ${ctx.travellers} traveller(s). cost_breakdown.total must not exceed ${ctx.currency} ${ctx.budget}; if it cannot, set within_budget=false and explain in overview.summary or booking_notes.

Respond with JSON exactly in this schema:
${RESPONSE_SCHEMA}`;
}

module.exports = { SYSTEM_PROMPT, RESPONSE_SCHEMA, buildTripDetailsUserPrompt };