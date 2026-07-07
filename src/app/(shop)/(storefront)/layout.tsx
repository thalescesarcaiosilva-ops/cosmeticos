import { SiteLayout } from '@/components/layout/SiteLayout'

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <SiteLayout chrome="full">{children}</SiteLayout>
}
