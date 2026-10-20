#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        print("status", r.status, "ctype", r.headers.get("Content-Type"), "len incoming")
        data = r.read()
        print("bytes", len(data))
        return data.decode("utf-8", "replace")


html = fetch("https://drogariasaopauloitapevi.com/")
print("title", re.search(r"<title>(.*?)</title>", html, re.I | re.S))
for pat in ["vtex", "shopify", "woocommerce", "nuvemshop", "tray", "gtin", "__NEXT_DATA__", "application/ld+json"]:
    print(pat, html.lower().count(pat.lower()))
links = sorted(set(re.findall(r'href="([^"]+)"', html)))
print("links sample")
for l in links[:40]:
    print(" ", l[:140])
