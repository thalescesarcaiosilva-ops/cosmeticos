import { forwardRef } from 'react'

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id ?? props.name

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60 ${error ? 'border-badge-discount' : ''} ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-badge-discount">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
