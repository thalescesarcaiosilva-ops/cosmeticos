type HomeLcpPreloadProps = {
  mobileBannerUrl: string | null
  desktopBannerUrl: string | null
}

/**
 * Preload do banner LCP por viewport — complementa priority no mobile sem baixar ambos.
 */
export function HomeLcpPreload({ mobileBannerUrl, desktopBannerUrl }: HomeLcpPreloadProps) {
  return (
    <>
      {mobileBannerUrl ? (
        <link rel="preload" as="image" href={mobileBannerUrl} media="(max-width: 767px)" />
      ) : null}
      {desktopBannerUrl ? (
        <link rel="preload" as="image" href={desktopBannerUrl} media="(min-width: 768px)" />
      ) : null}
    </>
  )
}
