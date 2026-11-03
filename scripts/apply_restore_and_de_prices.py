"""Apply restore prices + strikethrough De (~32-38% above) for high-intent SKUs.

- Price updates: status=abaixo in precos-restaurar-lojas-confiaveis.csv
  -> price = sugerido_30pct_abaixo_piso
- Skip status=acima (bad matches) and alinhado (already OK / user-edited)
- De (original_price): for updated SKUs with views>=5 or sales>=1 in 60/90d,
  and for other catalog SKUs with views>=15, set original_price ~= price * 1.32..1.38
"""
from __future__ import annotations

import csv
import json
import math
import os
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / "precos-restaurar-lojas-confiaveis.csv"
PLAN = ROOT / "scripts" / "_restore_apply_plan.json"


def load_env() -> None:
    for name in (".env.local", ".env"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def fetch_json(url: str, key: str):
    req = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def nice_money(v: float) -> float:
    if v < 5:
        return round(v, 2)
    # prefer .90 endings when close
    base = math.floor(v)
    frac = v - base
    if frac < 0.35:
        return float(f"{base - 1}.90") if base >= 2 else round(v, 2)
    if frac < 0.75:
        return float(f"{base}.90")
    return float(f"{base}.90") if base + 0.90 <= v * 1.02 else round(v, 2)


def de_multiplier(product_id: str) -> float:
    # deterministic 1.32 .. 1.38
    h = sum(ord(c) for c in product_id) % 7
    return 1.32 + h * 0.01


def build_plan() -> dict:
    load_env()
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Missing Supabase env")

    # engagement
    sql = """
    with views as (
      select product_id, sum(views)::int as views
      from product_views_daily
      where day >= current_date - 60
      group by product_id
    ),
    sales as (
      select oi.product_id, sum(oi.quantity)::int as units
      from order_items oi
      join orders o on o.id = oi.order_id
      where o.created_at >= now() - interval '90 days'
        and coalesce(o.status,'') not in ('cancelled','canceled','refunded')
      group by oi.product_id
    )
    select p.id::text as id,
           coalesce(v.views,0) as views,
           coalesce(s.units,0) as units
    from products p
    left join views v on v.product_id = p.id
    left join sales s on s.product_id = p.id
    where p.active = true
      and (coalesce(v.views,0) >= 5 or coalesce(s.units,0) >= 1)
    """
    # use REST rpc? simpler: product_views_daily aggregate via python after fetch
    # Fetch views
    views: dict[str, int] = {}
    offset = 0
    while True:
        batch = fetch_json(
            f"{url}/rest/v1/product_views_daily?select=product_id,views,day"
            f"&day=gte.{( __import__('datetime').date.today() - __import__('datetime').timedelta(days=60)).isoformat()}"
            f"&limit=1000&offset={offset}",
            key,
        )
        if not batch:
            break
        for row in batch:
            pid = row["product_id"]
            views[pid] = views.get(pid, 0) + int(row.get("views") or 0)
        if len(batch) < 1000:
            break
        offset += 1000

    # sales via order_items - may be heavy; use SQL through a minimal approach:
    # read from a cached query file if MCP already gave us data — instead count from orders
    units: dict[str, int] = {}
    offset = 0
    while True:
        batch = fetch_json(
            f"{url}/rest/v1/order_items?select=product_id,quantity,order:orders(created_at,status)"
            f"&limit=1000&offset={offset}",
            key,
        )
        if not batch:
            break
        cutoff = __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ) - __import__("datetime").timedelta(days=90)
        for row in batch:
            order = row.get("order") or {}
            status = (order.get("status") or "").lower()
            if status in {"cancelled", "canceled", "refunded"}:
                continue
            created = order.get("created_at")
            if created:
                try:
                    dt = __import__("datetime").datetime.fromisoformat(
                        created.replace("Z", "+00:00")
                    )
                    if dt < cutoff:
                        continue
                except ValueError:
                    pass
            pid = row.get("product_id")
            if not pid:
                continue
            units[pid] = units.get(pid, 0) + int(row.get("quantity") or 0)
        if len(batch) < 1000:
            break
        offset += 1000

    rows = list(csv.DictReader(CSV.open(encoding="utf-8-sig"), delimiter=";"))
    updates = []
    for r in rows:
        if r["status"] != "abaixo":
            continue
        pid = r["id"]
        new_price = round(float(r["sugerido_30pct_abaixo_piso"]), 2)
        old_price = round(float(r["preco_atual"]), 2)
        if new_price <= 0 or new_price <= old_price * 1.01:
            # only raise when meaningfully higher
            if new_price <= old_price:
                continue
        v = views.get(pid, 0)
        u = units.get(pid, 0)
        wants_de = v >= 5 or u >= 1
        original = None
        if wants_de:
            original = nice_money(new_price * de_multiplier(pid))
            if original <= new_price:
                original = round(new_price * 1.35, 2)
        updates.append(
            {
                "id": pid,
                "name": r["produto"],
                "old_price": old_price,
                "new_price": new_price,
                "original_price": original,
                "views": v,
                "units": u,
                "set_de": wants_de,
                "floor": float(r["piso_confiavel"]),
            }
        )

    # Extra: high-view products not in restore list — only set De if missing/wild
    restore_ids = {u["id"] for u in updates}
    # fetch current prices for top viewed
    extras = []
    top_view_ids = [
        pid for pid, v in sorted(views.items(), key=lambda x: -x[1]) if v >= 15
    ][:80]
    for pid in top_view_ids:
        if pid in restore_ids:
            continue
        # get product
        prod = fetch_json(
            f"{url}/rest/v1/products?select=id,name,price,original_price&id=eq.{pid}",
            key,
        )
        if not prod:
            continue
        p = prod[0]
        price = float(p["price"])
        orig = p.get("original_price")
        orig_f = float(orig) if orig is not None else None
        target_de = nice_money(price * de_multiplier(pid))
        if target_de <= price:
            target_de = round(price * 1.35, 2)
        # set De if none, or if current De is > 60% above (too fake) or < 20% (too weak)
        need = False
        if orig_f is None:
            need = True
        elif orig_f <= price:
            need = True
        elif orig_f > price * 1.60:
            need = True
        elif orig_f < price * 1.20:
            need = True
        if not need:
            continue
        extras.append(
            {
                "id": pid,
                "name": p["name"],
                "old_price": price,
                "new_price": price,  # price unchanged
                "original_price": target_de,
                "views": views.get(pid, 0),
                "units": units.get(pid, 0),
                "set_de": True,
                "floor": None,
                "de_only": True,
            }
        )

    plan = {
        "price_updates": len(updates),
        "de_only_extras": len(extras),
        "updates": updates,
        "extras": extras,
    }
    PLAN.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    return plan


