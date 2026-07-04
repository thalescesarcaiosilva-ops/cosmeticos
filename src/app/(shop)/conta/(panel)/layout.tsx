import { AccountNav } from '@/components/account/AccountNav'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AccountPanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    isAdmin = profile?.role === 'admin'
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <AccountNav isAdmin={isAdmin} />
        </aside>
        <div>{children}</div>
      </div>
    </div>
  )
}
