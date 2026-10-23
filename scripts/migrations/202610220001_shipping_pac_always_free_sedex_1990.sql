-- PAC sempre grátis. SEDEX R$ 19,90. Prazos de trânsito permanecem (PAC 3–4, SEDEX 2–3).

UPDATE public.shipping_methods
SET
  base_price = 0,
  free_above = 0,
  estimated_days_min = 3,
  estimated_days_max = 4,
  updated_at = now()
WHERE lower(name) = 'pac';

UPDATE public.shipping_methods
SET
  base_price = 19.90,
  free_above = NULL,
  estimated_days_min = 2,
  estimated_days_max = 3,
  updated_at = now()
WHERE lower(name) = 'sedex';
