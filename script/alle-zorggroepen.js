/* Zorggroep kaart - logica (geen weergave).
 *
 * Laadt de zorggroepen (admin-API met JSON-reserve), de directory-informatie en de PDOK-gemeenten
 * en bouwt daaruit de gecontracteerde en niet-gecontracteerde gebieden en de lijst met zorggroepen.
 * De weergave staat in script/zorggroepkaart.js; dit bestand wordt daarvóór geladen.
 */

const ZORGGROEPEN_URL = "zg-data/zorggroepen.json";
const ZORGGROEP_INFO_URL = "zg-data/alle-zorggroepen-info.json";

// Actuele zorggroepen uit de admin-API (zelfde vorm als zorggroepen.json), zodat deze
// kaart dezelfde data toont als de Zorgtool. Valt terug op het JSON-bestand als de API
// niet (op tijd) reageert.
const PUBLIC_API_BASE = (function resolvePublicApiBase() {
  const loc = window.location;
  const isLocalHost = loc.hostname === "127.0.0.1" || loc.hostname === "localhost";
  if (loc.protocol === "file:") return "http://127.0.0.1:8000";
  if (isLocalHost && loc.port !== "8000") return "http://127.0.0.1:8000";
  return "";
})();

// Plaatsnamen uit de admin (genormaliseerde plaatsnaam -> gemeente); gaan voor de vaste lijst.
const runtimePlaceAliases = new Map();

function applyPlaceAliases(aliases) {
  runtimePlaceAliases.clear();
  for (const row of Array.isArray(aliases) ? aliases : []) {
    const plaats = normalizeText(row && row.plaatsnaam);
    const gemeente = String((row && row.gemeente) || "").trim();
    // Lege gemeente = plaats bewust niet inkleuren.
    if (plaats) {
      runtimePlaceAliases.set(plaats, gemeente);
    }
  }
}

// Contractstatus: de admin ('contract': true/false) is leidend; zonder die info geldt
// de vaste lijst met geen-contract-zorggroepen.
function isNoContractItem(item, zorggroepName) {
  if (item && typeof item.contract === "boolean") {
    return !item.contract;
  }
  return NO_CONTRACT_NAMES.has(normalizeText(zorggroepName));
}

async function fetchZorggroepenData() {
  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 4500) : null;
    try {
      const response = await fetch(`${PUBLIC_API_BASE}/api/public/zorggroepen`, {
        headers: { Accept: "application/json" },
        signal: controller ? controller.signal : undefined
      });
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.zorggroepen) && data.zorggroepen.length) {
          return data;
        }
      }
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  } catch (error) {
    // API niet bereikbaar -> stil terugvallen op het JSON-bestand.
  }
  const fallback = await fetch(ZORGGROEPEN_URL);
  if (!fallback.ok) {
    throw new Error(`zorggroepen.json laden mislukt (${fallback.status})`);
  }
  return fallback.json();
}
const PDOK_GEMEENTE_ITEMS_URL = "https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/collections/gemeentegebied/items?f=json&limit=100";
const NL_BOUNDS = [[50.75, 3.35], [53.56, 7.23]];
const NO_CONTRACT_NAMES = new Set([
  "zuid holland zuid overig",
  "geen zorggroep contract",
  "hht hzgb",
  "hoog"
]);

