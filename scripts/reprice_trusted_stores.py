#!/usr/bin/env python3
"""Re-compare catalog prices against trusted Brazilian retailers.

Sources:
  - Drogaria Carvalho (product page JSON-LD / PIX)
  - Época Cosméticos
  - Beleza na Web
  - Sephora BR
  - Mercado Livre (official / listing search)

Does NOT update the DB. Writes:
  - relatorio-precos-lojas-confiaveis.json
  - relatorio-precos-lojas-confiaveis.csv

Priority list = products from precos-atualizados-30pct-abaixo.csv (wrongly cut),
plus optional --all for full active catalog.
"""
from __future__ import annotations

import argparse
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
CACHE = ROOT / "scripts" / "_trusted_price_cache"
OUT_JSON = ROOT / "relatorio-precos-lojas-confiaveis.json"
OUT_CSV = ROOT / "relatorio-precos-lojas-confiaveis.csv"
CUT_CSV = ROOT / "precos-atualizados-30pct-abaixo.csv"

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Accept": "text/html,application/json",
}

VOLUME_RE = re.compile(
    r"(\d+[.,]?\d*)\s*(ml|g|kg|l|un|unidades|capsulas|cápsulas|cp)\b",
    re.I,
)
STOP = {
    "de", "da", "do", "das", "dos", "e", "com", "para", "em", "o", "a", "os", "as",
    "um", "uma", "the", "fps", "spf", "kit", "refil", "capilar", "mascara", "creme",
}


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


def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn"
    )


def norm(s: str) -> str:
    s = strip_accents(s).lower().replace("&", " e ")
    s = re.sub(r"[^a-z0-9%]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def tokens(name: str, brand: str = "") -> set[str]:
    n = norm(name)
    b = norm(brand)
    if b:
        n = n.replace(b, " ")
    n = VOLUME_RE.sub(" ", n)
    return {t for t in n.split() if t not in STOP and len(t) > 2}


def volumes(name: str) -> set[str]:
    out = set()
    for m in VOLUME_RE.finditer(name or ""):
        qty = m.group(1).replace(",", ".")
        try:
            q = float(qty)
            qty = str(int(q)) if q.is_integer() else str(q)
        except ValueError:
            pass
        unit = strip_accents(m.group(2).lower())
        if unit.startswith("un") or unit.startswith("cap"):
            unit = "un"
        out.add(f"{qty}{unit}")
    return out


def parse_brl(text: str) -> float | None:
    m = re.search(r"([\d.]+),(\d{2})", text.replace("\xa0", " "))
    if not m:
        return None
    return float(f"{m.group(1).replace('.', '')}.{m.group(2)}")


def fetch(url: str, headers: dict | None = None, timeout: int = 25) -> bytes:
    import gzip

    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        encoding = (resp.headers.get("Content-Encoding") or "").lower()
        if encoding == "gzip" or raw[:2] == b"\x1f\x8b":
            try:
                raw = gzip.decompress(raw)
            except OSError:
                pass
        return raw


def cache_get(store: str, key: str):
    path = CACHE / store / f"{re.sub(r'[^a-zA-Z0-9_-]+', '_', key)[:180]}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def cache_set(store: str, key: str, data) -> None:
    path = CACHE / store / f"{re.sub(r'[^a-zA-Z0-9_-]+', '_', key)[:180]}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def score_match(ours: dict, other_name: str) -> float:
    our_n = norm(ours["name"])
    other_n = norm(other_name)
    if ("kit" in our_n.split()) != ("kit" in other_n.split()):
        return 0.0
    our_v = volumes(ours["name"])
    their_v = volumes(other_name)
    if our_v and their_v and our_v.isdisjoint(their_v):
        return 0.0
    ot = tokens(ours["name"], ours.get("brand") or "")
    tt = tokens(other_name, ours.get("brand") or "")
    if not ot or not tt:
        return 0.0
    inter = len(ot & tt)
    if inter == 0:
        return 0.0
    sim = inter / len(ot | tt)
    contain = inter / len(ot)
    bonus = 0.15 if our_v and their_v and (our_v & their_v) else 0.0
    brand = norm(ours.get("brand") or "")
    if brand and brand in other_n:
        bonus += 0.1
    return min(1.0, max(sim, contain) + bonus)


def pick_best(ours: dict, candidates: list[dict], min_score: float = 0.45) -> dict | None:
    best = None
    best_s = 0.0
    for c in candidates:
        s = score_match(ours, c.get("name") or "")
        if s > best_s:
            best_s = s
            best = {**c, "score": round(s, 3)}
    if best and best_s >= min_score:
        return best
    return None


# ---- Carvalho: search then PRODUCT PAGE price (JSON-LD / PIX) ----

def carvalho_page_price(url: str) -> dict | None:
    cached = cache_get("carvalho_page", url)
    if cached is not None:
        return cached
    try:
        html = fetch(url).decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        data = {"error": str(e)}
        cache_set("carvalho_page", url, data)
        return None
    price = None
    # JSON-LD
    for m in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.S | re.I,
    ):
        raw = m.group(1).strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        nodes = data if isinstance(data, list) else [data]
        for node in nodes:
            if not isinstance(node, dict):
                continue
            offers = node.get("offers")
            if isinstance(offers, dict) and offers.get("price"):
                try:
                    price = float(str(offers["price"]).replace(",", "."))
                except ValueError:
                    pass
            elif isinstance(offers, list):
                for off in offers:
                    if isinstance(off, dict) and off.get("price"):
                        try:
                            price = float(str(off["price"]).replace(",", "."))
                            break
                        except ValueError:
                            pass
    pix = None
    m_pix = re.search(r"R\$\s*([\d.]+,\d{2})\s*no PIX", html, re.I)
    if m_pix:
        pix = parse_brl(m_pix.group(0))
    name = None
    m_h1 = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S | re.I)
    if m_h1:
        name = re.sub(r"<[^>]+>", " ", m_h1.group(1))
        name = re.sub(r"\s+", " ", name).strip()
    # Prefer card/list price (JSON-LD); keep pix as alternate
    out = {
        "name": name or "",
        "url": url,
        "price": price or pix,
        "pix": pix,
        "list": price,
    }
    cache_set("carvalho_page", url, out)
    return out if out.get("price") else None


