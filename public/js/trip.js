/* ============ DATA LOADING ============ */
let CITIES = {};
let REGIONS = {};
let DESTINATIONS = [];
const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function upcomingMonths(n){
  const now = new Date();
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push(MONTHS[d.getMonth()] + " '" + String(d.getFullYear()).slice(2));
  }
  return out;
}

function toRad(v){ return v * Math.PI / 180; }
function distanceKm(a, b){
  const R = 6371, dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function bearing(a, b){
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return Math.atan2(y, x);
}
function inr(n){ return "₹" + Math.round(n).toLocaleString('en-IN'); }
function esc(s){
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function hash(s){ let h = 0; for (let i = 0; i < s.length; i++){ h = (h * 31 + s.charCodeAt(i)) >>> 0; } return h; }
function gradientFor(name){
  const h = hash(name); const h1 = h % 360, h2 = (h1 + 50) % 360;
  return `linear-gradient(135deg, hsl(${h1} 55% 32%), hsl(${h2} 60% 20%))`;
}

/* ============ PERSISTED PLAN ============ */
const DEFAULT_PLAN = {
  home: "Mumbai", tripType: "both", mode: "weekend", traveler: "solo",
  travelers: 1, kidsAge: 7, radius: 300, slotTarget: 12,
  weekendBudget: 8000, majorBudget: 45000, yearlyBudget: 150000, durSlider: 7,
  weekendSlots: Array(12).fill(null), majorTrip: null
};

const STORAGE_KEY = 'tripControlPlan';

function deepClone(o){ return JSON.parse(JSON.stringify(o)); }

function loadLocal(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function storeLocal(plan){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(plan)); } catch (e) {}
}

function sanitizePlan(raw){
  const base = deepClone(DEFAULT_PLAN);
  if (!raw || typeof raw !== 'object') return base;

  if (CITIES[raw.home]) base.home = raw.home;
  if (['vacation', 'weekend', 'both'].includes(raw.tripType)) base.tripType = raw.tripType;
  if (['weekend', 'vacation'].includes(raw.mode)) base.mode = raw.mode;
  if (['solo', 'family', 'elders'].includes(raw.traveler)) base.traveler = raw.traveler;

  const nums = ['travelers', 'kidsAge', 'radius', 'slotTarget', 'weekendBudget', 'majorBudget', 'yearlyBudget', 'durSlider'];
  nums.forEach(k => { if (Number.isFinite(Number(raw[k]))) base[k] = Number(raw[k]); });

  if (Array.isArray(raw.weekendSlots)) {
    raw.weekendSlots.forEach((slot, i) => {
      if (i >= 12) return;
      const dest = slot && slot.name && DESTINATIONS.find(d => d.name === slot.name);
      if (dest) base.weekendSlots[i] = {
        name: dest.name, state: dest.state, cost: Number(slot.cost) || dest.cost, days: Number(slot.days) || 3,
        reason: slot.reason || null, source: slot.source || null
      };
    });
  }

  const majorName = raw.majorTrip && raw.majorTrip.dest && raw.majorTrip.dest.name;
  if (majorName) {
    const dest = DESTINATIONS.find(d => d.name === majorName);
    if (dest) base.majorTrip = {
      dest,
      cost: Number(raw.majorTrip.cost) || dest.cost,
      days: Number(raw.majorTrip.days) || dest.minD,
      travelers: Number(raw.majorTrip.travelers) || 1,
      reason: raw.majorTrip.reason || null,
      itinerary: raw.majorTrip.itinerary || null,
      source: raw.majorTrip.source || null
    };
  }

  return base;
}

const Plan = {
  data: null,
  init(serverPlan){
    const local = loadLocal();
    this.data = serverPlan ? sanitizePlan(serverPlan) : (local ? sanitizePlan(local) : deepClone(DEFAULT_PLAN));
    storeLocal(this.data);
  },
  save(){
    storeLocal(this.data);
    clearTimeout(this._timer);
    this._timer = setTimeout(() => saveToServer(this.data), 400);
  },
  reset(){
    const def = deepClone(DEFAULT_PLAN);
    Object.keys(def).forEach(k => { this.data[k] = def[k]; });
    this.save();
  }
};

let state = null;

function saveToServer(data){
  try {
    fetch('/api/plan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ data })
    }).catch(() => {});
  } catch (e) {}
}

/* ============ TOAST ============ */
let toastTimer = null;
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ============ ROUTER ============ */
const PAGES = ['home', 'planner', 'explore', 'dashboard', 'how'];
function showPage(name){
  if (!PAGES.includes(name)) name = 'home';
  PAGES.forEach(p => document.getElementById('page-' + p).classList.toggle('active', p === name));
  document.querySelectorAll('.nav-link').forEach(el => el.classList.toggle('active', el.dataset.nav === name));
  document.getElementById('navLinks').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  if (location.hash !== '#/' + name) history.replaceState(null, '', '#/' + name);
  if (name === 'home') renderHomePage();
  if (name === 'planner') syncPlannerFromPlan();
  if (name === 'explore') renderExplore();
  if (name === 'dashboard') renderDashboard();
}
document.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => showPage(el.dataset.nav)));
document.getElementById('navToggle').onclick = () => document.getElementById('navLinks').classList.toggle('open');
window.addEventListener('hashchange', () => { const p = (location.hash || '#/home').replace('#/', ''); showPage(p); });

