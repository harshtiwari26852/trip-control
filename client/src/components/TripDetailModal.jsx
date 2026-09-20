import { useEffect, useRef, useState } from 'react'
import {
  Bus, Car, Hotel, MapPin, Plane, Route, Sparkles, TrainFront, X,
} from 'lucide-react'
import { apiFetch } from '../lib/api'
import { formatDateRange } from '../lib/planner'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'transport', label: 'Transport' },
  { key: 'stay', label: 'Where to stay' },
  { key: 'itinerary', label: 'Itinerary' },
  { key: 'cost', label: 'Cost breakdown' },
  { key: 'notes', label: 'Tips & packing' },
]

function money2(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `₹${Math.round(n).toLocaleString('en-IN')}` : '₹0'
}

function travelLabel(method) {
  const map = { flight: 'Flight', train: 'Train', drive: 'Drive', car: 'Drive', bus: 'Bus', walk: 'Walk' }
  return map[method] || method || ''
}

function transportIcon(method) {
  if (method === 'flight') return Plane
  if (method === 'train') return TrainFront
  if (method === 'bus') return Bus
  if (method === 'drive' || method === 'car') return Car
  return MapPin
}

function BlockTitle({ children }) {
  return <p className="text-primary text-base font-bold">{children}</p>
}
function MutedP({ children }) {
  return <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{children}</p>
}
function BulletList({ items }) {
  if (!items?.length) return null
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className="bg-secondary text-primary mt-0.5 flex size-1.5 shrink-0 rounded-full" />
          <span className="text-primary/85">{it}</span>
        </li>
      ))}
    </ul>
  )
}
function MoneyRows({ rows }) {
  if (!rows?.length) return null
  return (
    <div className="mt-3 flex flex-col gap-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{r.label}</span>
          <span className="text-primary font-semibold">{money2(r.amount)}</span>
        </div>
      ))}
    </div>
  )
}

