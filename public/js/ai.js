/* ============ AI LAYER (uses globals from trip.js) ============ */

let AI_KEY_STATUS = null;
let WEATHER_DATA = null;
let PRICING_DATA = null;
let AI_PLAN = null;

async function initAI() {
  try {
    const res = await fetch('/api/ai/avail');
    if (res.ok) {
      AI_KEY_STATUS = (await res.json()).layers;
      renderAIAvailability();
    }
  } catch (e) {}
}

function renderAIAvailability() {
  const el = document.getElementById('aiAvail');
  if (!el) return;
  if (!AI_KEY_STATUS) { el.innerHTML = ''; return; }
  const status = AI_KEY_STATUS;
  const chips = [];
  const layers = [
    { key: 'gemini', label: 'Gemini' },
    { key: 'weather', label: 'Weather' },
    { key: 'amadeus', label: 'Live Pricing' },
    { key: 'geminiMaps', label: 'Maps via Gemini' }
  ];
  layers.forEach(l => {
    const on = status[l.key];
    chips.push(`<span class="ai-layer-chip ${on ? 'on' : 'off'}" title="${l.label} ${on ? 'connected' : 'not configured'}">${l.label} ${on ? '●' : '○'}</span>`);
  });
  el.innerHTML = `<div class="ai-layer-row">${chips.join('')}</div>`;
  const btn = document.getElementById('aiGenerateBtn');
  if (btn) {
    btn.disabled = !status.planner;
    if (!status.planner) {
      el.insertAdjacentHTML('afterbegin', '<div class="ai-no-key">AI planning is unavailable. Add a valid Gemini API key, then restart the server.</div>');
    }
  }
}

function setAIStatus(msg, type) {
  const el = document.getElementById('aiStatus');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  el.className = 'ai-status ' + (type || 'info');
  el.innerHTML = msg;
}

async function generateAIPlan() {
  const btn = document.getElementById('aiGenerateBtn');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  const original = btn.innerHTML;
  btn.innerHTML = 'Generating AI Plan…';

  setAIStatus(`
    <div class="ai-spin"></div> <span>Talking to Gemini, weather and flight APIs — this can take ~20-40s…</span>
  `, 'info');

  const payload = {
    home: state.home,
    tripType: state.tripType,
    traveler: state.traveler,
    travelers: state.travelers,
    kidsAge: state.kidsAge,
    radius: state.radius,
    slotTarget: state.slotTarget,
    weekendBudget: state.weekendBudget,
    majorBudget: state.majorBudget,
    yearlyBudget: state.yearlyBudget,
    durSlider: state.durSlider
  };

  try {
    const res = await fetch('/api/ai/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify(payload)
    });
    if (res.status === 503) {
      const j = await res.json();
      setAIStatus('<b>AI not configured:</b> ' + (j.error || 'Missing API keys'), 'error');
      return;
    }
    if (res.status === 502) {
      const j = await res.json();
      setAIStatus('<b>AI provider error:</b> ' + esc(j.error || 'The configured provider could not generate a plan.'), 'error');
      return;
    }
    if (!res.ok) throw new Error('Request failed: ' + res.status);
    const data = await res.json();
    if (!data.aiPlan) {
      setAIStatus('<b>AI could not generate a plan.</b> Check the GEMINI_API_KEY in .env and try again.', 'error');
      return;
    }

    AI_PLAN = data.aiPlan;
    WEATHER_DATA = data.weather || {};
    PRICING_DATA = data.pricing || {};

    applyAIPlan(data.aiPlan);
    storeAIMetadata(data.aiPlan, data.weather, data.pricing);
    renderAISummary(data.aiPlan);

    const warning = data.warnings && data.warnings.length
      ? `<br><small>${data.warnings.map(esc).join(' ')}</small>`
      : '';
    setAIStatus(`<b>AI plan generated with Gemini.</b> ${data.aiPlan.weekendSlots ? data.aiPlan.weekendSlots.length : 0} weekend trips + a major trip were auto-filled into your plan below.${warning}`, 'success');
  } catch (e) {
    setAIStatus('<b>Error generating AI plan:</b> ' + esc(e.message), 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

function applyAIPlan(plan) {
  if (!plan) return;

  if (Array.isArray(plan.weekendSlots)) {
    const target = state.slotTarget || 12;
    const next = Array(12).fill(null);
    plan.weekendSlots.slice(0, target).forEach((slot, i) => {
      if (i >= 12) return;
      next[i] = {
        name: slot.name,
        state: slot.state || 'India',
        cost: Number(slot.cost) || 0,
        days: Number(slot.days) || 3,
        reason: slot.reason || null,
        source: 'ai'
      };
    });
    state.weekendSlots = next;
  }

  if (plan.majorTrip && plan.majorTrip.name) {
    const dest = {
      name: plan.majorTrip.name,
      state: plan.majorTrip.state || 'India',
      tags: [],
      hl: plan.majorTrip.reason || 'Google Maps-grounded destination.'
    };
    state.majorTrip = {
      dest,
      cost: Number(plan.majorTrip.cost) || 0,
      days: Number(plan.majorTrip.days) || state.durSlider,
      travelers: state.travelers,
      reason: plan.majorTrip.reason || null,
      itinerary: plan.majorTrip.itinerary || null,
      source: 'ai'
    };
  }

  Plan.save();
  syncPlannerFromPlan();
  if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
  if (document.getElementById('page-home').classList.contains('active')) renderHomePage();
  toast('AI plan applied to your calendar.');
}

function storeAIMetadata(aiPlan, weather, pricing) {
  try {
    fetch('/api/plan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({
        data: state,
        aiPlan,
        aiSource: aiPlan.source || 'gemini',
        lastAiRun: new Date().toISOString(),
        weatherData: weather,
        pricingData: pricing
      })
    }).catch(() => {});
  } catch (e) {}
}

