const AUTH_HASH = "9571debdee0b6cc98a87511ce8e3938c8b1617458c8a58335d1b2edb06811b64";
const AUTH_SESSION_KEY = "miguide_auth_ok";
const AUTH_PASSWORD_FALLBACK = "MiGuide#2026!@";
const ZORGGROEPEN_URL = "zg-data/zorggroepen.json";
const PDOK_GEMEENTE_ITEMS_URL = "https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/collections/gemeentegebied/items?f=json&limit=100";
const PDOK_POSTCODE_WFS_URL = "https://service.pdok.nl/cbs/postcode6/2024/wfs/v1_0";
const NL_DEFAULT_CENTER = [52.2, 5.3];
const NL_DEFAULT_ZOOM = 8;
const THEME_STORAGE_KEY = "miguide_theme";
const DEFAULT_ZORGVERZEKERAARS = [
  "a.s.r.",
  "Menzis Digitaal 2026",
  "ONVZ",
  "VGZ",
  "Zilveren Kruis (Achmea)",
  "Aevitae (Eucare)",
  "CZ",
  "DSW",
  "Salland",
  "Zorg & Zekerheid"
];

const FACTURATIESTROMEN = {
  STROOM_1: "Stroom 1 - Zorggroep declaraties",
  STROOM_2: "Stroom 2 - VECOZO Gecontracteerde Zorg",
  STROOM_3: "Stroom 3 - Niet gecontracteerde Zorg - Losse Facturen",
  STROOM_4: "Stroom 4 - Gezondheid Amsterdam GA",
  STROOM_5: "Stroom 5 - ZoHealthy"
};

const ZORGGROEP_DECLARATIESTROOM_FALLBACK = {
  "zorggroep almere": "Op factuur achteraf",
  "almere": "Op factuur achteraf",
  "amstelland": "Extern Monter Systeem",
  "amstelland zorg": "Extern Monter Systeem",
  "eemland": "Boards",
  "eemland huisartsen": "Boards",
  "gezondheid amsterdam": "Declaratiestromen per zorgverzekeraar",
  "zorggroep gezondheid amsterdam": "Declaratiestromen per zorgverzekeraar",
  "hadoks": "Evry -> Per 1 Maart 2026 nieuw systeem",
  "hoog": "Declaratiestromen per zorgverzekeraar",
  "hozl": "VIPLive",
  "kennemerland": "Declaratiestromen per zorgverzekeraar",
  "ketenzorg friesland": "VIPLive",
  "kop noordholland": "Declaratiestromen per zorgverzekeraar",
  "kop noord holland": "Declaratiestromen per zorgverzekeraar",
  "medita": "VIPLive",
  "meditta": "VIPLive",
  "rhogo": "VIPLive",
  "rhogo regionale huisartsen organisatie gooi en omstreken bv": "VIPLive",
  "rijn en duin": "VIPLive",
  "rijnmond dokters": "VIPLive",
  "post z naam in zorgtraject stroomz": "VIPLive",
  "stroomz": "VIPLive",
  "postz": "VIPLive",
  "west friesland": "WAS BOARDS -> Via Declarant Optie Monter?",
  "hwfriesland": "WAS BOARDS -> Via Declarant Optie Monter?",
  "zuid holland zuid": "Declaratiestromen per zorgverzekeraar",
  "unicum": "VIPLive - Op factuur achteraf",
  "zio": "Medix"
};

const DECLARATIE_PER_VERZEKERAAR_OUTPUT = {
  "a s r": FACTURATIESTROMEN.STROOM_2,
  "menzis digitaal 2026": FACTURATIESTROMEN.STROOM_2,
  "onvz": FACTURATIESTROMEN.STROOM_2,
  "vgz": FACTURATIESTROMEN.STROOM_2,
  "zilveren kruis achmea": FACTURATIESTROMEN.STROOM_2,
  "aevitae eucare": FACTURATIESTROMEN.STROOM_3,
  "cz": FACTURATIESTROMEN.STROOM_3,
  "dsw": FACTURATIESTROMEN.STROOM_3,
  "salland": FACTURATIESTROMEN.STROOM_3,
  "zorg zekerheid": FACTURATIESTROMEN.STROOM_3
};

const FACTURATIESTROOM_CONTEXT = {
  [FACTURATIESTROMEN.STROOM_1]: "Zorggroepdeclaraties via zorggroepsystemen. Bekende modules/omgevingen: VIPLive, cBoards, Medix, Nis, Kysios.",
  [FACTURATIESTROMEN.STROOM_2]: "Gecontracteerde zorg via VECOZO voor Menzis, VGZ, a.s.r., Achmea/Zilveren Kruis en ONVZ.",
  [FACTURATIESTROMEN.STROOM_3]: "Niet-gecontracteerde zorg via losse facturen (CZ, DSW, Zorg & Zekerheid, Aevitae Eucare, Salland).",
  [FACTURATIESTROMEN.STROOM_4]: "Gezondheid Amsterdam (GA)-route voor de GA-context.",
  [FACTURATIESTROMEN.STROOM_5]: "ZoHealthy-route voor specifieke deelnemers/cohorten (zoals HHT/HZGB en periodegebonden groepen)."
};

