const AUTH_HASH = "9571debdee0b6cc98a87511ce8e3938c8b1617458c8a58335d1b2edb06811b64";
const AUTH_SESSION_KEY = "miguide_auth_ok";
const AUTH_PASSWORD_FALLBACK = "MiGuide#2026!@";
const ZORGGROEPEN_URL = "zg-data/zorggroepen.json";
const POSTCODE_OVERRIDES_URL = "zg-data/postcode_overrides.json?v=20260603-8401pa-friesland";

// Online admin-backend (Render). De publieke kaart op Vercel leest hiervandaan de
// live admin-data. Overschrijfbaar via window.MIGUIDE_ADMIN_API.
const ADMIN_ONLINE_BASE = "https://miguide-admin.onrender.com";

// Admin public API: de kaart probeert eerst de actuele data uit de admin-backend
// te laden en valt terug op het statische JSON-bestand als de backend niet draait.
const PUBLIC_API_BASE = (function resolvePublicApiBase() {
  if (typeof window !== "undefined" && window.MIGUIDE_ADMIN_API !== undefined) {
    return String(window.MIGUIDE_ADMIN_API).replace(/\/$/, "");
  }
  const loc = window.location;
  const isLocalHost = loc.hostname === "127.0.0.1" || loc.hostname === "localhost";
  if (loc.protocol === "file:") return "http://127.0.0.1:8000";
  if (loc.port === "8000") return ""; // same-origin: backend serveert de site zelf
  if (isLocalHost) return "http://127.0.0.1:8000"; // bijv. Live Server op :5500
  return ADMIN_ONLINE_BASE; // productie (Vercel): lees live van de online admin-backend
})();

// Korte timeout voor de online API: een gratis Render-service "slaapt" na inactiviteit
// (koude start ~50s). We wachten niet zo lang, maar vallen snel terug op de statische
// JSON. De afgebroken aanvraag wekt Render alsnog, dus een herlaad toont de live data.
const PUBLIC_API_TIMEOUT_MS = 4500;

function fetchWithTimeout(url, options = {}, timeoutMs = PUBLIC_API_TIMEOUT_MS) {
  if (typeof AbortController === "undefined") {
    return fetch(url, options);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}
const PUBLIC_ZORGGROEPEN_URL = `${PUBLIC_API_BASE}/api/public/zorggroepen`;
const PUBLIC_POSTCODE_OVERRIDES_URL = `${PUBLIC_API_BASE}/api/public/postcode-overrides`;

// Laatst geladen data-versie uit de admin-API (voor optionele refresh).
let currentZorggroepDataVersion = null;

// Handmatige kleuren per zorggroep (genormaliseerde naam -> hex), ingesteld via de admin.
const zorggroepColorOverrides = new Map();

function applyZorggroepColorOverrides(zorggroepen) {
  zorggroepColorOverrides.clear();
  for (const item of zorggroepen || []) {
    const name = item && item.zorggroep;
    const color = item && item.color;
    if (name && color) {
      zorggroepColorOverrides.set(normalizeText(name), String(color).trim());
    }
  }
}

async function loadZorggroepData() {
  // 1) Probeer de admin public API (actuele data, inclusief admin-wijzigingen).
  try {
    const response = await fetchWithTimeout(PUBLIC_ZORGGROEPEN_URL, { headers: { Accept: "application/json" } });
    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.zorggroepen) && data.zorggroepen.length) {
        currentZorggroepDataVersion = data.data_version || null;
        data.__source = "api";
        return data;
      }
    }
  } catch (error) {
    // Backend niet bereikbaar -> stil terugvallen op statische JSON.
  }
  // 2) Fallback: statisch JSON-bestand (werkt zonder backend, bijv. op Vercel of Live Server).
  const fallbackResponse = await fetch(ZORGGROEPEN_URL);
  if (!fallbackResponse.ok) {
    throw new Error(`zorggroepen.json laden mislukt (${fallbackResponse.status})`);
  }
  const fallbackData = await fallbackResponse.json();
  fallbackData.__source = "json";
  return fallbackData;
}

async function loadPostcodeOverrides() {
  // 1) Probeer de admin public API.
  try {
    const response = await fetchWithTimeout(PUBLIC_POSTCODE_OVERRIDES_URL, { headers: { Accept: "application/json" } });
    if (response.ok) {
      const data = await response.json();
      if (data && (data.exact_postcode6_overrides || data.postcode4_range_overrides || data.location_postcode6_overrides)) {
        return data;
      }
    }
  } catch (error) {
    // stil terugvallen op JSON
  }
  // 2) Fallback: statisch JSON-bestand.
  try {
    const fallbackResponse = await fetch(POSTCODE_OVERRIDES_URL);
    if (fallbackResponse.ok) {
      return await fallbackResponse.json();
    }
  } catch (error) {
    // geen overrides beschikbaar
  }
  return null;
}
const PDOK_GEMEENTE_ITEMS_URL = "https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/collections/gemeentegebied/items?f=json&limit=100";
const PDOK_POSTCODE_WFS_URL = "https://service.pdok.nl/cbs/postcode6/2024/wfs/v1_0";
const NL_DEFAULT_CENTER = [52.2, 5.3];
const NL_DEFAULT_ZOOM = 8;
const THEME_STORAGE_KEY = "miguide_theme";
const DEFAULT_ZORGVERZEKERAARS = [
  "a.s.r.",
  "Ik kies zelf",
  "Menzis Digitaal 2026",
  "Menzis",
  "Anderzorg",
  "VinkVink",
  "ONVZ",
  "VvAA",
  "VGZ",
  "IZA",
  "UMC Zorgverzekering",
  "Unive",
  "Zekur",
  "VGZbewuzt",
  "IZZ door VGZ",
  "Zilveren Kruis (Achmea)",
  "FBTO",
  "De Friesland",
  "Interpolis",
  "ZieZo",
  "De christelijke zorgverzekeraar",
  "Aevitae (Eucare)",
  "Aevitae",
  "Eucare",
  "Care4Life",
  "CZ",
  "Nationale-Nederlanden",
  "OHRA",
  "Just",
  "CZ direct",
  "DSW",
  "Stad Holland",
  "Salland",
  "Zorg & Zekerheid",
  "AZVZ",
  "Stichting Ziektekostenverzekering Krijgsmacht (SZVK)"
];

const FACTURATIESTROMEN = {
  STROOM_1: "Stroom 1 - Zorggroep declaraties",
  STROOM_2: "Stroom 2 - VECOZO Gecontracteerde Zorg",
  STROOM_3: "Stroom 3 - Niet gecontracteerde Zorg - Losse Facturen",
  STROOM_4: "Stroom 4 - Gezondheid Amsterdam GA",
  STROOM_5: "Stroom 5 - ZoHealthy"
};

const INSURER_LABEL_TO_CONCERN = new Map([
  ["a s r", "a s r"],
  ["asr", "a s r"],
  ["a.s.r.", "a s r"],
  ["ik kies zelf", "a s r"],
  ["menzis digitaal 2026", "menzis digitaal 2026"],
  ["menzis", "menzis digitaal 2026"],
  ["anderzorg", "menzis digitaal 2026"],
  ["vinkvink", "menzis digitaal 2026"],
  ["onvz", "onvz"],
  ["vvaa", "onvz"],
  ["vgz", "vgz"],
  ["iza", "vgz"],
  ["umc zorgverzekering", "vgz"],
  ["umc", "vgz"],
  ["unive", "vgz"],
  ["zekur", "vgz"],
  ["vgzbewuzt", "vgz"],
  ["vgz bewuzt", "vgz"],
  ["izz door vgz", "vgz"],
  ["izz", "vgz"],
  ["zilveren kruis achmea", "zilveren kruis achmea"],
  ["achmea", "zilveren kruis achmea"],
  ["zilveren kruis", "zilveren kruis achmea"],
  ["fbto", "zilveren kruis achmea"],
  ["de friesland", "zilveren kruis achmea"],
  ["interpolis", "zilveren kruis achmea"],
  ["ziezo", "zilveren kruis achmea"],
  ["de christelijke zorgverzekeraar", "zilveren kruis achmea"],
  ["aevitae eucare", "aevitae eucare"],
  ["aevitae", "aevitae eucare"],
  ["eucare", "aevitae eucare"],
  ["care4life", "aevitae eucare"],
  ["cz", "cz"],
  ["nationale nederlanden", "cz"],
  ["ohra", "cz"],
  ["just", "cz"],
  ["cz direct", "cz"],
  ["dsw", "dsw"],
  ["stad holland", "dsw"],
  ["salland", "salland"],
  ["zorg zekerheid", "zorg zekerheid"],
  ["zorg en zekerheid", "zorg zekerheid"],
  ["zorg zekerheid av", "zorg zekerheid"],
  ["azvz", "zorg zekerheid"],
  ["stichting ziektekostenverzekering krijgsmacht szvk", "szvk"],
  ["szvk", "szvk"]
]);

