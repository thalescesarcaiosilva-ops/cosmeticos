-- Ranking de produtos mais vendidos com base em vendas reais (pedidos pagos),
-- usado pelo fallback do "Compre junto" quando não há pares curados.
-- SECURITY DEFINER: orders/order_items têm RLS restrita (admin/own), então essa
-- função roda com privilégio elevado só para expor a contagem agregada
-- (sem dados pessoais) para o cliente anônimo.

CREATE OR REPLACE FUNCTION public.get_best_selling_products(p_limit int DEFAULT 60)
RETURNS TABLE(product_id uuid, units_sold bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT oi.product_id, SUM(oi.quantity)::bigint AS units_sold
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.status IN ('confirmed', 'shipped', 'delivered')
  GROUP BY oi.product_id
  ORDER BY units_sold DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_best_selling_products(int) TO anon, authenticated;
