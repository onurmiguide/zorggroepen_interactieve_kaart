from __future__ import annotations

import copy
import io
import json
import os
import re
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

try:
    import fitz  # type: ignore
except ImportError:  # pragma: no cover
    fitz = None

try:
    from PIL import Image  # type: ignore
except ImportError:  # pragma: no cover
    Image = None

try:
    import pytesseract  # type: ignore
except ImportError:  # pragma: no cover
    pytesseract = None


BASE_DIR = Path(__file__).resolve().parent.parent
SCHEMA_PATH = BASE_DIR / "data" / "referral-schema.json"
REQUIRED_FIELD_PATHS = [
    "sender.name",
    "sender.agb_code",
    "person.first_name",
    "person.last_name",
    "person.date_of_birth",
    "person.bsn",
    "contact.street",
    "contact.house_number",
    "contact.postal_code",
    "contact.city",
    "insurance.insurer",
    "referral.referral_date",
    "referral.gp_name",
    "referral.practice_name",
    "referral.care_product_name",
]
AI_AUTH_API_URL = os.getenv("APIFREELLM_AUTH_API_URL", "https://apifreellm.com/api/v1/chat")
AI_PUBLIC_API_URL = os.getenv("APIFREELLM_PUBLIC_API_URL", "https://apifreellm.com/api/chat")
AI_MODEL = os.getenv("APIFREELLM_MODEL", "apifreellm")


def configure_tesseract() -> None:
    if pytesseract is None:
        return

    configured = os.getenv("TESSERACT_CMD", "").strip()
    if configured:
        pytesseract.pytesseract.tesseract_cmd = configured
        return

    common_paths = [
        Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
        Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
        Path.home() / "AppData" / "Local" / "Programs" / "Tesseract-OCR" / "tesseract.exe",
    ]
    for path in common_paths:
        if path.exists():
            pytesseract.pytesseract.tesseract_cmd = str(path)
            return


def load_schema() -> dict[str, Any]:
    with SCHEMA_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def get_empty_output(schema: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": schema.get("status", "draft"),
        "tool": schema.get("tool", "losse-verwijzing-verwerken"),
        "input_types": list(schema.get("input_types", [])),
        "fields": copy.deepcopy(schema.get("fields", {})),
    }


def get_ai_api_key() -> str:
    return (
        os.getenv("APIFREELLM_API_KEY", "").strip()
        or os.getenv("APIFREELM_API_KEY", "").strip()
        or os.getenv("FREE_LLM_API_KEY", "").strip()
    )


def get_source_type(filename: str, content_type: str | None = None) -> str:
    lower_name = (filename or "").lower()
    if content_type == "application/pdf" or lower_name.endswith(".pdf"):
        return "pdf"
    if (content_type or "").startswith("image/"):
        return "image"
    if lower_name.endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff")):
        return "image"
    return "unknown"


def normalize_extracted_text(text: str) -> str:
    return (
        str(text or "")
        .replace("\r", "")
        .replace("\u00a0", " ")
    )


def collapse_text(text: str) -> str:
    return (
        normalize_extracted_text(text)
        .replace("\t", " ")
        .replace(" \n", "\n")
        .strip()
    )


def normalize_key(value: str) -> str:
    normalized = unicodedata.normalize("NFD", str(value or "").lower())
    normalized = "".join(character for character in normalized if unicodedata.category(character) != "Mn")
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return normalized.strip()


def split_non_empty_lines(text: str) -> list[str]:
    return [line.strip() for line in collapse_text(text).split("\n") if line.strip()]


def is_section_header(line: str) -> bool:
    return normalize_key(line) in {
        "verzender",
        "patient",
        "verwijzingsgegevens",
        "kerndeel klinische informatie",
    }


def get_section_id(line: str) -> str | None:
    normalized = normalize_key(line)
    if normalized == "verzender":
        return "sender"
    if normalized == "patient":
        return "patient"
    if normalized == "verwijzingsgegevens":
        return "referral"
    if normalized == "kerndeel klinische informatie":
        return "clinical"
    return None


def split_into_sections(text: str) -> dict[str, list[str]]:
    sections = {"sender": [], "patient": [], "referral": [], "clinical": []}
    current_section: str | None = None

    for line in split_non_empty_lines(text):
        section_id = get_section_id(line)
        if section_id:
            current_section = section_id
            continue
        if is_section_header(line):
            continue
        if current_section:
            sections[current_section].append(line)

    return sections