const ZORGGROEP_DECLARATIESTROOM_FALLBACK = {
  "esv": "VIPLive",
  "zorggroep almere": "Op factuur achteraf",
  "almere": "Op factuur achteraf",
  "amstelland": "Extern Monter Systeem",
  "amstelland zorg": "Extern Monter Systeem",
  "eemland": "Boards",
  "eemland huisartsen": "Boards",
  "gezondheid amsterdam": "Declaratiestromen per zorgverzekeraar",
  "zorggroep gezondheid amsterdam": "Declaratiestromen per zorgverzekeraar",
  "hadoks": "Evry -> Per 1 Maart 2026 nieuw systeem",
  "humo": "VIPLive",
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

// Kleurgedreven interpretatie van 20260204 BESLISBOOM MIGUIDE - FACTURATIEMODULES:
// - Blauw in 2026-tabel = expliciet MiGuide-kant
// - Rood in 2026-tabel = expliciet ZoHealthy-kant
// - 2025 gebruiken we alleen als fallback waar 2026 nog onzeker is
const DIRECT_MIGUIDE_INSURERS_2026_CONFIRMED = new Set([
  "a s r",
  "asr",
  "menzis digitaal 2026",
  "menzis"
]);

const DIRECT_MIGUIDE_INSURERS_2025_FALLBACK = new Set([
  "onvz",
  "zilveren kruis achmea",
  "achmea zilveren kruis",
  "zilverenkruis achmea",
  "zk"
]);

const DIRECT_VGZ_INSURERS_2026 = new Set([
  "vgz"
]);

const ZOHEALTHY_INSURERS_2026_CONFIRMED = new Set([
  "aevitae eucare",
  "cz",
  "dsw",
  "salland",
  "zorg zekerheid",
  "szvk"
]);

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
  "zorg zekerheid": FACTURATIESTROMEN.STROOM_3,
  "szvk": FACTURATIESTROMEN.STROOM_3
};

const ZOHEALTHY_INSURERS = new Set(ZOHEALTHY_INSURERS_2026_CONFIRMED);

const BESLISBOOM_ROUTE_BY_ZORGGROEP_2026 = new Map([
  ["esv", "esv"],
  ["zorggroep gezondheid amsterdam", "ga"],
  ["gezondheid amsterdam", "ga"],
  ["lck", "lck"],
  ["hht hzgb", "no_contract"],
  ["zorggroep almere", "zorggroep"],
  ["almere", "zorggroep"],
  ["geen zorggroep contract", "no_contract"],
  ["zhz cz", "zhz_cz"],
  ["zhz vgz", "zhz_vgz"],
  ["zuid holland zuid overig", "no_contract"],
  ["zuid holland zuid", "zhz"],
  ["rijnmond dokters", "zorggroep"],
  ["west friesland", "zorggroep"],
  ["ketenzorg friesland", "zorggroep"],
  ["zio", "zorggroep"],
  ["zorg in ontwikkeling", "zorggroep"],
  ["rhogo", "zorggroep"],
  ["rhogo regionale huisartsen organisatie gooi en omstreken bv", "zorggroep"],
  ["unicum", "zorggroep"],
  ["hoog", "no_contract"],
  ["medita", "zorggroep"],
  ["meditta", "zorggroep"],
  ["hozl", "zorggroep"],
  ["rijn en duin", "zorggroep"],
  ["amstelland", "zorggroep"],
  ["amstelland zorg", "zorggroep"],
  ["hadoks", "zorggroep"],
  ["humo", "zorggroep"],
  ["eemland", "zorggroep"],
  ["eemland huisartsen", "zorggroep"],
  ["kennemerland", "zorggroep"],
  ["kop noord holland", "zorggroep"],
  ["kop noordholland", "zorggroep"],
  ["stroomz", "zorggroep"],
  ["post z naam in zorgtraject stroomz", "zorggroep"],
  ["postz", "zorggroep"]
]);

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
  "ESV": "CoOL-MiGuide via ESV. Declaraties voor deelnemers in de ESV-regio worden verwerkt via de ESV-facturatiemodule.",
  "Gezondheid Amsterdam (GA)": "CoOL-MiGuide via zorgverzekeraar voor de GA-regio. Declaraties van deelnemers in de GA-regio worden periodiek via een XML-bestand aangeleverd aan GA.",
  "LCK": "CoOL-MiGuide via LCK. Declaraties voor deelnemers uit de LCK-regio worden verwerkt via de nieuwe LCK-facturatiemodule.",
  "MiGuide": "CoOL-MiGuide via zorgverzekeraar. Declaraties worden direct vanuit MiGuide gedeclareerd aan andere zorgverzekeraars (niet VGZ), conform contractafspraken.",
  "MiGuide - VGZ": "CoOL via zorgverzekeraar (VGZ). Declaraties worden direct aan VGZ gedeclareerd vanuit MiGuide, conform contract met VGZ.",
  "ZoHealthy": "CoOL via zorgverzekeraar via ZoHealthy. Declaraties lopen via ZoHealthy en de verkooptarieven van ZoHealthy worden gebruikt.",
  "Zorggroep": "CoOL-MiGuide via zorggroep. Declaraties worden verwerkt via een platform/omgeving van een andere zorggroep (bijv. VIPLive of Monter); tarieven vanuit de zorggroep.",
  "Zuid Holland Zuid - CZ": "CoOL-MiGuide via zorgverzekeraar voor GLI-ZHZ-CZ. Declaraties voor CZ-gebied in dit contract worden via de statische declarant GLI-ZHZ-CZ gedeclareerd.",
  "Zuid Holland Zuid - VGZ": "CoOL via zorgverzekeraar voor GLI-ZHZ-VGZ. Declaraties voor VGZ-gebied in dit contract worden via de statische declarant GLI-ZHZ-VGZ gedeclareerd."
};

const FACTURATIEMODULE_PRESTATIECODE = {
  "CoOL via zorggroep": "CoOL-MiGuide",
  "CoOL via ZORGVERZEKERAAR - via GA": "CoOL-MiGuide",
  "ESV": "CoOL-MiGuide",
  "Gezondheid Amsterdam (GA)": "CoOL-MiGuide",
  "LCK": "CoOL-MiGuide",
  "MiGuide": "CoOL-MiGuide",
  "MiGuide - VGZ": "CoOL",
  "ZoHealthy": "CoOL",
  "Zorggroep": "CoOL-MiGuide",
  "Zuid Holland Zuid - CZ": "CoOL-MiGuide",
  "Zuid Holland Zuid - VGZ": "CoOL-MiGuide"
};

