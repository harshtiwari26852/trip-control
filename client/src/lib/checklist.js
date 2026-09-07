import { Calendar, Heart, MapPin, PlaneTakeoff, Users } from 'lucide-react'

export const CHECKLIST = [
  { key: 'whereTo', label: 'Where to', helper: "Let me inspire you if you don't know", Icon: MapPin },
  { key: 'whereFrom', label: 'Where from', helper: "I'll ask where you're setting off from", Icon: PlaneTakeoff },
  { key: 'who', label: "Who's coming", helper: "I'll ask who you're travelling with", Icon: Users },
  { key: 'when', label: "When you'd go", helper: "I'll ask when you'd like to travel", Icon: Calendar },
  { key: 'purpose', label: "What you're after", helper: "I'll ask what would make this trip yours", Icon: Heart },
]

export const CHECKLIST_KEYS = CHECKLIST.map((c) => c.key)