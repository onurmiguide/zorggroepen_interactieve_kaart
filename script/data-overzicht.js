const THEME_STORAGE_KEY = "miguide_theme";

const FACTURATIESTROMEN = {
  STROOM_1: "Stroom 1 - Zorggroep declaraties",
  STROOM_2: "Stroom 2 - VECOZO Gecontracteerde Zorg",
  STROOM_3: "Stroom 3 - Niet gecontracteerde Zorg - Losse Facturen",
  STROOM_4: "Stroom 4 - Gezondheid Amsterdam GA",
  STROOM_5: "Stroom 5 - ZoHealthy"
};

const FALLBACK_OCR_DATA = {
  verzekeraar_facturatiestromen: [
    { zorgverzekeraar: "a.s.r.", facturatiestroom: FACTURATIESTROMEN.STROOM_2, detected_in_ocr: false },
    { zorgverzekeraar: "Menzis Digitaal 2026", facturatiestroom: FACTURATIESTROMEN.STROOM_2, detected_in_ocr: false },
    { zorgverzekeraar: "ONVZ", facturatiestroom: FACTURATIESTROMEN.STROOM_2, detected_in_ocr: false },
    { zorgverzekeraar: "VGZ", facturatiestroom: FACTURATIESTROMEN.STROOM_2, detected_in_ocr: false },
    { zorgverzekeraar: "Zilveren Kruis (Achmea)", facturatiestroom: FACTURATIESTROMEN.STROOM_2, detected_in_ocr: false },
    { zorgverzekeraar: "Aevitae (Eucare)", facturatiestroom: FACTURATIESTROMEN.STROOM_3, detected_in_ocr: false },
    { zorgverzekeraar: "CZ", facturatiestroom: FACTURATIESTROMEN.STROOM_3, detected_in_ocr: false },
    { zorgverzekeraar: "DSW", facturatiestroom: FACTURATIESTROMEN.STROOM_3, detected_in_ocr: false },
    { zorgverzekeraar: "Salland", facturatiestroom: FACTURATIESTROMEN.STROOM_3, detected_in_ocr: false },
    { zorgverzekeraar: "Zorg & Zekerheid", facturatiestroom: FACTURATIESTROMEN.STROOM_3, detected_in_ocr: false }
  ],
  zorggroep_facturatiestromen: [
    { zorggroep: "Almere", facturatiestroom: FACTURATIESTROMEN.STROOM_1, detected_in_ocr: false },
    { zorggroep: "Amstelland Zorg", facturatiestroom: FACTURATIESTROMEN.STROOM_1, detected_in_ocr: false },
    { zorggroep: "Eemland Huisartsen", facturatiestroom: FACTURATIESTROMEN.STROOM_1, detected_in_ocr: false },
    { zorggroep: "Hadoks", facturatiestroom: FACTURATIESTROMEN.STROOM_1, detected_in_ocr: false },
    { zorggroep: "HOOG", facturatiestroom: "Afhankelijk van zorgverzekeraar (Stroom 2/3)", detected_in_ocr: false },
    { zorggroep: "HOZL", facturatiestroom: FACTURATIESTROMEN.STROOM_1, detected_in_ocr: false },
    { zorggroep: "West-Friesland / HWFriesland", facturatiestroom: FACTURATIESTROMEN.STROOM_1, detected_in_ocr: false },
    { zorggroep: "Kennemerland", facturatiestroom: "Afhankelijk van zorgverzekeraar (Stroom 2/3)", detected_in_ocr: false },
    { zorggroep: "Ketenzorg Friesland", facturatiestroom: FACTURATIESTROMEN.STROOM_1, detected_in_ocr: false },
    { zorggroep: "Kop NoordHolland", facturatiestroom: "Afhankelijk van zorgverzekeraar (Stroom 2/3)", detected_in_ocr: false },
    { zorggroep: "Medita / Meditta", facturatiestroom: FACTURATIESTROMEN.STROOM_1, detected_in_ocr: false },
    { zorggroep: "RHOGO", facturatiestroom: FACTURATIESTROMEN.STROOM_1, detected_in_ocr: false },
    { zorggroep: "Rijn en Duin", facturatiestroom: FACTURATIESTROMEN.STROOM_1, detected_in_ocr: false },
    { zorggroep: "Rijnmond Dokters", facturatiestroom: FACTURATIESTROMEN.STROOM_1, detected_in_ocr: false },
    { zorggroep: "StroomZ / PostZ", facturatiestroom: FACTURATIESTROMEN.STROOM_1, detected_in_ocr: false },
    { zorggroep: "TOP Twente", facturatiestroom: "Afhankelijk van zorgverzekeraar (Stroom 2/3)", detected_in_ocr: false },
    { zorggroep: "Unicum", facturatiestroom: FACTURATIESTROMEN.STROOM_1, detected_in_ocr: false },
    { zorggroep: "ZIO", facturatiestroom: FACTURATIESTROMEN.STROOM_1, detected_in_ocr: false },
    { zorggroep: "Zuid-Holland-Zuid", facturatiestroom: "Afhankelijk van zorgverzekeraar (Stroom 2/3)", detected_in_ocr: false },
    { zorggroep: "Zorggroep Gezondheid Amsterdam", facturatiestroom: FACTURATIESTROMEN.STROOM_4, detected_in_ocr: false }
  ],
  facturatiemodule_templates: [
    { naam: "VIPLive", beschrijving: "Module binnen Stroom 1 (zorggroep declaraties).", detected_in_ocr: false },
    { naam: "cBoards", beschrijving: "Module binnen Stroom 1 (zorggroep declaraties).", detected_in_ocr: false },
    { naam: "Medix", beschrijving: "Module binnen Stroom 1 (zorggroep declaraties).", detected_in_ocr: false },
    { naam: "Nis", beschrijving: "Module binnen Stroom 1 (zorggroep declaraties).", detected_in_ocr: false },
    { naam: "Kysios", beschrijving: "Module binnen Stroom 1 (zorggroep declaraties).", detected_in_ocr: false },
    { naam: "VECOZO", beschrijving: "Kanaal voor Stroom 2 (gecontracteerde zorg).", detected_in_ocr: false },
    { naam: "Gezondheid Amsterdam (GA)", beschrijving: "Route voor Stroom 4 (GA).", detected_in_ocr: false },
    { naam: "ZoHealthy", beschrijving: "Route voor Stroom 5 (ZoHealthy).", detected_in_ocr: false },
    { naam: "Stroom 5 cohort: 1 dec 2024 - 1 apr 2025", beschrijving: "ZoHealthy (Stroom 5) voor deelnemers in deze periode.", detected_in_ocr: false },
    { naam: "Stroom 5 cohort: 10 okt 2025 - 31 dec 2025", beschrijving: "ZoHealthy (Stroom 5) voor deelnemers in deze periode.", detected_in_ocr: false },
    { naam: "Het Huisartsen Team (HHT)", beschrijving: "ZoHealthy-context (Stroom 5) volgens jouw aangeleverde indeling.", detected_in_ocr: false },
    { naam: "Huisartsen Zorggroep Breda (HZGB)", beschrijving: "ZoHealthy-context (Stroom 5) volgens jouw aangeleverde indeling.", detected_in_ocr: false },
    { naam: "MiGuide", beschrijving: "Facturatiemodule template in MiGuide-overzicht (zorgverzekeraarroute).", detected_in_ocr: false },
    { naam: "MiGuide - VGZ", beschrijving: "VGZ-specifieke MiGuide facturatiemodule.", detected_in_ocr: false },
    { naam: "Zuid Holland Zuid - CZ", beschrijving: "GLI-ZHZ-CZ route (CZ-gebied) via statische declarant.", detected_in_ocr: false },
    { naam: "Zuid Holland Zuid - VGZ", beschrijving: "GLI-ZHZ-VGZ route (VGZ-gebied) via statische declarant.", detected_in_ocr: false }
  ],
  warnings: [
    "OCR JSON ontbreekt op deployment; fallback mapping wordt getoond.",
    "Stroom 5 (ZoHealthy) kan deelnemer-/cohortafhankelijk zijn en is niet volledig afleidbaar uit alleen zorggroepgrenzen."
  ]
};

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeInsurerStroom(row) {
  const name = normalizeText(row?.zorgverzekeraar || row?.verzekeraar || "");
  if (["a s r", "menzis digitaal 2026", "onvz", "vgz", "zilveren kruis achmea"].includes(name)) {
    return FACTURATIESTROMEN.STROOM_2;
  }
  if (["aevitae eucare", "cz", "dsw", "salland", "zorg zekerheid"].includes(name)) {
    return FACTURATIESTROMEN.STROOM_3;
  }
  return row?.facturatiestroom || "-";
}