def line_looks_like_label(line: str) -> bool:
    trimmed = str(line or "").strip()
    if not trimmed:
        return False
    return bool(re.match(r"^[A-Za-z][A-Za-z0-9()\-/.\s]+:\s*(.*)?$", trimmed))


def collect_value_lines(lines: list[str], start_index: int) -> list[str]:
    values: list[str] = []
    for index in range(start_index, len(lines)):
        line = lines[index]
        if not line:
            continue
        if is_section_header(line) or line_looks_like_label(line):
            break
        values.append(line.strip())
    return values


def parse_section_fields(lines: list[str]) -> dict[str, str]:
    fields: dict[str, str] = {}
    index = 0
    while index < len(lines):
        line = lines[index]
        if not line:
            index += 1
            continue

        if (
            normalize_key(line) == "organisatie"
            and index + 1 < len(lines)
            and normalize_key(lines[index + 1]) == "agb code"
        ):
            values = collect_value_lines(lines, index + 2)
            fields["organisatie agb code"] = " ".join(values).strip()
            index += len(values) + 2
            continue

        inline_match = re.match(r"^([^:]+):\s*(.*)$", line)
        if not inline_match:
            index += 1
            continue

        label = normalize_key(inline_match.group(1))
        inline_value = inline_match.group(2).strip()
        if inline_value:
            fields[label] = inline_value
            index += 1
            continue

        values = collect_value_lines(lines, index + 1)
        fields[label] = " ".join(values).strip()
        index += len(values) + 1

    return fields


def split_street_and_house_number(value: str) -> dict[str, str]:
    input_value = str(value or "").strip()
    if not input_value:
        return {"street": "", "house_number": ""}
    match = re.match(r"^(.*?)(?:\s+)(\d+[A-Za-z0-9\-/]*)$", input_value)
    if not match:
        return {"street": input_value, "house_number": ""}
    return {"street": match.group(1).strip(), "house_number": match.group(2).strip()}


def split_postal_code_and_city(value: str) -> dict[str, str]:
    input_value = str(value or "").strip()
    if not input_value:
        return {"postal_code": "", "city": ""}
    match = re.search(r"(\d{4}\s?[A-Z]{2})\s+(.+)$", input_value, flags=re.IGNORECASE)
    if not match:
        return {"postal_code": "", "city": input_value}
    postal = match.group(1).upper().replace(" ", "")
    postal = re.sub(r"^(\d{4})([A-Z]{2})$", r"\1 \2", postal)
    return {"postal_code": postal, "city": match.group(2).strip()}


def clean_phone_number(value: str) -> str:
    raw = str(value or "").strip()
    digits = re.sub(r"\D+", "", raw)
    if not digits:
        return ""
    country_prefixed = False
    if digits.startswith("0031"):
        digits = digits[4:]
        country_prefixed = True
    elif digits.startswith("31"):
        digits = digits[2:]
        country_prefixed = True
    if country_prefixed and digits.startswith("0"):
        # Some documents write +31 (0)6..., while the local trunk zero should be dropped first.
        digits = digits[1:]
    if digits.startswith("6") and len(digits) == 9:
        digits = f"0{digits}"
    if re.fullmatch(r"06\d{8}", digits):
        return digits
    return ""


def clean_bsn(value: str) -> str:
    return re.sub(r"\D+", "", str(value or ""))


def is_valid_bsn(value: str) -> bool:
    return bool(re.fullmatch(r"\d{9}", clean_bsn(value)))


def is_field_missing(value: Any) -> bool:
    return not str(value or "").strip()


def clean_email(value: str) -> str:
    return str(value or "").strip().lower()


def split_person_name(raw_name: str) -> dict[str, str]:
    cleaned = re.sub(r"^(dhr\.?|de heer|mevr\.?|mevrouw)\s+", "", str(raw_name or "").strip(), flags=re.IGNORECASE)
    if not cleaned:
        return {"initials": "", "first_name": "", "last_name": ""}

    parts = cleaned.split()
    if len(parts) == 1:
        part = parts[0]
        return {"initials": part.replace(".", ""), "first_name": part, "last_name": ""}

    surname_start = len(parts) - 1
    while surname_start > 0 and re.fullmatch(r"[a-z]{1,4}", parts[surname_start - 1]):
        surname_start -= 1

    first_names = parts[:surname_start]
    surname_parts = parts[surname_start:]
    initials = "".join(
        part[0].upper()
        for part in (re.sub(r"[^A-Za-z]", "", part) for part in first_names)
        if part
    )

    return {
        "initials": initials,
        "first_name": " ".join(first_names).strip(),
        "last_name": " ".join(surname_parts).strip(),
    }


