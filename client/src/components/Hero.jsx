import ChatPrompt from './ChatPrompt'

export default function Hero() {
  return (
    <div className="bg-muted">
      <div className="relative overflow-hidden">
        {/* Full-bleed lilac -> mauve vertical gradient */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden bg-linear-to-b from-hero-gradient-top to-hero-gradient-bottom"
        >
          {/* Decorative left blob */}
          <svg
            className="absolute top-0 left-0 h-auto w-[10.94%] min-w-16"
            viewBox="0 0 140 601"
            fill="none"
          >
            <path
              className="fill-dark-purple-700 opacity-15"
              d="M0 0 C44 120 96 160 140 140 V601 H0 Z"
            />
          </svg>
          {/* Decorative right blob */}
          <svg
            className="absolute top-0 right-0 h-auto w-[13.2%] min-w-20"
            viewBox="1111 0 169 701"
            fill="none"
          >
            <path
              className="fill-dark-purple-700 opacity-15"
              d="M1280 0 C1216 180 1150 260 1111 300 V701 H1280 Z"
            />
          </svg>
        </div>

        <section className="relative flex w-full items-center justify-center overflow-hidden px-[clamp(37px,3.594vw,57px)] pt-[clamp(96px,19.125vh,230px)] pb-[clamp(57px,11.25vh,135px)]">
          <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center">
            <h1 className="mx-auto max-w-[18.5em] px-3 text-center text-[clamp(1.5rem,6.9vw,2.25rem)] leading-[1.15] font-bold text-balance text-primary md:text-[clamp(2.25rem,4.36vw,4.75rem)]! mb-[clamp(20px,3.875vh,46px)]">
              Plan your trip with AI.
              <br />
              Perfect it with travel experts.
            </h1>
            <ChatPrompt />
          </div>
        </section>
      </div>
    </div>
  )
}