/* ============ HOME PAGE ============ */
function renderHomePage(){
  const banner = document.getElementById('continueBanner');
  const filled = state.weekendSlots.filter(Boolean).length;
  if (filled > 0 || state.majorTrip) {
    banner.innerHTML = `<div class="continue-banner">You have <b>${filled} weekend trip${filled === 1 ? '' : 's'}</b>${state.majorTrip ? ' and a major trip' : ''} planned. <a href="#/dashboard" style="color:var(--teal);text-decoration:underline;">Continue on My trips &rarr;</a></div>`;
  } else banner.innerHTML = '';

  const totalDest = DESTINATIONS.length;
  const avgCost = Math.round(DESTINATIONS.reduce((s, d) => s + d.cost, 0) / totalDest);
  const regions = new Set(DESTINATIONS.map(d => d.region)).size;
  const minDur = Math.min(...DESTINATIONS.map(d => d.minD)), maxDur = Math.max(...DESTINATIONS.map(d => d.maxD));
  document.getElementById('homeStats').innerHTML = [
    { v: totalDest, l: "Destinations" }, { v: regions, l: "Regions covered" }, { v: inr(avgCost), l: "Avg. cost / day" }, { v: minDur + "–" + maxDur + " days", l: "Duration range" }
  ].map(s => `<div class="stat-box"><div class="v">${s.v}</div><div class="l">${s.l}</div></div>`).join('');

  const featured = [...DESTINATIONS].sort((a, b) => hash(a.name) - hash(b.name)).slice(0, 6);
  document.getElementById('featRail').innerHTML = featured.map(d => `
    <div class="feat-tile" data-dest="${esc(d.name)}">
      <div class="tile-art" style="background:${gradientFor(d.name)};"><span class="init">${esc(d.name)}</span></div>
      <div class="feat-body"><h5>${esc(d.name)}</h5><div class="sub">${esc(d.state)} · ${inr(d.cost)}/day</div></div>
    </div>`).join('');

  const home = CITIES[state.home];
  const dotsWrap = document.getElementById('homeRadarDots'); dotsWrap.innerHTML = '';
  if (home) {
    const maxKm = 3000, R = 44;
    DESTINATIONS.forEach(d => {
      const dKm = distanceKm(home, d), brg = bearing(home, d);
      const rr = Math.min(R, (dKm / maxKm) * R);
      const x = 50 + rr * Math.sin(brg), y = 50 - rr * Math.cos(brg);
      const dot = document.createElement('div');
      dot.className = 'radar-dot';
      dot.style.left = x + '%'; dot.style.top = y + '%';
      dot.style.transform = 'translate(-50%,-50%)';
      dot.title = d.name;
      dotsWrap.appendChild(dot);
    });
  }
  document.getElementById('homeRadarCaption').textContent = `${totalDest} destinations tracked from ${state.home}`;
}

