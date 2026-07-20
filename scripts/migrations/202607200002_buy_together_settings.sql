-- Configurações do bloco "Compre junto" na página de produto
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS buy_together_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.site_settings.buy_together_settings IS
  'Config Compre junto: enabled, textos, limites e CSS (cores/raio/custom)';

UPDATE public.site_settings
SET buy_together_settings = '{}'::jsonb
WHERE buy_together_settings IS NULL;