def search_carvalho(ours: dict) -> dict | None:
    """Search Carvalho, open top matching product pages, keep the lowest real page price.

    Carvalho often has duplicate SKUs with wildly different prices — never trust the
    search-card price alone.
    """
    key = ours["slug"]
    cached = cache_get("carvalho_search", key)
    if cached is not None:
        cands = cached
    else:
        q = urllib.parse.quote(ours["name"][:120])
        try:
            html = fetch(f"https://drogariacarvalho.com/busca?q={q}").decode("utf-8", "replace")
        except Exception:  # noqa: BLE001
            return None
        cands = []
        seen = set()
        for art in re.findall(r"<article[\s\S]*?</article>", html):
            href = re.search(r'href="(/p/[^"]+)"', art)
            title = re.search(r"<h[23][^>]*>(.*?)</h[23]>", art, re.S | re.I)
            if not href or not title:
                continue
            path = href.group(1)
            if path in seen:
                continue
            seen.add(path)
            title_txt = re.sub(r"<[^>]+>", " ", title.group(1))
            title_txt = re.sub(r"\s+", " ", title_txt).strip()
            cands.append(
                {
                    "name": title_txt,
                    "url": "https://drogariacarvalho.com" + path,
                }
            )
        cache_set("carvalho_search", key, cands)
        time.sleep(0.2)

    ranked = []
    for c in cands:
        s = score_match(ours, c.get("name") or "")
        if s >= 0.4:
            ranked.append({**c, "score": s})
    ranked.sort(key=lambda x: -x["score"])
    ranked = ranked[:5]
    if not ranked:
        return None

    priced = []
    for c in ranked:
        page = carvalho_page_price(c["url"])
        if not page or not page.get("price"):
            continue
        priced.append(
            {
                "store": "carvalho",
                "name": page.get("name") or c["name"],
                "url": c["url"],
                "price": float(page["price"]),
                "pix": page.get("pix"),
                "score": round(c["score"], 3),
            }
        )
        time.sleep(0.15)
    if not priced:
        return None
    # Duplicate listings with absurd spreads are common on Carvalho.
    # Prefer median page price among strong matches (not min — that picks junk/promo pages).
    priced.sort(key=lambda x: x["price"])
    mid = priced[len(priced) // 2]
    mid["_carvalho_candidates"] = [
        {"url": p["url"], "price": p["price"], "score": p["score"]} for p in priced
    ]
    return mid


# ---- VTEX / similar search helpers ----

def search_epoca(ours: dict) -> dict | None:
    key = ours["slug"]
    cached = cache_get("epoca", key)
    if cached is not None:
        return cached if cached.get("price") else None
    q = urllib.parse.quote(ours["name"][:100])
    # VTEX search
    api = (
        "https://www.epocacosmeticos.com.br/api/catalog_system/pub/products/search"
        f"?ft={q}&_from=0&_to=8"
    )
    try:
        raw = json.loads(fetch(api, {"Accept": "application/json"}).decode("utf-8"))
    except Exception:  # noqa: BLE001
        cache_set("epoca", key, {})
        return None
    cands = []
    for p in raw or []:
        name = p.get("productName") or p.get("productTitle") or ""
        link = p.get("link") or ""
        if link and link.startswith("/"):
            link = "https://www.epocacosmeticos.com.br" + link
        price = None
        for item in p.get("items") or []:
            for seller in item.get("sellers") or []:
                offer = seller.get("commertialOffer") or {}
                val = offer.get("Price") or offer.get("price")
                if val and float(val) > 0:
                    price = float(val)
                    break
            if price:
                break
        # normalize internal vtex host to public
        if link and "vtexcommercestable" in link:
            link = link.replace(
                "https://epocacosmeticos.vtexcommercestable.com.br",
                "https://www.epocacosmeticos.com.br",
            )
        if name and price:
            cands.append({"name": name, "url": link, "price": price})
    best = pick_best(ours, cands, min_score=0.45)
    out = {"store": "epoca", **best} if best else None
    cache_set("epoca", key, out or {})
    time.sleep(0.2)
    return out


def search_beleza(ours: dict) -> dict | None:
    """Beleza na Web — HTML search (API often 403)."""
    key = ours["slug"]
    cached = cache_get("beleza", key)
    if cached is not None:
        return cached if cached.get("price") else None
    q = urllib.parse.quote_plus(ours["name"][:100])
    url = f"https://www.belezanaweb.com.br/busca?q={q}"
    try:
        html = fetch(
            url,
            {
                "Accept": "text/html",
                "Referer": "https://www.belezanaweb.com.br/",
            },
        ).decode("utf-8", "replace")
    except Exception:  # noqa: BLE001
        cache_set("beleza", key, {})
        return None
    cands = []
    for m in re.finditer(
        r'href="(https://www\.belezanaweb\.com\.br/[^"]+)"[^>]*>[\s\S]{0,500}?R\$\s*([\d.]+,\d{2})',
        html,
        re.I,
    ):
        href = m.group(1).split("?")[0]
        if "/busca" in href or "#" in href:
            continue
        price = parse_brl("R$ " + m.group(2))
        title_m = re.search(r'title="([^"]+)"|alt="([^"]+)"', html[max(0, m.start() - 300) : m.start() + 50])
        name = (title_m.group(1) or title_m.group(2)) if title_m else href.rstrip("/").split("/")[-1]
        if price and price > 1:
            cands.append({"name": name.replace("-", " "), "url": href, "price": price})
    # also try JSON embedded
    for m in re.finditer(r'"productName"\s*:\s*"([^"]+)".{0,400}?"Price"\s*:\s*([\d.]+)', html, re.S):
        try:
            cands.append({"name": m.group(1), "url": url, "price": float(m.group(2))})
        except ValueError:
            pass
    best = pick_best(ours, cands[:30], min_score=0.4)
    out = {"store": "beleza", **best} if best else None
    cache_set("beleza", key, out or {})
    time.sleep(0.3)
    return out


def search_sephora(ours: dict) -> dict | None:
    key = ours["slug"]
    cached = cache_get("sephora", key)
    if cached is not None:
        return cached if cached.get("price") else None
    q = urllib.parse.quote(ours["name"][:100])
    # Sephora BR often on SFCC; try site search HTML
    url = f"https://www.sephora.com.br/busca?q={q}"
    try:
        html = fetch(url).decode("utf-8", "replace")
    except Exception:  # noqa: BLE001
        cache_set("sephora", key, {})
        return None
    cands = []
    # product tiles
    for m in re.finditer(
        r'href="(https://www\.sephora\.com\.br/[^"]+\.html)"[^>]*>[\s\S]{0,400}?R\$\s*([\d.]+,\d{2})',
        html,
        re.I,
    ):
        href, price_txt = m.group(1), m.group(2)
        # try title nearby
        chunk = html[max(0, m.start() - 200) : m.end() + 50]
        title_m = re.search(r'alt="([^"]+)"', chunk)
        name = title_m.group(1) if title_m else href.split("/")[-1]
        price = parse_brl("R$ " + price_txt)
        if price:
            cands.append({"name": name, "url": href.split("?")[0], "price": price})
    # dedupe by url
    seen = set()
    uniq = []
    for c in cands:
        if c["url"] in seen:
            continue
        seen.add(c["url"])
        uniq.append(c)
    best = pick_best(ours, uniq[:20], min_score=0.4)
    out = {"store": "sephora", **best} if best else None
    cache_set("sephora", key, out or {})
    time.sleep(0.35)
    return out


def search_mercadolivre(ours: dict) -> dict | None:
    """Mercado Livre via public API; fallback to lista HTML if API 403."""
    key = ours["slug"]
    cached = cache_get("ml", key)
    if cached is not None:
        return cached if cached.get("price") else None
    q = urllib.parse.quote(ours["name"][:100])
    cands: list[dict] = []
    api = f"https://api.mercadolibre.com/sites/MLB/search?q={q}&limit=12"
    try:
        raw = json.loads(
            fetch(
                api,
                {
                    "Accept": "application/json",
                    "User-Agent": UA["User-Agent"],
                },
            ).decode("utf-8")
        )
        for r in raw.get("results") or []:
            name = r.get("title") or ""
            price = r.get("price")
            permalink = r.get("permalink") or ""
            if name and price:
                cands.append({"name": name, "url": permalink, "price": float(price)})
    except Exception:  # noqa: BLE001
        # HTML fallback
        try:
            slug = urllib.parse.quote_plus(ours["name"][:80].lower())
            html = fetch(f"https://lista.mercadolivre.com.br/{slug}").decode("utf-8", "replace")
            for m in re.finditer(
                r'href="(https://(?:produto|www)\.mercadolivre\.com\.br/[^"]+_JM)"[^>]*>'
                r'[\s\S]{0,600}?R\$\s*([\d.]+,\d{2})',
                html,
                re.I,
            ):
                price = parse_brl("R$ " + m.group(2))
                title_m = re.search(
                    r'alt="([^"]+)"',
                    html[max(0, m.start() - 400) : m.start() + 80],
                )
                name = title_m.group(1) if title_m else m.group(1)
                if price:
                    cands.append({"name": name, "url": m.group(1).split("#")[0], "price": price})
        except Exception:  # noqa: BLE001
            pass

    scored = []
    for c in cands:
        s = score_match(ours, c["name"])
        if s >= 0.45:
            scored.append({**c, "score": s})
    if not scored:
        cache_set("ml", key, {})
        time.sleep(0.2)
        return None
    # median-ish: avoid extreme outliers — use 2nd lowest if spread is huge
    scored.sort(key=lambda x: x["price"])
    best = scored[0]
    if len(scored) >= 3:
        prices = [x["price"] for x in scored]
        if prices[-1] > 0 and prices[0] < prices[len(prices) // 2] * 0.4:
            # suspiciously cheap vs median — prefer closest to median among top scores
            scored.sort(key=lambda x: (-x["score"], abs(x["price"] - prices[len(prices) // 2])))
            best = scored[0]
        else:
            scored.sort(key=lambda x: (-x["score"], x["price"]))
            best = scored[0]
    else:
        scored.sort(key=lambda x: (-x["score"], x["price"]))
        best = scored[0]
    out = {
        "store": "mercadolivre",
        "name": best["name"],
        "url": best["url"],
        "price": best["price"],
        "score": round(best["score"], 3),
    }
    cache_set("ml", key, out)
    time.sleep(0.25)
    return out


STORES = [
    ("carvalho", search_carvalho),
    ("epoca", search_epoca),
    ("beleza", search_beleza),
    ("sephora", search_sephora),
    ("mercadolivre", search_mercadolivre),
]


def load_our_products(only_cut: bool) -> list[dict]:
    load_env()
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        raise SystemExit("Missing Supabase env")
    cut_ids = set()
    if only_cut and CUT_CSV.exists():
        with CUT_CSV.open(encoding="utf-8-sig") as f:
            for row in csv.DictReader(f, delimiter=";"):
                cut_ids.add(row["id"])
    products = []
    offset = 0
    while True:
        api = (
            f"{url}/rest/v1/products"
            "?select=id,name,slug,price,original_price,gtin,sku,brand:brands(name)"
            "&active=eq.true&order=name.asc"
            f"&limit=500&offset={offset}"
        )
        raw = json.loads(
            fetch(
                api,
                {"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
            ).decode("utf-8")
        )
        if not raw:
            break
        for row in raw:
            if cut_ids and row["id"] not in cut_ids:
                continue
            brand = ""
            if isinstance(row.get("brand"), dict):
                brand = row["brand"].get("name") or ""
            products.append(
                {
                    "id": row["id"],
                    "name": row["name"],
                    "slug": row["slug"],
                    "price": float(row["price"]),
                    "original_price": float(row["original_price"])
                    if row.get("original_price") is not None
                    else None,
                    "brand": brand,
                    "gtin": row.get("gtin") or "",
                }
            )
        if len(raw) < 500:
            break
        offset += 500
    return products


def robust_floor(offers: list[dict]) -> tuple[float, dict]:
    """Pick trusted floor = min offer that is not an extreme outlier vs the median."""
    prices = sorted(float(o["price"]) for o in offers)
    med = prices[len(prices) // 2]
    kept = [o for o in offers if o["price"] >= med * 0.40]
    if not kept:
        kept = offers
    lowest = min(kept, key=lambda o: o["price"])
    return float(lowest["price"]), lowest


def analyze_one(ours: dict) -> dict:
    offers = []
    for store, fn in STORES:
        try:
            hit = fn(ours)
        except Exception as e:  # noqa: BLE001
            hit = None
            print(f"  ! {store} {ours['slug'][:40]}: {e}", flush=True)
        if hit and hit.get("price"):
            clean = {k: v for k, v in hit.items() if not str(k).startswith("_")}
            offers.append(clean)
    if not offers:
        return {
            **ours,
            "status": "sem_match",
            "lowest": None,
            "suggested": None,
            "gap_pct": None,
            "offers": [],
        }
    floor, lowest = robust_floor(offers)
    # suggestion: ~30% below trusted floor
    suggested = round(floor * 0.70, 2)
    gap = round((ours["price"] / floor - 1) * 100, 1)
    if gap > 10:
        status = "acima"
    elif gap < -10:
        status = "abaixo"
    else:
        status = "alinhado"
    return {
        **ours,
        "status": status,
        "lowest": floor,
        "lowest_store": lowest["store"],
        "lowest_name": lowest.get("name"),
        "lowest_url": lowest.get("url"),
        "suggested": suggested if status == "acima" else None,
        "gap_pct": gap,
        "offers": offers,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--all",
        action="store_true",
        help="Full active catalog (slow). Default: only previously cut SKUs.",
    )
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)

    products = load_our_products(only_cut=not args.all)
    if args.limit:
        products = products[: args.limit]
    print(f"products={len(products)} workers={args.workers}", flush=True)

    rows = []
    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(analyze_one, p): p for p in products}
        for fut in as_completed(futs):
            row = fut.result()
            rows.append(row)
            done += 1
            if done % 10 == 0 or done == len(products):
                print(f"  progress {done}/{len(products)}", flush=True)

    rows.sort(
        key=lambda r: (
            {"acima": 0, "alinhado": 1, "abaixo": 2, "sem_match": 3}[r["status"]],
            -(r["gap_pct"] or -9999),
        )
    )
    summary = {
        "total": len(rows),
        "com_match": sum(1 for r in rows if r["status"] != "sem_match"),
        "sem_match": sum(1 for r in rows if r["status"] == "sem_match"),
        "acima": sum(1 for r in rows if r["status"] == "acima"),
        "alinhado": sum(1 for r in rows if r["status"] == "alinhado"),
        "abaixo": sum(1 for r in rows if r["status"] == "abaixo"),
        "stores": [s for s, _ in STORES],
        "rule": "lowest among Carvalho page + Época + Beleza + Sephora + ML; suggest = floor*0.70 if acima",
    }
    OUT_JSON.write_text(
        json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(
            [
                "status",
                "gap_pct",
                "preco_loja",
                "piso_confiavel",
                "sugerido_30pct_abaixo",
                "loja_piso",
                "marca",
                "produto",
                "nome_match",
                "url_piso",
                "carvalho",
                "epoca",
                "beleza",
                "sephora",
                "mercadolivre",
                "id",
            ]
        )
        for r in rows:
            by = {o["store"]: o["price"] for o in r.get("offers") or []}
            w.writerow(
                [
                    r["status"],
                    r.get("gap_pct"),
                    r["price"],
                    r.get("lowest"),
                    r.get("suggested"),
                    r.get("lowest_store"),
                    r.get("brand"),
                    r["name"],
                    r.get("lowest_name"),
                    r.get("lowest_url"),
                    by.get("carvalho"),
                    by.get("epoca"),
                    by.get("beleza"),
                    by.get("sephora"),
                    by.get("mercadolivre"),
                    r["id"],
                ]
            )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print("TOP ACIMA:")
    for r in [x for x in rows if x["status"] == "acima"][:15]:
        print(
            f"  +{r['gap_pct']}%  loja {r['price']:.2f} vs {r['lowest']:.2f} "
            f"({r['lowest_store']})  sug {r['suggested']}  {r['name'][:55]}"
        )
    print(OUT_CSV)


if __name__ == "__main__":
    main()
