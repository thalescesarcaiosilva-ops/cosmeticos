'use client'

import { useState } from 'react'
import { ChevronUp } from 'lucide-react'

type ProductDetailTabsProps = {
  productName: string
  description: string | null
  shortDescription?: string | null
  benefits?: string[] | null
}

export function ProductDetailTabs({
  productName,
  description,
  shortDescription,
  benefits,
}: ProductDetailTabsProps) {
  const [open, setOpen] = useState(true)
  const hasBenefits = (benefits?.length ?? 0) > 0
  const hasContent = Boolean(description || shortDescription || hasBenefits)

  if (!hasContent) return null

  return (
    <section className="mt-6 border-t border-brand/40 pt-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 border-b border-brand/30 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-[15px] font-bold text-brand">Detalhes</span>
        <ChevronUp
          className={`size-5 shrink-0 text-text-muted transition-transform duration-200 ${open ? '' : 'rotate-180'}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="pt-4 pb-1">
          <h3 className="text-[15px] font-bold leading-snug text-text-primary">{productName}</h3>

          {shortDescription && (
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">{shortDescription}</p>
          )}

          {description ? (
            <div
              className="product-description mt-3 max-w-none text-sm leading-relaxed text-text-secondary [&_a]:text-brand [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text-primary [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-text-primary [&_h4]:mb-2 [&_h4]:font-semibold [&_li]:mb-1.5 [&_p]:mb-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          ) : !shortDescription ? (
            <p className="mt-3 text-sm text-text-muted">
              Descrição não disponível para este produto.
            </p>
          ) : null}

          {hasBenefits && (
            <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
              {benefits!.map((benefit) => (
                <li key={benefit} className="flex gap-2">
                  <span className="text-text-muted" aria-hidden>
                    –
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