def infer_gender(raw_name: str) -> str:
    normalized = normalize_key(raw_name)
    if normalized.startswith("dhr") or normalized.startswith("de heer"):
        return "man"
    if normalized.startswith("mevr") or normalized.startswith("mevrouw"):
        return "vrouw"
    return ""


def infer_referral_type(care_product_name: str, care_question: str, clinical_information: str) -> str:
    combined = normalize_key(f"{care_product_name} {care_question} {clinical_information}")
    if "gli" in combined and "cool" in combined:
        return "GLI / COOL"
    if "gli" in combined:
        return "GLI"
    if "leefstijl" in combined:
        return "Leefstijl"
    return ""


def extract_clinical_information(lines: list[str]) -> str:
    return collapse_text("\n".join(lines))


PHONE_CANDIDATE_PATTERN = re.compile(
    r"(?<!\d)(?:(?:\+|00)?31[\s()./\-]*\(?(?:0)?\)?[\s()./\-]*6|0?6)(?:[\s()./\-]*\d){8}(?!\d)",
    flags=re.IGNORECASE,
)
LABELED_PHONE_PATTERN = re.compile(
    r"(?:^|\b)(?:tel|telefoon|telefoonnummer|mobiel)\.?\s*:?\s*(?:\n\s*)?("
    r"(?:(?:\+|00)?31[\s()./\-]*\(?(?:0)?\)?[\s()./\-]*6|0?6)(?:[\s()./\-]*\d){8}"
    r")",
    flags=re.IGNORECASE,
)


def extract_phone_candidates(*chunks: str) -> list[str]:
    combined = "\n".join(chunk for chunk in chunks if chunk)
    if not combined:
        return []

    candidates: list[str] = []
    seen: set[str] = set()

    def add_candidate(raw_value: str) -> None:
        cleaned = clean_phone_number(raw_value)
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            candidates.append(cleaned)

    for match in LABELED_PHONE_PATTERN.finditer(combined):
        add_candidate(match.group(1))
    for match in PHONE_CANDIDATE_PATTERN.finditer(combined):
        add_candidate(match.group(0))

    return candidates


def extract_phone_from_text(*chunks: str) -> str:
    candidates = extract_phone_candidates(*chunks)
    if not candidates:
        return ""
    return candidates[0]


def normalize_flat_referral_text(text: str) -> str:
    normalized = collapse_text(text)
    replacements = {
        "Verzekeringsnum\nmer:": "Verzekeringsnummer:",
        "Naam\nzorgproduct:": "Naam zorgproduct:",
        "Patiënt-ID\nzorginstelling:": "Patiënt-ID zorginstelling:",
        "Intercollegiaal\noverleg:": "Intercollegiaal overleg:",
        "Reden van verwijzing,\nvraagstelling": "Reden van verwijzing, vraagstelling",
        "Relevante probleem-\n/episodelijst": "Relevante probleem-/episodelijst",
    }
    for source, target in replacements.items():
        normalized = normalized.replace(source, target)
    return normalized


def get_label_value_matches(text: str, label_pattern: str) -> list[str]:
    pattern = re.compile(rf"{label_pattern}\s*\n?([^\n]+)", flags=re.IGNORECASE)
    return [match.group(1).strip() for match in pattern.finditer(text) if match.group(1).strip()]


def extract_between(text: str, start_pattern: str, end_patterns: list[str]) -> str:
    start_match = re.search(start_pattern, text, flags=re.IGNORECASE)
    if not start_match:
        return ""
    remainder = text[start_match.end():]
    end_index = len(remainder)
    for pattern in end_patterns:
        end_match = re.search(pattern, remainder, flags=re.IGNORECASE)
        if end_match:
            end_index = min(end_index, end_match.start())
    return collapse_text(remainder[:end_index])


def merge_missing_values(base: dict[str, Any], supplement: dict[str, Any]) -> dict[str, Any]:
    merged = copy.deepcopy(base)
    for section_name, section_values in supplement.items():
        if not isinstance(section_values, dict):
            continue
        target_section = merged.setdefault(section_name, {})
        for key, value in section_values.items():
            if not str(target_section.get(key, "")).strip() and str(value or "").strip():
                target_section[key] = value
    return merged


