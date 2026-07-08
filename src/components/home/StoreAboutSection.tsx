import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { storeContent } from '@/lib/store-content/content'
import { StoreImageFrame } from '@/components/store-content/StoreImageFrame'

export function StoreAboutSection() {
  const section = storeContent.home.storeAbout
  if (!section.enabled) return null

  return (
    <section className="mb-12 overflow-hidden rounded-2xl bg-surface-muted">
      <div className="grid grid-cols-1 items-stretch gap-0 md:grid-cols-2">
        <StoreImageFrame
          imageUrl={section.imageUrl}
          alt={section.imageAlt}
          className="min-h-[260px] rounded-none md:min-h-full"
        />

        <div className="flex flex-col justify-center px-6 py-10 md:px-10 md:py-12">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            {section.eyebrow}
          </p>
          <h2 className="font-display text-2xl leading-tight text-logo md:text-3xl">
            {section.title}
          </h2>
          <div className="mt-5 space-y-3 text-sm leading-relaxed text-text-secondary md:text-[15px]">
            {section.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-7">
            <Link
              href={section.cta.href}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white transition-opacity duration-[400ms] hover:opacity-90"
            >
              {section.cta.label}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
