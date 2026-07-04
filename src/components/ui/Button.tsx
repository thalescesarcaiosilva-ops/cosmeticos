type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
}

const variants = {
  primary: 'bg-brand text-white hover:opacity-90',
  secondary: 'border border-border bg-surface text-text-primary hover:bg-surface-muted',
  ghost: 'text-brand hover:bg-surface-muted',
  danger: 'bg-badge-discount text-white hover:opacity-90',
}

export function Button({
  variant = 'primary',
  loading,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Aguarde…' : children}
    </button>
  )
}
