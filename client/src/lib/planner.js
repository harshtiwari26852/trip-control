// Shared planner helpers: conversion of the client's plan form to the server's
// calendar request shape, locked-slot bookkeeping for single-slot regenerate,
// and the small formatting utilities used by the planner calendar cards.

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '₹0'
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

export const INR = (v) => money(v)

// Client trip-type values: destination | weekend | majors (big vacation) | both.
export function modeForGoal(goal) {
  if (goal === 'weekend') return 'weekend'
  if (goal === 'major') return 'major'
  if (goal === 'both') return 'both'
  return 'weekend'
}

export function tripTypeForMode(mode) {
  if (mode === 'weekends') return 'weekend'
  if (mode === 'major' || mode === 'weekend') return 'both'
  return 'both'
}

export function plannerViewForMode(mode) {
  return mode === 'major' ? 'major' : 'weekends'
}

// Build the request body consumed by /api/plan-calendar from the client plan.
// locked_slots are derived from the current calendar (excluding the slot being
// regenerated when one is reloading).
export function buildPlanCalendarRequest(plan, lockedSlots = []) {
  return {
    year: new Date().getFullYear(),
    home_city: plan.home,
    trip_type: plan.tripType === 'destination' ? 'weekend' : plan.tripType,
    planner_view: plan.mode === 'major' ? 'major' : 'weekends',
    traveller_type: plan.traveler,
    travellers: plan.travelers,
    currency: 'INR',
    weekend: {
      radius_km: plan.radius,
      trips_per_year: plan.slotTarget,
      budget_per_trip: plan.weekendBudget,
      duration_days: 3,
    },
    major: {
      count: plan.majorTripCount || 0,
      budget_per_trip: plan.majorBudget,
      duration_days: plan.durSlider || 7,
    },
    total_yearly_budget: plan.yearlyBudget,
    locked_slots: lockedSlots,
  }
}

export function buildTripDetailsRequest(plan, trip) {
  const kind = trip.kind || 'weekend'
  return {
    trip_id: trip.trip_id,
    kind,
    home_city: plan.home,
    destination: trip.destination,
    start_date: trip.start_date,
    end_date: trip.end_date,
    duration_days: trip.duration_days || (kind === 'weekend' ? 3 : 7),
    traveller_type: plan.traveler,
    travellers: plan.travelers,
    currency: 'INR',
    budget: kind === 'weekend' ? plan.weekendBudget : plan.majorBudget,
  }
}

function tripsInMonth(month) {
  const weekend = (month.weekend_trips || []).map((t) => ({ ...t, kind: 'weekend' }))
  return month.major_trip ? [...weekend, { ...month.major_trip, kind: 'major' }] : weekend
}

export function tripsFromCalendar(calendar) {
  if (!calendar?.months) return []
  return calendar.months.flatMap((month) => tripsInMonth(month))
}

// Build the locked_slots payload for /api/trip-details's locked_slots option, or
// for a full regenerate (excludeWindowId filters the slot being regenerated).
export function lockedSlotsFromCalendar(calendar, excludeWindowId = null) {
  return tripsFromCalendar(calendar)
    .filter((t) => t.window_id !== excludeWindowId)
    .map((t) => ({
      window_id: t.window_id,
      kind: t.kind,
      destination: t.destination,
      start_date: t.start_date,
      end_date: t.end_date,
      estimated_cost: t.estimated_cost ?? t.cost,
    }))
}

export function totalSpendForCalendar(calendar) {
  return tripsFromCalendar(calendar).reduce(
    (sum, t) => sum + (Number(t.estimated_cost ?? t.cost) || 0),
    0,
  )
}

export function formatDateRange(start, end) {
  if (!start) return ''
  const s = new Date(`${start}T00:00:00`)
  const e = end ? new Date(`${end}T00:00:00`) : new Date(s)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return start || ''
  const sm = MONTH_NAMES[s.getMonth()]
  const em = MONTH_NAMES[e.getMonth()]
  if (sm === em) return `${s.getDate()}–${e.getDate()} ${sm}`
  return `${s.getDate()} ${sm} – ${e.getDate()} ${em}`
}

export function durationDays(start, end) {
  if (!start || !end) return 0
  const a = new Date(`${start}T00:00:00`)
  const b = new Date(`${end}T00:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  return Math.round((b - a) / 86400000) + 1
}
