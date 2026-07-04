'use client'

import { forwardRef, useState } from 'react'
import { IconEye, IconEyeOff } from '@/components/icons/DotIcons'

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
  error?: string
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const [visible, setVisible] = useState(false)
    const inputId = id ?? props.name

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            className={`w-full rounded-md border border-border bg-surface py-2.5 pl-3 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60 ${error ? 'border-badge-discount' : ''} ${className}`}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted transition-colors hover:text-text-primary"
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            tabIndex={-1}
          >
            {visible ? <IconEyeOff className="size-5" /> : <IconEye className="size-5" />}
          </button>
        </div>
        {error && <p className="text-xs text-badge-discount">{error}</p>}
      </div>
    )
  }
)

PasswordInput.displayName = 'PasswordInput'
