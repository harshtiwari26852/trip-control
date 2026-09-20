// Tiny dependency-free schema validator used to validate all request/response
// payloads that cross the server boundary (HTTP input and LLM JSON output).
//
// Usage:
//   const result = validateSchema({ foo: number(0, 100, true), bar: string(true) }, data)
//   result.errors        -> array of human-readable problems
//   result.data          -> the normalized payload (copied, defaults applied)

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

const FLOAT = /^[+-]?(\d+\.?\d*|\.\d+)$/;

// Numeric field. min/max inclusive. integer=true forces whole numbers.
function number({ min = -Infinity, max = Infinity, integer = false, optional = false, default: dflt } = {}) {
  return function numberField(value, key) {
    if (value === undefined || value === null || value === '') {
      if (optional) return { ok: true, value: dflt };
      return { ok: false, error: `"${key}" is required` };
    }
    const num = typeof value === 'number' ? value : FLOAT.test(String(value)) ? Number(value) : NaN;
    if (!Number.isFinite(num)) return { ok: false, error: `"${key}" must be a number` };
    if (integer && !Number.isInteger(num)) return { ok: false, error: `"${key}" must be an integer` };
    if (num < min) return { ok: false, error: `"${key}" must be >= ${min}` };
    if (num > max) return { ok: false, error: `"${key}" must be <= ${max}` };
    return { ok: true, value: num };
  };
}

function string({ min = 0, max = Infinity, optional = false, default: dflt, enum: list, pattern } = {}) {
  return function stringField(value, key) {
    if (value === undefined || value === null || value === '') {
      if (optional) return { ok: true, value: dflt };
      return { ok: false, error: `"${key}" is required` };
    }
    if (typeof value !== 'string') return { ok: false, error: `"${key}" must be a string` };
    const trimmed = value.trim();
    if (trimmed.length < min) return { ok: false, error: `"${key}" must be at least ${min} chars` };
    if (trimmed.length > max) return { ok: false, error: `"${key}" must be at most ${max} chars` };
    if (list && !list.includes(trimmed)) return { ok: false, error: `"${key}" must be one of ${list.join(', ')}` };
    if (pattern && !pattern.test(trimmed)) return { ok: false, error: `"${key}" is not well formed` };
    return { ok: true, value: trimmed };
  };
}

function boolean({ optional = false, default: dflt } = {}) {
  return function booleanField(value, key) {
    if (value === undefined || value === null || value === '') {
      if (optional) return { ok: true, value: dflt };
      return { ok: false, error: `"${key}" is required` };
    }
    return { ok: value === true || value === false, value: value === true, error: `"${key}" must be a boolean` };
  };
}

// ISO date (YYYY-MM-DD) validated with a real calendar round-trip.
function isoDate({ optional = false } = {}) {
  return function isoDateField(value, key) {
    if (value === undefined || value === null || value === '') {
      if (optional) return { ok: true, value: undefined };
      return { ok: false, error: `"${key}" is required` };
    }
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { ok: false, error: `"${key}" must be an ISO date (YYYY-MM-DD)` };
    }
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const valid = dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
    if (!valid) return { ok: false, error: `"${key}" is not a real calendar date` };
    return { ok: true, value };
  };
}

// Array of items described by `itemValidator`.
function arrayOf(itemValidator, { min = 0, max = Infinity, optional = false, default: dflt } = {}) {
  return function arrayField(value, key) {
    if (value === undefined || value === null || value === '') {
      if (optional) return { ok: true, value: dflt || [] };
      return { ok: false, error: `"${key}" is required` };
    }
    if (!Array.isArray(value)) return { ok: false, error: `"${key}" must be an array` };
    if (value.length < min) return { ok: false, error: `"${key}" must have at least ${min} item(s)` };
    for (let i = 0; i < value.length; i++) {
      const r = itemValidator(value[i], `${key}[${i}]`);
      if (!r.ok) return r;
    }
    return { ok: true, value };
  };
}

// Object described by `fields` (a map of field name -> validator).
function object(fields, { optional = false } = {}) {
  return function objectField(value, key) {
    if (value === undefined || value === null || value === '') {
      if (optional) return { ok: true, value: undefined };
      return { ok: false, error: `"${key}" is required` };
    }
    if (!isPlainObject(value)) return { ok: false, error: `"${key}" must be an object` };
    const out = {};
    for (const [name, validator] of Object.entries(fields)) {
      const r = validator(value[name], `${key}.${name}`);
      if (!r.ok) return r;
      out[name] = r.value;
    }
    return { ok: true, value: out };
  };
}

// Same as object() but ignores unknown keys and reports all failures at once.
function strictObject(fields, { optional = false } = {}) {
  return function strictObjectField(value, key) {
    if (value === undefined || value === null || value === '') {
      if (optional) return { ok: true, value: undefined };
      return { ok: false, error: `"${key}" is required` };
    }
    if (!isPlainObject(value)) return { ok: false, error: `"${key}" must be an object` };
    const out = {};
    const errors = [];
    for (const [name, validator] of Object.entries(fields)) {
      const r = validator(value[name], `${key}.${name}`);
      if (!r.ok) errors.push(r.error);
      else out[name] = r.value;
    }
    if (errors.length) return { ok: false, error: errors.join('; ') };
    return { ok: true, value: out };
  };
}

// Validate an arbitrary object against a schema (map of validators).
// Returns { ok, data?, errors }.
function validateSchema(schema, input) {
  const errors = [];
  const out = {};
  if (!isPlainObject(input)) return { ok: false, errors: ['expected a JSON object'] };
  for (const [name, validator] of Object.entries(schema)) {
    const r = validator(input[name], name);
    if (!r.ok) errors.push(r.error);
    else out[name] = r.value;
  }
  return errors.length ? { ok: false, errors } : { ok: true, data: out };
}

// Collect errors into a single string.
function firstError(schema, input) {
  const r = validateSchema(schema, input);
  return r.ok ? null : r.errors.join('; ');
}

module.exports = { validateSchema, firstError, number, string, boolean, isoDate, arrayOf, object, strictObject, isPlainObject };