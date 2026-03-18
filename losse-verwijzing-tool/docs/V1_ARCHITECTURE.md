# V1 architectuur

## Doel van v1
Een verwijzing uit PDF of afbeelding omzetten naar gestructureerde data die een medewerker controleert en goedkeurt.

## Aanbevolen v1 flow
1. bestand uploaden
2. type bepalen:
- tekst-PDF
- scan-PDF
- losse afbeelding
3. tekst ophalen:
- tekst-PDF: direct text extraction
- scan of afbeelding: OCR
4. AI extractie:
- ruwe tekst naar JSON-velden
5. validatie:
- BSN
- postcode
- datum
- verplichte velden
6. reviewscherm:
- medewerker controleert en corrigeert
7. export of opslag

## Technische bouwblokken

### Frontend
- uploadscherm
- tekst-preview
- veldcontrole / reviewformulier
- statusmeldingen

### Backend of verwerkingslaag
- file intake
- PDF parsing
- OCR
- AI extraction
- validatieregels
- logging

## AI rol in v1
AI doet alleen:
- veldextractie
- normalisatie
- confidence / onzekerheid markeren

AI doet niet:
- definitieve goedkeuring
- automatische eindbeslissingen zonder review

## Minimale output
- persoonsgegevens
- contactgegevens
- huisarts / verwijzer
- verzekeringsgegevens
- reden verwijzing
- meta informatie over bron en zekerheid

## Waarom deze architectuur
- werkt op scans en tekst-PDF’s
- beperkt handwerk direct
- blijft uitlegbaar
- veiligste route voor privacygevoelige informatie
