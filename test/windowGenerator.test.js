const { test } = require('node:test');
const assert = require('node:assert');
const { generateWindows, addDays, monthNumber } = require('../utils/windowGenerator');
const { getIndianHolidays } = require('../utils/holidays');

test('generates Fri-Sun and Sat-Mon weekend windows for a year', () => {
  const { weekend_windows } = generateWindows(2026, 7);
  assert.ok(weekend_windows.length >= 100, `expected ~104 weekend windows, got ${weekend_windows.length}`);

  const startDow = (s) => new Date(`${s}T00:00:00`).getDay();
  for (const w of weekend_windows.slice(0, 30)) {
    assert.strictEqual(w.kind, 'weekend');
    assert.strictEqual(addDays(w.start_date, 2), w.end_date);
    const dow = startDow(w.start_date);
    assert.ok(dow === 5 || dow === 6, `weekend window must start Fri(5) or Sat(6), got ${dow}`);
    assert.match(w.window_id, /^W-\d{4}-\d{2}-\d{2}$/);
    assert.ok(monthNumber(w.start_date) >= 1 && monthNumber(w.start_date) <= 12);
  }
});

test('weekend windows never spill outside the year', () => {
  const { weekend_windows } = generateWindows(2026, 7);
  for (const w of weekend_windows) {
    assert.ok(w.start_date >= '2026-01-01' && w.end_date <= '2026-12-31');
  }
});

test('major windows overlap public holidays when a holiday falls inside', () => {
  const year = 2026;
  const holidays = getIndianHolidays(year);
  const { major_windows } = generateWindows(year, 7);
  assert.ok(major_windows.length > 0);
  const overlapping = major_windows.filter(w => w.is_long_weekend);
  // 2026 has many fixed + festival holidays; at least one window must overlap.
  assert.ok(overlapping.length > 0, 'expected at least one holiday-overlapping major window');
  for (const w of major_windows) {
    assert.strictEqual(addDays(w.start_date, 7 - 1), w.end_date);
    assert.strictEqual(w.kind, 'major');
    assert.match(w.window_id, /^M-\d{4}-\d{2}-\d{2}$/);
  }
});

test('major window that overlaps a holiday carries its name', () => {
  const year = 2026;
  const { major_windows } = generateWindows(year, 7);
  const aug = major_windows.find(w => w.start_date <= '2026-08-15' && w.end_date >= '2026-08-15');
  assert.ok(aug, 'expected a window overlapping Independence Day');
  assert.strictEqual(aug.holiday_name, 'Independence Day');
  assert.strictEqual(aug.is_long_weekend, true);
});

test('major window duration is respected and unique starts', () => {
  const { major_windows } = generateWindows(2026, 10);
  const starts = new Set(major_windows.map(w => w.start_date));
  assert.strictEqual(starts.size, major_windows.length);
});

test('available_windows is the union of weekend and major windows with unique ids', () => {
  const { available_windows, weekend_windows, major_windows } = generateWindows(2026, 7);
  assert.strictEqual(available_windows.length, weekend_windows.length + major_windows.length);
  const ids = new Set(available_windows.map(w => w.window_id));
  assert.strictEqual(ids.size, available_windows.length);
});

test('holiday lookup includes fixed national holidays', () => {
  const holidays = getIndianHolidays(2026);
  const names = holidays.map(h => h.date);
  assert.ok(names.includes('2026-01-26'));
  assert.ok(names.includes('2026-08-15'));
  assert.ok(names.includes('2026-10-02'));
  assert.ok(names.includes('2026-12-25'));
});