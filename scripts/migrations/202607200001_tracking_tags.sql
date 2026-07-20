-- Tags/scripts configuráveis no painel (GTM, Analytics, body, checkout)
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS head_scripts text,
  ADD COLUMN IF NOT EXISTS tracking_tags jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.site_settings.head_scripts IS
  'Legado: HTML no <head>. Preferir tracking_tags.';

COMMENT ON COLUMN public.site_settings.tracking_tags IS
  'Lista JSON de tags: [{id,name,placement,enabled,html}] placement=head|body|checkout';

UPDATE public.site_settings
SET tracking_tags = '[]'::jsonb
WHERE tracking_tags IS NULL;
