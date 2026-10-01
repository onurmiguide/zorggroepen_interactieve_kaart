"""Haalt alle postcodes (PC6) met hun gemeente op via de PDOK Locatieserver en vat ze samen
per PC4: {"3012": {"Rotterdam": 174}, ...} (aantal PC6 per gemeente). Wordt gebruikt voor
het automatische PC4-overzicht per zorggroep in de admin (tabel pc4_gemeenten).

Gebruik (vanuit de repo-root):  python backend/scripts/fetch_pc4_gemeenten.py
Duurt een paar minuten (~4.800 verzoeken, verdeeld over een paar threads).
"""
from __future__ import annotations

import datetime as dt
import json
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free"
ROWS = 100
THREADS = 6
OUT = Path(__file__).resolve().parents[2] / "zg-data" / "pc4_gemeenten.json"


def fetch(prefix: str, start: int) -> dict:
    params = {
        "q": f"postcode:{prefix}*",
        "fq": "type:postcode",
        "fl": "id,postcode,gemeentenaam",
        "sort": "postcode asc,id asc",
        "rows": ROWS,
        "start": start,
    }
    url = f"{URL}?{urllib.parse.urlencode(params)}"
    for attempt in range(1, 6):
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                return json.load(resp)["response"]
        except Exception:  # noqa: BLE001 - netwerkfout: opnieuw proberen
            if attempt == 5:
                raise
            time.sleep(attempt * 2)
    raise RuntimeError("onbereikbaar")


def fetch_prefix(prefix: str) -> tuple[str, list[dict], int]:
    first = fetch(prefix, 0)
    docs = list(first["docs"])
    for start in range(ROWS, first["numFound"], ROWS):
        docs.extend(fetch(prefix, start)["docs"])
    return prefix, docs, first["numFound"]


def main() -> None:
    # Per PC3: PDOK pagineert maximaal 10.000 resultaten per zoekopdracht.
    prefixes = [f"{n:03d}" for n in range(100, 1000)]
    counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    seen: set[str] = set()
    expected = 0
    with ThreadPoolExecutor(max_workers=THREADS) as pool:
        for prefix, docs, found in pool.map(fetch_prefix, prefixes):
            expected += found
            for d in docs:
                # Ontdubbelen op document-id: een PC6 kan in twee gemeenten liggen (twee documenten).
                if d["id"] in seen:
                    continue
                seen.add(d["id"])
                counts[d["postcode"][:4]][d["gemeentenaam"]] += 1
            if prefix.endswith("0"):
                print(f"{prefix}..: {len(seen)} postcodes tot nu toe", flush=True)
    if len(seen) != expected:
        raise SystemExit(f"Onvolledig: {len(seen)} van {expected} postcodes opgehaald.")
    data = {
        "bron": "PDOK Locatieserver (postcodes met gemeente)",
        "versie": dt.date.today().isoformat(),
        "aantal_documenten": len(seen),
        "pc4": {pc4: dict(sorted(g.items())) for pc4, g in sorted(counts.items())},
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(data['pc4'])} PC4-gebieden ({len(seen)} postcodes) geschreven naar {OUT}")


if __name__ == "__main__":
    main()