const FACTURATIEMODULE_TEMPLATES = {
  "CoOL via zorggroep": "CoOL via zorggroep. Gebruik wanneer declaraties via een zorggroep-context lopen (bijv. via zorggroep-afspraken of zorggroep-afhandeling).",
  "CoOL via ZORGVERZEKERAAR - via GA": "CoOL via zorgverzekeraar via GA-route. Specifieke module voor zorgverzekeraar-afhandeling via de GA-constructie.",
  "Gezondheid Amsterdam (GA)": "CoOL-MiGuide via zorgverzekeraar voor de GA-regio. Declaraties van deelnemers in de GA-regio worden periodiek via een XML-bestand aangeleverd aan GA.",
  "MiGuide": "CoOL-MiGuide via zorgverzekeraar. Declaraties worden direct vanuit MiGuide gedeclareerd aan andere zorgverzekeraars (niet VGZ), conform contractafspraken.",
  "MiGuide - VGZ": "CoOL via zorgverzekeraar (VGZ). Declaraties worden direct aan VGZ gedeclareerd vanuit MiGuide, conform contract met VGZ.",
  "ZoHealthy": "CoOL via zorgverzekeraar via ZoHealthy. Declaraties lopen via ZoHealthy en de verkooptarieven van ZoHealthy worden gebruikt.",
  "Zorggroep": "CoOL-MiGuide via zorggroep. Declaraties worden verwerkt via een platform/omgeving van een andere zorggroep (bijv. VIPLive of Monter); tarieven vanuit de zorggroep.",
  "Zuid Holland Zuid - CZ": "CoOL-MiGuide via zorgverzekeraar voor GLI-ZHZ-CZ. Declaraties voor CZ-gebied in dit contract worden via de statische declarant GLI-ZHZ-CZ gedeclareerd.",
  "Zuid Holland Zuid - VGZ": "CoOL via zorgverzekeraar voor GLI-ZHZ-VGZ. Declaraties voor VGZ-gebied in dit contract worden via de statische declarant GLI-ZHZ-VGZ gedeclareerd."
};

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

let map;
let baseTileLayer;
let geoLayer;
let overlapOutlineLayer;
let allFeatures = [];
let currentFilter = "ALL";
let currentGemeente = "";
let currentZorgverzekeraar = "ALL";
let currentDeclaratiestroom = "ALL";
let gemeenteFeaturesStore = [];
let messageTimer;
let postcodePanelRequestId = 0;
const gemeentePostcodeCache = new Map();
const zorggroepPostcodeRangeCache = new Map();
const customSelectObservers = new Map();

