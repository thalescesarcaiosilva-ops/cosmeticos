#!/usr/bin/env python3
"""
Scrape cosmética de Drogaria Carvalho + Lunna e gera CSV WooCommerce único.

Regras:
- Prioriza Drogaria Carvalho em duplicatas entre lojas
- Deduplica dentro da mesma loja (GTIN / fingerprint de nome+volume)
- Preço = menor valor encontrado (PIX / preço atual); sem preço promocional
- Exclui perfumes e não-cosméticos
"""
from __future__ import annotations

import csv
import json
import re
import time
import unicodedata
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / "scripts" / "_scrape_cache"
OUT_CSV = ROOT / f"beleza-cosmeticos-woocommerce-{time.strftime('%Y%m%d_%H%M%S')}.csv"
REPORT_JSON = ROOT / f"beleza-cosmeticos-report-{time.strftime('%Y%m%d_%H%M%S')}.json"

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9",
}

LUNNA_CATEGORIES = [
    ("https://lunnacosmeticosbrasil.com/departamento/cabelo/shampoo", "Cuidados Capilares"),
    ("https://lunnacosmeticosbrasil.com/departamento/cabelo/condicionador", "Cuidados Capilares"),
    ("https://lunnacosmeticosbrasil.com/departamento/cabelo/mascara-capilar", "Cuidados Capilares"),
    ("https://lunnacosmeticosbrasil.com/departamento/cabelo/leave-in", "Cuidados Capilares"),
    ("https://lunnacosmeticosbrasil.com/departamento/cabelo/oleo-capilar", "Cuidados Capilares"),
    ("https://lunnacosmeticosbrasil.com/departamento/cabelo/protetor-termico", "Cuidados Capilares"),
    ("https://lunnacosmeticosbrasil.com/departamento/skincare/hidratante-facial", "Dermocosméticos"),
    ("https://lunnacosmeticosbrasil.com/departamento/skincare/creme-para-os-olhos", "Dermocosméticos"),
    ("https://lunnacosmeticosbrasil.com/departamento/skincare/mascara-facial", "Dermocosméticos"),
    ("https://lunnacosmeticosbrasil.com/departamento/skincare/tonico-facial", "Dermocosméticos"),
]

DROGARIA_EXCLUDE_PATH_PARTS = (
    "perfume",
    "acessorios-para-cabelos",
    "/acessorios",
    "/pincas",
    "nutricosmeticos",
    "chapinhas",
    "secadores",
    "/escovas",
    "/pentes",
    "prendedores",
    "algodao",
    "lixas-e-alicate",
)

PERFUME_NAME_RE = re.compile(
    r"\b("
    r"perfume|perfumes|colonia|col[oô]nia|eau\s*de\s*parfum|eau\s*de\s*toilette|"
    r"\bedp\b|\bedt\b|parfum|toilette|body\s*mist|splash"
    r")\b",
    re.I,
)

NON_COSMETIC_NAME_RE = re.compile(
    r"\b("
    r"fralda|creatina|whey|suplemento|vitamina\b|chapinha|prancha|secador|"
    r"escova\s+dental|escova\s+alisa|pente\b|prendedor|el[aá]stico\s+de\s+cabelo|"
    r"algod[aã]o|lixa\b|alicate|pin[cç]a\b|aparelho|difusor\s+el[eé]trico"
    r")\b",
    re.I,
)

VOLUME_RE = re.compile(
    r"(\d+[.,]?\d*)\s*(ml|g|kg|l|un|unidades|capsulas|c[aá]psulas|cp)\b",
    re.I,
)
# Letter-prefixed SKUs only (cm-01, ps-01). Avoid bare numbers / percentages.
CODE_RE = re.compile(r"\b([a-z]{2,5})[- ]?(\d{1,3})\b", re.I)
CODE_BLOCKLIST = {
    "ml",
    "kg",
    "un",
    "fps",
    "spf",
    "uh",
    "uv",
    "ph",
    "nm",
    "ip",
    "cor",
    "tom",
}

