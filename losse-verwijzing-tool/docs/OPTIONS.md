# Opties voor deze tool

## Doel
Een inkomende verwijzing uit PDF of foto omzetten naar gestructureerde data die een medewerker kan controleren.

## Relevante technische opties

### Optie 1: OCR + regels
Proces:
- OCR leest de tekst uit PDF of foto
- vaste regels zoeken bekende velden
- output gaat naar een controlescherm

Voordelen:
- snel te bouwen
- goedkoop
- goed uitlegbaar

Nadelen:
- gevoelig voor afwijkende layouts
- meer handmatig onderhoud bij nieuwe formats

### Optie 2: OCR + AI extractie
Proces:
- OCR leest ruwe tekst
- AI model haalt velden uit tekst en structureert die
- medewerker controleert de uitkomst

Voordelen:
- beter bij wisselende layouts
- minder harde regex- en template-afhankelijkheid

Nadelen:
- extra validatie nodig
- hogere eisen aan privacy en dataverwerking

### Optie 3: Native PDF parsing + OCR fallback + AI
Proces:
- als PDF tekst bevat: direct uitlezen
- als scan/foto: OCR gebruiken
- AI alleen voor interpretatie en normalisatie

Voordelen:
- technisch sterkste route
- beste kans op stabiele kwaliteit

Nadelen:
- iets meer complexiteit
- meer bouwtijd aan begin

## Aanbevolen richting
Voor deze tool is optie 3 het meest logisch:
- eerst directe tekstextractie als dat kan
- anders OCR
- daarna AI voor veldextractie
- altijd eindigen met menselijke controle
