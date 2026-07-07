import type { Metadata } from 'next'

/** Só expõe favicon quando configurado no admin — evita o ícone padrão do Next.js. */
export function buildFaviconIcons(faviconUrl: string | null): Pick<Metadata, 'icons'> {
  if (faviconUrl) {
    return {
      icons: {
        icon: faviconUrl,
        shortcut: faviconUrl,
        apple: faviconUrl,
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
