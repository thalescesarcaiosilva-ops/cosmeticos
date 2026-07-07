import { SiteLayout } from '@/components/layout/SiteLayout'

export default function OrderShellLayout({ children }: { children: React.ReactNode }) {
  return <SiteLayout chrome="minimal">{children}</SiteLayout>
}