KNOWN_BRANDS = [
    "La Roche-Posay",
    "Vichy",
    "CeraVe",
    "Bioderma",
    "Eucerin",
    "ISDIN",
    "Avene",
    "Avène",
    "Nivea",
    "Neutrogena",
    "Principia",
    "Principia Skincare",
    "SkinCeuticals",
    "Skinceuticals",
    "Clinique",
    "Kérastase",
    "Kerastase",
    "L'Oréal Professionnel",
    "L'Oreal Professionnel",
    "L'Oréal Paris",
    "L'Oreal Paris",
    "L'Oréal",
    "L'Oreal",
    "Wella Professionals",
    "Wella",
    "Redken",
    "Joico",
    "Sebastian Professional",
    "Sebastian",
    "Braé",
    "Brae",
    "Moroccanoil",
    "Briogeo",
    "Océane",
    "Oceane",
    "Needs",
    "Sundown",
    "Episol",
    "Australian Gold",
    "Hawaiian Tropic",
    "Cenoura & Bronze",
    "Anasol",
    "Sunless",
    "Helioderm",
    "OAZ",
    "Medicube",
    "Skin1004",
    "Elizavecca",
    "Alpecin",
    "Pampers",
    "Lux",
    "Paixão",
    "Oral-B",
    "Max Titanium",
    "Ada Tina",
    "Adcos",
    "Anua",
    "Beauty of Joseon",
    "COSRX",
    "The Ordinary",
    "Paula's Choice",
    "Paula’s Choice",
    "Nacific",
    "Some By Mi",
    "Laneige",
    "Innisfree",
    "Missha",
    "Nuxe",
    "Uriage",
    "SVR",
    "Ducray",
    "Mustela",
    "Johnson's",
    "Dove",
    "Pantene",
    "Elseve",
    "Seda",
    "Salon Line",
    "Amend",
    "Siàge",
    "Siage",
    "Eudora",
    "Quem Disse, Berenice?",
    "Botik",
    "O Boticário",
    "Boticario",
    "Natura",
    "Avon",
    "Mary Kay",
    "MAC",
    "Maybelline",
    "Ruby Rose",
    "Vult",
    "Tracta",
    "Dailus",
    "Risqué",
    "Risque",
    "Impala",
    "Colorama",
    "Granado",
    "Bio-Oil",
    "Heliocare",
    "Anthelios",
    "Effaclar",
    "Cicaplast",
    "Lipikar",
    "Toleriane",
    "Normaderm",
    "Dercos",
    "Ambre Solaire",
    "Garnier",
    "Clear",
    "Head & Shoulders",
    "Tresemmé",
    "Tresemme",
    "Lola Cosmetics",
    "Cadiveu",
    "Felps",
    "Soupleliss",
    "Yenzah",
    "Forever Liss",
    "Muriel",
    "Novex",
    "Salon Line",
    "TIGI",
    "Matrix",
    "Biolage",
    "Schwarzkopf Professional",
    "Schwarzkopf",
    "Igora",
    "Bonacure",
    "BC Bonacure",
    "Oil Reflections",
    "Ultimate Repair",
    "Invigo",
    "Fusion",
    "Nutri Enrich",
    "Sol de Janeiro",
    "Sol De Janeiro",
    "Gisou",
    "Olaplex",
    "Pureology",
    "It's a 10",
    "It's A 10",
    "Color Wow",
    "Authentic Beauty Concept",
    "Keune",
    "Nioxin",
    "Silicon Mix",
    "Mise en Scène",
    "Mise en Scene",
    "N.P.P.E.",
    "Laces",
    "Sephora Collection",
    "Guerlain",
    "Sisley",
    "Lattafa",
    "Calvin Klein",
    "Paco Rabanne",
    "Jean Paul Gaultier",
    "Adidas",
    "Payot",
    "Sallve",
    "Simple Organic",
    "Creamy",
    "Beauts",
    "Principia",
    "Geek & Gorgeous",
    "The Inkey List",
    "Good Molecules",
    "CeraVe",
    "Cetaphil",
    "Aquaphor",
    "Bepantol",
    "Hipoglós",
    "Hipoglos",
    "Nebacetin",
    "Cicatrizan",
]

# Longer brands first for matching
KNOWN_BRANDS_SORTED = sorted(set(KNOWN_BRANDS), key=len, reverse=True)

WC_HEADERS = [
    "ID",
    "Tipo",
    "SKU",
    "GTIN, UPC, EAN, or ISBN",
    "Nome",
    "Publicado",
    "Em destaque?",
    "Visibilidade no catálogo",
    "Descrição curta",
    "Descrição",
    "Data de preço promocional começa em",
    "Data de preço promocional termina em",
    "Status do imposto",
    "Classe de imposto",
    "Em estoque?",
    "Estoque",
    "Quantidade baixa de estoque",
    "São permitidas encomendas?",
    "Vendido individualmente?",
    "Peso (lbs)",
    "Comprimento (in)",
    "Largura (in)",
    "Altura (in)",
    "Permitir avaliações de clientes?",
    "Observação de compra",
    "Preço promocional",
    "Preço",
    "Categorias",
    "Tags",
    "Classe de entrega",
    "Imagens",
    "Limite de downloads",
    "Dias para expirar o download",
    "Ascendente",
    "Grupo de produtos",
    "Upsells",
    "Venda cruzada",
    "URL externa",
    "Texto do botão",
    "Posição",
    "Brands",
    "Nome do atributo 1",
    "Valores do atributo 1",
    "Atributo 1 visível",
    "Atributo 1 global",
    "Nome do atributo 2",
    "Valores do atributo 2",
    "Atributo 2 visível",
    "Atributo 2 global",
    "Nome do atributo 3",
    "Valores do atributo 3",
    "Atributo 3 visível",
    "Atributo 3 global",
]


@dataclass
class Product:
    source: str  # drogariacarvalho | lunna
    source_url: str
    name: str
    brand: str
    gtin: str
    price: float
    description: str
    images: list[str] = field(default_factory=list)
    category: str = "Dermocosméticos"
    sku: str = ""
    fingerprint: str = ""
    category_path: str = ""


