import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CalendarDays, RefreshCw, Save, Sparkles } from 'lucide-react'
import { apiFetch } from '../lib/api'
import { Field } from '../components/fields'
import TripDetailModal from '../components/TripDetailModal'
import {
  MONTH_NAMES,
  money,
  buildPlanCalendarRequest,
  lockedSlotsFromCalendar,
  totalSpendForCalendar,
  formatDateRange,
  durationDays,
} from '../lib/planner'

const PLAN_DEFAULTS = {
  home: 'Mumbai',
  tripType: 'weekend',
  mode: 'weekends',
  traveler: 'solo',
  travelers: 1,
  kidsAge: 7,
  radius: 300,
  slotTarget: 20,
  weekendBudget: 8000,
  majorBudget: 45000,
  majorTripCount: 1,
  yearlyBudget: 160000,
  durSlider: 7,
  destination: '',
  startDate: '',
  endDate: '',
  duration: 3,
  totalBudget: 20000,
  pace: 'balanced',
}

const PACES = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'action', label: 'Action-packed' },
]

const TRAVELER_TYPES = [
  { value: 'solo', label: 'Solo', travellers: 1 },
  { value: 'couple', label: 'Couple', travellers: 2 },
  { value: 'family', label: 'Family with kids', travellers: 4 },
  { value: 'friends', label: 'Friends group', travellers: 3 },
]

const inputClass =
  'border-input text-foreground h-12 w-full rounded-lg border border-border bg-background px-4 text-base outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/50'

const selectClass = `${inputClass} bg-white pr-10`

