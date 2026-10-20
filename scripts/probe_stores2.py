#!/usr/bin/env python3
import re
import urllib.request

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9",
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        print("OK", r.status, r.geturl(), "ctype", r.headers.get("Content-Type"))
        return r.read().decode("utf-8", "replace")


try:
    sm = fetch("https://drogariasaopauloitapevi.com/wp-sitemap.xml")
    locs = re.findall(r"<loc>(.*?)</loc>", sm)
    print("sitemaps", len(locs))
    for l in locs:
        print(" ", l)
except Exception as e:
    print("sitemap fail", e)

for url in [
    "https://drogariasaopauloitapevi.com/wp-json/wc/store/v1/products?search=bioderma&per_page=2",
    "https://drogariasaopauloitapevi.com/?s=3401575390447&post_type=product",
    "https://drogariacarvalho.com/busca?q=sensibio",
]:
    try:
        html = fetch(url)
        print(url, "len", len(html))
        print(html[:400].replace("\n", " "))
        print("---")
    except Exception as e:
        print("FAIL", url, e)