function createMap() {
  if (map) {
    return;
  }
  map = L.map("map").setView([52.1, 5.3], 8);
  applyMapTheme();

  // Clicking the map background clears polygon selection and shows full result set again.
  map.on("click", () => {
    if (currentFilter === "ALL") {
      return;
    }
    currentFilter = "ALL";
    const filterSelect = document.getElementById("zorggroepFilter");
    if (filterSelect) {
      filterSelect.value = "ALL";
    }
    setPostcodePanelState("Klik op een zorggroep op de kaart om postcodes te laden.", []);
    applyActiveFilters();
  });
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

  const dark = isDarkModeActive();
  baseTileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
    className: dark ? "map-tiles-dark" : "map-tiles-light"
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
    toggleIcon.textContent = nextMode === "dark" ? "🌙" : "☀";
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
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  const preferred = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(saved || preferred);

  if (toggle && !toggle.dataset.themeBound) {
    toggle.dataset.themeBound = "1";
    toggle.addEventListener("click", () => {
      setTheme(isDarkModeActive() ? "light" : "dark");
    });
  }
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
  initThemeToggle();
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

function normalizeFacturatiestroom(value, feature = null, insurerName = "") {
  const raw = String(value || "").trim() || "Onbekend";
  const rawNorm = normalizeText(raw);
  const zorggroepNorm = normalizeText(getZorggroepName(feature));
  const insurerNorm = normalizeText(insurerName);

  if (Object.values(FACTURATIESTROMEN).includes(raw)) {
    return raw;
  }

  if (rawNorm === "declaratiestromen per zorgverzekeraar") {
    if (zorggroepNorm.includes("gezondheid amsterdam")) {
      return FACTURATIESTROMEN.STROOM_4;
    }
    return DECLARATIE_PER_VERZEKERAAR_OUTPUT[insurerNorm] || "Onbekend";
  }

  if (rawNorm === "vecozo") {
    return FACTURATIESTROMEN.STROOM_2;
  }
  if (rawNorm.includes("losse facturen")) {
    return FACTURATIESTROMEN.STROOM_3;
  }
  if (rawNorm.includes("zohealthy")) {
    return FACTURATIESTROMEN.STROOM_5;
  }
  if (rawNorm.includes("gezondheid amsterdam") || rawNorm === "ga") {
    return FACTURATIESTROMEN.STROOM_4;
  }

  if (["viplive", "boards", "cboards", "medix", "nis", "kysios", "monter", "evry"].some((token) => rawNorm.includes(token))) {
    return FACTURATIESTROMEN.STROOM_1;
  }
  if (rawNorm.includes("op factuur achteraf") || rawNorm.includes("extern monter")) {
    return FACTURATIESTROMEN.STROOM_1;
  }

  return raw;
}

function resolveFacturatiemoduleName(rawStroom, feature, insurerName = "") {
  const raw = String(rawStroom || "").trim() || "Onbekend";
  const rawNorm = normalizeText(raw);
  const insurerNorm = normalizeText(insurerName);
  const zorggroepNorm = normalizeText(getZorggroepName(feature));

  if (FACTURATIEMODULE_TEMPLATES[raw]) {
    return raw;
  }

  if (raw === FACTURATIESTROMEN.STROOM_1) {
    return "Zorggroep";
  }
  if (raw === FACTURATIESTROMEN.STROOM_2) {
    if (zorggroepNorm.includes("gezondheid amsterdam")) {
      return "Gezondheid Amsterdam (GA)";
    }
    return insurerNorm === "vgz" ? "MiGuide - VGZ" : "MiGuide";
  }
  if (raw === FACTURATIESTROMEN.STROOM_3) {
    return "ZoHealthy";
  }
  if (raw === FACTURATIESTROMEN.STROOM_4) {
    return "Gezondheid Amsterdam (GA)";
  }
  if (raw === FACTURATIESTROMEN.STROOM_5) {
    return "ZoHealthy";
  }

  if (zorggroepNorm === "zuid holland zuid" && insurerNorm === "cz") {
    return "Zuid Holland Zuid - CZ";
  }
  if (zorggroepNorm === "zuid holland zuid" && insurerNorm === "vgz") {
    return "Zuid Holland Zuid - VGZ";
  }

  if (rawNorm === "declaratiestromen per zorgverzekeraar") {
    if (zorggroepNorm.includes("gezondheid amsterdam")) {
      return "Gezondheid Amsterdam (GA)";
    }
    if (insurerNorm === "vgz") {
      return "MiGuide - VGZ";
    }
    if (["aevitae eucare", "cz", "dsw", "salland", "zorg zekerheid"].includes(insurerNorm)) {
      return "ZoHealthy";
    }
    if (insurerNorm) {
      return "MiGuide";
    }
  }

  if (rawNorm === "vecozo") {
    if (zorggroepNorm.includes("gezondheid amsterdam")) {
      return "Gezondheid Amsterdam (GA)";
    }
    if (insurerNorm === "vgz") {
      return "MiGuide - VGZ";
    }
    return "MiGuide";
  }

  if (rawNorm.includes("zohealthy")) {
    return "ZoHealthy";
  }

  if (["viplive", "boards", "evry", "medix"].some((token) => rawNorm.includes(token))) {
    return "Zorggroep";
  }
  if (rawNorm.includes("monter")) {
    return "Zorggroep";
  }
  if (rawNorm.includes("op factuur achteraf")) {
    return "CoOL via zorggroep";
  }

  return raw;
}

function getFacturatiemoduleDescription(moduleName) {
  return FACTURATIEMODULE_TEMPLATES[moduleName] || "";
}

function updateFacturatiemoduleContext() {
  const box = document.getElementById("facturatiemoduleContext");
  if (!box) {
    return;
  }
  if (currentDeclaratiestroom === "ALL") {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }

  const representativeFeature = allFeatures.find((feature) => {
    if (currentFilter !== "ALL" && getZorggroepName(feature) !== currentFilter) {
      return false;
    }
    return featureMatchesInsurer(feature, currentZorgverzekeraar);
  }) || allFeatures[0];

  const stroomDescription = FACTURATIESTROOM_CONTEXT[currentDeclaratiestroom] || "";
  const moduleName = resolveFacturatiemoduleName(currentDeclaratiestroom, representativeFeature, currentZorgverzekeraar);
  const moduleDescription = getFacturatiemoduleDescription(moduleName);

  box.innerHTML = `
    <strong>${currentDeclaratiestroom}</strong>
    ${stroomDescription || "Geen samenvatting beschikbaar."}
    <div style="margin-top:6px;"><strong>Module:</strong> ${moduleName}</div>
    <div>${moduleDescription || "Geen modulebeschrijving beschikbaar."}</div>
  `;
  box.hidden = false;
}

function normalizeContractValue(value) {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  if (["ja", "yes", "true", "gecontracteerd"].includes(normalized)) {
    return true;
  }
  if (["nee", "no", "false", "ongecontracteerd"].includes(normalized)) {
    return false;
  }
  return null;
}

function fallbackDeclaratiestroomForFeature(feature, insurerName = "") {
  const zorggroep = getZorggroepName(feature);
  const normalized = normalizeText(zorggroep);
  const raw = ZORGGROEP_DECLARATIESTROOM_FALLBACK[normalized] || "Onbekend";
  if (normalizeText(raw) !== "declaratiestromen per zorgverzekeraar") {
    return normalizeFacturatiestroom(raw, feature, insurerName);
  }

  const insurerKey = normalizeText(insurerName);
  if (!insurerKey || insurerKey === "all") {
    return raw;
  }

  return DECLARATIE_PER_VERZEKERAAR_OUTPUT[insurerKey] || "Onbekend";
}

function extractContracts(item) {
  const collections = [
    item?.contracten,
    item?.contracts,
    item?.zorgverzekeraars,
    item?.zorgverzekeraar_contracten,
    item?.verzekeraars
  ];

  const flattened = [];
  for (const collection of collections) {
    if (!Array.isArray(collection)) {
      continue;
    }
    flattened.push(...collection);
  }

  const rows = [];
  const dedupe = new Set();
  for (const row of flattened) {
    if (!row) {
      continue;
    }

    const zorgverzekeraar = typeof row === "string"
      ? row
      : (row.zorgverzekeraar || row.verzekeraar || row.insurer || "");

    if (!zorgverzekeraar) {
      continue;
    }

    const declaratiestroomRaw = typeof row === "string"
      ? "Onbekend"
      : (row.declaratiestroom || row.declaratie_stroom || row.stroom || "Onbekend");
    const declaratiestroom = normalizeFacturatiestroom(declaratiestroomRaw, null, zorgverzekeraar);

    const contractValue = typeof row === "string"
      ? null
      : normalizeContractValue(row.contract ?? row.gecontracteerd ?? row.status);

    const key = `${normalizeText(zorgverzekeraar)}|${normalizeText(declaratiestroom)}`;
    if (dedupe.has(key)) {
      continue;
    }
    dedupe.add(key);

    rows.push({
      zorgverzekeraar,
      declaratiestroom,
      contract: contractValue
    });
  }

  return rows;
}

function extractContractsByZorggroep(rootData) {
  const map = new Map();
  const collections = [
    rootData?.contracten,
    rootData?.contracts,
    rootData?.zorggroep_contracten,
    rootData?.contract_matrix
  ];

  for (const collection of collections) {
    if (!Array.isArray(collection)) {
      continue;
    }

    for (const row of collection) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const zorggroep = row.zorggroep || row.zorggroep_naam || row.domain || "";
      const zorgverzekeraar = row.zorgverzekeraar || row.verzekeraar || row.insurer || "";
      if (!zorggroep || !zorgverzekeraar) {
        continue;
      }

      const key = normalizeText(zorggroep);
      const existing = map.get(key) || [];
      existing.push({
        zorgverzekeraar,
        declaratiestroom: normalizeFacturatiestroom(
          row.declaratiestroom || row.declaratie_stroom || row.stroom || "Onbekend",
          { properties: { zorggroep } },
          zorgverzekeraar
        ),
        contract: normalizeContractValue(row.contract ?? row.gecontracteerd ?? row.status)
      });
      map.set(key, existing);
    }
  }

  return map;
}

