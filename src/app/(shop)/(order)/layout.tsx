import { SiteLayout } from '@/components/layout/SiteLayout'

export default async function OrderShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SiteLayout chrome="minimal">{children}</SiteLayout>
}
