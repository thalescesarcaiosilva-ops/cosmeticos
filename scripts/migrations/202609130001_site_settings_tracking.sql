-- IDs tipados de tracking (GA4 / Ads / Clarity) — preferir a tags HTML livres
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS tracking jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.site_settings.tracking IS
  'IDs tipados: googleTagId, googleAnalyticsId, googleAdsId, googleAdsConversionSendTo, microsoftClarityId';
