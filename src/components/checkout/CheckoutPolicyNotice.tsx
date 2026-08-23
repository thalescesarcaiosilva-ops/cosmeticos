import Link from 'next/link'
import type { ReactNode } from 'react'
import { POLICY_PATHS } from '@/lib/navigation/policy-links'
import { toPublicHref } from '@/lib/navigation/public-href'

const policyLinkClass =
  'font-semibold text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand'

type PolicyLinkProps = {
  href: string
  children: ReactNode
}

function PolicyLink({ href, children }: PolicyLinkProps) {
  return (
    <Link href={toPublicHref(href)} className={policyLinkClass}>
      {children}
    </Link>
  )
}

/** Exigência GMC/KeyCommerce: políticas visíveis no fluxo de checkout (não só no footer). */
export function CheckoutPolicyNotice() {
  return (
    <p className="text-xs leading-relaxed text-text-secondary">
      Ao finalizar, você concorda com os{' '}
      <PolicyLink href={POLICY_PATHS.terms}>Termos e Condições</PolicyLink> e confirma que leu a{' '}
      <PolicyLink href={POLICY_PATHS.privacy}>Política de Privacidade</PolicyLink>. Consulte também{' '}
      <PolicyLink href={POLICY_PATHS.returns}>Trocas e Devoluções</PolicyLink> e{' '}
      <PolicyLink href={POLICY_PATHS.shipping}>Política de Frete</PolicyLink>.
    </p>
  )
}
