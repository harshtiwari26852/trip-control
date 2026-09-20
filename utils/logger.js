// Minimal structured logger for debugging the TripWise endpoints.
// Never logs API keys, tokens or passwords — only request shapes, model output
// lengths and validation outcomes.

function ts() {
  return new Date().toISOString();
}

function log(level, message, meta) {
  const line = [`[tripwise] ${ts()} ${level.toUpperCase()} ${message}`];
  if (meta && typeof meta === 'object') {
    const safe = meta.raw != null ? { ...meta, raw: truncate(meta.raw) } : meta;
    line.push(JSON.stringify(safe));
  }
  // eslint-disable-next-line no-console
  console.log(line.join(' '));
}

function truncate(text, max = 800) {
  const s = String(text);
  return s.length > max ? `${s.slice(0, max)}… (${s.length} chars)` : s;
}

module.exports = { log, truncate };