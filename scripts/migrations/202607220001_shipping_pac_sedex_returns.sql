-- Atualiza frete e devolução conforme Política de Frete + Trocas e Devoluções
-- PAC: 5–10 dias úteis — R$ 24,90 (grátis a partir de R$ 250)
-- SEDEX: 2–5 dias úteis — R$ 39,90
-- Devolução (arrependimento CDC): 7 dias | frete de devolução por conta da loja

-- PAC existente
UPDATE public.shipping_methods
SET
  name = 'PAC',
  description = 'Entrega econômica pelos Correios — 5 a 10 dias úteis',
  base_price = 24.90,
  free_above = 250.00,
  estimated_days_min = 5,
  estimated_days_max = 10,
  sort_order = 10,
  active = true,
  updated_at = now()
WHERE lower(name) = 'pac'
   OR id = '5f6c365b-9270-4b0c-8a42-56d596dbd474';

-- SEDEX (cria se não existir)
INSERT INTO public.shipping_methods (
  name,
  description,
  base_price,
  free_above,
  estimated_days_min,
  estimated_days_max,
  cep_rules,
  sort_order,
  active
)
SELECT
  'SEDEX',
  'Entrega expressa pelos Correios — 2 a 5 dias úteis',
  39.90,
  NULL,
  2,
  5,
  '[]'::jsonb,
  20,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.shipping_methods WHERE lower(name) = 'sedex'
);

UPDATE public.shipping_methods
SET
  description = 'Entrega expressa pelos Correios — 2 a 5 dias úteis',
  base_price = 39.90,
  free_above = NULL,
  estimated_days_min = 2,
  estimated_days_max = 5,
  sort_order = 20,
  active = true,
  updated_at = now()
WHERE lower(name) = 'sedex';

-- Desativa modalidades antigas que não fazem parte da nova política
UPDATE public.shipping_methods
SET active = false, updated_at = now()
WHERE lower(name) NOT IN ('pac', 'sedex')
  AND active = true;

-- SEO / Merchant: devolução alinhada ao direito de arrependimento (7 dias)
UPDATE public.site_settings
SET
  return_enabled = true,
  return_days = 7,
  return_method = 'ReturnByMail',
  return_fees = 'FreeReturn',
  return_policy_page_slug = 'politica-de-trocas-e-devolucoes',
  return_policy_notes = 'Arrependimento: 7 dias corridos (CDC art. 49). Defeito/vício em não duráveis: até 30 dias. Frete de devolução por conta da loja nesses casos.',
  seo_handling_days_min = 1,
  seo_handling_days_max = 2,
  updated_at = now()
WHERE id IS NOT NULL;
