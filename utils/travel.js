const { keys, status } = require('./apiKeys');

const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const RAPID_HOST = 'aerodatabox.p.rapidapi.com';

const CITY_IATA = {
  Mumbai: 'BOM', Delhi: 'DEL', Bengaluru: 'BLR', Pune: 'PNQ',
  Ahmedabad: 'AMD', Kolkata: 'CCU', Chennai: 'MAA', Hyderabad: 'HYD'
};

function cacheGet(k) {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) { cache.delete(k); return null; }
  return e.value;
}
function cacheSet(k, v) { cache.set(k, { ts: Date.now(), value: v }); }

async function getDayDepartures(airportIata, date) {
  const next = new Date(new Date(date + 'T00:00:00').getTime() + 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const windows = [
    [date + 'T00:00', date + 'T12:00'],
    [date + 'T12:00', next + 'T00:00']
  ];
  const headers = {
    Accept: 'application/json',
    'X-RapidAPI-Key': keys.aerodatabox,
    'X-RapidAPI-Host': RAPID_HOST
  };
  const all = [];
  for (const [from, to] of windows) {
    const url = 'https://' + RAPID_HOST + '/flights/airports/iata/' + airportIata + '/' + from + '/' + to +
      '?direction=Departure&withLeg=true&withCancelled=false&withCargo=false&withPrivate=false';
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const err = new Error('AeroDataBox request failed (' + res.status + '): ' + await res.text());
      err.status = res.status;
      throw err;
    }
    const j = await res.json();
    if (Array.isArray(j.departures)) all.push(...j.departures);
  }
  return all;
}

async function getFlightAvailability(originCity, dest, travelers, futureDays) {
  if (!status.aerodatabox) return null;
  const originIata = CITY_IATA[originCity];
  const destIata = CITY_IATA[dest.name];
  if (!originIata || !destIata) return null;

  const date = new Date(Date.now() + (futureDays || 30) * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const ckey = originIata + ':' + destIata + ':' + date;
  const cached = cacheGet(ckey);
  if (cached) return cached;

  const route = originIata + ' → ' + destIata;
  let deps;
  try {
    deps = await getDayDepartures(originIata, date);
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      const err = new Error('AeroDataBox API key is not valid or not subscribed. See .env');
      err.code = 'MISSING_API_KEY';
      throw err;
    }
    return null;
  }
  const matches = deps.filter(f => {
    const arrAirport = f && f.arrival && f.arrival.airport;
    return arrAirport && arrAirport.iata && arrAirport.iata.toUpperCase() === destIata;
  });
  const airlines = [...new Set(matches.map(f => f.airline && f.airline.name).filter(Boolean))];
  const out = {
    flights: matches.length,
    airlines,
    route,
    date,
    source: 'aerodatabox'
  };
  cacheSet(ckey, out);
  return out;
}

module.exports = { getFlightAvailability, CITY_IATA };