const CITY_TO_GEMEENTE = {
  "capelle a d ijssel": "Capelle aan den IJssel",
  "berken en rodenrijs": "Lansingerland",
  "berkel en rodenrijs": "Lansingerland",
  "rhoon": "Albrandswaard",
  "rotterdam pernis": "Rotterdam",
  "hardinxveld giesendam": "Hardinxveld-Giessendam",
  "hendrik ido ambacht": "Hendrik-Ido-Ambacht",
  "bovenkarspel": "Stede Broec",
  "andijk": "Medemblik",
  "wognum": "Medemblik",
  "zwaag": "Hoorn",
  "wevershoof": "Medemblik",
  "de goorn": "Koggenland",
  "drachten": "Smallingerland",
  "sneek": "S\u00fbdwest-Frysl\u00e2n",
  "dokkum": "Noardeast-Frysl\u00e2n",
  "franeker": "Waadhoeke",
  "joure": "De Fryske Marren",
  "burgum": "Tytsjerksteradiel",
  "gorredijk": "Opsterland",
  "kollum": "Noardeast-Frysl\u00e2n",
  "meersen": "Meerssen",
  "bund": "Meerssen",
  "eijsden": "Eijsden-Margraten",
  "loosdrecht": "Wijdemeren",
  "nederhorst den berg": "Wijdemeren",
  "kortenhoef": "Wijdemeren",
  "muiden": "Gooise Meren",
  "muiderberg": "Gooise Meren",
  "naarden": "Gooise Meren",
  "bussum": "Gooise Meren",
  "weesp": "Gooise Meren",
  "huizen f": "Huizen",
  "bunnink": "Bunnik",
  "vianen": "Vijfheerenlanden",
  "doorn": "Utrechtse Heuvelrug",
  "driebergen rijsenberg": "Utrechtse Heuvelrug",
  "driebergen rijsenburg": "Utrechtse Heuvelrug",
  "schoonhoven": "Krimpenerwaard",
  "soesterberg": "Soest",
  "amsterdam alle ziekenhuizen en huisartsen uit amsterdam vallen hieronder": "Amsterdam",
  "duivendrecht": "Ouder-Amstel",
  "ijmuiden gemeente velsen": "Velsen",
  "ijmuiden": "Velsen",
  "overveen gemeente bloemendaal": "Bloemendaal",
  "overveen": "Bloemendaal",
  "santpoort noord gemeente velsen": "Velsen",
  "santpoort noord": "Velsen",
  "badhoevedorp": "",
  "sittard": "Sittard-Geleen",
  "geleen": "Sittard-Geleen",
  "echt": "Echt-Susteren",
  "schinnen": "Beekdaelen",
  "schimmertborn": "Sittard-Geleen",
  "hoensbroek": "Heerlen",
  "nuth": "Beekdaelen",
  "hoevelland": "Heerlen",
  "alphen a d rijn": "Alphen aan den Rijn",
  "kaag en braasem": "Kaag en Braassem",
  "noordwijkerhout": "Noordwijk",
  "hazerswoude": "Alphen aan den Rijn",
  "leidschendam": "Leidschendam-Voorburg",
  "stompwijk": "Leidschendam-Voorburg",
  "voorburg": "Leidschendam-Voorburg",
  "uden": "Maashorst",
  "veghel": "Meierijstad",
  "abcoude": "De Ronde Venen",
  "den haag": "'s-Gravenhage",
  "achterveld": "Leusden",
  "de glind": "Barneveld",
  "eembrugge gem baarn": "Baarn",
  "eemdijk": "Bunschoten",
  "eemnes en soest soest tussen dorp en het oostelijk deel de eem ex soesterberg": "Soest",
  "garderen": "Barneveld",
  "hoevelaken": "Nijkerk",
  "kootwijk en kootwijkerbroek": "Barneveld",
  "leersum": "Utrechtse Heuvelrug",
  "lunteren": "Ede",
  "bennekom": "Ede",
  "maarsbergen": "Utrechtse Heuvelrug",
  "elspeet": "Nunspeet",
  "overberg": "Utrechtse Heuvelrug",
  "soest en soestdijk": "Soest",
  "stroe": "Barneveld",
  "stoutenberg": "Leusden",
  "terschuur": "Barneveld",
  "uddel": "",
  "voorthuizen": "Barneveld",
  "zwartebroek": "Nijkerk",
  "amersfoort amersfoort hoogland hooglanderveen": "Amersfoort",
  "bunschoten bunschoten spakenburg eemdijk": "Bunschoten",
  "nijkerk en nijkerkerveen": "Nijkerk",
  "alblasserdam": "Alblasserdam",
  "goeree overflakkee": "Goeree-Overflakkee",
  "hoekse waard": "Hoeksche Waard",
  "friesland": ""
};

