-- Variantes pré-otimizadas (WebP) para servir sem /_next/image da Vercel.
-- public_url continua canônico (Merchant / JSON-LD / OG).

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS thumb_url text,
  ADD COLUMN IF NOT EXISTS medium_url text;

COMMENT ON COLUMN public.media_assets.public_url IS 'Imagem canônica (large) — Merchant e schema';
COMMENT ON COLUMN public.media_assets.thumb_url IS 'WebP ~400px para cards e thumbs';
COMMENT ON COLUMN public.media_assets.medium_url IS 'WebP ~800px para galeria mobile/PDP';
