const { test } = require('node:test');
const assert = require('node:assert');
const { CITIES, REGIONS, DESTINATIONS } = require('./destinations');

const VALID_TAGS = ['solo', 'family', 'elders'];

test('destination catalogue is not empty', () => {
  assert.ok(DESTINATIONS.length > 10, 'expected a meaningful catalogue');
});

test('destination names are unique', () => {
  const names = DESTINATIONS.map(d => d.name);
  assert.strictEqual(new Set(names).size, names.length);
});

test('every destination has valid fields', () => {
  for (const d of DESTINATIONS) {
    assert.ok(typeof d.name === 'string' && d.name.length > 0, `bad name for ${JSON.stringify(d)}`);
    assert.ok(typeof d.state === 'string' && d.state.length > 0);
    assert.ok(Number.isFinite(d.lat) && d.lat >= -90 && d.lat <= 90);
    assert.ok(Number.isFinite(d.lng) && d.lng >= -180 && d.lng <= 180);
    assert.ok(Number.isFinite(d.cost) && d.cost > 0);
    assert.ok(Number.isFinite(d.minD) && d.minD > 0, `bad minD for ${d.name}`);
    assert.ok(Number.isFinite(d.maxD) && d.maxD >= d.minD, `bad maxD for ${d.name}`);
  }
});

test('every destination belongs to a known region', () => {
  for (const d of DESTINATIONS) {
    assert.ok(REGIONS[d.region], `unknown region "${d.region}" for ${d.name}`);
  }
});

test('destination tags are valid', () => {
  for (const d of DESTINATIONS) {
    assert.ok(Array.isArray(d.tags) && d.tags.length > 0, `no tags for ${d.name}`);
    for (const t of d.tags) {
      assert.ok(VALID_TAGS.includes(t), `invalid tag "${t}" for ${d.name}`);
    }
  }
});

test('home cities are well formed', () => {
  assert.ok(Object.keys(CITIES).length > 3);
  for (const [name, c] of Object.entries(CITIES)) {
    assert.ok(/^[A-Za-z ]+$/.test(name), `bad city name ${name}`);
    assert.ok(Number.isFinite(c.lat) && Number.isFinite(c.lng));
  }
});