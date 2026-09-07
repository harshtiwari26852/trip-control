import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Menu, User, X } from 'lucide-react'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'

const NAV_LINKS = [
  { label: 'Plan', href: '/chat' },
  { label: 'Explore', href: '#' },
  { label: 'How it works', href: '#' },
]

function Avatar({ showChevron = true, onLogout }) {
  const { user } = useAuth()

  return (
    <div className="relative group">
      <button
        type="button"
        aria-label="Account"
        className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-full p-0"
      >
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F4F4F4] text-black text-xs font-bold">
          {user ? user.firstName?.charAt(0)?.toUpperCase() : <User className="size-4" />}
        </span>
        {showChevron && (
          <span className="absolute -right-0.5 bottom-0 rounded-full border border-background bg-muted p-px">
            <ChevronDown className="size-2.5 text-foreground" strokeWidth={2} />
          </span>
        )}
      </button>

      {user && (
        <div className="invisible group-hover:visible absolute top-full right-0 mt-2 w-48 rounded-xl border border-border bg-background shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-foreground truncate">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function Header() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isChat = pathname.startsWith('/chat')
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/')
  }

  if (isChat) {
    return (
      <nav className="bg-background fixed top-0 z-50 h-14 w-full">
        <div className="hidden h-full items-center justify-between px-6 sm:flex">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center overflow-clip rounded-full bg-secondary">
              <span className="text-sm font-bold text-primary">T</span>
            </div>
            <Link to="/" className="flex cursor-pointer items-center" aria-label="TripWise home">
              <Logo className="h-[22px] w-auto text-primary" />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/chat"
              className="border-input bg-background hover:bg-accent inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 text-sm leading-none font-medium shadow-xs transition-colors"
            >
              Plan a trip
            </Link>
            <Avatar onLogout={handleLogout} />
          </div>
        </div>

        <div className="flex h-full items-center justify-between gap-1 px-4 sm:hidden">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center overflow-clip rounded-full bg-secondary">
              <span className="text-sm font-bold text-primary">T</span>
            </div>
            <Link to="/" className="flex cursor-pointer items-center" aria-label="TripWise home">
              <Logo className="h-[22px] w-auto text-primary" />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Avatar showChevron={false} onLogout={handleLogout} />
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="bg-muted fixed top-0 z-50 w-full transition-all duration-300">
      <div className="hidden px-6 py-2.5 sm:block">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex cursor-pointer items-center" aria-label="TripWise home">
              <Logo className="h-[22px] w-auto text-primary" />
            </Link>
            <ul className="hidden items-center gap-6 lg:flex">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm font-medium text-foreground transition-colors hover:text-primary/70"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/chat"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-full px-6 text-lg leading-none font-medium shadow-xs transition-colors"
                >
                  Start planning
                </Link>
                <Avatar onLogout={handleLogout} />
              </>
            ) : (
              <>
                <Link
                  to="/signin"
                  className="border-input bg-muted hover:bg-accent inline-flex h-10 items-center justify-center rounded-full border px-5 text-[13px] leading-none font-semibold text-foreground transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-full px-6 text-lg leading-none font-medium shadow-xs transition-colors"
                >
                  Start planning
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="h-14 sm:hidden">
        <div className="flex h-full items-center justify-between gap-1 px-4">
          <Link to="/" className="flex cursor-pointer items-center" aria-label="TripWise home">
            <Logo className="h-[22px] w-auto text-primary" />
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/chat"
                  className="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center rounded-full px-5 text-[13px] leading-none font-semibold transition-colors hover:bg-primary/90"
                >
                  Start planning
                </Link>
                <Avatar showChevron={false} onLogout={handleLogout} />
              </>
            ) : (
              <>
                <Link
                  to="/signup"
                  className="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center rounded-full px-5 text-[13px] leading-none font-semibold transition-colors hover:bg-primary/90"
                >
                  Start planning
                </Link>
                <button
                  type="button"
                  aria-label="Menu"
                  aria-expanded={mobileOpen}
                  onClick={() => setMobileOpen((v) => !v)}
                  className="border-border bg-white hover:bg-accent inline-flex size-9 shrink-0 items-center justify-center rounded-full border p-0 shadow-sm transition-colors"
                >
                  {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
                </button>
              </>
            )}
          </div>
        </div>

        {mobileOpen && (
          <div className="bg-muted border-b border-border px-4 py-4">
            <ul className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-foreground block py-1 text-base font-medium transition-colors hover:text-primary/70"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </nav>
  )
}
