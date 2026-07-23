import { redirect } from 'next/navigation'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function LegacyRastreioRedirect({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {}
  const codigoRaw = params.codigo ?? params.code
  const codigo = Array.isArray(codigoRaw) ? codigoRaw[0] : codigoRaw
  const query = codigo?.trim()
    ? `?codigo=${encodeURIComponent(codigo.trim())}`
    : ''
  redirect(`/paginas/rastreio${query}`)
}
