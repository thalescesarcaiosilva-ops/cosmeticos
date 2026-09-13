/**
 * @deprecated Prefer '@/lib/seo/analytics'.
 * Constantes legadas — IDs reais vêm de site_settings.tracking.
 */
export const GOOGLE_ADS_ID = 'AW-18248543414'
export const GOOGLE_ADS_PURCHASE_SEND_TO = 'AW-18248543414/n_0dCIfOhsEcELbZyv1D'

export {
  fireGoogleAdsConversion,
  normalizeAdsSendTo,
  normalizeTrackingConfig,
  type StoreTrackingConfig,
} from '@/lib/seo/analytics'