def extract_flat_referral_fields(text: str) -> dict[str, Any]:
    normalized = normalize_flat_referral_text(text)
    name_matches = get_label_value_matches(normalized, r"Naam:")
    address_matches = get_label_value_matches(normalized, r"Adres:")
    city_matches = get_label_value_matches(normalized, r"Woonplaats:")
    organization_matches = get_label_value_matches(normalized, r"Organisatie:")
    org_agb_matches = get_label_value_matches(normalized, r"Org\.\s*AGB-code:")

    patient_name_raw = next(
        (value for value in name_matches if re.search(r"\b(dhr|mevr|mevrouw|de heer)\b", value, flags=re.IGNORECASE)),
        name_matches[1] if len(name_matches) > 1 else "",
    )
    sender_name_raw = next(
        (value for value in name_matches if re.search(r"\b(dr\.?|huisarts)\b", value, flags=re.IGNORECASE)),
        name_matches[0] if name_matches else "",
    )

    patient_address = split_street_and_house_number(address_matches[0] if len(address_matches) > 0 else "")
    sender_address = split_street_and_house_number(address_matches[1] if len(address_matches) > 1 else "")
    patient_city = split_postal_code_and_city(city_matches[0] if len(city_matches) > 0 else "")
    sender_city = split_postal_code_and_city(city_matches[1] if len(city_matches) > 1 else "")
    person_name = split_person_name(patient_name_raw)

    care_product_lines = get_label_value_matches(normalized, r"Naam zorgproduct:")
    care_product = care_product_lines[0] if care_product_lines else ""
    if care_product and "100% vergoed" not in care_product:
        care_product = re.sub(
            r"(Naam zorgproduct:\s*[^\n]+\n)(100%\s+vergoed)",
            lambda match: f"{match.group(1).strip()} {match.group(2)}",
            f"Naam zorgproduct:\n{care_product}\n{normalized}",
            count=1,
            flags=re.IGNORECASE,
        ).splitlines()[1].strip()

    clinical_information = extract_between(
        normalized,
        r"Reden van verwijzing,\s*vraagstelling",
        [r"\bJournaal\b", r"\bRelevante probleem", r"\bMedicatie actueel\b", r"\bBesproken met patiënt\b"],
    )
    care_question_matches = get_label_value_matches(normalized, r"Zorgvraag:")
    patient_phone = (
        extract_phone_from_text(
            "\n".join(get_label_value_matches(normalized, r"Tel mobiel:")),
            "\n".join(get_label_value_matches(normalized, r"Telefoonnummer:")),
            normalized,
        )
    )

    referral_date_match = re.search(
        r"Verwijzing\s+Datum:\s*\n?([^\n]+)",
        normalized,
        flags=re.IGNORECASE,
    )
    referral_date = (
        referral_date_match.group(1).strip()
        if referral_date_match
        else ((get_label_value_matches(normalized, r"Datum:") or [""])[-1])
    )

    return {
        "sender": {
            "name": sender_name_raw,
            "agb_code": (get_label_value_matches(normalized, r"AGB-code:") or [""])[0],
            "organization": organization_matches[0] if organization_matches else "",
            "organization_agb_code": org_agb_matches[0] if org_agb_matches else "",
            "street": sender_address["street"],
            "house_number": sender_address["house_number"],
            "postal_code": sender_city["postal_code"],
            "city": sender_city["city"],
        },
        "person": {
            "initials": person_name["initials"],
            "first_name": person_name["first_name"],
            "last_name": person_name["last_name"],
            "date_of_birth": (get_label_value_matches(normalized, r"Geboortedatum:") or [""])[0],
            "gender": infer_gender(patient_name_raw),
            "bsn": clean_bsn((get_label_value_matches(normalized, r"BSN:") or [""])[0]),
        },
        "contact": {
            "street": patient_address["street"],
            "house_number": patient_address["house_number"],
            "postal_code": patient_city["postal_code"],
            "city": patient_city["city"],
            "phone": patient_phone,
            "email": clean_email((get_label_value_matches(normalized, r"E-mailadres:") or [""])[0]),
        },
        "referral": {
            "referral_date": referral_date,
            "zd_number": (get_label_value_matches(normalized, r"ZD-nummer:") or [""])[0],
            "gp_name": sender_name_raw,
            "practice_name": organization_matches[0] if organization_matches else "",
            "agb_code": (get_label_value_matches(normalized, r"AGB-code:") or [""])[0],
            "care_product_name": care_product,
            "care_question": care_question_matches[0] if care_question_matches else "",
            "reason": clinical_information,
            "clinical_information": clinical_information,
            "referral_type": infer_referral_type(care_product, care_question_matches[0] if care_question_matches else "", clinical_information),
        },
        "insurance": {
            "insurer": (get_label_value_matches(normalized, r"Zorgverzekeraar:") or [""])[0],
            "policy_number": (get_label_value_matches(normalized, r"Verzekeringsnummer:") or [""])[0],
            "insured_number": (get_label_value_matches(normalized, r"Verzekeringsnummer:") or [""])[0],
        },
    }


