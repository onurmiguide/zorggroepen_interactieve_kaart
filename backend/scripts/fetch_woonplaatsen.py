"""Haalt alle Nederlandse woonplaatsen (BAG) met hun gemeente op via de PDOK Locatieserver
en schrijft ze naar zg-data/woonplaatsen.json. Die lijst wordt eenmalig in de admin-tabel
'plaatsnamen' gezet (zie import_seed._ensure_woonplaatsen).

Gebruik (vanuit de repo-root):  python backend/scripts/fetch_woonplaatsen.py
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free"
ROWS = 100
OUT = Path(__file__).resolve().parents[2] / "zg-data" / "woonplaatsen.json"


def fetch_page(start: int) -> dict:
    params = {
        "q": "*:*",
        "fq": "type:woonplaats",
        "fl": "woonplaatscode,woonplaatsnaam,gemeentenaam,provincienaam",
        "sort": "woonplaatscode asc",
        "rows": ROWS,
        "start": start,
    }
    with urllib.request.urlopen(f"{URL}?{urllib.parse.urlencode(params)}", timeout=30) as resp:
        return json.load(resp)["response"]


def main() -> None:
    first = fetch_page(0)
    total = first["numFound"]
    docs = list(first["docs"])
    for start in range(ROWS, total, ROWS):
        docs.extend(fetch_page(start)["docs"])
    rows = {
        d["woonplaatscode"]: {
            "woonplaats": d["woonplaatsnaam"],
            "gemeente": d["gemeentenaam"],
            "provincie": d.get("provincienaam", ""),
        }
        for d in docs
    }
    if len(rows) != total:
        raise SystemExit(f"Onvolledig: {len(rows)} van {total} woonplaatsen opgehaald.")
    data = {
        "bron": "PDOK Locatieserver (BAG woonplaatsen)",
        "woonplaatsen": sorted(rows.values(), key=lambda r: (r["woonplaats"].lower(), r["gemeente"])),
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(rows)} woonplaatsen geschreven naar {OUT}")


if __name__ == "__main__":
    main()
