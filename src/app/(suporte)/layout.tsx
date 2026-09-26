import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Suporte' },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export const dynamic = 'force-dynamic'

export default function SupportRootLayout({ children }: { children: React.ReactNode }) {
  return children
}