function normalizeZorggroepStroom(row) {
  const zorggroep = normalizeText(row?.zorggroep || "");
  const raw = normalizeText(row?.facturatiestroom || "");

  if (zorggroep.includes("gezondheid amsterdam")) {
    return FACTURATIESTROMEN.STROOM_4;
  }
  if (raw.includes("declaratiestromen per zorgverzekeraar")) {
    return "Afhankelijk van zorgverzekeraar (Stroom 2/3)";
  }
  if (raw.includes("vecozo")) {
    return FACTURATIESTROMEN.STROOM_2;
  }
  if (raw.includes("losse facturen")) {
    return FACTURATIESTROMEN.STROOM_3;
  }
  if (raw.includes("zohealthy")) {
    return FACTURATIESTROMEN.STROOM_5;
  }
  if (["viplive", "boards", "cboards", "medix", "nis", "kysios", "monter", "evry"].some((t) => raw.includes(t))) {
    return FACTURATIESTROMEN.STROOM_1;
  }
  if (raw.includes("op factuur achteraf") || raw.includes("extern monter")) {
    return FACTURATIESTROMEN.STROOM_1;
  }

  return row?.facturatiestroom || "-";
}

function isDarkModeActive() {
  return document.body.classList.contains("dark-mode");
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
    toggleIcon.textContent = nextMode === "dark" ? "\uD83C\uDF19" : "\u2600";
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
  if (toggle && !toggle.dataset.themeBound) {
    toggle.dataset.themeBound = "1";
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

  const verzekeraarRows = (ocrData.verzekeraar_facturatiestromen || []).map((row) => ({
    ...row,
    facturatiestroom: normalizeInsurerStroom(row)
  }));
  const zorggroepStroomRows = (ocrData.zorggroep_facturatiestromen || []).map((row) => ({
    ...row,
    facturatiestroom: normalizeZorggroepStroom(row)
  }));

  fillTable("verzekeraarsTable", verzekeraarRows, [
    { key: "zorgverzekeraar" },
    { key: "facturatiestroom" },
    { value: (row) => (row.detected_in_ocr ? "Ja" : "Nee") }
  ]);

  fillTable("zorggroepStromenTable", zorggroepStroomRows, [
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
