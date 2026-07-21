import { storeContent } from '@/lib/store-content/content'
import { StoreImageFrame } from '@/components/store-content/StoreImageFrame'
import type { OpeningHoursDayRow } from '@/lib/store-profile/format'

const BARCODE_BARS = [100, 60, 80, 40, 100, 50, 90, 30, 70, 100, 45, 85, 60, 95, 35, 75, 55, 100]

type AboutViewProps = {
  openingHours?: OpeningHoursDayRow[] | null
}

export function AboutView({ openingHours }: AboutViewProps) {
  const { about } = storeContent
  const { sobre, storeImage, info } = about
  const hoursRows =
    openingHours && openingHours.length > 0
      ? openingHours.map((row) => ({
          label: row.label,
          value: row.value,
          closed: row.closed,
        }))
      : info.hours

  return (
    <div className="bg-cream text-ink">
      {/* SOBRE NÓS */}
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-6 py-16 md:px-10 md:py-24">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-rosed">
            {sobre.eyebrow}
          </p>
          <h1 className="font-display text-4xl font-medium leading-tight text-plum md:text-5xl">
            {sobre.title}
          </h1>
          <div className="mt-8 space-y-5 text-[1.02rem] leading-relaxed text-ink/80">
            {sobre.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      {/* FOTO DA LOJA */}
      {storeImage.enabled && (
        <section className="bg-cream">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-16 md:grid-cols-2 md:px-10 md:py-24">
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
              priority
            />
          </div>
        </section>
      )}

      {/* INFORMAÇÕES / RÓTULO */}
      <section id="informacoes" className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-24">
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
              <div className="rounded-2xl bg-cream p-8">
                <h3 className="mb-5 font-display text-xl text-plum">{info.hoursTitle}</h3>
                <ul className="space-y-3 text-sm">
                  {hoursRows.map((row, i) => (
                    <li
                      key={row.label}
                      className={`flex items-center justify-between ${
                        i < hoursRows.length - 1 ? 'border-b border-plum/10 pb-3' : ''
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
