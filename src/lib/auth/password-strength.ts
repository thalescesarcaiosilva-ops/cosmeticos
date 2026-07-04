export type PasswordCheck = {
  id: string
  label: string
  passed: boolean
}

export type PasswordStrength = {
  checks: PasswordCheck[]
  score: number
  label: 'Fraca' | 'Razoável' | 'Boa' | 'Forte'
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const checks: PasswordCheck[] = [
    { id: 'length', label: 'Mínimo 8 caracteres', passed: password.length >= 8 },
    { id: 'upper', label: 'Letra maiúscula', passed: /[A-Z]/.test(password) },
    { id: 'lower', label: 'Letra minúscula', passed: /[a-z]/.test(password) },
    { id: 'number', label: 'Número', passed: /[0-9]/.test(password) },
    { id: 'special', label: 'Caractere especial (opcional)', passed: /[^A-Za-z0-9]/.test(password) },
  ]

  const required = checks.slice(0, 4)
  const passedRequired = required.filter((c) => c.passed).length
  const hasSpecial = checks[4]?.passed ?? false

  let score = passedRequired
  if (password.length >= 12) score += 1
  if (hasSpecial) score += 1

  const label: PasswordStrength['label'] =
    score <= 2 ? 'Fraca' : score === 3 ? 'Razoável' : score === 4 ? 'Boa' : 'Forte'

  return { checks, score: Math.min(score, 5), label }
}

export function isPasswordValid(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  )
}
