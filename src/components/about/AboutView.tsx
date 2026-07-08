import Link from 'next/link'
import { storeContent } from '@/lib/store-content/content'
import { StoreImageFrame } from '@/components/store-content/StoreImageFrame'

const ACCENT_DOT: Record<'rose' | 'gold' | 'sage', { ring: string; dot: string }> = {
  rose: { ring: 'bg-rose/15', dot: 'bg-rose' },
  gold: { ring: 'bg-gold/15', dot: 'bg-gold' },
  sage: { ring: 'bg-sage/15', dot: 'bg-sage' },
}

const BARCODE_BARS = [100, 60, 80, 40, 100, 50, 90, 30, 70, 100, 45, 85, 60, 95, 35, 75, 55, 100]

function CtaButton({ href, children, variant }: { href: string; children: React.ReactNode; variant: 'solid' | 'link' }) {
  const isInternal = href.startsWith('/') || href.startsWith('#')
  const className =
    variant === 'solid'
      ? 'focus-ring inline-flex items-center rounded-full bg-rose px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-rosed'
      : 'focus-ring inline-flex items-center border-b border-plum/40 pb-0.5 text-sm font-medium text-plum transition-colors hover:border-plum'

  if (isInternal) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  )
}

export function AboutView() {
  const { about } = storeContent
  const { hero, essence, offerings, storeImage, info } = about

  return (
    <div className="bg-cream text-ink">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 pb-28 pt-16 md:grid-cols-2 md:px-10 md:pb-36 md:pt-24">
          <div className="relative z-10">
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.3em] text-rosed">
              {hero.eyebrow}
            </p>
            <h1 className="font-display text-[2.6rem] font-medium leading-[1.08] text-plum sm:text-6xl">
              {hero.titleLead} <span className="italic text-rosed">{hero.titleAccent}</span>
            </h1>
            <p className="mt-7 max-w-md text-[1.05rem] leading-relaxed text-ink/80">
              {hero.description}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <CtaButton href={hero.primaryCta.href} variant="solid">
                {hero.primaryCta.label}
              </CtaButton>
              <CtaButton href={hero.secondaryCta.href} variant="link">
                {hero.secondaryCta.label}
              </CtaButton>
            </div>
          </div>

          <div className="relative h-72 md:h-96" aria-hidden="true">
            <div className="swatch float-slow absolute right-10 top-2 size-32 bg-rose md:size-40" />
            <div className="swatch float-slower absolute bottom-6 right-32 size-24 bg-sage md:size-28" />
            <div className="swatch float-slow absolute bottom-0 right-0 size-20 bg-gold md:size-24" />
            <div className="swatch float-slower absolute right-56 top-24 hidden size-14 bg-plum2 md:block" />
          </div>
        </div>

        <svg
          className="absolute -bottom-1 left-0 w-full text-white"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M0,40 C360,90 1080,0 1440,40 L1440,80 L0,80 Z" />
        </svg>
      </section>

      {/* ESSÊNCIA */}
      <section id="historia" className="bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-20 md:grid-cols-5 md:px-10 md:py-28">
          <div className="md:col-span-2">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-sage">
              {essence.eyebrow}
            </p>
            <h2 className="font-display text-3xl leading-tight text-plum md:text-4xl">
              {essence.title}
            </h2>
          </div>
          <div className="space-y-5 leading-relaxed text-ink/80 md:col-span-3">
            {essence.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      {/* O QUE OFERECEMOS */}
      <section id="cuidamos" className="bg-cream">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-rosed">
            {offerings.eyebrow}
          </p>
          <h2 className="max-w-xl font-display text-3xl leading-tight text-plum md:text-4xl">
            {offerings.title}
          </h2>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {offerings.cards.map((card) => {
              const accent = ACCENT_DOT[card.accent]
              return (
                <div
                  key={card.title}
                  className="rounded-2xl border border-plum/10 bg-white p-8 transition-transform hover:-translate-y-1"
                >
                  <div className={`mb-6 flex size-11 items-center justify-center rounded-full ${accent.ring}`}>
                    <span className={`size-3.5 rounded-full ${accent.dot}`} />
                  </div>
                  <h3 className="mb-2 font-display text-xl text-plum">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-ink/70">{card.description}</p>
                </div>
              )
            })}
          </div>

          {offerings.values.length > 0 && (
            <div className="mt-16 flex flex-wrap items-center gap-x-3 gap-y-3 font-mono text-xs uppercase tracking-[0.2em] text-plum/70">
              {offerings.values.map((value, i) => (
                <span key={value} className="flex items-center gap-3">
                  {i > 0 && <span className="text-gold">•</span>}
                  {value}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FOTO DA LOJA */}
      {storeImage.enabled && (
        <section className="bg-white">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-20 md:grid-cols-2 md:px-10 md:py-28">
            <div>
              <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-sage">
                {storeImage.eyebrow}
              </p>
              <h2 className="max-w-md font-display text-3xl leading-tight text-plum md:text-4xl">
                {storeImage.title}
              </h2>
              <p className="mt-6 max-w-md leading-relaxed text-ink/75">{storeImage.caption}</p>
            </div>
            <StoreImageFrame
              imageUrl={storeImage.imageUrl}
              alt={storeImage.imageAlt}
              className="aspect-[4/3] w-full"
            />
          </div>
        </section>
      )}

      {/* INFORMAÇÕES / RÓTULO */}
      <section id="informacoes" className="bg-cream">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-10 md:py-28">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-sage">
            {info.eyebrow}
          </p>
          <h2 className="mb-14 max-w-xl font-display text-3xl leading-tight text-plum md:text-4xl">
            {info.title}
          </h2>

          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-5">
            {/* Rótulo */}
            <div className="label-card relative rounded-sm p-8 sm:-rotate-1 md:p-10 lg:col-span-3">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <p className="font-display text-2xl italic text-plum">{info.label.title}</p>
                  <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-plum/50">
                    {info.label.subtitle}
                  </p>
                </div>
                <div className="seal relative flex size-16 shrink-0 items-center justify-center rounded-full">
                  <span className="whitespace-pre-line text-center font-mono text-[0.55rem] uppercase leading-tight tracking-wide text-gold">
                    {info.label.sealText}
                  </span>
                </div>
              </div>

              <dl className="font-mono text-sm">
                {info.label.rows.map((row, i) => (
                  <div
                    key={row.label}
                    className={`grid grid-cols-3 gap-4 py-3 ${
                      i < info.label.rows.length - 1 ? 'label-row' : ''
                    }`}
                  >
                    <dt className="text-[0.7rem] uppercase tracking-wide text-plum/50">
                      {row.label}
                    </dt>
                    <dd className="col-span-2 whitespace-pre-line leading-relaxed text-ink break-words">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="barcode mt-8 flex h-8 items-end opacity-70" aria-hidden="true">
                {BARCODE_BARS.map((height, i) => (
                  <span key={i} style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>

            {/* Horário + visita */}
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-2xl bg-white p-8">
                <h3 className="mb-5 font-display text-xl text-plum">{info.hoursTitle}</h3>
                <ul className="space-y-3 text-sm">
                  {info.hours.map((row, i) => (
                    <li
                      key={row.label}
                      className={`flex items-center justify-between ${
                        i < info.hours.length - 1 ? 'border-b border-plum/10 pb-3' : ''
                      }`}
                    >
                      <span className="text-ink/70">{row.label}</span>
                      <span className={`font-medium ${row.closed ? 'text-plum/50' : 'text-plum'}`}>
                        {row.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-plum p-8 text-cream">
                <h3 className="mb-3 font-display text-xl">{info.visitTitle}</h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-cream/80">
                  {info.visitAddress}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
