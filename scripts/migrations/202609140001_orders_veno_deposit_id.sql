-- Veno Payments: id do depósito PIX / cobrança
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS veno_deposit_id text;

CREATE INDEX IF NOT EXISTS orders_veno_deposit_id_idx
  ON public.orders (veno_deposit_id)
  WHERE veno_deposit_id IS NOT NULL;

COMMENT ON COLUMN public.orders.veno_deposit_id IS
  'UUID do depósito/cobrança na Veno Payments (GET /api/v1/pix/{id}/status)';
