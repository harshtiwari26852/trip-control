import { useEffect, useMemo, useState } from 'react'
import { MapPin, Plus, Sparkles } from 'lucide-react'
import { apiFetch } from '../lib/api'

const initialPlan = {
  home: 'Mumbai', tripType: 'weekend', mode: 'weekend', traveler: 'solo', travelers: 1,
  kidsAge: 7, radius: 300, slotTarget: 12, weekendBudget: 8000, majorBudget: 45000,
  majorTripCount: 1, yearlyBudget: 96000, durSlider: 7, weekendSlots: Array(12).fill(null), majorTrip: null,
}
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const money = (value) => `₹${Math.round(value || 0).toLocaleString('en-IN')}`

function distance(a, b) {
  const rad = (n) => (n * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

const inputClass =
  'border-input text-foreground h-12 w-full rounded-lg border border-border bg-background px-4 text-base outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/50'

const selectClass = `${inputClass} bg-white pr-10`

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-primary mb-1.5 block text-sm font-medium leading-none">{label}</span>
      {children}
    </label>
  )
}

function NumberInput({ label, prefix, onChange, ...props }) {
  return (
    <Field label={label}>
      <div className="relative">
        {prefix && (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-base">
            {prefix}
          </span>
        )}
        <input
          type="number"
          onChange={(e) => onChange(Number(e.target.value))}
          className={`${inputClass}${prefix ? ' pl-8' : ''}`}
          {...props}
        />
      </div>
    </Field>
  )
}

function RangeInput({ label, value, onChange, suffix, min, max, step }) {
  return (
    <Field label={label}>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bg-deep-purple-100 w-full cursor-pointer accent-primary"
        />
        <span className="text-muted-foreground min-w-16 whitespace-nowrap text-right text-sm font-medium">
          {value}
          {suffix}
        </span>
      </div>
    </Field>
  )
}

function Toggle({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
      {children}
    </p>
  )
}