def extract_structured_fields(text: str) -> dict[str, Any]:
    sections = split_into_sections(text)
    sender_fields = parse_section_fields(sections["sender"])
    patient_fields = parse_section_fields(sections["patient"])
    referral_fields = parse_section_fields(sections["referral"])
    clinical_information = extract_clinical_information(sections["clinical"])

    sender_address = split_street_and_house_number(sender_fields.get("adres", ""))
    sender_city = split_postal_code_and_city(sender_fields.get("woonplaats", ""))
    patient_address = split_street_and_house_number(patient_fields.get("adres", ""))
    patient_city = split_postal_code_and_city(patient_fields.get("woonplaats", ""))
    person_name = split_person_name(patient_fields.get("naam", ""))
    patient_section_text = "\n".join(sections["patient"])
    patient_phone = (
        clean_phone_number(patient_fields.get("telefoonnummer"))
        or clean_phone_number(patient_fields.get("telefoon"))
        or clean_phone_number(patient_fields.get("tel"))
        or clean_phone_number(patient_fields.get("mobiel"))
        or extract_phone_from_text(patient_section_text)
        or extract_phone_from_text(text)
    )

    care_question = referral_fields.get("zorgvraag", "")
    clinical_reason = "\n\n".join(part for part in [care_question, clinical_information] if part)

    extracted = {
        "sender": {
            "name": sender_fields.get("naam", ""),
            "agb_code": sender_fields.get("agb code", ""),
            "organization": sender_fields.get("organisatie", ""),
            "organization_agb_code": sender_fields.get("organisatie agb code", ""),
            "street": sender_address["street"],
            "house_number": sender_address["house_number"],
            "postal_code": sender_city["postal_code"],
            "city": sender_city["city"],
        },
        "person": {
            "initials": person_name["initials"],
            "first_name": person_name["first_name"],
            "last_name": person_name["last_name"],
            "date_of_birth": patient_fields.get("geboortedatum", ""),
            "gender": infer_gender(patient_fields.get("naam", "")),
            "bsn": clean_bsn(patient_fields.get("bsn", "")),
        },
        "contact": {
            "street": patient_address["street"],
            "house_number": patient_address["house_number"],
            "postal_code": patient_city["postal_code"],
            "city": patient_city["city"],
            "phone": patient_phone,
            "email": clean_email(patient_fields.get("e mailadres") or patient_fields.get("e-mailadres") or ""),
        },
        "referral": {
            "referral_date": referral_fields.get("verwijzingsdatum", ""),
            "zd_number": referral_fields.get("zd nummer zorgdomein", ""),
            "gp_name": sender_fields.get("naam", ""),
            "practice_name": sender_fields.get("organisatie", ""),
            "agb_code": sender_fields.get("agb code", ""),
            "care_product_name": referral_fields.get("naam zorgproduct", ""),
            "care_question": care_question,
            "reason": clinical_reason,
            "clinical_information": clinical_information,
            "referral_type": infer_referral_type(referral_fields.get("naam zorgproduct", ""), care_question, clinical_information),
        },
        "insurance": {
            "insurer": patient_fields.get("zorgverzekeraar", ""),
            "policy_number": patient_fields.get("verzekeringsnummer", ""),
            "insured_number": patient_fields.get("verzekeringsnummer", ""),
        },
    }
    core_hits = sum(
        1
        for value in [
            extracted["person"]["last_name"],
            extracted["person"]["date_of_birth"],
            extracted["person"]["bsn"],
            extracted["contact"]["postal_code"],
            extracted["insurance"]["insurer"],
            extracted["referral"]["care_product_name"],
        ]
        if str(value or "").strip()
    )
    if core_hits <= 2:
        extracted = merge_missing_values(extracted, extract_flat_referral_fields(text))
    return extracted


def extract_json_object_from_text(text: str) -> dict[str, Any]:
    raw = str(text or "").strip()
    if not raw:
        return {}
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    decoder = json.JSONDecoder()
    for start_index, character in enumerate(raw):
        if character != "{":
            continue
        try:
            payload, _ = decoder.raw_decode(raw[start_index:])
            if isinstance(payload, dict):
                return payload
        except json.JSONDecodeError:
            continue
    return {}


