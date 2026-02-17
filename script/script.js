const AUTH_HASH = "9571debdee0b6cc98a87511ce8e3938c8b1617458c8a58335d1b2edb06811b64";
const AUTH_SESSION_KEY = "miguide_auth_ok";
const AUTH_PASSWORD_FALLBACK = "MiGuide#2026!@";
const ZORGGROEPEN_URL = "zg-data/zorggroepen.json";
const PDOK_GEMEENTE_ITEMS_URL = "https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/collections/gemeentegebied/items?f=json&limit=100";
const PDOK_POSTCODE_WFS_URL = "https://service.pdok.nl/cbs/postcode6/2024/wfs/v1_0";

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
  "drachten": "Smallingerland",
  "sneek": "Súdwest-Fryslân",
  "dokkum": "Noardeast-Fryslân",
  "franeker": "Waadhoeke",
  "joure": "De Fryske Marren",
  "burgum": "Tytsjerksteradiel",
  "gorredijk": "Opsterland",
  "kollum": "Noardeast-Fryslân",
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
  "weesp": "Amsterdam",
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
  "badhoevedorp": "Haarlemmermeer",
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
  "stompwijk": "Leidschendam-Voorburg",
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
  "maarsbergen": "Utrechtse Heuvelrug",
  "overberg": "Utrechtse Heuvelrug",
  "soest en soestdijk": "Soest",
  "stroe": "Barneveld",
  "stoutenberg": "Leusden",
  "terschuur": "Barneveld",
  "uddel": "Apeldoorn",
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

let map;
let geoLayer;
let allFeatures = [];
let currentFilter = "ALL";
let currentGemeente = "";
let gemeenteFeaturesStore = [];
let messageTimer;

function createMap() {
  if (map) {
    return;
  }
  map = L.map("map").setView([52.1, 5.3], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
}

async function sha256Hex(input) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error("Crypto API unavailable");
  }
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function checkPassword(password) {
  try {
    const hash = await sha256Hex(password);
    return hash === AUTH_HASH;
  } catch (error) {
    return password === AUTH_PASSWORD_FALLBACK;
  }
}

function unlockApp() {
  const gate = document.getElementById("authGate");
  const appShell = document.getElementById("appShell");
  gate.hidden = true;
  appShell.hidden = false;
  sessionStorage.setItem(AUTH_SESSION_KEY, "1");
}

function initAuthGate() {
  const gate = document.getElementById("authGate");
  const appShell = document.getElementById("appShell");
  const passInput = document.getElementById("authPassword");
  const submit = document.getElementById("authSubmit");
  const error = document.getElementById("authError");

  const openApp = () => {
    unlockApp();
    init();
  };

  if (sessionStorage.getItem(AUTH_SESSION_KEY) === "1") {
    openApp();
    return;
  }

  gate.hidden = false;
  appShell.hidden = true;

  const tryLogin = async () => {
    try {
      const ok = await checkPassword(passInput.value.trim());
      if (!ok) {
        error.hidden = false;
        return;
      }
      error.hidden = true;
      passInput.value = "";
      openApp();
    } catch (loginError) {
      console.error(loginError);
      error.textContent = "Inloggen mislukt. Probeer opnieuw.";
      error.hidden = false;
    }
  };

  submit.addEventListener("click", tryLogin);
  passInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      tryLogin();
    }
  });
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getZorggroepName(feature) {
  return feature?.properties?.zorggroep || "Onbekend";
}

