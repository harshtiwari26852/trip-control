import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Send } from 'lucide-react'

export default function ChatPrompt() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const prompt = value.trim()
    if (!prompt) return
    setValue('')
    navigate('/chat', { state: { prompt } })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-popover mx-auto flex w-full max-w-[clamp(37.5rem,46.875vw,51.5rem)] items-center gap-2 rounded-full py-2 pr-2 pl-6 shadow-lg"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Tell TripWise what you're imagining"
        aria-label="Tell TripWise what you're imagining"
        className="text-foreground placeholder:text-muted-foreground text-primary h-10 min-w-0 flex-1 bg-transparent text-base outline-none"
      />
      <Mic className="text-foreground size-5 shrink-0 opacity-70" aria-hidden />
      <button
        type="submit"
        aria-label="Send"
        className="bg-foreground text-background hover:bg-foreground/90 flex size-10 shrink-0 items-center justify-center rounded-full shadow-xs transition-transform hover:scale-105"
      >
        <Send className="size-4" strokeWidth={2} />
      </button>
    </form>
  )
}