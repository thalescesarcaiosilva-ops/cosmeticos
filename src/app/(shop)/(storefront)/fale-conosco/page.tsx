import type { Metadata } from 'next'
import { ContactPageView } from '@/components/contact/ContactPageView'
import { getContactPageData } from '@/lib/contact/get-contact-page-data'
import { buildPageMetadata } from '@/lib/seo/metadata'

export async function generateMetadata(): Promise<Metadata> {
  const data = await getContactPageData()
  const storeName = data.storeName || 'Loja'

  return buildPageMetadata({
    title: `${data.pageTitle} | ${storeName}`,
    description:
      data.intro ??
      'Entre em contato conosco. Tire dúvidas sobre pedidos, produtos e atendimento.',
    path: '/fale-conosco',
  })
}

export default async function FaleConoscoPage() {
  const data = await getContactPageData()
  return <ContactPageView data={data} />
}
