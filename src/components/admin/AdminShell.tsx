'use client'

import { AdminHeader } from '@/components/admin/AdminHeader'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

type AdminShellProps = {
  title: string
  storeName: string
  logoImageUrl: string | null
  children: React.ReactNode
}

export function AdminShell({ title, storeName, logoImageUrl, children }: AdminShellProps) {
  return (
    <div className="flex min-h-screen bg-surface-muted">
      <AdminSidebar storeName={storeName} logoImageUrl={logoImageUrl} />
      <div className="flex flex-1 flex-col">
        <AdminHeader title={title} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
