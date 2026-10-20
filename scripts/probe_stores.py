#!/usr/bin/env python3
import urllib.request

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

urls = [
    "https://drogariasaopauloitapevi.com/",
    "https://drogariasaopauloitapevi.com/sitemap.xml",
    "https://drogariasaopauloitapevi.com/robots.txt",
    "https://drogariacarvalho.com/busca?q=3401575390447",
]
for url in urls:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read(400)
            print("OK", r.status, url, r.geturl(), data[:180])
    except Exception as e:
        print("FAIL", url, type(e).__name__, e)
