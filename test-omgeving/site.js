/* MiGuide Zorgtools - testomgeving. Gedeelde code voor alle pagina's:
 * thema, menu's, wachtwoordscherm, mobiel onderpaneel en het laden van bestaande logica.
 */
"use strict";

window.ZT = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const isMobile = () => window.matchMedia("(max-width: 767px)").matches;
  const THEME_KEY = "miguide_theme";
  const AUTH_KEY = "miguide_auth_ok"; // zelfde sessie als de huidige site
  const AUTH_HASH = "9571debdee0b6cc98a87511ce8e3938c8b1617458c8a58335d1b2edb06811b64"; // zelfde als script/script.js

  // ---------- Thema (zelfde voorkeur als de rest van de site) ----------
  function isDark() {
    const t = document.documentElement.dataset.theme;
    return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function toggleTheme() {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* privé-venster: alleen deze sessie */ }
    document.dispatchEvent(new CustomEvent("zt:theme"));
  }
  document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.addEventListener("click", toggleTheme));

  // ---------- Menu's ----------
  function bindMenu(button, menu) {
    if (!button || !menu) return;
    const close = () => { menu.hidden = true; button.setAttribute("aria-expanded", "false"); };
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target)) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { close(); button.focus(); } });
  }
  bindMenu($("menuBtn"), $("menu"));

  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.querySelector(".site-nav");
  if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
      const open = !siteNav.classList.contains("is-open");
      siteNav.classList.toggle("is-open", open);
      navToggle.setAttribute("aria-expanded", String(open));
    });
  }

  // ---------- Inhoudsopgave: markeer de sectie die in beeld is ----------
  const toc = document.querySelector(".toc");
  if (toc) {
    const links = [...toc.querySelectorAll('a[href^="#"]')];
    const sections = links.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
    const update = () => {
      // Laatste sectie waarvan de bovenkant voorbij de kop is; onderaan de pagina de laatste sectie.
      let current = sections[0];
      for (const s of sections) if (s.getBoundingClientRect().top <= 120) current = s;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = sections[sections.length - 1];
      links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${current?.id}`));
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  // ---------- Wachtwoordscherm (pagina's met data-auth="required") ----------
  async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function isUnlocked() {
    try { return sessionStorage.getItem(AUTH_KEY) === "1"; } catch (e) { return false; }
  }
  function initGate() {
    if (document.body.dataset.auth !== "required" || isUnlocked()) return;
    const gate = document.createElement("div");
    gate.className = "gate";
    gate.innerHTML = `
      <form class="gate-box" novalidate>
        <img class="logo logo-light" src="/zg-data/MiGuide_Logo_Nieuw.png" alt="MiGuide" />
        <img class="logo logo-dark" src="/zg-data/MiGuide_Logo_White.png" alt="MiGuide" />
        <h1>Inloggen</h1>
        <p class="meta">Voer het wachtwoord in om de Zorgtools te openen.</p>
        <label class="label field-gap" for="gatePw">Wachtwoord</label>
        <input id="gatePw" class="field" type="password" autocomplete="current-password" required />
        <button type="submit" class="btn btn-primary">Inloggen</button>
        <p class="gate-error" id="gateError" role="alert" hidden>Onjuist wachtwoord.</p>
        <p class="meta field-gap">Geen toegang? Mail info@miguide.nl of stuur Onur een intern Teams-bericht.</p>
      </form>`;
    document.body.appendChild(gate);
    document.body.setAttribute("aria-busy", "true");
    const input = gate.querySelector("#gatePw");
    input.focus();
    gate.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      let ok = false;
      try { ok = (await sha256Hex(input.value.trim())) === AUTH_HASH; } catch (err) { ok = false; }
      if (!ok) {
        gate.querySelector("#gateError").hidden = false;
        input.select();
        return;
      }
      try { sessionStorage.setItem(AUTH_KEY, "1"); } catch (err) { /* alleen deze pagina */ }
      gate.remove();
      document.body.removeAttribute("aria-busy");
      document.dispatchEvent(new CustomEvent("zt:unlocked"));
    });
  }
  initGate();

  // ---------- Bestaande logica laden zonder de automatische start van de oude pagina ----------
  async function loadLegacyScript(url, startPattern, check) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${url} laden mislukt (${res.status})`);
    const src = await res.text();
    const start = src.search(startPattern);
    if (start === -1) throw new Error(`Startpunt in ${url} niet gevonden`);
    // Relatieve datapaden ("zg-data/...") wijzen vanuit /test-omgeving/ naar de verkeerde map:
    // absoluut maken, zodat ook de reservebestanden (bij een onbereikbare API) gevonden worden.
    const code = src.slice(0, start).replace(/(["'`])zg-data\//g, "$1/zg-data/");
    const el = document.createElement("script");
    el.textContent = `${code}\n//# sourceURL=${url.split("/").pop()}-logica.js`;
    document.head.appendChild(el);
    if (check && !check()) throw new Error(`Logica uit ${url} niet geladen`);
  }

  // ---------- Mobiel onderpaneel (versleepbaar; alleen transform) ----------
  function initSheet(panel, handle) {
    let state = "peek";
    const positions = () => {
      const h = panel.offsetHeight;
      return { full: 0, half: Math.max(0, h - window.innerHeight * 0.55), peek: Math.max(0, h - 232) };
    };
    const set = (next) => {
      if (!isMobile()) return;
      state = next;
      panel.style.setProperty("--sheet-y", `${positions()[next]}px`);
    };
    const cycle = () => set(state === "peek" ? "half" : state === "half" ? "full" : "peek");
    let startY = 0, startOffset = 0, moved = false, dragging = false;
    handle.addEventListener("pointerdown", (e) => {
      if (!isMobile()) return;
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* geen capture: slepen werkt nog steeds */ }
      dragging = true;
      startY = e.clientY;
      startOffset = positions()[state];
      moved = false;
      panel.classList.add("dragging");
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 4) moved = true;
      panel.style.setProperty("--sheet-y", `${Math.min(positions().peek, Math.max(0, startOffset + dy))}px`);
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove("dragging");
      if (!moved) { cycle(); return; }
      const y = parseFloat(getComputedStyle(panel).getPropertyValue("--sheet-y")) || 0;
      set(Object.entries(positions()).sort((a, b) => Math.abs(a[1] - y) - Math.abs(b[1] - y))[0][0]);
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
    // Toetsenbord: Enter/spatie wisselt de stand, pijltjes schuiven op en neer.
    handle.addEventListener("click", (e) => { if (e.detail === 0) cycle(); });
    handle.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp") { e.preventDefault(); set(state === "peek" ? "half" : "full"); }
      if (e.key === "ArrowDown") { e.preventDefault(); set(state === "full" ? "half" : "peek"); }
    });
    window.addEventListener("resize", () => { if (isMobile()) set(state); });
    set("peek");
    return { set, get state() { return state; } };
  }

  // ---------- Datum zoals op de huidige updates-pagina ----------
  function formatDate(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value || "–")
      : new Intl.DateTimeFormat("nl-NL", { year: "numeric", month: "long", day: "numeric" }).format(d);
  }

  return { $, esc, isMobile, isDark, loadLegacyScript, initSheet, formatDate, isUnlocked };
})();
