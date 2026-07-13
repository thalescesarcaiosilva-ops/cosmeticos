-- Busca accent/case-insensitive para produtos da vitrine.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION normalize_search_text(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(unaccent(trim(COALESCE(input, ''))));
$$;

CREATE OR REPLACE FUNCTION search_store_products(search_query text, result_limit int DEFAULT 24)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT normalize_search_text(search_query) AS term
  )
  SELECT p.id
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  CROSS JOIN normalized n
  WHERE p.active = true
    AND length(n.term) >= 2
    AND (
      normalize_search_text(p.name) LIKE '%' || n.term || '%' ESCAPE '\'
      OR normalize_search_text(COALESCE(p.sku, '')) LIKE '%' || n.term || '%' ESCAPE '\'
      OR normalize_search_text(COALESCE(b.name, '')) LIKE '%' || n.term || '%' ESCAPE '\'
    )
  ORDER BY p.name ASC
  LIMIT GREATEST(1, LEAST(result_limit, 100));
$$;

GRANT EXECUTE ON FUNCTION search_store_products(text, int) TO anon, authenticated, service_role;
