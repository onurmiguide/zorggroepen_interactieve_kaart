const THEME_STORAGE_KEY = "miguide_theme";

const FALLBACK_OCR_DATA = {
  verzekeraar_facturatiestromen: [
    { zorgverzekeraar: "a.s.r.", facturatiestroom: "VECOZO", detected_in_ocr: false },
    { zorgverzekeraar: "Menzis Digitaal 2026", facturatiestroom: "VECOZO", detected_in_ocr: false },
    { zorgverzekeraar: "ONVZ", facturatiestroom: "VECOZO", detected_in_ocr: false },
    { zorgverzekeraar: "VGZ", facturatiestroom: "VECOZO", detected_in_ocr: false },
    { zorgverzekeraar: "Zilveren Kruis (Achmea)", facturatiestroom: "VECOZO", detected_in_ocr: false },
    { zorgverzekeraar: "Aevitae (Eucare)", facturatiestroom: "Losse facturen & ZoHealthy", detected_in_ocr: false },
    { zorgverzekeraar: "CZ", facturatiestroom: "Losse facturen & ZoHealthy", detected_in_ocr: false },
    { zorgverzekeraar: "DSW", facturatiestroom: "Losse facturen & ZoHealthy", detected_in_ocr: false },
    { zorgverzekeraar: "Salland", facturatiestroom: "Losse facturen & ZoHealthy", detected_in_ocr: false },
    { zorgverzekeraar: "Zorg & Zekerheid", facturatiestroom: "Losse facturen & ZoHealthy", detected_in_ocr: false }
  ],
  zorggroep_facturatiestromen: [
    { zorggroep: "Almere", facturatiestroom: "Op factuur achteraf", detected_in_ocr: false },
    { zorggroep: "Amstelland Zorg", facturatiestroom: "Extern Monter Systeem", detected_in_ocr: false },
    { zorggroep: "Eemland Huisartsen", facturatiestroom: "Boards", detected_in_ocr: false },
    { zorggroep: "Hadoks", facturatiestroom: "Evry -> Per 1 Maart 2026 nieuw systeem", detected_in_ocr: false },
    { zorggroep: "HOOG", facturatiestroom: "Declaratiestromen per zorgverzekeraar", detected_in_ocr: false },
    { zorggroep: "HOZL", facturatiestroom: "VIPLive", detected_in_ocr: false },
    { zorggroep: "West-Friesland / HWFriesland", facturatiestroom: "WAS BOARDS -> Via Declarant Optie Monter?", detected_in_ocr: false },
    { zorggroep: "Kennemerland", facturatiestroom: "Declaratiestromen per zorgverzekeraar", detected_in_ocr: false },
    { zorggroep: "Ketenzorg Friesland", facturatiestroom: "VIPLive", detected_in_ocr: false },
    { zorggroep: "Kop NoordHolland", facturatiestroom: "Declaratiestromen per zorgverzekeraar", detected_in_ocr: false },
    { zorggroep: "Medita / Meditta", facturatiestroom: "VIPLive", detected_in_ocr: false },
    { zorggroep: "RHOGO", facturatiestroom: "VIPLive", detected_in_ocr: false },
    { zorggroep: "Rijn en Duin", facturatiestroom: "VIPLive", detected_in_ocr: false },
    { zorggroep: "Rijnmond Dokters", facturatiestroom: "VIPLive", detected_in_ocr: false },
    { zorggroep: "StroomZ / PostZ", facturatiestroom: "VIPLive", detected_in_ocr: false },
    { zorggroep: "TOP Twente", facturatiestroom: "Declaratiestromen per zorgverzekeraar", detected_in_ocr: false },
    { zorggroep: "Unicum", facturatiestroom: "VIPLive - Op factuur achteraf", detected_in_ocr: false },
    { zorggroep: "ZIO", facturatiestroom: "Medix", detected_in_ocr: false },
    { zorggroep: "Zuid-Holland-Zuid", facturatiestroom: "Declaratiestromen per zorgverzekeraar", detected_in_ocr: false },
    { zorggroep: "Zorggroep Gezondheid Amsterdam", facturatiestroom: "Declaratiestromen per zorgverzekeraar", detected_in_ocr: false }
  ],
  facturatiemodule_templates: [
    { naam: "CoOL via zorggroep", beschrijving: "CoOL via zorggroep (algemene zorggroep-facturatieroute).", detected_in_ocr: false },
    { naam: "CoOL via ZORGVERZEKERAAR - via GA", beschrijving: "CoOL via zorgverzekeraar via GA-route.", detected_in_ocr: false },
    { naam: "Gezondheid Amsterdam (GA)", beschrijving: "GA-regio declaraties periodiek via XML-aanlevering aan GA.", detected_in_ocr: false },
    { naam: "MiGuide", beschrijving: "Direct declareren vanuit MiGuide aan zorgverzekeraars (niet-VGZ).", detected_in_ocr: false },
    { naam: "MiGuide - VGZ", beschrijving: "Direct declareren vanuit MiGuide aan VGZ.", detected_in_ocr: false },
    { naam: "ZoHealthy", beschrijving: "Declaraties via ZoHealthy, met ZoHealthy verkooptarieven.", detected_in_ocr: false },
    { naam: "Zorggroep", beschrijving: "Declaraties via zorggroepomgeving/platform (bijv. VIPLive/Monter).", detected_in_ocr: false },
    { naam: "Zuid Holland Zuid - CZ", beschrijving: "GLI-ZHZ-CZ route (CZ-gebied) via statische declarant.", detected_in_ocr: false },
    { naam: "Zuid Holland Zuid - VGZ", beschrijving: "GLI-ZHZ-VGZ route (VGZ-gebied) via statische declarant.", detected_in_ocr: false }
  ],
  warnings: ["OCR JSON ontbreekt op deployment; fallback mapping wordt getoond."]
};

