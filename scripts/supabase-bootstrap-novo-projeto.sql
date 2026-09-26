-- =============================================================================
-- Bootstrap Supabase — loja cosméticos (schema vazio + admin)
-- =============================================================================
-- Como usar:
-- 1. Crie um projeto NOVO no Supabase (vazio).
-- 2. Abra SQL Editor → New query.
-- 3. Cole este arquivo INTEIRO e rode (Run).
-- 4. No app, aponte as env vars para o novo projeto
--    (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).
--
-- O que este script cria:
--   • Extensões, 31 tabelas, constraints, indexes, functions, triggers, RLS
--   • Buckets de storage (+ policies)
--   • Seed mínimo: site_settings (id fixo) + frete PAC/SEDEX
--   • Usuário admin (mesmo e-mail desta loja)
--
-- NÃO cria: produtos, imagens, banners, pedidos, categorias, etc.
--
-- Login admin criado:
--   E-mail: admin@gmail.com
--   Senha:  Admin@Loja2026
--   (troque a senha depois do primeiro login)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0) Extensões
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- -----------------------------------------------------------------------------
-- 1) Helpers simples (sem depender de tabelas)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_search_text(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(unaccent(trim(COALESCE(input, ''))));
$$;

CREATE OR REPLACE FUNCTION public.resolve_shipping_price(
  p_base_price numeric,
  p_free_above numeric,
  p_subtotal numeric,
  p_cep text,
  p_cep_rules jsonb
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_price NUMERIC := COALESCE(p_base_price, 0);
  v_rule JSONB;
  v_prefix TEXT;
  v_matched NUMERIC;
BEGIN
  IF p_cep_rules IS NOT NULL AND jsonb_typeof(p_cep_rules) = 'array' THEN
    FOR v_rule IN SELECT value FROM jsonb_array_elements(p_cep_rules) AS t(value)
    LOOP
      IF v_rule ? 'prefixes' AND jsonb_typeof(v_rule->'prefixes') = 'array' THEN
        FOR v_prefix IN SELECT jsonb_array_elements_text(v_rule->'prefixes')
        LOOP
          IF p_cep LIKE v_prefix || '%' THEN
            v_matched := (v_rule->>'price')::NUMERIC;
            IF v_matched IS NOT NULL THEN v_price := v_matched; END IF;
            EXIT;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;
  IF p_free_above IS NOT NULL AND p_subtotal >= p_free_above THEN RETURN 0; END IF;
  RETURN GREATEST(v_price, 0);
END;
$$;

-- -----------------------------------------------------------------------------
-- 2) Tabelas (ordem respeitando FKs)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name character varying(100) NOT NULL,
  role character varying(20) NOT NULL DEFAULT 'customer',
  cpf character varying(14),
  phone character varying(20),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT profiles_role_check CHECK (role::text = ANY (ARRAY['customer'::text, 'admin'::text, 'support'::text])),
  CONSTRAINT profiles_cpf_key UNIQUE (cpf)
);

CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name character varying(120) NOT NULL,
  slug character varying(120) NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT brands_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name character varying(100) NOT NULL,
  slug character varying(100) NOT NULL,
  image_url text,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  banner_image_url text,
  seal_image_url text,
  page_title character varying(200),
  description text,
  CONSTRAINT categories_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name character varying(200) NOT NULL,
  slug character varying(200) NOT NULL,
  description text,
  price numeric(10,2),
  original_price numeric(10,2),
  stock integer NOT NULL DEFAULT 0,
  images text[] DEFAULT '{}'::text[],
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  short_description text,
  benefits text[] DEFAULT '{}'::text[],
  sku character varying(200),
  gtin character varying(14),
  meta_title character varying(70),
  meta_description character varying(160),
  product_type character varying(20) NOT NULL DEFAULT 'simple',
  parent_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  product_attributes jsonb,
  variation_attributes jsonb,
  woocommerce_id bigint,
  CONSTRAINT products_slug_key UNIQUE (slug),
  CONSTRAINT products_stock_check CHECK (stock >= 0),
  CONSTRAINT products_product_type_check CHECK (
    product_type::text = ANY (ARRAY['simple'::text, 'variable'::text, 'variation'::text])
  ),
  CONSTRAINT products_price_check CHECK (
    (product_type::text = 'variable') OR (price IS NOT NULL AND price > 0)
  )
);

CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename character varying(255) NOT NULL,
  storage_path text NOT NULL,
  bucket character varying(64) NOT NULL DEFAULT 'product-images',
  public_url text NOT NULL,
  mime_type character varying(100) NOT NULL,
  size_bytes integer NOT NULL,
  alt_text character varying(255),
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  thumb_url text,
  medium_url text,
  CONSTRAINT media_assets_size_bytes_check CHECK (size_bytes > 0)
);

CREATE TABLE IF NOT EXISTS public.product_categories (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT product_images_product_id_media_id_key UNIQUE (product_id, media_id)
);

CREATE TABLE IF NOT EXISTS public.product_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name character varying(120) NOT NULL,
  author_email character varying(200) NOT NULL,
  rating smallint NOT NULL,
  title character varying(200),
  comment text NOT NULL,
  status character varying(20) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved boolean NOT NULL DEFAULT false,
  imported_from_csv boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT product_reviews_rating_check CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT product_reviews_status_check CHECK (
    status::text = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])
  )
);

