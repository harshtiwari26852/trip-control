import { useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'

const SUGGESTIONS = [
  'Plan a week-long trip to Paris with iconic landmarks and local cuisine.',
  'Design a 5-day Tokyo tour featuring modern and traditional culture.',
  'Create a Bali beach escape with resort relaxation.',
  'Arrange an Iceland adventure with scenic hikes and natural wonders.',
]

function TypingIndicator() {
  return (
    <div className="bg-muted text-primary flex max-w-[85%] items-center gap-1.5 rounded-2xl rounded-bl-sm px-4 py-3.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="bg-muted-foreground size-1.5 animate-bounce rounded-full"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}

function AssistantBubble({ children }) {
  return (
    <div className="flex items-end gap-2.5">
      <span className="bg-secondary flex size-7 shrink-0 items-center justify-center rounded-full">
        <Sparkles className="size-3.5 text-primary" aria-hidden />
      </span>
      <div className="bg-muted text-primary rounded-2xl rounded-bl-sm px-4 py-3 text-[15px] leading-[1.45] whitespace-pre-wrap">
        {children}
      </div>
    </div>
  )
}

export default function MessageList({ messages, typing, interactive, onSuggestion, onToggleSidebar }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Chat header strip */}
      <div className="border-b border-[#ededed] bg-[#fafafa] z-1 flex w-full items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="bg-secondary flex size-8 items-center justify-center rounded-full">
            <Sparkles className="size-4 text-primary" aria-hidden />
          </span>
          <div>
            <p className="text-primary text-sm leading-tight font-semibold">New trip</p>
            <p className="text-muted-foreground text-xs leading-tight">with TripWise</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleSidebar}
          className="border-input bg-background hover:bg-accent inline-flex h-8 items-center justify-center rounded-full border px-3 text-sm leading-none font-medium transition-colors min-[1025px]:hidden"
        >
          Trip checklist
        </button>
      </div>

      {/* Messages */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {messages.map((m) =>
            m.role === 'assistant' ? (
              <AssistantBubble key={m.id}>{m.text}</AssistantBubble>
            ) : (
              <div
                key={m.id}
                className="bg-primary text-primary-foreground ml-auto max-w-[80%] rounded-2xl rounded-br-sm px-4 py-3 text-[15px] leading-[1.45] shadow-sm whitespace-pre-wrap"
              >
                {m.text}
              </div>
            ),
          )}
          {typing && <TypingIndicator />}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts */}
      {interactive && (
        <div className="relative px-3 md:px-4 lg:px-6">
          <div className="flex w-full gap-2 overflow-x-auto pb-1 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSuggestion(s)}
                className="border-input bg-background text-foreground hover:bg-accent h-[38px] shrink-0 cursor-pointer rounded-full border px-4 text-sm leading-none whitespace-nowrap transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}