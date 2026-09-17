const { DESTINATIONS } = require('../data/destinations');
const { status } = require('../utils/apiKeys');
const weather = require('../utils/weather');
const travel = require('../utils/travel');
const geo = require('../utils/geo');
const { getAIPlan, getAIItinerary, getAIWeekendCalendar } = require('../utils/llm');

function getProfileFromBody(body) {
  return {
    home: body.home || 'Mumbai',
    tripType: body.tripType || 'both',
    traveler: body.traveler || 'solo',
    travelers: Number(body.travelers) || 1,
    kidsAge: Number(body.kidsAge) || 7,
    radius: Number(body.radius) || 300,
    slotTarget: Math.min(12, Math.max(1, Number(body.slotTarget) || 12)),
    weekendBudget: Number(body.weekendBudget) || 8000,
    majorBudget: Number(body.majorBudget) || 45000,
    yearlyBudget: Number(body.yearlyBudget) || 150000,
    durSlider: Number(body.durSlider) || 7,
    destination: body.destination || '',
    startDate: body.startDate || '',
    endDate: body.endDate || '',
    duration: Number(body.duration) || 4,
    totalBudget: Number(body.totalBudget) || 0,
    travelMode: body.travelMode || '',
    pace: body.pace || ''
  };
}

exports.generatePlan = async (req, res, next) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });

    const profile = getProfileFromBody(req.body || {});
    // Maps and flight-availability integrations are disabled by default.
    const aiPlan = await getAIPlan(profile);

    res.json({
      ok: true,
      aiPlan,
      layers: {
        planner: !!status.planner,
        gemini: !!status.gemini,
        groq: !!status.groq,
        weather: !!status.weather,
        pricing: !!status.aerodatabox,
        geo: !!status.googleMaps
      },
      weather: null,
      pricing: {},
      warnings: [
        aiPlan.fallbackReason || (aiPlan.source === 'gemini-google-maps'
          ? 'Destinations are discovered through Gemini Google Maps grounding.'
          : 'Destinations are generated without Maps grounding or flight-availability data.'),
        'Maps and AeroDataBox integrations are currently disabled.'
      ].filter(Boolean)
    });
  } catch (err) {
    if (err.code === 'MISSING_API_KEY') {
      return res.status(503).json({ error: err.message, ok: false });
    }
    if (err.code === 'AI_PROVIDER_FAILED') {
      return res.status(502).json({ error: err.message, ok: false });
    }
    next(err);
  }
};

exports.getWeather = async (req, res, next) => {
  try {
    const name = req.params.name;
    const d = DESTINATIONS.find(x => x.name.toLowerCase() === String(name).toLowerCase());
    if (!d) return res.status(404).json({ error: 'Destination not found' });
    const current = await weather.getCurrentWeather(d.lat, d.lng);
    const best = weather.bestMonthsForDest(d);
    res.json({ ok: true, name: d.name, current, best });
  } catch (err) { next(err); }
};

exports.getPricing = async (req, res, next) => {
  try {
    const name = req.params.name;
    const d = DESTINATIONS.find(x => x.name.toLowerCase() === String(name).toLowerCase());
    if (!d) return res.status(404).json({ error: 'Destination not found' });
    const profile = getProfileFromBody(req.query || {});
    const flight = await travel.getFlightAvailability(profile.home || 'Mumbai', d, profile.travelers || 1, 30);
    res.json({
      ok: true,
      name: d.name,
      perDay: d.cost,
      flight,
      enabled: status.aerodatabox
    });
  } catch (err) {
    if (err.code === 'MISSING_API_KEY') {
      return res.status(503).json({ error: err.message, ok: false });
    }
    next(err);
  }
};

exports.generateItinerary = async (req, res, next) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });

    const body = req.body || {};
    const profile = {
      home: typeof body.home === 'string' && body.home.trim() ? body.home.trim() : 'Mumbai',
      destination: typeof body.destination === 'string' ? body.destination.trim() : '',
      duration: Math.min(30, Math.max(1, Math.round(Number(body.duration) || 4))),
      totalBudget: Math.max(0, Number(body.totalBudget) || 50000),
      currency: 'INR',
      travelers: Math.min(12, Math.max(1, Math.round(Number(body.travelers) || 1))),
      travelerType: typeof body.travelerType === 'string' ? body.travelerType : 'solo',
      travelMode: typeof body.travelMode === 'string' ? body.travelMode : 'flight',
      pace: typeof body.pace === 'string' ? body.pace : 'balanced',
      startDate: typeof body.startDate === 'string' ? body.startDate : '',
      endDate: typeof body.endDate === 'string' ? body.endDate : ''
    };

    if (!profile.destination) {
      return res.status(400).json({ error: 'Destination is required.' });
    }

    const itinerary = await getAIItinerary(profile);

    res.json({
      ok: true,
      itinerary,
      warnings: [
        itinerary.fallbackReason || (itinerary.source === 'gemini'
          ? 'Itinerary generated with Gemini.'
          : 'Itinerary generated with Groq.'),
        'Estimated prices based on historical data. Actual prices may vary.'
      ].filter(Boolean)
    });
  } catch (err) {
    if (err.code === 'MISSING_API_KEY') {
      return res.status(503).json({ error: err.message, ok: false });
    }
    if (err.code === 'AI_PROVIDER_FAILED') {
      return res.status(502).json({ error: err.message, ok: false });
    }
    next(err);
  }
};

exports.generateWeekendCalendar = async (req, res, next) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });

    const body = req.body || {};
    const slotTarget = Math.min(24, Math.max(12, Math.round(Number(body.slotTarget) || 12)));
    const profile = {
      home: typeof body.home === 'string' && body.home.trim() ? body.home.trim() : 'Mumbai',
      slotTarget,
      radius: Math.min(2000, Math.max(0, Math.round(Number(body.radius) || 300))),
      weekendBudget: Math.max(0, Number(body.weekendBudget) || 8000),
      travelers: Math.min(12, Math.max(1, Math.round(Number(body.travelers) || 1))),
      travelerType: typeof body.travelerType === 'string' ? body.travelerType : 'solo'
    };

    const weekendCalendar = await getAIWeekendCalendar(profile);

    res.json({
      ok: true,
      weekendCalendar,
      warnings: [
        weekendCalendar.fallbackReason || (weekendCalendar.source === 'gemini'
          ? 'Weekend calendar generated with Gemini.'
          : 'Weekend calendar generated with Groq.'),
        `Exactly ${slotTarget} trips distributed across 12 months.`,
        'Estimated costs based on typical weekend budgets. Actual prices may vary.'
      ].filter(Boolean)
    });
  } catch (err) {
    if (err.code === 'MISSING_API_KEY') {
      return res.status(503).json({ error: err.message, ok: false });
    }
    if (err.code === 'AI_PROVIDER_FAILED') {
      return res.status(502).json({ error: err.message, ok: false });
    }
    next(err);
  }
};

exports.getAvail = (req, res) => {
  res.json({
    ok: true,
    layers: status,
    totalDestinations: DESTINATIONS.length
  });
};
