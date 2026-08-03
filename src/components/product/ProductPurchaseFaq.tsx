import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ProductPurchaseAssurances } from '@/types/product-assurances'

type ProductPurchaseFaqProps = {
  assurances: ProductPurchaseAssurances
}

type FaqItem = {
  id: string
  question: string
  answer: ReactNode
}

function buildFaqItems(assurances: ProductPurchaseAssurances): FaqItem[] {
  const paymentList =
    assurances.paymentLabels.length > 0
      ? assurances.paymentLabels.join(', ')
      : 'as opções disponíveis no checkout'

  const returnAnswer = (() => {
    if (!assurances.returnEnabled || assurances.returnDays == null) {
      return (
        <>
          Consulte as regras atuais na{' '}
          <Link href={assurances.returnPolicyHref} className="font-semibold text-brand hover:underline">
            política de trocas e devoluções
          </Link>
          .
        </>
      )
    }

    return (
      <>
        Você pode solicitar troca ou devolução em até{' '}
        <strong>{assurances.returnDays} dias</strong> após o recebimento, conforme nossa política
        {assurances.returnFree ? ', sem custo de frete de devolução' : ''}. Detalhes e condições em{' '}
        <Link href={assurances.returnPolicyHref} className="font-semibold text-brand hover:underline">
          Trocas e devoluções
        </Link>
        .
      </>
    )
  })()

  const contactParts: ReactNode[] = []
  if (assurances.contactEmail) {
    contactParts.push(
      <a
        key="email"
        href={`mailto:${assurances.contactEmail}`}
        className="font-semibold text-brand hover:underline"
      >
        {assurances.contactEmail}
      </a>
    )
  }
  if (assurances.phoneDisplay && assurances.phoneHref) {
    contactParts.push(
      <a
        key="phone"
        href={assurances.phoneHref}
        className="font-semibold text-brand hover:underline"
      >
        {assurances.phoneDisplay}
      </a>
    )
  }

  return [
    {
      id: 'devolucao',
      question: 'Como funciona a devolução?',
      answer: returnAnswer,
    },
    {
      id: 'entrega',
      question: 'Qual o tempo de entrega?',
      answer: (
        <>
          O prazo depende do seu CEP e da modalidade escolhida no checkout. Use o calculador de
          frete acima para ver as opções disponíveis. Após o envio, você pode acompanhar o pedido
          em{' '}
          <Link href={assurances.trackingHref} className="font-semibold text-brand hover:underline">
            Rastreio
          </Link>
          . Mais informações na{' '}
          <Link
            href={assurances.shippingPolicyHref}
            className="font-semibold text-brand hover:underline"
          >
            política de frete
          </Link>
          .
        </>
      ),
    },
    {
      id: 'pagamento',
      question: 'Quais as formas de pagamento?',
      answer: (
        <>
          Aceitamos {paymentList}
          {assurances.pixEnabled || assurances.cardEnabled
            ? '. No checkout, as opções ativas são exibidas conforme disponibilidade.'
            : '.'}{' '}
          Veja também a página de{' '}
          <Link
            href={assurances.paymentPolicyHref}
            className="font-semibold text-brand hover:underline"
          >
            formas de pagamento
          </Link>
          .
        </>
      ),
    },
    {
      id: 'contato',
      question: 'Como falar com o atendimento?',
      answer: (
        <>
          {contactParts.length > 0 ? (
            <>
              Entre em contato por {contactParts.length === 1 ? contactParts[0] : (
                <>
                  {contactParts[0]}
                  {contactParts.length > 1 ? <> ou {contactParts[1]}</> : null}
                </>
              )}
              . Também você pode usar a página de{' '}
            </>
          ) : (
            <>Use a página de </>
          )}
          <Link href={assurances.contactHref} className="font-semibold text-brand hover:underline">
            Fale Conosco
          </Link>
          .
        </>
      ),
    },
  ]
}

export function ProductPurchaseFaq({ assurances }: ProductPurchaseFaqProps) {
  const items = buildFaqItems(assurances)

  return (
    <section aria-labelledby="product-purchase-faq-heading" className="border-t border-border pt-4">
      <h2
        id="product-purchase-faq-heading"
        className="mb-2 text-sm font-bold text-text-primary"
      >
        Dúvidas frequentes
      </h2>

      <div className="divide-y divide-border rounded-md border border-border">
        {items.map((item) => (
          <details key={item.id} className="group px-3.5 py-2.5 open:bg-surface-strong/40">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left text-[13px] font-semibold text-text-primary marker:content-none [&::-webkit-details-marker]:hidden">
              <span>{item.question}</span>
              <ChevronDown
                className="size-4 shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="mt-2 pr-6 text-[12.5px] leading-relaxed text-text-secondary">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
