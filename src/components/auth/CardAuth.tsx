export function CardAuth({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-logo">{title}</h1>
        {children}
      </div>
    </div>
  )
}
