const THEME_STORAGE_KEY = "miguide_theme";

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
    toggleIcon.textContent = nextMode === "dark" ? "☀" : "🌙";
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

async function loadData() {
  const [zorggroepenRes, ocrRes] = await Promise.all([
    fetch("zg-data/zorggroepen.json"),
    fetch("zg-data/declaratiestroomfoto_ocr.json"),
  ]);

  if (!zorggroepenRes.ok) {
    throw new Error(`zorggroepen.json laden mislukt (${zorggroepenRes.status})`);
  }
  if (!ocrRes.ok) {
    throw new Error(`declaratiestroomfoto_ocr.json laden mislukt (${ocrRes.status})`);
  }

  const zorggroepenData = await zorggroepenRes.json();
  const ocrData = await ocrRes.json();

  const zorggroepen = Array.isArray(zorggroepenData.zorggroepen) ? zorggroepenData.zorggroepen : [];

  const summary = document.getElementById("zorggroepenSummary");
  if (summary) {
    const totalCities = zorggroepen.reduce((sum, z) => sum + (Array.isArray(z.cities) ? z.cities.length : 0), 0);
    summary.textContent = `${zorggroepen.length} zorggroepen • ${totalCities} plaatsen in bronbestand`;
  }

  fillTable("zorggroepenTable", zorggroepen, [
    { key: "zorggroep" },
    { key: "regio" },
    { value: (row) => Array.isArray(row.cities) ? row.cities.length : 0 },
    { value: (row) => row.website || "-" },
  ]);

  fillTable("verzekeraarsTable", ocrData.verzekeraar_facturatiestromen || [], [
    { key: "zorgverzekeraar" },
    { key: "facturatiestroom" },
    { value: (row) => row.detected_in_ocr ? "Ja" : "Nee" },
  ]);

  fillTable("zorggroepStromenTable", ocrData.zorggroep_facturatiestromen || [], [
    { key: "zorggroep" },
    { key: "facturatiestroom" },
    { value: (row) => row.detected_in_ocr ? "Ja" : "Nee" },
  ]);

  fillTable("templatesTable", ocrData.facturatiemodule_templates || [], [
    { key: "naam" },
    { key: "beschrijving" },
    { value: (row) => row.detected_in_ocr ? "Ja" : "Nee" },
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
