import { AdminLayoutShell } from '@/components/admin/AdminLayoutShell'
import { getSiteLayoutData } from '@/lib/layout/get-site-layout-data'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const layout = await getSiteLayoutData()

  return (
    <AdminLayoutShell
      storeName={layout.storeName}
      logoImageUrl={layout.logo.imageUrl}
    >
      {children}
    </AdminLayoutShell>
  )
}
