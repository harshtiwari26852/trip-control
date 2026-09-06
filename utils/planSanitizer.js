const { CITIES, DESTINATIONS } = require('../data/destinations');

const DEFAULTS = {
  home: 'Mumbai',
  tripType: 'both',
  mode: 'weekend',
  traveler: 'solo',
  travelers: 1,
  kidsAge: 7,
  radius: 300,
  slotTarget: 12,
  weekendBudget: 8000,
  majorBudget: 45000,
  yearlyBudget: 150000,
  durSlider: 7,
  weekendSlots: Array(12).fill(null),
  majorTrip: null
};

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizePlan(raw) {
  if (!raw || typeof raw !== 'object') return JSON.parse(JSON.stringify(DEFAULTS));

  const base = {
    home: CITIES[raw.home] ? raw.home : DEFAULTS.home,
    tripType: ['vacation', 'weekend', 'both'].includes(raw.tripType) ? raw.tripType : DEFAULTS.tripType,
    mode: ['weekend', 'vacation'].includes(raw.mode) ? raw.mode : DEFAULTS.mode,
    traveler: ['solo', 'family', 'elders'].includes(raw.traveler) ? raw.traveler : DEFAULTS.traveler,
    travelers: clampNum(raw.travelers, 1, 12, 1),
    kidsAge: clampNum(raw.kidsAge, 0, 17, 7),
    radius: clampNum(raw.radius, 50, 600, 300),
    slotTarget: clampNum(raw.slotTarget, 1, 12, 12),
    weekendBudget: clampNum(raw.weekendBudget, 0, 1e9, 8000),
    majorBudget: clampNum(raw.majorBudget, 0, 1e9, 45000),
    yearlyBudget: clampNum(raw.yearlyBudget, 0, 1e9, 150000),
    durSlider: clampNum(raw.durSlider, 7, 10, 7)
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