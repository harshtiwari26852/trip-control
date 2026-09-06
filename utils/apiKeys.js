require('dotenv').config();

const PREFIXES = {
  weather: '',
  aerodatabox: '',
  googleMaps: ''
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
  aerodatabox: isValid(keys.aerodatabox, 'aerodatabox'),
  googleMaps: isValid(process.env.GOOGLE_MAPS_API_KEY || '', 'googleMaps'),
  gemini: isValid(keys.gemini, 'gemini'),
  groq: isValid(keys.groq, 'groq')
};

keys.googleMaps = process.env.GOOGLE_MAPS_API_KEY || '';

// Groq can keep planning available when Gemini is unavailable or quota-limited.
status.planner = status.gemini || status.groq;
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