function isDarkModeActive() {
  return document.body.classList.contains("dark-mode");
}

function setTheme(mode) {
  const nextMode = mode === "dark" ? "dark" : "light";
  document.body.classList.toggle("dark-mode", nextMode === "dark");
  localStorage.setItem(THEME_STORAGE_KEY, nextMode);

  const toggle = document.getElementById("themeToggle");
  const toggleIcon = document.getElementById("themeToggleIcon");
  if (toggle) {
    toggle.setAttribute("aria-label", nextMode === "dark" ? "Schakel naar light mode" : "Schakel naar dark mode");
    toggle.setAttribute("title", nextMode === "dark" ? "Light mode" : "Dark mode");
  }
  if (toggleIcon) {
    toggleIcon.textContent = nextMode === "dark" ? "\u2600" : "\uD83C\uDF19";
  }

  const siteLogo = document.getElementById("siteLogo");
  if (siteLogo) {
    const lightLogo = siteLogo.getAttribute("data-logo-light");
    const darkLogo = siteLogo.getAttribute("data-logo-dark");
    siteLogo.src = nextMode === "dark" ? (darkLogo || lightLogo || siteLogo.src) : (lightLogo || siteLogo.src);
  }
}

function initThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  const preferred = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(saved || preferred);
  if (toggle) {
    toggle.addEventListener("click", () => setTheme(isDarkModeActive() ? "light" : "dark"));
  }
}

function fillTable(tableId, rows, columns) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) {
    return;
  }
  tbody.innerHTML = "";

  if (!rows || rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = columns.length;
    td.textContent = "Geen data";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const col of columns) {
      const td = document.createElement("td");
      const value = typeof col.value === "function" ? col.value(row) : row[col.key];
      td.textContent = value == null || value === "" ? "-" : String(value);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

async function loadJsonOptional(path, fallback) {
  try {
    const res = await fetch(path);
    if (!res.ok) {
      return fallback;
    }
    return await res.json();
  } catch (error) {
    console.warn(`Optionele data niet geladen: ${path}`, error);
    return fallback;
  }
}

async function loadData() {
  const zorggroepenRes = await fetch("zg-data/zorggroepen.json");
  if (!zorggroepenRes.ok) {
    throw new Error(`zorggroepen.json laden mislukt (${zorggroepenRes.status})`);
  }

  const zorggroepenData = await zorggroepenRes.json();
  const ocrData = await loadJsonOptional("zg-data/declaratiestroomfoto_ocr.json", FALLBACK_OCR_DATA);
  const zorggroepen = Array.isArray(zorggroepenData.zorggroepen) ? zorggroepenData.zorggroepen : [];

  const summary = document.getElementById("zorggroepenSummary");
  if (summary) {
    const totalCities = zorggroepen.reduce((sum, z) => sum + (Array.isArray(z.cities) ? z.cities.length : 0), 0);
    summary.textContent = `${zorggroepen.length} zorggroepen • ${totalCities} plaatsen in bronbestand`;
  }

  fillTable("zorggroepenTable", zorggroepen, [
    { key: "zorggroep" },
    { key: "regio" },
    { value: (row) => (Array.isArray(row.cities) ? row.cities.length : 0) },
    { value: (row) => row.website || "-" }
  ]);

  fillTable("verzekeraarsTable", ocrData.verzekeraar_facturatiestromen || [], [
    { key: "zorgverzekeraar" },
    { key: "facturatiestroom" },
    { value: (row) => (row.detected_in_ocr ? "Ja" : "Nee") }
  ]);

  fillTable("zorggroepStromenTable", ocrData.zorggroep_facturatiestromen || [], [
    { key: "zorggroep" },
    { key: "facturatiestroom" },
    { value: (row) => (row.detected_in_ocr ? "Ja" : "Nee") }
  ]);

  fillTable("templatesTable", ocrData.facturatiemodule_templates || [], [
    { key: "naam" },
    { key: "beschrijving" },
    { value: (row) => (row.detected_in_ocr ? "Ja" : "Nee") }
  ]);

  const warningsList = document.getElementById("warningsList");
  if (warningsList) {
    const warnings = Array.isArray(ocrData.warnings) ? ocrData.warnings : [];
    warningsList.innerHTML = warnings.length
      ? warnings.map((w) => `<li>${w}</li>`).join("")
      : "<li>Geen warnings</li>";
  }
}

async function init() {
  initThemeToggle();
  try {
    await loadData();
  } catch (error) {
    console.error(error);
    const summary = document.getElementById("zorggroepenSummary");
    if (summary) {
      summary.textContent = "Fout bij laden van data";
    }
  }
}

init();
