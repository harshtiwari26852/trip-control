import { createContext, useContext, useEffect, useState } from 'react'
import { apiFetch, resetCsrf } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.errors ? data.errors[0] : 'Login failed')
    }
    setUser(data.user)
    return data.user
  }

  async function signup({ firstName, lastName, email, password, confirmPassword }) {
    const res = await apiFetch('/api/auth/signup', {
      method: 'POST',
      body: { firstName, lastName, email, password, confirmPassword },
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.errors ? data.errors[0] : 'Signup failed')
    }
    return data
  }

  async function logout() {
    const res = await apiFetch('/api/auth/logout', { method: 'POST' })
    if (res.ok) {
      setUser(null)
      resetCsrf()
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
