-- Busca por palavras (não exige a frase inteira) e funil de comportamento da loja.

CREATE OR REPLACE FUNCTION public.escape_like_pattern(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT replace(replace(replace(COALESCE(input, ''), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
$$;

CREATE OR REPLACE FUNCTION public.search_tokens(raw text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(token), ARRAY[]::text[])
  FROM (
    SELECT token
    FROM unnest(
      regexp_split_to_array(
        normalize_search_text(replace(replace(COALESCE(raw, ''), '-', ' '), '/', ' ')),
        '\s+'
      )
    ) AS token
    WHERE char_length(token) >= 2
      AND token NOT IN (
        'de','da','do','das','dos','e','em','um','uma','para','com','por',
        'ao','aos','na','no','nas','nos','as','os','ou','que','pra'
      )
    GROUP BY token
    LIMIT 6
  ) limited;
$$;

CREATE OR REPLACE FUNCTION public.search_text_has_token(haystack text, token text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(token, '') <> '' AND EXISTS (
    SELECT 1
    FROM unnest(
      regexp_split_to_array(
        normalize_search_text(replace(replace(COALESCE(haystack, ''), '-', ' '), '/', ' ')),
        '[^a-z0-9]+'
      )
    ) AS word
    WHERE word <> ''
      AND (
        word = token
        OR (char_length(token) >= 4 AND (word = token || 's' OR word = token || 'es'))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.padded_has_token(padded text, token text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(padded, '') <> ''
    AND COALESCE(token, '') <> ''
    AND (
      position(' ' || token || ' ' IN padded) > 0
      OR (
        char_length(token) >= 4
        AND (
          position(' ' || token || 's ' IN padded) > 0
          OR position(' ' || token || 'es ' IN padded) > 0
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.search_store_products(
  search_query text,
  result_limit integer DEFAULT 24
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tokens AS (
    SELECT public.search_tokens(search_query) AS list
  ),
  prepared AS (
    SELECT
      p.id,
      p.name,
      ' ' || regexp_replace(normalize_search_text(replace(replace(p.name, '-', ' '), '/', ' ')), '[^a-z0-9]+', ' ', 'g') || ' ' AS name_w,
      ' ' || regexp_replace(normalize_search_text(COALESCE(p.sku, '')), '[^a-z0-9]+', ' ', 'g') || ' ' AS sku_w,
      ' ' || regexp_replace(normalize_search_text(COALESCE(b.name, '')), '[^a-z0-9]+', ' ', 'g') || ' ' AS brand_w,
      ' ' || regexp_replace(normalize_search_text(COALESCE(p.short_description, '')), '[^a-z0-9]+', ' ', 'g') || ' ' AS short_w
    FROM public.products p
    LEFT JOIN public.brands b ON b.id = p.brand_id
    WHERE p.active = true
      AND COALESCE(p.product_type, 'simple') <> 'variation'
      AND COALESCE(array_length((SELECT list FROM tokens), 1), 0) > 0
  ),
  scored AS (
    SELECT
      prepared.id,
      prepared.name,
      counts.hits,
      counts.hits AS strong_hits
    FROM prepared
    CROSS JOIN LATERAL (
      SELECT count(*) FILTER (
        WHERE public.padded_has_token(prepared.name_w, token)
          OR public.padded_has_token(prepared.sku_w, token)
          OR public.padded_has_token(prepared.brand_w, token)
          OR public.padded_has_token(prepared.short_w, token)
          OR EXISTS (
            SELECT 1
            FROM public.product_categories pc
            JOIN public.categories c ON c.id = pc.category_id
            WHERE pc.product_id = prepared.id
              AND public.padded_has_token(
                ' ' || regexp_replace(normalize_search_text(replace(replace(c.name, '-', ' '), '/', ' ')), '[^a-z0-9]+', ' ', 'g') || ' ',
                token
              )
          )
      )::int AS hits
      FROM unnest((SELECT list FROM tokens)) AS token
    ) AS counts
  ),
  best AS (
    SELECT max(hits) AS hits, max(strong_hits) AS strong_hits, max(array_length(list, 1)) AS token_count
    FROM scored
    CROSS JOIN tokens
  )
  SELECT scored.id
  FROM scored
  CROSS JOIN best
  WHERE scored.hits > 0
    AND (
      (best.hits >= 2 AND scored.hits >= 2)
      OR (best.hits < 2 AND best.strong_hits >= 1 AND scored.strong_hits >= 1)
      OR (best.hits < 2 AND COALESCE(best.strong_hits, 0) < 1 AND COALESCE(best.token_count, 0) < 2)
    )
  ORDER BY scored.hits DESC, scored.strong_hits DESC, scored.name ASC
  LIMIT GREATEST(1, LEAST(COALESCE(result_limit, 24), 100));
$$;

GRANT EXECUTE ON FUNCTION public.escape_like_pattern(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_tokens(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_text_has_token(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.padded_has_token(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_store_products(text, integer) TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.store_funnel_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL,
  step text NOT NULL CHECK (
    step IN ('product', 'cart_add', 'cart', 'checkout', 'shipping', 'payment', 'purchase')
  ),
  path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_funnel_events_session_step UNIQUE (session_id, step)
);

CREATE INDEX IF NOT EXISTS store_funnel_events_created_at_idx
  ON public.store_funnel_events (created_at DESC);

ALTER TABLE public.store_funnel_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.store_funnel_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.store_funnel_events TO service_role;

CREATE OR REPLACE FUNCTION public.store_funnel_counts(day_count integer)
RETURNS TABLE(step text, sessions bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.step, count(DISTINCT e.session_id)::bigint
  FROM public.store_funnel_events e
  WHERE e.created_at >= now() - make_interval(days => GREATEST(1, LEAST(COALESCE(day_count, 7), 90)))
  GROUP BY e.step;
$$;

REVOKE ALL ON FUNCTION public.store_funnel_counts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_funnel_counts(integer) TO service_role;
