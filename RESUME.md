# RESUME — TripWise client integration (ai trip planner copy)

## Status
TripWise client integration is COMPLETE. Backend flow green (46 tests pass), the
new Planner page is rewritten and the Vite build + lint pass.

## Generation fix (2026-09-20)
"Output is not generating" was a 502 from POST /api/plan-calendar. Root cause:
the plan-calendar prompt listed ALL 250 windows of the year (~25k chars / ~13k
tokens). Gemini free tier was 429 rate-limited, and the Groq fallback rejected
the request with 413 (request too large; gpt-oss-20b free tier caps at 8000 TPM).
Fixes:
- utils/prompts/planCalendarPrompt.js now shows the model a curated, terse
  window subset (locked slots + holiday long weekends + 1 regular weekend/month
  + top 3 major long-weekends per month). Validation still runs against the full
  `available_windows` set, so all hard rules are unchanged. Request dropped from
  ~13k to ~2.5-5k tokens.
- utils/llmClient.js: `json_validate_failed` (reported via error.code) is now
  retryable; on it the retry drops Groq's strict json_object mode so
  `extractJson` can fence/brace-recover the reply; parse-failure errors are now
  retryable too (previously a Groq 200-with-bad-JSON threw immediately).
- .env GROQ_MODEL → openai/gpt-oss-120b (higher TPM than gpt-oss-20b, supports 2
  consecutive generations so the retry attempt fits in one rate-limit window).
**Multi-provider mode (user request): Gemini + Groq + ChatGPT(OpenAI)**
- generateJSON now builds a chain of enabled providers (Gemini → Groq → OpenAI)
  and tries each in sequence; ANY provider failure (even a non-retryable 400)
  falls through to the next automatically. Throws only when every enabled
  provider failed or none is configured (MISSING_API_KEY).
- utils/apiKeys.js: added openai key detection (`OPENAI_API_KEY`, invalid when
  empty) and `status.planner = gemini || groq || openai`.
- utils/llmClient.js: new `callOpenAI` (chat/completions, json_object mode,
  json_validate_failed/transient retry + loose-parse retry like Groq); header
  comment updated. Default OPENAI_MODEL = gpt-4o-mini (overridable in .env).
- .env: GROQ_API_KEY re-enabled, added OPENAI_MODEL=gpt-4o-mini and an empty
  OPENAI_API_KEY= for the user to fill in.
- callGemini keeps the bounded 429 quota wait-and-retry (MAX_QUOTA_WAIT_MS=15s).
Verified: routing flags gemini/groq/openai correct; forced Gemini failure
(invalid key) redirected to Groq automatically (generated via gpt-oss-120b);
normal call generates via Gemini; 46/46 backend tests pass.
TODO (user): set a real OPENAI_API_KEY in .env, then restart `npm start` so
nodemon reloads the keys.

## Done / verified
- Server
  - controllers/tripwiseController.js — 5 endpoints, all tested:
    POST /api/plan-calendar, POST /api/trip-details, POST /api/plans (save),
    GET /api/plans/latest, GET /api/plans/:id (restore). Cache + regenerate +
    preflight-budget retry loop.
  - utils/tripDetailsValidator.js, utils/planCalendarValidator.js (strict,
    schema-driven request/response validation)
  - utils/prompts/tripDetailsPrompt.js, planCalendarPrompt.js (AI JSON prompts)
  - utils/tripCache.js (TTL), routers/apiRouter.js (wired + rate limiters)
- Client
  - lib/api.js (CSRF-safe apiFetch)
  - lib/planner.js — request builders (buildPlanCalendarRequest,
    buildTripDetailsRequest), slot bookkeeping (lockedSlotsFromCalendar,
    tripsFromCalendar, totalSpendForCalendar), formatting
    (MONTH_NAMES, money, formatDateRange, durationDays). Verified exports.
  - components/TripDetailModal.jsx — tabbed modal
    (overview/transport/stay/itinerary/cost/tips) calling /api/trip-details,
    includes Regenerate. Unused icon imports cleaned (lint green).
  - pages/Planner.jsx — REWRITTEN. Drives /api/plan-calendar + /api/trip-details
    + /api/plans via lib/planner helpers; 12-month calendar with weekend + major
    trip cards that open TripDetailModal; per-slot locked regenerate
    (lockedSlotsFromCalendar + exclude regenerating window_id); full re-plan;
    save/restore (POST /api/plans, GET /api/plans/latest); budget summary card
    with spend/progress/remaining; warnings banner. Destination goal keeps the
    original form (home city, destination, dates, traveller type, budget,
    travel mode flight/train/drive, pace relaxed/balanced/action) and flows
    through a synthetic trip into TripDetailModal using the trip budget.
    Traveller types match the server enum (solo/couple/family/friends).
  - components/TripDetailModal.jsx — forwards optional travel_mode/pace in the
    /api/trip-details body.
  - Backend: utils/tripDetailsValidator.js accepts optional travel_mode
    (flight/train/drive) and pace (relaxed/balanced/action); tripDetailsPrompt
    includes them so the AI honours the preference. 46 tests still green.
  - Verify: `cd client && npm run lint && npm run build` — lint clean,
    build passes; backend `npm test` green.

## Notes
The old legacy Planner called /api/ai/generate-* endpoints; the new page uses
only the TripWise endpoints. App renders <Planner /> with no props, so the page
stays self-contained (reads goal from useLocation state).
