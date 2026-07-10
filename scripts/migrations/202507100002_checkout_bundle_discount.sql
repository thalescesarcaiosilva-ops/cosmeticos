-- Corrige create_checkout_order para somar desconto Compre Junto + Pix (antes o Pix substituía o bundle).

CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_shipping_method_id uuid,
  p_items jsonb,
  p_discount_amount numeric DEFAULT 0,
  p_pix_discount_percent numeric DEFAULT 0,
  p_user_id uuid DEFAULT NULL::uuid,
  p_address_id uuid DEFAULT NULL::uuid,
  p_customer jsonb DEFAULT NULL::jsonb,
  p_shipping_address jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    v_shipping_json := jsonb_build_object('street', v_address.street, 'number', v_address.number, 'complement', v_address.complement, 'neighborhood', v_address.neighborhood, 'city', v_address.city, 'state', v_address.state, 'zip_code', v_address.zip_code);
  ELSIF p_shipping_address IS NOT NULL AND p_customer IS NOT NULL THEN
    v_cep := regexp_replace(COALESCE(p_shipping_address->>'zip_code', ''), '\D', '', 'g');
    v_shipping_json := p_shipping_address;
    v_customer_name := NULLIF(trim(p_customer->>'name'), '');
    v_customer_email := NULLIF(trim(p_customer->>'email'), '');
    v_customer_phone := NULLIF(regexp_replace(COALESCE(p_customer->>'phone', ''), '\D', '', 'g'), '');
    IF v_customer_name IS NULL OR v_customer_email IS NULL OR v_customer_phone IS NULL THEN RAISE EXCEPTION 'CUSTOMER_INCOMPLETE'; END IF;
  ELSE
    RAISE EXCEPTION 'ADDRESS_NOT_FOUND';
  END IF;
  IF length(v_cep) <> 8 THEN RAISE EXCEPTION 'INVALID_CEP'; END IF;
  SELECT * INTO v_method FROM shipping_methods WHERE id = p_shipping_method_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHIPPING_NOT_FOUND'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS t(value) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty < 1 OR v_qty > 99 THEN RAISE EXCEPTION 'INVALID_ITEM'; END IF;
    SELECT * INTO v_product FROM products WHERE id = v_product_id AND active = true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
    IF v_product.product_type = 'variable' THEN RAISE EXCEPTION 'VARIABLE_PARENT_NOT_PURCHASABLE'; END IF;
    IF v_product.stock < v_qty THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
    v_subtotal := v_subtotal + (v_product.price * v_qty);
  END LOOP;
  IF v_subtotal <= 0 THEN RAISE EXCEPTION 'EMPTY_CART'; END IF;
  v_shipping_price := resolve_shipping_price(v_method.base_price, v_method.free_above, v_subtotal, v_cep, v_method.cep_rules);
  v_bundle_discount := GREATEST(COALESCE(p_discount_amount, 0), 0);
  v_discount := v_bundle_discount;
  IF COALESCE(p_pix_discount_percent, 0) > 0 THEN
    v_discount := v_discount + ROUND(
      GREATEST(v_subtotal - v_bundle_discount + v_shipping_price, 0) * p_pix_discount_percent / 100,
      2
    );
  END IF;
  v_total := GREATEST(v_subtotal + v_shipping_price - v_discount, 0.01);
  IF p_user_id IS NULL THEN v_guest_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''); END IF;
  IF p_user_id IS NOT NULL AND p_address_id IS NOT NULL THEN
    INSERT INTO orders (user_id, status, subtotal, shipping_price, shipping_method_id, shipping_method_name, discount_amount, total, address_id, shipping_address, payment_status)
    VALUES (p_user_id, 'pending', v_subtotal, v_shipping_price, v_method.id, v_method.name, v_discount, v_total, p_address_id, v_shipping_json, 'pending')
    RETURNING id INTO v_order_id;
  ELSE
    INSERT INTO orders (user_id, status, subtotal, shipping_price, shipping_method_id, shipping_method_name, discount_amount, total, shipping_address, customer_name, customer_email, customer_phone, guest_access_token, payment_status)
    VALUES (p_user_id, 'pending', v_subtotal, v_shipping_price, v_method.id, v_method.name, v_discount, v_total, v_shipping_json, v_customer_name, v_customer_email, v_customer_phone, v_guest_token, 'pending')
    RETURNING id INTO v_order_id;
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS t(value) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    SELECT * INTO v_product FROM products WHERE id = v_product_id FOR UPDATE;
    INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (v_order_id, v_product.id, v_qty, v_product.price);
    UPDATE products SET stock = stock - v_qty, updated_at = now() WHERE id = v_product.id;
  END LOOP;
  RETURN jsonb_build_object('id', v_order_id, 'subtotal', v_subtotal, 'shipping_price', v_shipping_price, 'discount_amount', v_discount, 'total', v_total, 'guest_access_token', v_guest_token);
END;
$function$;
