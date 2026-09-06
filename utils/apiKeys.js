require('dotenv').config();

const PREFIXES = {
  weather: '',
  amadeus: '',
  googleMaps: ''
};

const keys = {
  weather: process.env.WEATHER_API_KEY || '',
  amadeusKey: process.env.AMADEUS_API_KEY || '',
  amadeusSecret: process.env.AMADEUS_API_SECRET || '',
  gemini: process.env.GEMINI_API_KEY || ''
};

function isValid(value, type) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('placeholder') || trimmed.includes('replace-me') || trimmed.includes('your-')) return false;
  return true;
}

const status = {
  weather: isValid(keys.weather, 'weather'),
  amadeus: isValid(keys.amadeusKey, 'amadeus') && isValid(keys.amadeusSecret, 'amadeus'),
  googleMaps: isValid(process.env.GOOGLE_MAPS_API_KEY || '', 'googleMaps'),
  gemini: isValid(keys.gemini, 'gemini')
};

keys.googleMaps = process.env.GOOGLE_MAPS_API_KEY || '';

// The AI planner is available only when a real Gemini key is configured.
status.planner = status.gemini;
// Gemini Google Maps grounding authenticates with GEMINI_API_KEY, not the
// separate Google Maps Platform key used by the optional direct Maps API.
status.geminiMaps = status.gemini;

function assertKey(name) {
  if (!status[name]) {
    const err = new Error(`API key '${name}' is not configured. See .env`);
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  return true;
}

module.exports = { keys, status, assertKey, isValid };
