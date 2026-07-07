import { Suspense } from 'react'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <div className="py-12 md:py-16">
      <Suspense fallback={<p className="text-center text-text-secondary">Carregando…</p>}>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  )
}
