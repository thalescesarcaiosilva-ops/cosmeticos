#!/usr/bin/env python3
import json
import urllib.request

UA = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
url = "https://drogariasaopauloitapevi.com/wp-json/wc/store/v1/products?per_page=1&page=1"
req = urllib.request.Request(url, headers=UA)
with urllib.request.urlopen(req, timeout=40) as r:
    print("status", r.status)
    for k, v in r.headers.items():
        if "total" in k.lower() or "page" in k.lower() or k.lower().startswith("x-"):
            print(k, v)
    data = json.loads(r.read().decode())
    p = data[0]
    print("extensions", json.dumps(p.get("extensions"), ensure_ascii=False)[:800])
    print("brands", p.get("brands"))
    print("on_sale", p.get("on_sale"), "prices", p.get("prices"))