export default function Planner() {
  const [plan, setPlan] = useState(initialPlan)
  const [cities, setCities] = useState({})
  const [destinations, setDestinations] = useState([])
  const [status, setStatus] = useState('Loading your planning tools…')
  const [aiState, setAiState] = useState({ busy: false, summary: '', source: '', error: '' })

  useEffect(() => {
    Promise.all([
      fetch('/api/destinations').then((r) => r.json()),
      fetch('/api/plan').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([catalogue, saved]) => {
        setCities(catalogue.cities || {})
        setDestinations(catalogue.destinations || [])
        if (saved?.plan) {
          setPlan((p) => ({
            ...p,
            ...saved.plan,
            weekendSlots: [...(saved.plan.weekendSlots || Array(12).fill(null)), ...Array(12)].slice(0, 12),
          }))
        }
        setStatus('')
      })
      .catch(() => setStatus('Could not load the planner. Please refresh and try again.'))
  }, [])

  const candidates = useMemo(() => {
    const home = cities[plan.home]
    if (!home) return []
    const weekend = plan.mode === 'weekend'
    return destinations
      .map((dest) => {
        const days = weekend
          ? Math.min(3, Math.max(2, dest.minD))
          : Math.min(dest.maxD, Math.max(dest.minD, plan.durSlider))
        const cost = dest.cost * plan.travelers * days
        const km = distance(home, dest)
        const fits =
          dest.tags.includes(plan.traveler) &&
          cost <= (weekend ? plan.weekendBudget : plan.majorBudget) &&
          (!weekend || km <= plan.radius)
        return { dest, days, cost, km, fits }
      })
      .filter((x) => x.fits)
      .sort((a, b) => a.cost - b.cost)
  }, [cities, destinations, plan])

  const weekendSpend = plan.weekendSlots
    .slice(0, plan.slotTarget)
    .filter(Boolean)
    .reduce((sum, slot) => sum + slot.cost, 0)
  const majorSpend = plan.majorTrip?.cost || 0
  const totalSpend = weekendSpend + majorSpend

  function update(key, value) {
    setPlan((p) => {
      const next = { ...p, [key]: value }
      if (key === 'tripType') {
        if (value === 'weekend') next.mode = 'weekend'
        else if (value === 'vacation') next.mode = 'vacation'
      }
      if (next.tripType === 'weekend') {
        if (key === 'weekendBudget' || key === 'slotTarget') {
          next.yearlyBudget = next.weekendBudget * next.slotTarget
        } else if (key === 'yearlyBudget') {
          next.weekendBudget = next.slotTarget ? Math.round(next.yearlyBudget / next.slotTarget) : 0
        }
      } else if (next.tripType === 'vacation') {
        if (key === 'majorBudget' || key === 'majorTripCount') {
          next.yearlyBudget = next.majorBudget * next.majorTripCount
        } else if (key === 'yearlyBudget') {
          next.majorBudget = next.majorTripCount ? Math.round(next.yearlyBudget / next.majorTripCount) : 0
        }
      } else {
        if (key === 'weekendBudget' || key === 'slotTarget' || key === 'majorBudget' || key === 'majorTripCount') {
          next.yearlyBudget = next.weekendBudget * next.slotTarget + next.majorBudget * next.majorTripCount
        } else if (key === 'yearlyBudget') {
          const majorTotal = next.majorBudget * next.majorTripCount
          const remain = next.yearlyBudget - majorTotal
          next.weekendBudget = next.slotTarget ? Math.round(Math.max(0, remain) / next.slotTarget) : 0
        }
      }
      return next
    })
  }
  function addTrip(item) {
    setPlan((p) => {
      if (p.mode === 'weekend') {
        const index = p.weekendSlots.slice(0, p.slotTarget).findIndex((x) => !x)
        if (
          index < 0 ||
          p.weekendSlots.some((x) => x?.name === item.dest.name) ||
          p.majorTrip?.dest?.name === item.dest.name
        )
          return p
        const slots = [...p.weekendSlots]
        slots[index] = { name: item.dest.name, state: item.dest.state, cost: item.cost, days: item.days }
        return { ...p, weekendSlots: slots }
      }
      if (p.weekendSlots.some((x) => x?.name === item.dest.name)) return p
      return { ...p, majorTrip: { dest: item.dest, cost: item.cost, days: item.days, travelers: p.travelers } }
    })
  }
  function removeSlot(index) {
    setPlan((p) => {
      const slots = [...p.weekendSlots]
      slots[index] = null
      return { ...p, weekendSlots: slots }
    })
  }
  async function save() {
    setStatus('Saving…')
    try {
      const res = await apiFetch('/api/plan', { method: 'PUT', body: { data: plan } })
      if (!res.ok) throw new Error()
      setStatus('Plan saved.')
    } catch {
      setStatus('Could not save your plan.')
    }
  }
function travelerChange(value) {
    setPlan((p) => ({ ...p, traveler: value, travelers: value === 'solo' ? 1 : value === 'family' ? 4 : 2 }))
  }
  async function searchWithAI() {
    if (aiState.busy) return
    setAiState({ busy: true, summary: '', source: '', error: '' })
    const profile = {
      home: plan.home,
      tripType: plan.tripType,
      traveler: plan.traveler,
      travelers: plan.travelers,
      kidsAge: plan.kidsAge,
      radius: plan.radius,
      slotTarget: plan.slotTarget,
      weekendBudget: plan.weekendBudget,
      majorBudget: plan.majorBudget,
      yearlyBudget: plan.yearlyBudget,
      durSlider: plan.durSlider,
    }
    try {
      const res = await apiFetch('/api/ai/generate-plan', { method: 'POST', body: profile })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate plan')
      const aiPlan = data.aiPlan
      setPlan((p) => {
        const slots = Array(12).fill(null)
        aiPlan.weekendSlots?.slice(0, 12).forEach((s, i) => {
          slots[i] = { name: s.name, state: s.state, cost: s.cost, days: s.days, month: s.month, reason: s.reason }
        })
        return {
          ...p,
          weekendSlots: slots,
          majorTrip: aiPlan.majorTrip
            ? {
                dest: { name: aiPlan.majorTrip.name, state: aiPlan.majorTrip.state },
                cost: aiPlan.majorTrip.cost,
                days: aiPlan.majorTrip.days,
                travelers: p.travelers,
                month: aiPlan.majorTrip.month,
                reason: aiPlan.majorTrip.reason,
                itinerary: aiPlan.majorTrip.itinerary || [],
              }
            : null,
        }
      })
      setAiState({
        busy: false,
        summary: aiPlan.summary || 'Your AI plan is ready and added to the calendar.',
        source: aiPlan.source || '',
        error: '',
      })
    } catch (err) {
      setAiState({ busy: false, summary: '', source: '', error: err.message })
    }
  }

  return (
    <main className="bg-muted min-h-screen px-4 pt-24 pb-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="bg-muted relative mb-8 overflow-hidden rounded-3xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden bg-linear-to-b from-hero-gradient-top to-hero-gradient-bottom"
          >
            <svg className="absolute top-0 left-0 h-auto w-[10.94%] min-w-16" viewBox="0 0 140 601" fill="none">
              <path className="fill-dark-purple-700 opacity-15" d="M0 0 C44 120 96 160 140 140 V601 H0 Z" />
            </svg>
            <svg className="absolute top-0 right-0 h-auto w-[13.2%] min-w-20" viewBox="1111 0 169 701" fill="none">
              <path className="fill-dark-purple-700 opacity-15" d="M1280 0 C1216 180 1150 260 1111 300 V701 H1280 Z" />
            </svg>
          </div>

          <div className="relative px-6 py-10 text-primary sm:px-12 sm:py-14">
            <p className="text-primary/70 text-xs font-semibold tracking-widest uppercase">TripWise yearly planner</p>
            <h1 className="mt-3 max-w-2xl text-3xl leading-tight font-bold text-balance sm:text-5xl">
              A beautiful plan, built around your real limits.
            </h1>
            <p className="text-primary/75 mt-4 max-w-xl text-base sm:text-lg">
              Set your budget, radius and travel style. Every suggestion honours those constraints.
            </p>
          </div>
        </section>

        {status && <p className="text-muted-foreground mb-5 text-sm">{status}</p>}
        <section className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-3xl bg-background p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <SectionLabel>Your preferences</SectionLabel>
                <h2 className="text-primary mt-1 text-2xl font-bold">Trip constraints</h2>
              </div>
              <button
                onClick={save}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 shrink-0 items-center justify-center rounded-full px-6 text-sm leading-none font-semibold shadow-xs transition-colors"
              >
                Save plan
              </button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Home city">
                <select value={plan.home} onChange={(e) => update('home', e.target.value)} className={selectClass}>
                  {Object.keys(cities).map((city) => (
                    <option key={city}>{city}</option>
                  ))}
                </select>
              </Field>

              <Field label="Trip type">
                <select value={plan.tripType} onChange={(e) => update('tripType', e.target.value)} className={selectClass}>
                  <option value="both">Both</option>
                  <option value="weekend">Long weekend</option>
                  <option value="vacation">Long vacation</option>
                </select>
              </Field>

              {plan.tripType === 'both' && (
              <Field label="Planner view">
                <div className="mt-2 flex rounded-full bg-muted p-1">
                  <Toggle active={plan.mode === 'weekend'} onClick={() => update('mode', 'weekend')}>Weekends</Toggle>
                  <Toggle active={plan.mode === 'vacation'} onClick={() => update('mode', 'vacation')}>Major trip</Toggle>
                </div>
              </Field>
              )}

              <Field label="Traveller type">
                <select value={plan.traveler} onChange={(e) => travelerChange(e.target.value)} className={selectClass}>
                  <option value="solo">Solo</option>
                  <option value="family">Family with kids</option>
                  <option value="elders">Parents & elders</option>
                </select>
              </Field>

              <NumberInput
                label="Travellers"
                value={plan.travelers}
                min="1"
                max="12"
                onChange={(v) => update('travelers', v)}
              />

              {plan.traveler === 'family' && (
                <NumberInput
                  label="Youngest child's age"
                  value={plan.kidsAge}
                  min="0"
                  max="17"
                  onChange={(v) => update('kidsAge', v)}
                />
              )}

              {plan.tripType !== 'vacation' && (
              <RangeInput
                label="Weekend radius"
                value={plan.radius}
                min="50"
                max="600"
                step="10"
                suffix=" km"
                onChange={(v) => update('radius', v)}
              />
              )}

              {plan.tripType !== 'vacation' && (
              <NumberInput
                label="Weekend slots this year"
                value={plan.slotTarget}
                min="1"
                max="12"
                onChange={(v) => update('slotTarget', v)}
              />
              )}

              {plan.tripType !== 'vacation' && (
              <NumberInput
                label="Weekend budget (per trip)"
                prefix="₹"
                value={plan.weekendBudget}
                min="0"
                step="500"
                onChange={(v) => update('weekendBudget', v)}
              />
              )}

              {plan.tripType !== 'weekend' && (
              <NumberInput
                label="Major-trip budget"
                prefix="₹"
                value={plan.majorBudget}
                min="0"
                step="1000"
                onChange={(v) => update('majorBudget', v)}
              />
              )}

              {plan.tripType !== 'weekend' && (
              <NumberInput
                label="No. of major trips"
                value={plan.majorTripCount}
                min="1"
                max="12"
                onChange={(v) => update('majorTripCount', v)}
              />
              )}

              <NumberInput
                label="Total yearly budget"
                prefix="₹"
                value={plan.yearlyBudget}
                min="0"
                step="5000"
                onChange={(v) => update('yearlyBudget', v)}
              />

              {plan.tripType !== 'weekend' && (
              <RangeInput
                label="Major trip duration"
                value={plan.durSlider}
                min="7"
                max="10"
                suffix=" days"
                onChange={(v) => update('durSlider', v)}
              />
              )}
            </div>
          </div>
          <div className="rounded-3xl bg-secondary p-6 sm:p-8">
            <SectionLabel>Budget tracker</SectionLabel>
            <h2 className="text-primary mt-1 text-2xl font-bold">
              {money(totalSpend)} <span className="text-primary/60 text-base font-normal">of {money(plan.yearlyBudget)}</span>
            </h2>
            <div className="bg-white/60 mt-4 h-3 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full ${totalSpend > plan.yearlyBudget ? 'bg-red-500' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, plan.yearlyBudget ? (totalSpend / plan.yearlyBudget) * 100 : 0)}%` }}
              />
            </div>

            {plan.tripType !== 'vacation' && (
            <div className="mt-8">
              <SectionLabel>Weekend calendar</SectionLabel>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {plan.weekendSlots.slice(0, plan.slotTarget).map((slot, index) => (
<div key={index} className="bg-white/75 text-primary min-h-28 rounded-2xl p-3">
                    <p className="text-primary/55 text-xs">{slot?.month || months[(new Date().getMonth() + index) % 12]}</p>
                    {slot ? (
                      <>
                        <p className="mt-2 text-sm font-bold">{slot.name}</p>
                        <p className="text-xs">
                          {slot.days} days · {money(slot.cost)}
                        </p>
                        {slot.reason && (
                          <p className="text-primary/55 mt-1 text-[10px] leading-3">{slot.reason}</p>
                        )}
                        <button
                          aria-label={`Remove ${slot.name}`}
                          onClick={() => removeSlot(index)}
                          className="mt-2 text-xs font-semibold underline"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <p className="text-primary/50 mt-5 text-sm">Open slot</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            )}

            <div className="bg-white/75 mt-7 rounded-2xl p-4">
              {plan.tripType !== 'weekend' ? (
                <>
              <SectionLabel>Major trip</SectionLabel>
{plan.majorTrip ? (
                <>
                  <p className="text-primary mt-2 font-bold">
                    {plan.majorTrip.dest.name}, {plan.majorTrip.dest.state}
                  </p>
                  <p className="text-primary/70 text-sm">
                    {plan.majorTrip.days} days · {money(plan.majorTrip.cost)}
                    {plan.majorTrip.month ? ` · ${plan.majorTrip.month}` : ''}
                  </p>
                  {plan.majorTrip.reason && (
                    <p className="text-primary/65 mt-1.5 text-xs leading-relaxed">{plan.majorTrip.reason}</p>
                  )}
                  {Array.isArray(plan.majorTrip.itinerary) && plan.majorTrip.itinerary.length > 0 && (
                    <ol className="border-primary/20 mt-2 flex flex-col gap-1 border-t pt-2">
                      {plan.majorTrip.itinerary.map((line, ix) => (
                        <li key={ix} className="flex items-start gap-1.5 text-xs text-primary/70">
                          <span className="font-medium shrink-0">D{ix + 1}:</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <button
                    onClick={() => update('majorTrip', null)}
                    className="text-primary/70 mt-2 text-xs font-semibold underline"
                  >
                    Clear major trip
                  </button>
                </>
              ) : (
                <p className="text-primary/55 mt-2 text-sm">Choose a matching destination below.</p>
              )}
                </>
              ) : null}
            </div>
          </div>
        </section>

<section className="mt-8 rounded-3xl bg-background p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionLabel>Matching engine</SectionLabel>
              <h2 className="text-primary mt-1 text-2xl font-bold">Destinations that fit your plan</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {candidates.length} matches after budget, distance, duration and traveller filters.
              </p>
            </div>
            <button
              type="button"
              onClick={searchWithAI}
              disabled={aiState.busy}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-sm leading-none font-semibold shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="size-4" />
              {aiState.busy ? 'Searching with AI…' : 'Search with AI'}
            </button>
          </div>

          {aiState.busy && (
            <p className="text-muted-foreground mt-4 text-sm">Searching live AI sources for trips within your budget and radius…</p>
          )}
          {aiState.summary && (
            <div className="bg-off-white border-border mt-4 rounded-2xl border p-4">
              <p className="text-primary text-sm leading-relaxed">{aiState.summary}</p>
              {aiState.source && (
                <p className="text-muted-foreground mt-2 text-xs font-medium tracking-widest uppercase">
                  Generated via {aiState.source}
                </p>
              )}
            </div>
          )}
          {aiState.error && (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-[#5c1a14]">
              {aiState.error}
            </p>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {candidates.map((item) => (
              <article key={item.dest.name} className="bg-off-white border-border rounded-2xl border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-primary font-bold">{item.dest.name}</h3>
                    <p className="text-muted-foreground text-sm">{item.dest.state}</p>
                  </div>
                  <MapPin className="text-dark-purple-800 size-5" />
                </div>
                <p className="text-muted-foreground mt-4 text-sm">{item.dest.hl}</p>
                <div className="text-primary mt-4 flex flex-wrap gap-2 text-xs font-medium">
                  <span className="bg-dark-purple-200 rounded-full px-2.5 py-1">{Math.round(item.km)} km</span>
                  <span className="bg-dark-purple-200 rounded-full px-2.5 py-1">{item.days} days</span>
                  <span className="bg-dark-purple-200 rounded-full px-2.5 py-1">{money(item.cost)}</span>
                </div>
                <button
                  onClick={() => addTrip(item)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-sm leading-none font-semibold shadow-xs transition-colors"
                >
                  <Plus className="size-4" />
                  {plan.mode === 'weekend' ? 'Add to calendar' : 'Set as major trip'}
                </button>
              </article>
            ))}
          </div>

          {!candidates.length && (
            <p className="bg-muted text-muted-foreground mt-6 rounded-2xl p-5">
              No destinations meet these constraints yet. Try widening your radius or increasing the relevant trip budget.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
