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
('e2d254ac-2b1f-42e1-a2dd-05e8975ccf63'::uuid, 71.46::numeric, 71.46::numeric),
('ebd5c7f2-5135-49a4-a04c-24a2d2637000'::uuid, 120.3::numeric, 120.3::numeric),
('31e66dbc-923c-4b62-9841-c18fac9537df'::uuid, 55.28::numeric, 55.28::numeric),
('33805ad3-eb0a-4a78-b5f0-de1dd11bda20'::uuid, 72.41::numeric, 72.41::numeric),
('988a7af0-aa30-4607-9036-1b8c9063e9cf'::uuid, 31.99::numeric, 31.99::numeric),
('16cc70a3-3472-44a9-a0bf-b10dc916964d'::uuid, 90.12::numeric, 90.12::numeric),
('ddec3659-78f8-4c5b-85b2-8fd758e8adbf'::uuid, 73.51::numeric, 73.51::numeric),
('4a94ef90-1e6a-48ea-8df6-57b60f5de0ee'::uuid, 21.1::numeric, 21.1::numeric),
('f73fa57e-44e1-4673-af18-0ce0edce6e5b'::uuid, 32.15::numeric, 32.15::numeric),
('0eb7510c-5e51-4098-a16c-0b8b44343dee'::uuid, 143.82::numeric, 143.82::numeric),
('fa35bb71-138b-4b26-b69e-73de29ca6748'::uuid, 67.47::numeric, 67.47::numeric),
('e62cc67c-2676-4f6a-a0ee-55f4a750c458'::uuid, 118.32::numeric, 118.32::numeric),
('9f5c671f-1461-4cd2-ad88-5f08c0cb6b04'::uuid, 69.73::numeric, 69.73::numeric),
('4f619b6f-385a-46fe-97a6-c6b2b3640d9b'::uuid, 42.81::numeric, 42.81::numeric),
('205dd714-8d62-4046-ab91-188098871fbb'::uuid, 113.3::numeric, 113.3::numeric),
('3aac2f7b-0421-4e9c-811f-609fc9871f4e'::uuid, 71.12::numeric, 71.12::numeric),
('682a4503-9583-468d-8a1c-0d8969584319'::uuid, 55.57::numeric, 55.57::numeric),
('2109a1d7-efdf-402d-8648-ab1c17e72ea3'::uuid, 106.76::numeric, 106.76::numeric),
('6e45a5a6-c008-4c48-8e49-4dd2ad187087'::uuid, 22.1::numeric, 22.1::numeric),
('25179d6f-6c89-4a89-a9cf-5e4a7b4effcb'::uuid, 104.19::numeric, 104.19::numeric),
('046db1ec-1c42-4f32-9d11-b54650f43e0f'::uuid, 26.31::numeric, 26.31::numeric),
('c5b5b8bd-b8fc-404d-a8dc-c83468dfdf57'::uuid, 80.33::numeric, 80.33::numeric),
('36cf8622-bd17-4fcc-a048-9d0830238453'::uuid, 66.77::numeric, 66.77::numeric),
('65713087-3b81-4ca0-8621-511a7f9e9ae2'::uuid, 68.94::numeric, 68.94::numeric),
('7c639737-e0b6-440d-88e8-c3544c19d9b5'::uuid, 53.27::numeric, 53.27::numeric),
('c2928e3a-5b9b-4d12-97ea-a141c73a887d'::uuid, 57.08::numeric, 57.08::numeric),
('c048a9c7-118b-49ec-b417-53b09c819bbf'::uuid, 127.84::numeric, 127.84::numeric),
('9d21f88f-fba3-472a-b1af-2568fedcea97'::uuid, 93.11::numeric, 93.11::numeric),
('07fde8d7-2efd-4238-a3cb-48ceed9911e4'::uuid, 200.93::numeric, 200.93::numeric),
('8a6fc0f5-58ce-460d-b21a-3ecbe72288e2'::uuid, 124.03::numeric, 124.03::numeric),
('39200055-4bc4-420b-9ecb-5fbaeee81731'::uuid, 87.03::numeric, 87.03::numeric),
('497885e4-b4bb-4d19-8431-9f0aa99f53d4'::uuid, 160.72::numeric, 160.72::numeric),
('b0301330-e78b-4e65-b0dd-9c77d6492e05'::uuid, 49.37::numeric, 49.37::numeric),
('e4d56336-7ea5-4ce5-b387-96dcdaba8341'::uuid, 64.25::numeric, 64.25::numeric),
('a65ecb2c-5461-4710-8a3d-6c2e91711c91'::uuid, 133.46::numeric, 133.46::numeric),
('38fa713d-f7e3-4c2c-93bd-1b30b43e842c'::uuid, 50.18::numeric, 50.18::numeric),
('7da753f3-4463-4323-a3b5-f5f5d1a2a828'::uuid, 49.83::numeric, 49.83::numeric),
('84559004-78bc-4e14-a409-fe7e2d4ec0c9'::uuid, 70.87::numeric, 70.87::numeric),
('a4538576-83ab-4142-bae2-0cb4dfaa86a2'::uuid, 137.42::numeric, 137.42::numeric),
('553c934a-ac84-438f-9c50-649bf12c2d31'::uuid, 144.3::numeric, 144.3::numeric)
) AS v(id, new_price, old_price)
WHERE p.id = v.id
RETURNING p.id, p.name, p.price;