const OVERLAP_GEMEENTE_OWNER_OVERRIDES = new Map([
  [normalizeText("Baarn"), normalizeText("RHOGO (Regionale Huisartsen Organisatie Gooi en Omstreken BV)")],
  [normalizeText("Soest"), normalizeText("Eemland")],
  [normalizeText("Utrechtse Heuvelrug"), normalizeText("UNICUM")],
  [normalizeText("Beekdaelen"), normalizeText("HOZL")]
]);

const ALLOWED_OVERLAP_GEMEENTEN = new Set([
  normalizeText("Leidschendam-Voorburg"),
  normalizeText("Ede")
]);

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function geometryToMultiPolygonParts(geometry) {
  if (!geometry || !geometry.type || !geometry.coordinates) {
    return [];
  }
  if (geometry.type === "Polygon") {
    return [geometry.coordinates];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates;
  }
  return [];
}

function splitZuidHollandZuidItem(item) {
  return [
    {
      zorggroep: "ZHZ CZ",
      regio: "Zuid-Holland-Zuid",
      website: item.website || "",
      cities: ["Hoekse Waard"]
    },
    {
      zorggroep: "ZHZ VGZ",
      regio: "Zuid-Holland-Zuid",
      website: item.website || "",
      cities: [
        "Alblasserdam",
        "Altena",
        "Dordrecht",
        "Gorinchem",
        "Hardinxveld-Giessendam",
        "Hendrik Ido Ambacht",
        "Molenlanden",
        "Papendrecht",
        "Sliedrecht",
        "Zwijndrecht"
      ]
    },
    {
      zorggroep: "Geen zorggroep contract",
      regio: "Zuid-Holland-Zuid",
      website: item.website || "",
      cities: ["Goeree-Overflakkee"]
    }
  ];
}

function cityToGemeenteName(city, gemeenteByNormName) {
  const cleanCity = normalizeText(city);
  if (!cleanCity) {
    return null;
  }

  // Plaatsnamen uit de admin zijn leidend; de vaste lijst is alleen reserve als de API niet bereikbaar is.
  if (runtimePlaceAliases.size > 0) {
    if (runtimePlaceAliases.has(cleanCity)) {
      const gemeente = runtimePlaceAliases.get(cleanCity);
      if (!gemeente) {
        return null;
      }
      const match = gemeenteByNormName.get(normalizeText(gemeente));
      return match ? match.properties.naam : gemeente;
    }
  } else {
    const alias = CITY_TO_GEMEENTE[cleanCity];
    if (typeof alias === "string") {
      return alias || null;
    }
  }

  if (gemeenteByNormName.has(cleanCity)) {
    return gemeenteByNormName.get(cleanCity).properties.naam;
  }

  const withoutBrackets = normalizeText(String(city).replace(/\(.*?\)/g, " "));
  if (withoutBrackets && gemeenteByNormName.has(withoutBrackets)) {
    return gemeenteByNormName.get(withoutBrackets).properties.naam;
  }

  return null;
}

async function fetchAllGemeenteFeatures() {
  const all = [];
  let nextUrl = PDOK_GEMEENTE_ITEMS_URL;

  while (nextUrl) {
    const response = await fetch(nextUrl);
    if (!response.ok) {
      throw new Error(`PDOK gemeentegebied laden mislukt (${response.status})`);
    }
    const page = await response.json();
    all.push(...(Array.isArray(page.features) ? page.features : []));
    const nextLink = Array.isArray(page.links) ? page.links.find((link) => link.rel === "next") : null;
    nextUrl = nextLink?.href || null;
  }

  return all;
}