def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def norm(s: str) -> str:
    s = strip_accents(s or "").lower()
    s = s.replace("&", " e ")
    s = re.sub(r"[^a-z0-9%]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def fetch(url: str, retries: int = 5) -> str:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            last = e
            msg = str(e)
            # Back off harder on rate limits
            if "429" in msg:
                time.sleep(3.0 * (attempt + 1))
            else:
                time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(f"fetch failed {url}: {last}")


def parse_brl(text: str) -> float | None:
    m = re.search(r"([\d.]+),(\d{2})", text)
    if not m:
        return None
    whole = m.group(1).replace(".", "")
    return float(f"{whole}.{m.group(2)}")


def _norm_volume(qty_raw: str, unit_raw: str) -> str:
    qty = qty_raw.replace(",", ".")
    try:
        q = float(qty)
        qty = str(int(q)) if q.is_integer() else str(q)
    except ValueError:
        pass
    unit = strip_accents(unit_raw.lower())
    if unit in {"unidades", "capsulas", "cp"}:
        unit = "un"
    return f"{qty}{unit}"


def extract_volume_key(name: str) -> str:
    m = VOLUME_RE.search(name)
    if not m:
        return ""
    return _norm_volume(m.group(1), m.group(2))


def extract_all_volumes(name: str) -> list[str]:
    return [_norm_volume(m.group(1), m.group(2)) for m in VOLUME_RE.finditer(name)]


def extract_codes(name: str, sku_like_only: bool = False) -> list[str]:
    """Extract letter+number codes. sku_like_only keeps CM-01/PS-01 and drops line codes like CER-100."""
    codes = []
    for m in CODE_RE.finditer(norm(name)):
        letters, digits = m.group(1), m.group(2)
        if letters in CODE_BLOCKLIST:
            continue
        try:
            num = int(digits)
        except ValueError:
            continue
        if sku_like_only and num > 40:
            continue
        codes.append(f"{letters}-{digits}")
    return codes


def significant_tokens(name: str, brand: str = "") -> set[str]:
    n = norm(name)
    b = norm(brand)
    if b:
        n = n.replace(b, " ")
    n = VOLUME_RE.sub(" ", n)
    for c in extract_codes(name):
        n = n.replace(c.replace("-", " "), " ")
        n = n.replace(c.replace("-", ""), " ")
    return {t for t in n.split() if t not in STOP_TOKENS and len(t) > 2}


def token_similarity(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def token_containment(a: set[str], b: set[str]) -> float:
    """How much of the smaller token set is contained in the larger."""
    if not a or not b:
        return 0.0
    smaller, larger = (a, b) if len(a) <= len(b) else (b, a)
    return len(smaller & larger) / len(smaller)


PRODUCT_TYPE_PATTERNS = [
    ("shampoo", r"\bshampoo\b|\bbain\b"),
    ("condicionador", r"\bcondicionador\b|\bconditioner\b|\bfondant\b"),
    ("mascara-capilar", r"\bmascara\b.*\b(cabelo|capilar|hair)\b|\bhair\s*mask\b|\bmasque\b"),
    ("mascara-facial", r"\bmascara\b.*\b(facial|face|rosto)\b|\bsheet\s*mask\b"),
    ("leave-in", r"\bleave[\s-]?in\b|\bcreme para pentear\b"),
    ("oleo-capilar", r"\boleo\b.*\b(cabelo|capilar|hair)\b|\bhair\s*oil\b"),
    ("protetor-termico", r"\bprotetor termico\b|\bheat\s*protect"),
    ("protetor-solar", r"\bprotetor solar\b|\bsunscreen\b|\bfps\b|\bspf\b"),
    ("serum", r"\bserum\b|\bs[eé]rum\b|\bampola\b"),
    ("creme-facial", r"\bcreme\b.*\b(facial|face|rosto)\b|\bhidratante facial\b"),
    ("creme", r"\bcreme\b|\bcream\b"),
    ("gel", r"\bgel\b"),
    ("tonico", r"\btonico\b|\btoner\b"),
    ("esfoliante", r"\besfoliante\b|\bscrub\b"),
    ("limpador", r"\blimpeza\b|\blimpador\b|\bcleanser\b|\bsabonete\b|\bagua micelar\b"),
    ("olho", r"\bolhos\b|\beye\b|\bcontorno\b"),
    ("base", r"\bbase\b|\bfoundation\b"),
    ("corretivo", r"\bcorretivo\b|\bconcealer\b"),
    ("batom", r"\bbatom\b|\blipstick\b|\bgloss\b"),
    ("po", r"\bp[oó] compacto\b|\bpowder\b"),
    ("blush", r"\bblush\b"),
    ("delineador", r"\bdelineador\b|\beyeliner\b|\bl[aá]pis\b"),
    ("rimel", r"\brimel\b|\bm[aá]scara para c[ií]lios\b|\bmascara de cilios\b"),
    ("esmalte", r"\besmalte\b|\bnail\b"),
    ("oleo", r"\boleo\b|\boil\b"),
]


def product_type(name: str) -> str:
    n = norm(name)
    for label, pat in PRODUCT_TYPE_PATTERNS:
        if re.search(pat, n):
            return label
    return "outro"


def types_compatible(a: str, b: str) -> bool:
    if a == "outro" or b == "outro":
        return True
    if a == b:
        return True
    # allow close families
    families = [
        {"creme", "creme-facial", "hidratante"},
        {"mascara-capilar", "leave-in"},
        {"oleo", "oleo-capilar"},
    ]
    for fam in families:
        if a in fam and b in fam:
            return True
    return False


def near_key(p: "Product") -> str | None:
    """Stable key for same-SKU variants; None if not safe to group."""
    brand = norm(p.brand)
    if not brand or brand == "outros":
        return None
    ptype = product_type(p.name)
    if re.search(r"\bkit\b", norm(p.name)):
        # kits: require identical full volume multiset
        vols = extract_all_volumes(p.name)
        codes = extract_codes(p.name, sku_like_only=True)
        if not vols:
            return None
        return f"kit|{brand}|{ptype}|{','.join(sorted(codes))}|{','.join(sorted(vols))}"
    codes = extract_codes(p.name, sku_like_only=True)
    vol = extract_volume_key(p.name)
    if codes and vol:
        # SKU-like codes only (cm-01), not line codes (cer-100)
        return f"{brand}|{ptype}|{','.join(sorted(codes))}|{vol}"
    return None


def guess_brand(name: str, fallback: str = "") -> str:
    n = norm(name)
    for brand in KNOWN_BRANDS_SORTED:
        bn = norm(brand)
        if bn and bn in n:
            # canonicalize a few
            canon = brand
            if "principia" in bn:
                canon = "Principia"
            elif "kerastase" in bn:
                canon = "Kérastase"
            elif "loreal professionnel" in bn or "l oreal professionnel" in bn:
                canon = "L'Oréal Professionnel"
            elif "la roche" in bn:
                canon = "La Roche-Posay"
            elif "skinceuticals" in bn:
                canon = "SkinCeuticals"
            elif "brae" in bn:
                canon = "Braé"
            elif "oceane" in bn:
                canon = "Océane"
            elif brand in {"Anthelios", "Effaclar", "Cicaplast", "Lipikar", "Toleriane", "Normaderm"}:
                canon = "La Roche-Posay"
            elif brand == "Dercos":
                canon = "Vichy"
            return canon
    return fallback.strip() or "Outros"


STOP_TOKENS = {
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
    "com",
    "para",
    "em",
    "o",
    "a",
    "os",
    "as",
    "um",
    "uma",
    "the",
    "skincare",
    "kit",
    "new",
    "novo",
    "nova",
}


def fingerprint(name: str, brand: str = "", gtin: str = "") -> str:
    if gtin and re.fullmatch(r"\d{8,14}", gtin):
        # Still include volume+code for gtin collisions of different sizes? use gtin alone
        return f"gtin:{gtin}"

    n = norm(name)
    b = norm(brand)
    if b:
        n = n.replace(b, " ")

    vol = extract_volume_key(name)
    codes = extract_codes(name)

    # remove volume text from tokens
    n = VOLUME_RE.sub(" ", n)
    tokens = [t for t in n.split() if t not in STOP_TOKENS and len(t) > 1]
    # keep distinctive tokens sorted for order-insensitive match
    # but prefer keeping product line tokens
    core = " ".join(sorted(set(tokens)))
    parts = [core]
    if codes:
        parts.append("code:" + ",".join(sorted(set(codes))))
    if vol:
        parts.append("vol:" + vol)
    if b:
        parts.append("brand:" + b)
    return "|".join(parts)


def is_perfume_or_non_cosmetic(name: str, category_path: str = "") -> bool:
    path = norm(category_path)
    if "perfume" in path:
        return True
    if PERFUME_NAME_RE.search(name):
        return True
    if NON_COSMETIC_NAME_RE.search(name):
        return True
    return False


def map_drogaria_category(path: str, name: str) -> str:
    p = norm(path + " " + name)
    if any(k in p for k in ("protetor solar", "bronze", "pos sol", "heliocare", "anthelios", "fps")):
        return "Proteção Solar"
    if "maquiagem" in p or any(
        k in p for k in ("batom", "base ", "corretivo", "blush", "rimel", "rímel", "delineador", "sombra")
    ):
        return "Maquiagem"
    if any(
        k in p
        for k in (
            "cabelo",
            "capilar",
            "shampoo",
            "condicionador",
            "mascara capilar",
            "leave",
            "finalizador",
            "colorac",
            "descolor",
        )
    ):
        return "Cuidados Capilares"
    return "Dermocosméticos"


# --------------- Lunna ---------------


def parse_lunna_category_html(html: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(r'\{\\"id\\":\\"', html):
        i = m.start()
        depth = 0
        in_str = False
        j = i
        obj = None
        while j < len(html):
            if html.startswith('\\"', j):
                in_str = not in_str
                j += 2
                continue
            if not in_str:
                if html[j] == "{":
                    depth += 1
                elif html[j] == "}":
                    depth -= 1
                    if depth == 0:
                        raw = html[i : j + 1]
                        s = raw.replace('\\"', '"').replace("\\/", "/")
                        try:
                            obj = json.loads(s)
                        except json.JSONDecodeError:
                            obj = None
                        break
            j += 1
        if not obj:
            continue
        slug = obj.get("slug") or ""
        name = obj.get("name") or ""
        if not slug or not name or slug in seen:
            continue
        if not obj.get("brand") and not obj.get("gtin"):
            continue
        seen.add(slug)

        prices: list[float] = []
        gtin = str(obj.get("gtin") or "")
        for v in obj.get("variants") or []:
            if v.get("price") is not None:
                prices.append(float(v["price"]))
            if v.get("compareAtPrice") is not None:
                prices.append(float(v["compareAtPrice"]))
            if v.get("gtin"):
                gtin = str(v["gtin"])
        if obj.get("price") is not None:
            prices.append(float(obj["price"]))
        if obj.get("compareAtPrice") is not None:
            prices.append(float(obj["compareAtPrice"]))
        if not prices:
            continue
        img = ((obj.get("image") or {}).get("src")) or ""
        if img.startswith("/"):
            img = "https://lunnacosmeticosbrasil.com" + img
        out.append(
            {
                "slug": slug,
                "name": name,
                "brand": obj.get("brand") or "",
                "gtin": re.sub(r"\D", "", gtin),
                "price": min(prices),
                "image": img,
                "category_raw": obj.get("category") or "",
            }
        )
    return out


def enrich_lunna_product(slug: str) -> dict:
    cache = CACHE_DIR / "lunna_product" / f"{slug}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    url = f"https://lunnacosmeticosbrasil.com/produto/{slug}"
    html = fetch(url)
    ld_blocks = re.findall(
        r'<script type="application/ld\+json">(.*?)</script>', html, re.S | re.I
    )
    result = {"url": url, "price": None, "description": "", "gtin": "", "brand": "", "images": []}
    for block in ld_blocks:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        items = data if isinstance(data, list) else [data]
        for obj in items:
            if obj.get("@type") != "Product":
                continue
            result["description"] = obj.get("description") or ""
            result["gtin"] = str(obj.get("gtin13") or obj.get("gtin") or "")
            brand = obj.get("brand")
            if isinstance(brand, dict):
                result["brand"] = brand.get("name") or ""
            elif isinstance(brand, str):
                result["brand"] = brand
            offers = obj.get("offers") or {}
            if isinstance(offers, list):
                offers = offers[0] if offers else {}
            if offers.get("price") is not None:
                result["price"] = float(offers["price"])
            img = obj.get("image")
            if isinstance(img, str):
                result["images"] = [img]
            elif isinstance(img, list):
                result["images"] = [i for i in img if isinstance(i, str)]
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return result


def scrape_lunna() -> list[Product]:
    products: dict[str, Product] = {}
    for cat_url, store_cat in LUNNA_CATEGORIES:
        print(f"[lunna] category {cat_url}")
        html = fetch(cat_url)
        items = parse_lunna_category_html(html)
        print(f"  found {len(items)}")
        for item in items:
            if is_perfume_or_non_cosmetic(item["name"]):
                continue
            slug = item["slug"]
            if slug in products:
                continue
            products[slug] = Product(
                source="lunna",
                source_url=f"https://lunnacosmeticosbrasil.com/produto/{slug}",
                name=item["name"],
                brand=item["brand"] or guess_brand(item["name"]),
                gtin=item["gtin"],
                price=float(item["price"]),
                description="",
                images=[item["image"]] if item["image"] else [],
                category=store_cat,
                category_path=item.get("category_raw") or store_cat,
            )

    slugs = list(products.keys())
    print(f"[lunna] enriching {len(slugs)} product pages...")

    def work(slug: str) -> tuple[str, dict]:
        try:
            return slug, enrich_lunna_product(slug)
        except Exception as e:  # noqa: BLE001
            return slug, {"error": str(e)}

    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(work, s) for s in slugs]
        done = 0
        for fut in as_completed(futs):
            slug, data = fut.result()
            done += 1
            if done % 50 == 0:
                print(f"  enriched {done}/{len(slugs)}")
            p = products[slug]
            if data.get("error"):
                continue
            if data.get("price") is not None:
                p.price = min(p.price, float(data["price"]))
            if data.get("gtin"):
                p.gtin = re.sub(r"\D", "", str(data["gtin"])) or p.gtin
            if data.get("brand") and (not p.brand or p.brand == "Outros"):
                p.brand = data["brand"]
            if data.get("description"):
                p.description = data["description"]
            if data.get("images"):
                # prefer ld images if present
                p.images = data["images"]

    # Enrich global brand list with brands discovered at Lunna
    global KNOWN_BRANDS_SORTED
    extra = {p.brand for p in products.values() if p.brand and p.brand != "Outros"}
    if extra:
        KNOWN_BRANDS.extend(sorted(extra))
        KNOWN_BRANDS_SORTED = sorted(set(KNOWN_BRANDS), key=len, reverse=True)

    for p in products.values():
        p.brand = guess_brand(p.name, p.brand)
        p.fingerprint = fingerprint(p.name, p.brand, p.gtin)
    return list(products.values())


# --------------- Drogaria ---------------


def drogaria_category_urls() -> list[str]:
    sm = fetch("https://drogariacarvalho.com/sitemap.xml")
    locs = re.findall(r"<loc>(.*?)</loc>", sm)
    urls = []
    for u in locs:
        if "/p/" in u:
            continue
        if not u.startswith("https://drogariacarvalho.com/beleza"):
            continue
        # include /beleza and /beleza-premium trees
        low = u.lower()
        if any(part in low for part in DROGARIA_EXCLUDE_PATH_PARTS):
            continue
        urls.append(u)
    return sorted(set(urls))


def collect_drogaria_slugs() -> dict[str, str]:
    """slug -> category_path url where found."""
    found: dict[str, str] = {}
    cats = drogaria_category_urls()
    print(f"[drogaria] scanning {len(cats)} category pages")
    for url in cats:
        try:
            html = fetch(url)
        except Exception as e:  # noqa: BLE001
            print("  fail", url, e)
            continue
        paths = set(re.findall(r'href="(/p/[^"]+)"', html))
        for path in paths:
            slug = path.split("/p/", 1)[-1]
            if slug not in found:
                found[slug] = url
        print(f"  {url} -> {len(paths)} (total unique {len(found)})")

    # Pull same-code variants from sitemap (e.g. Principia CM-01 short vs long title)
    print("[drogaria] expanding same-code variants from sitemap...")
    sm = fetch("https://drogariacarvalho.com/sitemap.xml")
    all_product_slugs = [
        u.split("/p/", 1)[-1]
        for u in re.findall(r"<loc>(.*?)</loc>", sm)
        if "/p/" in u
    ]
    code_index: dict[str, set[str]] = {}
    for slug in found:
        for code in extract_codes(slug.replace("-", " "), sku_like_only=True):
            code_index.setdefault(code, set()).add(slug)

    added = 0
    for slug in all_product_slugs:
        if slug in found:
            continue
        low = slug.lower()
        if any(
            x in low
            for x in (
                "perfume",
                "colonia",
                "eau-de-",
                "fralda",
                "creatina",
                "whey",
                "vitamin",
                "pet-",
            )
        ):
            continue
        slug_codes = extract_codes(slug.replace("-", " "), sku_like_only=True)
        if not slug_codes:
            continue
        slug_toks = {t for t in slug.split("-") if len(t) > 2}
        matched = False
        for c in slug_codes:
            for existing in code_index.get(c, ()):
                exist_toks = {t for t in existing.split("-") if len(t) > 2}
                if token_similarity(slug_toks, exist_toks) >= 0.4:
                    matched = True
                    break
            if matched:
                break
        if matched:
            found[slug] = "sitemap-variant"
            added += 1
            for c in slug_codes:
                code_index.setdefault(c, set()).add(slug)
    print(f"  sitemap variants added: {added} (total unique {len(found)})")
    return found


def parse_drogaria_product(slug: str, category_url: str) -> Product | None:
    cache = CACHE_DIR / "drogaria_product" / f"{slug}.json"
    if cache.exists():
        data = json.loads(cache.read_text(encoding="utf-8"))
        p = Product(**data)
        # refresh brand if brand list improved since cache
        refreshed = guess_brand(p.name, p.brand)
        if refreshed and refreshed != p.brand:
            p.brand = refreshed
            p.fingerprint = fingerprint(p.name, p.brand, p.gtin)
            cache.write_text(json.dumps(asdict(p), ensure_ascii=False), encoding="utf-8")
        return p

    url = f"https://drogariacarvalho.com/p/{slug}"
    html = fetch(url)

    ld = re.search(
        r'<script type="application/ld\+json">(.*?)</script>', html, re.S | re.I
    )
    name = ""
    description = ""
    images: list[str] = []
    price_ld: float | None = None
    if ld:
        try:
            obj = json.loads(ld.group(1))
            if obj.get("@type") == "Product":
                name = obj.get("name") or ""
                description = obj.get("description") or ""
                img = obj.get("image")
                if isinstance(img, list):
                    images = [i for i in img if isinstance(i, str)]
                elif isinstance(img, str):
                    images = [img]
                offers = obj.get("offers") or {}
                if offers.get("price") is not None:
                    price_ld = float(offers["price"])
        except json.JSONDecodeError:
            pass

    if not name:
        m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S | re.I)
        if m:
            name = re.sub(r"<[^>]+>", "", m.group(1)).strip()

    if not name:
        return None

    if is_perfume_or_non_cosmetic(name, category_url):
        return None

    # Only prices from the main product block (before related shelf)
    main_html = html
    cut = re.search(
        r"Voc[eê]\s+tamb[eé]m\s+pode\s+gostar|Sugest[oõ]es\s+selecionadas",
        html,
        re.I,
    )
    if cut:
        main_html = html[: cut.start()]

    prices: list[float] = []
    if price_ld is not None:
        prices.append(price_ld)
    for m in re.finditer(r"R\$\s*([\d.]+,\d{2})\s*no PIX", main_html, re.I):
        v = parse_brl(m.group(0))
        if v is not None:
            prices.append(v)
    # Compre 1/2/3 unit prices — take unit (Compre 1) if present
    m_unit = re.search(
        r"Compre\s*1\s*R\$\s*([\d.]+,\d{2})",
        main_html,
        re.I,
    )
    if m_unit:
        v = parse_brl(m_unit.group(0))
        if v is not None:
            prices.append(v)

    if not prices:
        return None
    price = min(prices)

    brand = guess_brand(name)
    cat = map_drogaria_category(category_url, name)
    p = Product(
        source="drogariacarvalho",
        source_url=url,
        name=name,
        brand=brand,
        gtin="",
        price=round(price, 2),
        description=description,
        images=images,
        category=cat,
        category_path=category_url.replace("https://drogariacarvalho.com/", ""),
        fingerprint=fingerprint(name, brand, ""),
    )
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(asdict(p), ensure_ascii=False), encoding="utf-8")
    return p