CREATE TABLE IF NOT EXISTS public.product_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  price numeric(10,2) NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  media_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variations_price_check CHECK (price > 0),
  CONSTRAINT product_variations_stock_check CHECK (stock >= 0)
);

CREATE TABLE IF NOT EXISTS public.product_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  companion_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  discount_percent numeric(5,2) NOT NULL DEFAULT 5,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_bundles_discount_percent_check CHECK (
    discount_percent >= 0 AND discount_percent <= 100
  ),
  CONSTRAINT product_bundles_distinct_products CHECK (primary_product_id <> companion_product_id),
  CONSTRAINT product_bundles_unique_pair UNIQUE (primary_product_id, companion_product_id)
);

CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label character varying(50) DEFAULT 'Casa',
  street character varying(200) NOT NULL,
  number character varying(10) NOT NULL,
  complement character varying(100),
  neighborhood character varying(100) NOT NULL,
  city character varying(100) NOT NULL,
  state character(2) NOT NULL,
  zip_code character varying(9) NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipping_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name character varying(100) NOT NULL,
  description text,
  base_price numeric(10,2) NOT NULL DEFAULT 0,
  free_above numeric(10,2),
  estimated_days_min integer,
  estimated_days_max integer,
  cep_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT shipping_methods_base_price_check CHECK (base_price >= 0),
  CONSTRAINT shipping_methods_free_above_check CHECK (free_above IS NULL OR free_above >= 0),
  CONSTRAINT shipping_methods_estimated_days_min_check CHECK (
    estimated_days_min IS NULL OR estimated_days_min >= 0
  ),
  CONSTRAINT shipping_methods_estimated_days_max_check CHECK (
    estimated_days_max IS NULL OR estimated_days_max >= 0
  )
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  status character varying(30) NOT NULL DEFAULT 'pending',
  total numeric(10,2) NOT NULL,
  address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  subtotal numeric(10,2),
  shipping_price numeric(10,2) NOT NULL DEFAULT 0,
  shipping_method_id uuid REFERENCES public.shipping_methods(id) ON DELETE SET NULL,
  shipping_method_name character varying(100),
  payment_status character varying(30) NOT NULL DEFAULT 'pending',
  payment_method character varying(30),
  payout_checkout_id bigint,
  payout_secure_id character varying(100),
  payout_transaction_id bigint,
  customer_document character varying(14),
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  pix_qr_code text,
  pix_expiration timestamptz,
  customer_name text,
  customer_email text,
  customer_phone text,
  shipping_address jsonb,
  guest_access_token text,
  tracking_code text,
  carrier text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  tracking_simulation_paused boolean NOT NULL DEFAULT false,
  thank_you_email_sent_at timestamptz,
  payment_proof_pending boolean NOT NULL DEFAULT false,
  support_message_sent_at timestamptz,
  support_message_sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  allowpay_txid text,
  allowpay_route text,
  veno_deposit_id text,
  track7_synced_at timestamptz,
  track7_last_status text,
  used_buy_together boolean NOT NULL DEFAULT false,
  CONSTRAINT orders_total_check CHECK (total >= 0),
  CONSTRAINT orders_status_check CHECK (
    status::text = ANY (ARRAY[
      'pending'::text, 'confirmed'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text
    ])
  ),
  CONSTRAINT orders_payment_status_check CHECK (
    payment_status::text = ANY (ARRAY[
      'pending'::text, 'paid'::text, 'refused'::text, 'refunded'::text, 'cancelled'::text
    ])
  )
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  subtotal numeric(10,2) GENERATED ALWAYS AS ((quantity)::numeric * unit_price) STORED,
  CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT order_items_unit_price_check CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_event_id text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  payload jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_payout_event_id_key UNIQUE (payout_event_id)
);

CREATE TABLE IF NOT EXISTS public.order_payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  message text,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  file_name text NOT NULL,
  size_bytes integer NOT NULL,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  CONSTRAINT order_payment_proofs_size_bytes_check CHECK (size_bytes > 0),
  CONSTRAINT order_payment_proofs_source_check CHECK (
    source = ANY (ARRAY['checkout'::text, 'thank_you'::text, 'account'::text])
  ),
  CONSTRAINT order_payment_proofs_status_check CHECK (
    status = ANY (ARRAY['pending_review'::text, 'approved'::text, 'rejected'::text])
  )
);

