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
('1c5c5930-5f8e-44b6-ae85-97fc09e081b6'::uuid, 103.54::numeric, 103.54::numeric),
('c6c2fe65-ebf7-4ffe-badd-17a9205590d6'::uuid, 100.9::numeric, 100.9::numeric),
('ebe60f2d-9e79-434f-ab8d-d261d9609e8a'::uuid, 72.11::numeric, 72.11::numeric),
('c1801e4c-5ea3-41ba-8a59-0fabfa5f70cf'::uuid, 59.62::numeric, 59.62::numeric),
('b09c8767-cd47-4d3f-8d6d-80b6af5faf00'::uuid, 69.04::numeric, 69.04::numeric),
('84648753-aeac-42eb-9221-341e760e05a2'::uuid, 66.93::numeric, 66.93::numeric),
('8d60b6d6-1af4-413b-8d1b-81ce95e09850'::uuid, 133.99::numeric, 133.99::numeric),
('8e45dc5b-580c-4a51-8252-4d327f581704'::uuid, 212.31::numeric, 212.31::numeric),
('196c62a7-ca67-4bbd-82f3-5fa68fa93466'::uuid, 46.83::numeric, 46.83::numeric),
('968746ea-d4ab-4638-9862-5dffc18bdee2'::uuid, 64.12::numeric, 64.12::numeric),
('31e22d13-10df-41ae-a665-f7a0dc47f51a'::uuid, 73.63::numeric, 73.63::numeric),
('96e21f27-9b10-43a8-abec-08705ee98b9c'::uuid, 153.43::numeric, 153.43::numeric),
('7ffe51f4-1f2e-4a5e-9247-7373a68563d1'::uuid, 109.12::numeric, 109.12::numeric),
('ff2e94d7-423d-4481-a1eb-59542ac3c1ef'::uuid, 125.22::numeric, 125.22::numeric),
('802fc2cc-d89c-47c8-ba57-389d861bd5b4'::uuid, 93.91::numeric, 93.91::numeric),
('f1c9e8be-275e-4575-b9f0-f0b5d7e76856'::uuid, 113.83::numeric, 113.83::numeric),
('b2962245-93db-4e1e-8a59-dcc059dbbb1c'::uuid, 80.0::numeric, 72.5::numeric),
('4a7ca338-bed6-487f-9c0d-1331b51bb829'::uuid, 69.31::numeric, 69.31::numeric),
('ddb7e4e1-96af-4c48-b4ba-a20ca0a4b75a'::uuid, 3.7::numeric, 3.7::numeric),
('235daf72-d9e5-4dac-9fa9-a72d9d5d2e49'::uuid, 84.9::numeric, 84.9::numeric),
('b969a006-9c02-4e10-b5c7-e8f417e1746b'::uuid, 136.91::numeric, 136.91::numeric),
('85fe6a50-a793-4591-8545-d631c1dba616'::uuid, 56.65::numeric, 56.65::numeric),
('0571d89f-a67d-47e1-9bc1-61215ab9e958'::uuid, 310.81::numeric, 310.81::numeric),
('78ac5545-2818-47aa-9fe3-a91801a5f8bf'::uuid, 45.46::numeric, 45.46::numeric),
('1fbcd34f-a51b-46fd-9916-3e425263896c'::uuid, 29.41::numeric, 29.41::numeric),
('98ea344e-efaa-4234-a19c-9a8d36e61fb8'::uuid, 68.33::numeric, 68.33::numeric),
('8e80922e-98e1-4b80-905f-b6bcfad248b6'::uuid, 70.72::numeric, 70.72::numeric),
('58a72963-5ba2-4a22-9506-5141682431f7'::uuid, 193.8::numeric, 193.8::numeric),
('22285153-6189-43f5-ae99-a46a9560549a'::uuid, 167.49::numeric, 167.49::numeric),
('5115c05f-40c5-405a-8765-23875f074575'::uuid, 141.95::numeric, 141.95::numeric),
('cdee736b-2ef9-4887-aade-19611c533b9c'::uuid, 118.97::numeric, 118.97::numeric),
('1ddf159a-130f-425e-a329-79590ab01997'::uuid, 94.91::numeric, 94.91::numeric),
('3bac1f32-e5a1-488f-a7ce-a34233477f77'::uuid, 145.32::numeric, 145.32::numeric),
('1762646f-2f3c-4250-ab55-d361c38582ae'::uuid, 234.96::numeric, 234.96::numeric),
('6ad44ebe-28b1-4b20-a955-0a3d3d498fc3'::uuid, 146.01::numeric, 146.01::numeric),
('ad1c3925-2903-4281-9980-fb4fb544de81'::uuid, 15.34::numeric, 15.34::numeric),
('88f4320c-f812-4068-ad5b-0b60547d0fe2'::uuid, 124.02::numeric, 124.02::numeric),
('f84104a8-ffa4-426b-9245-0c5ee19a7a3e'::uuid, 308.0::numeric, 308.0::numeric),
('934df987-8713-4298-8d08-075e36176f6e'::uuid, 87.03::numeric, 87.03::numeric),
('9b893ab0-80c9-467c-a84a-1ef64173f83e'::uuid, 122.54::numeric, 122.54::numeric)
) AS v(id, new_price, old_price)
WHERE p.id = v.id
RETURNING p.id, p.name, p.price;