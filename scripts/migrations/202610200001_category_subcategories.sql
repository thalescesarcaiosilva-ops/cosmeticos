-- Subcategorias (shampoo, condicionador, creme, etc.) ligadas à categoria pai.
-- O produto continua na categoria pai. A home segue só com as categorias raiz.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id
  ON public.categories (parent_id)
  WHERE parent_id IS NOT NULL;

INSERT INTO public.categories (name, slug, parent_id, sort_order, active)
SELECT v.name, v.slug, parent.id, v.sort_order, true
FROM (
  VALUES
    ('cuidados-capilares', 'Shampoo', 'shampoo', 101),
    ('cuidados-capilares', 'Condicionador', 'condicionador', 102),
    ('cuidados-capilares', 'Máscara', 'mascara-capilar', 103),
    ('cuidados-capilares', 'Creme', 'creme-capilar', 104),
    ('cuidados-capilares', 'Óleo', 'oleo-capilar', 105),
    ('cuidados-capilares', 'Sérum', 'serum-capilar', 106),
    ('cuidados-capilares', 'Kits', 'kit-capilar', 107),
    ('cuidados-capilares', 'Acessórios', 'acessorio-capilar', 108),
    ('dermocosmeticos', 'Limpeza', 'limpeza-facial', 111),
    ('dermocosmeticos', 'Sérum', 'serum', 112),
    ('dermocosmeticos', 'Hidratante', 'hidratante', 113),
    ('dermocosmeticos', 'Creme', 'creme', 114),
    ('dermocosmeticos', 'Corpo', 'cuidados-corporais', 115),
    ('dermocosmeticos', 'Tratamento', 'tratamento-facial', 116),
    ('dermocosmeticos', 'Desodorante', 'desodorante', 117),
    ('dermocosmeticos', 'Olhos', 'olhos', 118),
    ('dermocosmeticos', 'Lábios', 'labios', 119),
    ('dermocosmeticos', 'Banho', 'banho', 120),
    ('dermocosmeticos', 'Unhas', 'unhas', 121),
    ('dermocosmeticos', 'Água termal', 'agua-termal', 122),
    ('dermocosmeticos', 'Kits', 'kit-dermocosmetico', 123),
    ('maquiagem', 'Base', 'base', 131),
    ('maquiagem', 'Batom', 'batom', 132),
    ('maquiagem', 'Corretivo', 'corretivo', 133),
    ('maquiagem', 'Gloss', 'gloss', 134),
    ('maquiagem', 'Máscara de cílios', 'mascara-de-cilios', 135),
    ('maquiagem', 'Primer', 'primer', 136),
    ('maquiagem', 'Demaquilante', 'demaquilante', 137),
    ('maquiagem', 'Pincéis', 'pinceis', 138),
    ('protecao-solar', 'Facial', 'protetor-facial', 141),
    ('protecao-solar', 'Com cor', 'protetor-com-cor', 142),
    ('protecao-solar', 'Corporal', 'protetor-corporal', 143),
    ('protecao-solar', 'Stick', 'protetor-stick', 144),
    ('protecao-solar', 'Pó', 'protetor-po', 145),
    ('fraldas-e-lencos-umedecidos', 'Fraldas', 'fraldas', 151),
    ('fraldas-e-lencos-umedecidos', 'Lenços umedecidos', 'lencos-umedecidos', 152)
) AS v(parent_slug, name, slug, sort_order)
JOIN public.categories parent ON parent.slug = v.parent_slug
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order,
  active = true;