export default function TripDetailModal({ trip, home, travellers, traveler, weekendBudget, majorBudget, travelMode, pace, onClose }) {
  const kind = (trip && trip.kind) || 'weekend'
  const destination = trip && trip.destination
  const [tab, setTab] = useState('overview')
  const [state, setState] = useState({ busy: true, data: null, error: '', regenerate: false })
  const scrollRef = useRef(null)

  useEffect(() => {
    setTab('overview')
    setState({ busy: true, data: null, error: '', regenerate: false })
    load(false, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip && trip.trip_id, trip && trip.window_id, home, destination, travellers, traveler])

  async function load(regenerate) {
    setState((s) => ({ ...s, busy: true, error: '', regenerate: !!regenerate }))
    try {
      const res = await apiFetch('/api/trip-details', {
        method: 'POST',
        body: {
          trip_id: trip.trip_id,
          kind,
          home_city: home,
          destination,
          start_date: trip.start_date,
          end_date: trip.end_date,
          duration_days: trip.duration_days || (kind === 'weekend' ? 3 : 7),
          traveller_type: traveler,
          travellers,
          currency: 'INR',
          budget: kind === 'weekend' ? weekendBudget : majorBudget,
          ...(travelMode ? { travel_mode: travelMode } : {}),
          ...(pace ? { pace } : {}),
          regenerate,
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load trip details')
      setState({ busy: false, data: data.details || data, error: '', regenerate: false })
    } catch (err) {
      setState({ busy: false, data: null, error: err.message, regenerate: false })
    }
  }

  if (!trip || !onClose) return null
  const d = state.data
  const overBudget = Boolean(d?.cost_breakdown && d.cost_breakdown.total > (kind === 'weekend' ? weekendBudget : majorBudget) && d.cost_breakdown.within_budget !== true)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button aria-label="Close" onClick={onClose} className="bg-black/40 absolute inset-0" />
      <div className="bg-background relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl shadow-2xl border border-border">
        <div className="bg-secondary px-5 py-4 sm:px-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                {kind === 'weekend' ? 'Weekend trip' : 'Major trip'}
              </p>
              <h2 className="text-primary mt-0.5 truncate text-2xl font-bold">{destination}</h2>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {formatDateRange(trip.start_date, trip.end_date)}
                {typeof trip.duration_days === 'number' ? ` · ${trip.duration_days}d` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => load(true)}
                disabled={state.busy}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="size-3.5" />
                Regenerate
              </button>
              <button aria-label="Close" type="button" onClick={onClose} className="text-muted-foreground hover:bg-muted inline-flex size-9 items-center justify-center rounded-full transition-colors">
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="overflow-y-auto p-5 sm:p-7">
          {state.busy && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
              <p className="text-muted-foreground text-sm">Building your {destination} plan…</p>
            </div>
          )}
          {state.error && (
            <div className="py-8 text-center">
              <p className="text-[#5c1a14] rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium">{state.error}</p>
              <button
                type="button"
                onClick={() => load(false)}
                className="bg-primary text-primary-foreground mt-4 inline-flex h-9 items-center rounded-full px-5 text-xs font-semibold"
              >
                Try again
              </button>
            </div>
          )}

          {d && tab === 'overview' && (
            <div className="flex flex-col gap-4">
              <BlockTitle>{d.overview?.summary || destination}</BlockTitle>
              {d.overview?.highlights?.length ? <BulletList items={d.overview.highlights} /> : null}
              {d.overview?.best_time && <MutedP>Best time: {d.overview.best_time}</MutedP>}
              {kind === 'major' && d.multi_stop_route?.length ? (
                <div className="border-border/70 rounded-2xl border p-4">
                  <BlockTitle>Multi-stop route</BlockTitle>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {d.multi_stop_route.map((stop, i) => (
                      <span key={i} className="flex items-center gap-1.5 text-sm">
                        <span className="text-primary font-semibold">{stop}</span>
                        {i < d.multi_stop_route.length - 1 && <Route className="text-muted-foreground size-3.5" />}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {d && tab === 'transport' && (
            <div className="flex flex-col gap-4">
              <BlockTitle>Getting there</BlockTitle>
              {d.transport?.options?.length ? (
                <div className="flex flex-col gap-3">
                  {d.transport.options.map((o, i) => {
                    const Icon = transportIcon(o.method)
                    return (
                      <div key={i} className="flex items-start gap-3 rounded-2xl border border-border p-4">
                        <span className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <BlockTitle>{travelLabel(o.method)}</BlockTitle>
                            {o.estimated_cost > 0 && <span className="text-primary text-xs font-semibold">{money2(o.estimated_cost)}</span>}
                          </div>
                          {o.duration && <MutedP>{o.duration}</MutedP>}
                          {o.description && <MutedP>{o.description}</MutedP>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <MutedP>No transport options available.</MutedP>
              )}
              {d.transport?.recommended_mode && (
                <div className="bg-secondary rounded-2xl px-4 py-3 text-sm">
                  <span className="text-primary font-semibold">Recommended: </span>
                  <span className="text-primary/85">{d.transport.recommended_mode}</span>
                </div>
              )}
            </div>
          )}

          {d && tab === 'stay' && (
            <div className="flex flex-col gap-4">
              <BlockTitle>Where to stay</BlockTitle>
              {d.stay?.options?.length ? (
                <div className="flex flex-col gap-3">
                  {d.stay.options.map((o, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-2xl border border-border p-4">
                      <span className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                        <Hotel className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <BlockTitle>{o.name}</BlockTitle>
                          {o.estimated_cost > 0 && <span className="text-primary text-xs font-semibold">{money2(o.estimated_cost)}/night</span>}
                        </div>
                        {o.description && <MutedP>{o.description}</MutedP>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <MutedP>No stay options available.</MutedP>
              )}
            </div>
          )}

          {d && tab === 'itinerary' && (
            <div className="flex flex-col gap-3">
              {d.itinerary?.length ? (
                d.itinerary.map((day, i) => (
                  <div key={i} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="bg-secondary text-primary flex size-8 items-center justify-center rounded-full text-sm font-bold">
                        {day.day || i + 1}
                      </span>
                      {day.date && <span className="text-muted-foreground text-xs">{day.date}</span>}
                      {day.theme && <span className="text-primary/70 text-xs font-semibold uppercase">{day.theme}</span>}
                    </div>
                    <div className="mt-3 flex flex-col gap-3">
                      {['morning', 'afternoon', 'evening'].map((slot) => {
                        const acts = day[slot]
                        if (!acts?.length) return null
                        return (
                          <div key={slot}>
                            <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest">{slot}</p>
                            <div className="mt-1 flex flex-col gap-1.5">
                              {acts.map((a, ai) => (
                                <div key={ai} className="flex items-start gap-2 text-sm">
                                  <span className="text-muted-foreground mt-1 size-1 shrink-0 rounded-full bg-current" />
                                  <div>
                                    <p className="text-primary font-semibold">{a.activity}</p>
                                    {a.details && <p className="text-muted-foreground text-xs">{a.details}</p>}
                                    {a.estimated_cost > 0 && <p className="text-primary text-xs font-semibold">{money2(a.estimated_cost)}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <MutedP>No itinerary available.</MutedP>
              )}
            </div>
          )}

          {d && tab === 'cost' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-2xl border border-border p-4">
                <span className="text-muted-foreground text-sm">Estimated total</span>
                <span className={`text-base font-bold ${overBudget ? 'text-red-600' : 'text-primary'}`}>
                  {money2(d.cost_breakdown?.total)}
                </span>
              </div>
              <MoneyRows rows={(d.cost_breakdown?.breakdown || []).map((row) => ({ label: row.label, amount: row.amount }))} />
              {overBudget && (
                <p className="bg-red-50 text-[#5c1a14] rounded-2xl px-4 py-3 text-sm font-medium">
                  This plan is over the per-trip budget. Use “Regenerate” for a plan within budget.
                </p>
              )}
            </div>
          )}

          {d && tab === 'notes' && (
            <div className="flex flex-col gap-4">
              {d.packing_list?.length ? (
                <div>
                  <BlockTitle>Packing list</BlockTitle>
                  <BulletList items={d.packing_list} />
                </div>
              ) : null}
              {d.safety_and_tips?.length ? (
                <div>
                  <BlockTitle>Safety & tips</BlockTitle>
                  <BulletList items={d.safety_and_tips} />
                </div>
              ) : null}
              {d.booking_notes ? (
                <div>
                  <BlockTitle>Booking notes</BlockTitle>
                  <MutedP>{d.booking_notes}</MutedP>
                </div>
              ) : null}
              {!d.packing_list?.length && !d.safety_and_tips?.length && !d.booking_notes ? (
                <MutedP>No additional notes available.</MutedP>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
