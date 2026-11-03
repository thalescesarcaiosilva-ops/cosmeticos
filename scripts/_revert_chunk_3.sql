UPDATE products AS p
SET
  price = v.new_price,
  original_price = CASE
    WHEN p.id = 'b2962245-93db-4e1e-8a59-dcc059dbbb1c'::uuid
      THEN GREATEST(COALESCE(p.original_price, 0), v.old_price)
    WHEN p.original_price IS NOT NULL AND abs(p.original_price - v.old_price) < 0.01
      THEN NULL
    WHEN p.original_price IS NOT NULL AND p.original_price > v.new_price
      THEN p.original_price
    ELSE p.original_price
  END,
  updated_at = now()
FROM (VALUES
('0c8d0c1f-7416-4a35-abe5-d76c0bb39df8'::uuid, 188.28::numeric, 188.28::numeric),
('f5441a66-db53-4f10-a4a1-e20e3a51b0ef'::uuid, 44.85::numeric, 44.85::numeric),
('f2b19c19-e03a-4da4-a064-51bb11c5b6c3'::uuid, 149.58::numeric, 149.58::numeric),
('ea2bbe7c-56df-47fd-9dbf-29840a9b2cfb'::uuid, 22.71::numeric, 22.71::numeric),
('2b654f83-5246-46a7-8713-7ba212169200'::uuid, 64.98::numeric, 64.98::numeric),
('58327b22-1fd8-483c-9651-78af0880eadf'::uuid, 27.4::numeric, 27.4::numeric),
('05832f19-61a7-4b4d-b418-05b949dcb95d'::uuid, 129.9::numeric, 129.9::numeric),
('0f3079ef-6a68-4797-b66f-a59187bd5752'::uuid, 158.52::numeric, 158.52::numeric),
('b7bf52dd-04bf-4858-a961-dc2d5718df30'::uuid, 42.2::numeric, 42.2::numeric),
('23bc44ed-1a1c-432b-a73f-d73c66056e70'::uuid, 18.69::numeric, 18.69::numeric),
('5eba858e-7d9a-4990-be1a-c87eeb01f823'::uuid, 84.35::numeric, 84.35::numeric),
('e89e4f7f-5e53-4f9e-bf38-18b96a25329d'::uuid, 77.39::numeric, 77.39::numeric),
('a13f8323-b183-4631-9117-684a2ba2669b'::uuid, 49.58::numeric, 49.58::numeric),
('8e3ab4c0-396d-4262-a67b-189cc2098ef7'::uuid, 89.3::numeric, 89.3::numeric),
('0167e0f7-f159-42dd-89fc-516d76088f43'::uuid, 50.65::numeric, 50.65::numeric),
('56ee3a99-a692-4219-aaf1-e3cc9b883cdb'::uuid, 20.76::numeric, 20.76::numeric),
('f73aa141-264f-4525-b92b-6c15f0a6f5cf'::uuid, 64.85::numeric, 64.85::numeric),
('b8b51efd-9327-4019-911e-1cc9b2f2a16d'::uuid, 56.4::numeric, 56.4::numeric),
('9a70afc3-38ec-4c1a-a6dd-942b95e03776'::uuid, 72.82::numeric, 72.82::numeric),
('a1210eae-bc4d-4174-9d1c-f7105324dc1e'::uuid, 62.57::numeric, 62.57::numeric),
('136c1753-60a8-475a-92c5-45eef3ae8668'::uuid, 77.05::numeric, 77.05::numeric),
('beae330f-b4c5-45d7-a484-884f6b3fb02c'::uuid, 91.19::numeric, 91.19::numeric),
('fa5ff243-135e-4c3a-b597-102a77d4a6e3'::uuid, 100.36::numeric, 100.36::numeric)
) AS v(id, new_price, old_price)
WHERE p.id = v.id
RETURNING p.id, p.name, p.price;