const APP_VIEWS = {
  LANDING: "landing",
  MAP: "map",
  WIP: "wip"
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
  "de goorn": "Koggenland",
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
  "ijmuiden gemeente velsen": "Velsen",
  "ijmuiden": "Velsen",
  "overveen gemeente bloemendaal": "Bloemendaal",
  "overveen": "Bloemendaal",
  "santpoort noord gemeente velsen": "Velsen",
  "santpoort noord": "Velsen",
  // Badhoevedorp is only a partial fit inside Haarlemmermeer.
  // Mapping it to the full municipality incorrectly pulls Hoofddorp into GA.
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

let map;
let baseTileLayer;
let geoLayer;
let overlapOutlineLayer;
let uncoveredGemeenteLayer;
let activeTooltipLayer = null;
let allFeatures = [];
let currentFilter = "ALL";
let currentGemeente = "";
let currentGemeenteCandidates = [];
let currentZorgverzekeraar = "ALL";
let currentDeclaratiestroom = "ALL";
let gemeenteFeaturesStore = [];
let postcodeOverrideData = null;
let messageTimer;
let postcodePanelRequestId = 0;
const gemeentePostcodeCache = new Map();
const zorggroepPostcodeRangeCache = new Map();
const customSelectObservers = new Map();
const customSelectTypeaheadTimers = new Map();
let appInitialized = false;
let currentAppView = APP_VIEWS.LANDING;
let zorgverzekeraarNoticeAcknowledged = false;
let zhzReferralAcknowledged = false;

const NO_ZORGGROEP_CONTRACT_NAME = "Geen zorggroep contract";
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

function createMap() {
  if (map) {
    return;
  }
  map = L.map("map").setView([52.1, 5.3], 8);
  applyMapTheme();

  // Clicking the map background clears polygon selection and shows full result set again.
  map.on("click", () => {
    closeActiveHoverTooltip();
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

  map.on("zoomstart movestart mouseout", () => {
    closeActiveHoverTooltip();
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
  setTheme(saved || "light");

  if (toggle && !toggle.dataset.themeBound) {
    toggle.dataset.themeBound = "1";
    toggle.addEventListener("click", () => {
      setTheme(isDarkModeActive() ? "light" : "dark");
    });
  }
}

function updateAppHeader(view) {
  const title = document.getElementById("appTitle");
  const subtitle = document.getElementById("appSubtitle");
  if (!title || !subtitle) {
    return;
  }

  if (view === APP_VIEWS.MAP) {
    title.textContent = "Zorgtool";
    subtitle.textContent = "Zoek snel op gemeente, postcode en zorggroep";
    return;
  }

  if (view === APP_VIEWS.WIP) {
    title.textContent = "Losse verwijzing tool";
    subtitle.textContent = "Work in progress";
    return;
  }

  title.textContent = "MiGuide Zorg Tools";
  subtitle.textContent = "Kies een tool om verder te gaan";
}

function showAppView(view) {
  currentAppView = view;
  const landingView = document.getElementById("landingView");
  const mapView = document.getElementById("kaartView");
  const wipView = document.getElementById("wipView");
  const setVisible = (element, visible) => {
    if (!element) {
      return;
    }
    element.hidden = !visible;
    element.classList.toggle("hidden", !visible);
  };

  setVisible(landingView, view === APP_VIEWS.LANDING);
  setVisible(mapView, view === APP_VIEWS.MAP);
  setVisible(wipView, view === APP_VIEWS.WIP);

  updateAppHeader(view);

  if (view === APP_VIEWS.MAP && map) {
    setTimeout(() => {
      map.invalidateSize();
    }, 80);
  }
}

function initLandingPage() {
  const openMapTool = document.getElementById("openMapTool");
  const openReferralTool = document.getElementById("openReferralTool");
  const menuZorgtoolButton = document.getElementById("menuZorgtoolButton");

  const openZorgtool = async () => {
    showAppView(APP_VIEWS.MAP);
    if (window.location.hash !== "#zorgtool") {
      history.replaceState(null, "", "#zorgtool");
    }
    await ensureMapAppInitialized();
  };

  if (openMapTool && !openMapTool.dataset.bound) {
    openMapTool.dataset.bound = "1";
    openMapTool.addEventListener("click", openZorgtool);
  }

  if (openReferralTool && !openReferralTool.dataset.bound) {
    openReferralTool.dataset.bound = "1";
    openReferralTool.addEventListener("click", () => {
      window.location.href = "losse-verwijzing-tool/index.html";
    });
  }

  if (menuZorgtoolButton && !menuZorgtoolButton.dataset.bound) {
    menuZorgtoolButton.dataset.bound = "1";
    menuZorgtoolButton.addEventListener("click", async () => {
      await openZorgtool();
      const menu = menuZorgtoolButton.closest("details");
      if (menu) {
        menu.open = false;
      }
    });
  }

  if (window.location.hash === "#zorgtool") {
    openZorgtool();
  } else {
    showAppView(APP_VIEWS.LANDING);
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
    initLandingPage();
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

function setGemeenteContext(primary = "", candidates = []) {
  currentGemeente = primary || "";
  const rawCandidates = [primary, ...(Array.isArray(candidates) ? candidates : [])];
  const unique = [];
  const seen = new Set();

  for (const value of rawCandidates) {
    const raw = String(value || "").trim();
    const normalized = normalizeText(raw);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(raw);
  }

  currentGemeenteCandidates = unique;
}

function featureMatchesCurrentGemeente(feature) {
  if (!currentGemeente) {
    return true;
  }

  const targets = currentGemeenteCandidates.length ? currentGemeenteCandidates : [currentGemeente];
  const [primaryTarget, ...fallbackTargets] = targets;
  const hasPrimaryMatchAcrossFeatures = primaryTarget
    ? allFeatures.some((candidateFeature) => featureMatchesLocationName(candidateFeature, primaryTarget))
    : false;

  if (hasPrimaryMatchAcrossFeatures) {
    return featureMatchesLocationName(feature, primaryTarget);
  }

  return [primaryTarget, ...fallbackTargets].some((targetValue) => featureMatchesLocationName(feature, targetValue));
}

function normalizeInsurerKey(value) {
  const normalized = normalizeText(value);
  return INSURER_LABEL_TO_CONCERN.get(normalized) || normalized;
}

function defaultStroomForInsurer(insurerName = "") {
  const insurerKey = normalizeInsurerKey(insurerName);
  if (!insurerKey || insurerKey === "all") {
    return "Onbekend";
  }
  if (DIRECT_VGZ_INSURERS_2026.has(insurerKey)) {
    return FACTURATIESTROMEN.STROOM_2;
  }
  if (DIRECT_MIGUIDE_INSURERS_2026_CONFIRMED.has(insurerKey)) {
    return FACTURATIESTROMEN.STROOM_2;
  }
  if (ZOHEALTHY_INSURERS_2026_CONFIRMED.has(insurerKey)) {
    return FACTURATIESTROMEN.STROOM_3;
  }
  if (DIRECT_MIGUIDE_INSURERS_2025_FALLBACK.has(insurerKey)) {
    return FACTURATIESTROMEN.STROOM_2;
  }
  return DECLARATIE_PER_VERZEKERAAR_OUTPUT[insurerKey] || "Onbekend";
}

function getZorggroepName(feature) {
  return feature?.properties?.zorggroep || "Onbekend";
}

// Verwijzingen uit de regio Zuid-Holland Zuid (ZHZ) mogen alleen via Monter worden
// verwerkt en niet via Zorgdomein. Herkent de ZHZ-zorggroepen (ZHZ CZ / ZHZ VGZ /
// Zuid Holland Zuid); het no-contract deel (Goeree-Overflakkee) valt hier bewust buiten.
function isZhzReferralFeature(feature) {
  const norm = normalizeText(getZorggroepName(feature));
  return norm.startsWith("zhz") || norm === "zuid holland zuid";
}

// Bepaalt of de huidige zoek-/filterselectie (gemeente/postcode → zorggroep) op ZHZ uitkomt.
function currentSelectionIsZhz() {
  if (currentFilter && currentFilter !== "ALL") {
    const feature = getFeatureByZorggroepName(currentFilter);
    if (feature) {
      return isZhzReferralFeature(feature);
    }
    const norm = normalizeText(currentFilter);
    return norm.startsWith("zhz") || norm === "zuid holland zuid";
  }
  if (currentGemeente) {
    return allFeatures.some(
      (feature) => featureMatchesCurrentGemeente(feature) && isZhzReferralFeature(feature)
    );
  }
  return false;
}

// Toont/verbergt de gecentreerde ZHZ-melding (modal). Verschijnt zodra de selectie
// op ZHZ uitkomt en nog niet is weggeklikt; sluiten kan via het kruisje of "Begrepen".
function updateZhzReferralModal() {
  const el = document.getElementById("zhzReferralModal");
  if (!el) {
    return;
  }
  const shouldShow = currentSelectionIsZhz() && !zhzReferralAcknowledged;
  el.classList.toggle("opacity-0", !shouldShow);
  el.classList.toggle("pointer-events-none", !shouldShow);
  const panel = el.firstElementChild;
  if (panel) {
    panel.classList.toggle("-translate-y-2", !shouldShow);
    panel.classList.toggle("translate-y-0", shouldShow);
  }
}

function dismissZhzReferralModal() {
  zhzReferralAcknowledged = true;
  updateZhzReferralModal();
}

function normalizeFacturatiestroom(value, feature = null, insurerName = "") {
  const raw = String(value || "").trim() || "Onbekend";
  const rawNorm = normalizeText(raw);
  const zorggroepNorm = normalizeText(getZorggroepName(feature));
  const insurerNorm = normalizeInsurerKey(insurerName);

  if (Object.values(FACTURATIESTROMEN).includes(raw)) {
    return raw;
  }

  if (rawNorm === "declaratiestromen per zorgverzekeraar") {
    if (zorggroepNorm.includes("gezondheid amsterdam")) {
      return FACTURATIESTROMEN.STROOM_4;
    }
    return defaultStroomForInsurer(insurerNorm);
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
  const insurerNorm = normalizeInsurerKey(insurerName);
  const zorggroepNorm = normalizeText(getZorggroepName(feature));
  const decisionTreeRoute = resolveDecisionTreeRouting2026(feature, insurerName);

  if (decisionTreeRoute?.moduleName) {
    return decisionTreeRoute.moduleName;
  }

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

function resolvePrestatiecodeByFacturatiemodule(moduleName) {
  return FACTURATIEMODULE_PRESTATIECODE[moduleName] || "Onbekend";
}

function resolveZorgproductName(moduleName, rawStroom = "", feature = null, insurerName = "") {
  const explicitPrestatiecode = resolvePrestatiecodeByFacturatiemodule(moduleName);
  if (explicitPrestatiecode && explicitPrestatiecode !== "Onbekend") {
    return explicitPrestatiecode;
  }

  const moduleNorm = normalizeText(moduleName);
  const stroomNorm = normalizeText(rawStroom);
  const zorggroepNorm = normalizeText(getZorggroepName(feature));
  const insurerNorm = normalizeInsurerKey(insurerName);

  // Per facturatiemodule-template tabel: MiGuide - VGZ gebruikt prestatiecode CoOL.
  if (moduleNorm === "miguide vgz") {
    return "CoOL";
  }

  // Behoud ruimte voor specifieke uitzonderingen als de flow later uitbreidt.
  if (zorggroepNorm === "zuid holland zuid" && insurerNorm === "vgz" && stroomNorm === normalizeText(FACTURATIESTROMEN.STROOM_2)) {
    return "CoOL-MiGuide";
  }

  return "CoOL-MiGuide";
}

function updateFacturatiemoduleContext() {
  const box = document.getElementById("facturatiemoduleContext");
  if (!box) {
    return;
  }
  const renderResultBox = (moduleName = "", prestatiecode = "") => {
    if (!moduleName && !prestatiecode) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `
      <div><strong>Facturatiemodule:</strong> ${moduleName}</div>
      <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(148,163,184,0.45);"><strong>Prestatiecode:</strong> ${prestatiecode}</div>
    `;
  };

  const hasUserSelection = Boolean(currentGemeente)
    || currentZorgverzekeraar !== "ALL"
    || currentFilter !== "ALL"
    || currentDeclaratiestroom !== "ALL";
  if (!hasUserSelection) {
    renderResultBox("", "");
    return;
  }

  let scoped = allFeatures.slice();
  if (currentGemeente) {
    scoped = scoped.filter((feature) => featureMatchesCurrentGemeente(feature));
  }
  if (currentZorgverzekeraar !== "ALL") {
    scoped = scoped.filter((feature) => featureMatchesInsurer(feature, currentZorgverzekeraar));
  }
  if (currentFilter !== "ALL") {
    scoped = scoped.filter((feature) => getZorggroepName(feature) === currentFilter);
  }

  const representativeFeature = scoped[0] || allFeatures[0];
  if (!representativeFeature) {
    renderResultBox("", "");
    return;
  }

  let zorgproduct = currentDeclaratiestroom;
  if (zorgproduct === "ALL") {
    const stroomSet = new Set();
    for (const feature of scoped) {
      if (currentZorgverzekeraar !== "ALL") {
        const rows = contractsForInsurer(feature, currentZorgverzekeraar).filter((row) => row.contract !== false);
        if (rows.length) {
          rows.forEach((row) => stroomSet.add(normalizeFacturatiestroom(row.declaratiestroom || "Onbekend", feature, currentZorgverzekeraar)));
        } else {
          stroomSet.add(fallbackDeclaratiestroomForFeature(feature, currentZorgverzekeraar));
        }
      } else {
        stroomSet.add(fallbackDeclaratiestroomForFeature(feature, ""));
      }
    }
    if (stroomSet.size === 1) {
      zorgproduct = [...stroomSet][0];
    }
  }

  if (!zorgproduct || zorgproduct === "ALL") {
    renderResultBox("", "");
    return;
  }

  const moduleName = resolveFacturatiemoduleName(zorgproduct, representativeFeature, currentZorgverzekeraar);
  const prestatiecode = resolvePrestatiecodeByFacturatiemodule(moduleName || "");
  renderResultBox(moduleName || "Onbekend", prestatiecode);
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

function resolveWorkbookSpecialRouting(feature, insurerName = "") {
  const zorggroepNorm = normalizeText(getZorggroepName(feature));
  const insurerNorm = normalizeInsurerKey(insurerName);

  if (!insurerNorm || insurerNorm === "all") {
    return null;
  }

  // MiGuide_all_v2.xlsx -> "Coöperatie Amsterdam (niet DSW/SH + Salland?)"
  // Bijzonderheid: Gezondheid Amsterdam zorggroep + DSW = ZoHealthy
  if ((zorggroepNorm === "zorggroep gezondheid amsterdam" || zorggroepNorm === "gezondheid amsterdam") && insurerNorm === "dsw") {
    return {
      routeType: "workbook_special_ga_dsw",
      moduleName: "ZoHealthy",
      stroom: FACTURATIESTROMEN.STROOM_3
    };
  }

  // MiGuide_all_v2.xlsx -> "Rijnmond Dokters"
  // Bijzonderheid: DSW binnen ZorgGroep Rijnmond dokters = Zorggroep
  if (zorggroepNorm === "rijnmond dokters" && insurerNorm === "dsw") {
    return {
      routeType: "workbook_special_rijnmond_dsw",
      moduleName: "Zorggroep",
      stroom: FACTURATIESTROMEN.STROOM_1
    };
  }

  // MiGuide_all_v2.xlsx -> "Unicum"
  // Postcodes zoals 3962BP vallen daar expliciet onder Unicum.
  // Voor deze zorggroep geldt volgens de beslisboom de normale zorggroeproute,
  // zolang er geen aparte workbook-bijzonderheid staat die CZ naar ZoHealthy zet.
  if (zorggroepNorm === "unicum" && insurerNorm === "cz") {
    return {
      routeType: "workbook_special_unicum_cz",
      moduleName: "Zorggroep",
      stroom: FACTURATIESTROMEN.STROOM_1
    };
  }

  return null;
}

function resolveDecisionTreeRouting2026(feature, insurerName = "") {
  const zorggroepNorm = normalizeText(getZorggroepName(feature));
  const insurerNorm = normalizeInsurerKey(insurerName);
  const routeType = BESLISBOOM_ROUTE_BY_ZORGGROEP_2026.get(zorggroepNorm) || null;
  const workbookSpecialRoute = resolveWorkbookSpecialRouting(feature, insurerName);

  if (!routeType) {
    return workbookSpecialRoute;
  }

  if (workbookSpecialRoute) {
    return workbookSpecialRoute;
  }

  if (routeType === "ga") {
    return {
      routeType,
      moduleName: "Gezondheid Amsterdam (GA)",
      stroom: FACTURATIESTROMEN.STROOM_4
    };
  }

  if (routeType === "esv") {
    return {
      routeType,
      moduleName: "ESV",
      stroom: FACTURATIESTROMEN.STROOM_1
    };
  }

  if (routeType === "lck") {
    return {
      routeType,
      moduleName: "LCK",
      stroom: FACTURATIESTROMEN.STROOM_1
    };
  }

  if (routeType === "direct_insurer") {
    if (!insurerNorm || insurerNorm === "all") {
      return {
        routeType,
        moduleName: "",
        stroom: "Declaratiestromen per zorgverzekeraar"
      };
    }

    if (DIRECT_VGZ_INSURERS_2026.has(insurerNorm)) {
      return {
        routeType,
        moduleName: "MiGuide - VGZ",
        stroom: FACTURATIESTROMEN.STROOM_2
      };
    }

    if (DIRECT_MIGUIDE_INSURERS_2026_CONFIRMED.has(insurerNorm)) {
      return {
        routeType,
        moduleName: "MiGuide",
        stroom: FACTURATIESTROMEN.STROOM_2
      };
    }

    if (DIRECT_MIGUIDE_INSURERS_2025_FALLBACK.has(insurerNorm)) {
      return {
        routeType,
        moduleName: "MiGuide",
        stroom: FACTURATIESTROMEN.STROOM_2
      };
    }

    if (ZOHEALTHY_INSURERS.has(insurerNorm)) {
      return {
        routeType,
        moduleName: "ZoHealthy",
        stroom: FACTURATIESTROMEN.STROOM_3
      };
    }

    return {
      routeType,
      moduleName: "MiGuide",
      stroom: FACTURATIESTROMEN.STROOM_2
    };
  }

  if (routeType === "no_contract") {
    if (!insurerNorm || insurerNorm === "all") {
      return {
        routeType,
        moduleName: "",
        stroom: "Declaratiestromen per zorgverzekeraar"
      };
    }

    if (DIRECT_VGZ_INSURERS_2026.has(insurerNorm)) {
      return {
        routeType,
        moduleName: "MiGuide - VGZ",
        stroom: FACTURATIESTROMEN.STROOM_2
      };
    }

    if (insurerNorm === "salland") {
      return {
        routeType,
        moduleName: "MiGuide",
        stroom: FACTURATIESTROMEN.STROOM_2
      };
    }

    if (ZOHEALTHY_INSURERS.has(insurerNorm)) {
      return {
        routeType,
        moduleName: "ZoHealthy",
        stroom: FACTURATIESTROMEN.STROOM_3
      };
    }

    return {
      routeType,
      moduleName: "MiGuide",
      stroom: FACTURATIESTROMEN.STROOM_2
    };
  }

  if (routeType === "zhz") {
    if (!insurerNorm || insurerNorm === "all") {
      return {
        routeType,
        moduleName: "",
        stroom: "Declaratiestromen per zorgverzekeraar"
      };
    }

    if (insurerNorm === "cz") {
      return {
        routeType,
        moduleName: "Zuid Holland Zuid - CZ",
        stroom: FACTURATIESTROMEN.STROOM_2
      };
    }

    if (DIRECT_VGZ_INSURERS_2026.has(insurerNorm)) {
      return {
        routeType,
        moduleName: "Zuid Holland Zuid - VGZ",
        stroom: FACTURATIESTROMEN.STROOM_2
      };
    }

    if (ZOHEALTHY_INSURERS.has(insurerNorm)) {
      return {
        routeType,
        moduleName: "ZoHealthy",
        stroom: FACTURATIESTROMEN.STROOM_3
      };
    }

    return {
      routeType,
      moduleName: "MiGuide",
      stroom: FACTURATIESTROMEN.STROOM_2
    };
  }

  if (routeType === "zhz_cz") {
    if (!insurerNorm || insurerNorm === "all") {
      return {
        routeType,
        moduleName: "",
        stroom: "Declaratiestromen per zorgverzekeraar"
      };
    }

    return {
      routeType,
      moduleName: "Zuid Holland Zuid - CZ",
      stroom: FACTURATIESTROMEN.STROOM_2
    };
  }

  if (routeType === "zhz_vgz") {
    if (!insurerNorm || insurerNorm === "all") {
      return {
        routeType,
        moduleName: "",
        stroom: "Declaratiestromen per zorgverzekeraar"
      };
    }

    return {
      routeType,
      moduleName: "Zuid Holland Zuid - VGZ",
      stroom: FACTURATIESTROMEN.STROOM_2
    };
  }

  if (routeType === "zorggroep") {
    if (!insurerNorm || insurerNorm === "all") {
      return {
        routeType,
        moduleName: "Zorggroep",
        stroom: FACTURATIESTROMEN.STROOM_1
      };
    }

    return {
      routeType,
      moduleName: "Zorggroep",
      stroom: FACTURATIESTROMEN.STROOM_1
    };
  }

  return null;
}

function fallbackDeclaratiestroomForFeature(feature, insurerName = "") {
  const zorggroep = getZorggroepName(feature);
  const normalized = normalizeText(zorggroep);
  const raw = ZORGGROEP_DECLARATIESTROOM_FALLBACK[normalized] || "Onbekend";
  const insurerKey = normalizeInsurerKey(insurerName);
  const decisionTreeRoute = resolveDecisionTreeRouting2026(feature, insurerName);

  if (decisionTreeRoute?.stroom) {
    return decisionTreeRoute.stroom;
  }

  // Beslisboom 20260204:
  // GA regio heeft altijd de GA-module als primaire route
  // (met aparte Menzis-uitzondering die we later nog specifieker kunnen modelleren).
  if (normalized.includes("gezondheid amsterdam")) {
    return FACTURATIESTROMEN.STROOM_4;
  }

  if (normalizeText(raw) !== "declaratiestromen per zorgverzekeraar") {
    const normalizedFallback = normalizeFacturatiestroom(raw, feature, insurerName);
    const isGenericZorggroepRoute = normalizedFallback === FACTURATIESTROMEN.STROOM_1
      || [
        "viplive",
        "boards",
        "cboards",
        "medix",
        "nis",
        "kysios",
        "monter",
        "evry",
        "op factuur achteraf",
        "extern monter",
        "was boards"
      ].some((token) => normalizeText(raw).includes(token));

    return normalizedFallback;
  }

  if (!insurerKey || insurerKey === "all") {
    return raw;
  }

  if (normalized.includes("gezondheid amsterdam")) {
    return FACTURATIESTROMEN.STROOM_4;
  }

  return defaultStroomForInsurer(insurerKey);
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

    const key = `${normalizeInsurerKey(zorgverzekeraar)}|${normalizeText(declaratiestroom)}`;
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
  const target = normalizeInsurerKey(insurerName);
  return contracts.filter((row) => normalizeInsurerKey(row.zorgverzekeraar) === target);
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

function getRouteTypeForZorggroepName(zorggroepName) {
  return BESLISBOOM_ROUTE_BY_ZORGGROEP_2026.get(normalizeText(zorggroepName)) || null;
}

function isNoContractZorggroepName(zorggroepName) {
  return getRouteTypeForZorggroepName(zorggroepName) === "no_contract"
    || normalizeText(zorggroepName) === normalizeText(NO_ZORGGROEP_CONTRACT_NAME);
}

function colorFromString(str) {
  const input = String(str || "Onbekend");
  const normalized = normalizeText(input);
  // Handmatig ingestelde kleur via de admin gaat voor (behalve geen-contract grijs).
  if (!isNoContractZorggroepName(input) && zorggroepColorOverrides.has(normalized)) {
    return zorggroepColorOverrides.get(normalized);
  }
  if (isNoContractZorggroepName(input)) {
    return "#9ca3af";
  }
  if (normalized === "zhz cz") {
    return "#f97316";
  }
  if (normalized === "zhz vgz") {
    return "#16a34a";
  }
  if (normalized === "zuid holland zuid overig") {
    return "#64748b";
  }
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 52%)`;
}

function style(feature) {
  const isNoContract = isNoContractFeature(feature);
  return {
    weight: isNoContract ? 0.6 : 1,
    opacity: 1,
    color: isNoContract ? "#64748b" : "#334155",
    dashArray: null,
    fillOpacity: isNoContract ? 0.28 : 0.45,
    fillColor: colorFromString(getZorggroepName(feature))
  };
}

function isNoContractFeature(feature) {
  return isNoContractZorggroepName(getZorggroepName(feature));
}

function buildNoContractTooltipText(gemeenteNaam = "", zorggroepNaam = "") {
  const label = zorggroepNaam || NO_ZORGGROEP_CONTRACT_NAME;
  const isGenericLabel = normalizeText(label) === normalizeText(NO_ZORGGROEP_CONTRACT_NAME);
  if (gemeenteNaam) {
    return isGenericLabel
      ? `Geen zorggroep contract<br><small>${gemeenteNaam}</small>`
      : `${label}<br><small>${gemeenteNaam} • Geen contract</small>`;
  }
  return isGenericLabel
    ? "Geen zorggroep contract"
    : `${label}<br><small>Geen contract</small>`;
}

function highlightFeature(e) {
  const layer = e.target;
  const isNoContract = isNoContractFeature(layer.feature);
  closeActiveHoverTooltip(layer);
  layer.setStyle({
    weight: isNoContract ? 1.2 : 3,
    color: isNoContract ? "#475569" : "#0f172a",
    dashArray: null,
    fillOpacity: isNoContract ? 0.36 : 0.65
  });

  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront();
  }

  if (typeof layer.openTooltip === "function") {
    layer.openTooltip();
    activeTooltipLayer = layer;
  }
}

function resetHighlight(e) {
  closeActiveHoverTooltip(e.target);
  if (geoLayer) {
    geoLayer.resetStyle(e.target);
  }
}

function closeActiveHoverTooltip(preferredLayer = null) {
  const layerToClose = preferredLayer || activeTooltipLayer;
  if (layerToClose && typeof layerToClose.closeTooltip === "function") {
    layerToClose.closeTooltip();
  }
  if (!preferredLayer || preferredLayer === activeTooltipLayer) {
    activeTooltipLayer = null;
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
        const prestatiecode = resolvePrestatiecodeByFacturatiemodule(moduleName);
        contractRow = `<div>Contract ${currentZorgverzekeraar}: Ja</div>`;
        moduleRow = `<div>Facturatiemodule: ${moduleName}</div><div>Prestatiecode: ${prestatiecode}</div>`;
      } else {
        contractRow = `<div>Contract ${currentZorgverzekeraar}: Nee</div>`;
      }
    } else {
      const stroomName = fallbackDeclaratiestroomForFeature(feature, currentZorgverzekeraar);
      const moduleName = resolveFacturatiemoduleName(stroomName, feature, currentZorgverzekeraar);
      const prestatiecode = resolvePrestatiecodeByFacturatiemodule(moduleName);
      moduleRow = `<div>Facturatiemodule: ${moduleName}</div><div>Prestatiecode: ${prestatiecode}</div>`;
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
    mousemove: (event) => {
      if (!isNoContractFeature(feature)) {
        return;
      }
      const gemeenteNaam = municipalityForPoint([event.latlng.lng, event.latlng.lat]) || "";
      layer.setTooltipContent(buildNoContractTooltipText(gemeenteNaam, getZorggroepName(feature)));
      if (typeof layer.openTooltip === "function") {
        layer.openTooltip(event.latlng);
        activeTooltipLayer = layer;
      }
    },
    click: (event) => {
      L.DomEvent.stopPropagation(event);
      closeActiveHoverTooltip(layer);
      const selectedDomain = getZorggroepName(feature);
      currentFilter = selectedDomain;
      setGemeenteContext("");
      updateGemeenteFoundDisplay();

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
  const tooltipText = isNoContractFeature(feature)
    ? buildNoContractTooltipText("", getZorggroepName(feature))
    : overlapGemeenten.length
      ? `${getZorggroepName(feature)}<br><small>Overlap: ${overlapGemeenten.join(", ")}</small>`
      : getZorggroepName(feature);
  layer.bindTooltip(tooltipText, {
    sticky: false,
    direction: "top",
    offset: [0, -8]
  });
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
    closeActiveHoverTooltip();
    map.removeLayer(geoLayer);
  }
  if (uncoveredGemeenteLayer) {
    map.removeLayer(uncoveredGemeenteLayer);
    uncoveredGemeenteLayer = null;
  }
  if (overlapOutlineLayer) {
    map.removeLayer(overlapOutlineLayer);
    overlapOutlineLayer = null;
  }

  renderUncoveredGemeenten();

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

function renderUncoveredGemeenten() {
  if (!map || !Array.isArray(gemeenteFeaturesStore) || gemeenteFeaturesStore.length === 0 || !Array.isArray(allFeatures) || allFeatures.length === 0) {
    return;
  }

  const coveredGemeenten = new Set();
  for (const feature of allFeatures) {
    const gemeenten = Array.isArray(feature?.properties?.gemeenten) ? feature.properties.gemeenten : [];
    for (const gemeente of gemeenten) {
      const key = normalizeText(gemeente);
      if (key) {
        coveredGemeenten.add(key);
      }
    }
  }

  const uncoveredFeatures = gemeenteFeaturesStore.filter((gemeenteFeature) => {
    const naam = gemeenteFeature?.properties?.naam;
    return naam && !coveredGemeenten.has(normalizeText(naam));
  });

  if (uncoveredFeatures.length === 0) {
    return;
  }

  uncoveredGemeenteLayer = L.geoJSON(uncoveredFeatures, {
    interactive: false,
    style: {
      color: "#94a3b8",
      weight: 1,
      opacity: 0.7,
      fillColor: "#cbd5e1",
      fillOpacity: 0.32
    }
  }).addTo(map);
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

  const visibleFeatures = currentFilter === "ALL"
    ? features.filter((feature) => normalizeText(getZorggroepName(feature)) !== normalizeText(NO_ZORGGROEP_CONTRACT_NAME))
    : features;

  const uniqueCities = new Set();
  for (const feature of visibleFeatures) {
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
  if (!el) {
    return;
  }
  clearTimeout(messageTimer);
  clearTimeout(el._hideTimer);
  if (!message) {
    el.classList.remove("is-visible");
    el._hideTimer = setTimeout(() => {
      el.hidden = true;
      el.textContent = "";
    }, 240);
    return;
  }
  el.textContent = message;
  el.hidden = false;
  requestAnimationFrame(() => {
    el.classList.add("is-visible");
  });
  messageTimer = setTimeout(() => {
    el.classList.remove("is-visible");
    el._hideTimer = setTimeout(() => {
      el.hidden = true;
      el.textContent = "";
    }, 240);
  }, 4500);
}

function updateGemeenteFoundDisplay() {
  const el = document.getElementById("gemeenteFoundDisplay");
  if (!el) {
    return;
  }

  if (!currentGemeente) {
    el.textContent = "";
    el.classList.remove("is-visible");
    el.classList.add("opacity-0", "pointer-events-none");
    return;
  }

  el.textContent = `Gevonden gemeente: ${currentGemeente}`;
  el.classList.add("is-visible");
  el.classList.remove("opacity-0", "pointer-events-none");
}

function updateZorgverzekeraarNotice() {
  const el = document.getElementById("zorgverzekeraarNotice");
  if (!el) {
    return;
  }

  const insurerKey = normalizeInsurerKey(currentZorgverzekeraar);
  const shouldShow = insurerKey === "vgz" && !zorgverzekeraarNoticeAcknowledged;
  el.classList.toggle("opacity-0", !shouldShow);
  el.classList.toggle("pointer-events-none", !shouldShow);
  const panel = el.firstElementChild;
  if (panel) {
    panel.classList.toggle("-translate-y-2", !shouldShow);
    panel.classList.toggle("translate-y-0", shouldShow);
  }
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

function resetCustomSelectTypeahead(root) {
  if (!root) {
    return;
  }
  const selectId = root.getAttribute("data-custom-select") || "";
  root.dataset.typeaheadBuffer = "";
  const timer = customSelectTypeaheadTimers.get(selectId);
  if (timer) {
    clearTimeout(timer);
    customSelectTypeaheadTimers.delete(selectId);
  }
}

function queueCustomSelectTypeahead(root, key) {
  const selectId = root.getAttribute("data-custom-select") || "";
  const currentBuffer = root.dataset.typeaheadBuffer || "";
  const nextBuffer = `${currentBuffer}${normalizeText(key)}`;
  root.dataset.typeaheadBuffer = nextBuffer;

  const existingTimer = customSelectTypeaheadTimers.get(selectId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    root.dataset.typeaheadBuffer = "";
    customSelectTypeaheadTimers.delete(selectId);
  }, 700);
  customSelectTypeaheadTimers.set(selectId, timer);

  return nextBuffer;
}

function focusCustomSelectOption(menu, selectValue) {
  if (!menu || !selectValue) {
    return;
  }
  const items = [...menu.querySelectorAll("button[data-value]")];
  const target = items.find((item) => item.dataset.value === selectValue);
  if (!target) {
    return;
  }
  target.focus();
  target.scrollIntoView({ block: "nearest" });
}

function findCustomSelectMatch(select, query, fallbackChar = "") {
  const options = [...select.options].filter((opt) => !opt.disabled);
  if (!options.length) {
    return null;
  }

  const normalizedQuery = normalizeText(query);
  const currentIndex = Math.max(0, options.findIndex((opt) => opt.value === select.value));

  const findFrom = (needle) => {
    if (!needle) {
      return null;
    }
    for (let offset = 1; offset <= options.length; offset++) {
      const option = options[(currentIndex + offset) % options.length];
      if (normalizeText(option.textContent).startsWith(needle)) {
        return option;
      }
    }
    return null;
  };

  return findFrom(normalizedQuery) || findFrom(normalizeText(fallbackChar));
}

function openAndFocusCustomSelectMatch(root, select, button, menu, option) {
  if (!root || !select || !button || !menu || !option) {
    return;
  }
  closeAllCustomSelectMenus(select.id);
  menu.hidden = false;
  renderCustomSelect(select);
  positionCustomSelectMenu(root, button, menu);
  focusCustomSelectOption(menu, option.value);
}

function positionCustomSelectMenu(root, button, menu) {
  if (!root || !button || !menu) {
    return;
  }

  const buttonRect = button.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const clippingContainer = root.closest("aside") || root.closest("[class*='overflow']") || null;
  const containerRect = clippingContainer ? clippingContainer.getBoundingClientRect() : null;
  const visibleTop = containerRect ? Math.max(0, containerRect.top) : 0;
  const visibleBottom = containerRect ? Math.min(viewportHeight, containerRect.bottom) : viewportHeight;
  const gap = 6;
  const spaceBelow = visibleBottom - buttonRect.bottom - gap;
  const spaceAbove = buttonRect.top - visibleTop - gap;

  menu.style.top = "";
  menu.style.bottom = "";

  const preferUp = spaceBelow < 220 && spaceAbove > spaceBelow;
  if (preferUp) {
    menu.style.top = "auto";
    menu.style.bottom = `calc(100% + ${gap}px)`;
  } else {
    menu.style.bottom = "auto";
    menu.style.top = `calc(100% + ${gap}px)`;
  }

  const rawAvailable = preferUp ? (spaceAbove - 8) : (spaceBelow - 8);
  const available = Math.max(120, Math.min(320, rawAvailable));
  menu.style.maxHeight = `${available}px`;
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
        positionCustomSelectMenu(root, button, menu);
      }
    });

    button.addEventListener("keydown", (event) => {
      if (select.disabled) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        closeAllCustomSelectMenus(selectId);
        menu.hidden = false;
        renderCustomSelect(select);
        positionCustomSelectMenu(root, button, menu);
        focusCustomSelectOption(menu, select.value || (select.options[0] && select.options[0].value));
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        const buffer = queueCustomSelectTypeahead(root, event.key);
        const match = findCustomSelectMatch(select, buffer, event.key);
        if (match) {
          openAndFocusCustomSelectMatch(root, select, button, menu, match);
        }
      }
    });

    menu.addEventListener("keydown", (event) => {
      if (select.disabled) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        menu.hidden = true;
        resetCustomSelectTypeahead(root);
        button.focus();
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        const buffer = queueCustomSelectTypeahead(root, event.key);
        const activeValue = event.target instanceof HTMLElement ? event.target.dataset.value : "";
        if (activeValue) {
          select.value = activeValue;
        }
        const match = findCustomSelectMatch(select, buffer, event.key);
        if (match) {
          renderCustomSelect(select);
          positionCustomSelectMenu(root, button, menu);
          focusCustomSelectOption(menu, match.value);
        }
      }
    });

    const repositionIfOpen = () => {
      if (!menu.hidden) {
        positionCustomSelectMenu(root, button, menu);
      }
    };
    window.addEventListener("resize", repositionIfOpen);
    window.addEventListener("scroll", repositionIfOpen, true);

    select.addEventListener("change", () => {
      resetCustomSelectTypeahead(root);
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

function getFeatureByZorggroepName(zorggroepName) {
  if (!zorggroepName || zorggroepName === "ALL") {
    return null;
  }
  const normalizedTarget = normalizeText(zorggroepName);
  return allFeatures.find((feature) => {
    const featureName = getZorggroepName(feature);
    const normalizedFeatureName = normalizeText(featureName);
    return featureName === zorggroepName
      || normalizedFeatureName === normalizedTarget
      || normalizedFeatureName.startsWith(`${normalizedTarget} `)
      || normalizedFeatureName.startsWith(`${normalizedTarget}(`);
  }) || null;
}

async function loadPostcodesForZorggroepName(zorggroepName) {
  if (!zorggroepName || zorggroepName === "ALL") {
    setPostcodePanelState("Klik op een zorggroep op de kaart om postcodes te laden.", []);
    return;
  }
  const feature = getFeatureByZorggroepName(zorggroepName);
  if (!feature) {
    setPostcodePanelState(`Geen zorggroep gevonden voor ${zorggroepName}.`, []);
    return;
  }
  await loadPostcodesForFeature(feature);
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
    filtered = filtered.filter((feature) => featureMatchesCurrentGemeente(feature));
  }

  updateCityList(filtered);
  const broadOverview = currentFilter === "ALL" && !currentGemeente;
  renderLayer(filtered, { useNetherlandsDefaultView: broadOverview });
}

function featuresScopedForOptionLists() {
  let scoped = allFeatures;

  if (currentGemeente) {
    scoped = scoped.filter((feature) => featureMatchesCurrentGemeente(feature));
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
  updateZorgverzekeraarNotice();
  updateFacturatiemoduleContext();
  updateZhzReferralModal();
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
    zorgverzekeraarNoticeAcknowledged = false;
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

  zorggroepSelect.addEventListener("change", async (event) => {
    currentFilter = event.target.value;
    if (currentFilter === "ALL") {
      setPostcodePanelState("Klik op een zorggroep op de kaart om postcodes te laden.", []);
    } else {
      await loadPostcodesForZorggroepName(currentFilter);
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

function loadPostcodeOverrideData(data) {
  const exactRaw = data?.exact_postcode6_overrides || {};
  const locationExactRaw = data?.location_postcode6_overrides || {};
  const rangeRaw = Array.isArray(data?.postcode4_range_overrides) ? data.postcode4_range_overrides : [];

  const exact = new Map();
  for (const [postcode, row] of Object.entries(exactRaw)) {
    const normalized = formatPostcode(postcode);
    if (!normalized || !row?.zorggroep) {
      continue;
    }
    const sourceSheet = row.source_sheet || "";
    let zorggroep = row.zorggroep;
    if (sourceSheet === "ZHZ leefstijl coalitie CZ") {
      zorggroep = "ZHZ CZ";
    } else if (sourceSheet === "ZHZ leefstijl coalitie VGZ") {
      zorggroep = "ZHZ VGZ";
    }
    exact.set(normalized, {
      zorggroep,
      sourceSheet,
      note: String(row.note || "").trim(),
      insurerConcerns: sourceSheet.startsWith("ZHZ leefstijl coalitie")
        ? []
        : (Array.isArray(row.insurer_concerns) ? row.insurer_concerns.map((value) => normalizeInsurerKey(value)) : [])
    });
  }

  const locationExact = new Map();
  for (const [postcode, row] of Object.entries(locationExactRaw)) {
    const normalized = formatPostcode(postcode);
    if (!normalized) {
      continue;
    }
    locationExact.set(normalized, {
      woonplaats: String(row?.woonplaats || "").trim(),
      gemeente: String(row?.gemeente || "").trim(),
      zorggroep: String(row?.zorggroep || "").trim(),
      source: String(row?.source || "").trim()
    });
  }

  const ranges = [];
  for (const row of rangeRaw) {
    const start = formatPostcode4(row?.start);
    const end = formatPostcode4(row?.end);
    if (!start || !end || !row?.zorggroep) {
      continue;
    }
    const sourceSheet = row.source_sheet || "";
    let zorggroep = row.zorggroep;
    if (sourceSheet === "ZHZ leefstijl coalitie CZ") {
      zorggroep = "ZHZ CZ";
    } else if (sourceSheet === "ZHZ leefstijl coalitie VGZ") {
      zorggroep = "ZHZ VGZ";
    }
    ranges.push({
      start,
      end,
      zorggroep,
      sourceSheet,
      insurerConcerns: sourceSheet.startsWith("ZHZ leefstijl coalitie")
        ? []
        : (Array.isArray(row.insurer_concerns) ? row.insurer_concerns.map((value) => normalizeInsurerKey(value)) : [])
    });
  }

  ranges.sort((a, b) => {
    const spanA = Number(a.end) - Number(a.start);
    const spanB = Number(b.end) - Number(b.start);
    if (spanA !== spanB) {
      return spanA - spanB;
    }
    if (a.start !== b.start) {
      return a.start.localeCompare(b.start, "nl");
    }
    return a.end.localeCompare(b.end, "nl");
  });

  postcodeOverrideData = { exact, locationExact, ranges };
}

function matchesOverrideInsurer(rule, insurerName = "") {
  const concerns = Array.isArray(rule?.insurerConcerns) ? rule.insurerConcerns : [];
  if (concerns.length === 0) {
    return true;
  }
  const normalizedInsurer = normalizeInsurerKey(insurerName);
  if (!normalizedInsurer || normalizedInsurer === "all") {
    return true;
  }
  return concerns.includes(normalizedInsurer);
}

function findPostcodeOverride(postcodeInput, insurerName = "") {
  if (!postcodeOverrideData) {
    return null;
  }

  const pc6 = formatPostcode(postcodeInput);
  if (pc6) {
    const exactMatch = postcodeOverrideData.exact.get(pc6);
    if (exactMatch && matchesOverrideInsurer(exactMatch, insurerName)) {
      return exactMatch;
    }
  }

  const pc4 = formatPostcode4(postcodeInput) || (pc6 ? pc6.slice(0, 4) : null);
  if (!pc4) {
    return null;
  }

  for (const rule of postcodeOverrideData.ranges) {
    if (!matchesOverrideInsurer(rule, insurerName)) {
      continue;
    }
    if (pc4 >= rule.start && pc4 <= rule.end) {
      return rule;
    }
  }

  return null;
}

function findPostcodeLocationOverride(postcodeInput) {
  if (!postcodeOverrideData) {
    return null;
  }

  const pc6 = formatPostcode(postcodeInput);
  if (!pc6) {
    return null;
  }

  return postcodeOverrideData.locationExact.get(pc6) || null;
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

async function lookupPostcodePlaatsInfo(postcodeInput) {
  const pc6 = formatPostcode(postcodeInput);
  const pc4 = formatPostcode4(postcodeInput);
  const query = pc6 || pc4;
  if (!query) {
    return null;
  }

  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Locatieserver lookup mislukt (${response.status})`);
  }

  const data = await response.json();
  const docs = Array.isArray(data?.response?.docs) ? data.response.docs : [];
  const exact = docs.find((doc) => String(doc?.postcode || "").toUpperCase().replace(/\s+/g, "") === query)
    || docs[0]
    || null;

  if (!exact) {
    return null;
  }

  return {
    woonplaatsnaam: exact.woonplaatsnaam || "",
    gemeentenaam: exact.gemeentenaam || ""
  };
}

function featureMatchesLocationName(feature, locationName = "") {
  const target = normalizeText(locationName);
  if (!target || !feature) {
    return false;
  }

  const gemeenten = Array.isArray(feature?.properties?.gemeenten) ? feature.properties.gemeenten : [];
  const cities = Array.isArray(feature?.properties?.cities) ? feature.properties.cities : [];
  return gemeenten.some((name) => normalizeText(name) === target)
    || cities.some((name) => normalizeText(name) === target);
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
    setGemeenteContext(value);
    updateGemeenteFoundDisplay();
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
      setGemeenteContext("");
      updateGemeenteFoundDisplay();
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
    // Nieuwe zoekactie: toon de ZHZ-melding zo nodig opnieuw.
    zhzReferralAcknowledged = false;

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
        const postcodeOverride = findPostcodeOverride(normalizedInput, currentZorgverzekeraar);
        const postcodeLocationOverride = findPostcodeLocationOverride(normalizedInput);
        const [result, plaatsInfo] = await Promise.all([
          lookupPostcodeToGemeente(normalizedInput),
          lookupPostcodePlaatsInfo(normalizedInput).catch(() => null)
        ]);
        const usingLocationFallback = Boolean(
          postcodeLocationOverride
          && (!Array.isArray(result.postcodes) || result.postcodes.length === 0)
          && !plaatsInfo
        );
        const effectivePostcodeOverride = postcodeOverride?.zorggroep
          ? postcodeOverride
          : (postcodeLocationOverride?.zorggroep ? { zorggroep: postcodeLocationOverride.zorggroep } : null);
        const gemeenteNaam = result.gemeenten[0] || plaatsInfo?.gemeentenaam || postcodeLocationOverride?.gemeente || "";
        const woonplaatsNaam = plaatsInfo?.woonplaatsnaam || postcodeLocationOverride?.woonplaats || "";

        if (!gemeenteNaam && !effectivePostcodeOverride) {
          setGemeenteContext("");
          updateGemeenteFoundDisplay();
          refreshDependentFilters();
          applyActiveFilters();
          showStatus(`Postcode ${normalizedInput} niet gevonden in de PDOK postcode6 data.`);
          return;
        }

        const hasDomain = allFeatures.some((feature) =>
          featureMatchesLocationName(feature, woonplaatsNaam) || featureMatchesLocationName(feature, gemeenteNaam)
        );

        if (!hasDomain && !effectivePostcodeOverride) {
          setGemeenteContext("");
          updateGemeenteFoundDisplay();
          refreshDependentFilters();
          applyActiveFilters();
          showStatus(`Postcode ${normalizedInput} valt niet binnen een zorggroep domein in je lijst.`);
          return;
        }

        input.value = normalizedInput;

        if (effectivePostcodeOverride?.zorggroep) {
          const overrideFeature = getFeatureByZorggroepName(effectivePostcodeOverride.zorggroep);
          const resolvedZorggroepName = overrideFeature ? getZorggroepName(overrideFeature) : effectivePostcodeOverride.zorggroep;
          const locationCandidates = [woonplaatsNaam, gemeenteNaam].filter(Boolean);
          const preferredLocation = locationCandidates.find((name) =>
            featureMatchesLocationName(overrideFeature, name)
          );
          const clearLocationScopeForNoContractOverride = !preferredLocation && isNoContractZorggroepName(resolvedZorggroepName);
          setGemeenteContext(
            clearLocationScopeForNoContractOverride ? "" : (preferredLocation || woonplaatsNaam || gemeenteNaam),
            locationCandidates
          );

          updateGemeenteFoundDisplay();
          currentFilter = resolvedZorggroepName;
          refreshDependentFilters();

          const zorggroepSelect = document.getElementById("zorggroepFilter");
          if (zorggroepSelect) {
            const hasOption = [...zorggroepSelect.options].some((option) => option.value === resolvedZorggroepName);
            if (hasOption) {
              zorggroepSelect.value = resolvedZorggroepName;
              renderCustomSelect(zorggroepSelect);
            } else {
              currentFilter = "ALL";
            }
          }
        } else {
          setGemeenteContext(woonplaatsNaam || gemeenteNaam, [woonplaatsNaam, gemeenteNaam]);
          updateGemeenteFoundDisplay();
          refreshDependentFilters();
        }

        applyActiveFilters();
        if (Array.isArray(result.postcodes) && result.postcodes.length) {
          const range = summarizePostcodeRange(result.postcodes);
          const compactRange = formatCompactRangeLine(range);
          setPostcodePanelState(
            `Postcodezoekresultaat ${normalizedInput} (${woonplaatsNaam || gemeenteNaam})`,
            compactRange ? [compactRange] : ["Geen postcode-range gevonden"]
          );
        } else if (usingLocationFallback && (woonplaatsNaam || gemeenteNaam || effectivePostcodeOverride?.zorggroep)) {
          const items = [];
          if (gemeenteNaam) {
            items.push(`Gemeente: ${gemeenteNaam}`);
          }
          if (woonplaatsNaam && woonplaatsNaam !== gemeenteNaam) {
            items.push(`Woonplaats: ${woonplaatsNaam}`);
          }
          if (effectivePostcodeOverride?.zorggroep) {
            const overrideFeature = getFeatureByZorggroepName(effectivePostcodeOverride.zorggroep);
            const resolvedZorggroepName = overrideFeature ? getZorggroepName(overrideFeature) : effectivePostcodeOverride.zorggroep;
            items.push(`Zorggroepcontext: ${resolvedZorggroepName}`);
          }
          setPostcodePanelState(
            `Postbuspostcode ${normalizedInput}`,
            items.length ? items : ["Contextfallback gebruikt"]
          );
        } else if (woonplaatsNaam || gemeenteNaam || effectivePostcodeOverride?.zorggroep) {
          setPostcodePanelState(
            `Postcodezoekresultaat ${normalizedInput} (${woonplaatsNaam || gemeenteNaam || "handmatige fallback"})`,
            [normalizedInput]
          );
        }
        if (effectivePostcodeOverride?.zorggroep) {
          const locationLabel = woonplaatsNaam || gemeenteNaam;
          const overrideFeature = getFeatureByZorggroepName(effectivePostcodeOverride.zorggroep);
          const resolvedZorggroepName = overrideFeature ? getZorggroepName(overrideFeature) : effectivePostcodeOverride.zorggroep;
          if (usingLocationFallback) {
            showStatus(`Postbuspostcode ${normalizedInput} valt qua gemeente onder ${locationLabel || "deze locatie"} en gebruikt ${resolvedZorggroepName} als zorggroepcontext.`);
          } else {
            const overrideNote = String(effectivePostcodeOverride.note || "").trim();
            showStatus(`Postcode ${normalizedInput} gekoppeld aan ${resolvedZorggroepName}${locationLabel ? ` bij ${locationLabel}` : ""}.${overrideNote ? ` Uitzondering: ${overrideNote}` : ""}`);
          }
        } else {
          const locationLabel = woonplaatsNaam || gemeenteNaam;
          showStatus(`Postcode ${normalizedInput} gevonden bij ${locationLabel}.`);
        }
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
      setGemeenteContext("");
      updateGemeenteFoundDisplay();
      showStatus("");
      refreshDependentFilters();
      applyActiveFilters();
      setPostcodePanelState("Klik op een zorggroep op de kaart om postcodes te laden.", []);
    } else {
      setGemeenteContext(input.value.trim());
      updateGemeenteFoundDisplay();
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
      setGemeenteContext("");
      currentZorgverzekeraar = "ALL";
      zorgverzekeraarNoticeAcknowledged = false;
      zhzReferralAcknowledged = false;
      currentFilter = "ALL";
      currentDeclaratiestroom = "ALL";
      updateGemeenteFoundDisplay();

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

  const noticeConfirmButton = document.getElementById("zorgverzekeraarNoticeConfirm");
  if (noticeConfirmButton && !noticeConfirmButton.dataset.bound) {
    noticeConfirmButton.dataset.bound = "1";
    noticeConfirmButton.addEventListener("click", async () => {
      zorgverzekeraarNoticeAcknowledged = true;
      updateZorgverzekeraarNotice();

      const hasSearchValue = input.value.trim() !== "";
      if (hasSearchValue) {
        await executeSearch();
        return;
      }

      refreshDependentFilters();
      applyActiveFilters();
    });
  }

  ["zhzReferralModalClose", "zhzReferralModalConfirm"].forEach((btnId) => {
    const btn = document.getElementById(btnId);
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", dismissZhzReferralModal);
    }
  });

  const zhzModal = document.getElementById("zhzReferralModal");
  if (zhzModal && !zhzModal.dataset.bound) {
    zhzModal.dataset.bound = "1";
    // Klik op de donkere achtergrond sluit de melding ook.
    zhzModal.addEventListener("click", (event) => {
      if (event.target === zhzModal) {
        dismissZhzReferralModal();
      }
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

function splitZuidHollandZuidItem(item) {
  const groups = [
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
        "Dordrecht",
        "Gorinchem",
        "Hardinxveld-Giesendam",
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

  return groups.filter((group) => Array.isArray(group.cities) && group.cities.length > 0);
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

  const featureDrafts = [];

  const expandedZorggroepen = [];
  for (const item of zorggroepen) {
    if (item?.zorggroep === "Zuid-Holland-Zuid") {
      expandedZorggroepen.push(...splitZuidHollandZuidItem(item));
    } else {
      expandedZorggroepen.push(item);
    }
  }

  for (const item of expandedZorggroepen) {
    const unmatchedCities = [];
    const mappedCities = [];

    for (const city of item.cities || []) {
      const gemeenteNaam = cityToGemeenteName(city, gemeenteByNormName);
      if (!gemeenteNaam) {
        unmatchedCities.push(city);
        continue;
      }
      mappedCities.push({ city, gemeenteNaam });
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

    featureDrafts.push({
      zorggroep: zorggroepName,
      regio: item.regio || zorggroepName || "Onbekend",
      website: item.website || "",
      mappedCities,
      unmatchedCities,
      contracts
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
    if (owners.length <= 1) {
      continue;
    }

    if (ALLOWED_OVERLAP_GEMEENTEN.has(gemeenteKey)) {
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
      const parts = geometryToMultiPolygonParts(gemeenteFeature.geometry);
      multiPolygonCoords.push(...parts);
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
        gemeenten: matchedGemeenten,
        unmatchedCities: draft.unmatchedCities,
        contracts: draft.contracts
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: multiPolygonCoords
      }
    });
  }

  const coveredGemeenten = new Set();
  for (const feature of features) {
    const gemeenten = Array.isArray(feature?.properties?.gemeenten) ? feature.properties.gemeenten : [];
    for (const gemeenteNaam of gemeenten) {
      const normalized = normalizeText(gemeenteNaam);
      if (normalized) {
        coveredGemeenten.add(normalized);
      }
    }
  }

  const noContractGemeenten = [];
  const noContractCoords = [];
  for (const gemeenteFeature of gemeenteFeatures) {
    const gemeenteNaam = gemeenteFeature?.properties?.naam;
    const normalized = normalizeText(gemeenteNaam);
    if (!normalized || coveredGemeenten.has(normalized)) {
      continue;
    }
    noContractGemeenten.push(gemeenteNaam);
    const parts = geometryToMultiPolygonParts(gemeenteFeature.geometry);
    noContractCoords.push(...parts);
  }

  if (noContractCoords.length > 0) {
    const sortedGemeenten = [...noContractGemeenten].sort((a, b) => a.localeCompare(b, "nl"));
    features.push({
      type: "Feature",
      properties: {
        zorggroep: NO_ZORGGROEP_CONTRACT_NAME,
        regio: NO_ZORGGROEP_CONTRACT_NAME,
        website: "",
        cities: sortedGemeenten,
        gemeenten: sortedGemeenten,
        unmatchedCities: [],
        contracts: []
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: noContractCoords
      }
    });
  }

  annotateOverlappingGemeenten(features);
  return features;
}

async function init() {
  if (appInitialized) {
    return;
  }
  try {
    createMap();

    const [zorggroepData, gemeenteFeatures, postcodeOverrides] = await Promise.all([
      loadZorggroepData(),
      fetchAllGemeenteFeatures(),
      loadPostcodeOverrides()
    ]);

    const zorggroepen = Array.isArray(zorggroepData.zorggroepen) ? zorggroepData.zorggroepen : [];
    const contractsByZorggroep = extractContractsByZorggroep(zorggroepData);

    applyZorggroepColorOverrides(zorggroepen);
    allFeatures = buildZorggroepFeatures(zorggroepen, gemeenteFeatures, contractsByZorggroep);
    gemeenteFeaturesStore = gemeenteFeatures;
    if (postcodeOverrides) {
      loadPostcodeOverrideData(postcodeOverrides);
    }
    setupFilterControls();
    setupGemeenteSearch(allFeatures);
    setPostcodePanelState("Klik op een zorggroep op de kaart om postcodes te laden.", []);
    updateGemeenteFoundDisplay();
    applyActiveFilters();
    appInitialized = true;
  } catch (error) {
    console.error(error);
    alert("Kon zorggroepdata of PDOK gemeentegebieden niet laden. Controleer Live Server en internetverbinding.");
  }
}

async function ensureMapAppInitialized() {
  if (!appInitialized) {
    await init();
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
