// Deterministic generator of the "available_windows" for a year.
//
// Weekend windows: every Fri-Sun and Sat-Mon long-weekend-shaped 3-day window.
// Major windows: candidate windows of `majorDurationDays` that either start on
// a Saturday/Sunday or overlap a public holiday, so the trip uses fewer leave
// days. Everything is computed in code; the AI can only pick from these.

const { getIndianHolidays } = require('./holidays');

function parseISO(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function addDays(dateStr, n) {
  const d = parseISO(dateStr);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}
function dayOfWeek(dateStr) {
  return parseISO(dateStr).getDay(); // 0 = Sunday
}
function monthNumber(dateStr) {
  return parseInt(dateStr.slice(5, 7), 10);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// Mark windows that are (or overlap) a holiday / long weekend.
function annotateWindow(window, holidays) {
  const inside = holidays
    .filter(h => h.date >= window.start_date && h.date <= window.end_date)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  window.is_long_weekend = inside.length > 0;
  window.holiday_name = window.is_long_weekend ? inside[0].name : null;
  return window;
}

// Generate the windows for `year`. `majorDurationDays` is the length of the
// major trip windows to emit (the actual selection happens in the AI prompt).
function generateWindows(year, majorDurationDays = 7) {
  const holidays = getIndianHolidays(year);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const weekendWindows = [];

  // Walk day by day; whenever it is a Friday or a Saturday, emit the 3-day
  // window starting that day (Fri->Sun, Sat->Mon). Both are valid weekend
  // shapes; Sat-Mon windows that start on the very last day of December are
  // dropped because they spill into the next year.
  let cursor = yearStart;
  while (cursor <= yearEnd) {
    const dow = dayOfWeek(cursor);
    if (dow === 5 || dow === 6) {
      const start = cursor;
      const end = addDays(start, 2);
      if (end <= yearEnd) {
        const month = monthNumber(start);
        const windowId = `W-${year}-${pad(month)}-${start.slice(8, 10)}`;
        weekendWindows.push(
          annotateWindow({
            window_id: windowId,
            kind: 'weekend',
            start_date: start,
            end_date: end,
            month,
            is_long_weekend: false,
            holiday_name: null
          }, holidays)
        );
      }
    }
    cursor = addDays(cursor, 1);
  }

  // Major-trip candidate windows. Start on a Saturday/Sunday (so the trip uses
  // at least one full weekend) or on any day where the window overlaps a
  // public holiday (so it rides a festival break).
  const majorWindows = [];
  const seen = new Set();
  const duration = Math.max(2, Math.round(majorDurationDays));

  const pushMajor = (start) => {
    if (seen.has(start)) return;
    const end = addDays(start, duration - 1);
    if (end > yearEnd) return;
    seen.add(start);
    const month = monthNumber(start);
    const windowId = `M-${year}-${pad(month)}-${start.slice(8, 10)}`;
    majorWindows.push(
      annotateWindow({
        window_id: windowId,
        kind: 'major',
        start_date: start,
        end_date: end,
        month,
        is_long_weekend: false,
        holiday_name: null,
        duration_days: duration
      }, holidays)
    );
  };

  let majorCursor = yearStart;
  while (majorCursor <= yearEnd) {
    const dow = dayOfWeek(majorCursor);
    if (dow === 6 || dow === 0) pushMajor(majorCursor); // Saturday or Sunday start
    majorCursor = addDays(majorCursor, 1);
  }
  // Windows that overlap a holiday but start on a weekday (Mon-Fri).
  for (const h of holidays) {
    for (let offset = -3; offset <= 0; offset++) {
      pushMajor(addDays(h.date, offset));
    }
  }

  return {
    year,
    weekend_windows: weekendWindows,
    major_windows: majorWindows,
    available_windows: [...weekendWindows, ...majorWindows]
  };
}

module.exports = { generateWindows, addDays, monthNumber, dayOfWeek };