function contractsForInsurer(feature, insurerName) {
  const contracts = Array.isArray(feature?.properties?.contracts) ? feature.properties.contracts : [];
  const target = normalizeText(insurerName);
  return contracts.filter((row) => normalizeText(row.zorgverzekeraar) === target);
}

function featureMatchesInsurer(feature, insurerName) {
  if (insurerName === "ALL") {
    return true;
  }

  const rows = contractsForInsurer(feature, insurerName);
  if (rows.length === 0) {
    return true;
  }

  return rows.some((row) => row.contract !== false);
}

function featureMatchesDeclaratiestroom(feature, insurerName, declaratiestroom) {
  if (declaratiestroom === "ALL") {
    return true;
  }
  if (insurerName === "ALL") {
    return true;
  }

  const rows = contractsForInsurer(feature, insurerName);
  if (rows.length === 0) {
    const fallback = fallbackDeclaratiestroomForFeature(feature, insurerName);
    return normalizeText(fallback) === normalizeText(declaratiestroom);
  }

  const target = normalizeText(declaratiestroom);
  return rows.some((row) => normalizeText(row.declaratiestroom) === target && row.contract !== false);
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
    dashArray: null,
    fillOpacity: 0.45,
    fillColor: colorFromString(getZorggroepName(feature))
  };
}