CREATE TABLE IF NOT EXISTS public.tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  event_type text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  message text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  occurred_at timestamptz,
  is_manual boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracking_events_order_id_sequence_key UNIQUE (order_id, sequence),
  CONSTRAINT tracking_events_event_type_check CHECK (
    event_type = ANY (ARRAY[
      'packed'::text, 'departed'::text, 'in_transit'::text,
      'arrived_hub'::text, 'out_for_delivery'::text, 'delivered'::text
    ])
  )
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name character varying(100) NOT NULL DEFAULT 'Sua Loja',
  logo_brand character varying(50) NOT NULL DEFAULT 'sua',
  logo_suffix character varying(50) NOT NULL DEFAULT 'loja',
  logo_tagline character varying(50) DEFAULT 'desde 2024',
  phone_area_code character varying(10) DEFAULT '(11) ',
  phone_number character varying(20) DEFAULT '3333-0000',
  phone_href character varying(30) DEFAULT 'tel:+551133330000',
  help_label character varying(50) DEFAULT 'Ajuda',
  help_href character varying(200) DEFAULT '/paginas/central-de-ajuda',
  updated_at timestamptz DEFAULT now(),
  installment_max integer NOT NULL DEFAULT 12,
  installment_interest_free integer NOT NULL DEFAULT 5,
  installment_min_value numeric(10,2) NOT NULL DEFAULT 5.00,
  installment_interest_rate numeric(5,2) NOT NULL DEFAULT 0,
  installment_text_free text NOT NULL DEFAULT '{count}x de {value} sem juros',
  installment_text_interest text NOT NULL DEFAULT '{count}x de {value} com juros',
  payment_methods jsonb NOT NULL DEFAULT '["visa", "mastercard", "elo", "pix", "boleto"]'::jsonb,
  logo_image_url text,
  cnpj character varying(20),
  company_legal_name character varying(200),
  footer_phone_label character varying(100) DEFAULT 'Ligue para nós',
  business_hours text DEFAULT 'Seg. a sex., das 08h30 às 17h30.',
  contact_whatsapp_label character varying(50) DEFAULT 'WhatsApp',
  contact_whatsapp_href character varying(300),
  contact_page_label character varying(50) DEFAULT 'Fale Conosco',
  contact_page_href character varying(200) DEFAULT '/paginas/fale-conosco',
  footer_social_heading character varying(80) DEFAULT 'Siga a gente:',
  footer_security_heading character varying(80) DEFAULT 'Loja Segura',
  footer_payment_text text DEFAULT 'Pague em até {count}x sem juros com',
  footer_security_text text,
  footer_disclaimers jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo_title character varying(100),
  seo_title_template character varying(100) DEFAULT '%s | Sua Loja',
  seo_description character varying(300),
  seo_og_image_url text,
  contact_email character varying(200),
  payment_method_images jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_address text,
  contact_address_label character varying(100) DEFAULT 'Endereço',
  payment_methods_config jsonb NOT NULL DEFAULT '[]'::jsonb,
  store_description text,
  store_street character varying(200),
  store_street_number character varying(20),
  store_complement character varying(100),
  store_neighborhood character varying(100),
  store_city character varying(100),
  store_state character varying(2),
  store_postal_code character varying(10),
  store_country character varying(2) NOT NULL DEFAULT 'BR',
  store_opening_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  return_enabled boolean NOT NULL DEFAULT false,
  return_days integer,
  return_method character varying(30) NOT NULL DEFAULT 'ReturnByMail',
  return_fees character varying(40) NOT NULL DEFAULT 'FreeReturn',
  return_policy_page_slug character varying(100),
  return_policy_notes text,
  seo_handling_days_min integer NOT NULL DEFAULT 1,
  seo_handling_days_max integer NOT NULL DEFAULT 2,
  google_analytics_id character varying(50),
  google_tag_manager_id character varying(50),
  microsoft_clarity_id character varying(50),
  payment_checkout_config jsonb NOT NULL DEFAULT '{"pixEnabled": true, "cardEnabled": true, "pixDiscount": 0}'::jsonb,
  favicon_url text,
  payment_methods_banner_url text,
  payment_methods_banner_alt text,
  footer_service_heading text,
  footer_payment_heading text,
  product_trust_faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  contact_page_title text DEFAULT 'Central de Atendimento',
  contact_page_intro text,
  contact_page_support_topics jsonb NOT NULL DEFAULT '[
    {"title": "Pedidos e entregas", "description": "Acompanhe prazos, alterações de endereço e status do seu pedido."},
    {"title": "Produtos e estoque", "description": "Tire dúvidas sobre disponibilidade, composição e indicações de uso."},
    {"title": "Trocas e devoluções", "description": "Saiba como solicitar troca ou devolução conforme nossa política."}
  ]'::jsonb,
  installment_interest_rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  google_ads_id character varying(50),
  google_ads_conversion_send_to character varying(100),
  head_scripts text,
  tracking_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  buy_together_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  tracking jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT site_settings_return_method_check CHECK (
    return_method::text = ANY (ARRAY['ReturnByMail'::text, 'ReturnInStore'::text])
  ),
  CONSTRAINT site_settings_return_fees_check CHECK (
    return_fees::text = ANY (ARRAY[
      'FreeReturn'::text, 'ReturnShippingFees'::text, 'RestockingFees'::text
    ])
  )
);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label character varying(100) NOT NULL,
  slug character varying(100) NOT NULL,
  href character varying(200) NOT NULL,
  parent_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  has_dropdown boolean DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.home_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title character varying(120) NOT NULL DEFAULT '',
  alt_text character varying(255),
  link_href character varying(500),
  image_url text NOT NULL,
  storage_path text NOT NULL,
  width integer,
  height integer,
  file_size integer,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  device_target character varying(20) NOT NULL DEFAULT 'both',
  CONSTRAINT home_banners_device_target_check CHECK (
    device_target::text = ANY (ARRAY['both'::text, 'desktop'::text, 'mobile'::text])
  )
);

CREATE TABLE IF NOT EXISTS public.footer_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title character varying(100) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.footer_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.footer_menus(id) ON DELETE CASCADE,
  label character varying(150) NOT NULL,
  href character varying(300) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.footer_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug character varying(100) NOT NULL,
  title character varying(150) NOT NULL,
  content text,
  page_type character varying(30) DEFAULT 'institutional',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0,
  show_in_footer boolean NOT NULL DEFAULT true,
  meta_description character varying(300),
  CONSTRAINT footer_pages_slug_key UNIQUE (slug),
  CONSTRAINT footer_pages_page_type_check CHECK (
    page_type::text = ANY (ARRAY[
      'institutional'::text, 'policy'::text, 'services'::text, 'support'::text
    ])
  )
);

