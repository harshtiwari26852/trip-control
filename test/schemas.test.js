const { test } = require('node:test');
const assert = require('node:assert');
const { validateSchema, firstError, number, string, boolean, isoDate, arrayOf, object } = require('../utils/schemas');

test('basic scalar validation works', () => {
  const schema = { age: number({ min: 0, max: 120, integer: true }), name: string({ min: 1 }) };
  const ok = validateSchema(schema, { age: '42', name: '  Ada  ' });
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.data.age, 42);
  assert.strictEqual(ok.data.name, 'Ada');

  const bad = validateSchema(schema, { age: 200, name: '' });
  assert.strictEqual(bad.ok, false);
  assert.ok(bad.errors.some(e => e.includes('age')));
  assert.ok(bad.errors.some(e => e.includes('name')));
});

test('enum constraints reject unknown values', () => {
  const schema = { kind: string({ enum: ['weekend', 'major'] }) };
  assert.strictEqual(validateSchema(schema, { kind: 'weekend' }).ok, true);
  assert.strictEqual(validateSchema(schema, { kind: 'boat' }).ok, false);
});

test('optional fields get defaults and required fields are enforced', () => {
  const schema = {
    num: number({ optional: true, default: 5 }),
    req: string()
  };
  const ok = validateSchema(schema, { req: 'x' });
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.data.num, 5);
  assert.strictEqual(validateSchema(schema, {}).ok, false);
});

test('isoDate rejects calendar-invalid dates', () => {
  const schema = { d: isoDate() };
  assert.strictEqual(validateSchema(schema, { d: '2026-01-16' }).ok, true);
  assert.strictEqual(validateSchema(schema, { d: '2026-13-40' }).ok, false);
  assert.strictEqual(validateSchema(schema, { d: '16/01/2026' }).ok, false);
});

test('arrayOf validates array items', () => {
  const schema = { tags: arrayOf(string({ min: 2 }), { min: 1 }) };
  assert.strictEqual(validateSchema(schema, { tags: ['a', 'bc'] }).ok, false);
  assert.strictEqual(validateSchema(schema, { tags: ['ab', 'cd'] }).ok, true);
  assert.strictEqual(validateSchema(schema, { tags: [] }).ok, false);
});

test('object validators handle nested structures', () => {
  const schema = { deep: object({ a: number(), b: string() }) };
  assert.strictEqual(validateSchema(schema, { deep: { a: 3, b: 'x' } }).ok, true);
  assert.strictEqual(validateSchema(schema, { deep: { a: 'x', b: 'y' } }).ok, false);
});

test('firstError returns a single string', () => {
  const schema = { v: number() };
  const err = firstError(schema, { v: 'abc' });
  assert.strictEqual(typeof err, 'string');
  assert.strictEqual(firstError(schema, { v: 3 }), null);
});

test('unknown keys are ignored by validateSchema', () => {
  const schema = { a: number() };
  assert.strictEqual(validateSchema(schema, { a: 1, b: 'ignored' }).ok, true);
});