-- Preço riscado da vitrine: 40% acima do preço de venda. Não altera o preço cobrado.

UPDATE public.products
SET original_price = ROUND(price * 1.40, 2)
WHERE price > 0;