CREATE TABLE IF NOT EXISTS public.footer_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type character varying(20) NOT NULL,
  image_url text NOT NULL,
  alt_text character varying(150),
  href character varying(300),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT footer_assets_asset_type_check CHECK (
    asset_type::text = ANY (ARRAY['payment'::text, 'security'::text])
  )
);

CREATE TABLE IF NOT EXISTS public.policy_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label character varying(100) NOT NULL,
  href character varying(200) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type character varying(20) NOT NULL,
  href character varying(300) NOT NULL,
  label character varying(50) NOT NULL,
  display text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT social_links_type_check CHECK (
    type::text = ANY (ARRAY['whatsapp'::text, 'facebook'::text, 'instagram'::text])
  )
);

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name character varying(200) NOT NULL,
  email character varying(200) NOT NULL,
  phone character varying(30),
  subject character varying(200) NOT NULL,
  message text NOT NULL,
  status character varying(20) NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  replied_at timestamptz,
  last_reply_preview text,
  CONSTRAINT contact_messages_status_check CHECK (
    status::text = ANY (ARRAY['new'::text, 'read'::text, 'archived'::text])
  )
);

CREATE TABLE IF NOT EXISTS public.contact_message_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.contact_messages(id) ON DELETE CASCADE,
  body text NOT NULL,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_views_daily (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT CURRENT_DATE,
  views integer NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, day),
  CONSTRAINT product_views_daily_views_check CHECK (views >= 0)
);

CREATE TABLE IF NOT EXISTS public.not_found_paths (
  path text PRIMARY KEY,
  hits integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  sample_referrer text,
  CONSTRAINT not_found_paths_hits_check CHECK (hits >= 0)
);

