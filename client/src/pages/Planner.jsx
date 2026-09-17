import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Hotel, MapPin, Plus, Route, Sparkles, Wallet } from 'lucide-react'
import { apiFetch } from '../lib/api'

const initialPlan = {
  home: 'Mumbai', tripType: 'weekend', mode: 'weekend', traveler: 'solo', travelers: 1,
  kidsAge: 7, radius: 300, slotTarget: 20, weekendBudget: 8000, majorBudget: 45000,
  majorTripCount: 1, yearlyBudget: 160000, durSlider: 7, weekendSlots: Array(12).fill(null),
  majorTrip: null,
  destination: '', startDate: '', endDate: '', duration: 4, totalBudget: 50000,
  travelMode: 'flight', pace: 'balanced', weekendCalendar: [],
}
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const money = (value) => `₹${Math.round(value || 0).toLocaleString('en-IN')}`

const TRAVEL_MODES = [
  { value: 'flight', label: 'Flight' },
  { value: 'train', label: 'Train' },
  { value: 'drive', label: 'Drive' },
]

const PACES = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'action', label: 'Action-packed' },
]

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

function daysBetween(a, b) {
  if (!a || !b) return ''
  const ms = new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)
  if (Number.isNaN(ms) || ms < 0) return ''
  return Math.round(ms / 86400000) + 1
}

function BudgetRow({ label, value }) {
  return (
    <div className="bg-muted rounded-xl px-3 py-2.5">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-primary mt-0.5 text-sm font-bold">{money(value)}</p>
    </div>
  )
}

