#!/usr/bin/env python3
"""Full-catalog price audit vs pharmacy competitors (Carvalho + DSP Itapevi).

Uses cached competitor data when available. Does not change DB prices.
Writes: relatorio-precos-catalogo-completo.json/.csv
"""
from __future__ import annotations

import csv
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
import sys

sys.path.insert(0, str(ROOT / "scripts"))
import compare_competitor_prices as cmp  # noqa: E402

OUT_JSON = ROOT / "relatorio-precos-catalogo-completo.json"
OUT_CSV = ROOT / "relatorio-precos-catalogo-completo.csv"


def load_carvalho_hits(ours: list[dict], fetch_missing: bool, workers: int = 4) -> dict[str, list[dict]]:
    hits: dict[str, list[dict]] = {}
    missing = []
    for p in ours:
        cache = cmp.CACHE / "carvalho" / f"{p['slug']}.json"
        if cache.exists():
            hits[p["slug"]] = json.loads(cache.read_text(encoding="utf-8"))
        else:
            missing.append(p)
    print(f"[carvalho] cached={len(hits)} missing={len(missing)}", flush=True)
    if not fetch_missing or not missing:
        return hits

    def work(p: dict) -> tuple[str, list[dict]]:
        try:
            return p["slug"], cmp.carvalho_search(p["name"], p["slug"])
        except Exception as e:  # noqa: BLE001
            print("  fail", p["slug"][:60], e, flush=True)
            return p["slug"], []

    done = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(work, p) for p in missing]
        for fut in as_completed(futs):
            slug, found = fut.result()
            hits[slug] = found
            done += 1
            if done % 25 == 0 or done == len(missing):
                print(f"  carvalho fetch {done}/{len(missing)}", flush=True)
            time.sleep(0.05)
    return hits


def classify(our: float, lowest: float | None) -> dict:
    if lowest is None or lowest <= 0:
        return {
            "status": "sem_match",
            "gap_pct": None,
            "sugerido": None,
            "action": "nao_encontrado",
        }
    # gap positive => loja mais cara que o menor concorrente
    gap_pct = round((our / lowest - 1) * 100, 1)
    # sugerido: perto do piso, sem ir a -30% se isso criar gap absurdo
    sugerido = round(lowest, 2)
    if our > lowest * 1.10:
        status = "acima"
        action = "descer"
    elif our < lowest * 0.90:
        status = "abaixo"
        action = "subir_opcional"
        sugerido = None
    else:
        status = "alinhado"
        action = "manter"
        sugerido = None
    return {
        "status": status,
        "gap_pct": gap_pct,
        "sugerido": sugerido if status == "acima" else None,
        "action": action,
    }


def main() -> None:
    fetch_missing = "--fetch" in __import__("sys").argv
    ours = cmp.load_our_products(force=False)
    print(f"[ours] {len(ours)}", flush=True)
    itapevi = cmp.load_itapevi()
    print(f"[itapevi] {len(itapevi)}", flush=True)
    carvalho_hits = load_carvalho_hits(ours, fetch_missing=fetch_missing)

    rows = []
    for p in ours:
        c_match = cmp.best_match(p, carvalho_hits.get(p["slug"]) or [], threshold=0.80)
        i_match = cmp.best_match(p, itapevi, threshold=0.80)
        prices = []
        if c_match:
            prices.append(("carvalho", c_match))
        if i_match:
            prices.append(("itapevi", i_match))
        lowest = min((m["price"] for _, m in prices), default=None)
        source = None
        source_name = ""
        source_url = ""
        source_score = None
        if prices:
            source, best = min(prices, key=lambda x: x[1]["price"])
            source_name = best["name"]
            source_url = best.get("url") or ""
            source_score = best.get("score")
        cls = classify(p["price"], lowest)
        rows.append(
            {
                "id": p["id"],
                "name": p["name"],
                "brand": p["brand"],
                "gtin": p["gtin"],
                "slug": p["slug"],
                "our_price": round(p["price"], 2),
                "lowest_market": lowest,
                "market_source": source,
                "market_name": source_name,
                "market_url": source_url,
                "market_score": source_score,
                "carvalho_price": c_match["price"] if c_match else None,
                "itapevi_price": i_match["price"] if i_match else None,
                **cls,
            }
        )

    summary = {
        "total": len(rows),
        "com_match": sum(1 for r in rows if r["status"] != "sem_match"),
        "sem_match": sum(1 for r in rows if r["status"] == "sem_match"),
        "acima": sum(1 for r in rows if r["status"] == "acima"),
        "alinhado": sum(1 for r in rows if r["status"] == "alinhado"),
        "abaixo": sum(1 for r in rows if r["status"] == "abaixo"),
        "carvalho_cached_slugs": sum(
            1 for p in ours if (cmp.CACHE / "carvalho" / f"{p['slug']}.json").exists()
        ),
        "fetch_mode": "full" if fetch_missing else "cache_only",
    }
    # gap stats among matched
    gaps = [r["gap_pct"] for r in rows if r["gap_pct"] is not None]
    gaps.sort()
    if gaps:
        summary["gap_min"] = gaps[0]
        summary["gap_p25"] = gaps[len(gaps) // 4]
        summary["gap_median"] = gaps[len(gaps) // 2]
        summary["gap_p75"] = gaps[3 * len(gaps) // 4]
        summary["gap_max"] = gaps[-1]
        summary["acima_10"] = sum(1 for g in gaps if g > 10)
        summary["acima_30"] = sum(1 for g in gaps if g > 30)
        summary["abaixo_10"] = sum(1 for g in gaps if g < -10)

    rows.sort(
        key=lambda r: (
            {"acima": 0, "alinhado": 1, "abaixo": 2, "sem_match": 3}[r["status"]],
            -(r["gap_pct"] or -9999),
            r["name"],
        )
    )
    fields = list(rows[0].keys())
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    OUT_JSON.write_text(
        json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
    print("TOP ACIMA:")
    for r in [x for x in rows if x["status"] == "acima"][:20]:
        print(
            f"  +{r['gap_pct']}%  {r['our_price']:.2f} vs {r['lowest_market']:.2f}  {r['name'][:70]}",
            flush=True,
        )
    print(OUT_CSV)


if __name__ == "__main__":
    main()