INSERT INTO public.product_categories (product_id, category_id)
SELECT DISTINCT p.id, sub.id
FROM public.products p
JOIN public.product_categories pc ON pc.product_id = p.id
JOIN public.categories parent ON parent.id = pc.category_id AND parent.parent_id IS NULL
CROSS JOIN LATERAL (SELECT lower(unaccent(p.name)) AS n) norm
CROSS JOIN LATERAL (
  SELECT CASE parent.slug
    WHEN 'cuidados-capilares' THEN CASE
      WHEN norm.n ~ 'kit' THEN 'kit-capilar'
      WHEN norm.n ~ 'shampoo' OR norm.n ~ '\mbain\M' THEN 'shampoo'
      WHEN norm.n ~ 'condicionador' OR norm.n ~ '\mfondant\M' THEN 'condicionador'
      WHEN norm.n ~ 'mascara|masque|\mmask\M' THEN 'mascara-capilar'
      WHEN norm.n ~ '\moleo\M|\moil\M|elixir' THEN 'oleo-capilar'
      WHEN norm.n ~ 'serum' THEN 'serum-capilar'
      WHEN norm.n ~ 'leave-in|leave in|pentear|styling|geleia|spray|finaliz|creme|locao|uso obrigatorio' THEN 'creme-capilar'
      WHEN norm.n ~ 'escova|pincel' THEN 'acessorio-capilar'
      ELSE NULL
    END
    WHEN 'dermocosmeticos' THEN CASE
      WHEN norm.n ~ 'kit' THEN 'kit-dermocosmetico'
      WHEN norm.n ~ 'desodorante|antitranspirante|perspirex|\mtalco\M' THEN 'desodorante'
      WHEN norm.n ~ 'unha' THEN 'unhas'
      WHEN norm.n ~ 'labial|\mlabio\M|lip repair|\mlips\M' THEN 'labios'
      WHEN norm.n ~ 'olho|olheira' THEN 'olhos'
      WHEN norm.n ~ 'micelar|demaquilante|esfoliante|sabonete|gel de limpeza|\mlimpeza\M|moussant|limpador|espuma de limpeza|gel facial effaclar' THEN 'limpeza-facial'
      WHEN norm.n ~ 'serum' THEN 'serum'
      WHEN norm.n ~ 'banho|douche' THEN 'banho'
      WHEN norm.n ~ 'corporal|\mcorpo\M|pernas|\mpes\M|\mmaos\M|\mmao\M|barriga|estria|assadura|\mcolo\M' THEN 'cuidados-corporais'
      WHEN norm.n ~ 'hidrat|\mlocao\M|baume|moisture|gel creme|gel-creme|pomada' THEN 'hidratante'
      WHEN norm.n ~ '\mcreme\M' THEN 'creme'
      WHEN norm.n ~ 'agua termal|termal' THEN 'agua-termal'
      ELSE 'tratamento-facial'
    END
    WHEN 'maquiagem' THEN CASE
      WHEN norm.n ~ '\mbase\M' THEN 'base'
      WHEN norm.n ~ 'batom|lapis de boca' THEN 'batom'
      WHEN norm.n ~ 'corretivo' THEN 'corretivo'
      WHEN norm.n ~ 'gloss' THEN 'gloss'
      WHEN norm.n ~ 'cilio' THEN 'mascara-de-cilios'
      WHEN norm.n ~ 'primer' THEN 'primer'
      WHEN norm.n ~ 'demaquilante' THEN 'demaquilante'
      WHEN norm.n ~ 'pinc' THEN 'pinceis'
      ELSE NULL
    END
    WHEN 'protecao-solar' THEN CASE
      WHEN norm.n ~ 'stick' THEN 'protetor-stick'
      WHEN norm.n ~ 'po compacto|\mpo\M' THEN 'protetor-po'
      WHEN (norm.n ~ 'corporal' OR norm.n ~ '\mmaos\M' OR norm.n ~ '\mmao\M' OR norm.n ~ '200ml|198g|250ml') AND norm.n !~ 'facial' THEN 'protetor-corporal'
      WHEN norm.n ~ 'com cor|\mcolor\M|tinted' OR (norm.n ~ '\mcor\M' AND norm.n !~ 'sem cor') THEN 'protetor-com-cor'
      ELSE 'protetor-facial'
    END
    WHEN 'fraldas-e-lencos-umedecidos' THEN CASE
      WHEN norm.n ~ 'lenco' THEN 'lencos-umedecidos'
      ELSE 'fraldas'
    END
    ELSE NULL
  END AS slug
) picked
JOIN public.categories sub
  ON sub.slug = picked.slug
 AND sub.parent_id = parent.id
WHERE picked.slug IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.menu_items (label, slug, href, parent_id, has_dropdown, sort_order, visible)
SELECT sub.name, sub.slug, '/colecoes/' || sub.slug, parent_menu.id, false, sub.sort_order, true
FROM public.categories sub
JOIN public.categories parent_cat ON parent_cat.id = sub.parent_id
JOIN public.menu_items parent_menu
  ON parent_menu.slug = parent_cat.slug
 AND parent_menu.parent_id IS NULL
 AND parent_menu.visible = true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.menu_items existing
  WHERE existing.slug = sub.slug
    AND existing.parent_id = parent_menu.id
);

UPDATE public.menu_items parent_menu
SET has_dropdown = true
WHERE parent_menu.parent_id IS NULL
  AND parent_menu.visible = true
  AND EXISTS (
    SELECT 1 FROM public.menu_items child WHERE child.parent_id = parent_menu.id
  );
