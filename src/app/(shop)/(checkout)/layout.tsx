import { SiteLayout } from '@/components/layout/SiteLayout'

export default async function CheckoutShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SiteLayout chrome="footer-only">{children}</SiteLayout>
}
