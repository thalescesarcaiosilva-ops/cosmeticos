import { Footer } from './Footer'
import { ShopHeader } from './ShopHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { getFooterData } from '@/lib/layout/get-footer-data'
import { getSiteLayoutData } from '@/lib/layout/get-site-layout-data'
import { getMerchantSeoContext } from '@/lib/seo/get-merchant-seo-context'
import { buildStoreJsonLd } from '@/lib/seo/json-ld/store'
import { buildWebsiteJsonLd } from '@/lib/seo/json-ld/website'
import { getPublicStoreProfile } from '@/lib/store-profile/public'

export type ChromeMode = 'full' | 'footer-only' | 'minimal'

type SiteLayoutProps = {
  children: React.ReactNode
  chrome?: ChromeMode
}

export async function SiteLayout({ children, chrome = 'full' }: SiteLayoutProps) {
  const showHeader = chrome === 'full'
  const showFooter = chrome === 'full' || chrome === 'footer-only'
  const [layoutData, footerData, merchantContext, storeProfile] = await Promise.all([
    getSiteLayoutData(),
    getFooterData(),
    getMerchantSeoContext(),
    getPublicStoreProfile(),
  ])

  const storeJsonLd = buildStoreJsonLd({
    layout: layoutData,
    footer: footerData,
    profile: storeProfile,
    merchant: merchantContext,
  })
  const websiteJsonLd = buildWebsiteJsonLd({
    storeName: layoutData.storeName || footerData.legal.storeName,
  })

  const globalStructuredData = [storeJsonLd, websiteJsonLd].filter(
    Boolean
  ) as Record<string, unknown>[]

  return (
    <div className="flex min-h-full flex-col">
      <JsonLd data={globalStructuredData.length > 0 ? globalStructuredData : null} />
      {showHeader ? (
        <ShopHeader
          storeName={layoutData.storeName}
          logo={layoutData.logo}
          policyLinks={layoutData.policyLinks}
          menuCategories={layoutData.menuCategories}
          phone={layoutData.phone}
          helpLink={layoutData.helpLink}
          contactPage={layoutData.contactPage}
          socialLinks={layoutData.socialLinks}
        />
      ) : null}
      <main className="flex-1">{children}</main>
      {showFooter ? <Footer footerData={footerData} /> : null}
    </div>
  )
}
