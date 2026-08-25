const AUTH_SESSION_KEY = "miguide_auth_ok";
const THEME_STORAGE_KEY = "miguide_theme";
const ZORGGROEPEN_URL = "zg-data/zorggroepen.json";
const ZORGGROEP_INFO_URL = "zg-data/alle-zorggroepen-info.json";
const PDOK_GEMEENTE_ITEMS_URL = "https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/collections/gemeentegebied/items?f=json&limit=100";
const NL_DEFAULT_CENTER = [52.2, 5.3];
const NL_DEFAULT_ZOOM = 8;
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
  "hardinxveld giesendam": "Hardinxveld-Giesendam",
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

let map;
let baseTileLayer;
let contractedLayer;
let noContractGroupLayer;
let genericUncoveredLayer;
let activeInfoPopup = null;
let currentMapFilter = "all";
let zorggroepDirectoryEntries = {
  all: [],
  contracted: [],
  "no-contract": []
};
let genericUncoveredCount = 0;

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isDarkModeActive() {
  return document.body.classList.contains("dark-mode");
}

function applyMapTheme() {
  if (!map) {
    return;
  }

  if (baseTileLayer) {
    map.removeLayer(baseTileLayer);
  }

  baseTileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
    className: isDarkModeActive() ? "map-tiles-dark" : "map-tiles-light"
  });
  baseTileLayer.addTo(map);
}

function setTheme(mode) {
  const nextMode = mode === "dark" ? "dark" : "light";
  document.body.classList.toggle("dark-mode", nextMode === "dark");
  document.body.classList.toggle("dark", nextMode === "dark");
  document.documentElement.classList.toggle("dark", nextMode === "dark");
  document.body.setAttribute("data-theme", nextMode);
  document.documentElement.setAttribute("data-theme", nextMode);
  localStorage.setItem(THEME_STORAGE_KEY, nextMode);

  const toggle = document.getElementById("themeToggle");
  const toggleIcon = document.getElementById("themeToggleIcon");
  if (toggle) {
    toggle.setAttribute("aria-label", nextMode === "dark" ? "Dark mode actief" : "Light mode actief");
    toggle.setAttribute("title", nextMode === "dark" ? "Dark mode" : "Light mode");
  }
  if (toggleIcon) {
    toggleIcon.textContent = nextMode === "dark" ? "\u{1F319}" : "\u2600";
  }

  const siteLogo = document.getElementById("siteLogo");
  if (siteLogo) {
    const lightLogo = siteLogo.getAttribute("data-logo-light");
    const darkLogo = siteLogo.getAttribute("data-logo-dark");
    siteLogo.src = nextMode === "dark" ? (darkLogo || lightLogo || siteLogo.src) : (lightLogo || siteLogo.src);
  }

  applyMapTheme();
}

function initThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  setTheme(localStorage.getItem(THEME_STORAGE_KEY) || "light");

  if (toggle && !toggle.dataset.themeBound) {
    toggle.dataset.themeBound = "1";
    toggle.addEventListener("click", () => {
      setTheme(isDarkModeActive() ? "light" : "dark");
    });
  }
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

  const alias = CITY_TO_GEMEENTE[cleanCity];
  if (typeof alias === "string") {
    return alias || null;
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
    if (!zorggroepName || NO_CONTRACT_NAMES.has(normalizeText(zorggroepName))) {
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

function renderZorggroepDirectory() {
  const container = document.getElementById("mapNameDirectory");
  const countElement = document.getElementById("mapNameCount");
  const hintElement = document.getElementById("mapNameDirectoryHint");
  if (!container || !countElement || !hintElement) {
    return;
  }

  const entries = zorggroepDirectoryEntries[currentMapFilter] || [];
  const countLabel = `${entries.length} zorggroep${entries.length === 1 ? "" : "en"}`;
  countElement.textContent = countLabel;

  if (entries.length === 0) {
    container.innerHTML = `<div class="map-name-directory__empty">Geen zorggroepen zichtbaar voor deze filter.</div>`;
  } else {
    container.innerHTML = entries.map((entry) => {
      const statusClass = entry.status === "contracted"
        ? "map-name-directory__badge map-name-directory__badge--contracted"
        : "map-name-directory__badge map-name-directory__badge--no-contract";
      const statusLabel = entry.status === "contracted" ? "Gecontracteerd" : "Geen contract";
      const websiteHtml = entry.website
        ? `<a class="map-name-directory__link" href="${escapeHtml(entry.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.website)}</a>`
        : `<span class="map-name-directory__muted">Geen website gekoppeld</span>`;

      return `
        <article class="map-name-directory__item">
          <div class="map-name-directory__item-head">
            <div class="map-name-directory__name">${escapeHtml(entry.name)}</div>
            <span class="${statusClass}">${statusLabel}</span>
          </div>
          <div class="map-name-directory__website">${websiteHtml}</div>
        </article>
      `;
    }).join("");
  }

  if (currentMapFilter === "contracted") {
    hintElement.textContent = "Deze lijst toont de zorggroepen die in de kaart als gecontracteerd zichtbaar zijn.";
  } else if (currentMapFilter === "no-contract") {
    hintElement.textContent = genericUncoveredCount > 0
      ? `Deze lijst toont de no-contract zorggroepen die al aan een gemeente zijn gekoppeld. Daarnaast blijven nog ${genericUncoveredCount} losse gemeenten zonder betrouwbare zorggroepkoppeling buiten deze lijst.`
      : "Deze lijst toont de no-contract zorggroepen die nu al betrouwbaar aan gemeenten zijn gekoppeld.";
  } else {
    hintElement.textContent = genericUncoveredCount > 0
      ? `Deze lijst combineert gecontracteerde en no-contract zorggroepen. Daarnaast zijn er nog ${genericUncoveredCount} losse gemeenten zonder betrouwbare zorggroepkoppeling.`
      : "Deze lijst combineert alle zorggroepen die nu al zichtbaar en benoemd zijn op de kaart.";
  }
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

function styleContractFeature(feature) {
  return {
    weight: 1,
    opacity: 1,
    color: "#334155",
    fillOpacity: 0.46,
    fillColor: colorFromString(feature?.properties?.zorggroep)
  };
}

function closeActivePopup() {
  if (map && activeInfoPopup) {
    map.closePopup(activeInfoPopup);
    activeInfoPopup = null;
  }
}

function buildNoContractEntriesListHtml(infoEntries) {
  return (infoEntries || []).map((entry) => {
    const name = escapeHtml(entry.name || "Onbekend");
    const note = entry.note ? `<div class="zorggroep-detail-card__note">${escapeHtml(entry.note)}</div>` : "";
    const website = entry.website
      ? `<a class="zorggroep-detail-card__link" href="${escapeHtml(entry.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.website)}</a>`
      : `<div class="zorggroep-detail-card__note">Geen website gekoppeld</div>`;
    return `
      <li class="zorggroep-detail-card__item">
        <div class="zorggroep-detail-card__name">${name}</div>
        ${note}
        ${website}
      </li>
    `;
  }).join("");
}

function buildContractPopupHtml(feature, infoEntries) {
  const zorggroep = escapeHtml(feature?.properties?.zorggroep || "Onbekend");
  const details = (infoEntries || []).length > 0
    ? infoEntries
    : [{
        name: feature?.properties?.zorggroep || "Onbekend",
        website: feature?.properties?.website || "",
        note: "Nog geen extra directory-informatie gekoppeld voor deze kaartregio."
      }];

  const listHtml = details.map((entry) => {
    const name = escapeHtml(entry.name || "Onbekend");
    const note = entry.note ? `<div class="zorggroep-detail-card__note">${escapeHtml(entry.note)}</div>` : "";
    const website = entry.website
      ? `<a class="zorggroep-detail-card__link" href="${escapeHtml(entry.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.website)}</a>`
      : `<div class="zorggroep-detail-card__note">Geen website gekoppeld</div>`;
    return `
      <li class="zorggroep-detail-card__item">
        <div class="zorggroep-detail-card__name">${name}</div>
        ${note}
        ${website}
      </li>
    `;
  }).join("");

  return `
    <div class="zorggroep-detail-card">
      <button type="button" class="zorggroep-detail-card__close" data-popup-close aria-label="Sluiten">&times;</button>
      <div class="zorggroep-detail-card__status zorggroep-detail-card__status--contracted">Gecontracteerd</div>
      <div class="zorggroep-detail-card__title">${zorggroep}</div>
      <div class="zorggroep-detail-card__hint">Klik buiten deze popup om verder te gaan op de kaart.</div>
      <ul class="zorggroep-detail-card__list">${listHtml}</ul>
    </div>
  `;
}

function buildNoContractPopupHtml(zorggroepNaam, gemeenten, website, note) {
  const municipalityLabel = Array.isArray(gemeenten) && gemeenten.length > 0
    ? gemeenten.join(", ")
    : "Nog geen gemeente gekoppeld";
  const details = [{
    name: zorggroepNaam || "Geen contract met MiGuide",
    website: website || "",
    note: note || "Voor deze zorggroep is nog geen contract met MiGuide gekoppeld."
  }];
  const listHtml = buildNoContractEntriesListHtml(details);

  return `
    <div class="zorggroep-detail-card">
      <button type="button" class="zorggroep-detail-card__close" data-popup-close aria-label="Sluiten">&times;</button>
      <div class="zorggroep-detail-card__status zorggroep-detail-card__status--no-contract">Geen contract met MiGuide</div>
      <div class="zorggroep-detail-card__title">${escapeHtml(zorggroepNaam || "Geen contract met MiGuide")}</div>
      <div class="zorggroep-detail-card__hint">Gemeenten: ${escapeHtml(municipalityLabel)}</div>
      <ul class="zorggroep-detail-card__list">${listHtml}</ul>
    </div>
  `;
}

function wirePopupClose(popup) {
  const popupElement = popup?.getElement();
  if (!popupElement) {
    return;
  }
  const closeButton = popupElement.querySelector("[data-popup-close]");
  if (closeButton && !closeButton.dataset.bound) {
    closeButton.dataset.bound = "1";
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeActivePopup();
    });
  }
}

function openInfoPopup(latlng, html) {
  closeActivePopup();
  activeInfoPopup = L.popup({
    className: "zorggroep-detail-popup",
    closeButton: false,
    autoClose: true,
    closeOnClick: true,
    maxWidth: 360
  })
    .setLatLng(latlng)
    .setContent(html)
    .openOn(map);

  requestAnimationFrame(() => {
    wirePopupClose(activeInfoPopup);
  });
}

function bindContractInteractions(layer, infoByGroup) {
  const zorggroep = String(layer.feature?.properties?.zorggroep || "Onbekend");
  layer.bindTooltip(`<strong>${escapeHtml(zorggroep)}</strong><br><span>Gecontracteerd</span>`, {
    sticky: false,
    direction: "top",
    offset: [0, -8]
  });

  layer.on("mouseover", () => {
    layer.setStyle({
      weight: 2.2,
      color: "#0f172a",
      fillOpacity: 0.66
    });
    layer.bringToFront();
    layer.openTooltip();
  });

  layer.on("mouseout", () => {
    contractedLayer?.resetStyle(layer);
  });

  layer.on("click", (event) => {
    const infoEntries = infoByGroup.get(normalizeText(zorggroep)) || [];
    openInfoPopup(event.latlng, buildContractPopupHtml(layer.feature, infoEntries));
  });
}

function bindNoContractGroupInteractions(feature, layer) {
  const zorggroepNaam = String(feature?.properties?.zorggroep || "Geen contract met MiGuide");
  const gemeenten = Array.isArray(feature?.properties?.gemeenten) ? feature.properties.gemeenten : [];
  const municipalityHint = gemeenten.length > 0 ? gemeenten.join(", ") : "Geen gemeente bekend";

  layer.bindTooltip(`<strong>${escapeHtml(zorggroepNaam)}</strong><br><span>${escapeHtml(municipalityHint)} • Geen contract</span>`, {
    sticky: false,
    direction: "top",
    offset: [0, -8]
  });

  layer.on("mouseover", () => {
    layer.setStyle({
      weight: 1.8,
      color: "#64748b",
      fillOpacity: 0.44
    });
    layer.bringToFront();
    layer.openTooltip();
  });

  layer.on("mouseout", () => {
    noContractGroupLayer?.resetStyle(layer);
  });

  layer.on("click", (event) => {
    openInfoPopup(
      event.latlng,
      buildNoContractPopupHtml(
        zorggroepNaam,
        gemeenten,
        String(feature?.properties?.website || ""),
        String(feature?.properties?.note || "")
      )
    );
  });
}

function bindUncoveredInteractions(feature, layer) {
  const gemeenteNaam = String(feature?.properties?.naam || "Onbekende gemeente");
  layer.bindTooltip(`<strong>Geen contract met MiGuide</strong><br><span>${escapeHtml(gemeenteNaam)}</span>`, {
    sticky: false,
    direction: "top",
    offset: [0, -8]
  });

  layer.on("mouseover", () => {
    layer.setStyle({
      weight: 1.8,
      color: "#64748b",
      fillOpacity: 0.44
    });
    layer.bringToFront();
    layer.openTooltip();
  });

  layer.on("mouseout", () => {
    genericUncoveredLayer?.resetStyle(layer);
  });

  layer.on("click", (event) => {
    openInfoPopup(event.latlng, buildNoContractPopupHtml("Geen contract met MiGuide", [gemeenteNaam], "", ""));
  });
}

function renderNoContractGroupLayer(noContractFeatures) {
  noContractGroupLayer = L.geoJSON(noContractFeatures, {
    interactive: true,
    style: {
      color: "#94a3b8",
      weight: 1,
      opacity: 0.78,
      fillColor: "#dbe4ee",
      fillOpacity: 0.4
    },
    onEachFeature: bindNoContractGroupInteractions
  }).addTo(map);
}

function renderUncoveredLayer(gemeenteFeatures, contractFeatures, noContractFeatures) {
  const coveredGemeenten = new Set();
  for (const feature of contractFeatures) {
    for (const gemeente of feature?.properties?.gemeenten || []) {
      coveredGemeenten.add(normalizeText(gemeente));
    }
  }
  for (const feature of noContractFeatures) {
    for (const gemeente of feature?.properties?.gemeenten || []) {
      coveredGemeenten.add(normalizeText(gemeente));
    }
  }

  const uncoveredFeatures = gemeenteFeatures.filter((gemeenteFeature) => {
    const naam = gemeenteFeature?.properties?.naam;
    return naam && !coveredGemeenten.has(normalizeText(naam));
  });
  genericUncoveredCount = uncoveredFeatures.length;

  genericUncoveredLayer = L.geoJSON(uncoveredFeatures, {
    interactive: true,
    style: {
      color: "#94a3b8",
      weight: 1,
      opacity: 0.72,
      fillColor: "#cbd5e1",
      fillOpacity: 0.34
    },
    onEachFeature: bindUncoveredInteractions
  }).addTo(map);
}

function applyLayerVisibility() {
  if (!map) {
    return;
  }

  if (contractedLayer) {
    const showContracted = currentMapFilter === "all" || currentMapFilter === "contracted";
    if (showContracted && !map.hasLayer(contractedLayer)) {
      contractedLayer.addTo(map);
    }
    if (!showContracted && map.hasLayer(contractedLayer)) {
      map.removeLayer(contractedLayer);
    }
  }

  if (noContractGroupLayer) {
    const showUncovered = currentMapFilter === "all" || currentMapFilter === "no-contract";
    if (showUncovered && !map.hasLayer(noContractGroupLayer)) {
      noContractGroupLayer.addTo(map);
    }
    if (!showUncovered && map.hasLayer(noContractGroupLayer)) {
      map.removeLayer(noContractGroupLayer);
    }
  }

  if (genericUncoveredLayer) {
    const showGenericUncovered = currentMapFilter === "all" || currentMapFilter === "no-contract";
    if (showGenericUncovered && !map.hasLayer(genericUncoveredLayer)) {
      genericUncoveredLayer.addTo(map);
    }
    if (!showGenericUncovered && map.hasLayer(genericUncoveredLayer)) {
      map.removeLayer(genericUncoveredLayer);
    }
  }
}

function updateFilterButtons() {
  const buttons = document.querySelectorAll("[data-map-filter]");
  buttons.forEach((button) => {
    const isActive = button.dataset.mapFilter === currentMapFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function setMapFilter(filterValue) {
  currentMapFilter = filterValue || "all";
  updateFilterButtons();
  applyLayerVisibility();
  renderZorggroepDirectory();
}

function initMapFilterButtons() {
  const buttons = document.querySelectorAll("[data-map-filter]");
  buttons.forEach((button) => {
    if (button.dataset.bound === "1") {
      return;
    }
    button.dataset.bound = "1";
    button.addEventListener("click", () => {
      setMapFilter(button.dataset.mapFilter || "all");
    });
  });
  updateFilterButtons();
}

function createMap() {
  map = L.map("allZorggroepenMap", { closePopupOnClick: true }).setView(NL_DEFAULT_CENTER, NL_DEFAULT_ZOOM);
  applyMapTheme();

  map.on("popupclose", () => {
    activeInfoPopup = null;
  });
}

function initGlobalPopupDismiss() {
  if (document.body.dataset.popupDismissBound === "1") {
    return;
  }

  document.body.dataset.popupDismissBound = "1";
  document.addEventListener("pointerdown", (event) => {
    if (!activeInfoPopup) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest(".zorggroep-detail-popup") || target.closest(".leaflet-interactive")) {
      return;
    }

    closeActivePopup();
  });
}

function ensureAuthenticated() {
  if (sessionStorage.getItem(AUTH_SESSION_KEY) === "1") {
    return true;
  }
  window.location.replace("index.html");
  return false;
}

async function init() {
  if (!ensureAuthenticated()) {
    return;
  }

  initThemeToggle();
  initMapFilterButtons();
  initGlobalPopupDismiss();
  createMap();

  try {
    const [zorggroepResponse, infoResponse, gemeenteFeatures] = await Promise.all([
      fetch(ZORGGROEPEN_URL),
      fetch(ZORGGROEP_INFO_URL),
      fetchAllGemeenteFeatures()
    ]);

    if (!zorggroepResponse.ok) {
      throw new Error(`zorggroepen.json laden mislukt (${zorggroepResponse.status})`);
    }
    if (!infoResponse.ok) {
      throw new Error(`alle-zorggroepen-info.json laden mislukt (${infoResponse.status})`);
    }

    const zorggroepData = await zorggroepResponse.json();
    const infoData = await infoResponse.json();
    const zorggroepen = Array.isArray(zorggroepData.zorggroepen) ? zorggroepData.zorggroepen : [];
    const infoEntries = Array.isArray(infoData.entries) ? infoData.entries : [];
    const { infoByGroup } = buildInfoLookup(infoEntries);
    const contractFeatures = buildContractFeatures(zorggroepen, gemeenteFeatures);
    const noContractFeatures = buildNoContractGroupFeatures(infoEntries, gemeenteFeatures, contractFeatures);
    zorggroepDirectoryEntries = buildDirectoryEntries(contractFeatures, noContractFeatures, infoByGroup);

    renderNoContractGroupLayer(noContractFeatures);
    renderUncoveredLayer(gemeenteFeatures, contractFeatures, noContractFeatures);

    contractedLayer = L.geoJSON(contractFeatures, {
      style: styleContractFeature,
      onEachFeature: (_, layer) => bindContractInteractions(layer, infoByGroup)
    }).addTo(map);

    setMapFilter(currentMapFilter);

    const bounds = contractedLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [18, 18] });
    }
  } catch (error) {
    console.error(error);
    alert("Kon de kaart voor alle zorggroepen niet laden. Controleer Live Server en internetverbinding.");
  }
}

init();