/* ============ PLANNER PAGE (engine) ============ */
function buildSelectors(){
  const citySel = document.getElementById('homeCity'); citySel.innerHTML = '';
  Object.keys(CITIES).forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; citySel.appendChild(o); });
  citySel.value = state.home;
  citySel.onchange = () => { state.home = citySel.value; Plan.save(); runEngine(); };

  const tripTypes = [{ v: "vacation", label: "Long vacation", sub: "7–10 days" }, { v: "weekend", label: "Long weekend", sub: "2–3 days" }, { v: "both", label: "Both, confirmed", sub: "plan both" }];
  const ttRow = document.getElementById('tripTypeRow'); ttRow.innerHTML = '';
  tripTypes.forEach(t => {
    const el = document.createElement('label'); el.className = 'radio-opt' + (state.tripType === t.v ? ' active' : '');
    el.innerHTML = `<input type="radio" name="tt" value="${t.v}" ${state.tripType === t.v ? 'checked' : ''}><span>${t.label}</span><span class="sub">${t.sub}</span>`;
    el.querySelector('input').onchange = () => { state.tripType = t.v; if (t.v !== 'both') state.mode = (t.v === 'vacation' ? 'vacation' : 'weekend'); Plan.save(); syncTripTypeUI(); runEngine(); };
    ttRow.appendChild(el);
  });

  const travelerTypes = [{ v: "solo", label: "Solo", sub: "1 traveller" }, { v: "family", label: "Family with kids", sub: "kid-friendly" }, { v: "elders", label: "Parents & elders", sub: "accessible stays" }];
  const trRow = document.getElementById('travelerRow'); trRow.innerHTML = '';
  travelerTypes.forEach(t => {
    const el = document.createElement('label'); el.className = 'radio-opt' + (state.traveler === t.v ? ' active' : '');
    el.innerHTML = `<input type="radio" name="trav" value="${t.v}"><span>${t.label}</span><span class="sub">${t.sub}</span>`;
    el.querySelector('input').checked = state.traveler === t.v;
    el.querySelector('input').onchange = () => {
      state.traveler = t.v;
      document.getElementById('kidsField').style.display = t.v === 'family' ? 'block' : 'none';
      const travelersInput = document.getElementById('travelers');
      travelersInput.value = t.v === 'solo' ? 1 : t.v === 'family' ? 4 : 2;
      state.travelers = Number(travelersInput.value);
      Plan.save(); syncActiveRadios(); runEngine();
    };
    trRow.appendChild(el);
  });

  document.getElementById('kidsAge').oninput = e => { state.kidsAge = Number(e.target.value); Plan.save(); };
  document.getElementById('travelers').oninput = e => { state.travelers = Number(e.target.value) || 1; Plan.save(); runEngine(); };
  document.getElementById('slotTarget').oninput = e => {
    const v = Math.max(1, Math.min(12, Number(e.target.value) || 12));
    if (v < state.slotTarget) {
      let dropped = false;
      for (let i = v; i < 12; i++) {
        if (state.weekendSlots[i]) { state.weekendSlots[i] = null; dropped = true; }
      }
      if (dropped) toast('Trips beyond the new slot count were removed.');
    }
    state.slotTarget = v;
    Plan.save(); renderCalendar(); renderBudget(); runEngine();
  };
  document.getElementById('durSlider').oninput = e => { state.durSlider = Number(e.target.value); document.getElementById('durReadout').textContent = state.durSlider + " days"; Plan.save(); runEngine(); };
  document.getElementById('radiusSlider').oninput = e => { state.radius = Number(e.target.value); document.getElementById('radiusReadout').textContent = state.radius + " km"; Plan.save(); runEngine(); };
  document.getElementById('weekendBudget').oninput = e => { state.weekendBudget = Number(e.target.value) || 0; Plan.save(); runEngine(); };
  document.getElementById('majorBudget').oninput = e => { state.majorBudget = Number(e.target.value) || 0; Plan.save(); runEngine(); };
  document.getElementById('yearlyBudget').oninput = e => { state.yearlyBudget = Number(e.target.value) || 0; Plan.save(); renderBudget(); };

  document.getElementById('kidsField').style.display = state.traveler === 'family' ? 'block' : 'none';
  document.getElementById('kidsAge').value = state.kidsAge;
  document.getElementById('travelers').value = state.travelers;
  document.getElementById('slotTarget').value = state.slotTarget;
  document.getElementById('durSlider').value = state.durSlider; document.getElementById('durReadout').textContent = state.durSlider + " days";
  document.getElementById('radiusSlider').value = state.radius; document.getElementById('radiusReadout').textContent = state.radius + " km";
  document.getElementById('weekendBudget').value = state.weekendBudget;
  document.getElementById('majorBudget').value = state.majorBudget;
  document.getElementById('yearlyBudget').value = state.yearlyBudget;

  document.getElementById('runBtn').onclick = () => { document.getElementById('runBtn').textContent = 'Recalculating…'; setTimeout(() => { runEngine(); document.getElementById('runBtn').textContent = 'Run matching engine'; }, 300); };
  syncTripTypeUI();
}
function syncActiveRadios(){ document.querySelectorAll('#travelerRow .radio-opt').forEach(el => el.classList.toggle('active', el.querySelector('input').checked)); }
function syncTripTypeUI(){
  document.querySelectorAll('#tripTypeRow .radio-opt').forEach(el => el.classList.toggle('active', el.querySelector('input').checked));
  document.getElementById('durationField').style.display = (state.tripType === 'weekend') ? 'none' : 'block';
  buildModeTabs();
}
function buildModeTabs(){
  const wrap = document.getElementById('modeTabs'); wrap.innerHTML = '';
  const opts = [];
  if (state.tripType === 'both'){ opts.push({ v: 'weekend', l: 'Weekend candidates' }, { v: 'vacation', l: 'Major trip candidates' }); }
  else { opts.push({ v: state.tripType === 'weekend' ? 'weekend' : 'vacation', l: state.tripType === 'weekend' ? 'Weekend candidates' : 'Major trip candidates' }); }
  if (!opts.find(o => o.v === state.mode)) state.mode = opts[0].v;
  opts.forEach(o => {
    const b = document.createElement('button'); b.className = 'tab' + (o.v === state.mode ? ' active' : ''); b.textContent = o.l;
    b.onclick = () => { state.mode = o.v; Plan.save(); document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); b.classList.add('active'); runEngine(); };
    wrap.appendChild(b);
  });
}
function syncPlannerFromPlan(){ buildSelectors(); renderCalendar(); renderMajorTrip(); renderBudget(); runEngine(); }