function buildContractFeatures(zorggroepen, gemeenteFeatures) {
  const gemeenteByNormName = new Map();
  for (const feature of gemeenteFeatures) {
    const naam = feature?.properties?.naam;
    const norm = normalizeText(naam);
    if (norm) {
      gemeenteByNormName.set(norm, feature);
    }
  }

  const expandedZorggroepen = [];
  for (const item of zorggroepen) {
    if (item?.zorggroep === "Zuid-Holland-Zuid") {
      expandedZorggroepen.push(...splitZuidHollandZuidItem(item));
    } else {
      expandedZorggroepen.push(item);
    }
  }

  const featureDrafts = [];
  for (const item of expandedZorggroepen) {
    const zorggroepName = String(item?.zorggroep || "").trim();
    if (!zorggroepName || isNoContractItem(item, zorggroepName)) {
      continue;
    }

    const mappedCities = [];
    for (const city of item.cities || []) {
      const gemeenteNaam = cityToGemeenteName(city, gemeenteByNormName);
      if (!gemeenteNaam) {
        continue;
      }
      mappedCities.push({ city, gemeenteNaam });
    }

    featureDrafts.push({
      zorggroep: zorggroepName,
      regio: item.regio || zorggroepName,
      website: item.website || "",
      mappedCities
    });
  }

  const draftsByGemeente = new Map();
  for (const draft of featureDrafts) {
    const uniqueGemeenten = [...new Set(draft.mappedCities.map((entry) => entry.gemeenteNaam))];
    for (const gemeenteNaam of uniqueGemeenten) {
      const key = normalizeText(gemeenteNaam);
      if (!key) {
        continue;
      }
      const owners = draftsByGemeente.get(key) || [];
      owners.push(draft);
      draftsByGemeente.set(key, owners);
    }
  }

  for (const [gemeenteKey, owners] of draftsByGemeente.entries()) {
    if (owners.length <= 1 || ALLOWED_OVERLAP_GEMEENTEN.has(gemeenteKey)) {
      continue;
    }

    const preferredOwnerKey = OVERLAP_GEMEENTE_OWNER_OVERRIDES.get(gemeenteKey);
    const preferredOwner = preferredOwnerKey
      ? owners.find((draft) => normalizeText(draft.zorggroep) === preferredOwnerKey)
      : owners[0];

    for (const draft of owners) {
      if (draft === preferredOwner) {
        continue;
      }
      draft.mappedCities = draft.mappedCities.filter((entry) => normalizeText(entry.gemeenteNaam) !== gemeenteKey);
    }
  }

  const features = [];
  for (const draft of featureDrafts) {
    const matchedGemeenten = [...new Set(draft.mappedCities.map((entry) => entry.gemeenteNaam))];
    const remainingCities = draft.mappedCities.map((entry) => entry.city);
    const multiPolygonCoords = [];

    for (const gemeenteNaam of matchedGemeenten) {
      const gemeenteFeature = gemeenteByNormName.get(normalizeText(gemeenteNaam));
      if (!gemeenteFeature) {
        continue;
      }
      multiPolygonCoords.push(...geometryToMultiPolygonParts(gemeenteFeature.geometry));
    }

    if (multiPolygonCoords.length === 0) {
      continue;
    }

    features.push({
      type: "Feature",
      properties: {
        zorggroep: draft.zorggroep,
        regio: draft.regio,
        website: draft.website,
        cities: remainingCities,
        gemeenten: matchedGemeenten
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: multiPolygonCoords
      }
    });
  }

  return features;
}

function buildInfoLookup(entries) {
  const infoByGroup = new Map();
  const infoByMunicipality = new Map();
  for (const entry of entries || []) {
    const mapsTo = Array.isArray(entry?.mapsTo) ? entry.mapsTo : [];
    for (const target of mapsTo) {
      const key = normalizeText(target);
      if (!key) {
        continue;
      }
      const list = infoByGroup.get(key) || [];
      list.push({
        name: String(entry?.name || "").trim(),
        website: String(entry?.website || "").trim(),
        note: String(entry?.note || "").trim()
      });
      infoByGroup.set(key, list);
    }

    const municipalities = Array.isArray(entry?.municipalities) ? entry.municipalities : [];
    for (const municipality of municipalities) {
      const key = normalizeText(municipality);
      if (!key) {
        continue;
      }
      const list = infoByMunicipality.get(key) || [];
      list.push({
        name: String(entry?.name || "").trim(),
        website: String(entry?.website || "").trim(),
        note: String(entry?.note || "").trim()
      });
      infoByMunicipality.set(key, list);
    }
  }
  return { infoByGroup, infoByMunicipality };
}

