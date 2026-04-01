const THEME_STORAGE_KEY = "miguide_theme";

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
    toggleIcon.textContent = nextMode === "dark" ? "🌙" : "☀";
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
  setTheme(saved || "light");
  if (toggle && !toggle.dataset.themeBound) {
    toggle.dataset.themeBound = "1";
    toggle.addEventListener("click", () => setTheme(isDarkModeActive() ? "light" : "dark"));
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "-";
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }
  return new Intl.DateTimeFormat("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function renderUpdates(updates) {
  const list = document.getElementById("updatesList");
  const meta = document.getElementById("updatesMeta");
  if (!list || !meta) {
    return;
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    meta.textContent = "Geen updates";
    list.innerHTML = `
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
        Er zijn nog geen updates toegevoegd.
      </div>
    `;
    return;
  }

  meta.textContent = `${updates.length} update${updates.length === 1 ? "" : "s"}`;
  list.innerHTML = updates.map((update) => {
    const items = Array.isArray(update.summary) ? update.summary : [];
    const itemMarkup = items.length
      ? `<ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";
    const commitMarkup = update.commit
      ? `<div class="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">Commit: <code class="rounded bg-slate-100 px-1 py-0.5 text-slate-700 dark:bg-slate-950 dark:text-slate-200">${escapeHtml(update.commit)}</code></div>`
      : "";

    return `
      <article class="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/70">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-base font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(update.title || "Update")}</div>
            <div class="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">${escapeHtml(formatDate(update.date))}</div>
          </div>
          ${update.scope ? `<div class="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">${escapeHtml(update.scope)}</div>` : ""}
        </div>
        ${update.description ? `<p class="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">${escapeHtml(update.description)}</p>` : ""}
        ${itemMarkup}
        ${commitMarkup}
      </article>
    `;
  }).join("");
}

async function loadUpdates() {
  const response = await fetch("zg-data/updates.json");
  if (!response.ok) {
    throw new Error(`updates.json laden mislukt (${response.status})`);
  }
  const payload = await response.json();
  return Array.isArray(payload?.updates) ? payload.updates : [];
}

async function init() {
  initThemeToggle();
  try {
    const updates = await loadUpdates();
    renderUpdates(updates);
  } catch (error) {
    console.error(error);
    renderUpdates([]);
    const meta = document.getElementById("updatesMeta");
    if (meta) {
      meta.textContent = "Fout bij laden";
    }
  }
}

init();