def normalize_ai_section(section_name: str, section_payload: Any) -> dict[str, str]:
    if not isinstance(section_payload, dict):
        return {}
    normalized: dict[str, str] = {}
    for key, value in section_payload.items():
        if value is None:
            continue
        text_value = str(value).strip()
        if not text_value:
            continue
        normalized[str(key)] = text_value

    if section_name == "person" and normalized.get("bsn"):
        normalized["bsn"] = clean_bsn(normalized["bsn"])
    if section_name == "contact":
        if normalized.get("phone"):
            normalized["phone"] = clean_phone_number(normalized["phone"])
        if normalized.get("email"):
            normalized["email"] = clean_email(normalized["email"])
        if normalized.get("postal_code"):
            normalized["postal_code"] = split_postal_code_and_city(f"{normalized['postal_code']} x")["postal_code"]
    return normalized


def should_use_ai(extracted: dict[str, Any], ocr_used: bool) -> bool:
    if not get_ai_api_key():
        return False
    missing_required = get_missing_required_fields({"meta": {}, **extracted})
    if ocr_used:
        return True
    if missing_required:
        return True
    return any(
        is_field_missing(extracted[section].get(field))
        for section, field in [
            ("person", "last_name"),
            ("person", "date_of_birth"),
            ("person", "bsn"),
            ("contact", "phone"),
            ("insurance", "insurer"),
            ("referral", "care_product_name"),
        ]
    )


def build_ai_prompt(text: str, extracted: dict[str, Any]) -> str:
    example = {
        "sender": {
            "name": "",
            "agb_code": "",
            "organization": "",
            "organization_agb_code": "",
            "street": "",
            "house_number": "",
            "postal_code": "",
            "city": "",
        },
        "person": {
            "initials": "",
            "first_name": "",
            "last_name": "",
            "date_of_birth": "",
            "gender": "",
            "bsn": "",
        },
        "contact": {
            "street": "",
            "house_number": "",
            "postal_code": "",
            "city": "",
            "phone": "",
            "email": "",
        },
        "referral": {
            "referral_date": "",
            "zd_number": "",
            "gp_name": "",
            "practice_name": "",
            "agb_code": "",
            "care_product_name": "",
            "care_question": "",
            "reason": "",
            "clinical_information": "",
            "referral_type": "",
        },
        "insurance": {
            "insurer": "",
            "policy_number": "",
            "insured_number": "",
        },
    }
    return (
        "Haal gestructureerde verwijzingsdata uit de onderstaande Nederlandse medische verwijsbrief. "
        "Geef alleen geldige JSON terug, zonder uitleg of markdown. "
        "Gebruik exact deze top-level keys: sender, person, contact, referral, insurance. "
        "Vul onbekende velden met een lege string. "
        "Voor telefoonnummers: geef Nederlandse mobiele nummers terug als 06XXXXXXXX. "
        "Voor BSN: alleen cijfers. Voor postcode: formaat 1234 AB.\n\n"
        f"Bestaande rule-based extractie:\n{json.dumps(extracted, ensure_ascii=False)}\n\n"
        f"Gewenste JSON-vorm:\n{json.dumps(example, ensure_ascii=False)}\n\n"
        f"Documenttekst:\n{text}"
    )


def call_ai_extractor(text: str, extracted: dict[str, Any]) -> dict[str, Any]:
    api_key = get_ai_api_key()
    payload = {
        "message": build_ai_prompt(text, extracted),
        "model": AI_MODEL,
    }
    api_url = AI_AUTH_API_URL if api_key else AI_PUBLIC_API_URL
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "MiGuide-Referral-Tool/1.0",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = ""
        try:
            detail = error.read().decode("utf-8")
        except Exception:
            detail = ""
        raise RuntimeError(f"AI extractie mislukt ({error.code}). {detail}".strip()) from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"AI extractie niet bereikbaar: {error.reason}") from error

    content = ""
    if isinstance(body, dict):
        if isinstance(body.get("response"), str):
            content = body["response"]
        elif isinstance(body.get("message"), str):
            content = body["message"]
        elif isinstance(body.get("choices"), list) and body["choices"]:
            first_choice = body["choices"][0]
            content = (
                first_choice.get("message", {}).get("content", "")
                if isinstance(first_choice, dict)
                else ""
            )
    extracted_json = extract_json_object_from_text(content)
    return extracted_json if isinstance(extracted_json, dict) else {}


