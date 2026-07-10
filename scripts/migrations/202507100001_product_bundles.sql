-- Execute no SQL Editor do Supabase para configurar bundles "Compre Junto".
-- Até rodar este script, o site usa produtos relacionados da mesma categoria com 5% de desconto.

CREATE TABLE IF NOT EXISTS product_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  companion_product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  discount_percent numeric(5, 2) NOT NULL DEFAULT 5 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_bundles_distinct_products CHECK (primary_product_id <> companion_product_id),
  CONSTRAINT product_bundles_unique_pair UNIQUE (primary_product_id, companion_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_bundles_primary
  ON product_bundles (primary_product_id, sort_order)
  WHERE active = true;

ALTER TABLE product_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_bundles_public_read"
  ON product_bundles
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- Exemplo: vincule produtos que devem aparecer juntos (ajuste os IDs):
-- INSERT INTO product_bundles (primary_product_id, companion_product_id, discount_percent, sort_order)
-- VALUES
--   ('UUID_DO_PRODUTO_PRINCIPAL', 'UUID_DO_PRODUTO_COMPANHEIRO', 10, 0);
