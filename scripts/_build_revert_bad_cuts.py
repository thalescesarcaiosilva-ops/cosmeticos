"""Revert mass cuts based on bad Carvalho/Itapevi floors.

- Restore each SKU to preco_antigo from precos-atualizados-30pct-abaixo.csv
- Exception: Wella Fusion Máscara 150ml -> R$80 (user-validated Shopping-based price)
"""
from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / "precos-atualizados-30pct-abaixo.csv"
WELLA_MASK = "b2962245-93db-4e1e-8a59-dcc059dbbb1c"
WELLA_TARGET = 80.00


def main() -> None:
    rows = list(csv.DictReader(CSV.open(encoding="utf-8-sig"), delimiter=";"))
    items: list[tuple[str, float, float]] = []
    for r in rows:
        pid = r["id"]
        old = float(r["preco_antigo"])
        new_p = WELLA_TARGET if pid == WELLA_MASK else old
        items.append((pid, new_p, old))

    chunk_size = 40
    for i in range(0, len(items), chunk_size):
        chunk = items[i : i + chunk_size]
        values = ",\n".join(
            f"('{pid}'::uuid, {new_p}::numeric, {old}::numeric)" for pid, new_p, old in chunk
        )
        sql = f"""UPDATE products AS p
SET
  price = v.new_price,
  original_price = CASE
    WHEN p.id = '{WELLA_MASK}'::uuid
      THEN GREATEST(COALESCE(p.original_price, 0), v.old_price)
    WHEN p.original_price IS NOT NULL AND abs(p.original_price - v.old_price) < 0.01
      THEN NULL
    WHEN p.original_price IS NOT NULL AND p.original_price > v.new_price
      THEN p.original_price
    ELSE p.original_price
  END,
  updated_at = now()
FROM (VALUES
{values}
) AS v(id, new_price, old_price)
WHERE p.id = v.id
RETURNING p.id, p.name, p.price;"""
        out = ROOT / "scripts" / f"_revert_chunk_{i // chunk_size}.sql"
        out.write_text(sql, encoding="utf-8")
        print(f"wrote {out.name} n={len(chunk)}")
    print(f"total={len(items)} wella_target={WELLA_TARGET}")


if __name__ == "__main__":
    main()
