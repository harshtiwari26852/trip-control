import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import AuthLayout from './AuthLayout'
import { Field, Input } from '../components/fields'
import { useAuth } from '../context/AuthContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Signin() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
    setServerError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')
    const next = {}
    if (!form.email.trim()) next.email = 'Email is required'
    else if (!EMAIL_RE.test(form.email)) next.email = 'Enter a valid email address'
    if (!form.password) next.password = 'Password is required'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    try {
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to keep planning your next trip."
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {serverError && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {serverError}
          </p>
        )}

        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="jane@example.com"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <Field label="Password" error={errors.password}>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              aria-invalid={Boolean(errors.password)}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="bg-primary text-primary-foreground inline-flex h-12 items-center justify-center rounded-full px-6 text-lg leading-none font-medium shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="text-primary mt-6 text-center text-base">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="font-medium underline underline-offset-2 hover:opacity-70">
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}