function renderAISummary(plan) {
  const box = document.getElementById('aiSummaryBox');
  if (!box) return;
  if (!plan) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'block';
  box.className = 'ai-summary-box';
  let html = `<div class="ai-summary-head"><span class="ai-badge">AI PLAN</span><span>Gemini · Google Maps grounding</span></div>`;
  if (plan.summary) html += `<p class="ai-summary-text">${esc(plan.summary)}</p>`;
  if (plan.majorTrip && plan.majorTrip.reason) {
    html += `<div class="ai-reason"><b>Major trip → ${esc(plan.majorTrip.name)}</b><p>${esc(plan.majorTrip.reason)}</p></div>`;
  }
  if (Array.isArray(plan.mapSources) && plan.mapSources.length) {
    const links = plan.mapSources.map(source => {
      const url = /^https:\/\//.test(source.uri || '') ? source.uri : '';
      return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a>` : '';
    }).filter(Boolean);
    if (links.length) html += `<div class="ai-reason"><b translate="no">Google Maps</b><p>${links.join(' · ')}</p></div>`;
  }
  box.innerHTML = html;
}

function renderLayerInfo() {
  const el = document.getElementById('aiLayerInfo');
  if (!el) return;
  const parts = [];
  if (WEATHER_DATA) {
    const on = Object.keys(WEATHER_DATA).length;
    parts.push(`<span class="ai-data-chip">☀ ${on} destinations weather</span>`);
  } else {
    parts.push('<span class="ai-data-chip muted">☀ weather not enabled</span>');
  }
  if (PRICING_DATA) {
    const on = Object.keys(PRICING_DATA).length;
    parts.push(`<span class="ai-data-chip">✈ ${on} live flight prices</span>`);
  } else {
    parts.push('<span class="ai-data-chip muted">✈ live pricing not enabled</span>');
  }
  el.innerHTML = `<div class="ai-layer-row">${parts.join('')}</div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  initAI();
  renderLayerInfo();
  const btn = document.getElementById('aiGenerateBtn');
  if (btn) btn.addEventListener('click', generateAIPlan);
});

window.AIGenerate = generateAIPlan;
window.AIApply = applyAIPlan;
window.AIGetWeather = () => WEATHER_DATA;
window.AIGetPricing = () => PRICING_DATA;
window.AIGetPlan = () => AI_PLAN;
window.AISetData = (meta) => {
  if (meta.aiPlan) AI_PLAN = meta.aiPlan;
  if (meta.weatherData) WEATHER_DATA = meta.weatherData;
  if (meta.pricingData) PRICING_DATA = meta.pricingData;
  if (meta.aiPlan) renderAISummary(meta.aiPlan);
  renderLayerInfo();
};
