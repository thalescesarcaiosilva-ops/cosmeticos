-- Track7 sync metadata on orders
-- Pedidos existentes (rastreio interno BC…BR) continuam iguais;
-- pedidos novos syncados na Track7 usam estes campos.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS track7_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS track7_last_status text;

CREATE INDEX IF NOT EXISTS orders_tracking_code_idx
  ON public.orders (tracking_code)
  WHERE tracking_code IS NOT NULL;

COMMENT ON COLUMN public.orders.track7_synced_at IS 'When the order was successfully synced to Track7';
COMMENT ON COLUMN public.orders.track7_last_status IS 'Last known Track7 status string';
