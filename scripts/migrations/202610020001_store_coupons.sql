-- Cupons de desconto. Sem policy de leitura pública: só admin lista; o checkout valida pelo service role.

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(40) NOT NULL,
  discount_type varchar(20) NOT NULL,
  discount_value numeric(10,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupons_code_unique UNIQUE (code),
  CONSTRAINT coupons_discount_type_check CHECK (discount_type IN ('percent', 'fixed')),
  CONSTRAINT coupons_discount_value_check CHECK (
    (discount_type = 'percent' AND discount_value > 0 AND discount_value <= 100)
    OR (discount_type = 'fixed' AND discount_value > 0)
  )
);

CREATE INDEX IF NOT EXISTS coupons_active_idx ON public.coupons (active);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_code varchar(40);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coupons_admin_all ON public.coupons;
CREATE POLICY coupons_admin_all ON public.coupons
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
