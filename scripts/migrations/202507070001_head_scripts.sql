-- Scripts personalizados no <head> (analytics, GTM, pixels, etc.)
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS head_scripts text;

COMMENT ON COLUMN public.site_settings.head_scripts IS
  'HTML de scripts/meta/link injetados no <head> da loja (não no admin).';
