# Aanbevolen tech stack voor v1

## Frontend
- eenvoudige webinterface
- upload
- reviewformulier
- JSON-resultaat

Mogelijke keuze:
- plain HTML/CSS/JS voor snelle start

## Parsing en OCR
- tekst-PDF: PDF text extraction
- scans en foto's: Tesseract OCR als eerste testoptie

## AI extractie
- LLM die ruwe tekst omzet naar vast JSON-schema

## Validatie
- BSN elfproef
- postcodeformat
- datumformat
- verplichte velden

## Waarom deze stack
- snel te testen
- weinig lock-in
- goed genoeg voor een eerste interne versie
- later uitbreidbaar naar een backend of API-architectuur
