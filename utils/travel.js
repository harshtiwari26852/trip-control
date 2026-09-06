const { keys, status, assertKey } = require('./apiKeys');

let _token = null;
let _tokenExpiry = 0;

const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CITY_IATA = {
  Mumbai: 'BOM', Delhi: 'DEL', Bengaluru: 'BLR', Pune: 'PNQ',
  Ahmedabad: 'AMD', Kolkata: 'CCU', Chennai: 'MAA', Hyderabad: 'HYD'
};

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: keys.amadeusKey,
    client_secret: keys.amadeusSecret
  }).toString();
  const res = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error('Amadeus auth failed');
  const j = await res.json();
  _token = j.access_token;
  _tokenExpiry = Date.now() + (j.expires_in - 60) * 1000;
  return _token;
}

function cacheGet(k) {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) { cache.delete(k); return null; }
  return e.value;
}
function cacheSet(k, v) { cache.set(k, { ts: Date.now(), value: v }); }

async function getFlightEstimate(originCity, dest, travelers, futureDays) {
  if (!status.amadeus) return null;
  const originIata = CITY_IATA[originCity];
  const destIata = CITY_IATA[dest.name];
  if (!originIata || !destIata) return null;

  const date = new Date(Date.now() + (futureDays || 30) * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const ckey = originIata + ':' + destIata + ':' + date;
  const cached = cacheGet(ckey);
  if (cached) return cached;

  try {
    const token = await getToken();
    const url = 'https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=' +
      originIata + '&destinationLocationCode=' + destIata +
      '&departureDate=' + date + '&adults=' + travelers +
      '&max=2&currencyCode=INR';
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) return null;
    const j = await res.json();
    const offer = j.data && j.data[0];
    if (!offer || !offer.price) return null;
    const out = {
      price: Math.round(Number(offer.price.total)),
      currency: offer.price.currency,
      airline: (offer.validatingAirlineCodes && offer.validatingAirlineCodes[0]) || null,
      source: 'amadeus'
    };
    cacheSet(ckey, out);
    return out;
  } catch (e) { return null; }
}

async function getHotelEstimate(dest, checkin, checkout) {
  if (!status.amadeus) return null;
  const ckey = 'hotel:' + dest.name + ':' + checkin;
  const cached = cacheGet(ckey);
  if (cached) return cached;
  try {
    const token = await getToken();
    const url = 'https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-geocode?latitude=' +
      dest.lat + '&longitude=' + dest.lng + '&radius=30&radiusUnit=KM&hotelSource=ALL';
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j.data || !j.data[0]) return null;
    const hotelId = j.data[0].hotelId;
    const offUrl = 'https://test.api.amadeus.com/v3/shopping/hotel-offers?hotelIds=' + hotelId +
      '&checkInDate=' + checkin + '&checkOutDate=' + checkout + '&adults=1&roomQuantity=1&paymentPolicy=NONE&bestRateOnly=true';
    const offRes = await fetch(offUrl, { headers: { Authorization: 'Bearer ' + token } });
    if (!offRes.ok) return null;
    const oj = await offRes.json();
    const offer = oj.data && oj.data[0] && oj.data[0].offers && oj.data[0].offers[0];
    if (!offer || !offer.price) return null;
    const out = {
      pricePerNight: Math.round(Number(offer.price.total) / (offer.price.total !== undefined ? 1 : 1)),
      currency: offer.price.currency || 'INR',
      source: 'amadeus'
    };
    cacheSet(ckey, out);
    return out;
  } catch (e) { return null; }
}

module.exports = { getFlightEstimate, getHotelEstimate, CITY_IATA };
