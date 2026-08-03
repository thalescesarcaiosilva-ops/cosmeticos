'use client'

import { Star } from 'lucide-react'

type ProductRatingStarsProps = {
  average: number
  count: number
  size?: number
  /** Layout compacto para cards de produto */
  compact?: boolean
}

export function ProductRatingStars({
  average,
  count,
  size = 14,
  compact = false,
}: ProductRatingStarsProps) {
  const normalized = Math.max(0, Math.min(5, average))

  if (compact && count <= 0) return null

  return (
    <div
      className={
        compact
          ? 'flex items-center gap-1.5 text-[11px] text-text-muted'
          : 'mt-2 flex items-center gap-2 text-sm text-text-secondary'
      }
    >
      <div
        className={`flex items-center ${compact ? 'gap-0.5' : 'gap-1'}`}
        aria-label={`Nota ${normalized} de 5`}
      >
        {Array.from({ length: 5 }).map((_, index) => {
          const fill = Math.max(0, Math.min(1, normalized - index))
          return (
            <span key={index} className="relative inline-flex">
              <Star size={size} className="text-border" />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star size={size} className="fill-[#f5b301] text-[#f5b301]" />
              </span>
            </span>
          )
        })}
      </div>
      <span>
        {count > 0
          ? compact
            ? `${normalized.toFixed(1)} (${count})`
            : `${normalized.toFixed(1)} (${count} avaliações)`
          : 'Sem avaliações'}
      </span>
    </div>
  )
}
