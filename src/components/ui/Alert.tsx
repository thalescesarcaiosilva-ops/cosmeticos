type AlertProps = {
  type?: 'error' | 'success' | 'info'
  children: React.ReactNode
}

const styles = {
  error: 'border-badge-discount/30 bg-red-50 text-badge-discount',
  success: 'border-green-200 bg-green-50 text-green-800',
  info: 'border-border bg-surface-muted text-text-secondary',
}

export function Alert({ type = 'info', children }: AlertProps) {
  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${styles[type]}`} role="alert">
      {children}
    </div>
  )
}
