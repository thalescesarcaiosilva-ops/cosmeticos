'use client'

import { evaluatePasswordStrength } from '@/lib/auth/password-strength'

type PasswordStrengthProps = {
  password: string
}

const BAR_COLORS = ['bg-badge-discount', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-500', 'bg-green-500']

export function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null

  const { checks, score, label } = evaluatePasswordStrength(password)
  const bars = Math.max(1, Math.min(5, score))

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i < bars ? BAR_COLORS[bars - 1] : 'bg-border'}`}
          />
        ))}
      </div>
      <p className="text-xs text-text-muted">
        Força da senha: <span className="font-medium text-text-secondary">{label}</span>
      </p>
      <ul className="space-y-0.5">
        {checks.slice(0, 4).map((check) => (
          <li
            key={check.id}
            className={`text-xs ${check.passed ? 'text-green-600' : 'text-text-muted'}`}
          >
            {check.passed ? '✓' : '○'} {check.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