function evaluate(dest){
  const home = CITIES[state.home];
  const dKm = home ? distanceKm(home, dest) : 0;
  const mode = state.mode;
  let durOk, effDuration, budgetOk, cost, distOk, distApplies;
  if (mode === 'weekend'){
    effDuration = Math.min(3, dest.maxD);
    durOk = dest.minD <= 3 && dest.maxD >= 2;
    cost = dest.cost * state.travelers * effDuration;
    budgetOk = cost <= state.weekendBudget;
    distApplies = true;
    distOk = dKm <= state.radius;
  } else {
    durOk = dest.minD <= state.durSlider && dest.maxD >= state.durSlider;
    effDuration = durOk ? state.durSlider : Math.min(dest.maxD, Math.max(dest.minD, state.durSlider));
    cost = dest.cost * state.travelers * effDuration;
    budgetOk = cost <= state.majorBudget;
    distApplies = false;
    distOk = true;
  }
  const affinityOk = dest.tags.includes(state.traveler);
  const isMatch = durOk && budgetOk && distOk && affinityOk;
  return { dest, dKm, effDuration, cost, durOk, budgetOk, distOk, distApplies, affinityOk, isMatch };
}
function computeAll(){ return DESTINATIONS.map(evaluate); }

function renderEngine(results){
  const total = results.length;
  const durPass = results.filter(r => r.durOk).length;
  const budPass = results.filter(r => r.budgetOk).length;
  const distApplies = results[0] && results[0].distApplies;
  const distPass = distApplies ? results.filter(r => r.distOk).length : total;
  const affPass = results.filter(r => r.affinityOk).length;
  const overall = results.filter(r => r.isMatch).length;
  const modules = [
    { name: "Duration check", desc: state.mode === 'weekend' ? "2–3 day window, priced for the stay." : `Window ${state.durSlider} days (7–10 range).`, n: durPass },
    { name: "Budget alignment", desc: state.mode === 'weekend' ? "≤ weekend trip budget." : "≤ major trip budget.", n: budPass },
    { name: "Distance check", desc: distApplies ? `Within ${state.radius} km of ${state.home}.` : "Unrestricted for major trips.", n: distPass },
    { name: "Affinity match", desc: `Tagged for "${state.traveler}" travellers.`, n: affPass },
  ];
  const grid = document.getElementById('engineGrid'); grid.innerHTML = '';
  modules.forEach(m => {
    const pct = Math.round((m.n / total) * 100);
    const el = document.createElement('div'); el.className = 'module';
    el.innerHTML = `<h4><span class="icon"></span>${m.name}</h4><p>${m.desc}</p><span class="count">${m.n}</span><span class="of">/ ${total} pass</span><div class="bar-track"><div class="bar-fill" style="width:0%" data-pct="${pct}"></div></div>`;
    grid.appendChild(el);
  });
  document.getElementById('overallCount').textContent = overall;
  const totalEl = document.getElementById('totalDestCount');
  if (totalEl) totalEl.textContent = total;
  requestAnimationFrame(() => { document.querySelectorAll('.bar-fill').forEach(b => { b.style.width = b.dataset.pct + '%'; }); });
}

