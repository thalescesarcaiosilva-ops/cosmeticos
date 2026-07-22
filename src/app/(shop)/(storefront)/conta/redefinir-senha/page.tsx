import { redirect } from 'next/navigation'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { createClient } from '@/lib/supabase/server'

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/conta/login?error=link_invalido')
  }

  return (
    <div className="py-12 md:py-16">
      <ResetPasswordForm />
    </div>
  )
}
