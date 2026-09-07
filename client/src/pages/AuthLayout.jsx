import { Link } from 'react-router-dom'
import Logo from '../components/Logo'

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted px-[clamp(37px,3.594vw,57px)] pt-28 pb-16">
      {/* Full-bleed lilac -> mauve vertical gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden bg-linear-to-b from-hero-gradient-top to-hero-gradient-bottom"
      >
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

      <div className="relative w-full max-w-[26rem]">
        <Link
          to="/"
          className="mb-8 flex items-center justify-center"
          aria-label="TripWise home"
        >
          <Logo className="h-[24px] w-auto text-primary" />
        </Link>

        <div className="rounded-3xl border border-border/60 bg-background p-8 shadow-lg sm:p-10">
          <h1 className="text-primary text-center text-[clamp(1.5rem,2.4vw,1.875rem)] leading-[1.15] font-bold text-balance">
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted-foreground mt-2 text-center text-base leading-[1.4]">
              {subtitle}
            </p>
          )}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}