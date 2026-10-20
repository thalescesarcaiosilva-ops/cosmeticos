#!/usr/bin/env python3
import json
from collections import Counter
from pathlib import Path

data = json.loads(Path("relatorio-precos-concorrentes.json").read_text(encoding="utf-8"))
rows = data["rows"]
print("SUMMARY", data["summary"])

low = [
    r
    for r in rows
    if r["action"] != "nao_encontrado"
    and ((r["carvalho_score"] or 1) < 0.9 or (r["itapevi_score"] or 1) < 0.9)
]
print("score<0.9", len(low))
for r in sorted(low, key=lambda x: min(x["carvalho_score"] or 1, x["itapevi_score"] or 1))[:15]:
    print(
        "C",
        r["carvalho_score"],
        "I",
        r["itapevi_score"],
        r["action"],
        r["our_price"],
        "->",
        r["target_15"],
    )
    print("  O", r["name"][:100])
    if r["carvalho_name"]:
        print("  C", r["carvalho_price"], r["carvalho_name"][:100])
    if r["itapevi_name"]:
        print("  I", r["itapevi_price"], r["itapevi_name"][:100])

print("\nTOP SUBIR")
ups = sorted((r for r in rows if r["action"] == "subir"), key=lambda r: -(r["delta"] or 0))
for r in ups[:12]:
    print(
        f"{r['our_price']:.2f} -> {r['target_15']:.2f} delta {r['delta']:+.2f} gap {r['gap_pct']}% | {r['name'][:75]}"
    )
    print(f"   C {r['carvalho_price']} {r['carvalho_name'][:70]}")
    if r["itapevi_price"]:
        print(f"   I {r['itapevi_price']} {r['itapevi_name'][:70]}")

print("\nTOP DESCER")
downs = sorted((r for r in rows if r["action"] == "descer"), key=lambda r: r["delta"] or 0)
for r in downs[:12]:
    print(
        f"{r['our_price']:.2f} -> {r['target_15']:.2f} delta {r['delta']:+.2f} | {r['name'][:75]}"
    )
    print(f"   C {r['carvalho_price']} {r['carvalho_name'][:70]}")
    if r["itapevi_price"]:
        print(f"   I {r['itapevi_price']} {r['itapevi_name'][:70]}")

print("\nMISSING", sum(1 for r in rows if r["action"] == "nao_encontrado"))
brands = Counter(r["brand"] or "?" for r in rows if r["action"] == "nao_encontrado")
print("missing brands", brands.most_common(20))
print("\nMISSING NAMES")
for r in sorted((x for x in rows if x["action"] == "nao_encontrado"), key=lambda x: (x["brand"], x["name"])):
    print(f"{r['brand']}\t{r['our_price']:.2f}\t{r['name']}")

print("\nALL SUBIR")
for r in sorted((x for x in rows if x["action"] == "subir"), key=lambda x: -(x["delta"] or 0)):
    print(
        f"{r['our_price']:.2f}\t{r['target_15']:.2f}\t{r['delta']:+.2f}\tC:{r['carvalho_price']}\tI:{r['itapevi_price']}\t{r['name']}"
    )
    if r["carvalho_name"] and r["carvalho_name"].lower()[:24] != r["name"].lower()[:24]:
        print(f"\tCNAME {r['carvalho_name']}")
    if r["itapevi_name"]:
        print(f"\tINAME {r['itapevi_name']}")

# median gap among found
gaps = [r["gap_pct"] for r in rows if r["gap_pct"] is not None]
gaps.sort()
if gaps:
    print("gap pct min/median/max", gaps[0], gaps[len(gaps)//2], gaps[-1])
    below15 = sum(1 for g in gaps if g > 15)
    print("already more than 15% below competitor", below15, "of", len(gaps))
