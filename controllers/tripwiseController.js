// TripWise endpoints: plan-calendar, trip-details, and saved-plan persistence.
// All LLM calls happen here, on the server, never in the browser.

const TripPlan = require('../models/tripPlan');
const { generateJSON } = require('../utils/llmClient');
const { log } = require('../utils/logger');
const { SYSTEM_PROMPT: CAL_PROMPT, buildPlanCalendarUserPrompt } = require('../utils/prompts/planCalendarPrompt');
const { SYSTEM_PROMPT: DETAILS_PROMPT, buildTripDetailsUserPrompt } = require('../utils/prompts/tripDetailsPrompt');
const { normalizeCalendarRequest, validateAndBuild, preflightBudget } = require('../utils/planCalendarValidator');
const { normalizeTripDetailsRequest, normalizeDetails } = require('../utils/tripDetailsValidator');
const tripCache = require('../utils/tripCache');

const CAL_TIMEOUT_MS = Number(process.env.PLAN_CALENDAR_TIMEOUT_MS) || 60 * 1000;
const DETAILS_TIMEOUT_MS = Number(process.env.TRIP_DETAILS_TIMEOUT_MS) || 60 * 1000;

function requireAuth(req, res) {
  if (!req.session.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return false;
  }
  return true;
}

exports.planCalendar = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const parsed = normalizeCalendarRequest(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ error: 'Invalid request', errors: parsed.errors });
  }
  const ctx = parsed.ctx;
  const preflight = preflightBudget(ctx);

  ctx.targets = preflight.target;
  let userPrompt = buildPlanCalendarUserPrompt(ctx);

  const attempt = async (extraErrors) => {
    const promptWithErrors = extraErrors && extraErrors.length
      ? `${userPrompt}\n\nPREVIOUS OUTPUT WAS REJECTED. Fix EVERY one of these errors:\n- ${extraErrors.join('\n- ')}`
      : userPrompt;
    log('llm', 'plan-calendar request', {
      year: ctx.year,
      home_city: ctx.home_city,
      trip_type: ctx.trip_type,
      travellers: ctx.travellers,
      targets: preflight.target,
      windows: ctx.available_windows.length
    });
    try {
      const out = await generateJSON({
        systemPrompt: CAL_PROMPT,
        userPrompt: promptWithErrors,
        temperature: 0.7,
        timeoutMs: CAL_TIMEOUT_MS,
        label: 'plan-calendar'
      });
      log('llm', 'plan-calendar raw output', { raw: out.raw, source: out.source, model: out.model });
      return { out };
    } catch (err) {
      return { err };
    }
  };

  const first = await attempt([]);
  if (first.err) {
    if (first.err.code === 'MISSING_API_KEY') return res.status(503).json({ error: first.err.message });
    return res.status(502).json({ error: first.err.message });
  }
  const firstCheck = validateAndBuild(first.out.value, ctx, []);
  if (firstCheck.errors.length) {
    const second = await attempt(firstCheck.errors);
    if (second.err) return res.status(502).json({ error: second.err.message });
    const secondCheck = validateAndBuild(second.out.value, ctx, firstCheck.errors);
    if (secondCheck.errors.length) {
      log('validate', 'plan-calendar rejected after retry', { errors: secondCheck.errors });
      return res.status(422).json({
        error: 'The AI plan did not satisfy the planner rules.',
        errors: secondCheck.errors,
        warnings: secondCheck.warnings
      });
    }
    return res.json(secondCheck.response);
  }
  return res.json(firstCheck.response);
};

exports.tripDetails = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const parsed = normalizeTripDetailsRequest(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ error: 'Invalid request', errors: parsed.errors });
  }
  const ctx = parsed.ctx;
  const key = tripCache.cacheKey(ctx.trip_id, ctx);

  if (!ctx.regenerate) {
    const cached = tripCache.read(key);
    if (cached) {
      log('cache', 'trip-details hit', { trip_id: ctx.trip_id });
      return res.json({ ...cached.details, cached: true });
    }
  }

  const basePrompt = buildTripDetailsUserPrompt(ctx);
  const attempt = async (extraErrors) => {
    const promptWithErrors = extraErrors && extraErrors.length
      ? `${basePrompt}\n\nPREVIOUS OUTPUT WAS REJECTED. Fix EVERY one of these errors:\n- ${extraErrors.join('\n- ')}`
      : basePrompt;
    log('llm', 'trip-details request', {
      trip_id: ctx.trip_id,
      kind: ctx.kind,
      home_city: ctx.home_city,
      destination: ctx.destination,
      duration_days: ctx.duration_days,
      budget: ctx.budget,
      travellers: ctx.travellers,
      regenerate: ctx.regenerate
    });
    const out = await generateJSON({
      systemPrompt: DETAILS_PROMPT,
      userPrompt: promptWithErrors,
      temperature: 0.7,
      timeoutMs: DETAILS_TIMEOUT_MS,
      label: 'trip-details'
    });
    log('llm', 'trip-details raw output', { raw: out.raw, source: out.source, model: out.model });
    return out;
  };

  try {
    let out = await attempt([]);
    let check = normalizeDetails(out.value, ctx);
    if (check.errors.length) {
      out = await attempt(check.errors);
      check = normalizeDetails(out.value, ctx);
      if (check.errors.length) {
        log('validate', 'trip-details rejected after retry', { errors: check.errors });
        return res.status(422).json({ error: 'The AI plan did not satisfy the planner rules.', errors: check.errors });
      }
    }
    tripCache.write(key, check.details);
    return res.json({ ...check.details, cached: false, warnings: check.warnings });
  } catch (err) {
    if (err.code === 'MISSING_API_KEY') return res.status(503).json({ error: err.message });
    return res.status(502).json({ error: err.message });
  }
};

exports.savePlan = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const body = req.body || {};
  const inputs = body.inputs && typeof body.inputs === 'object' ? body.inputs : null;
  const calendar = body.calendar && typeof body.calendar === 'object' ? body.calendar : null;
  if (!inputs || !calendar || !Array.isArray(calendar.months)) {
    return res.status(400).json({ error: 'Expected { inputs, calendar } with a calendar.months array' });
  }

  try {
    const plan = await TripPlan.findOneAndUpdate(
      { user: req.session.user._id },
      { $set: { inputs, calendar, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    return res.json({ ok: true, id: plan._id });
  } catch (err) {
    return nextError(res, err);
  }
};

exports.getLatestPlan = async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const plan = await TripPlan.findOne({ user: req.session.user._id }).sort({ updatedAt: -1 });
    if (!plan) return res.json({ ok: true, plan: null });
    return res.json({ ok: true, plan: publicPlan(plan) });
  } catch (err) {
    return nextError(res, err);
  }
};

exports.getPlanById = async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const plan = await TripPlan.findOne({ _id: req.params.id, user: req.session.user._id });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    return res.json({ ok: true, plan: publicPlan(plan) });
  } catch (err) {
    return nextError(res, err);
  }
};

function publicPlan(plan) {
  return {
    id: plan._id,
    inputs: plan.inputs,
    calendar: plan.calendar,
    updated_at: plan.updatedAt,
    cached_details_count: Object.keys(plan.cachedDetails || {}).length
  };
}

function nextError(res, err) {
  if (err && err.code && err.code.indexOf('MONGO') === 0) return res.status(500).json({ error: 'Database error' });
  return res.status(500).json({ error: 'Server error' });
}