def scrape_drogaria() -> list[Product]:
    slug_map = collect_drogaria_slugs()
    print(f"[drogaria] fetching {len(slug_map)} product pages...")
    products: list[Product] = []

    def work(item: tuple[str, str]) -> Product | None:
        slug, cat = item
        try:
            return parse_drogaria_product(slug, cat)
        except Exception as e:  # noqa: BLE001
            print("  error", slug, e)
            return None

    items = list(slug_map.items())
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = [ex.submit(work, it) for it in items]
        done = 0
        for fut in as_completed(futs):
            done += 1
            if done % 100 == 0:
                print(f"  fetched {done}/{len(items)}")
            p = fut.result()
            if p:
                products.append(p)
            time.sleep(0.05)
    return products


# --------------- Dedup / CSV ---------------


def soft_fingerprint(name: str, brand: str) -> str:
    """Fingerprint without relying on GTIN — for cross-store matching."""
    return fingerprint(name, brand, gtin="")


def merge_into(winner: Product, loser: Product, take_loser_price: bool = True) -> None:
    if take_loser_price and loser.price < winner.price:
        winner.price = loser.price
    if not winner.gtin and loser.gtin:
        winner.gtin = loser.gtin
    if (not winner.brand or winner.brand == "Outros") and loser.brand:
        winner.brand = loser.brand
    if len(loser.description or "") > len(winner.description or ""):
        # Prefer description from winner's source when sources differ
        if winner.source == loser.source or not winner.description:
            winner.description = loser.description
    if len(loser.images) > len(winner.images):
        if winner.source == loser.source or not winner.images:
            winner.images = loser.images


