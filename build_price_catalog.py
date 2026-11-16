"""Captura preços públicos do Giassi e-commerce em cache; NÃO valida preço em loja física.
Fonte: JSON-LD Product/ItemList das páginas públicas de busca. Não acessar conta ou checkout.
Todas as falhas preservam o dado como indisponível; nenhum preço fictício.
"""
import concurrent.futures
import datetime
import html
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request
import requests
from bs4 import BeautifulSoup

TERMS = [
    "batata inglesa", "queijo mussarela", "queijo cheddar", "queijo parmesao",
    "requeijao", "frango", "bacon", "carne moida", "calabresa",
    "salsicha", "milho verde", "molho de tomate", "cebola", "tomate",
    "leite integral", "creme de leite", "manteiga", "presunto",
    "morango", "chocolate", "leite condensado", "leite em po",
    "refrigerante cola lata", "refrigerante coca cola", "refrigerante guarana",
    "agua mineral", "suco", "saco kraft", "batata palha",
]
ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "public" / "garimpo_catalog.json"

def fetch(term):
    path = urllib.parse.quote(term, safe="")
    url = f"https://www.giassi.com.br/{path}?map=ft"
    response = requests.get(url, timeout=16, headers={"User-Agent":"Mozilla/5.0"})
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    items = []
    for tag in soup.select('script[type="application/ld+json"]'):
        try: obj = json.loads(tag.string or tag.get_text())
        except (ValueError, TypeError): continue
        if isinstance(obj, dict) and obj.get("@type") == "ItemList":
            for row in obj.get("itemListElement", []):
                if isinstance(row, dict): items.append(row.get("item") or {})
    rows = []
    for prod in items:
        if not isinstance(prod, dict) or prod.get("@type") != "Product":
            continue
        raw_offer = prod.get("offers") or {}
        if not isinstance(raw_offer, dict):
            continue
        choices = raw_offer.get("offers") or [raw_offer]
        if not isinstance(choices, list):
            choices = [choices]
        for offer in choices:
            if not isinstance(offer, dict):
                continue
            try:
                price = float(offer.get("price", 0))
            except (TypeError, ValueError):
                continue
            if not (0 < price < 100_000) or offer.get("priceCurrency", "BRL") != "BRL":
                continue
            product_url = str(prod.get("@id") or "")
            if not product_url.startswith("https://www.giassi.com.br/"):
                continue
            brand = prod.get("brand")
            name = str(prod.get("name") or "").strip()
            if not name or len(name) > 250:
                continue
            rows.append({
                "name": name, "brand": (str(brand.get("name") or "") if isinstance(brand, dict) else str(brand or "")),
                "price": price, "currency": "BRL", "url": product_url,
                "validUntil": str(offer.get("priceValidUntil") or "")[:10],
                "availability": str(offer.get("availability") or ""),
                "channel": "Giassi e-commerce — preço pode variar por loja após login",
                "term": term,
            })
    return rows

def run():
    started = datetime.datetime.now(datetime.timezone.utc)
    found = {}
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        jobs = {pool.submit(fetch, term): term for term in TERMS}
        for job in concurrent.futures.as_completed(jobs):
            term = jobs[job]
            try:
                rows = job.result()
                for row in rows:
                    found[row["url"]] = row
                print(f"Preço Giassi: {term}: {len(rows)} itens")
            except Exception as exc:
                failures.append(term)
                print(f"Sem consulta Giassi para {term}: {exc}")
    records = list(found.values())
    records.sort(key=lambda x: (x["name"].casefold(), x["price"]))
    result = {
        "source": "giassi.com.br",
        "channel": "e-commerce",
        "physicalStoreVerified": False,
        "collectedAt": started.isoformat(timespec="seconds"),
        "retrievalLimitHours": 24,
        "terms": TERMS,
        "failedTerms": failures,
        "products": records,
        "note": "Referência online; selecionar loja no Giassi para preço regional. Não significa oferta vigente em loja física.",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Garimpo catálogo salvo: {len(records)} itens, {len(failures)} consultas sem dados")
    return len(records)

if __name__ == "__main__":
    run()
