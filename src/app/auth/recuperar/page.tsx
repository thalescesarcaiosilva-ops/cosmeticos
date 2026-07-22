import { RecoverPasswordConfirm } from '@/components/auth/RecoverPasswordConfirm'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function RecoverPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const tokenHash = typeof params.token_hash === 'string' ? params.token_hash : ''
  const type = typeof params.type === 'string' ? params.type : 'recovery'
  const next =
    typeof params.next === 'string' ? params.next : '/conta/redefinir-senha'

  return (
    <div className="py-12 md:py-16">
      <RecoverPasswordConfirm tokenHash={tokenHash} type={type} next={next} />
    </div>
  )
}
