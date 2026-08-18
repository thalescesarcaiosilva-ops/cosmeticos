type HomeLcpPreloadProps = {
  mobileBannerUrl: string | null
  desktopBannerUrl: string | null
}

/**
 * Preload no HTML (head via RSC) com media query — o bot e o LCP veem a URL no documento.
 * Não esconde nenhum banner: só antecipa o download do slide visível.
 */
export function HomeLcpPreload({ mobileBannerUrl, desktopBannerUrl }: HomeLcpPreloadProps) {
  return (
    <>
      {mobileBannerUrl ? (
        <link
          rel="preload"
          as="image"
          href={mobileBannerUrl}
          media="(max-width: 767px)"
          fetchPriority="high"
        />
      ) : null}
      {desktopBannerUrl ? (
        <link
          rel="preload"
          as="image"
          href={desktopBannerUrl}
          media="(min-width: 768px)"
        />
      ) : null}
    </>
  )
}
