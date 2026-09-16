import { redirect } from 'next/navigation'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function LegacyRastreioRedirect({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {}
  const codigo = firstParam(params.codigo ?? params.code)?.trim()
  const pedido = firstParam(params.pedido ?? params.order)?.trim()

  const query = codigo
    ? `?codigo=${encodeURIComponent(codigo)}`
    : pedido
      ? `?pedido=${encodeURIComponent(pedido)}`
      : ''

  redirect(`/paginas/rastreio${query}`)
}
