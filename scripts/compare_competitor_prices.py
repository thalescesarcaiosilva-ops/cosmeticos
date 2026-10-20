#!/usr/bin/env python3
"""Compare active catalog prices with Drogaria Carvalho and Drogaria São Paulo Itapevi.

Does not update the database. Writes a review CSV/JSON.
Target = lowest competitor price * 0.85 (regular price, no promo).
"""
from __future__ import annotations

import csv
import json
import os
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "scripts" / "_price_compare_cache"
OUT_CSV = ROOT / "relatorio-precos-concorrentes.csv"
OUT_JSON = ROOT / "relatorio-precos-concorrentes.json"

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9",
}

VOLUME_RE = re.compile(
    r"(\d+[.,]?\d*)\s*(ml|g|kg|l|un|unidades|capsulas|cápsulas|cp|saches|sachês)\b",
    re.I,
)
STOP = {
    "de", "da", "do", "das", "dos", "e", "com", "para", "em", "o", "a", "os", "as",
    "um", "uma", "the", "fps", "spf", "kit", "refil",
}


def load_env() -> None:
    env_path = ROOT / ".env.local"
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        val = val.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), val)


def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn"
    )


def norm(s: str) -> str:
    s = strip_accents(s).lower().replace("&", " e ")
    s = re.sub(r"[^a-z0-9%]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def volumes(name: str) -> list[str]:
    out = []
    for m in VOLUME_RE.finditer(name):
        qty = m.group(1).replace(",", ".")
        try:
            q = float(qty)
            qty = str(int(q)) if q.is_integer() else str(q)
        except ValueError:
            pass
        unit = strip_accents(m.group(2).lower())
        if unit in {"unidades", "capsulas", "cp", "saches"}:
            unit = "un"
        out.append(f"{qty}{unit}")
    return out


def tokens(name: str, brand: str = "") -> set[str]:
    n = norm(name)
    b = norm(brand)
    if b:
        n = n.replace(b, " ")
    n = VOLUME_RE.sub(" ", n)
    return {t for t in n.split() if t not in STOP and len(t) > 2}


def similarity(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def containment(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    smaller, larger = (a, b) if len(a) <= len(b) else (b, a)
    return len(smaller & larger) / len(smaller)


def fetch(url: str, headers: dict | None = None, retries: int = 4) -> bytes:
    last = None
    hdrs = {**UA, **(headers or {})}
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=hdrs)
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.2 * (attempt + 1) * (3 if "429" in str(e) else 1))
    raise RuntimeError(f"{url}: {last}")


def load_our_products() -> list[dict]:
    cache = CACHE / "our-products.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    load_env()
    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    endpoint = (
        f"{url}/rest/v1/products"
        "?select=id,name,slug,price,original_price,gtin,sku,brand:brands(name)"
        "&active=eq.true&order=name.asc"
    )
    raw = fetch(
        endpoint,
        {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    rows = json.loads(raw.decode("utf-8"))
    products = []
    for row in rows:
        brand = row.get("brand")
        if isinstance(brand, list):
            brand = brand[0] if brand else None
        brand_name = (brand or {}).get("name") if isinstance(brand, dict) else ""
        products.append(
            {
                "id": row["id"],
                "name": row["name"],
                "slug": row["slug"],
                "price": float(row["price"]),
                "original_price": float(row["original_price"]) if row.get("original_price") else None,
                "gtin": re.sub(r"\D", "", row.get("gtin") or ""),
                "sku": row.get("sku") or "",
                "brand": brand_name or "",
            }
        )
    CACHE.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(products, ensure_ascii=False), encoding="utf-8")
    return products


def money_minor(value: str | None, minor: int = 2) -> float | None:
    if value is None or value == "":
        return None
    return int(value) / (10**minor)


def load_itapevi() -> list[dict]:
    cache = CACHE / "itapevi-products.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    products: list[dict] = []
    page = 1
    while True:
        url = (
            "https://drogariasaopauloitapevi.com/wp-json/wc/store/v1/products"
            f"?per_page=100&page={page}"
        )
        try:
            raw = fetch(url, {"Accept": "application/json"})
        except Exception as e:  # noqa: BLE001
            if page > 1 and "400" in str(e):
                break
            raise
        batch = json.loads(raw.decode("utf-8"))
        if not batch:
            break
        for p in batch:
            prices = p.get("prices") or {}
            minor = int(prices.get("currency_minor_unit") or 2)
            regular = money_minor(prices.get("regular_price"), minor)
            current = money_minor(prices.get("price"), minor)
            sale = money_minor(prices.get("sale_price"), minor)
            candidates = [v for v in (regular, current, sale) if v and v > 0]
            if not candidates:
                continue
            products.append(
                {
                    "name": p.get("name") or "",
                    "slug": p.get("slug") or "",
                    "url": p.get("permalink") or "",
                    "sku": p.get("sku") or "",
                    "price": min(candidates),
                    "in_stock": bool(p.get("is_in_stock")),
                }
            )
        print(f"[itapevi] page {page} (+{len(batch)}) total {len(products)}", flush=True)
        if len(batch) < 100:
            break
        page += 1
        time.sleep(0.15)
    cache.write_text(json.dumps(products, ensure_ascii=False), encoding="utf-8")
    return products


def parse_brl(text: str) -> float | None:
    m = re.search(r"([\d.]+),(\d{2})", text)
    if not m:
        return None
    return float(f"{m.group(1).replace('.', '')}.{m.group(2)}")


def carvalho_search(name: str, slug: str) -> list[dict]:
    cache = CACHE / "carvalho" / f"{slug}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    q = urllib.parse.quote(name)
    html = fetch(f"https://drogariacarvalho.com/busca?q={q}").decode("utf-8", "replace")
    found = []
    for art in re.findall(r"<article[\s\S]*?</article>", html):
        href = re.search(r'href="(/p/[^"]+)"', art)
        title = re.search(r"<h3[^>]*>(.*?)</h3>", art, re.S | re.I)
        if not title:
            title = re.search(r"<h2[^>]*>(.*?)</h2>", art, re.S | re.I)
        title_txt = re.sub(r"<[^>]+>", " ", title.group(1) if title else "")
        title_txt = re.sub(r"\s+", " ", title_txt).strip()
        if not title_txt or not href:
            continue
        prices = [parse_brl(m.group(0)) for m in re.finditer(r"R\$\s*[\d.]+,\d{2}", art)]
        prices = [p for p in prices if p and p > 0]
        if not prices:
            continue
        found.append(
            {
                "name": title_txt,
                "url": "https://drogariacarvalho.com" + href.group(1),
                "price": min(prices),
            }
        )
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(found, ensure_ascii=False), encoding="utf-8")
    return found


SHADE_WORDS = {
    "claro", "medio", "escuro", "nude", "bege", "coral", "rosa", "rose", "vermelho",
    "peach", "peachy", "punchy", "wicked", "royal", "coy", "witty", "cheeky",
    "unico", "universal", "translucido", "natural", "morena", "moreno", "bronze",
    "areia", "mel", "chocolate", "caramelo", "fucsia", "terracota", "cognac",
    "alabaster", "ivory", "sand", "honey", "tan", "deep", "light", "medium", "fair",
}


def shade_tokens(name: str) -> set[str]:
    n = set(norm(name).split())
    return n & SHADE_WORDS


def match_candidate(ours: dict, other_name: str) -> float:
    our_n = norm(ours["name"])
    other_n = norm(other_name)
    our_kit = "kit" in our_n.split()
    their_kit = "kit" in other_n.split()
    if our_kit != their_kit:
        return 0.0
    our_vols = volumes(ours["name"])
    their_vols = volumes(other_name)
    if our_vols and their_vols and sorted(our_vols) != sorted(their_vols):
        return 0.0
    our_shades = shade_tokens(ours["name"])
    their_shades = shade_tokens(other_name)
    if our_shades and their_shades and not (our_shades & their_shades):
        return 0.0
    brand = norm(ours.get("brand") or "")
    if brand and brand not in other_n and not all(part in other_n for part in brand.split() if len(part) > 2):
        return 0.0
    a = tokens(ours["name"], ours.get("brand") or "")
    b = tokens(other_name, ours.get("brand") or "")
    jac = similarity(a, b)
    cont = containment(a, b)
    if jac < 0.45:
        return 0.0
    return max(jac, cont * 0.9)


def best_match(ours: dict, candidates: list[dict], threshold: float = 0.84) -> dict | None:
    best = None
    best_score = 0.0
    for c in candidates:
        score = match_candidate(ours, c["name"])
        if score > best_score:
            best = c
            best_score = score
    if best and best_score >= threshold:
        return {**best, "score": round(best_score, 3)}
    return None


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    ours = load_our_products()
    print(f"[ours] {len(ours)}", flush=True)
    itapevi = load_itapevi()
    print(f"[itapevi] {len(itapevi)}", flush=True)

    # index itapevi roughly by brand token to reduce comparisons
    print("[carvalho] searching...", flush=True)
    carvalho_hits: dict[str, list[dict]] = {}

    def work(p: dict) -> tuple[str, list[dict]]:
        try:
            return p["slug"], carvalho_search(p["name"], p["slug"])
        except Exception as e:  # noqa: BLE001
            print("  carvalho fail", p["slug"], e, flush=True)
            return p["slug"], []

    pending = [p for p in ours if not (CACHE / "carvalho" / f"{p['slug']}.json").exists()]
    print(f"  to fetch {len(pending)} (cached {len(ours) - len(pending)})", flush=True)
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = [ex.submit(work, p) for p in ours]
        done = 0
        for fut in as_completed(futs):
            slug, hits = fut.result()
            carvalho_hits[slug] = hits
            done += 1
            if done % 50 == 0:
                print(f"  carvalho {done}/{len(ours)}", flush=True)

    rows = []
    for p in ours:
        c_match = best_match(p, carvalho_hits.get(p["slug"]) or [])
        i_match = best_match(p, itapevi)
        prices = []
        if c_match:
            prices.append(c_match["price"])
        if i_match:
            prices.append(i_match["price"])
        lowest = min(prices) if prices else None
        target = round(lowest * 0.85, 2) if lowest else None
        if target is None:
            action = "nao_encontrado"
        elif abs(p["price"] - target) < 0.05:
            action = "manter"
        elif p["price"] < target:
            action = "subir"
        else:
            action = "descer"
        rows.append(
            {
                "id": p["id"],
                "name": p["name"],
                "brand": p["brand"],
                "gtin": p["gtin"],
                "our_price": round(p["price"], 2),
                "carvalho_price": c_match["price"] if c_match else None,
                "carvalho_name": c_match["name"] if c_match else "",
                "carvalho_url": c_match["url"] if c_match else "",
                "carvalho_score": c_match["score"] if c_match else None,
                "itapevi_price": i_match["price"] if i_match else None,
                "itapevi_name": i_match["name"] if i_match else "",
                "itapevi_url": i_match["url"] if i_match else "",
                "itapevi_score": i_match["score"] if i_match else None,
                "itapevi_in_stock": i_match.get("in_stock") if i_match else None,
                "lowest": lowest,
                "target_15": target,
                "delta": round(target - p["price"], 2) if target is not None else None,
                "gap_pct": round((1 - p["price"] / lowest) * 100, 1) if lowest else None,
                "action": action,
            }
        )

    rows.sort(key=lambda r: (r["action"], -(r["delta"] or 0), r["name"]))
    fields = list(rows[0].keys()) if rows else []
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    summary = {
        "total": len(rows),
        "subir": sum(1 for r in rows if r["action"] == "subir"),
        "descer": sum(1 for r in rows if r["action"] == "descer"),
        "manter": sum(1 for r in rows if r["action"] == "manter"),
        "nao_encontrado": sum(1 for r in rows if r["action"] == "nao_encontrado"),
        "so_carvalho": sum(1 for r in rows if r["carvalho_price"] and not r["itapevi_price"]),
        "so_itapevi": sum(1 for r in rows if r["itapevi_price"] and not r["carvalho_price"]),
        "ambas": sum(1 for r in rows if r["carvalho_price"] and r["itapevi_price"]),
    }
    OUT_JSON.write_text(
        json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
    print(OUT_CSV, flush=True)


if __name__ == "__main__":
    main()
