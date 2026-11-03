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
('85e31408-35be-4e0e-bbf9-bec3c1c395c3'::uuid, 167.53::numeric, 167.53::numeric),
('9d646b9c-95ef-4c25-88a1-4f18d88fa220'::uuid, 51.52::numeric, 51.52::numeric),
('50f0f935-f324-48e7-8713-3c846d7ef06a'::uuid, 47.91::numeric, 47.91::numeric),
('c360772e-91a8-4357-918f-fb11b183ed4d'::uuid, 189.83::numeric, 189.83::numeric),
('96ed973d-e50f-42b2-9e35-3c5e470ded0a'::uuid, 139.96::numeric, 139.96::numeric),
('6f3c0338-67f8-4e19-af29-5dbd41cc7aff'::uuid, 69.38::numeric, 69.38::numeric),
('ccafd05f-e7b4-4603-a3f0-9eac89559d26'::uuid, 153.38::numeric, 153.38::numeric),
('fa9a2b6f-a8a4-41e7-9bad-4e54b55901d6'::uuid, 47.55::numeric, 47.55::numeric),
('7edef49b-a7e0-4c70-bc89-7338aa76281d'::uuid, 58.83::numeric, 58.83::numeric),
('537d2fd9-c96f-4068-86e4-53d5f7cafd1c'::uuid, 209.64::numeric, 209.64::numeric),
('168076cb-b86e-449a-bb29-fda4f4066047'::uuid, 73.16::numeric, 73.16::numeric),
('f96c8bb4-2826-4db2-a7a2-70845037766a'::uuid, 21.01::numeric, 21.01::numeric),
('606d1537-0c6b-4300-9681-eebebebd6e5f'::uuid, 79.73::numeric, 79.73::numeric),
('05c4954b-64df-4e24-acf1-38daa09404e9'::uuid, 80.92::numeric, 80.92::numeric),
('d384ef52-819b-4077-bd54-43221f4797b7'::uuid, 26.13::numeric, 26.13::numeric),
('0fed3267-8b40-44ed-85ad-c6a4dab04ea0'::uuid, 57.86::numeric, 57.86::numeric),
('3583cb7a-04b4-422a-b7dd-8f92f7aaa38f'::uuid, 39.81::numeric, 39.81::numeric),
('97eebd8b-5075-4fb2-a316-c27819187a17'::uuid, 27.4::numeric, 27.4::numeric),
('b151a9ba-36c3-40c2-a5a0-cd358ac1aabe'::uuid, 27.4::numeric, 27.4::numeric),
('6b1c7693-fb84-41f9-99bb-4e45727fa903'::uuid, 133.93::numeric, 133.93::numeric),
('331f877f-38b0-433b-bd9e-874379c8ffa5'::uuid, 79.27::numeric, 79.27::numeric),
('ffba4b02-02ca-4535-a06d-8a0fb604865a'::uuid, 37.47::numeric, 37.47::numeric),
('4bc5ca9f-b64d-4150-97fa-edbfacd37142'::uuid, 38.85::numeric, 38.85::numeric),
('3cb04de1-d26b-4e35-966e-cb06b3cde953'::uuid, 22.26::numeric, 22.26::numeric),
('a62e5fc7-2a01-46ea-9308-6aaba8c72f76'::uuid, 50.86::numeric, 50.86::numeric),
('0baef714-3703-4627-b218-539d9db4df86'::uuid, 56.34::numeric, 56.34::numeric),
('1af84780-ac0b-459a-80c1-7869d437396c'::uuid, 57.37::numeric, 57.37::numeric),
('031c3ed6-364a-4216-8842-ad0cb735d035'::uuid, 71.75::numeric, 71.75::numeric),
('4c166c76-041c-469b-a11d-3b935850150e'::uuid, 26.16::numeric, 26.16::numeric),
('6d201371-2649-4b62-8cf1-7869b0e56b4a'::uuid, 93.9::numeric, 93.9::numeric),
('84ea030b-2038-449b-9886-d4545b4496a1'::uuid, 131.17::numeric, 131.17::numeric),
('4b4d6935-bc33-4bd6-84d3-44329264d433'::uuid, 89.04::numeric, 89.04::numeric),
('4f4a6f7a-0b29-491b-ab8b-8612b6a080fc'::uuid, 61.63::numeric, 61.63::numeric),
('74d3c747-5773-4cab-a565-f1dc8b8eecd5'::uuid, 118.77::numeric, 118.77::numeric),
('f7dabe73-b642-4022-a59f-0a5b877dfb35'::uuid, 59.97::numeric, 59.97::numeric),
('41a05cc9-6237-413e-865f-ec898afce540'::uuid, 84.02::numeric, 84.02::numeric),
('bf446eb0-1ee3-45d5-a69a-3b1777a014ac'::uuid, 28.96::numeric, 28.96::numeric),
('27df7972-9af5-451f-aa4b-df04ece8b651'::uuid, 135.35::numeric, 135.35::numeric),
('4748e739-8715-471f-9ca0-b2495e76ed8d'::uuid, 92.73::numeric, 92.73::numeric),
('0899755f-78b8-4d8d-8f54-9114d1bb86b1'::uuid, 73.14::numeric, 73.14::numeric)
) AS v(id, new_price, old_price)
WHERE p.id = v.id
RETURNING p.id, p.name, p.price;