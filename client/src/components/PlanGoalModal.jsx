import { CalendarClock, MapPin, Palmtree, Plane, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const GOALS = [
  {
    id: 'destination',
    title: 'Specific Destination',
    subtitle: 'Explore it perfectly',
    Icon: MapPin,
  },
  {
    id: 'weekend',
    title: 'Weekend Getaway',
    subtitle: '3–4 days to recharge over a long weekend.',
    Icon: Palmtree,
  },
  {
    id: 'vacation',
    title: 'Extended Vacation',
    subtitle: '7+ days for your major annual trip.',
    Icon: Plane,
  },
  {
    id: 'both',
    title: 'Both',
    subtitle: 'Weekend Getaway + Extended Vacation',
    Icon: CalendarClock,
  },
]

export default function PlanGoalModal({ open, onClose }) {
  const navigate = useNavigate()

  if (!open) return null

  function choose(goal) {
    onClose()
    navigate('/chat', { state: { goal } })
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose your trip type"
    >
      <div
        className="bg-black/40 absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="bg-background relative w-full max-w-md rounded-3xl border border-border p-6 shadow-xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted-foreground hover:bg-accent absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full transition-colors"
        >
          <X className="size-4" />
        </button>
        <h2 className="text-primary text-2xl font-bold">What kind of trip are you planning?</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Pick a style and TripWise will tailor the planning from there.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {GOALS.map(({ id, title, subtitle, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => choose(id)}
              className="bg-card hover:border-ring hover:bg-accent/40 group flex w-full items-start gap-4 rounded-2xl border border-border p-4 text-left transition-colors"
            >
              <span className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-full">
                <Icon className="text-primary size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-primary block text-base leading-snug font-semibold">
                  {title}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-sm leading-snug">
                  {subtitle}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}