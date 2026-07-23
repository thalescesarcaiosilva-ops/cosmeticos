-- Rastreio simbólico interno (código + eventos de rota)
-- Execute no SQL Editor do Supabase se a migration automática não for aplicada.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_code text,
  ADD COLUMN IF NOT EXISTS carrier text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_simulation_paused boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_code_uidx
  ON public.orders (tracking_code)
  WHERE tracking_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  event_type text NOT NULL
    CHECK (event_type IN (
      'packed',
      'departed',
      'in_transit',
      'arrived_hub',
      'out_for_delivery',
      'delivered'
    )),
  city text NOT NULL,
  state text NOT NULL,
  message text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  occurred_at timestamptz,
  is_manual boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, sequence)
);

CREATE INDEX IF NOT EXISTS tracking_events_order_id_idx
  ON public.tracking_events (order_id, sequence);

CREATE INDEX IF NOT EXISTS tracking_events_pending_idx
  ON public.tracking_events (scheduled_at)
  WHERE occurred_at IS NULL;

ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tracking_events_select_own ON public.tracking_events;
CREATE POLICY tracking_events_select_own
  ON public.tracking_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = tracking_events.order_id
        AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS tracking_events_admin_all ON public.tracking_events;
CREATE POLICY tracking_events_admin_all
  ON public.tracking_events
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
