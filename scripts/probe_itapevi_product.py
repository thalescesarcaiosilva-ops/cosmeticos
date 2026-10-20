#!/usr/bin/env python3
import json
import re
import urllib.request

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json,text/html,*/*",
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", "replace")


raw = fetch(
    "https://drogariasaopauloitapevi.com/wp-json/wc/store/v1/products?search=bioderma&per_page=1"
)
data = json.loads(raw)
print("count", len(data))
if data:
    p = data[0]
    print("name", p["name"])
    print("prices", json.dumps(p.get("prices"), ensure_ascii=False))
    print("sku", p.get("sku"))
    print("keys", sorted(p.keys()))

sm = fetch("https://drogariasaopauloitapevi.com/wp-sitemap-posts-product-1.xml")
urls = re.findall(r"<loc>(.*?)</loc>", sm)
print("sitemap1", len(urls), urls[0])
sm2 = fetch("https://drogariasaopauloitapevi.com/wp-sitemap-posts-product-2.xml")
urls2 = re.findall(r"<loc>(.*?)</loc>", sm2)
print("sitemap2", len(urls2))

html = fetch(urls[0])
print("product page", urls[0], "len", len(html))
blocks = re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S | re.I)
print("ld blocks", len(blocks))
for b in blocks[:3]:
    print(b[:1500])
    print("---")
for pat in ["gtin", "sku", "woocommerce-Price-amount", "regular_price"]:
    print(pat, html.lower().count(pat.lower()))
