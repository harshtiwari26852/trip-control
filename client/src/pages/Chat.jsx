import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ChatInput from '../components/chat/ChatInput'
import MessageList from '../components/chat/MessageList'
import TripSidebar from '../components/chat/TripSidebar'
import { CHECKLIST_KEYS } from '../lib/checklist'
import { apiFetch } from '../lib/api'

const CITY_ALIASES = {
  bombay: 'Mumbai',
  mumbai: 'Mumbai',
  borivali: 'Borivali',
  thane: 'Thane',
  'navi mumbai': 'Navi Mumbai',
  bengaluru: 'Bengaluru',
  bangalore: 'Bengaluru',
  delhi: 'Delhi',
  newdelhi: 'Delhi',
  kolkata: 'Kolkata',
  calcutta: 'Kolkata',
  chennai: 'Chennai',
  madras: 'Chennai',
  pune: 'Pune',
  ahmedabad: 'Ahmedabad',
  hyderabad: 'Hyderabad',
  gurgaon: 'Gurgaon',
  gurugram: 'Gurgaon',
  noida: 'Noida',
}

function normalizeHome(raw) {
  if (!raw || typeof raw !== 'string') return 'Mumbai'
  let s = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  s = s.replace(
    /^(from|based in|starting from|heading from|leaving from|travelling from|traveling from|\bi.{0,1}m (?:from|based in)|\bwe.{0,1}re (?:from|based in)|\bin)\s+/,
    '',
  )
  if (!s) return 'Mumbai'
  if (CITY_ALIASES[s]) return CITY_ALIASES[s]
  return s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const REPLIES = {
  whereTo:
    "Nice choice! I'll base everything around that. Now, where are you setting off from?",
  whereFrom:
    "Got it. And who's coming along for the trip?",
  who: 'Perfect. When would you like to travel?',
  when:
    "Great timing. And what would make this trip yours — food, adventure, relaxation, a bit of everything?",
  purpose:
    "That's exactly what I needed. Your checklist is full — hit 'Generate my trip' and I'll build your itinerary now.",
}

let counter = 1
function nextId() {
  return counter++
}

export default function Chat() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const seedPrompt = state?.prompt

  const [messages, setMessages] = useState(() => [
    {
      id: nextId(),
      role: 'assistant',
      text: "Hi! I'm TripWise, your AI trip planner. Where are you dreaming of going?",
    },
  ])
  const [captured, setCaptured] = useState({})
  const [capturedKeys, setCapturedKeys] = useState([])
  const [typing, setTyping] = useState(false)
  const [phase, setPhase] = useState('planning')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [aiPlan, setAiPlan] = useState(null)
  const timerRef = useRef(null)

  function addAssistant(text) {
    setMessages((m) => [...m, { id: nextId(), role: 'assistant', text }])
  }

  function addUser(text) {
    setMessages((m) => [...m, { id: nextId(), role: 'user', text }])
  }

  function handleSend(text) {
    if (phase !== 'planning') return
    addUser(text)
    setTyping(true)
    const keyIdx = capturedKeys.length
    if (keyIdx >= CHECKLIST_KEYS.length) return
    const key = CHECKLIST_KEYS[keyIdx]

    setCaptured((prev) => ({ ...prev, [key]: text }))
    setCapturedKeys((prev) => [...prev, key])

    timerRef.current = setTimeout(() => {
      setTyping(false)
      addAssistant(REPLIES[key])
      if (key === 'purpose') {
        timerRef.current = setTimeout(() => {
          addAssistant("Whenever you're ready, press 'Generate my trip' in the sidebar.")
        }, 900)
      }
    }, 1300)
  }

  async function handleGenerate() {
    setPhase('generating')

    const purposeText = (captured.purpose || '').toLowerCase()
    let tripType = 'both'
    if (purposeText.includes('relax') || purposeText.includes('beach')) tripType = 'weekend'
    else if (purposeText.includes('adventure') || purposeText.includes('trek')) tripType = 'vacation'

    const travelersText = (captured.who || '').toLowerCase()
    let traveler = 'solo'
    let travelers = 1
    if (travelersText.includes('family') || travelersText.includes('kid')) {
      traveler = 'family'
      travelers = 3
    } else if (travelersText.includes('couple') || travelersText.includes('partner')) {
      traveler = 'solo'
      travelers = 2
    }

    const profile = {
      home: normalizeHome(captured.whereFrom),
      tripType,
      traveler,
      travelers,
      kidsAge: 7,
      radius: 300,
      slotTarget: 12,
      weekendBudget: 8000 * travelers,
      majorBudget: 45000 * travelers,
      yearlyBudget: 150000 * travelers,
      durSlider: 7,
    }

    try {
      const res = await apiFetch('/api/ai/generate-plan', {
        method: 'POST',
        body: profile,
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate plan')
      }

      setAiPlan(data.aiPlan)
      setPhase('ready')
    } catch (err) {
      setPhase('planning')
      addAssistant(`Sorry, I couldn't generate your plan: ${err.message}. You can try again.`)
    }
  }

  function handleSeeTrip() {
    navigate('/')
  }

  useEffect(() => {
    if (!seedPrompt) return
    const t = setTimeout(() => handleSend(seedPrompt), 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  const generating = phase !== 'planning'

  return (
    <div className="h-[calc(100dvh-3.5rem)] overflow-hidden">
      <div className="flex h-full overflow-hidden">
        <section className="flex min-w-0 flex-1 flex-col min-[1025px]:w-[33.33%] min-[1025px]:flex-none">
          <MessageList
            messages={messages}
            typing={typing}
            interactive={!generating}
            onSuggestion={handleSend}
            onToggleSidebar={() => setDrawerOpen(true)}
          />
          <ChatInput onSend={handleSend} disabled={generating} />
        </section>

        <div className="hidden min-w-0 flex-col min-[1025px]:flex min-[1025px]:w-[66.66%]">
          <TripSidebar
            captured={capturedKeys}
            phase={phase}
            onGenerate={handleGenerate}
            onSeeTrip={handleSeeTrip}
            aiPlan={aiPlan}
          />
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 min-[1025px]:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="absolute top-0 right-0 h-full w-full max-w-[420px]">
            <TripSidebar
              captured={capturedKeys}
              phase={phase}
              onGenerate={handleGenerate}
              onSeeTrip={handleSeeTrip}
              aiPlan={aiPlan}
            />
          </aside>
        </div>
      )}
    </div>
  )
}