function renderCards(results){
  const grid = document.getElementById('cardGrid'); grid.innerHTML = '';
  const sorted = [...results].sort((a, b) => (b.isMatch - a.isMatch) || (a.dKm - b.dKm));
  sorted.forEach(r => {
    const d = r.dest;
    const card = document.createElement('div'); card.className = 'dcard ' + (r.isMatch ? 'is-match' : 'is-fail');
    const durBadge = r.durOk ? `<span class="pill ok">duration ✓</span>` : `<span class="pill">duration ✕</span>`;
    const budBadge = r.budgetOk ? `<span class="pill ok">budget ✓</span>` : `<span class="pill">budget ✕</span>`;
    const distBadge = r.distApplies ? (r.distOk ? `<span class="pill ok">distance ✓</span>` : `<span class="pill">distance ✕</span>`) : `<span class="pill ok">no radius cap</span>`;
    const aiWeather = (window.AIGetWeather && window.AIGetWeather()) || {};
    const w = aiWeather[d.name];
    let weatherHTML = '';
    if (w) {
      const cur = w.current;
      const wx = cur ? `${cur.temp}°C ${esc(cur.condition)}` : '—';
      weatherHTML = `<div class="dcard-weather" title="Best months: ${esc(w.range)}"><span class="weather-icon">⛅</span><span class="weather-temp">${wx}</span><span class="weather-best">Best: ${esc(w.range)}</span></div>`;
    }
    const aiPrice = (window.AIGetPricing && window.AIGetPricing()) || {};
    const p = aiPrice[d.name];
    let priceHTML = '';
    if (p && p.flight) {
      const f = p.flight;
      const txt = f.flights > 0
        ? `${f.flights} nonstop${f.airlines && f.airlines.length ? ' · ' + f.airlines.slice(0, 3).join(', ') : ''}`
        : 'no nonstop flights';
      priceHTML = `<div class="dcard-live-price" title="Live nonstop flight availability ${f.route || ''} from AeroDataBox"><span class="plane-icon">✈</span> ${esc(txt)}</div>`;
    }
    card.innerHTML = `
      <div class="dcard-top"><div><p class="dcard-name">${esc(d.name)}</p><div class="dcard-state">${esc(d.state)}</div></div><span class="pill ${r.isMatch ? 'ok' : ''}">${r.isMatch ? 'MATCH' : 'no match'}</span></div>
      ${weatherHTML}
      <p class="dcard-blurb">${esc(d.hl)}</p>
      <div class="dcard-meta"><span class="meta-chip">${Math.round(r.dKm)} km away</span><span class="meta-chip">${r.effDuration} days</span><span class="meta-chip ${r.budgetOk ? '' : 'warn'}">${inr(r.cost)} total</span>${priceHTML}</div>
      <div class="dcard-tags">${d.tags.map(t => `<span class="tagchip">${esc(t === 'family' ? 'family with kids' : t === 'elders' ? 'parents & elders' : t)}</span>`).join('')}</div>
      <div class="dcard-meta">${durBadge}${budBadge}${distBadge}</div>
      <div class="dcard-foot"><div class="price">${inr(d.cost)} <small>/ day / person</small></div><button class="btn-add" ${addDisabled()}>${state.mode === 'weekend' ? 'Add to weekend' : 'Set as major trip'}</button></div>`;
    card.querySelector('.btn-add').onclick = () => addToPlan(r);
    grid.appendChild(card);
  });
}
function addDisabled(){
  if (state.mode === 'weekend') {
    return state.weekendSlots.slice(0, state.slotTarget).some(s => s === null) ? '' : 'disabled';
  }
  return '';
}
function alreadyBooked(name){
  const inWeekend = state.weekendSlots.some(s => s && s.name === name);
  const asMajor = state.majorTrip && state.majorTrip.dest.name === name;
  return { inWeekend, asMajor };
}
function addToPlan(r){
  const name = r.dest.name;
  const booked = alreadyBooked(name);
  if (state.mode === 'weekend'){
    if (booked.inWeekend){ toast(`${name} is already on your weekend calendar.`); return; }
    if (booked.asMajor){ toast(`${name} is already set as your major trip.`); return; }
    const idx = state.weekendSlots.findIndex((s, i) => s === null && i < state.slotTarget);
    if (idx === -1){ toast('Weekend calendar is full — remove a trip first.'); return; }
    state.weekendSlots[idx] = { name, state: r.dest.state, cost: r.cost, days: r.effDuration };
    toast(`Added ${name} to your weekend calendar.`);
  } else {
    if (booked.inWeekend){ toast(`${name} is already on your weekend calendar.`); return; }
    state.majorTrip = { dest: r.dest, cost: r.cost, days: r.effDuration, travelers: state.travelers };
    toast(`${name} set as this year's major trip.`);
  }
  Plan.save(); renderCalendar(); renderMajorTrip(); renderBudget(); runEngine();
}
function removeSlot(i){
  state.weekendSlots[i] = null;
  Plan.save(); renderCalendar(); renderBudget(); runEngine();
  if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
}
function clearMajor(){
  state.majorTrip = null;
  Plan.save(); renderMajorTrip(); renderBudget(); runEngine();
  if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
}

