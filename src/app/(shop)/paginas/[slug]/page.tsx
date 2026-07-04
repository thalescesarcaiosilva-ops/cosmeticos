import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public'
import { buildPageMetadata } from '@/lib/seo/metadata'

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: page } = await supabase
    .from('footer_pages')
    .select('title, meta_description')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!page) {
    return { title: 'Página não encontrada', robots: { index: false } }
  }

  return buildPageMetadata({
    title: page.title,
    description: page.meta_description,
    path: `/paginas/${slug}`,
  })
}

export default async function FooterContentPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: page } = await supabase
    .from('footer_pages')
    .select('title, content')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!page) notFound()

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 ">
      <h1 className="mb-8 text-3xl font-bold text-text-primary">{page.title}</h1>
      {page.content ? (
        <div
          className="prose prose-sm max-w-none text-text-secondary [&_a]:text-brand [&_h2]:text-text-primary [&_h3]:text-text-primary"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      ) : (
        <p className="text-text-secondary">Conteúdo em breve.</p>
      )}
    </div>
  )
}
