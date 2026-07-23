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
    <div className="flex min-h-screen bg-neutral-100 text-neutral-900">
      <AdminSidebar storeName={storeName} logoImageUrl={logoImageUrl} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader title={title} />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}
