-- Avaliações e variações de produto

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_email text,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  comment text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  imported_from_csv boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Garante compatibilidade quando a tabela já existia com colunas antigas.
ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS author_email text,
  ADD COLUMN IF NOT EXISTS rating integer,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS imported_from_csv boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS product_reviews_product_id_idx ON public.product_reviews (product_id);
CREATE INDEX IF NOT EXISTS product_reviews_approved_idx ON public.product_reviews (approved);
CREATE INDEX IF NOT EXISTS product_reviews_created_at_idx ON public.product_reviews (created_at DESC);

CREATE TABLE IF NOT EXISTS public.product_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  price numeric(10,2) NOT NULL CHECK (price > 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  media_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Garante compatibilidade quando a tabela já existia com colunas antigas.
ALTER TABLE public.product_variations
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS price numeric(10,2),
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_id uuid,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS product_variations_product_id_idx ON public.product_variations (product_id);
CREATE INDEX IF NOT EXISTS product_variations_sort_order_idx ON public.product_variations (product_id, sort_order);

CREATE OR REPLACE FUNCTION public.touch_product_reviews_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_product_reviews_updated_at ON public.product_reviews;
CREATE TRIGGER trg_touch_product_reviews_updated_at
BEFORE UPDATE ON public.product_reviews
FOR EACH ROW
EXECUTE FUNCTION public.touch_product_reviews_updated_at();

CREATE OR REPLACE FUNCTION public.touch_product_variations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_product_variations_updated_at ON public.product_variations;
CREATE TRIGGER trg_touch_product_variations_updated_at
BEFORE UPDATE ON public.product_variations
FOR EACH ROW
EXECUTE FUNCTION public.touch_product_variations_updated_at();

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_reviews_public_read_approved" ON public.product_reviews;
CREATE POLICY "product_reviews_public_read_approved"
ON public.product_reviews
FOR SELECT
TO anon, authenticated
USING (approved = true);

DROP POLICY IF EXISTS "product_reviews_public_insert" ON public.product_reviews;
CREATE POLICY "product_reviews_public_insert"
ON public.product_reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (approved = false AND imported_from_csv = false);
