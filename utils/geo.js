const { keys, status, assertKey } = require('./apiKeys');

const cache = new Map();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cacheGet(k) {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) { cache.delete(k); return null; }
  return e.value;
}
function cacheSet(k, v) { cache.set(k, { ts: Date.now(), value: v }); }

function toRad(v) { return v * Math.PI / 180; }
function haversine(a, b) {
  const R = 6371, dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function geocodeAddress(address) {
  if (status.googleMaps) {
    const ckey = 'geo:' + address;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    const j = await fetchJson('https://maps.googleapis.com/maps/api/geocode/json?address=' +
      encodeURIComponent(address) + '&key=' + keys.googleMaps);
    if (j && j.results && j.results[0]) {
      const loc = j.results[0].geometry.location;
      const out = { lat: loc.lat, lng: loc.lng, formatted: j.results[0].formatted_address, source: 'google' };
      cacheSet(ckey, out);
      return out;
    }
  }
  return null;
}

function geocodeFallback(cityName) {
  const known = {
    'mumbai': { lat: 19.0760, lng: 72.8777 }, 'delhi': { lat: 28.7041, lng: 77.1025 },
    'new delhi': { lat: 28.7041, lng: 77.1025 }, 'bengaluru': { lat: 12.9716, lng: 77.5946 },
    'bangalore': { lat: 12.9716, lng: 77.5946 }, 'pune': { lat: 18.5204, lng: 73.8567 },
    'ahmedabad': { lat: 23.0225, lng: 72.5714 }, 'kolkata': { lat: 22.5726, lng: 88.3639 },
    'chennai': { lat: 13.0827, lng: 80.2707 }, 'hyderabad': { lat: 17.3850, lng: 78.4867 },
    'jaipur': { lat: 26.9124, lng: 75.7873 }, 'lucknow': { lat: 26.8467, lng: 80.9462 },
    'chandigarh': { lat: 30.7333, lng: 76.7794 }, 'indore': { lat: 22.7196, lng: 75.8577 },
    'bhopal': { lat: 23.2599, lng: 77.4126 }, 'kochi': { lat: 9.9312, lng: 76.2673 },
    'coimbatore': { lat: 11.0168, lng: 76.9558 }, 'guwahati': { lat: 26.1445, lng: 91.7362 },
    'nagpur': { lat: 21.1458, lng: 79.0882 }, 'varanasi': { lat: 25.3176, lng: 82.9739 },
    'agra': { lat: 27.1767, lng: 78.0081 }, 'surat': { lat: 21.1702, lng: 72.8311 },
    'mysore': { lat: 12.2958, lng: 76.6394 }, 'patna': { lat: 25.5941, lng: 85.1376 }
  };
  const hit = known[String(cityName).trim().toLowerCase()];
  if (hit) return { ...hit, formatted: cityName, source: 'fallback' };
  return null;
}

async function geocode(place) {
  const viaGoogle = await geocodeAddress(place);
  if (viaGoogle) return viaGoogle;
  return geocodeFallback(place);
}

async function getDistance(origin, dest, mode) {
  if (status.googleMaps && origin && dest) {
    const ckey = 'dist:' + origin.lat + ',' + origin.lng + ':' + dest.lat + ',' + dest.lng + ':' + (mode || 'driving');
    const cached = cacheGet(ckey);
    if (cached) return cached;
    const j = await fetchJson('https://maps.googleapis.com/maps/api/distancematrix/json?origins=' +
      origin.lat + ',' + origin.lng + '&destinations=' + dest.lat + ',' + dest.lng + '&mode=' +
      (mode || 'driving') + '&units=metric&key=' + keys.googleMaps);
    if (j && j.rows && j.rows[0] && j.rows[0].elements && j.rows[0].elements[0] &&
        j.rows[0].elements[0].status === 'OK') {
      const el = j.rows[0].elements[0];
      const out = {
        km: Math.round((el.distance ? el.distance.value : haversine(origin, dest) * 1000) / 1000),
        durationText: el.duration ? el.duration.text : null,
        source: 'google'
      };
      cacheSet(ckey, out);
      return out;
    }
  }
  return { km: Math.round(haversine(origin, dest)), durationText: null, source: 'haversine' };
}

module.exports = { geocode, getDistance, haversine };