function colorFromString(str) {
  const input = String(str || "Onbekend");
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 52%)`;
}

function style(feature) {
  return {
    weight: 1,
    opacity: 1,
    color: "#334155",
    fillOpacity: 0.5,
    fillColor: colorFromString(getZorggroepName(feature))
  };
}

function highlightFeature(e) {
  const layer = e.target;
  layer.setStyle({
    weight: 3,
    color: "#0f172a",
    fillOpacity: 0.7
  });

  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront();
  }
}

function resetHighlight(e) {
  if (geoLayer) {
    geoLayer.resetStyle(e.target);
  }
}

function popupContent(feature) {
  const props = feature?.properties || {};
  const zorggroep = props.zorggroep || "Onbekend";
  const regio = props.regio || "Onbekend";
  const website = props.website || "";
  const gemeenten = Array.isArray(props.gemeenten) ? props.gemeenten : [];
  const websiteRow = website
    ? `<div><a href="${website}" target="_blank" rel="noopener noreferrer">${website}</a></div>`
    : "<div>Geen website</div>";

  return `
    <div>
      <strong>${zorggroep}</strong>
      <div>Regio: ${regio}</div>
      <div>Gemeenten: ${gemeenten.length}</div>
      ${websiteRow}
    </div>
  `;
}

function onEachFeature(feature, layer) {
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: (event) => {
      L.DomEvent.stopPropagation(event);
      const selectedDomain = getZorggroepName(feature);
      currentFilter = selectedDomain;
      currentGemeente = "";

      const filterSelect = document.getElementById("zorggroepFilter");
      if (filterSelect) {
        filterSelect.value = selectedDomain;
      }

      const searchInput = document.getElementById("gemeenteSearch");
      if (searchInput) {
        searchInput.value = "";
      }

      applyActiveFilters();
    }
  });

  layer.bindTooltip(getZorggroepName(feature), { sticky: true });
  layer.bindPopup(popupContent(feature));
}

function renderLayer(features) {
  if (geoLayer) {
    map.removeLayer(geoLayer);
  }

  geoLayer = L.geoJSON(features, {
    style,
    onEachFeature
  }).addTo(map);

  if (geoLayer.getLayers().length > 0) {
    map.fitBounds(geoLayer.getBounds(), { padding: [16, 16] });
  }
}

function updateCityList(features) {
  const listEl = document.getElementById("cityList");
  if (!listEl) {
    return;
  }

  const uniqueCities = new Set();
  for (const feature of features) {
    const cities = Array.isArray(feature?.properties?.cities) ? feature.properties.cities : [];
    for (const city of cities) {
      if (city) {
        uniqueCities.add(city);
      }
    }
  }

  const sortedCities = [...uniqueCities].sort((a, b) => a.localeCompare(b, "nl"));
  if (sortedCities.length === 0) {
    listEl.innerHTML = "<li>Geen plaatsen gevonden</li>";
    return;
  }
  listEl.innerHTML = sortedCities.map((city) => `<li>${city}</li>`).join("");
}

function showStatus(message) {
  const el = document.getElementById("statusMessage");
  clearTimeout(messageTimer);
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.hidden = false;
  messageTimer = setTimeout(() => {
    el.hidden = true;
    el.textContent = "";
  }, 4500);
}

function applyActiveFilters() {
  let filtered = allFeatures;

  if (currentFilter !== "ALL") {
    filtered = filtered.filter((feature) => getZorggroepName(feature) === currentFilter);
  }

  if (currentGemeente) {
    const target = normalizeText(currentGemeente);
    filtered = filtered.filter((feature) => {
      const gemeenten = Array.isArray(feature?.properties?.gemeenten) ? feature.properties.gemeenten : [];
      const cities = Array.isArray(feature?.properties?.cities) ? feature.properties.cities : [];
      const inGemeente = gemeenten.some((name) => normalizeText(name) === target);
      const inCity = cities.some((name) => normalizeText(name) === target);
      return inGemeente || inCity;
    });
  }

  updateCityList(filtered);
  renderLayer(filtered);
}

function setupFilter(features) {
  const select = document.getElementById("zorggroepFilter");
  const zorggroepen = [...new Set(features.map(getZorggroepName))].sort((a, b) => a.localeCompare(b, "nl"));

  select.innerHTML = '<option value="ALL">Alle zorggroepen</option>';
  for (const zorggroep of zorggroepen) {
    const option = document.createElement("option");
    option.value = zorggroep;
    option.textContent = zorggroep;
    select.appendChild(option);
  }

  select.addEventListener("change", (event) => {
    currentFilter = event.target.value;
    applyActiveFilters();
  });
}

function collectGemeenten(features) {
  const unique = new Set();
  for (const feature of features) {
    const gemeenten = Array.isArray(feature?.properties?.gemeenten) ? feature.properties.gemeenten : [];
    const cities = Array.isArray(feature?.properties?.cities) ? feature.properties.cities : [];
    for (const gemeente of gemeenten) {
      if (gemeente) {
        unique.add(gemeente);
      }
    }
    for (const city of cities) {
      if (city) {
        unique.add(city);
      }
    }
  }
  return [...unique].sort((a, b) => a.localeCompare(b, "nl"));
}

function formatPostcode(input) {
  const cleaned = String(input || "").toUpperCase().replace(/\s+/g, "");
  return /^\d{4}[A-Z]{2}$/.test(cleaned) ? cleaned : null;
}

function formatPostcode4(input) {
  const cleaned = String(input || "").replace(/\s+/g, "");
  return /^\d{4}$/.test(cleaned) ? cleaned : null;
}

function isPostcodeInput(input) {
  const raw = String(input || "").trim();
  return /^\d{4}\s?[a-zA-Z]{2}$/.test(raw) || /^\d{4}$/.test(raw);
}

function pointInRing(point, ring) {
  let inside = false;
  const x = point[0];
  const y = point[1];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi);
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygonWithHoles(point, polygonCoords) {
  if (!polygonCoords || polygonCoords.length === 0) {
    return false;
  }
  if (!pointInRing(point, polygonCoords[0])) {
    return false;
  }
  for (let i = 1; i < polygonCoords.length; i++) {
    if (pointInRing(point, polygonCoords[i])) {
      return false;
    }
  }
  return true;
}

function municipalityForPoint(point) {
  for (const feature of gemeenteFeaturesStore) {
    const geom = feature?.geometry;
    if (!geom) {
      continue;
    }
    if (geom.type === "Polygon" && pointInPolygonWithHoles(point, geom.coordinates)) {
      return feature.properties.naam;
    }
    if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        if (pointInPolygonWithHoles(point, poly)) {
          return feature.properties.naam;
        }
      }
    }
  }
  return null;
}

function buildPostcodeFilterXml(postcodeInput) {
  const pc6 = formatPostcode(postcodeInput);
  if (pc6) {
    return `<Filter xmlns='http://www.opengis.net/ogc'><PropertyIsEqualTo><PropertyName>postcode6</PropertyName><Literal>${pc6}</Literal></PropertyIsEqualTo></Filter>`;
  }

  const pc4 = formatPostcode4(postcodeInput);
  if (pc4) {
    return `<Filter xmlns='http://www.opengis.net/ogc'><PropertyIsLike wildCard='*' singleChar='.' escape='!'><PropertyName>postcode6</PropertyName><Literal>${pc4}*</Literal></PropertyIsLike></Filter>`;
  }

  return null;
}

async function lookupPostcodeToGemeente(postcodeInput) {
  const filterXml = buildPostcodeFilterXml(postcodeInput);
  if (!filterXml) {
    return { gemeenten: [], postcodes: [] };
  }

  const isPc4 = Boolean(formatPostcode4(postcodeInput));
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typeName: "postcode6:postcode6",
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    maxFeatures: isPc4 ? "1500" : "25",
    filter: filterXml
  });

  const response = await fetch(`${PDOK_POSTCODE_WFS_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Postcode lookup mislukt (${response.status})`);
  }
  const data = await response.json();
  const features = Array.isArray(data.features) ? data.features : [];
  if (features.length === 0) {
    return { gemeenten: [], postcodes: [] };
  }

  const postcodes = [];
  const gemeenteCount = new Map();

  for (const feature of features) {
    const code = feature?.properties?.postcode6;
    if (code) {
      postcodes.push(code);
    }
    const bbox = feature?.bbox;
    if (!Array.isArray(bbox) || bbox.length < 4) {
      continue;
    }
    const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
    const gemeenteNaam = municipalityForPoint(center);
    if (!gemeenteNaam) {
      continue;
    }
    gemeenteCount.set(gemeenteNaam, (gemeenteCount.get(gemeenteNaam) || 0) + 1);
  }

  const gemeenten = [...gemeenteCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0]);

  return { gemeenten, postcodes };
}

function setupGemeenteSearch(features) {
  const input = document.getElementById("gemeenteSearch");
  const suggestions = document.getElementById("gemeenteSuggestions");
  const gemeenten = collectGemeenten(features);

  function hideSuggestions() {
    suggestions.hidden = true;
    suggestions.innerHTML = "";
  }

  function applySuggestion(value) {
    currentGemeente = value;
    input.value = value;
    hideSuggestions();
    showStatus("");
    applyActiveFilters();
  }

  function renderSuggestions(query) {
    const q = normalizeText(query);
    if (!q) {
      hideSuggestions();
      currentGemeente = "";
      applyActiveFilters();
      return;
    }

    const startsWith = gemeenten.filter((name) => normalizeText(name).startsWith(q));
    const contains = gemeenten.filter((name) => {
      const normalized = normalizeText(name);
      return normalized.includes(q) && !normalized.startsWith(q);
    });
    const matches = [...startsWith, ...contains].slice(0, 10);

    if (matches.length === 0) {
      hideSuggestions();
      return;
    }

    suggestions.innerHTML = matches
      .map((name) => `<div class="suggestion-item" data-gemeente="${name}">${name}</div>`)
      .join("");
    suggestions.hidden = false;
  }

  input.addEventListener("input", (event) => {
    renderSuggestions(event.target.value);
  });

  input.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const rawValue = input.value.trim();

      if (isPostcodeInput(rawValue)) {
        hideSuggestions();
        const postcode6 = formatPostcode(rawValue);
        const postcode4 = formatPostcode4(rawValue);
        const normalizedInput = postcode6 || postcode4;
        if (!normalizedInput) {
          showStatus("Ongeldige postcode. Gebruik 1234 of 1234AB.");
          return;
        }
        try {
          const result = await lookupPostcodeToGemeente(normalizedInput);
          const gemeenteNaam = result.gemeenten[0];

          if (!gemeenteNaam) {
            currentGemeente = "";
            applyActiveFilters();
            showStatus(`Postcode ${normalizedInput} niet gevonden in de PDOK postcode6 data.`);
            return;
          }

          const hasDomain = allFeatures.some((feature) => {
            const gemeenten = Array.isArray(feature?.properties?.gemeenten) ? feature.properties.gemeenten : [];
            return gemeenten.some((name) => normalizeText(name) === normalizeText(gemeenteNaam));
          });

          if (!hasDomain) {
            currentGemeente = "";
            applyActiveFilters();
            showStatus(`Postcode ${normalizedInput} valt niet binnen een zorggroep domein in je lijst.`);
            return;
          }

          currentGemeente = gemeenteNaam;
          input.value = normalizedInput;
          applyActiveFilters();
          showStatus(`Postcode ${normalizedInput} gevonden in gemeente ${gemeenteNaam}.`);
          return;
        } catch (error) {
          console.error(error);
          showStatus("Postcode zoeken via PDOK is nu niet beschikbaar.");
          return;
        }
      }

      const first = suggestions.querySelector(".suggestion-item");
      if (first) {
        applySuggestion(first.dataset.gemeente);
      } else if (input.value.trim() === "") {
        currentGemeente = "";
        showStatus("");
        applyActiveFilters();
      }
    }
    if (event.key === "Escape") {
      hideSuggestions();
    }
  });

  suggestions.addEventListener("click", (event) => {
    const target = event.target.closest(".suggestion-item");
    if (!target) {
      return;
    }
    applySuggestion(target.dataset.gemeente);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-wrap")) {
      hideSuggestions();
    }
  });
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
    const features = Array.isArray(page.features) ? page.features : [];
    all.push(...features);

    const nextLink = Array.isArray(page.links)
      ? page.links.find((link) => link.rel === "next")
      : null;
    nextUrl = nextLink?.href || null;
  }

  return all;
}

function buildZorggroepFeatures(zorggroepen, gemeenteFeatures) {
  const gemeenteByNormName = new Map();
  for (const feature of gemeenteFeatures) {
    const naam = feature?.properties?.naam;
    const norm = normalizeText(naam);
    if (norm) {
      gemeenteByNormName.set(norm, feature);
    }
  }

  const features = [];

  for (const item of zorggroepen) {
    const matchedGemeenten = [];
    const unmatchedCities = [];
    const seenGemeente = new Set();

    for (const city of item.cities || []) {
      const gemeenteNaam = cityToGemeenteName(city, gemeenteByNormName);
      if (!gemeenteNaam) {
        unmatchedCities.push(city);
        continue;
      }

      const norm = normalizeText(gemeenteNaam);
      if (seenGemeente.has(norm)) {
        continue;
      }
      seenGemeente.add(norm);
      matchedGemeenten.push(gemeenteNaam);
    }

    const multiPolygonCoords = [];
    for (const gemeenteNaam of matchedGemeenten) {
      const gemeenteFeature = gemeenteByNormName.get(normalizeText(gemeenteNaam));
      if (!gemeenteFeature) {
        continue;
      }
      const parts = geometryToMultiPolygonParts(gemeenteFeature.geometry);
      multiPolygonCoords.push(...parts);
    }

    if (multiPolygonCoords.length === 0) {
      continue;
    }

    features.push({
      type: "Feature",
      properties: {
        zorggroep: item.zorggroep || "Onbekend",
        regio: item.regio || item.zorggroep || "Onbekend",
        website: item.website || "",
        cities: Array.isArray(item.cities) ? item.cities : [],
        gemeenten: matchedGemeenten,
        unmatchedCities
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: multiPolygonCoords
      }
    });
  }

  return features;
}

async function init() {
  try {
    createMap();

    const [zorggroepResponse, gemeenteFeatures] = await Promise.all([
      fetch(ZORGGROEPEN_URL),
      fetchAllGemeenteFeatures()
    ]);

    if (!zorggroepResponse.ok) {
      throw new Error(`zorggroepen.json laden mislukt (${zorggroepResponse.status})`);
    }

    const zorggroepData = await zorggroepResponse.json();
    const zorggroepen = Array.isArray(zorggroepData.zorggroepen) ? zorggroepData.zorggroepen : [];

    allFeatures = buildZorggroepFeatures(zorggroepen, gemeenteFeatures);
    gemeenteFeaturesStore = gemeenteFeatures;
    setupFilter(allFeatures);
    setupGemeenteSearch(allFeatures);
    applyActiveFilters();
  } catch (error) {
    console.error(error);
    alert("Kon zorggroepdata of PDOK gemeentegebieden niet laden. Controleer Live Server en internetverbinding.");
  }
}

initAuthGate();