def find_cross_match(p: Product, candidates: list[Product]) -> Product | None:
    """Match Lunna product against Drogaria candidates."""
    g = p.gtin if p.gtin and re.fullmatch(r"\d{8,14}", p.gtin) else ""
    if g:
        for c in candidates:
            if c.gtin == g:
                return c

    pb = norm(p.brand)
    pvol = extract_volume_key(p.name)
    pcodes = set(extract_codes(p.name, sku_like_only=True))
    ptoks = significant_tokens(p.name, p.brand)
    ptype = product_type(p.name)
    best: Product | None = None
    best_score = 0.0
    for c in candidates:
        cb = norm(c.brand)
        if pb and cb and pb != cb and pb not in cb and cb not in pb:
            continue
        if not types_compatible(ptype, product_type(c.name)):
            continue
        cvol = extract_volume_key(c.name)
        if pvol and cvol and pvol != cvol:
            continue
        ccodes = set(extract_codes(c.name, sku_like_only=True))
        ctoks = significant_tokens(c.name, c.brand)
        score = token_similarity(ptoks, ctoks)
        contain = token_containment(ptoks, ctoks)
        if pcodes and ccodes and pcodes & ccodes and score >= 0.5:
            return c
        if (score >= 0.78 or contain >= 0.88) and max(score, contain) > best_score:
            best = c
            best_score = max(score, contain)
    return best


