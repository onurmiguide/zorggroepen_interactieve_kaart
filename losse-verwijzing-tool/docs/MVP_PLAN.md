# MVP plan

## Doel
Zo snel mogelijk een eerste bruikbare versie maken waarmee een medewerker een verwijzing kan uploaden, laten uitlezen en controleren.

## MVP scope
- 1 document upload
- PDF of afbeelding
- tekstextractie
- AI naar JSON
- reviewscherm
- handmatige correctie
- export naar JSON of kopieerbare output

## Buiten scope voor v1
- automatische verwerking zonder review
- koppelingen naar EPD/CRM
- bulkverwerking
- gebruikersrollen en uitgebreide auditlog

## Werkvolgorde

### Stap 1
Verzamel 10 tot 20 representatieve voorbeeldverwijzingen.

### Stap 2
Test per document:
- is het een tekst-PDF?
- hoe goed werkt OCR?
- welke velden komen vaak terug?

### Stap 3
Maak een extractor-pipeline:
- input
- text extraction
- AI field extraction
- validatie

### Stap 4
Bouw een reviewscherm waar de medewerker:
- brontekst ziet
- voorgestelde velden ziet
- fouten corrigeert
- resultaat bevestigt

### Stap 5
Meet kwaliteit:
- percentage correct herkende velden
- welke velden vaak misgaan
- welke documenttypes lastig zijn

## MVP succescriteria
- naam meestal correct
- adres meestal correct
- BSN alleen tonen als validatie slaagt of als review nodig is
- zorgverzekeraar meestal correct
- medewerker kan binnen enkele minuten corrigeren en afronden
