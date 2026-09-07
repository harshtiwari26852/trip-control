const STRENGTH_CHECKS = [
  { test: (p) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p) => /[a-z]/.test(p), label: 'Lowercase letter' },
  { test: (p) => /[A-Z]/.test(p), label: 'Uppercase letter' },
  { test: (p) => /\d/.test(p), label: 'A number' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: 'A special character' },
]

export function getPasswordChecks(password = '') {
  return STRENGTH_CHECKS.map((c) => ({ ...c, passed: c.test(password) }))
}

export function getPasswordStrength(password = '') {
  const passed = STRENGTH_CHECKS.filter((c) => c.test(password)).length
  if (password.length === 0) return 0
  if (passed === STRENGTH_CHECKS.length) return 4
  if (passed >= 3) return 3
  if (passed >= 2) return 2
  return 1
}

export const STRENGTH_LABELS = { 1: 'Weak', 2: 'Fair', 3: 'Good', 4: 'Strong' }

export function isPasswordStrong(password = '') {
  return STRENGTH_CHECKS.every((c) => c.test(password))
}