def deduplicate(drogaria: list[Product], lunna: list[Product]) -> list[Product]:
    report = {
        "drogaria_raw": len(drogaria),
        "lunna_raw": len(lunna),
        "dropped_internal_drogaria": [],
        "dropped_internal_lunna": [],
        "dropped_lunna_vs_drogaria": [],
        "gtin_filled_from_lunna": 0,
    }

    def dedup_list(items: list[Product], source_label: str) -> list[Product]:
        by_gtin: dict[str, Product] = {}
        by_near: dict[str, Product] = {}
        by_fp: dict[str, Product] = {}
        kept: list[Product] = []
        for p in items:
            g = p.gtin if p.gtin and re.fullmatch(r"\d{8,14}", p.gtin) else ""
            nk = near_key(p)
            fp = soft_fingerprint(p.name, p.brand)
            p.fingerprint = fingerprint(p.name, p.brand, p.gtin)

            existing = None
            key_kind = ""
            if g and g in by_gtin:
                existing = by_gtin[g]
                key_kind = "gtin"
            elif nk and nk in by_near:
                existing = by_near[nk]
                key_kind = "near"
            elif not nk and fp in by_fp:
                # only use soft fp when no structured near-key (avoids kit collisions)
                existing = by_fp[fp]
                key_kind = "fp"

            if existing:
                merge_into(existing, p, take_loser_price=True)
                # Prefer longer canonical name when same source
                if p.source == existing.source and len(p.name) > len(existing.name) + 10:
                    # keep longer name but already-min price
                    price = existing.price
                    existing.name = p.name
                    existing.price = price
                    if len(p.description) > len(existing.description or ""):
                        existing.description = p.description
                    if len(p.images) > len(existing.images):
                        existing.images = p.images
                report[f"dropped_internal_{source_label}"].append(
                    {
                        "kept": existing.name,
                        "dropped": p.name,
                        "via": key_kind,
                        "kept_url": existing.source_url,
                        "dropped_url": p.source_url,
                        "price": existing.price,
                    }
                )
                continue

            kept.append(p)
            if g:
                by_gtin[g] = p
            if nk:
                by_near[nk] = p
            by_fp[fp] = p
        return kept

    d_keep = dedup_list(drogaria, "drogaria")
    l_keep = dedup_list(lunna, "lunna")

    final: list[Product] = list(d_keep)
    for p in l_keep:
        match = find_cross_match(p, d_keep)
        if match:
            before_gtin = match.gtin
            merge_into(match, p, take_loser_price=False)  # keep drogaria price
            if match.gtin and not before_gtin:
                report["gtin_filled_from_lunna"] += 1
            report["dropped_lunna_vs_drogaria"].append(
                {
                    "kept_drogaria": match.name,
                    "dropped_lunna": p.name,
                    "via": "cross",
                    "kept_url": match.source_url,
                    "dropped_url": p.source_url,
                }
            )
            continue
        final.append(p)

    final = merge_near_duplicates(final, report)

    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"[dedup] drogaria {report['drogaria_raw']}->{len(d_keep)}, "
        f"lunna {report['lunna_raw']}->{len(l_keep)}, final {len(final)}"
    )
    print(f"[dedup] report -> {REPORT_JSON}")
    return final