-- -----------------------------------------------------------------------------
-- 2b) Functions que dependem de profiles
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  jwt_role text;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  jwt_role := current_setting('request.jwt.claim.role', true);
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_admin() THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'),
    'customer'
  )
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name;
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'handle_new_user error: %', SQLERRM;
    RAISE;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3) Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_addresses_user ON public.addresses (user_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON public.contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages (status);
CREATE INDEX IF NOT EXISTS contact_message_replies_message_id_idx ON public.contact_message_replies (message_id);
CREATE INDEX IF NOT EXISTS idx_footer_assets_type_sort ON public.footer_assets (asset_type, sort_order) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_footer_menu_items_menu ON public.footer_menu_items (menu_id, sort_order) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_footer_menus_sort ON public.footer_menus (sort_order) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_footer_pages_sort ON public.footer_pages (page_type, sort_order)
  WHERE active = true AND show_in_footer = true;
CREATE INDEX IF NOT EXISTS idx_home_banners_sort ON public.home_banners (sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_created ON public.media_assets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_items_sort ON public.menu_items (sort_order) WHERE visible = true;
CREATE INDEX IF NOT EXISTS not_found_paths_hits_idx ON public.not_found_paths (hits DESC, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS order_payment_proofs_order_id_idx ON public.order_payment_proofs (order_id);
CREATE INDEX IF NOT EXISTS order_payment_proofs_status_idx ON public.order_payment_proofs (status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_payout_checkout ON public.orders (payout_checkout_id);
CREATE INDEX IF NOT EXISTS idx_orders_payout_secure ON public.orders (payout_secure_id);
CREATE INDEX IF NOT EXISTS idx_orders_payout_transaction ON public.orders (payout_transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_guest_access_token
  ON public.orders (guest_access_token) WHERE guest_access_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_buy_together
  ON public.orders (used_buy_together) WHERE used_buy_together = true;
CREATE INDEX IF NOT EXISTS orders_allowpay_txid_idx
  ON public.orders (allowpay_txid) WHERE allowpay_txid IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_tracking_code_idx
  ON public.orders (tracking_code) WHERE tracking_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_code_uidx
  ON public.orders (tracking_code) WHERE tracking_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_veno_deposit_id_idx
  ON public.orders (veno_deposit_id) WHERE veno_deposit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_bundles_primary
  ON public.product_bundles (primary_product_id, sort_order) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON public.product_categories (category_id);
CREATE INDEX IF NOT EXISTS idx_product_favorites_user ON public.product_favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images (product_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_reviews_product_email
  ON public.product_reviews (product_id, lower(author_email::text));
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status
  ON public.product_reviews (product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS product_reviews_approved_idx ON public.product_reviews (approved);
CREATE INDEX IF NOT EXISTS product_reviews_created_at_idx ON public.product_reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS product_reviews_product_id_idx ON public.product_reviews (product_id);
CREATE INDEX IF NOT EXISTS product_variations_product_id_idx ON public.product_variations (product_id);
CREATE INDEX IF NOT EXISTS product_variations_sort_order_idx ON public.product_variations (product_id, sort_order);
CREATE INDEX IF NOT EXISTS product_views_daily_day_idx ON public.product_views_daily (day DESC);
CREATE INDEX IF NOT EXISTS idx_products_catalog ON public.products (active, product_type)
  WHERE product_type::text = ANY (ARRAY['simple'::text, 'variable'::text]);
CREATE INDEX IF NOT EXISTS idx_products_parent_id ON public.products (parent_id) WHERE parent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_unique
  ON public.products (sku) WHERE sku IS NOT NULL AND sku::text <> '';
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products (slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_woocommerce_id
  ON public.products (woocommerce_id) WHERE woocommerce_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipping_methods_sort
  ON public.shipping_methods (sort_order) WHERE active = true;
CREATE INDEX IF NOT EXISTS tracking_events_order_id_idx ON public.tracking_events (order_id, sequence);
CREATE INDEX IF NOT EXISTS tracking_events_pending_idx
  ON public.tracking_events (scheduled_at) WHERE occurred_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_order ON public.webhook_events (order_id);

-- -----------------------------------------------------------------------------
-- 4) Functions de negócio (checkout / analytics / busca)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_shipping_method_id uuid,
  p_items jsonb,
  p_discount_amount numeric DEFAULT 0,
  p_pix_discount_percent numeric DEFAULT 0,
  p_user_id uuid DEFAULT NULL,
  p_address_id uuid DEFAULT NULL,
  p_customer jsonb DEFAULT NULL,
  p_shipping_address jsonb DEFAULT NULL,
  p_used_buy_together boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_address addresses%ROWTYPE;
  v_item JSONB;
  v_product products%ROWTYPE;
  v_method shipping_methods%ROWTYPE;
  v_subtotal NUMERIC(10, 2) := 0;
  v_shipping_price NUMERIC(10, 2);
  v_bundle_discount NUMERIC(10, 2);
  v_discount NUMERIC(10, 2);
  v_total NUMERIC(10, 2);
  v_order_id UUID;
  v_qty INT;
  v_cep TEXT;
  v_product_id UUID;
  v_customer_name TEXT;
  v_customer_email TEXT;
  v_customer_phone TEXT;
  v_shipping_json JSONB;
  v_guest_token TEXT;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'EMPTY_CART'; END IF;

  IF p_user_id IS NOT NULL AND p_address_id IS NOT NULL THEN
    SELECT * INTO v_address FROM addresses WHERE id = p_address_id AND user_id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'ADDRESS_NOT_FOUND'; END IF;
    v_cep := regexp_replace(COALESCE(v_address.zip_code, ''), '\D', '', 'g');
    v_shipping_json := jsonb_build_object(
      'street', v_address.street,
      'number', v_address.number,
      'complement', v_address.complement,
      'neighborhood', v_address.neighborhood,
      'city', v_address.city,
      'state', v_address.state,
      'zip_code', v_address.zip_code
    );
  ELSIF p_shipping_address IS NOT NULL AND p_customer IS NOT NULL THEN
    v_cep := regexp_replace(COALESCE(p_shipping_address->>'zip_code', ''), '\D', '', 'g');
    v_shipping_json := p_shipping_address;
    v_customer_name := NULLIF(trim(p_customer->>'name'), '');
    v_customer_email := NULLIF(trim(p_customer->>'email'), '');
    v_customer_phone := NULLIF(regexp_replace(COALESCE(p_customer->>'phone', ''), '\D', '', 'g'), '');
    IF v_customer_name IS NULL OR v_customer_email IS NULL OR v_customer_phone IS NULL THEN
      RAISE EXCEPTION 'CUSTOMER_INCOMPLETE';
    END IF;
  ELSE
    RAISE EXCEPTION 'ADDRESS_NOT_FOUND';
  END IF;

  IF length(v_cep) <> 8 THEN RAISE EXCEPTION 'INVALID_CEP'; END IF;

  SELECT * INTO v_method FROM shipping_methods WHERE id = p_shipping_method_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHIPPING_NOT_FOUND'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS t(value) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty < 1 OR v_qty > 99 THEN
      RAISE EXCEPTION 'INVALID_ITEM';
    END IF;
    SELECT * INTO v_product FROM products WHERE id = v_product_id AND active = true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
    IF v_product.product_type = 'variable' THEN RAISE EXCEPTION 'VARIABLE_PARENT_NOT_PURCHASABLE'; END IF;
    IF v_product.stock < v_qty THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
    v_subtotal := v_subtotal + (v_product.price * v_qty);
  END LOOP;

  IF v_subtotal <= 0 THEN RAISE EXCEPTION 'EMPTY_CART'; END IF;

  v_shipping_price := resolve_shipping_price(
    v_method.base_price, v_method.free_above, v_subtotal, v_cep, v_method.cep_rules
  );
  v_bundle_discount := GREATEST(COALESCE(p_discount_amount, 0), 0);
  v_discount := v_bundle_discount;
  IF COALESCE(p_pix_discount_percent, 0) > 0 THEN
    v_discount := v_discount + ROUND(
      GREATEST(v_subtotal - v_bundle_discount + v_shipping_price, 0) * p_pix_discount_percent / 100,
      2
    );
  END IF;
  v_total := GREATEST(v_subtotal + v_shipping_price - v_discount, 0.01);

  IF p_user_id IS NULL THEN
    v_guest_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  END IF;

  IF p_user_id IS NOT NULL AND p_address_id IS NOT NULL THEN
    INSERT INTO orders (
      user_id, status, subtotal, shipping_price, shipping_method_id, shipping_method_name,
      discount_amount, total, address_id, shipping_address, payment_status, used_buy_together
    ) VALUES (
      p_user_id, 'pending', v_subtotal, v_shipping_price, v_method.id, v_method.name,
      v_discount, v_total, p_address_id, v_shipping_json, 'pending', p_used_buy_together
    )
    RETURNING id INTO v_order_id;
  ELSE
    INSERT INTO orders (
      user_id, status, subtotal, shipping_price, shipping_method_id, shipping_method_name,
      discount_amount, total, shipping_address, customer_name, customer_email, customer_phone,
      guest_access_token, payment_status, used_buy_together
    ) VALUES (
      p_user_id, 'pending', v_subtotal, v_shipping_price, v_method.id, v_method.name,
      v_discount, v_total, v_shipping_json, v_customer_name, v_customer_email, v_customer_phone,
      v_guest_token, 'pending', p_used_buy_together
    )
    RETURNING id INTO v_order_id;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS t(value) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    SELECT * INTO v_product FROM products WHERE id = v_product_id FOR UPDATE;
    INSERT INTO order_items (order_id, product_id, quantity, unit_price)
    VALUES (v_order_id, v_product.id, v_qty, v_product.price);
    UPDATE products SET stock = stock - v_qty, updated_at = now() WHERE id = v_product.id;
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'subtotal', v_subtotal,
    'shipping_price', v_shipping_price,
    'discount_amount', v_discount,
    'total', v_total,
    'guest_access_token', v_guest_token
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_order_payment(
  p_order_id uuid,
  p_payment_method text DEFAULT NULL,
  p_payout_transaction_id bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE orders
  SET
    status = 'confirmed',
    payment_status = 'paid',
    payment_method = COALESCE(p_payment_method, payment_method),
    payout_transaction_id = COALESCE(p_payout_transaction_id, payout_transaction_id),
    updated_at = now()
  WHERE id = p_order_id AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_order_and_restore_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_item RECORD;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_order.status <> 'pending' OR v_order.payment_status = 'paid' THEN RETURN; END IF;
  FOR v_item IN
    SELECT product_id, quantity FROM order_items
    WHERE order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    UPDATE products SET stock = stock + v_item.quantity, updated_at = now()
    WHERE id = v_item.product_id;
  END LOOP;
  UPDATE orders
  SET status = 'cancelled', payment_status = 'cancelled', updated_at = now()
  WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_store_products(
  search_query text,
  result_limit integer DEFAULT 24
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH normalized AS (
    SELECT normalize_search_text(search_query) AS term
  )
  SELECT p.id
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  CROSS JOIN normalized n
  WHERE p.active = true
    AND COALESCE(p.product_type, 'simple') <> 'variation'
    AND length(n.term) >= 2
    AND (
      normalize_search_text(p.name) LIKE '%' || n.term || '%' ESCAPE '\'
      OR normalize_search_text(COALESCE(p.sku, '')) LIKE '%' || n.term || '%' ESCAPE '\'
      OR normalize_search_text(COALESCE(b.name, '')) LIKE '%' || n.term || '%' ESCAPE '\'
    )
  ORDER BY p.name ASC
  LIMIT GREATEST(1, LEAST(result_limit, 100));
$$;

CREATE OR REPLACE FUNCTION public.get_best_selling_products(p_limit integer DEFAULT 60)
RETURNS TABLE(product_id uuid, units_sold bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT oi.product_id, SUM(oi.quantity)::bigint AS units_sold
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.status IN ('confirmed', 'shipped', 'delivered')
  GROUP BY oi.product_id
  ORDER BY units_sold DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.increment_product_view(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.product_views_daily (product_id, day, views)
  VALUES (p_product_id, CURRENT_DATE, 1)
  ON CONFLICT (product_id, day)
  DO UPDATE SET views = public.product_views_daily.views + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_not_found(p_path text, p_referrer text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.not_found_paths (path, hits, last_seen_at, sample_referrer)
  VALUES (p_path, 1, now(), NULLIF(trim(p_referrer), ''))
  ON CONFLICT (path)
  DO UPDATE SET
    hits = public.not_found_paths.hits + 1,
    last_seen_at = now(),
    sample_referrer = COALESCE(
      NULLIF(trim(p_referrer), ''),
      public.not_found_paths.sample_referrer
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_order_payment_proof_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.orders o
  SET payment_proof_pending = EXISTS (
    SELECT 1
    FROM public.order_payment_proofs p
    WHERE p.order_id = COALESCE(NEW.order_id, OLD.order_id)
      AND p.status = 'pending_review'
  )
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_product_reviews_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_product_variations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5) Triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_escalation();

DROP TRIGGER IF EXISTS set_updated_at_products ON public.products;
CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_orders ON public.orders;
CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_shipping_methods ON public.shipping_methods;
CREATE TRIGGER set_updated_at_shipping_methods
  BEFORE UPDATE ON public.shipping_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_footer_menus ON public.footer_menus;
CREATE TRIGGER set_updated_at_footer_menus
  BEFORE UPDATE ON public.footer_menus
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_footer_pages ON public.footer_pages;
CREATE TRIGGER set_updated_at_footer_pages
  BEFORE UPDATE ON public.footer_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_product_reviews ON public.product_reviews;
CREATE TRIGGER set_updated_at_product_reviews
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_touch_product_reviews_updated_at ON public.product_reviews;
CREATE TRIGGER trg_touch_product_reviews_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_product_reviews_updated_at();

DROP TRIGGER IF EXISTS trg_touch_product_variations_updated_at ON public.product_variations;
CREATE TRIGGER trg_touch_product_variations_updated_at
  BEFORE UPDATE ON public.product_variations
  FOR EACH ROW EXECUTE FUNCTION public.touch_product_variations_updated_at();

DROP TRIGGER IF EXISTS trg_sync_order_payment_proof_pending ON public.order_payment_proofs;
CREATE TRIGGER trg_sync_order_payment_proof_pending
  AFTER INSERT OR UPDATE OR DELETE ON public.order_payment_proofs
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_payment_proof_pending();

-- -----------------------------------------------------------------------------
-- 6) RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footer_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footer_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footer_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footer_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_message_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_views_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.not_found_paths ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin ON public.profiles FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS profiles_insert_service ON public.profiles;
CREATE POLICY profiles_insert_service ON public.profiles
  FOR INSERT TO supabase_auth_admin WITH CHECK (true);

-- brands / categories / products / media
DROP POLICY IF EXISTS brands_public_read ON public.brands;
CREATE POLICY brands_public_read ON public.brands FOR SELECT USING (active = true);
DROP POLICY IF EXISTS brands_admin_all ON public.brands;
CREATE POLICY brands_admin_all ON public.brands FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS categories_public_read ON public.categories;
CREATE POLICY categories_public_read ON public.categories FOR SELECT USING (active = true);
DROP POLICY IF EXISTS categories_admin_all ON public.categories;
CREATE POLICY categories_admin_all ON public.categories FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read ON public.products FOR SELECT USING (active = true);
DROP POLICY IF EXISTS products_admin_all ON public.products;
CREATE POLICY products_admin_all ON public.products FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS media_public_read ON public.media_assets;
CREATE POLICY media_public_read ON public.media_assets FOR SELECT USING (true);
DROP POLICY IF EXISTS media_admin_all ON public.media_assets;
CREATE POLICY media_admin_all ON public.media_assets FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS product_categories_public_read ON public.product_categories;
CREATE POLICY product_categories_public_read ON public.product_categories FOR SELECT
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_categories.product_id AND p.active = true));
DROP POLICY IF EXISTS product_categories_admin_all ON public.product_categories;
CREATE POLICY product_categories_admin_all ON public.product_categories
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS product_images_public_read ON public.product_images;
CREATE POLICY product_images_public_read ON public.product_images FOR SELECT
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_images.product_id AND p.active = true));
DROP POLICY IF EXISTS product_images_admin_all ON public.product_images;
CREATE POLICY product_images_admin_all ON public.product_images
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS product_favorites_own ON public.product_favorites;
CREATE POLICY product_favorites_own ON public.product_favorites
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS product_reviews_public_read_approved ON public.product_reviews;
CREATE POLICY product_reviews_public_read_approved ON public.product_reviews
  FOR SELECT TO anon, authenticated USING (approved = true);
DROP POLICY IF EXISTS product_reviews_public_insert ON public.product_reviews;
CREATE POLICY product_reviews_public_insert ON public.product_reviews
  FOR INSERT TO anon, authenticated WITH CHECK (approved = false AND imported_from_csv = false);
DROP POLICY IF EXISTS product_reviews_admin_all ON public.product_reviews;
CREATE POLICY product_reviews_admin_all ON public.product_reviews
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS product_bundles_public_read ON public.product_bundles;
CREATE POLICY product_bundles_public_read ON public.product_bundles
  FOR SELECT TO anon, authenticated USING (active = true);
DROP POLICY IF EXISTS product_bundles_admin_all ON public.product_bundles;
CREATE POLICY product_bundles_admin_all ON public.product_bundles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text = 'admin'));

-- addresses / shipping / orders
DROP POLICY IF EXISTS addresses_select_own ON public.addresses;
CREATE POLICY addresses_select_own ON public.addresses FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS addresses_insert_own ON public.addresses;
CREATE POLICY addresses_insert_own ON public.addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS addresses_update_own ON public.addresses;
CREATE POLICY addresses_update_own ON public.addresses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS addresses_delete_own ON public.addresses;
CREATE POLICY addresses_delete_own ON public.addresses FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS addresses_admin_all ON public.addresses;
CREATE POLICY addresses_admin_all ON public.addresses FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS shipping_methods_public_read ON public.shipping_methods;
CREATE POLICY shipping_methods_public_read ON public.shipping_methods FOR SELECT USING (active = true);
DROP POLICY IF EXISTS shipping_methods_admin_all ON public.shipping_methods;
CREATE POLICY shipping_methods_admin_all ON public.shipping_methods
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS orders_select_own ON public.orders;
CREATE POLICY orders_select_own ON public.orders FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS orders_admin_all ON public.orders;
CREATE POLICY orders_admin_all ON public.orders FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS order_items_select_own ON public.order_items;
CREATE POLICY order_items_select_own ON public.order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS order_items_admin_all ON public.order_items;
CREATE POLICY order_items_admin_all ON public.order_items
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS tracking_events_select_own ON public.tracking_events;
CREATE POLICY tracking_events_select_own ON public.tracking_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = tracking_events.order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS tracking_events_admin_all ON public.tracking_events;
CREATE POLICY tracking_events_admin_all ON public.tracking_events
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- CMS
DROP POLICY IF EXISTS site_settings_public_read ON public.site_settings;
CREATE POLICY site_settings_public_read ON public.site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS site_settings_admin_all ON public.site_settings;
CREATE POLICY site_settings_admin_all ON public.site_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS menu_items_public_read ON public.menu_items;
CREATE POLICY menu_items_public_read ON public.menu_items FOR SELECT USING (visible = true);
DROP POLICY IF EXISTS menu_items_admin_all ON public.menu_items;
CREATE POLICY menu_items_admin_all ON public.menu_items FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS home_banners_public_read ON public.home_banners;
CREATE POLICY home_banners_public_read ON public.home_banners FOR SELECT USING (active = true);
DROP POLICY IF EXISTS home_banners_admin_all ON public.home_banners;
CREATE POLICY home_banners_admin_all ON public.home_banners
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS footer_menus_public_read ON public.footer_menus;
CREATE POLICY footer_menus_public_read ON public.footer_menus FOR SELECT USING (active = true);
DROP POLICY IF EXISTS footer_menus_admin_all ON public.footer_menus;
CREATE POLICY footer_menus_admin_all ON public.footer_menus
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS footer_menu_items_public_read ON public.footer_menu_items;
CREATE POLICY footer_menu_items_public_read ON public.footer_menu_items FOR SELECT
  USING (active = true AND EXISTS (
    SELECT 1 FROM footer_menus m WHERE m.id = footer_menu_items.menu_id AND m.active = true
  ));
DROP POLICY IF EXISTS footer_menu_items_admin_all ON public.footer_menu_items;
CREATE POLICY footer_menu_items_admin_all ON public.footer_menu_items
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS footer_pages_public_read ON public.footer_pages;
CREATE POLICY footer_pages_public_read ON public.footer_pages FOR SELECT USING (active = true);
DROP POLICY IF EXISTS footer_pages_admin_all ON public.footer_pages;
CREATE POLICY footer_pages_admin_all ON public.footer_pages
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS footer_assets_public_read ON public.footer_assets;
CREATE POLICY footer_assets_public_read ON public.footer_assets FOR SELECT USING (active = true);
DROP POLICY IF EXISTS footer_assets_admin_all ON public.footer_assets;
CREATE POLICY footer_assets_admin_all ON public.footer_assets
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS policy_links_public_read ON public.policy_links;
CREATE POLICY policy_links_public_read ON public.policy_links FOR SELECT USING (active = true);
DROP POLICY IF EXISTS policy_links_admin_all ON public.policy_links;
CREATE POLICY policy_links_admin_all ON public.policy_links
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS social_links_public_read ON public.social_links;
CREATE POLICY social_links_public_read ON public.social_links FOR SELECT USING (active = true);
DROP POLICY IF EXISTS social_links_admin_all ON public.social_links;
CREATE POLICY social_links_admin_all ON public.social_links
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- contact / webhook / proofs / analytics: sem policies públicas (só service_role)

-- -----------------------------------------------------------------------------
-- 7) Grants
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8) Storage buckets + policies
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('categories', 'categories', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('banners', 'banners', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('site-assets', 'site-assets', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('payment-proofs', 'payment-proofs', false, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/jpg','application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS storage_public_read ON storage.objects;
CREATE POLICY storage_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = ANY (ARRAY['product-images'::text, 'categories'::text, 'banners'::text, 'site-assets'::text]));

DROP POLICY IF EXISTS storage_admin_write ON storage.objects;
CREATE POLICY storage_admin_write ON storage.objects
  FOR ALL
  USING (
    bucket_id = ANY (ARRAY['product-images'::text, 'categories'::text, 'banners'::text, 'site-assets'::text])
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = ANY (ARRAY['product-images'::text, 'categories'::text, 'banners'::text, 'site-assets'::text])
    AND public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- 9) Seed mínimo (sem catálogo)
-- -----------------------------------------------------------------------------
INSERT INTO public.site_settings (id, store_name, logo_brand, logo_suffix, logo_tagline)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Sua Loja',
  'sua',
  'loja',
  'desde 2024'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shipping_methods (
  id, name, base_price, free_above, estimated_days_min, estimated_days_max, sort_order, active
) VALUES
  ('2959697f-dd83-47e3-8481-4248e0dbc3d9', 'PAC', 19.90, 150.00, 3, 4, 0, true),
  ('ea22a1fd-e71d-45c6-844e-19bdd58a3d28', 'SEDEX', 24.90, NULL, 2, 3, 1, true)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =============================================================================
-- 10) Admin (fora da transaction principal — auth)
-- =============================================================================
-- E-mail: admin@gmail.com
-- Senha:  Admin@Loja2026
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_email text := 'admin@gmail.com';
  v_password text := 'Admin@Loja2026';
  v_encrypted text;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;
    UPDATE public.profiles
    SET role = 'admin', name = COALESCE(NULLIF(name, ''), 'Admin')
    WHERE id = v_user_id;
    RAISE NOTICE 'Admin já existia; role atualizado para admin (%).', v_email;
    RETURN;
  END IF;

  v_encrypted := crypt(v_password, gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    v_encrypted,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Admin"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  UPDATE public.profiles
  SET role = 'admin', name = 'Admin'
  WHERE id = v_user_id;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    INSERT INTO public.profiles (id, name, role)
    VALUES (v_user_id, 'Admin', 'admin');
  END IF;

  RAISE NOTICE 'Admin criado: % / senha Admin@Loja2026', v_email;
END $$;
