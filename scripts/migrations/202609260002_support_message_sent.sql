-- Marca quando o suporte já abriu o WhatsApp daquele pedido.
-- Execute no SQL Editor se a migration automática não for aplicada.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS support_message_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS support_message_sent_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_support_message_sent_by_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_support_message_sent_by_fkey
      FOREIGN KEY (support_message_sent_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