def emit_sql(plan: dict) -> list[str]:
    items = []
    for u in plan["updates"]:
        items.append((u["id"], u["new_price"], u["original_price"], u.get("set_de", False)))
    for u in plan["extras"]:
        items.append((u["id"], u["new_price"], u["original_price"], True))

    chunks = []
    size = 35
    for i in range(0, len(items), size):
        part = items[i : i + size]
        values = []
        for pid, price, original, set_de in part:
            if set_de and original is not None:
                values.append(
                    f"('{pid}'::uuid, {price}::numeric, {original}::numeric, true)"
                )
            else:
                values.append(f"('{pid}'::uuid, {price}::numeric, NULL::numeric, false)")
        sql = f"""UPDATE products AS p
SET
  price = v.new_price,
  original_price = CASE
    WHEN v.set_de THEN v.new_original
    ELSE NULL
  END,
  updated_at = now()
FROM (VALUES
{(",\n").join(values)}
) AS v(id, new_price, new_original, set_de)
WHERE p.id = v.id
RETURNING p.id;"""
        chunks.append(sql)
    return chunks


if __name__ == "__main__":
    plan = build_plan()
    print(
        f"price_updates={plan['price_updates']} de_only_extras={plan['de_only_extras']}"
    )
    for u in plan["updates"][:12]:
        de = u["original_price"]
        print(
            f"  {u['old_price']:.2f}->{u['new_price']:.2f}"
            f" de={de} views={u['views']} | {u['name'][:50]}"
        )
    chunks = emit_sql(plan)
    for i, sql in enumerate(chunks):
        path = ROOT / "scripts" / f"_restore_sql_{i}.sql"
        path.write_text(sql, encoding="utf-8")
        print("wrote", path.name, "bytes", path.stat().st_size)
    print("plan", PLAN)