def merge_near_duplicates(items: list[Product], report: dict) -> list[Product]:
    """Merge products with same brand + product code + volume (e.g. Principia CM-01 40g)."""
    groups: dict[str, list[Product]] = {}
    ungrouped: list[Product] = []
    for p in items:
        key = near_key(p)
        if not key:
            ungrouped.append(p)
            continue
        groups.setdefault(key, []).append(p)

    kept: list[Product] = list(ungrouped)
    for key, group in groups.items():
        if len(group) == 1:
            kept.extend(group)
            continue
        # prefer drogariacarvalho, then lower price, then longer description
        group.sort(
            key=lambda p: (
                0 if p.source == "drogariacarvalho" else 1,
                p.price,
                -len(p.description or ""),
                -len(p.images),
            )
        )
        winner = group[0]
        for loser in group[1:]:
            merge_into(winner, loser, take_loser_price=True)
            if len(loser.name) > len(winner.name) + 10 and loser.source == winner.source:
                price = winner.price
                winner.name = loser.name
                winner.price = price
            report.setdefault("dropped_near_dup", []).append(
                {
                    "kept": winner.name,
                    "dropped": loser.name,
                    "key": key,
                    "kept_url": winner.source_url,
                    "dropped_url": loser.source_url,
                    "price": winner.price,
                }
            )
        kept.append(winner)
    return kept