function tripConfigForGoal(goal) {
  if (goal === 'destination') return { tripType: 'destination', mode: 'weekends' }
  if (goal === 'weekend') return { tripType: 'weekend', mode: 'weekends' }
  if (goal === 'vacation') return { tripType: 'major', mode: 'major' }
  return { tripType: 'both', mode: 'weekends' }
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

function TripCard({ trip, busy, onOpen, onRegenerate }) {
  return (
    <div
      role="button"
      tabIndex="0"
      onClick={() => onOpen(trip)}
      className="hover:bg-white/60 group w-full cursor-pointer rounded-lg p-1 text-left transition-colors"
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-primary text-sm leading-tight font-bold">{trip.destination}</p>
        {onRegenerate && (
          <button
            type="button"
            aria-label="Re-plan this trip"
            onClick={(e) => {
              e.stopPropagation()
              onRegenerate(trip)
            }}
            disabled={busy}
            className="text-muted-foreground hover:text-primary -mt-0.5 -mr-1 shrink-0 rounded-full p-1 transition-colors disabled:opacity-40"
          >
            {busy ? (
              <span className="border-primary inline-block size-3 animate-spin rounded-full border-2 border-t-transparent" />
            ) : (
              <RefreshCw className="size-3" />
            )}
          </button>
        )}
      </div>
      <p className="text-primary/70 text-xs">
        {formatDateRange(trip.start_date, trip.end_date) || `${trip.duration_days || 3} days`}
        {' · '}
        {trip.duration_days || 3}d · {money(trip.estimated_cost)}
      </p>
      <p className="text-primary/55 text-[10px] leading-3">
        {trip.kind === 'major' ? 'Major trip' : 'Weekend'}
        {trip.distance_km_from_home ? ` · ${Math.round(trip.distance_km_from_home)} km` : ''}
      </p>
      {trip.short_reason && (
        <p className="text-primary/55 mt-0.5 text-[10px] leading-3">{trip.short_reason}</p>
      )}
      <p className="text-primary group-hover:underline mt-1 inline-flex items-center gap-1 text-[10px] font-semibold underline-offset-2">
        View trip plan <span aria-hidden>→</span>
      </p>
    </div>
  )
}

function MonthCard({ month, busyId, onOpen, onRegenerate }) {
  const trips = month.weekend_trips || []
  const tripCount = trips.length + (month.major_trip ? 1 : 0)
  const has = tripCount > 0
  return (
    <div className="bg-white/75 text-primary min-h-28 rounded-2xl p-3">
      <div className="flex items-center justify-between gap-1">
        <p className="text-primary/55 text-xs font-semibold">
          {month.month_name || MONTH_NAMES[(month.month || 1) - 1] || ''}
        </p>
        {has && (
          <span className="bg-primary/10 text-primary/70 rounded-full px-2 py-0.5 text-[10px] font-semibold">
            {tripCount} trip{tripCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-col gap-1">
        {month.major_trip && (
          <TripCard
            trip={month.major_trip}
            busy={busyId === month.major_trip.window_id}
            onOpen={onOpen}
            onRegenerate={onRegenerate}
          />
        )}
        {trips.map((t) => (
          <TripCard
            key={t.trip_id || t.window_id}
            trip={t}
            busy={busyId === t.window_id}
            onOpen={onOpen}
            onRegenerate={onRegenerate}
          />
        ))}
        {!has && <p className="text-primary/50 mt-5 text-sm">Open slot</p>}
      </div>
    </div>
  )
}

export default function Planner() {
  const { state } = useLocation()
  const goal = state?.goal
  const planId = state?.planId
  const [plan, setPlan] = useState(() => ({ ...PLAN_DEFAULTS, ...tripConfigForGoal(goal) }))
  const [cities, setCities] = useState({})
  const [destinations, setDestinations] = useState([])
  const [calendar, setCalendar] = useState(null)
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [destinationError, setDestinationError] = useState('')
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [detailsData, setDetailsData] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const [catalogue, savedRes] = await Promise.all([
          fetch('/api/destinations').then((r) => r.json()),
          planId ? apiFetch(`/api/plans/${planId}`) : apiFetch('/api/plans/latest'),
        ])
        if (cancelled) return
        setCities(catalogue.cities || {})
        setDestinations(catalogue.destinations || [])
        if (savedRes.ok) {
          const data = await savedRes.json()
          const saved = data.plan
          if (saved && (saved.inputs || saved.calendar)) {
            const merged = { ...PLAN_DEFAULTS, ...(saved.inputs || {}) }
            if (goal && !planId) {
              const cfg = tripConfigForGoal(goal)
              merged.tripType = cfg.tripType
              merged.mode = cfg.mode
            }
            setPlan(merged)
            if (saved.calendar && Array.isArray(saved.calendar.months)) {
              setCalendar(saved.calendar)
              setStatus(planId ? 'Opened your saved plan.' : 'Restored your last saved plan.')
            } else if (planId && merged.tripType === 'destination' && saved.details) {
              const days = durationDays(merged.startDate, merged.endDate) || merged.duration || 3
              setDetailsData(saved.details)
              setSelectedTrip({
                trip_id: planId,
                window_id: planId,
                kind: days === 3 ? 'weekend' : 'major',
                destination: merged.destination,
                start_date: merged.startDate,
                end_date: merged.endDate,
                duration_days: days,
                estimated_cost: merged.totalBudget,
              })
              setStatus('Opened your saved destination plan.')
            }
          }
        } else if (planId) {
          setStatus('Could not load that saved plan.')
        }
      } catch {
        if (!cancelled) setStatus('Could not load saved data. Please refresh and try again.')
      }
    }
    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, planId])

  const isDestination = plan.tripType === 'destination'
  const destDuration = durationDays(plan.startDate, plan.endDate)
  const calendarMonths = calendar?.months || []
  const travelerLabel = (TRAVELER_TYPES.find((t) => t.value === plan.traveler) || {}).label || plan.traveler
  const spend = calendar?.summary ? calendar.summary.total_estimated_cost : calendar ? totalSpendForCalendar(calendar) : 0
  const yearlyBudget = calendar?.summary?.total_yearly_budget ?? plan.yearlyBudget
  const overBudget = spend > yearlyBudget
  const pct = yearlyBudget ? Math.min(100, (spend / yearlyBudget) * 100) : 0

  function update(key, value) {
    setPlan((p) => {
      let next = { ...p, [key]: value }
      if (key === 'tripType') {
        if (value === 'weekend' || value === 'destination') next.mode = 'weekends'
        else if (value === 'major') next.mode = 'major'
      }
      if (next.tripType === 'weekend') {
        if (key === 'weekendBudget' || key === 'slotTarget') {
          next.yearlyBudget = next.weekendBudget * next.slotTarget
        } else if (key === 'yearlyBudget') {
          next.weekendBudget = next.slotTarget ? Math.round(next.yearlyBudget / next.slotTarget) : 0
        }
      } else if (next.tripType === 'major') {
        if (key === 'majorBudget' || key === 'majorTripCount') {
          next.yearlyBudget = next.majorBudget * next.majorTripCount
        } else if (key === 'yearlyBudget') {
          next.majorBudget = next.majorTripCount ? Math.round(next.yearlyBudget / next.majorTripCount) : 0
        }
      } else if (next.tripType === 'both') {
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

  function travelerChange(value) {
    const type = TRAVELER_TYPES.find((t) => t.value === value) || TRAVELER_TYPES[0]
    setPlan((p) => ({ ...p, traveler: value, travelers: type.travellers }))
  }

  async function generateCalendar(lockedSlots = []) {
    if (busy) return
    setBusy(true)
    setError('')
    setDestinationError('')
    try {
      const body = buildPlanCalendarRequest(plan, lockedSlots)
      const res = await apiFetch('/api/plan-calendar', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) {
        const detail = data?.errors?.length ? ` ${data.errors.join(' ')}` : ''
        throw new Error(`${data.error || 'Could not generate the plan.'}${detail}`)
      }
      setCalendar(data)
      setSelectedTrip(null)
      setStatus(lockedSlots.length ? 'Slot re-planned — your other trips were kept.' : 'Your yearly plan is ready.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setBusyId(null)
    }
  }

  function regenerateSlot(trip) {
    if (busy || !calendar) return
    const windowId = trip?.window_id || trip?.trip_id
    setBusyId(windowId)
    generateCalendar(lockedSlotsFromCalendar(calendar, windowId))
  }

  function openTrip(trip) {
    setDetailsData(null)
    setSelectedTrip(trip)
  }

  async function handleSaveFromModal(details) {
    if (isDestination) {
      const res = await apiFetch('/api/plans', { method: 'POST', body: { inputs: plan, calendar: null, details } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save your plan.')
      setStatus('Destination plan saved.')
      return
    }
    if (!calendar) throw new Error('Generate a calendar before saving.')
    const res = await apiFetch('/api/plans', { method: 'POST', body: { inputs: plan, calendar } })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Could not save your plan.')
    setStatus('Plan saved.')
  }

  async function savePlan() {
    if (isDestination) {
      if (!plan.destination.trim()) {
        setStatus('Type a destination city first.')
        return
      }
      if (!plan.startDate || !plan.endDate) {
        setStatus('Pick valid start and end dates before saving.')
        return
      }
      setStatus('Saving…')
      try {
        const res = await apiFetch('/api/plans', { method: 'POST', body: { inputs: plan, calendar: null } })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not save your plan.')
        setStatus('Destination plan saved.')
      } catch {
        setStatus('Could not save your plan.')
      }
      return
    }
    if (!calendar) {
      setStatus('Generate a calendar before saving.')
      return
    }
    setStatus('Saving…')
    try {
      const res = await apiFetch('/api/plans', { method: 'POST', body: { inputs: plan, calendar } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save your plan.')
      setStatus('Plan saved.')
    } catch {
      setStatus('Could not save your plan.')
    }
  }

  function openDestinationTrip() {
    setDestinationError('')
    if (!plan.destination.trim()) {
      setDestinationError('Type a destination city first.')
      return
    }
    if (!destDuration || destDuration < 1) {
      setDestinationError('Pick valid start and end dates.')
      return
    }
    if (destDuration > 10) {
      setDestinationError('Trip details are planned for up to 10 days. Shorten your date range.')
      return
    }
    const kind = destDuration === 3 ? 'weekend' : 'major'
    const id = `dest-${Date.now()}`
    setDetailsData(null)
    setSelectedTrip({
      trip_id: id,
      window_id: id,
      kind,
      destination: plan.destination.trim(),
      start_date: plan.startDate,
      end_date: plan.endDate,
      duration_days: destDuration,
      estimated_cost: plan.totalBudget,
    })
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
        {error && (
          <p className="mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-[#5c1a14]">{error}</p>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-3xl bg-background p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <SectionLabel>Your preferences</SectionLabel>
                <h2 className="text-primary mt-1 text-2xl font-bold">Trip constraints</h2>
              </div>
              <button
                onClick={savePlan}
                disabled={busy}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-sm leading-none font-semibold shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="size-4" />
                Save plan
              </button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {isDestination ? (
                <>
                  <div className="sm:col-span-2">
                    <Field label="Trip type">
                      <select value={plan.tripType} onChange={(e) => update('tripType', e.target.value)} className={selectClass}>
                        <option value="destination">Specific destination</option>
                        <option value="weekend">Weekend getaway</option>
                        <option value="major">Extended vacation</option>
                        <option value="both">Both</option>
                      </select>
                    </Field>
                  </div>
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

                  <Field label="Destination city">
                    <input
                      type="text"
                      list="destination-city-list"
                      value={plan.destination}
                      onChange={(e) => update('destination', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. Goa"
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

                  <Field label="Traveller type">
                    <select value={plan.traveler} onChange={(e) => travelerChange(e.target.value)} className={selectClass}>
                      {TRAVELER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {destDuration >= 1 ? (
                    <Field label="Duration">
                      <div className="border-input bg-background text-foreground flex h-12 w-full items-center rounded-lg border border-border px-4 text-base">
                        {destDuration} {destDuration === 1 ? 'day' : 'days'} · {destDuration < 3 ? 'short trip' : destDuration === 3 ? 'weekend plan' : 'extended plan'}
                      </div>
                    </Field>
                  ) : (
                    <Field label="Duration">
                      <div className="border-input bg-muted text-muted-foreground flex h-12 w-full items-center rounded-lg border border-border px-4 text-base">
                        Pick start and end dates
                      </div>
                    </Field>
                  )}

                  <NumberInput
                    label="Trip budget"
                    prefix="₹"
                    value={plan.totalBudget}
                    min="0"
                    step="1000"
                    onChange={(v) => update('totalBudget', v)}
                  />

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

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={openDestinationTrip}
                      disabled={busy}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-6 text-sm leading-none font-semibold shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles className="size-4" />
                      Plan this trip
                    </button>
                    {destinationError && (
                      <p className="mt-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-[#5c1a14]">
                        {destinationError}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
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
                      <option value="major">Extended vacation</option>
                      <option value="both">Both</option>
                    </select>
                  </Field>

                  <Field label="Traveller type">
                    <select value={plan.traveler} onChange={(e) => travelerChange(e.target.value)} className={selectClass}>
                      {TRAVELER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
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

                  {plan.tripType !== 'major' && (
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

                  {plan.tripType !== 'major' && (
                    <NumberInput
                      label="Weekend trips per year"
                      value={plan.slotTarget}
                      min="1"
                      max="24"
                      onChange={(v) => update('slotTarget', v)}
                    />
                  )}

                  {plan.tripType !== 'major' && (
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
                </>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-secondary p-6 sm:p-8">
            {isDestination ? (
              <>
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
                    <p className="text-primary flex justify-between gap-3">
                      <span className="text-muted-foreground">Destination</span>
                      <span className="font-medium">{plan.destination || '—'}</span>
                    </p>
                    {plan.startDate && plan.endDate && (
                      <p className="text-primary flex justify-between gap-3">
                        <span className="text-muted-foreground">When</span>
                        <span className="font-medium">
                          {formatDateRange(plan.startDate, plan.endDate)}
                        </span>
                      </p>
                    )}
                    <p className="text-primary flex justify-between gap-3">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium">
                        {destDuration || plan.duration} {(destDuration || plan.duration) === 1 ? 'day' : 'days'}
                      </span>
                    </p>
                    <p className="text-primary flex justify-between gap-3">
                      <span className="text-muted-foreground">Pace</span>
                      <span className="font-medium capitalize">{plan.pace}</span>
                    </p>
                    <p className="text-primary flex justify-between gap-3">
                      <span className="text-muted-foreground">Travellers</span>
                      <span className="font-medium">
                        {plan.travelers} · {travelerLabel}
                      </span>
                    </p>
                    <p className="text-primary flex justify-between gap-3 border-t border-border pt-3">
                      <span className="text-muted-foreground">Total budget</span>
                      <span className="font-semibold">{money(plan.totalBudget)}</span>
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground mt-4 text-xs leading-4">
                  Click “Plan this trip” to build a detailed itinerary with transport, stays, activities and a
                  budget breakdown.
                </p>
              </>
            ) : (
              <>
                <SectionLabel>Budget tracker</SectionLabel>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-primary text-2xl font-bold">
                    {money(spend)}{' '}
                    <span className="text-primary/60 text-base font-normal">of {money(yearlyBudget)}</span>
                  </h2>
                  {overBudget && <span className="text-red-600 text-xs font-semibold">Over budget</span>}
                </div>
                <div className="bg-white/60 mt-3 h-3 overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full ${overBudget ? 'bg-red-500' : 'bg-primary'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-muted-foreground mt-2 flex flex-wrap justify-between gap-2 text-xs">
                  <span>
                    {calendar?.summary?.total_weekend_trips ?? 0} weekend trips ·{' '}
                    {calendar?.summary?.total_major_trips ?? 0} major trips
                  </span>
                  <span>{money(calendar?.summary?.budget_remaining ?? yearlyBudget)} left</span>
                </div>

                {calendar?.warnings?.length ? (
                  <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-900">Heads up</p>
                    <ul className="mt-1 flex flex-col gap-1 text-xs leading-relaxed text-amber-800">
                      {calendar.warnings.map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => generateCalendar()}
                    disabled={busy}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-sm leading-none font-semibold shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="size-4" />
                    {busy ? 'Planning…' : calendar ? 'Re-plan calendar' : 'Plan my year with AI'}
                  </button>
                  <button
                    type="button"
                    onClick={savePlan}
                    disabled={busy || !calendar}
                    className="border-border bg-white hover:bg-accent text-primary inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border px-6 text-sm leading-none font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="size-4" />
                    Save plan
                  </button>
                </div>

                <div className="mt-7">
                  <div className="flex items-center justify-between gap-2">
                    <SectionLabel>Year calendar</SectionLabel>
                    <CalendarDays className="text-primary/50 size-4" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {calendarMonths.length
                      ? calendarMonths.map((month, i) => (
                          <MonthCard
                            key={month.month ?? i}
                            month={month}
                            busyId={busyId}
                            onOpen={openTrip}
                            onRegenerate={regenerateSlot}
                          />
                        ))
                      : MONTH_NAMES.map((name, i) => (
                          <div key={i} className="bg-white/75 text-primary min-h-28 rounded-2xl p-3">
                            <p className="text-primary/55 text-xs">{name}</p>
                            <p className="text-primary/50 mt-5 text-sm">Open slot</p>
                          </div>
                        ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {selectedTrip && (
          <TripDetailModal
            trip={selectedTrip}
            home={plan.home}
            travellers={plan.travelers}
            traveler={plan.traveler}
            weekendBudget={isDestination ? plan.totalBudget : plan.weekendBudget}
            majorBudget={isDestination ? plan.totalBudget : plan.majorBudget}
            pace={isDestination ? plan.pace : undefined}
            initialData={detailsData}
            onSave={handleSaveFromModal}
            onClose={() => {
              setSelectedTrip(null)
              setDetailsData(null)
            }}
          />
        )}
      </div>
    </main>
  )
}