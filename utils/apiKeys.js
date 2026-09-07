require('dotenv').config();

const PREFIXES = {
  weather: '',
  aerodatabox: '',
  googleMaps: ''
};

// These integrations are opt-in. Keeping them off prevents any Maps or
// AeroDataBox request even when credentials are present in .env.
const integrations = {
  maps: process.env.ENABLE_MAPS === 'true',
  aerodatabox: process.env.ENABLE_AERODATABOX === 'true',
  // Gemini's Maps grounding is a different tool from the optional direct
  // Google Maps integration. Keep it explicitly opt-in so a Maps-tool issue
  // cannot make the planner silently abandon Gemini for Groq.
  geminiMapsGrounding: process.env.ENABLE_GEMINI_MAPS_GROUNDING === 'true'
};

const keys = {
  weather: process.env.WEATHER_API_KEY || '',
  aerodatabox: process.env.AERODATABOX_API_KEY || '',
  gemini: process.env.GEMINI_API_KEY || '',
  groq: process.env.GROQ_API_KEY || ''
};

function isValid(value, type) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('placeholder') || trimmed.includes('replace-me') || trimmed.includes('your-')) return false;
  return true;
}

const status = {
  weather: isValid(keys.weather, 'weather'),
  aerodatabox: integrations.aerodatabox && isValid(keys.aerodatabox, 'aerodatabox'),
  googleMaps: integrations.maps && isValid(process.env.GOOGLE_MAPS_API_KEY || '', 'googleMaps'),
  gemini: isValid(keys.gemini, 'gemini'),
  groq: isValid(keys.groq, 'groq')
};

keys.googleMaps = process.env.GOOGLE_MAPS_API_KEY || '';

// Groq can keep planning available when Gemini is unavailable or quota-limited.
status.planner = status.gemini || status.groq;
// Gemini Google Maps grounding authenticates with GEMINI_API_KEY, not the
// separate Google Maps Platform key used by the optional direct Maps API.
status.geminiMaps = status.gemini && integrations.geminiMapsGrounding;

function assertKey(name) {
  if (!status[name]) {
    const err = new Error(`API key '${name}' is not configured. See .env`);
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  return true;
}

module.exports = { keys, status, integrations, assertKey, isValid };
