type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  error?: string
}

export function Textarea({ label, error, className = '', id, ...props }: TextareaProps) {
  const inputId = id ?? props.name

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${error ? 'border-badge-discount' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-badge-discount">{error}</p>}
    </div>
  )
}
