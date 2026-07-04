import Script from 'next/script'
import type { StoreProfile } from '@/lib/store-profile/queries'

type AnalyticsScriptsProps = {
  profile: Pick<
    StoreProfile,
    'google_analytics_id' | 'google_tag_manager_id' | 'microsoft_clarity_id'
  >
}

export function AnalyticsScripts({ profile }: AnalyticsScriptsProps) {
  const gtmId = profile.google_tag_manager_id?.trim()
  const gaId = profile.google_analytics_id?.trim()
  const clarityId = profile.microsoft_clarity_id?.trim()

  const primaryTag = gtmId || gaId

  return (
    <>
      {primaryTag && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${primaryTag}`}
            strategy="afterInteractive"
          />
          <Script id="google-gtag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${primaryTag}');
            `}
          </Script>
        </>
      )}

      {gaId && gtmId && gaId !== gtmId && (
        <Script id="google-ga-secondary" strategy="afterInteractive">
          {`gtag('config', '${gaId}');`}
        </Script>
      )}

      {clarityId && (
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${clarityId}");
          `}
        </Script>
      )}
    </>
  )
}
