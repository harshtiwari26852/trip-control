// On-disk cache for generated trip details, keyed by trip_id + a hash of the
// canonical request inputs. Each key is stored as one JSON file under
// data/trip-details-cache/. The `regenerate` flag bypasses the read (but still
// overwrites the file with the fresh result).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const rootDir = require('./pathUtil');

const CACHE_DIR = path.join(rootDir, 'data', 'trip-details-cache');

function ensureDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheKey(trip_id, inputs) {
  const canonical = JSON.stringify({
    trip_id,
    kind: inputs.kind,
    home_city: inputs.home_city,
    destination: inputs.destination,
    start_date: inputs.start_date,
    end_date: inputs.end_date,
    duration_days: inputs.duration_days,
    traveller_type: inputs.traveller_type,
    travellers: inputs.travellers,
    budget: inputs.budget,
    currency: inputs.currency
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function read(key) {
  try {
    ensureDir();
    const file = path.join(CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && parsed.details ? parsed : null;
  } catch (_) {
    return null;
  }
}

function write(key, payload) {
  try {
    ensureDir();
    const file = path.join(CACHE_DIR, `${key}.json`);
    fs.writeFileSync(file, JSON.stringify({ createdAt: new Date().toISOString(), details: payload }), 'utf8');
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { cacheKey, read, write, CACHE_DIR };