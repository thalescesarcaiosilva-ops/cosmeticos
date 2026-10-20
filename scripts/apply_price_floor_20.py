#!/usr/bin/env python3
"""Set matched products to 20% below the lowest competitor price.

- Our price above the competitor: lower to competitor * 0.80
- Our price more than 20% below: raise to competitor * 0.80
- Already between 80% and 100% of the competitor: leave unchanged
"""
from __future__ import annotations

import json
import os
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "relatorio-precos-concorrentes.json"


def load_env() -> None:
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def money(value: float | str) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def main() -> None:
    load_env()
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    rows = json.loads(REPORT.read_text(encoding="utf-8"))["rows"]
    now = datetime.now(timezone.utc).isoformat()

    planned = []
    kept = 0
    for row in rows:
        if not row.get("lowest"):
            continue
        lowest = money(row["lowest"])
        ours = money(row["our_price"])
        target = (lowest * Decimal("0.80")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if target <= 0:
            continue
        if ours > lowest:
            action = "baixar"
        elif ours < target:
            action = "subir"
        else:
            kept += 1
            continue
        if ours == target:
            kept += 1
            continue
        planned.append(
            {
                "id": row["id"],
                "name": row["name"],
                "action": action,
                "old": ours,
                "new": target,
                "lowest": lowest,
            }
        )

    print(
        f"baixar {sum(1 for p in planned if p['action']=='baixar')} | "
        f"subir {sum(1 for p in planned if p['action']=='subir')} | "
        f"manter_na_faixa {kept}",
        flush=True,
    )

    ok = 0
    for item in planned:
        url = f"{base}/rest/v1/products?id=eq.{item['id']}"
        body = json.dumps(
            {
                "price": float(item["new"]),
                "original_price": None,
                "updated_at": now,
            }
        ).encode()
        req = urllib.request.Request(
            url,
            data=body,
            method="PATCH",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status not in (200, 204):
                raise RuntimeError(f"{item['id']} status {resp.status}")
        ok += 1
        if ok % 50 == 0:
            print(f"updated {ok}/{len(planned)}", flush=True)

    print(f"updated {ok}", flush=True)
    log = ROOT / "relatorio-ajuste-precos-20.csv"
    with log.open("w", encoding="utf-8-sig", newline="") as f:
        f.write("acao,preco_anterior,preco_novo,menor_concorrente,nome\n")
        for item in planned:
            name = item["name"].replace('"', '""')
            f.write(
                f"{item['action']},{item['old']},{item['new']},{item['lowest']},\"{name}\"\n"
            )
    print(log, flush=True)


if __name__ == "__main__":
    main()
