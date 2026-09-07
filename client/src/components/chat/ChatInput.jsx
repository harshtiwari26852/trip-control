import { useRef, useState } from 'react'
import { ArrowUp, Paperclip } from 'lucide-react'

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('')
  const taRef = useRef(null)

  function autoResize(el) {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`
  }

  function submit() {
    const val = text.trim()
    if (!val || disabled) return
    onSend(val)
    setText('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }

  return (
    <div className="px-3 pb-2 md:px-4 lg:px-6">
      <div className="bg-muted relative w-full overflow-hidden rounded-2xl shadow-lg backdrop-blur-sm lg:rounded-4xl">
        <div className="border-input bg-background flex flex-col rounded-t-2xl rounded-b-none border lg:rounded-4xl">
          <div className="flex items-start gap-2 px-3 pt-4 md:px-4 md:pt-3.5 lg:px-6">
            <textarea
              ref={taRef}
              rows={1}
              value={text}
              disabled={disabled}
              onChange={(e) => {
                setText(e.target.value)
                autoResize(e.target)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder="Ask anything..."
              aria-label="Ask anything..."
              className="placeholder:text-muted-foreground max-h-[192px] min-h-[24px] w-full resize-none border-none bg-transparent py-0 text-base outline-none disabled:opacity-50"
              style={{ fontSize: '16px' }}
            />
          </div>
          <div className="flex items-center gap-1 px-2.5 pb-3 md:px-4">
            <button
              type="button"
              aria-label="Upload Documents"
              className="text-muted-foreground hover:bg-accent rounded-md p-2 transition-colors"
            >
              <Paperclip className="size-5" />
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={submit}
              disabled={disabled || !text.trim()}
              aria-label="Send"
              className="bg-[#AE86F7] text-foreground flex size-10 items-center justify-center rounded-3xl transition-all hover:brightness-90 disabled:cursor-not-allowed disabled:bg-[#AE86F750]"
            >
              <ArrowUp className="size-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
      <p className="text-[#7D7D84] mx-auto mt-4 mb-4 flex flex-row items-center gap-0.5 text-center text-xs leading-4 font-normal tracking-[-0.02em]">
        AI-assisted travel service. Check important{' '}
        <a className="cursor-pointer underline" href="#">
          info
        </a>
        .
      </p>
    </div>
  )
}