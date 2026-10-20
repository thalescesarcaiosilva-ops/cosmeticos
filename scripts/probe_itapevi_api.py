#!/usr/bin/env python3
import json
import urllib.parse
import urllib.request

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json",
}


def get(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read().decode("utf-8"))


q = urllib.parse.quote("3401575390447")
data = get(f"https://drogariasaopauloitapevi.com/wp-json/wc/store/v1/products?search={q}&per_page=5")
print("gtin search count", len(data))
if data:
    p = data[0]
    print("keys", sorted(p.keys()))
    prices = p.get("prices") or {}
    print("name", p.get("name"))
    print("sku", p.get("sku"))
    print("prices", prices)
    print("permalink", p.get("permalink"))
    # extensions / meta
    for k in ("id", "sku", "global_unique_id", "extensions"):
        if k in p:
            print(k, str(p[k])[:400])

q2 = urllib.parse.quote("Agua Micelar Bioderma Sensibio")
data2 = get(
    "https://drogariasaopauloitapevi.com/wp-json/wc/store/v1/products?search="
    + urllib.parse.quote("Sensibio H2O 250")
    + "&per_page=5"
)
print("name search", len(data2))
for p in data2[:5]:
    pr = p.get("prices") or {}
    print("-", p.get("name"), pr.get("price"), pr.get("regular_price"), pr.get("sale_price"), p.get("sku"))
