const { keys, status } = require('./apiKeys');

const cache = new Map();
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.value;
}
function cacheSet(key, value) { cache.set(key, { ts: Date.now(), value }); }

const BEST_MONTH_FALLBACK = {
  himalaya: [5, 6, 7, 8, 9, 10],
  desert: [10, 11, 12, 1, 2, 3],
  west: [10, 11, 12, 1, 2, 3, 7, 8],
  south: [10, 11, 12, 1, 2, 3],
  central: [10, 11, 12, 1, 2, 3],
  east: [10, 11, 12, 1, 2, 3]
};
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

async function getCurrentWeather(lat, lng) {
  if (!status.weather) return null;
  const ckey = 'cur:' + lat + ',' + lng;
  const cached = cacheGet(ckey);
  if (cached) return cached;
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${keys.weather}`
    );
    if (!res.ok) return null;
    const j = await res.json();
    const out = {
      temp: Math.round(j.main && j.main.temp),
      condition: (j.weather && j.weather[0] && j.weather[0].main) || 'Unknown',
      humidity: (j.main && j.main.humidity) || null,
      wind: (j.wind && j.wind.speed) || null,
      icon: (j.weather && j.weather[0] && j.weather[0].icon) || null
    };
    cacheSet(ckey, out);
    return out;
  } catch (e) { return null; }
}

function bestMonthsForDest(dest) {
  const fallback = BEST_MONTH_FALLBACK[dest.region] || [10, 11, 12, 1, 2, 3];
  const labels = fallback.map(m => MONTH_NAMES[(m + 11) % 12]);
  const start = labels[0], end = labels[labels.length - 1];
  return { months: fallback, range: start + '–' + end };
}

async function bulkWeatherCheck(destinations) {
  const results = {};
  const jobs = [];
  for (const d of destinations) {
    jobs.push(getCurrentWeather(d.lat, d.lng).then(w => {
      results[d.name] = { ...bestMonthsForDest(d), current: w || null };
    }));
  }
  await Promise.all(jobs);
  return results;
}

module.exports = { getCurrentWeather, bestMonthsForDest, bulkWeatherCheck, MONTH_NAMES };
