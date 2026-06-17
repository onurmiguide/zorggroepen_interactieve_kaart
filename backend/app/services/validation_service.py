"""Kleine validatie- en normalisatiehelpers."""
from __future__ import annotations

import re
import unicodedata


def normalize_text(value: str) -> str:
    """Zelfde idee als normalizeText in script.js: lowercase, accenten weg,
    niet-alfanumeriek -> spatie, witruimte samengevoegd."""
    text = (value or "").lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.replace("&", " en ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return text.strip()


_URL_RE = re.compile(r"^https?://[^\s]+$", re.IGNORECASE)


def is_valid_url(value: str) -> bool:
    if not value:
        return True  # leeg is toegestaan
    return bool(_URL_RE.match(value.strip()))


_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def is_valid_color(value: str) -> bool:
    if not value:
        return True  # leeg = automatische kleur uit de naam
    return bool(_COLOR_RE.match(value.strip()))
