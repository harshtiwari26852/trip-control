import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Sparkles, Trash2 } from 'lucide-react'
import { apiFetch } from '../lib/api'
import { formatDateRange, money, totalSpendForCalendar, tripsFromCalendar } from '../lib/planner'

const TRIP_TYPE_LABELS = {
  destination: 'Specific destination',
  weekend: 'Weekend getaway',
  major: 'Extended vacation',
  both: 'Weekend & major trips',
}

function planTitle(inputs) {
  const dest = inputs && inputs.destination
  if (dest && inputs && inputs.tripType === 'destination') return dest
  const label = TRIP_TYPE_LABELS[(inputs && inputs.tripType) || 'weekend']
  const view = inputs && inputs.mode === 'major' ? 'Major trips' : 'Weekend getaways'
  return `${label} · ${view}`
}

function planMeta(plan) {
  const trips = tripsFromCalendar(plan.calendar)
  const weekends = trips.filter((t) => t.kind === 'weekend').length
  const majors = trips.filter((t) => t.kind === 'major').length
  const spend = totalSpendForCalendar(plan.calendar)
  const inputs = plan.inputs || {}
  let range = ''
  if (inputs.tripType === 'destination' && inputs.startDate && inputs.endDate) {
    range = formatDateRange(inputs.startDate, inputs.endDate)
  } else if (plan.calendar && plan.calendar.year) {
    range = `${plan.calendar.year} yearly plan`
  }
  return { weekends, majors, spend, range }
}

function formatSavedDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SavedPlans() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/plans')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (!data.ok) throw new Error(data.error || 'Could not load your saved plans.')
        setPlans(data.plans || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function remove(id) {
    setDeleting(id)
    setError('')
    try {
      const res = await apiFetch(`/api/plans/${id}`, { method: 'DELETE' })
      const data = res.status === 204 ? {} : await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not delete this plan.')
      setPlans((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(null)
    }
  }

  function open(plan) {
    navigate('/chat', { state: { planId: plan.id } })
  }

  return (
    <div className="bg-muted min-h-screen">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Link to="/" className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm font-medium">
          <ArrowLeft className="size-4" />
          Back home
        </Link>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-primary text-3xl font-bold">Saved plans</h1>
            <p className="text-muted-foreground mt-1 text-sm">Your saved trip plans, stored just for you.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/chat')}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center gap-2 rounded-full px-6 text-sm leading-none font-semibold transition-colors"
          >
            <Sparkles className="size-4" />
            Start planning
          </button>
        </div>

        {error && <p className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-[#5c1a14]">{error}</p>}

        {plans === null && !error && (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
            <p className="text-muted-foreground text-sm">Loading your plans…</p>
          </div>
        )}

        {plans !== null && plans.length === 0 && (
          <div className="mt-16 rounded-3xl border border-border bg-card p-10 text-center">
            <CalendarDays className="text-muted-foreground mx-auto size-10" />
            <h2 className="text-primary mt-4 text-xl font-bold">No saved plans yet</h2>
            <p className="text-muted-foreground mt-1 text-sm">Plan a trip and hit “Save plan” to keep it here.</p>
            <button
              type="button"
              onClick={() => navigate('/chat')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-full px-6 text-sm leading-none font-semibold transition-colors"
            >
              <Sparkles className="size-4" />
              Start planning
            </button>
          </div>
        )}

        {plans !== null && plans.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => {
              const meta = planMeta(plan)
              const title = planTitle(plan.inputs)
              return (
                <div key={plan.id} className="bg-card flex flex-col gap-4 rounded-3xl border border-border p-5">
                  <div>
                    <h2 className="text-primary truncate text-lg font-bold">{title}</h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {meta.range || 'Unnamed plan'} · Saved {formatSavedDate(plan.updated_at) || 'recently'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 font-semibold">
                      {meta.weekends} weekend{meta.weekends === 1 ? '' : 's'}
                    </span>
                    <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 font-semibold">
                      {meta.majors} major trip{meta.majors === 1 ? '' : 's'}
                    </span>
                    <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 font-semibold">{money(meta.spend)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                    <button
                      type="button"
                      onClick={() => open(plan)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-full px-5 text-xs leading-none font-semibold transition-colors"
                    >
                      Open plan
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(plan.id)}
                      disabled={deleting === plan.id}
                      aria-label="Delete plan"
                      className="text-muted-foreground hover:text-red-600 inline-flex size-9 items-center justify-center rounded-full transition-colors disabled:opacity-40"
                    >
                      {deleting === plan.id ? (
                        <span className="border-primary inline-block size-3.5 animate-spin rounded-full border-2 border-t-transparent" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}