function firstNonEmptyString(values) {
  for (const value of values || []) {
    const cleanValue = String(value || "").trim();
    if (cleanValue) {
      return cleanValue;
    }
  }
  return "";
}

function sortDirectoryEntries(entries) {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name, "nl", { sensitivity: "base" }));
}

function buildDirectoryEntries(contractFeatures, noContractFeatures, infoByGroup) {
  const contracted = sortDirectoryEntries((contractFeatures || []).map((feature) => {
    const zorggroepNaam = String(feature?.properties?.zorggroep || "").trim();
    const infoEntries = infoByGroup.get(normalizeText(zorggroepNaam)) || [];
    const website = firstNonEmptyString([
      feature?.properties?.website,
      ...infoEntries.map((entry) => entry.website)
    ]);

    return {
      name: zorggroepNaam,
      status: "contracted",
      website
    };
  }));

  const noContract = sortDirectoryEntries((noContractFeatures || []).map((feature) => ({
    name: String(feature?.properties?.zorggroep || "").trim(),
    status: "no-contract",
    website: String(feature?.properties?.website || "").trim()
  })));

  return {
    contracted,
    "no-contract": noContract,
    all: sortDirectoryEntries([...contracted, ...noContract])
  };
}

function buildNoContractGroupFeatures(entries, gemeenteFeatures, contractFeatures) {
  const gemeenteByNormName = new Map();
  for (const feature of gemeenteFeatures) {
    const naam = feature?.properties?.naam;
    const norm = normalizeText(naam);
    if (norm) {
      gemeenteByNormName.set(norm, feature);
    }
  }

  const contractCoveredGemeenten = new Set();
  for (const feature of contractFeatures || []) {
    for (const gemeente of feature?.properties?.gemeenten || []) {
      contractCoveredGemeenten.add(normalizeText(gemeente));
    }
  }

  const claimedNoContractGemeenten = new Set();
  const features = [];
  for (const entry of entries || []) {
    const municipalities = Array.isArray(entry?.municipalities) ? entry.municipalities : [];
    const mapsTo = Array.isArray(entry?.mapsTo) ? entry.mapsTo : [];
    if (municipalities.length === 0 || mapsTo.length > 0) {
      continue;
    }

    const multiPolygonCoords = [];
    const matchedMunicipalities = [];
    for (const municipality of municipalities) {
      const municipalityKey = normalizeText(municipality);
      if (!municipalityKey || contractCoveredGemeenten.has(municipalityKey) || claimedNoContractGemeenten.has(municipalityKey)) {
        continue;
      }

      const gemeenteFeature = gemeenteByNormName.get(municipalityKey);
      if (!gemeenteFeature) {
        continue;
      }

      claimedNoContractGemeenten.add(municipalityKey);
      matchedMunicipalities.push(gemeenteFeature.properties.naam);
      multiPolygonCoords.push(...geometryToMultiPolygonParts(gemeenteFeature.geometry));
    }

    if (multiPolygonCoords.length === 0) {
      continue;
    }

    features.push({
      type: "Feature",
      properties: {
        zorggroep: String(entry?.name || "").trim(),
        website: String(entry?.website || "").trim(),
        note: String(entry?.note || "").trim(),
        gemeenten: [...new Set(matchedMunicipalities)]
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: multiPolygonCoords
      }
    });
  }

  return features;
}

function colorFromString(str) {
  const normalized = normalizeText(str);
  if (normalized === "zhz cz") {
    return "#f97316";
  }
  if (normalized === "zhz vgz") {
    return "#16a34a";
  }

  let hash = 0;
  const input = String(str || "Onbekend");
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 52%)`;
}
