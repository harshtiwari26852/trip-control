import {
  BedDouble,
  Check,
  MapPin,
  Plane,
  Route,
  Sparkles,
  Star,
} from 'lucide-react'
import { CHECKLIST, CHECKLIST_KEYS } from '../../lib/checklist'

function ProgressRing({ count }) {
  const R = 24
  const C = 2 * Math.PI * R
  const pct = count / CHECKLIST_KEYS.length
  return (
    <div className="relative size-[52px] shrink-0">
      <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
        <circle cx="26" cy="26" r="24" fill="none" stroke="#E7DBFD" strokeWidth="4" />
        <circle
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke="url(#trip-completion-ring)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
        <defs>
          <linearGradient id="trip-completion-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#BE9EF9" />
            <stop offset="100%" stopColor="#593993" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-primary text-base leading-none font-semibold">{count}</span>
        <span className="text-muted-foreground text-xs leading-none">/{CHECKLIST_KEYS.length}</span>
      </div>
    </div>
  )
}

function ChecklistRow({ item, done, isLast }) {
  const { label, helper, Icon } = item
  return (
    <div className="relative flex gap-3">
      {!isLast && (
        <span
          aria-hidden
          className={`bg-[#2A182E] absolute top-6 -bottom-1 left-[11px] w-px transition-opacity ${
            done ? 'opacity-30' : 'opacity-10'
          }`}
        />
      )}
      <div className="relative z-10 shrink-0">
        <div
          className={`flex size-6 items-center justify-center rounded-full transition-colors ${
            done
              ? 'bg-[#2A182E] border border-transparent'
              : 'border-[#2A182E]/25 bg-white/40 border border-dashed'
          }`}
        >
          {done ? (
            <Check className="size-3.5 text-background" strokeWidth={3} />
          ) : (
            <span className="bg-[#2A182E]/25 size-1 rounded-full" />
          )}
        </div>
      </div>
      <div className={`flex-1 pb-5 ${done ? 'opacity-70' : ''}`}>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="size-3.5" />
          <span className="text-xs font-medium tracking-wider uppercase">{label}</span>
        </div>
        <p className="text-muted-foreground mt-0.5 text-base leading-tight">{helper}</p>
      </div>
    </div>
  )
}

const LOADER_STEPS = [
  { Icon: Route, label: 'Optimizing your route, end to end', rotate: '-7.54deg', bg: 'bg-off-white', color: 'text-primary', x: -34 },
  { Icon: Plane, label: 'Scanning 2000+ airlines for best value', rotate: '0deg', bg: 'bg-dark-purple-900', color: 'text-background', x: -10 },
  { Icon: Star, label: 'Reading 1B+ reviews for you', rotate: '5.4deg', bg: 'bg-dark-purple-500', color: 'text-background', x: 14 },
  { Icon: BedDouble, label: 'Finding hotels with exclusive deals', rotate: '-7.43deg', bg: 'bg-off-white', color: 'text-primary', x: 38 },
]

function formatCurrency(num) {
  if (!num && num !== 0) return '—'
  return '₹' + Math.round(num).toLocaleString('en-IN')
}