function renderCalendar(){
  ['calGrid', 'calGrid2'].forEach(gid => {
    const grid = document.getElementById(gid); if (!grid) return; grid.innerHTML = '';
    const months = upcomingMonths(state.slotTarget);
    for (let i = 0; i < state.slotTarget; i++) {
      const slot = state.weekendSlots[i];
      const el = document.createElement('div');
      if (slot) {
        el.className = 'slot filled'; if (slot.source === 'ai') el.classList.add('ai-slot');
        const reason = slot.reason ? `<div class="slot-reason" title="${esc(slot.reason)}">⚡ ${esc(slot.reason)}</div>` : '';
        el.innerHTML = `<div class="month">${months[i]} ${slot.source === 'ai' ? '· AI' : ''}</div><div class="dest">${esc(slot.name)}</div>${reason}<div class="cost">${inr(slot.cost)}</div><button class="rm" data-slot="${i}">remove</button>`;
      } else {
        el.className = 'slot empty-slot';
        el.innerHTML = `<div>${months[i]}<br>slot open</div>`;
      }
      grid.appendChild(el);
    }
  });
}
function templates(tags){
  if (tags.includes('elders')) return ["Leisurely sightseeing with accessible transport and early check-ins.", "Short local excursion, rest in the afternoon.", "Relaxed local market walk near the stay."];
  if (tags.includes('family')) return ["Family-friendly sightseeing and local cuisine.", "Kid-paced outdoor activity with breaks.", "Nature walk or easy local excursion."];
  return ["Cafe-hopping and independent exploration.", "Full-day trek or offbeat local excursion.", "Slow morning, open-ended wandering."];
}
function majorTripHTML(){
  if (!state.majorTrip) return '<div class="empty-note">No major trip selected yet. Add one from the matches on the planner page.</div>';
  const t = state.majorTrip, d = t.dest, days = t.days;
  let steps = '';
  if (t.itinerary && Array.isArray(t.itinerary) && t.itinerary.length) {
    t.itinerary.forEach((line, i) => {
      steps += `<div class="itin-step"><div class="itin-day">Day ${i + 1}</div><div class="itin-text">${esc(line)}</div></div>`;
    });
  } else {
    const mid = templates(d.tags);
    steps = `<div class="itin-step"><div class="itin-day">Day 1</div><div class="itin-text">Arrive in ${esc(d.name)}, check in, and settle in.</div></div>`;
    steps += `<div class="itin-step"><div class="itin-day">Day 2</div><div class="itin-text">${esc(d.hl)}</div></div>`;
    for (let i = 3; i < days; i++) steps += `<div class="itin-step"><div class="itin-day">Day ${i}</div><div class="itin-text">${esc(mid[(i - 3) % mid.length])}</div></div>`;
    if (days >= 3) steps += `<div class="itin-step"><div class="itin-day">Day ${days}</div><div class="itin-text">Check out and depart from ${esc(d.name)}.</div></div>`;
  }
  const reason = t.reason ? `<div class="ai-reason"><b>Why this trip</b><p>${esc(t.reason)}</p></div>` : '';
  const sourceTag = t.source === 'ai' ? `<span class="ai-badge">AI</span>` : '';
  return `<div class="trip-card"><h4>${esc(d.name)}, ${esc(d.state)} ${sourceTag}</h4><div class="trip-meta">${days} days · ${t.travelers} traveller(s) · ${inr(t.cost)} total</div>${reason}<div class="itin-wrap">${steps}</div>
    <div class="confirm-grid">
      <div class="confirm-row">Flight booking<b>Pending confirmation</b></div>
      <div class="confirm-row">Hotel stay<b>3 options shortlisted</b></div>
      <div class="confirm-row">Route<b>Optimised for ${days} days</b></div>
      <div class="confirm-row">Budget concept<b>${inr(state.majorBudget)} cap</b></div>
    </div>
    <button class="btn-add" style="margin-top:14px;" id="clearMajorBtn">Clear major trip</button></div>`;
}
function renderMajorTrip(){
  const html = majorTripHTML();
  ['majorTripCard', 'majorTripCard2'].forEach(id => { const h = document.getElementById(id); if (h) {
    h.innerHTML = html;
    const btn = h.querySelector('#clearMajorBtn');
    if (btn) btn.onclick = () => clearMajor();
  } });
}
function renderBudget(){
  const weekendSpend = state.weekendSlots.slice(0, state.slotTarget).filter(Boolean).reduce((s, x) => s + x.cost, 0);
  const majorSpend = state.majorTrip ? state.majorTrip.cost : 0;
  const used = weekendSpend + majorSpend; const cap = state.yearlyBudget || 1; const pct = Math.min(100, (used / cap) * 100); const over = used > cap;
  [['budgetUsedLabel', 'budgetFillBar', 'budgetWarnText'], ['budgetUsedLabel2', 'budgetFillBar2', 'budgetWarnText2']].forEach(([lid, fid, wid]) => {
    const l = document.getElementById(lid), f = document.getElementById(fid), w = document.getElementById(wid);
    if (l) l.textContent = `${inr(used)} of ${inr(state.yearlyBudget)}`;
    if (f){ f.style.width = pct + '%'; f.classList.toggle('over', over); }
    if (w) w.style.display = over ? 'block' : 'none';
  });
  const wl2 = document.getElementById('weekendSpendLabel2'), ml2 = document.getElementById('majorSpendLabel2');
  if (wl2) wl2.textContent = inr(weekendSpend);
  if (ml2) ml2.textContent = inr(majorSpend);
}

function runEngine(){ const results = computeAll(); renderEngine(results); renderCards(results); }