function highlightFeature(e) {
  const layer = e.target;
  layer.setStyle({
    weight: 3,
    color: "#0f172a",
    dashArray: null,
    fillOpacity: 0.65
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
  const overlapGemeenten = Array.isArray(props.overlapGemeenten) ? props.overlapGemeenten : [];
  const contracts = Array.isArray(props.contracts) ? props.contracts : [];
  const websiteRow = website
    ? `<div><a href="${website}" target="_blank" rel="noopener noreferrer">${website}</a></div>`
    : "<div>Geen website</div>";

  let contractRow = "<div>Contract: Onbekend</div>";
  let moduleRow = "";
  if (currentZorgverzekeraar !== "ALL") {
    const insurerRows = contractsForInsurer(feature, currentZorgverzekeraar);
    if (insurerRows.length > 0) {
      const yesRow = insurerRows.find((row) => row.contract !== false);
      if (yesRow) {
        const stroomName = normalizeFacturatiestroom(yesRow.declaratiestroom || "Onbekend", feature, currentZorgverzekeraar);
        const moduleName = resolveFacturatiemoduleName(stroomName, feature, currentZorgverzekeraar);
        contractRow = `<div>Contract ${currentZorgverzekeraar}: Ja</div>`;
        moduleRow = `<div>Facturatiestroom: ${stroomName}</div><div>Module: ${moduleName}</div>`;
      } else {
        contractRow = `<div>Contract ${currentZorgverzekeraar}: Nee</div>`;
      }
    } else {
      const stroomName = fallbackDeclaratiestroomForFeature(feature, currentZorgverzekeraar);
      const moduleName = resolveFacturatiemoduleName(stroomName, feature, currentZorgverzekeraar);
      moduleRow = `<div>Facturatiestroom: ${stroomName}</div><div>Module: ${moduleName}</div>`;
      contractRow = "<div>Contract: Onbekend</div>";
    }
  } else if (contracts.length > 0) {
    const contractedCount = contracts.filter((row) => row.contract !== false).length;
    contractRow = `<div>Contractregels: ${contractedCount}</div>`;
  }

  return `
    <div>
      <strong>${zorggroep}</strong>
      <div>Regio: ${regio}</div>
      <div>Gemeenten: ${gemeenten.length}</div>
      ${overlapGemeenten.length ? `<div style="color:#dc2626;"><strong>Overlap:</strong> ${overlapGemeenten.join(", ")}</div>` : ""}
      ${contractRow}
      ${moduleRow}
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

      refreshDependentFilters();
      applyActiveFilters();
      loadPostcodesForFeature(feature);
    }
  });

  const overlapGemeenten = Array.isArray(feature?.properties?.overlapGemeenten) ? feature.properties.overlapGemeenten : [];
  const tooltipText = overlapGemeenten.length
    ? `${getZorggroepName(feature)}<br><small>Overlap: ${overlapGemeenten.join(", ")}</small>`
    : getZorggroepName(feature);
  layer.bindTooltip(tooltipText, { sticky: true });
  layer.bindPopup(popupContent(feature));
}

function annotateOverlappingGemeenten(features) {
  const gemeenteOwners = new Map();

  for (const feature of features) {
    const zorggroep = getZorggroepName(feature);
    const gemeenten = Array.isArray(feature?.properties?.gemeenten) ? feature.properties.gemeenten : [];
    for (const gemeente of gemeenten) {
      const key = normalizeText(gemeente);
      if (!key) {
        continue;
      }
      const owners = gemeenteOwners.get(key) || { name: gemeente, zorggroepen: new Set() };
      owners.zorggroepen.add(zorggroep);
      gemeenteOwners.set(key, owners);
    }
  }

  for (const feature of features) {
    const gemeenten = Array.isArray(feature?.properties?.gemeenten) ? feature.properties.gemeenten : [];
    const overlapGemeenten = gemeenten.filter((gemeente) => {
      const owners = gemeenteOwners.get(normalizeText(gemeente));
      return owners && owners.zorggroepen.size > 1;
    });
    feature.properties.overlapGemeenten = overlapGemeenten;
  }
}

function renderLayer(features, options = {}) {
  const { useNetherlandsDefaultView = false } = options;

  if (geoLayer) {
    map.removeLayer(geoLayer);
  }
  if (overlapOutlineLayer) {
    map.removeLayer(overlapOutlineLayer);
    overlapOutlineLayer = null;
  }

  geoLayer = L.geoJSON(features, {
    style,
    onEachFeature
  }).addTo(map);

  renderOverlapOutlines(features);

  if (geoLayer.getLayers().length > 0) {
    if (useNetherlandsDefaultView) {
      map.setView(NL_DEFAULT_CENTER, NL_DEFAULT_ZOOM);
    } else {
      map.fitBounds(geoLayer.getBounds(), { padding: [16, 16] });
    }
  }
}

function renderOverlapOutlines(features) {
  if (!map || !Array.isArray(features) || features.length === 0 || !Array.isArray(gemeenteFeaturesStore) || gemeenteFeaturesStore.length === 0) {
    return;
  }

  const overlappingNames = new Set();
  for (const feature of features) {
    const overlapGemeenten = Array.isArray(feature?.properties?.overlapGemeenten) ? feature.properties.overlapGemeenten : [];
    for (const gemeente of overlapGemeenten) {
      const key = normalizeText(gemeente);
      if (key) {
        overlappingNames.add(key);
      }
    }
  }

  if (overlappingNames.size === 0) {
    return;
  }

  const overlapGemeenteFeatures = gemeenteFeaturesStore.filter((gemeenteFeature) => {
    const naam = gemeenteFeature?.properties?.naam;
    return overlappingNames.has(normalizeText(naam));
  });

  if (overlapGemeenteFeatures.length === 0) {
    return;
  }

  overlapOutlineLayer = L.geoJSON(overlapGemeenteFeatures, {
    interactive: false,
    style: {
      color: "#dc2626",
      weight: 4,
      opacity: 0.9,
      fillOpacity: 0
    }
  }).addTo(map);
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

function closeAllCustomSelectMenus(exceptSelectId = "") {
  document.querySelectorAll("[data-custom-select]").forEach((root) => {
    const selectId = root.getAttribute("data-custom-select") || "";
    if (exceptSelectId && selectId === exceptSelectId) {
      return;
    }
    const menu = root.querySelector("[data-custom-select-menu]");
    if (menu) {
      menu.hidden = true;
    }
  });
}

function renderCustomSelect(select) {
  if (!select) {
    return;
  }
  const root = document.querySelector(`[data-custom-select="${select.id}"]`);
  if (!root) {
    return;
  }

  const button = root.querySelector("[data-custom-select-button]");
  const label = root.querySelector("[data-custom-select-label]");
  const menu = root.querySelector("[data-custom-select-menu]");
  if (!button || !label || !menu) {
    return;
  }

  const selectedOption = select.options[select.selectedIndex] || select.options[0];
  label.textContent = selectedOption ? selectedOption.textContent : "";

  button.disabled = !!select.disabled;
  button.classList.toggle("opacity-50", !!select.disabled);
  button.classList.toggle("cursor-not-allowed", !!select.disabled);

  menu.innerHTML = "";
  [...select.options].forEach((opt) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "block w-full rounded px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:text-slate-900 focus:outline-none dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white dark:focus:bg-slate-800 dark:focus:text-white";
    item.textContent = opt.textContent;
    item.disabled = !!opt.disabled;
    item.dataset.value = opt.value;
    if (opt.value === select.value) {
      item.classList.add("bg-slate-100", "text-slate-900", "dark:bg-slate-800", "dark:text-white");
    }
    item.addEventListener("click", () => {
      if (select.disabled || opt.disabled) {
        return;
      }
      if (select.value !== opt.value) {
        select.value = opt.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        renderCustomSelect(select);
      }
      menu.hidden = true;
    });
    menu.appendChild(item);
  });

  if (!menu.children.length) {
    const empty = document.createElement("div");
    empty.className = "px-3 py-2 text-sm text-slate-400 dark:text-slate-500";
    empty.textContent = "Geen opties";
    menu.appendChild(empty);
  }
}

function initCustomSelect(selectId) {
  const select = document.getElementById(selectId);
  const root = document.querySelector(`[data-custom-select="${selectId}"]`);
  if (!select || !root) {
    return;
  }
  const button = root.querySelector("[data-custom-select-button]");
  const menu = root.querySelector("[data-custom-select-menu]");
  if (!button || !menu) {
    return;
  }

  if (!root.dataset.customSelectBound) {
    root.dataset.customSelectBound = "1";

    menu.hidden = true;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (select.disabled) {
        return;
      }
      const willOpen = menu.hidden;
      closeAllCustomSelectMenus(selectId);
      menu.hidden = !willOpen;
      if (!menu.hidden) {
        renderCustomSelect(select);
      }
    });

    select.addEventListener("change", () => {
      renderCustomSelect(select);
    });

    const observer = new MutationObserver(() => renderCustomSelect(select));
    observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "selected"] });
    customSelectObservers.set(selectId, observer);
  }

  renderCustomSelect(select);
}

function initAllCustomSelects() {
  ["zorgverzekeraarFilter", "zorggroepFilter", "declaratiestroomFilter"].forEach(initCustomSelect);
}

function setPostcodePanelState(metaText, items = []) {
  const metaEl = document.getElementById("postcodeListMeta");
  const listEl = document.getElementById("postcodeList");
  if (!metaEl || !listEl) {
    return;
  }
  metaEl.textContent = metaText || "";
  listEl.innerHTML = items.length
    ? items.map((item) => `<li>${item}</li>`).join("")
    : "<li>Geen postcodes geladen</li>";
}

function geometryBounds4326(geometry) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function walk(coords) {
    if (!Array.isArray(coords)) {
      return;
    }
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      minX = Math.min(minX, coords[0]);
      minY = Math.min(minY, coords[1]);
      maxX = Math.max(maxX, coords[0]);
      maxY = Math.max(maxY, coords[1]);
      return;
    }
    for (const part of coords) {
      walk(part);
    }
  }

  walk(geometry?.coordinates);
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    return null;
  }
  return [minX, minY, maxX, maxY];
}

async function queryPostcodesByBbox(bbox, maxFeatures = 4000) {
  // WFS 1.1.0 with EPSG:4326 expects axis order lat,lon in BBOX.
  const bboxWfs11Epsg4326 = `${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]},EPSG:4326`;
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typeName: "postcode6:postcode6",
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    propertyName: "postcode6",
    maxFeatures: String(maxFeatures),
    bbox: bboxWfs11Epsg4326
  });

  const response = await fetch(`${PDOK_POSTCODE_WFS_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Postcode bbox lookup mislukt (${response.status})`);
  }
  const data = await response.json();
  return Array.isArray(data.features) ? data.features : [];
}

function summarizePostcodeRange(postcodes) {
  const pc6List = [...new Set((postcodes || []).filter(Boolean).map((v) => String(v).toUpperCase()))]
    .sort((a, b) => a.localeCompare(b, "nl"));
  const pc4List = [...new Set(pc6List.map((pc6) => pc6.slice(0, 4)).filter((pc4) => formatPostcode4(pc4)))]
    .sort((a, b) => a.localeCompare(b, "nl"));

  return {
    pc4Count: pc4List.length,
    pc6Count: pc6List.length,
    pc4Start: pc4List[0] || null,
    pc4End: pc4List[pc4List.length - 1] || null,
    pc6Start: pc6List[0] || null,
    pc6End: pc6List[pc6List.length - 1] || null
  };
}

function formatCompactRangeLine(summary) {
  if (!summary) {
    return null;
  }
  if (summary.pc4Start && summary.pc4End) {
    return `${summary.pc4Start} t/m ${summary.pc4End}`;
  }
  if (summary.pc6Start && summary.pc6End) {
    return `${summary.pc6Start} t/m ${summary.pc6End}`;
  }
  return null;
}

async function fetchPostcodesForGemeente(gemeenteNaam) {
  const key = normalizeText(gemeenteNaam);
  if (!key) {
    return { postcode4: [], postcode6: [] };
  }
  if (gemeentePostcodeCache.has(key)) {
    return gemeentePostcodeCache.get(key);
  }

  const gemeenteFeature = gemeenteFeaturesStore.find((f) => normalizeText(f?.properties?.naam) === key);
  if (!gemeenteFeature) {
    const empty = { postcode4: [], postcode6: [] };
    gemeentePostcodeCache.set(key, empty);
    return empty;
  }

  const bbox = geometryBounds4326(gemeenteFeature.geometry);
  if (!bbox) {
    const empty = { postcode4: [], postcode6: [] };
    gemeentePostcodeCache.set(key, empty);
    return empty;
  }

  const wfsFeatures = await queryPostcodesByBbox(bbox);
  const pc4Set = new Set();
  const pc6Set = new Set();

  for (const feature of wfsFeatures) {
    const code = feature?.properties?.postcode6;
    const fbbox = feature?.bbox;
    if (!code || !Array.isArray(fbbox) || fbbox.length < 4) {
      continue;
    }
    const center = [(fbbox[0] + fbbox[2]) / 2, (fbbox[1] + fbbox[3]) / 2];
    const ownerGemeente = municipalityForPoint(center);
    if (normalizeText(ownerGemeente) !== key) {
      continue;
    }
    pc6Set.add(code);
    const pc4 = String(code).slice(0, 4);
    if (formatPostcode4(pc4)) {
      pc4Set.add(pc4);
    }
  }

  const result = {
    postcode4: [...pc4Set].sort((a, b) => a.localeCompare(b, "nl")),
    postcode6: [...pc6Set].sort((a, b) => a.localeCompare(b, "nl"))
  };
  gemeentePostcodeCache.set(key, result);
  return result;
}

async function loadPostcodesForFeature(feature) {
  const requestId = ++postcodePanelRequestId;
  const zorggroep = getZorggroepName(feature);
  const gemeenten = Array.isArray(feature?.properties?.gemeenten) ? feature.properties.gemeenten : [];

  if (!gemeenten.length) {
    setPostcodePanelState(`Geen gemeenten gevonden voor ${zorggroep}.`, []);
    return;
  }

  setPostcodePanelState(`Postcodes laden voor ${zorggroep}...`, ["Laden..."]);

  try {
    const cacheKey = normalizeText(zorggroep);
    let summary = zorggroepPostcodeRangeCache.get(cacheKey);
    let truncated = false;

    if (!summary) {
      const bbox = geometryBounds4326(feature?.geometry);
      if (!bbox) {
        setPostcodePanelState(`Geen geldige kaart-omtrek gevonden voor ${zorggroep}.`, []);
        return;
      }
      const wfsFeatures = await queryPostcodesByBbox(bbox, 2500);
      if (requestId !== postcodePanelRequestId) {
        return;
      }
      const postcodes = wfsFeatures
        .map((f) => f?.properties?.postcode6)
        .filter(Boolean);
      summary = summarizePostcodeRange(postcodes);
      truncated = wfsFeatures.length >= 2500;
      zorggroepPostcodeRangeCache.set(cacheKey, { summary, truncated });
    } else {
      truncated = Boolean(summary.truncated);
      summary = summary.summary;
    }

    if (requestId !== postcodePanelRequestId) {
      return;
    }

    const compactRange = formatCompactRangeLine(summary);
    const items = compactRange ? [compactRange] : ["Geen postcode-range gevonden"];
    if (truncated) {
      items.push("Let op: range is indicatief (PDOK querylimiet bereikt).");
    }

    setPostcodePanelState(
      `${zorggroep}: postcode-range${truncated ? " (snelle indicatie)" : ""}`,
      items
    );
  } catch (error) {
    console.error(error);
    if (requestId !== postcodePanelRequestId) {
      return;
    }
    setPostcodePanelState(`Postcodes laden mislukt voor ${zorggroep}.`, []);
  }
}

function applyActiveFilters() {
  let filtered = allFeatures;

  if (currentZorgverzekeraar !== "ALL") {
    filtered = filtered.filter((feature) => featureMatchesInsurer(feature, currentZorgverzekeraar));
  }

  if (currentDeclaratiestroom !== "ALL") {
    filtered = filtered.filter((feature) => featureMatchesDeclaratiestroom(feature, currentZorgverzekeraar, currentDeclaratiestroom));
  }

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
  const broadOverview = currentFilter === "ALL" && !currentGemeente;
  renderLayer(filtered, { useNetherlandsDefaultView: broadOverview });
}

function featuresScopedForOptionLists() {
  let scoped = allFeatures;

  if (currentGemeente) {
    const target = normalizeText(currentGemeente);
    scoped = scoped.filter((feature) => {
      const gemeenten = Array.isArray(feature?.properties?.gemeenten) ? feature.properties.gemeenten : [];
      const cities = Array.isArray(feature?.properties?.cities) ? feature.properties.cities : [];
      return gemeenten.some((name) => normalizeText(name) === target)
        || cities.some((name) => normalizeText(name) === target);
    });
  }

  if (currentZorgverzekeraar !== "ALL") {
    scoped = scoped.filter((feature) => featureMatchesInsurer(feature, currentZorgverzekeraar));
  }

  if (currentDeclaratiestroom !== "ALL") {
    scoped = scoped.filter((feature) => featureMatchesDeclaratiestroom(feature, currentZorgverzekeraar, currentDeclaratiestroom));
  }

  return scoped;
}

function populateZorggroepOptions(features) {
  const select = document.getElementById("zorggroepFilter");
  const selectedBefore = currentFilter;
  const zorggroepen = [...new Set(features.map(getZorggroepName))].sort((a, b) => a.localeCompare(b, "nl"));

  select.innerHTML = '<option value="ALL">Alle zorggroepen</option>';
  for (const zorggroep of zorggroepen) {
    const option = document.createElement("option");
    option.value = zorggroep;
    option.textContent = zorggroep;
    select.appendChild(option);
  }

  if (selectedBefore !== "ALL" && zorggroepen.includes(selectedBefore)) {
    select.value = selectedBefore;
  } else {
    currentFilter = "ALL";
    select.value = "ALL";
  }
}

function populateDeclaratiestroomOptions(features) {
  const select = document.getElementById("declaratiestroomFilter");
  const selectedBefore = currentDeclaratiestroom;
  const allStromen = new Set();
  const canUseDeclaratiestroom = currentZorgverzekeraar !== "ALL";

  if (canUseDeclaratiestroom) {
    for (const feature of features) {
      const rows = contractsForInsurer(feature, currentZorgverzekeraar);
      if (rows.length === 0) {
        allStromen.add(fallbackDeclaratiestroomForFeature(feature, currentZorgverzekeraar));
        continue;
      }
      for (const row of rows) {
        if (row.contract === false) {
          continue;
        }
        allStromen.add(row.declaratiestroom || fallbackDeclaratiestroomForFeature(feature, currentZorgverzekeraar));
      }
    }
  }

  const sorted = [...allStromen].sort((a, b) => a.localeCompare(b, "nl"));
  select.innerHTML = '<option value="ALL">Alle facturatiestromen</option>';
  for (const stroom of sorted) {
    const option = document.createElement("option");
    option.value = stroom;
    const representative = features.find((feature) => {
      const rows = contractsForInsurer(feature, currentZorgverzekeraar);
      return rows.some((row) => (row.declaratiestroom || fallbackDeclaratiestroomForFeature(feature, currentZorgverzekeraar)) === stroom)
        || fallbackDeclaratiestroomForFeature(feature, currentZorgverzekeraar) === stroom;
    }) || features[0];
    const moduleName = resolveFacturatiemoduleName(stroom, representative, currentZorgverzekeraar);
    option.textContent = moduleName;
    const desc = getFacturatiemoduleDescription(moduleName);
    if (desc) {
      option.title = desc;
    }
    select.appendChild(option);
  }

  if (selectedBefore !== "ALL" && sorted.includes(selectedBefore)) {
    select.value = selectedBefore;
  } else {
    currentDeclaratiestroom = "ALL";
    select.value = "ALL";
  }

  select.disabled = !canUseDeclaratiestroom;
}

function refreshDependentFilters() {
  const scoped = featuresScopedForOptionLists();
  populateZorggroepOptions(scoped);
  populateDeclaratiestroomOptions(scoped);
  autoSelectSingleDependentOptions(scoped);
  initAllCustomSelects();
  updateFacturatiemoduleContext();
}

function autoSelectSingleDependentOptions(scopedFeatures) {
  if (!currentGemeente || currentZorgverzekeraar === "ALL") {
    return;
  }

  const zorggroepSelect = document.getElementById("zorggroepFilter");
  const declaratieSelect = document.getElementById("declaratiestroomFilter");
  if (!zorggroepSelect || !declaratieSelect) {
    return;
  }

  const availableZorggroepen = [...new Set(scopedFeatures.map(getZorggroepName))];
  if (currentFilter === "ALL" && availableZorggroepen.length === 1) {
    currentFilter = availableZorggroepen[0];
    zorggroepSelect.value = currentFilter;
  }

  let declaratieScope = scopedFeatures;
  if (currentFilter !== "ALL") {
    declaratieScope = declaratieScope.filter((feature) => getZorggroepName(feature) === currentFilter);
  }

  const availableStromen = new Set();
  for (const feature of declaratieScope) {
    const rows = contractsForInsurer(feature, currentZorgverzekeraar);
    if (rows.length === 0) {
      availableStromen.add(fallbackDeclaratiestroomForFeature(feature, currentZorgverzekeraar));
      continue;
    }
    for (const row of rows) {
      if (row.contract === false) {
        continue;
      }
      availableStromen.add(row.declaratiestroom || fallbackDeclaratiestroomForFeature(feature, currentZorgverzekeraar));
    }
  }

  const uniqueStromen = [...availableStromen];
  if (currentDeclaratiestroom === "ALL" && uniqueStromen.length === 1) {
    currentDeclaratiestroom = uniqueStromen[0];
    declaratieSelect.value = currentDeclaratiestroom;
  }
}

function setupFilterControls() {
  const zorggroepSelect = document.getElementById("zorggroepFilter");
  const verzekeraarSelect = document.getElementById("zorgverzekeraarFilter");
  const declaratieSelect = document.getElementById("declaratiestroomFilter");

  const insurers = new Set(DEFAULT_ZORGVERZEKERAARS);
  for (const feature of allFeatures) {
    const contracts = Array.isArray(feature?.properties?.contracts) ? feature.properties.contracts : [];
    for (const row of contracts) {
      if (row.zorgverzekeraar) {
        insurers.add(row.zorgverzekeraar);
      }
    }
  }

  const sortedInsurers = [...insurers].sort((a, b) => a.localeCompare(b, "nl"));
  verzekeraarSelect.innerHTML = '<option value="ALL">Alle zorgverzekeraars</option>';
  for (const insurer of sortedInsurers) {
    const option = document.createElement("option");
    option.value = insurer;
    option.textContent = insurer;
    verzekeraarSelect.appendChild(option);
  }

  verzekeraarSelect.addEventListener("change", (event) => {
    currentZorgverzekeraar = event.target.value;
    currentFilter = "ALL";
    currentDeclaratiestroom = "ALL";
    refreshDependentFilters();
    applyActiveFilters();

    const hasMatches = allFeatures.some((feature) => featureMatchesInsurer(feature, currentZorgverzekeraar));
    if (currentZorgverzekeraar !== "ALL" && !hasMatches) {
      showStatus(`Geen zorggroepen gevonden voor ${currentZorgverzekeraar}.`);
    } else {
      showStatus("");
    }
  });

  zorggroepSelect.addEventListener("change", (event) => {
    currentFilter = event.target.value;
    if (currentFilter === "ALL") {
      setPostcodePanelState("Klik op een zorggroep op de kaart om postcodes te laden.", []);
    }
    applyActiveFilters();
  });

  declaratieSelect.addEventListener("change", (event) => {
    currentDeclaratiestroom = event.target.value;
    refreshDependentFilters();
    applyActiveFilters();
  });

  refreshDependentFilters();
  initAllCustomSelects();
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
  const zoekButton = document.getElementById("zoekButton");
  const resetButton = document.getElementById("resetButton");
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
    refreshDependentFilters();
    applyActiveFilters();
  }

  function renderSuggestions(query) {
    const q = normalizeText(query);
    if (!q) {
      hideSuggestions();
      currentGemeente = "";
      refreshDependentFilters();
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

  async function executeSearch() {
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
          refreshDependentFilters();
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
          refreshDependentFilters();
          applyActiveFilters();
          showStatus(`Postcode ${normalizedInput} valt niet binnen een zorggroep domein in je lijst.`);
          return;
        }

        currentGemeente = gemeenteNaam;
        input.value = normalizedInput;
        refreshDependentFilters();
        applyActiveFilters();
        if (Array.isArray(result.postcodes) && result.postcodes.length) {
          const range = summarizePostcodeRange(result.postcodes);
          const compactRange = formatCompactRangeLine(range);
          setPostcodePanelState(
            `Postcodezoekresultaat ${normalizedInput} (${gemeenteNaam})`,
            compactRange ? [compactRange] : ["Geen postcode-range gevonden"]
          );
        }
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
      refreshDependentFilters();
      applyActiveFilters();
      setPostcodePanelState("Klik op een zorggroep op de kaart om postcodes te laden.", []);
    } else {
      currentGemeente = input.value.trim();
      refreshDependentFilters();
      applyActiveFilters();
    }
  }

  input.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await executeSearch();
    }
    if (event.key === "Escape") {
      hideSuggestions();
    }
  });

  if (zoekButton) {
    zoekButton.addEventListener("click", async () => {
      await executeSearch();
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      currentGemeente = "";
      currentZorgverzekeraar = "ALL";
      currentFilter = "ALL";
      currentDeclaratiestroom = "ALL";

      input.value = "";
      hideSuggestions();
      showStatus("");

      const verzekeraarSelect = document.getElementById("zorgverzekeraarFilter");
      const zorggroepSelect = document.getElementById("zorggroepFilter");
      const declaratieSelect = document.getElementById("declaratiestroomFilter");
      if (verzekeraarSelect) {
        verzekeraarSelect.value = "ALL";
      }
      if (zorggroepSelect) {
        zorggroepSelect.value = "ALL";
      }
      if (declaratieSelect) {
        declaratieSelect.value = "ALL";
      }

      refreshDependentFilters();
      applyActiveFilters();
      setPostcodePanelState("Klik op een zorggroep op de kaart om postcodes te laden.", []);
    });
  }

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

function buildZorggroepFeatures(zorggroepen, gemeenteFeatures, contractsByZorggroep = new Map()) {
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

    const zorggroepName = item.zorggroep || "Onbekend";
    const inlineContracts = extractContracts(item);
    const rootContracts = contractsByZorggroep.get(normalizeText(zorggroepName)) || [];
    const contracts = [];
    const seenContract = new Set();
    for (const row of [...inlineContracts, ...rootContracts]) {
      const key = `${normalizeText(row.zorgverzekeraar)}|${normalizeText(row.declaratiestroom)}`;
      if (seenContract.has(key)) {
        continue;
      }
      seenContract.add(key);
      contracts.push(row);
    }

    features.push({
      type: "Feature",
      properties: {
        zorggroep: zorggroepName,
        regio: item.regio || zorggroepName || "Onbekend",
        website: item.website || "",
        cities: Array.isArray(item.cities) ? item.cities : [],
        gemeenten: matchedGemeenten,
        unmatchedCities,
        contracts
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: multiPolygonCoords
      }
    });
  }

  annotateOverlappingGemeenten(features);
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
    const contractsByZorggroep = extractContractsByZorggroep(zorggroepData);

    allFeatures = buildZorggroepFeatures(zorggroepen, gemeenteFeatures, contractsByZorggroep);
    gemeenteFeaturesStore = gemeenteFeatures;
    setupFilterControls();
    setupGemeenteSearch(allFeatures);
    setPostcodePanelState("Klik op een zorggroep op de kaart om postcodes te laden.", []);
    applyActiveFilters();
  } catch (error) {
    console.error(error);
    alert("Kon zorggroepdata of PDOK gemeentegebieden niet laden. Controleer Live Server en internetverbinding.");
  }
}

initThemeToggle();
initAuthGate();

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest("[data-custom-select]")) {
    closeAllCustomSelectMenus();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllCustomSelectMenus();
  }
});
