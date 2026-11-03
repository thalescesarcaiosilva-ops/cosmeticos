"""Apply ~30% below market floor to confident 'acima' SKUs only.

Skips products listed in produtos-validar-tamanho-variante.csv.
Does not raise prices. Sets price = round(lowest_market * 0.70, 2).
Keeps original_price as max(current original_price, old price) when useful for strike-through.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "relatorio-precos-catalogo-completo.json"
UNCERTAIN = ROOT / "produtos-validar-tamanho-variante.csv"
PLAN = ROOT / "scripts" / "_price_update_plan.json"
APPLIED = ROOT / "scripts" / "_price_update_applied.json"


def load_uncertain_names() -> set[str]:
    names: set[str] = set()
    with UNCERTAIN.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f, delimiter=";"):
            names.add(row["produto_loja"].strip())
    return names


def nice_price(market: float) -> float:
    """~30% below floor."""
    return round(float(market) * 0.70, 2)


def build_plan() -> dict:
    rows = json.loads(REPORT.read_text(encoding="utf-8"))["rows"]
    uncertain = load_uncertain_names()
    acima = [r for r in rows if r.get("status") == "acima"]
    safe = [r for r in acima if (r.get("name") or "").strip() not in uncertain]
    skipped = [r for r in acima if (r.get("name") or "").strip() in uncertain]

    updates = []
    for r in safe:
        mkt = r.get("lowest_market")
        if not mkt or mkt <= 0:
            continue
        new_p = nice_price(mkt)
        old = float(r["our_price"])
        if new_p <= 0 or new_p >= old:
            continue
        updates.append(
            {
                "id": r["id"],
                "name": r["name"],
                "brand": r.get("brand") or "",
                "slug": r.get("slug"),
                "old_price": old,
                "market_floor": float(mkt),
                "new_price": new_p,
                "gap_old_pct": r.get("gap_pct"),
                "market_source": r.get("market_source"),
                "market_name": r.get("market_name"),
            }
        )

    plan = {
        "acima_total": len(acima),
        "skipped_uncertain": len(skipped),
        "safe_acima": len(safe),
        "will_update": len(updates),
        "rule": "new_price = round(lowest_market * 0.70, 2); skip uncertain size/variant list",
        "updates": updates,
        "skipped_names": sorted((r.get("name") or "") for r in skipped),
    }
    PLAN.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    return plan


def apply_via_supabase(plan: dict) -> dict:
    try:
        from supabase import create_client
    except ImportError as e:
        raise SystemExit("supabase package missing") from e

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
    )
    if not url or not key:
        # load .env.local
        for env_name in (".env.local", ".env"):
            env_path = ROOT / env_name
            if not env_path.exists():
                continue
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                os.environ.setdefault(k, v)
        url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
        key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_SERVICE_KEY")
        )
    if not url or not key:
        raise SystemExit("Missing SUPABASE URL / SERVICE_ROLE_KEY")

    client = create_client(url, key)
    applied = []
    errors = []
    for u in plan["updates"]:
        pid = u["id"]
        # fetch current original_price
        cur = (
            client.table("products")
            .select("id,price,original_price")
            .eq("id", pid)
            .single()
            .execute()
        )
        row = cur.data
        if not row:
            errors.append({"id": pid, "error": "not found"})
            continue
        old_price = float(row["price"])
        orig = row.get("original_price")
        orig_f = float(orig) if orig is not None else None
        # keep strike-through at least as high as previous selling price
        new_original = max(x for x in [orig_f, old_price, u["old_price"]] if x is not None)
        if new_original <= u["new_price"]:
            new_original = None  # no fake discount

        payload = {
            "price": u["new_price"],
            "updated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        }
        if new_original is not None:
            payload["original_price"] = round(new_original, 2)

        try:
            client.table("products").update(payload).eq("id", pid).execute()
            applied.append({**u, "original_price_set": payload.get("original_price")})
            print(f"OK {u['old_price']:.2f} -> {u['new_price']:.2f} | {u['name'][:70]}")
        except Exception as ex:  # noqa: BLE001
            errors.append({"id": pid, "name": u["name"], "error": str(ex)})
            print(f"ERR {u['name'][:50]}: {ex}")

    result = {
        "applied_count": len(applied),
        "error_count": len(errors),
        "applied": applied,
        "errors": errors,
    }
    APPLIED.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Write prices to Supabase")
    ap.add_argument("--plan-only", action="store_true", help="Only write plan JSON")
    args = ap.parse_args()
    plan = build_plan()
    print(
        f"acima={plan['acima_total']} skip_uncertain={plan['skipped_uncertain']} "
        f"safe={plan['safe_acima']} will_update={plan['will_update']}"
    )
    for u in plan["updates"][:20]:
        print(
            f"  {u['old_price']:.2f} -> {u['new_price']:.2f} "
            f"(floor {u['market_floor']:.2f}) {u['name'][:60]}"
        )
    if len(plan["updates"]) > 20:
        print(f"  ... +{len(plan['updates']) - 20} more")
    if args.apply and not args.plan_only:
        result = apply_via_supabase(plan)
        print(f"applied={result['applied_count']} errors={result['error_count']}")
    else:
        print(f"plan written: {PLAN}")


if __name__ == "__main__":
    main()
