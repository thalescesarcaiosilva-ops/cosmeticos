'use client'

import { IconHeart } from '@/components/icons/DotIcons'
import { useFavorites } from '@/providers/FavoritesProvider'

type FavoriteButtonProps = {
  productId: string
  className?: string
  variant?: 'card' | 'product'
}

export function FavoriteButton({
  productId,
  className = '',
  variant = 'card',
}: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite, hydrated } = useFavorites()
  const active = hydrated && isFavorite(productId)

  const variantClass =
    variant === 'product'
      ? 'size-10 rounded-sm bg-surface text-text-primary shadow-none ring-1 ring-border hover:scale-100 hover:bg-surface-strong'
      : 'size-9 rounded-full bg-white/90 text-brand shadow-sm hover:scale-105 hover:bg-white'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void toggleFavorite(productId)
      }}
      className={`flex items-center justify-center transition ${variantClass} ${className}`}
      aria-label={active ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      aria-pressed={active}
    >
      <IconHeart className="size-5" filled={active} />
    </button>
  )
}