def make_sku(p: Product, idx: int) -> str:
    brand = norm(p.brand).replace(" ", "")[:8] or "prod"
    if p.gtin:
        return f"{brand}-{p.gtin[-8:]}"
    slug = re.sub(r"[^a-z0-9]+", "", norm(p.name))[:12]
    return f"{brand}-{slug}-{idx:04d}"[:40]


def to_wc_row(p: Product, idx: int) -> dict:
    sku = make_sku(p, idx)
    price = f"{p.price:.2f}"
    images = ", ".join(p.images)
    desc = p.description or p.name
    return {
        "ID": "",
        "Tipo": "simple",
        "SKU": sku,
        "GTIN, UPC, EAN, or ISBN": p.gtin or "",
        "Nome": p.name,
        "Publicado": "1",
        "Em destaque?": "",
        "Visibilidade no catálogo": "visible",
        "Descrição curta": "",
        "Descrição": desc,
        "Data de preço promocional começa em": "",
        "Data de preço promocional termina em": "",
        "Status do imposto": "taxable",
        "Classe de imposto": "",
        "Em estoque?": "1",
        "Estoque": "15",
        "Quantidade baixa de estoque": "",
        "São permitidas encomendas?": "",
        "Vendido individualmente?": "",
        "Peso (lbs)": "",
        "Comprimento (in)": "",
        "Largura (in)": "",
        "Altura (in)": "",
        "Permitir avaliações de clientes?": "1",
        "Observação de compra": "",
        "Preço promocional": "",
        "Preço": price,
        "Categorias": p.category,
        "Tags": "",
        "Classe de entrega": "",
        "Imagens": images,
        "Limite de downloads": "",
        "Dias para expirar o download": "",
        "Ascendente": "",
        "Grupo de produtos": "",
        "Upsells": "",
        "Venda cruzada": "",
        "URL externa": "",
        "Texto do botão": "",
        "Posição": "0",
        "Brands": p.brand,
        "Nome do atributo 1": "",
        "Valores do atributo 1": "",
        "Atributo 1 visível": "",
        "Atributo 1 global": "",
        "Nome do atributo 2": "",
        "Valores do atributo 2": "",
        "Atributo 2 visível": "",
        "Atributo 2 global": "",
        "Nome do atributo 3": "",
        "Valores do atributo 3": "",
        "Atributo 3 visível": "",
        "Atributo 3 global": "",
    }


def write_csv(products: list[Product]) -> Path:
    products = sorted(products, key=lambda p: (norm(p.brand), norm(p.name)))
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=WC_HEADERS, extrasaction="ignore")
        w.writeheader()
        for i, p in enumerate(products, start=1):
            w.writerow(to_wc_row(p, i))
    return OUT_CSV


def main() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    lunna = scrape_lunna()
    print(f"[lunna] products kept {len(lunna)}")

    drogaria = scrape_drogaria()
    print(f"[drogaria] products kept {len(drogaria)}")

    final = deduplicate(drogaria, lunna)
    # final filter safety
    final = [
        p
        for p in final
        if not is_perfume_or_non_cosmetic(p.name, p.category_path) and p.price > 0
    ]

    out = write_csv(final)
    elapsed = time.time() - t0
    with_gtin = sum(1 for p in final if p.gtin)
    by_source = {}
    for p in final:
        by_source[p.source] = by_source.get(p.source, 0) + 1
    print("=" * 60)
    print(f"CSV: {out}")
    print(f"Total: {len(final)} | com GTIN: {with_gtin} | fontes: {by_source}")
    print(f"Tempo: {elapsed/60:.1f} min")


if __name__ == "__main__":
    main()
