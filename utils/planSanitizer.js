const { DESTINATIONS } = require('../data/destinations');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEFAULTS = {
  home: 'Mumbai',
  tripType: 'both',
  mode: 'weekend',
  traveler: 'solo',
  travelers: 1,
  kidsAge: 7,
  radius: 300,
  slotTarget: 20,
  weekendBudget: 8000,
  majorBudget: 45000,
  yearlyBudget: 160000,
  durSlider: 7,
  destination: '',
  startDate: '',
  endDate: '',
  duration: 4,
  totalBudget: 50000,
  travelMode: 'flight',
  pace: 'balanced',
  weekendSlots: Array(12).fill(null),
  majorTrip: null,
  weekendCalendar: []
};

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizePlan(raw) {
  if (!raw || typeof raw !== 'object') return JSON.parse(JSON.stringify(DEFAULTS));

  const base = {
    home: typeof raw.home === 'string' && raw.home.trim() ? raw.home.trim().slice(0, 60) : DEFAULTS.home,
    tripType: ['destination', 'vacation', 'weekend', 'both'].includes(raw.tripType)
      ? raw.tripType
      : DEFAULTS.tripType,
    mode: ['weekend', 'vacation'].includes(raw.mode) ? raw.mode : DEFAULTS.mode,
    traveler: ['solo', 'family', 'elders'].includes(raw.traveler) ? raw.traveler : DEFAULTS.traveler,
    travelers: clampNum(raw.travelers, 1, 12, 1),
    kidsAge: clampNum(raw.kidsAge, 0, 17, 7),
    radius: clampNum(raw.radius, 50, 600, 300),
    slotTarget: clampNum(raw.slotTarget, 1, 24, 20),
    weekendBudget: clampNum(raw.weekendBudget, 0, 1e9, 8000),
    majorBudget: clampNum(raw.majorBudget, 0, 1e9, 45000),
    yearlyBudget: clampNum(raw.yearlyBudget, 0, 1e9, 150000),
    durSlider: clampNum(raw.durSlider, 7, 10, 7),
    destination: typeof raw.destination === 'string' && raw.destination.trim()
      ? raw.destination.trim().slice(0, 60)
      : DEFAULTS.destination,
    startDate: typeof raw.startDate === 'string' ? raw.startDate : DEFAULTS.startDate,
    endDate: typeof raw.endDate === 'string' ? raw.endDate : DEFAULTS.endDate,
    duration: clampNum(raw.duration, 1, 30, 4),
    totalBudget: clampNum(raw.totalBudget, 0, 1e9, 50000),
    travelMode: ['flight', 'train', 'drive'].includes(raw.travelMode) ? raw.travelMode : DEFAULTS.travelMode,
    pace: ['relaxed', 'balanced', 'action'].includes(raw.pace) ? raw.pace : DEFAULTS.pace
  };

  const slots = Array(12).fill(null);
  if (Array.isArray(raw.weekendSlots)) {
    raw.weekendSlots.forEach((slot, i) => {
      if (i >= 12) return;
      const dest = slot && slot.name && DESTINATIONS.find(d => d.name === slot.name);
      if (dest) {
        slots[i] = {
          name: dest.name,
          state: dest.state,
          cost: clampNum(slot.cost, 0, 1e9, dest.cost),
          days: clampNum(slot.days, 1, 10, 3)
        };
      }
    });
  }
  base.weekendSlots = slots;

  const calendar = MONTHS.map((monthLabel, i) => {
    const rawMonth = Array.isArray(raw.weekendCalendar)
      ? raw.weekendCalendar.find(m => m && typeof m === 'object' && m.month === monthLabel)
      : null;
    const rawTrips = rawMonth && Array.isArray(rawMonth.trips) ? rawMonth.trips : [];
    const trips = rawTrips.slice(0, 2).flatMap(t => {
      if (!t || typeof t !== 'object' || typeof t.destination !== 'string' || !t.destination.trim()) return [];
      return [{
        destination: t.destination.trim().slice(0, 60),
        distanceFromHome: clampNum(t.distanceFromHome, 0, 2000, 0),
        duration: typeof t.duration === 'string' && t.duration.trim() ? t.duration.trim().slice(0, 20) : '3 Days',
        estimatedBudget: clampNum(t.estimatedBudget, 0, 1e9, 0),
        vibe: typeof t.vibe === 'string' ? t.vibe.trim().slice(0, 80) : ''
      }];
    });
    return { month: monthLabel, trips };
  });
  base.weekendCalendar = calendar;

  let major = null;
  if (raw.majorTrip && raw.majorTrip.dest) {
    const dest = DESTINATIONS.find(d => d.name === raw.majorTrip.dest.name);
    if (dest) {
      major = {
        dest,
        cost: clampNum(raw.majorTrip.cost, 0, 1e9, dest.cost),
        days: clampNum(raw.majorTrip.days, 1, 10, dest.minD),
        travelers: clampNum(raw.majorTrip.travelers, 1, 12, 1)
      };
    }
  }
  base.majorTrip = major;

  return base;
}

module.exports = { DEFAULTS, sanitizePlan };