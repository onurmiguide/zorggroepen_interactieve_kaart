# Voorbeeld output

## Doel
Voorbeeld van hoe de tool na OCR en AI een verwijzing zou kunnen structureren.

```json
{
  "person": {
    "initials": "J.A.",
    "first_name": "Jan",
    "last_name": "Jansen",
    "date_of_birth": "1980-04-15",
    "gender": "man",
    "bsn": "123456782"
  },
  "contact": {
    "street": "Voorbeeldstraat",
    "house_number": "12A",
    "postal_code": "3012AB",
    "city": "Rotterdam",
    "phone": "0612345678",
    "email": ""
  },
  "referral": {
    "referral_date": "2026-03-10",
    "gp_name": "Dr. P. Voorbeeld",
    "practice_name": "Huisartsenpraktijk Centrum",
    "agb_code": "",
    "reason": "Aanmelding GLI traject",
    "referral_type": "huisartsverwijzing"
  },
  "insurance": {
    "insurer": "VGZ",
    "policy_number": "",
    "insured_number": ""
  },
  "meta": {
    "source_file": "voorbeeld-verwijzing.pdf",
    "source_type": "pdf",
    "ocr_used": false,
    "confidence": 0.86,
    "review_required": true
  }
}
```

## Let op
- Dit is voorbeelddata
- In echte verwerking moeten onzekere velden gemarkeerd worden
- BSN moet extra gevalideerd worden
