// Indian public holidays used to flag long weekends and to prefer major-trip
// windows that overlap a holiday (which saves leave days).
//
// Fixed-date holidays are computed for any year. Festival dates are given for
// the years the planner is expected to run in; for other years we fall back to
// the fixed-date set only (a miss here is soft — it just affects window
// ranking/labels, not validity).

function fixedHolidays(year) {
  const d = (month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return [
    { date: d(1, 1), name: 'New Year' },
    { date: d(1, 26), name: 'Republic Day' },
    { date: d(8, 15), name: 'Independence Day' },
    { date: d(10, 2), name: 'Gandhi Jayanti' },
    { date: d(12, 25), name: 'Christmas' }
  ];
}

// Festival / variable holidays for the supported years.
const VARIABLE = {
  2025: [
    ['2025-02-26', 'Maha Shivratri'],
    ['2025-03-14', 'Holi'],
    ['2025-04-18', 'Good Friday'],
    ['2025-03-31', 'Eid-ul-Fitr'],
    ['2025-06-07', 'Eid-ul-Adha'],
    ['2025-08-27', 'Janmashtami'],
    ['2025-10-01', 'Dussehra'],
    ['2025-10-20', 'Diwali'],
    ['2025-11-05', 'Guru Nanak Jayanti']
  ],
  2026: [
    ['2026-02-15', 'Maha Shivratri'],
    ['2026-03-04', 'Holi'],
    ['2026-04-03', 'Good Friday'],
    ['2026-03-20', 'Eid-ul-Fitr'],
    ['2026-05-28', 'Eid-ul-Adha'],
    ['2026-09-05', 'Janmashtami'],
    ['2026-10-21', 'Dussehra'],
    ['2026-11-09', 'Diwali'],
    ['2026-12-01', 'Guru Nanak Jayanti']
  ],
  2027: [
    ['2027-03-06', 'Holi'],
    ['2027-03-26', 'Good Friday'],
    ['2027-03-09', 'Eid-ul-Fitr'],
    ['2027-05-18', 'Eid-ul-Adha'],
    ['2027-10-09', 'Dussehra'],
    ['2027-10-29', 'Diwali'],
    ['2027-12-24', 'Guru Nanak Jayanti']
  ]
};

function getIndianHolidays(year) {
  const holidays = fixedHolidays(year);
  const extra = VARIABLE[String(year)] || VARIABLE[year] || [];
  for (const [date, name] of extra) holidays.push({ date, name });
  return holidays.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function holidayLookup(year) {
  const map = new Map();
  for (const h of getIndianHolidays(year)) map.set(h.date, h.name);
  return map;
}

module.exports = { getIndianHolidays, holidayLookup, fixedHolidays, VARIABLE };