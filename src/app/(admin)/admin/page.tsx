import { AdminDashboardView } from '@/components/admin/AdminDashboardView'
import { getDashboardPayload } from '@/lib/admin/dashboard-analytics'

export default async function AdminDashboardPage() {
  const data = await getDashboardPayload()
  return <AdminDashboardView data={data} />
}
