# Zorggroepen Interactieve Kaart

Interactieve webapp (Leaflet.js) voor het tonen en filteren van Nederlandse zorggroep-domeinen op basis van officiele bestuurlijke gebieden en lokale zorggroepdata.

## Functionaliteiten

- Choropleth-kaart met zorggroepgebieden (Leaflet + OpenStreetMap tiles)
- Domeinfilter (`Alle zorggroepen` of 1 specifieke zorggroep)
- Zorgverzekeraar-filter
- Declaratiestroom-filter (afhankelijk van geselecteerde zorgverzekeraar)
- Zoekveld voor:
  - Gemeente
  - Plaats/stad/dorp
  - Postcode4 (`1234`) en Postcode6 (`1234AB` of `1234 AB`)
- Live suggesties tijdens typen
- Klik op kaartdomein zet direct het domeinfilter
- Linker plaatsenlijst (vast formaat, scrollbaar) met plaatsen uit actuele filterset
- Tooltip + popup per zorggroep
- Responsieve layout voor desktop/tablet/mobiel

## Tech Stack

- HTML, CSS, JavaScript (vanilla)
- [Leaflet 1.9.4](https://leafletjs.com/) via CDN
- OpenStreetMap tiles (geen API key)

## Datasources

### Lokale projectdata

- `zg-data/zorggroepen.json`
  - Zorggroepen, regio, website, en lijst met plaatsen/steden/dorpen
- `zg-data/Miguide_website_logo_32-px.png.webp`

### Externe PDOK APIs

- Bestuurlijke gebieden OGC API (gemeentegrenzen):
  - `https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1`
- CBS Postcode6 WFS (postcode-lookup):
  - `https://service.pdok.nl/cbs/postcode6/2024/wfs/v1_0`

## Projectstructuur

```text
.
|- index.html
|- css/
|  |- style.css
|- script/
|  |- script.js
|- zg-data/
|  |- zorggroepen.json
|  |- zorggroepen.geojson
|  |- Miguide_website_logo_32-px.png.webp
|  |- _postcode_wfs_capabilities.xml
|  |- _postcode_wms_capabilities.xml
|  |- _postcode_wfs_describe.xml
```

## Lokaal draaien

1. Open de map in VS Code.
2. Installeer/gebruik de extension `Live Server`.
3. Start `index.html` met Live Server.

Belangrijk:
- Gebruik een lokale server (niet `file://`) i.v.m. `fetch` van JSON/API data.
- Internetverbinding is nodig voor PDOK en OpenStreetMap.

## Zoek- en filterlogica

- Zoek op gemeente/plaats:
  - Suggesties verschijnen live.
  - Enter of klikken past filters toe.
- Zoek op postcode:
  - `1234` (PC4) of `1234AB`/`1234 AB` (PC6)
  - App zoekt via PDOK WFS en koppelt naar gemeente.
  - Als gemeente niet in zorggroepdomeinen valt, verschijnt melding.
- Domeinfilter + zoekfilter werken gecombineerd.

## Aanpassen van zorggroepdata

Bewerk `zg-data/zorggroepen.json`:

- `zorggroep`: naam van de zorggroep
- `regio`: regio-label
- `website`: website URL
- `cities`: lijst met plaatsen/steden/dorpen

Na opslaan en refresh in browser worden wijzigingen direct gebruikt.

### Contractdata (zorgverzekeraar + declaratiestroom)

De app ondersteunt contractdata per zorggroep via 2 opties:

1. Inline per zorggroep-object:

```json
{
  "zorggroep": "Rijnmond dokters",
  "cities": ["Rotterdam"],
  "contracten": [
    { "zorgverzekeraar": "Menzis", "declaratiestroom": "VIPLive", "contract": "Ja" },
    { "zorgverzekeraar": "CZ", "declaratiestroom": "VIPLive", "contract": "Nee" }
  ]
}
```

2. Centrale matrix op root-niveau:

```json
{
  "contracten": [
    { "zorggroep": "Rijnmond dokters", "zorgverzekeraar": "Menzis", "declaratiestroom": "VIPLive", "contract": "Ja" }
  ]
}
```

`contract` accepteert o.a. `Ja/Nee`, `true/false`, `gecontracteerd/ongecontracteerd`.

## Bekende aandachtspunten

- Plaatsnamen met varianten/afkortingen worden deels via alias-mapping opgelost in `script/script.js`.
- Resultaten van postcodezoeking hangen af van beschikbaarheid/kwaliteit van PDOK dataset.

## Contact

Bij issues of updates:
- Email: `info@miguide.nl`
- Of intern bericht aan Onur
