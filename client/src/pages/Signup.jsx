import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import AuthLayout from './AuthLayout'
import { Field, Input } from '../components/fields'
import { useAuth } from '../context/AuthContext'
import {
  getPasswordChecks,
  getPasswordStrength,
  STRENGTH_LABELS,
  isPasswordStrong,
} from '../lib/password'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Signup() {
  const navigate = useNavigate()
  const { signup } = useAuth()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const strength = getPasswordStrength(form.password)
  const checks = getPasswordChecks(form.password)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
    setServerError('')
  }

  function validate() {
    const next = {}
    if (!form.firstName.trim()) next.firstName = 'First name is required'
    if (!form.lastName.trim()) next.lastName = 'Last name is required'
    if (!form.email.trim()) next.email = 'Email is required'
    else if (!EMAIL_RE.test(form.email)) next.email = 'Enter a valid email address'
    if (!form.password) next.password = 'Password is required'
    else if (!isPasswordStrong(form.password))
      next.password = 'Password must be at least 8 characters and include upper/lowercase, a number and a special character'
    if (!form.confirmPassword) next.confirmPassword = 'Please confirm your password'
    else if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')
    if (!validate()) return

    setSubmitting(true)
    try {
      await signup({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword,
      })
      navigate('/signin')
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Plan trips with AI and perfect them with travel experts."
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {serverError && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {serverError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="First name" error={errors.firstName}>
            <Input
              type="text"
              autoComplete="given-name"
              placeholder="Jane"
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              aria-invalid={Boolean(errors.firstName)}
            />
          </Field>
          <Field label="Last name" error={errors.lastName}>
            <Input
              type="text"
              autoComplete="family-name"
              placeholder="Doe"
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              aria-invalid={Boolean(errors.lastName)}
            />
          </Field>
        </div>

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
              autoComplete="new-password"
              placeholder="Create a strong password"
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

        <Field label="Confirm password" error={errors.confirmPassword}>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={form.confirmPassword}
            onChange={(e) => update('confirmPassword', e.target.value)}
            aria-invalid={Boolean(errors.confirmPassword)}
          />
        </Field>

        {form.password.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-full rounded-full transition-colors ${
                      i <= strength
                        ? strength === 4
                          ? 'bg-[#5fa858]'
                          : strength === 3
                            ? 'bg-[#c28634]'
                            : 'bg-[#bb4d45]'
                        : 'bg-deep-purple-100'
                    }`}
                  />
                ))}
              </div>
              {strength > 0 && (
                <span className="text-sm font-medium leading-none text-muted-foreground">
                  {STRENGTH_LABELS[strength]}
                </span>
              )}
            </div>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {checks.map((c) => (
                <li
                  key={c.label}
                  className={`flex items-center gap-2 text-sm leading-none ${
                    c.passed ? 'text-[#28491f]' : 'text-muted-foreground'
                  }`}
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      c.passed ? 'bg-[#e3efe0]' : 'bg-deep-purple-50'
                    }`}
                  >
                    {c.passed ? '✓' : ''}
                  </span>
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="bg-primary text-primary-foreground inline-flex h-12 items-center justify-center rounded-full px-6 text-lg leading-none font-medium shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="text-primary mt-6 text-center text-base">
        Already have an account?{' '}
        <Link to="/signin" className="font-medium underline underline-offset-2 hover:opacity-70">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
