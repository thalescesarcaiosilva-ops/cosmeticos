-- Analytics agregado para dashboard (views de produto + 404)
-- Execute no SQL Editor do Supabase se a migration automática não for aplicada.

CREATE TABLE IF NOT EXISTS public.product_views_daily (
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT (CURRENT_DATE),
  views integer NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (product_id, day)
);

CREATE INDEX IF NOT EXISTS product_views_daily_day_idx
  ON public.product_views_daily (day DESC);

CREATE TABLE IF NOT EXISTS public.not_found_paths (
  path text PRIMARY KEY,
  hits integer NOT NULL DEFAULT 0 CHECK (hits >= 0),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  sample_referrer text
);

CREATE INDEX IF NOT EXISTS not_found_paths_hits_idx
  ON public.not_found_paths (hits DESC, last_seen_at DESC);

ALTER TABLE public.product_views_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.not_found_paths ENABLE ROW LEVEL SECURITY;

-- Sem policies públicas: leitura/escrita só via service role nas APIs.

CREATE OR REPLACE FUNCTION public.increment_product_view(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.product_views_daily (product_id, day, views)
  VALUES (p_product_id, CURRENT_DATE, 1)
  ON CONFLICT (product_id, day)
  DO UPDATE SET views = public.product_views_daily.views + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_not_found(p_path text, p_referrer text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.not_found_paths (path, hits, last_seen_at, sample_referrer)
  VALUES (p_path, 1, now(), NULLIF(trim(p_referrer), ''))
  ON CONFLICT (path)
  DO UPDATE SET
    hits = public.not_found_paths.hits + 1,
    last_seen_at = now(),
    sample_referrer = COALESCE(
      NULLIF(trim(p_referrer), ''),
      public.not_found_paths.sample_referrer
    );
END;
$$;

REVOKE ALL ON FUNCTION public.increment_product_view(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_not_found(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_product_view(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_not_found(text, text) TO service_role;