function AiPlanResult({ aiPlan }) {
  if (!aiPlan) return null

  const weekendSlots = aiPlan.weekendSlots || []
  const majorTrip = aiPlan.majorTrip || null

  return (
    <div className="flex flex-col gap-6 overflow-y-auto p-6 text-left">
      {aiPlan.summary && (
        <div className="bg-off-white rounded-2xl p-4">
          <p className="text-primary text-sm leading-relaxed">{aiPlan.summary}</p>
        </div>
      )}

      {weekendSlots.length > 0 && (
        <div>
          <h4 className="text-primary mb-3 text-sm font-semibold tracking-wider uppercase">Weekend trips</h4>
          <div className="flex flex-col gap-2">
            {weekendSlots.map((slot, i) => (
              <div key={i} className="bg-off-white flex items-start gap-3 rounded-xl p-3">
                <span className="bg-secondary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    <span className="text-primary text-sm font-semibold">{slot.name}</span>
                    {slot.state && <span className="text-muted-foreground text-xs">· {slot.state}</span>}
                  </div>
                  {slot.reason && (
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{slot.reason}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{slot.days} days</span>
                    <span>{slot.month}</span>
                    <span className="font-medium text-primary">{formatCurrency(slot.cost)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {majorTrip && (
        <div>
          <h4 className="text-primary mb-3 text-sm font-semibold tracking-wider uppercase">Major trip</h4>
          <div className="bg-off-white rounded-xl p-4">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              <span className="text-primary font-semibold">{majorTrip.name}</span>
              {majorTrip.state && <span className="text-muted-foreground text-xs">· {majorTrip.state}</span>}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{majorTrip.days} days</span>
              <span>{majorTrip.month}</span>
              <span className="font-medium text-primary">{formatCurrency(majorTrip.cost)}</span>
            </div>
            {majorTrip.reason && (
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{majorTrip.reason}</p>
            )}
            {Array.isArray(majorTrip.itinerary) && majorTrip.itinerary.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2 tracking-wider uppercase">Day by day</p>
                <ol className="flex flex-col gap-1">
                  {majorTrip.itinerary.map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <span className="text-muted-foreground font-medium shrink-0">D{i + 1}:</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}

      {Array.isArray(aiPlan.mapSources) && aiPlan.mapSources.length > 0 && (
        <div>
          <h4 className="text-primary mb-2 text-xs font-semibold tracking-wider uppercase">Sources</h4>
          <div className="flex flex-wrap gap-1.5">
            {aiPlan.mapSources.map((src, i) => (
              <a
                key={i}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-dark-purple-50 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors hover:bg-dark-purple-100"
              >
                <MapPin className="size-3" />
                {src.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TripGenView({ phase, onSeeTrip, aiPlan }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative mb-12 flex min-h-11 items-center justify-center">
        <h3 className="text-primary text-2xl font-bold">{phase === 'ready' ? 'Your trip is ready' : 'Building your trip'}</h3>
      </div>

      {phase === 'generating' && (
        <div className="relative flex h-50 w-full items-center justify-center">
          {LOADER_STEPS.map((s, i) => (
            <div
              key={s.label}
              className="absolute w-1/4 max-w-48"
              style={{ zIndex: i, transform: `translateX(${s.x}px) rotate(${s.rotate})` }}
            >
              <div
                className={`${s.bg} flex aspect-[4/5] w-full items-center justify-center rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]`}
              >
                <s.Icon className={`${s.color} size-10`} strokeWidth={1.5} />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-primary mt-10 text-sm font-medium text-center opacity-70">
        {phase === 'ready' ? 'Tailored to everything you told me.' : 'Checking live prices and availability...'}
      </p>

      {phase === 'ready' && aiPlan && (
        <div className="mt-4 w-full max-w-lg">
          <AiPlanResult aiPlan={aiPlan} />
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onSeeTrip}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-full px-6 text-sm leading-none font-semibold shadow-xs transition-colors"
            >
              See my trip
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TripSidebar({ captured, phase, onGenerate, onSeeTrip, aiPlan }) {
  const count = captured.length
  const showGeneration = phase === 'generating' || phase === 'ready'

  return (
    <div className="bg-[#CDB3FF] flex h-full flex-col items-center justify-center overflow-y-auto p-8">
      <div className="flex w-full max-w-md flex-col gap-6">
        {showGeneration ? (
          <TripGenView phase={phase} onSeeTrip={onSeeTrip} aiPlan={aiPlan} />
        ) : (
          <>
            <div className="flex items-center gap-4">
              <ProgressRing count={count} />
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Trip checklist
                </span>
                <h3 className="text-primary text-xl font-semibold">Your trip is taking shape</h3>
                <span className="text-muted-foreground text-sm">
                  {count} of {CHECKLIST_KEYS.length} captured
                </span>
              </div>
            </div>

            <div className="flex flex-col">
              {CHECKLIST.map((item, i) => (
                <ChecklistRow
                  key={item.key}
                  item={item}
                  done={captured.includes(item.key)}
                  isLast={i === CHECKLIST.length - 1}
                />
              ))}
            </div>

            <div className="bg-off-white flex flex-col gap-3 rounded-2xl p-4">
              <button
                type="button"
                disabled={count < CHECKLIST_KEYS.length || phase !== 'planning'}
                onClick={onGenerate}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-6 text-lg leading-none font-medium shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="size-4" />
                Generate my trip
              </button>
              <p className="text-muted-foreground px-2 text-center text-xs leading-4">
                TripWise builds it now and fills anything you haven&apos;t covered — or keep chatting
                and she&apos;ll start once the checklist is full.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
