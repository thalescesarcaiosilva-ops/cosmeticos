import type { Metadata } from 'next'
import { toAbsoluteSiteMediaUrl } from '@/lib/media/public-url'

/** Só expõe favicon quando configurado no admin — evita o ícone padrão do Next.js. */
export function buildFaviconIcons(faviconUrl: string | null): Pick<Metadata, 'icons'> {
  const resolved = toAbsoluteSiteMediaUrl(faviconUrl) ?? faviconUrl

  if (resolved) {
    return {
      icons: {
        icon: [{ url: resolved }],
        shortcut: [{ url: resolved }],
        apple: [{ url: resolved }],
      },
    }
  }

  return {
    icons: {
      icon: [],
      shortcut: [],
      apple: [],
    },
  }
}
