-- Adiciona campo para rastrear pedidos que usaram "Compre junto"

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS used_buy_together boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN orders.used_buy_together IS 'Indica se o pedido foi feito usando a funcionalidade "Compre junto" (bundle discount)';

-- Criar índice para facilitar análises no admin
CREATE INDEX IF NOT EXISTS idx_orders_buy_together ON orders(used_buy_together) WHERE used_buy_together = true;
