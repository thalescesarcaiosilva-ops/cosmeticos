-- Remove o desconto de 5% no Pix. Pix continua disponível, sem abatimento no preço.

UPDATE public.site_settings
SET payment_checkout_config = jsonb_set(
  COALESCE(payment_checkout_config, '{}'::jsonb),
  '{pixDiscount}',
  '0'::jsonb,
  true
)
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND COALESCE((payment_checkout_config->>'pixDiscount')::numeric, 0) = 5;