def merge_ai_into_extracted(extracted: dict[str, Any], ai_payload: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    merged = copy.deepcopy(extracted)
    ai_used = False

    for section_name in ("sender", "person", "contact", "referral", "insurance"):
        ai_section = normalize_ai_section(section_name, ai_payload.get(section_name))
        if not ai_section:
            continue
        target_section = merged.setdefault(section_name, {})
        for key, value in ai_section.items():
            if not value:
                continue
            current_value = str(target_section.get(key, "")).strip()
            if current_value:
                continue
            target_section[key] = value
            ai_used = True

    return merged, ai_used


def get_filled_field_count(extracted: dict[str, Any]) -> int:
    count = 0
    for section in extracted.values():
        if not isinstance(section, dict):
            continue
        for value in section.values():
            if str(value or "").strip():
                count += 1
    return count


def is_valid_postal_code(value: str) -> bool:
    return bool(re.fullmatch(r"\d{4}\s?[A-Z]{2}", str(value or "").strip(), flags=re.IGNORECASE))


def is_valid_email(value: str) -> bool:
    return bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", str(value or "").strip()))


def is_likely_phone_number(value: str) -> bool:
    return bool(re.fullmatch(r"06\d{8}", clean_phone_number(value)))


def determine_confidence(extracted: dict[str, Any], ocr_used: bool) -> str:
    filled_count = get_filled_field_count(extracted)
    core_values = [
        extracted["person"].get("last_name", ""),
        extracted["person"].get("date_of_birth", ""),
        extracted["person"].get("bsn", ""),
        extracted["contact"].get("postal_code", ""),
        extracted["insurance"].get("insurer", ""),
        extracted["referral"].get("referral_date", ""),
        extracted["referral"].get("gp_name", ""),
    ]
    core_filled = sum(1 for value in core_values if str(value or "").strip())
    if not ocr_used and core_filled >= 6 and filled_count >= 18:
        return "high"
    if core_filled >= 4 and filled_count >= 12:
        return "medium"
    return "low"


def get_missing_required_fields(output_fields: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    for path in REQUIRED_FIELD_PATHS:
        cursor: Any = output_fields
        for key in path.split("."):
            cursor = cursor.get(key, "") if isinstance(cursor, dict) else ""
        if not str(cursor or "").strip():
            missing.append(path)
    return missing


def build_validation_messages(filename: str, extracted: dict[str, Any], ocr_used: bool, ai_used: bool) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [{"className": "validation-ok", "text": f"Bestand geladen: {filename}"}]
    filled_count = get_filled_field_count(extracted)
    issues: list[str] = []

    if not extracted["person"].get("first_name") and not extracted["person"].get("last_name"):
        issues.append("Patientnaam niet betrouwbaar herkend.")
    if not extracted["person"].get("bsn"):
        issues.append("BSN niet gevonden.")
    elif not is_valid_bsn(extracted["person"]["bsn"]):
        issues.append("BSN controleren: moet 9 cijfers zijn.")
    if not extracted["contact"].get("postal_code"):
        issues.append("Postcode patient ontbreekt.")
    elif not is_valid_postal_code(extracted["contact"]["postal_code"]):
        issues.append(f"Postcode patient controleren ({extracted['contact']['postal_code']}).")
    if not extracted["insurance"].get("insurer"):
        issues.append("Zorgverzekeraar niet gevonden.")
    if not extracted["contact"].get("phone"):
        issues.append("Telefoonnummer ontbreekt.")
    elif not is_likely_phone_number(extracted["contact"]["phone"]):
        issues.append(f"Telefoonnummer controleren ({extracted['contact']['phone']}).")
    if extracted["contact"].get("email") and not is_valid_email(extracted["contact"]["email"]):
        issues.append(f"E-mailadres controleren ({extracted['contact']['email']}).")
    if not extracted["referral"].get("care_product_name"):
        issues.append("Naam zorgproduct ontbreekt.")
    if not extracted["referral"].get("clinical_information"):
        issues.append("Klinische informatie niet gevonden.")
    if ocr_used:
        issues.append("OCR gebruikt, extra controle op leesfouten nodig.")
    if ai_used:
        issues.append("AI gebruikt als aanvulling; controleer aangevulde velden.")

    if not issues:
        messages.append({"className": "validation-ok", "text": f"Alles lijkt goed. {filled_count} velden automatisch gevuld."})
        return messages

    messages.append(
        {
            "className": "validation-warn",
            "text": f"{filled_count} velden automatisch gevuld. Alles lijkt goed behalve {len(issues)} aandachtspunt(en) hieronder.",
        }
    )
    messages.extend({"className": "validation-warn", "text": issue} for issue in issues)
    return messages


def merge_into_output(output: dict[str, Any], extracted: dict[str, Any]) -> None:
    for section_name, section_values in extracted.items():
        output["fields"].setdefault(section_name, {})
        output["fields"][section_name].update(section_values)


def build_output(
    schema: dict[str, Any],
    filename: str,
    source_type: str,
    extraction_method: str,
    raw_text: str,
    page_count: int,
    ocr_used: bool,
) -> dict[str, Any]:
    extracted = extract_structured_fields(raw_text)
    ai_used = False
    ai_error = ""
    if should_use_ai(extracted, ocr_used):
        try:
            ai_payload = call_ai_extractor(raw_text, extracted)
            extracted, ai_used = merge_ai_into_extracted(extracted, ai_payload)
        except RuntimeError as error:
            ai_error = str(error)
    output = get_empty_output(schema)
    merge_into_output(output, extracted)
    confidence = determine_confidence(extracted, ocr_used)
    missing = get_missing_required_fields(output["fields"])
    output["fields"]["meta"].update(
        {
            "source_file": filename,
            "source_type": source_type,
            "ocr_used": ocr_used,
            "extraction_method": extraction_method,
            "page_count": page_count,
            "confidence": confidence,
            "ai_used": ai_used,
            "ai_provider": "apifreellm" if ai_used else "",
            "review_required": True,
            "review_completed_at": "",
            "review_status": "open",
            "next_action": (
                "Klaar voor overdracht / vervolgverwerking"
                if not missing
                else "Laatste review en aanvullen ontbrekende velden" if len(missing) <= 3
                else "Handmatige controle en aanvulling nodig"
            ),
        }
    )
    validation = build_validation_messages(filename, extracted, ocr_used, ai_used)
    if ai_error:
        validation.append({"className": "validation-warn", "text": f"AI overgeslagen: {ai_error}"})
    return {
        "raw_text": raw_text,
        "output": output,
        "validation": validation,
        "source_badge": (
            ("PDF tekst" if extraction_method == "pdf_text" else "OCR") + (" + AI" if ai_used else "")
        ),
        "confidence_badge": {
            "high": "Hoge match",
            "medium": "Middelmatige match",
            "low": "Lage match",
        }.get(confidence, "Review nodig"),
    }


def require_pdf_support() -> None:
    if fitz is None:
        raise RuntimeError("PyMuPDF ontbreekt. Installeer de backend dependencies eerst.")


def require_ocr_support() -> None:
    if pytesseract is None or Image is None:
        raise RuntimeError("OCR dependencies ontbreken. Installeer pytesseract en Pillow.")
    configure_tesseract()


def extract_pdf_text_direct(file_bytes: bytes) -> tuple[str, int]:
    require_pdf_support()
    document = fitz.open(stream=file_bytes, filetype="pdf")
    pages = [document.load_page(index).get_text("text") for index in range(document.page_count)]
    return collapse_text("\n\n".join(pages)), document.page_count


def seems_useful_text(text: str) -> bool:
    cleaned = collapse_text(text)
    if len(cleaned) < 80:
        return False
    return len([word for word in cleaned.split() if word]) >= 15


def extract_pdf_text_with_ocr(file_bytes: bytes) -> tuple[str, int]:
    require_pdf_support()
    require_ocr_support()
    document = fitz.open(stream=file_bytes, filetype="pdf")
    pages: list[str] = []
    for index in range(document.page_count):
        page = document.load_page(index)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        image = Image.open(io.BytesIO(pix.tobytes("png")))
        pages.append(pytesseract.image_to_string(image, lang="nld+eng"))
    return collapse_text("\n\n".join(pages)), document.page_count


def extract_image_text_with_ocr(file_bytes: bytes) -> tuple[str, int]:
    require_ocr_support()
    image = Image.open(io.BytesIO(file_bytes))
    return collapse_text(pytesseract.image_to_string(image, lang="nld+eng")), 1


def process_upload(file_bytes: bytes, filename: str, content_type: str | None) -> dict[str, Any]:
    source_type = get_source_type(filename, content_type)
    schema = load_schema()

    if source_type == "pdf":
        direct_text, page_count = extract_pdf_text_direct(file_bytes)
        if seems_useful_text(direct_text):
            return build_output(schema, filename, source_type, "pdf_text", direct_text, page_count, False)
        ocr_text, page_count = extract_pdf_text_with_ocr(file_bytes)
        return build_output(schema, filename, source_type, "pdf_ocr", ocr_text, page_count, True)

    if source_type == "image":
        ocr_text, page_count = extract_image_text_with_ocr(file_bytes)
        return build_output(schema, filename, source_type, "image_ocr", ocr_text, page_count, True)

    raise RuntimeError("Bestandstype wordt nog niet ondersteund.")