/* ============ EXPLORE PAGE ============ */
const exploreState = { search: "", region: "all", tags: [], sort: "name" };
function initExplore(){
  const regionSel = document.getElementById('exRegion');
  regionSel.innerHTML = '<option value="all">All regions</option>' + Object.entries(REGIONS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  regionSel.onchange = () => { exploreState.region = regionSel.value; renderExplore(); };
  document.getElementById('exSearch').oninput = e => { exploreState.search = e.target.value; renderExplore(); };
  document.getElementById('exSort').onchange = e => { exploreState.sort = e.target.value; renderExplore(); };
  document.querySelectorAll('#exTags .chip').forEach(chip => {
    chip.onclick = () => {
      const t = chip.dataset.tag; const i = exploreState.tags.indexOf(t);
      if (i === -1) exploreState.tags.push(t); else exploreState.tags.splice(i, 1);
      chip.classList.toggle('active'); renderExplore();
    };
  });
}
function renderExplore(){
  document.getElementById('exploreContext').innerHTML = `Planning from <b>${esc(state.home)}</b> · ${state.travelers} traveller(s) · <a href="#/planner" style="color:var(--teal);">edit in planner</a>`;
  const home = CITIES[state.home];
  let list = DESTINATIONS.map(d => ({ d, dKm: home ? distanceKm(home, d) : 0 }));
  const f = exploreState.search.trim().toLowerCase();
  if (f) list = list.filter(x => x.d.name.toLowerCase().includes(f) || x.d.state.toLowerCase().includes(f));
  if (exploreState.region !== 'all') list = list.filter(x => x.d.region === exploreState.region);
  if (exploreState.tags.length) list = list.filter(x => exploreState.tags.every(t => x.d.tags.includes(t)));
  const sortFns = {
    name: (a, b) => a.d.name.localeCompare(b.d.name),
    distance: (a, b) => a.dKm - b.dKm,
    price: (a, b) => a.d.cost - b.d.cost,
    duration: (a, b) => a.d.minD - b.d.minD
  };
  list.sort(sortFns[exploreState.sort]);
  document.getElementById('exCount').textContent = `${list.length} of ${DESTINATIONS.length} destinations`;
  document.getElementById('exploreGrid').innerHTML = list.length ? list.map(({ d, dKm }) => `
    <div class="explore-card" data-dest="${esc(d.name)}">
      <div class="tile-art" style="background:${gradientFor(d.name)};"><span class="init">${esc(d.name)}</span></div>
      <div class="explore-body">
        <h4>${esc(d.name)}</h4><div class="st">${esc(d.state)} · ${Math.round(dKm)} km · ${d.minD}–${d.maxD} days</div>
        <div class="dcard-meta"><span class="meta-chip">${inr(d.cost)}/day</span>${d.tags.map(t => `<span class="tagchip">${esc(t)}</span>`).join('')}</div>
      </div>
    </div>`).join('') : '<div class="empty-note">No destinations match these filters.</div>';
}

/* ============ MODAL ============ */
function openDestModal(name){
  const d = DESTINATIONS.find(x => x.name === name); if (!d) return;
  const home = CITIES[state.home];
  const dKm = Math.round(home ? distanceKm(home, d) : 0);
  const travelers = state.travelers || 1;
  const wDays = Math.min(3, d.maxD);
  const costW = d.cost * travelers * wDays;
  const durMajor = Math.min(d.maxD, Math.max(d.minD, state.durSlider || 7));
  const costMajor = d.cost * travelers * durMajor;
  document.getElementById('modalBox').innerHTML = `
    <div class="modal-art" style="background:${gradientFor(d.name)};"><button class="modal-close">✕</button><h3>${esc(d.name)}</h3></div>
    <div class="modal-body">
      <div class="st">${esc(d.state)} · ${dKm} km from ${esc(state.home)} · ${esc(REGIONS[d.region] || '')}</div>
      <p class="hl">${esc(d.hl)}</p>
      <div class="dcard-tags" style="margin-bottom:16px;">${d.tags.map(t => `<span class="tagchip">${esc(t === 'family' ? 'family with kids' : t === 'elders' ? 'parents & elders' : t)}</span>`).join('')}</div>
      <div class="modal-price-grid">
        <div class="modal-price-box"><div class="l">${wDays}-day weekend (×${travelers})</div><div class="v">${inr(costW)}</div></div>
        <div class="modal-price-box"><div class="l">${durMajor}-day major trip (×${travelers})</div><div class="v">${inr(costMajor)}</div></div>
      </div>
      <div class="modal-actions">
        <button class="btn-add" data-quick="weekend" data-name="${esc(d.name)}">Add to weekend calendar</button>
        <button class="btn-add" data-quick="vacation" data-name="${esc(d.name)}">Set as major trip</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal(){ document.getElementById('modalOverlay').classList.remove('open'); }
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target.id === 'modalOverlay') closeModal();
});
document.getElementById('modalBox').addEventListener('click', e => {
  const close = e.target.closest('.modal-close');
  if (close) { closeModal(); return; }
  const btn = e.target.closest('[data-quick]');
  if (btn) quickAdd(btn.dataset.name, btn.dataset.quick);
});
function quickAdd(name, mode){
  const d = DESTINATIONS.find(x => x.name === name); if (!d) return;
  const travelers = state.travelers || 1;
  const booked = alreadyBooked(name);
  if (mode === 'weekend'){
    if (booked.inWeekend){ toast(`${name} is already on your weekend calendar.`); closeModal(); return; }
    if (booked.asMajor){ toast(`${name} is already set as your major trip.`); closeModal(); return; }
    const idx = state.weekendSlots.findIndex((s, i) => s === null && i < state.slotTarget);
    if (idx === -1){ toast('Weekend calendar is full — remove a trip first.'); closeModal(); return; }
    const days = Math.min(3, Math.max(2, d.maxD));
    state.weekendSlots[idx] = { name: d.name, state: d.state, cost: d.cost * travelers * days, days };
    toast(`Added ${name} to your weekend calendar.`);
  } else {
    if (booked.inWeekend){ toast(`${name} is already on your weekend calendar.`); closeModal(); return; }
    const days = Math.min(d.maxD, Math.max(d.minD, state.durSlider || 7));
    state.majorTrip = { dest: d, cost: d.cost * travelers * days, days, travelers };
    toast(`${name} set as this year's major trip.`);
  }
  Plan.save(); closeModal();
  const plannerActive = document.getElementById('page-planner').classList.contains('active');
  const dashActive = document.getElementById('page-dashboard').classList.contains('active');
  if (plannerActive) syncPlannerFromPlan();
  else if (dashActive) renderDashboard();
  else if (document.getElementById('page-home').classList.contains('active')) renderHomePage();
  else renderCalendar(); renderMajorTrip(); renderBudget();
}

