#!/usr/bin/env python3
import re
import urllib.parse
import urllib.request

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        print("final", r.geturl(), "len incoming")
        return r.read().decode("utf-8", "replace")


q = urllib.parse.quote("Água Micelar Bioderma Sensibio H2O 250ml")
html = fetch(f"https://drogariacarvalho.com/busca?q={q}")
print("len", len(html))
links = sorted(set(re.findall(r'href="(/p/[^"]+)"', html)))
print("product links", len(links))
for l in links[:8]:
    print(" ", l)
# articles
arts = re.findall(r"<article[\s\S]*?</article>", html)
print("articles", len(arts))
if arts:
    text = re.sub(r"<[^>]+>", " ", arts[0])
    text = re.sub(r"\s+", " ", text)
    print(text[:500])