function ItineraryResult({ itinerary, destination, budget }) {
  if (!itinerary) return null
  const b = itinerary.budgetSummary
  const budgetPct = b && budget ? Math.min(100, (b.total / budget) * 100) : 0
  const over = Boolean(b && budget && b.total > budget)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel>AI itinerary</SectionLabel>
          <h2 className="text-primary mt-1 text-3xl leading-tight font-bold">
            {destination} in {itinerary.itinerary.length || '…'} days
          </h2>
        </div>
        {itinerary.source && (
          <span className="bg-secondary text-muted-foreground rounded-full px-3 py-1 text-xs font-medium">
            Generated via {itinerary.source}
          </span>
        )}
      </div>

      {itinerary.summary && (
        <p className="text-primary/80 max-w-3xl text-base leading-relaxed">{itinerary.summary}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {itinerary.transportation && (
          <div className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-center gap-2">
              <span className="bg-secondary flex size-9 items-center justify-center rounded-full">
                <Route className="text-primary size-4" />
              </span>
              <h3 className="text-primary text-lg font-bold">Getting there</h3>
            </div>
            {itinerary.transportation.method && (
              <p className="text-primary mt-3 font-semibold capitalize">{itinerary.transportation.method}</p>
            )}
            {itinerary.transportation.details && (
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {itinerary.transportation.details}
              </p>
            )}
            <div className="text-primary mt-3 flex flex-wrap gap-2 text-xs font-medium">
              {itinerary.transportation.duration && (
                <span className="bg-dark-purple-200 rounded-full px-2.5 py-1">
                  {itinerary.transportation.duration}
                </span>
              )}
              <span className="bg-dark-purple-200 rounded-full px-2.5 py-1">
                {money(itinerary.transportation.estimatedCost)}
              </span>
            </div>
          </div>
        )}

        {itinerary.accommodation && (
          <div className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-center gap-2">
              <span className="bg-secondary flex size-9 items-center justify-center rounded-full">
                <Hotel className="text-primary size-4" />
              </span>
              <h3 className="text-primary text-lg font-bold">Where to stay</h3>
            </div>
            {itinerary.accommodation.suggestion && (
              <p className="text-primary mt-3 font-semibold">{itinerary.accommodation.suggestion}</p>
            )}
            <div className="text-primary mt-3 flex flex-wrap gap-2 text-xs font-medium">
              <span className="bg-dark-purple-200 rounded-full px-2.5 py-1">
                {money(itinerary.accommodation.estimatedTotalCost)}
              </span>
            </div>
          </div>
        )}
      </div>

      {b && (
        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="flex items-center gap-2">
            <span className="bg-secondary flex size-9 items-center justify-center rounded-full">
              <Wallet className="text-primary size-4" />
            </span>
            <h3 className="text-primary text-lg font-bold">Budget breakdown</h3>
            <span className="text-muted-foreground ml-auto text-sm font-medium">
              {money(b.total)}
              {budget ? ` of ${money(budget)}` : ''}
            </span>
          </div>
          <div className="bg-white/60 mt-4 h-3 overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-primary'}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <BudgetRow label="Transport" value={b.transport} />
            <BudgetRow label="Stay" value={b.accommodation} />
            <BudgetRow label="Food" value={b.food} />
            <BudgetRow label="Activities" value={b.activities} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {itinerary.itinerary.map((day) => (
          <div key={day.day} className="rounded-2xl border border-border bg-background p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                {day.day}
              </span>
              {day.theme && (
                <span className="text-primary text-base font-bold">{day.theme}</span>
              )}
            </div>
            <ol className="mt-4 flex flex-col gap-4">
              {day.activities.map((activity, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="bg-secondary text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-primary text-sm font-semibold">{activity.title}</p>
                      {activity.time && (
                        <span className="text-muted-foreground text-xs">{activity.time}</span>
                      )}
                    </div>
                    {activity.description && (
                      <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                        {activity.description}
                      </p>
                    )}
                    <p className="text-primary mt-1 text-xs font-semibold">
                      {money(activity.estimatedCost)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {!day.activities.length && (
              <p className="text-muted-foreground mt-3 text-sm">A free day to explore at your own pace.</p>
            )}
          </div>
        ))}
      </div>

      <p className="text-muted-foreground text-xs leading-4">
        * Estimated prices based on historical data. Actual prices may vary.
      </p>
    </div>
  )
}

export default function Planner() {
  const { state } = useLocation()
  const [plan, setPlan] = useState(() => ({
    ...initialPlan,
    ...(state?.goal === 'destination' ? { tripType: 'destination', mode: 'vacation' } : {}),
  }))
  const [cities, setCities] = useState({})
  const [destinations, setDestinations] = useState([])
  const [status, setStatus] = useState('Loading your planning tools…')
  const [aiState, setAiState] = useState({ busy: false, summary: '', source: '', error: '' })
  const [itineraryState, setItineraryState] = useState({ busy: false, data: null, error: '' })
  const [wcState, setWcState] = useState({ busy: false, error: '' })

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

const calendarSpend = (plan.weekendCalendar || []).reduce(
    (sum, month) => sum + (month.trips || []).reduce((s, t) => s + (Number(t.estimatedBudget) || 0), 0),
    0,
  )
  const weekendSpend = plan.weekendCalendar?.length
    ? calendarSpend
    : plan.weekendSlots
        .slice(0, plan.slotTarget)
        .filter(Boolean)
        .reduce((sum, slot) => sum + slot.cost, 0)
  const majorSpend = plan.majorTrip?.cost || 0
  const totalSpend = weekendSpend + majorSpend

  function update(key, value) {
    setPlan((p) => {
      let next = { ...p, [key]: value }
      if (key === 'tripType') {
        if (value === 'weekend') next.mode = 'weekend'
        else if (value === 'vacation') next.mode = 'vacation'
        else if (value === 'destination') next.mode = 'vacation'
      }
      if (key === 'startDate' || key === 'endDate') {
        next.duration = daysBetween(
          key === 'startDate' ? value : next.startDate,
          key === 'endDate' ? value : next.endDate,
        ) || p.duration
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
      destination: plan.destination,
      startDate: plan.startDate,
      endDate: plan.endDate,
      duration: plan.duration,
      totalBudget: plan.totalBudget,
      travelMode: plan.travelMode,
      pace: plan.pace,
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

  const isDestination = plan.tripType === 'destination'

  async function generateItinerary() {
    if (itineraryState.busy) return
    if (!plan.destination.trim()) {
      setItineraryState((s) => ({ ...s, error: 'Type a destination city first.' }))
      return
    }
    setItineraryState({ busy: true, data: null, error: '' })
    const travelerType =
      plan.traveler === 'solo' ? 'Solo' : plan.traveler === 'family' ? 'Family with kids' : 'Parents & elders'
    try {
      const res = await apiFetch('/api/ai/generate-itinerary', {
        method: 'POST',
        body: {
          home: plan.home,
          destination: plan.destination,
          duration: plan.duration,
          totalBudget: plan.totalBudget,
          travelers: plan.travelers,
          travelerType,
          travelMode: plan.travelMode,
          pace: plan.pace,
          startDate: plan.startDate,
          endDate: plan.endDate,
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate itinerary')
      setItineraryState({ busy: false, data: data.itinerary || null, error: '' })
    } catch (err) {
      setItineraryState({ busy: false, data: null, error: err.message })
    }
  }

  async function generateWeekendCalendar() {
    if (wcState.busy) return
    setWcState({ busy: true, error: '' })
    const travelerType =
      plan.traveler === 'solo' ? 'Solo' : plan.traveler === 'family' ? 'Family with kids' : 'Parents & elders'
    try {
      const res = await apiFetch('/api/ai/generate-weekend-calendar', {
        method: 'POST',
        body: {
          home: plan.home,
          slotTarget: plan.slotTarget,
          radius: plan.radius,
          weekendBudget: plan.weekendBudget,
          travelers: plan.travelers,
          travelerType,
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate weekend calendar')
      setPlan((p) => ({ ...p, weekendCalendar: data.weekendCalendar?.calendar || [] }))
      setWcState({ busy: false, error: '' })
    } catch (err) {
      setWcState({ busy: false, error: err.message })
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
            <p className="text-primary/70 text-xs font-semibold tracking-widest uppercase">
              {isDestination ? 'TripWise destination planner' : 'TripWise yearly planner'}
            </p>
            <h1 className="mt-3 max-w-2xl text-3xl leading-tight font-bold text-balance sm:text-5xl">
              {isDestination
                ? 'A single destination, planned perfectly.'
                : 'A beautiful plan, built around your real limits.'}
            </h1>
            <p className="text-primary/75 mt-4 max-w-xl text-base sm:text-lg">
              {isDestination
                ? 'Tell us where you are headed and how you like to travel. We will handle the rest.'
                : 'Set your budget, radius and travel style. Every suggestion honours those constraints.'}
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
                <input
                  type="text"
                  list="home-city-list"
                  value={plan.home}
                  onChange={(e) => update('home', e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Mumbai"
                />
                <datalist id="home-city-list">
                  {Object.keys(cities).map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </Field>

              <Field label="Trip type">
                <select value={plan.tripType} onChange={(e) => update('tripType', e.target.value)} className={selectClass}>
                  <option value="destination">Specific destination</option>
                  <option value="weekend">Weekend getaway</option>
                  <option value="vacation">Extended vacation</option>
                  <option value="both">Both</option>
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

              {isDestination && (
                <>
                  <Field label="Destination city">
                    <input
                      type="text"
                      list="destination-city-list"
                      value={plan.destination}
                      onChange={(e) => update('destination', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. Pune"
                    />
                    <datalist id="destination-city-list">
                      {destinations.map((d) => (
                        <option key={d.name} value={d.name} />
                      ))}
                    </datalist>
                  </Field>

                  <Field label="Start date">
                    <input
                      type="date"
                      value={plan.startDate}
                      onChange={(e) => update('startDate', e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="End date">
                    <input
                      type="date"
                      value={plan.endDate}
                      onChange={(e) => update('endDate', e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  {daysBetween(plan.startDate, plan.endDate) ? (
                    <Field label="Duration">
                      <div className="border-input bg-background text-foreground flex h-12 w-full items-center rounded-lg border border-border px-4 text-base">
                        {daysBetween(plan.startDate, plan.endDate)} days
                      </div>
                    </Field>
                  ) : (
                    <NumberInput
                      label="Duration (days)"
                      value={plan.duration}
                      min="1"
                      max="30"
                      onChange={(v) => update('duration', v)}
                    />
                  )}

                  <NumberInput
                    label="Total trip budget"
                    prefix="₹"
                    value={plan.totalBudget}
                    min="0"
                    step="1000"
                    onChange={(v) => update('totalBudget', v)}
                  />

                  <Field label="Travel mode">
                    <div className="mt-2 flex rounded-full bg-muted p-1">
                      {TRAVEL_MODES.map((m) => (
                        <Toggle
                          key={m.value}
                          active={plan.travelMode === m.value}
                          onClick={() => update('travelMode', m.value)}
                        >
                          {m.label}
                        </Toggle>
                      ))}
                    </div>
                  </Field>

                  <Field label="Pace / Vibe">
                    <div className="mt-2 flex rounded-full bg-muted p-1">
                      {PACES.map((p) => (
                        <Toggle
                          key={p.value}
                          active={plan.pace === p.value}
                          onClick={() => update('pace', p.value)}
                        >
                          {p.label}
                        </Toggle>
                      ))}
                    </div>
                  </Field>
                </>
              )}

              {!isDestination && plan.tripType !== 'vacation' && (
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

              {!isDestination && plan.tripType !== 'vacation' && (
              <NumberInput
                label="Weekend trips per year"
                value={plan.slotTarget}
                min="12"
                max="24"
                onChange={(v) => update('slotTarget', v)}
              />
              )}

              {!isDestination && plan.tripType !== 'vacation' && (
              <NumberInput
                label="Weekend budget (per trip)"
                prefix="₹"
                value={plan.weekendBudget}
                min="0"
                step="500"
                onChange={(v) => update('weekendBudget', v)}
              />
              )}

              {!isDestination && plan.tripType !== 'weekend' && (
              <NumberInput
                label="Major-trip budget"
                prefix="₹"
                value={plan.majorBudget}
                min="0"
                step="1000"
                onChange={(v) => update('majorBudget', v)}
              />
              )}

              {!isDestination && plan.tripType !== 'weekend' && (
              <NumberInput
                label="No. of major trips"
                value={plan.majorTripCount}
                min="1"
                max="12"
                onChange={(v) => update('majorTripCount', v)}
              />
              )}

              {!isDestination && (
              <NumberInput
                label="Total yearly budget"
                prefix="₹"
                value={plan.yearlyBudget}
                min="0"
                step="5000"
                onChange={(v) => update('yearlyBudget', v)}
              />
              )}

              {!isDestination && plan.tripType !== 'weekend' && (
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
          {isDestination ? (
            <div className="rounded-3xl bg-secondary p-6 sm:p-8">
              <SectionLabel>Your trip</SectionLabel>
              <h2 className="text-primary mt-1 text-2xl font-bold">
                {plan.destination || 'Specific destination'}
              </h2>
              <div className="bg-white/75 mt-4 rounded-2xl p-4">
                <div className="flex flex-col gap-3 text-sm">
                  <p className="text-primary flex justify-between gap-3">
                    <span className="text-muted-foreground">From</span>
                    <span className="font-medium">{plan.home || '—'}</span>
                  </p>
                  {plan.startDate && plan.endDate && (
                    <p className="text-primary flex justify-between gap-3">
                      <span className="text-muted-foreground">When</span>
                      <span className="font-medium">
                        {plan.startDate} → {plan.endDate}
                      </span>
                    </p>
                  )}
                  <p className="text-primary flex justify-between gap-3">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">
                      {daysBetween(plan.startDate, plan.endDate) || plan.duration} days
                    </span>
                  </p>
                  <p className="text-primary flex justify-between gap-3">
                    <span className="text-muted-foreground">Travel mode</span>
                    <span className="font-medium capitalize">{plan.travelMode}</span>
                  </p>
                  <p className="text-primary flex justify-between gap-3">
                    <span className="text-muted-foreground">Pace</span>
                    <span className="font-medium capitalize">{plan.pace}</span>
                  </p>
                  <p className="text-primary flex justify-between gap-3">
                    <span className="text-muted-foreground">Travellers</span>
                    <span className="font-medium">
                      {plan.travelers} {plan.traveler === 'family' ? '(family)' : plan.traveler === 'elders' ? '(elders)' : ''}
                    </span>
                  </p>
                  <p className="text-primary flex justify-between gap-3 border-t border-border pt-3">
                    <span className="text-muted-foreground">Total budget</span>
                    <span className="font-semibold">{money(plan.totalBudget)}</span>
                  </p>
                </div>
<div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={generateItinerary}
                  disabled={itineraryState.busy}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-6 text-sm leading-none font-semibold shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="size-4" />
                  {itineraryState.busy ? 'Planning your trip…' : 'Generate Itinerary'}
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="border-border bg-white hover:bg-accent text-primary inline-flex h-10 w-full items-center justify-center rounded-full border px-6 text-sm leading-none font-semibold transition-colors"
                >
                  Save this trip
                </button>
              </div>
              {itineraryState.busy && (
                <p className="text-muted-foreground mt-3 text-xs leading-4">
                  Building a personalized itinerary with transport, stays, activities and a budget breakdown…
                </p>
              )}
              {itineraryState.error && (
                <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-[#5c1a14]">
                  {itineraryState.error}
                </p>
              )}
            </div>
            </div>
          ) : (
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
              <div className="flex items-center justify-between gap-2">
                <SectionLabel>Weekend calendar</SectionLabel>
                <button
                  type="button"
                  onClick={generateWeekendCalendar}
                  disabled={wcState.busy}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-xs leading-none font-semibold shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="size-3.5" />
                  {wcState.busy ? 'Planning…' : 'Plan weekends with AI'}
                </button>
              </div>
              {wcState.busy && (
                <p className="text-muted-foreground mt-2 text-xs leading-4">
                  Fitting {plan.slotTarget} trips across 12 months with seasonality, radius and budget in mind…
                </p>
              )}
              {wcState.error && (
                <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-[#5c1a14]">
                  {wcState.error}
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(plan.weekendCalendar?.length ? plan.weekendCalendar : []).length > 0 &&
                  plan.weekendCalendar.map((month, index) => (
                    <div key={index} className="bg-white/75 text-primary min-h-28 rounded-2xl p-3">
                      <p className="text-primary/55 text-xs">
                        {month.month || months[index]}
                        {month.trips?.length > 1 ? ' · 2 trips' : ''}
                      </p>
                      {month.trips?.length ? (
                        month.trips.map((t, ti) => (
                          <div key={ti} className={ti > 0 ? 'border-border mt-2 border-t pt-2' : ''}>
                            <p className="text-primary mt-1 text-sm leading-tight font-bold">{t.destination}</p>
                            <p className="text-primary/70 text-xs">
                              {t.duration || '3 Days'} · {money(t.estimatedBudget)}
                              {t.distanceFromHome ? ` · ${Math.round(t.distanceFromHome)} km` : ''}
                            </p>
                            {t.vibe && <p className="text-primary/55 mt-0.5 text-[10px] leading-3">{t.vibe}</p>}
                          </div>
                        ))
                      ) : (
                        <p className="text-primary/50 mt-5 text-sm">Open slot</p>
                      )}
                    </div>
                  ))}

                {!plan.weekendCalendar?.length &&
                  plan.weekendSlots.slice(0, 12).map((slot, index) => (
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
          )}
        </section>

{!isDestination && (
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
        )}

        {isDestination && itineraryState.data && (
          <section className="mt-8 rounded-3xl bg-off-white p-6 sm:p-8">
            <ItineraryResult
              itinerary={itineraryState.data}
              destination={plan.destination}
              budget={plan.totalBudget}
            />
          </section>
        )}
      </div>
    </main>
  )
}
