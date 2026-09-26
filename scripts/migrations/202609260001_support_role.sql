-- Papel de suporte: só a fila de pedidos, sem permissão de administrador.
-- Execute no SQL Editor se a migration automática não for aplicada.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role::text = ANY (ARRAY['customer'::text, 'admin'::text, 'support'::text]));
