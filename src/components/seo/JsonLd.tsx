type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[] | null
}

export function JsonLd({ data }: JsonLdProps) {
  if (!data) return null

  const graph = Array.isArray(data) ? data : [data]

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph.length === 1 ? graph[0] : graph) }}
    />
  )
}