/* ============ DASHBOARD PAGE ============ */
function renderDashboard(){
  renderCalendar(); renderMajorTrip(); renderBudget();
  const filled = state.weekendSlots.slice(0, state.slotTarget).filter(Boolean).length;
  const readiness = Math.round(((filled + (state.majorTrip ? 1 : 0)) / (state.slotTarget + 1)) * 100);
  document.getElementById('readinessStrip').innerHTML = `
    <div class="ready-box"><div class="l">Trip readiness</div><div class="v">${readiness}%</div></div>
    <div class="ready-box"><div class="l">Weekend slots filled</div><div class="v">${filled} / ${state.slotTarget}</div></div>
    <div class="ready-box"><div class="l">Major trip</div><div class="v" style="font-size:16px;">${state.majorTrip ? esc(state.majorTrip.dest.name) : 'Not set'}</div></div>`;
}
document.getElementById('copyPlanBtn').onclick = () => {
  const aiPlan = window.AIGetPlan ? window.AIGetPlan() : null;
  const lines = [`MY YEARLY TRAVEL PLAN — TRIP CONTROL`, `Home base: ${state.home}`, `Yearly budget: ${inr(state.yearlyBudget)}`, `Source: ${aiPlan ? 'AI (Gemini + live flight data)' : 'manual'}`, ``];
  lines.push('MAJOR TRIP');
  lines.push(state.majorTrip ? `${state.majorTrip.dest.name}, ${state.majorTrip.dest.state} — ${state.majorTrip.days} days — ${inr(state.majorTrip.cost)}${state.majorTrip.reason ? ' (' + state.majorTrip.reason + ')' : ''}` : 'Not set yet');
  lines.push('', 'WEEKEND CALENDAR');
  const months = upcomingMonths(state.slotTarget);
  state.weekendSlots.slice(0, state.slotTarget).forEach((s, i) => { lines.push(`${months[i]}: ${s ? `${s.name} — ${inr(s.cost)}${s.reason ? ' (' + s.reason + ')' : ''}` : 'open'}`); });
  const text = lines.join('\n');
  navigator.clipboard.writeText(text).then(() => toast('Plan copied to clipboard.')).catch(() => toast('Could not copy — select and copy manually.'));
};
document.getElementById('resetPlanBtn').onclick = () => {
  if (!confirm('Reset your whole plan? This clears saved weekend slots and your major trip.')) return;
  Plan.reset();
  renderDashboard();
  if (document.getElementById('page-planner').classList.contains('active')) syncPlannerFromPlan();
  toast('Plan reset.');
};

/* ============ DELEGATED OPEN LISTS ============ */
document.getElementById('featRail').addEventListener('click', e => {
  const tile = e.target.closest('[data-dest]');
  if (tile) openDestModal(tile.dataset.dest);
});
document.getElementById('exploreGrid').addEventListener('click', e => {
  const card = e.target.closest('[data-dest]');
  if (card) openDestModal(card.dataset.dest);
});

/* ============ INIT ============ */
async function boot(){
  try {
    const res = await fetch('/api/destinations');
    const data = await res.json();
    CITIES = data.cities;
    REGIONS = data.regions;
    DESTINATIONS = data.destinations;
  } catch (e) {
    toast('Failed to load destination data.');
    return;
  }

  let serverPlan = null;
  let serverMeta = null;
  try {
    const res = await fetch('/api/plan');
    if (res.ok) {
      const parsed = await res.json();
      serverPlan = parsed.plan;
      serverMeta = parsed;
    }
  } catch (e) {}

  if (serverMeta) {
    if (window.AISetData) window.AISetData(serverMeta);
  }

  Plan.init(serverPlan);
  state = Plan.data;

  buildSelectors();
  initExplore();
  renderCalendar();
  renderMajorTrip();
  renderBudget();
  runEngine();

  const startPage = (location.hash || '#/home').replace('#/', '') || 'home';
  showPage(startPage);
}

boot();