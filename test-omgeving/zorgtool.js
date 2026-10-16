/* ZorgTool testomgeving - nieuwe UI bovenop de bestaande logica.
 *
 * Alle data- en routeringslogica komt 1-op-1 uit /script/script.js (zoeken, PDOK, postcode-
 * uitzonderingen, plaatsnamen, verzekeraarregels, facturatiemodule). Dit bestand bevat alleen
 * de presentatie: paneel, autocomplete, kaartweergave, URL en het mobiele onderpaneel.
 */
"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => window.matchMedia("(max-width: 767px)").matches;
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const logicLoaded = () => typeof buildZorggroepFeatures === "function";

  const NL_BOUNDS = L.latLngBounds([50.72, 3.25], [53.58, 7.25]);
  const ui = {
    dataPromise: null,
    ready: false,
    gemeenten: [],          // namen voor autocomplete (zelfde lijst als de huidige tool)
    gemeenteByNorm: new Map(),
    layerByFeature: new Map(),
    selected: [],           // geselecteerde kaartlagen
    last: null,             // laatste zoekopdracht { kind, value }
    activeIndex: -1,
  };

  // ---------------------------------------------------------------------------------------
  // 1. Bestaande logica laden (zonder de automatische start van de huidige pagina)
  // ---------------------------------------------------------------------------------------
  function loadLogic() {
    return ZT.loadLegacyScript("/script/script.js", /\r?\ninitThemeToggle\(\);\r?\ninitAuthGate\(\);/,
      () => typeof buildZorggroepFeatures === "function");
  }

  async function loadData() {
    await loadLogic();
    fillInsurers(); // standaardlijst, wordt hieronder ververst met de admin-lijst
    const [zgData, gemeenteFeatures, overrides, insurerData] = await Promise.all([
      loadZorggroepData(),
      fetchAllGemeenteFeatures(),
      loadPostcodeOverrides(),
      loadZorgverzekeraarsData(),
    ]);
    const zorggroepen = Array.isArray(zgData.zorggroepen) ? zgData.zorggroepen : [];
    applyInsurerData(insurerData);
    applyPlaceAliases(zgData.place_aliases);
    applyZorggroepColorOverrides(zorggroepen);
    allFeatures = buildZorggroepFeatures(zorggroepen, gemeenteFeatures, extractContractsByZorggroep(zgData));
    gemeenteFeaturesStore = gemeenteFeatures;
    if (overrides) loadPostcodeOverrideData(overrides);

    ui.gemeenten = collectGemeenten(allFeatures);
    for (const f of gemeenteFeatures) ui.gemeenteByNorm.set(normalizeText(f?.properties?.naam), f);
    fillInsurers();
    fillFilters();
    drawRegions();
    ui.ready = true;
  }

  function ensureData() {
    if (!ui.dataPromise) {
      ui.dataPromise = loadData().catch((err) => {
        ui.dataPromise = null;
        throw err;
      });
    }
    return ui.dataPromise;
  }

  // ---------------------------------------------------------------------------------------
  // 2. Kaart
  // ---------------------------------------------------------------------------------------
  const lmap = L.map("map", {
    zoomControl: false,
    preferCanvas: true,
    maxBounds: NL_BOUNDS.pad(0.6), // ruim genoeg om NL rechts naast het zwevende blok te tonen
    maxBoundsViscosity: 1,
    zoomSnap: 0.25,
  });
  L.control.zoom({ position: "topright", zoomInTitle: "Inzoomen", zoomOutTitle: "Uitzoomen" }).addTo(lmap);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap",
  }).addTo(lmap);
  lmap.getContainer().querySelectorAll(".leaflet-control-zoom a").forEach((a) => a.setAttribute("aria-label", a.title));
  lmap.getContainer().setAttribute("aria-label", "Kaart met zorggroepen");

  // Minimale zoom: heel Nederland past in het kaartvenster (verder uitzoomen heeft geen zin).
  function updateMinZoom() {
    lmap.setMinZoom(0);
    const z = lmap.getBoundsZoom(NL_BOUNDS, false, L.point(0, 0));
    lmap.setMinZoom(Number.isFinite(z) ? Math.max(5, Math.floor(z * 4) / 4) : 6);
  }

  function fitNetherlands(animate = false) {
    updateMinZoom();
    lmap.fitBounds(NL_BOUNDS, { ...mapPadding(), animate });
  }

  function mapPadding() {
    if (isMobile()) {
      const visible = window.innerHeight - $("panel").getBoundingClientRect().top;
      return { paddingTopLeft: [20, 20], paddingBottomRight: [20, Math.max(20, visible + 12)] };
    }
    // Desktop: het zwevende blok linksboven bedekt de kaart; houd de focus rechts daarvan.
    const right = Math.round($("panel").getBoundingClientRect().right);
    return { paddingTopLeft: [right + 120, 40], paddingBottomRight: [40, 40] };
  }

  const mapStatus = document.createElement("div");
  mapStatus.className = "map-status";
  mapStatus.setAttribute("role", "status");
  mapStatus.hidden = true;
  lmap.getContainer().appendChild(mapStatus);
  const setMapStatus = (text) => { mapStatus.textContent = text || ""; mapStatus.hidden = !text; };

  let regionLayer = null;

  function regionStyle(feature) {
    const noContract = isNoContractFeature(feature);
    const visible = matchesMapFilters(feature);
    return {
      color: cssVar("--region-line"),
      weight: 0.8,
      opacity: 1,
      fillColor: colorFromString(getZorggroepName(feature)),
      fillOpacity: visible ? (noContract ? 0.16 : 0.34) : 0.1,
    };
  }

  function selectedStyle() {
    return { color: cssVar("--brand"), weight: 1.8, opacity: 1, fillOpacity: 0.5 };
  }

  function drawRegions() {
    if (regionLayer) regionLayer.remove();
    ui.layerByFeature.clear();
    regionLayer = L.geoJSON({ type: "FeatureCollection", features: allFeatures }, {
      style: regionStyle,
      onEachFeature: (feature, layer) => {
        ui.layerByFeature.set(feature, layer);
        layer.bindTooltip(esc(getZorggroepName(feature)), { sticky: true, direction: "top", offset: [0, -6] });
        layer.on("mouseover", () => {
          if (!ui.selected.includes(layer)) layer.setStyle({ fillColor: cssVar("--brand-tint-2"), fillOpacity: 0.6 });
        });
        layer.on("mouseout", () => {
          if (!ui.selected.includes(layer)) layer.setStyle(regionStyle(feature));
        });
        layer.on("click", () => selectRegion(feature));
      },
    }).addTo(lmap);
    applySelection(ui.selected.map((l) => l.feature));
  }

  function restyleRegions() {
    if (!regionLayer) return;
    regionLayer.eachLayer((layer) => layer.setStyle(regionStyle(layer.feature)));
    ui.selected.forEach((layer) => layer.setStyle(selectedStyle()));
  }

  function applySelection(features) {
    ui.selected.forEach((layer) => layer.setStyle(regionStyle(layer.feature)));
    ui.selected = features.map((f) => ui.layerByFeature.get(f)).filter(Boolean);
    ui.selected.forEach((layer) => { layer.setStyle(selectedStyle()); layer.bringToFront(); });
  }

  // Zelfde filtercriteria als applyActiveFilters() in de huidige tool; wat niet past wordt gedimd.
  function matchesMapFilters(feature) {
    if (currentZorgverzekeraar !== "ALL" && !featureMatchesInsurer(feature, currentZorgverzekeraar)) return false;
    if (currentDeclaratiestroom !== "ALL" && !featureMatchesDeclaratiestroom(feature, currentZorgverzekeraar, currentDeclaratiestroom)) return false;
    if (currentFilter !== "ALL" && getZorggroepName(feature) !== currentFilter) return false;
    if (currentGemeente && !featureMatchesCurrentGemeente(feature)) return false;
    return true;
  }

  function boundsForGemeente(name) {
    const f = ui.gemeenteByNorm.get(normalizeText(name));
    return f ? L.geoJSON(f).getBounds() : null;
  }

  function flyTo(bounds) {
    if (!bounds || !bounds.isValid()) return;
    const opts = { ...mapPadding(), maxZoom: 10.5 };
    if (reduceMotion) lmap.fitBounds(bounds, { ...opts, animate: false });
    else lmap.flyToBounds(bounds, { ...opts, duration: 0.8, easeLinearity: 0.25 });
  }

  // ---------------------------------------------------------------------------------------
  // 3. Resultaat (zelfde berekening als updateFacturatiemoduleContext)
  // ---------------------------------------------------------------------------------------
  function computeResult() {
    let scoped = allFeatures.slice();
    if (currentGemeente) scoped = scoped.filter((f) => featureMatchesCurrentGemeente(f));
    if (currentZorgverzekeraar !== "ALL") scoped = scoped.filter((f) => featureMatchesInsurer(f, currentZorgverzekeraar));
    if (currentFilter !== "ALL") scoped = scoped.filter((f) => getZorggroepName(f) === currentFilter);
    const feature = scoped[0];
    if (!feature) return null;

    let stroom = currentDeclaratiestroom;
    if (stroom === "ALL") {
      const set = new Set();
      for (const f of scoped) {
        if (currentZorgverzekeraar !== "ALL") {
          const rows = contractsForInsurer(f, currentZorgverzekeraar).filter((r) => r.contract !== false);
          if (rows.length) rows.forEach((r) => set.add(normalizeFacturatiestroom(r.declaratiestroom || "Onbekend", f, currentZorgverzekeraar)));
          else set.add(fallbackDeclaratiestroomForFeature(f, currentZorgverzekeraar));
        } else {
          set.add(fallbackDeclaratiestroomForFeature(f, ""));
        }
      }
      stroom = set.size === 1 ? [...set][0] : "";
    }
    const module = stroom ? resolveFacturatiemoduleName(stroom, feature, currentZorgverzekeraar) : "";
    return {
      feature,
      scoped,
      stroom,
      module,
      prestatiecode: module ? resolvePrestatiecodeByFacturatiemodule(module) : "",
      description: module ? getFacturatiemoduleDescription(module) : "",
    };
  }

  const concernLabel = (k) => (String(k).length <= 4 ? String(k).toUpperCase() : String(k).replace(/\b\w/g, (c) => c.toUpperCase()));

  // Uitleg hoe de uitkomst tot stand komt, met dezelfde regels als de berekening zelf.
  function buildWhy(r, ctx = {}) {
    const zg = getZorggroepName(r.feature);
    const insurer = currentZorgverzekeraar;
    const chain = [];
    const steps = [];
    if (ctx.kind === "postcode") {
      chain.push(`${ctx.shown}${ctx.place ? ` · ${ctx.place}` : ""}`);
      steps.push(ctx.place
        ? `Postcode ${ctx.shown} ligt in ${ctx.place}${ctx.gemeente && normalizeText(ctx.gemeente) !== normalizeText(ctx.place) ? ` (gemeente ${ctx.gemeente})` : ""}.`
        : `Postcode ${ctx.shown}.`);
    } else if (ctx.kind === "gemeente") {
      chain.push(ctx.place);
      steps.push(`Gezocht op ${ctx.place}.`);
    } else if (ctx.kind === "zorggroep") {
      steps.push(`Gebied ${zg} gekozen op de kaart.`);
    }
    if (ctx.override) {
      chain.push("postcode-uitzondering");
      steps.push(`Postcode-uitzondering: deze postcode hoort bij ${zg}${ctx.overrideNote ? ` (${ctx.overrideNote})` : ""}.`);
    }
    const noContract = isNoContractFeature(r.feature);
    chain.push(noContract ? `${zg} (geen contract)` : zg);
    steps.push(noContract
      ? `Dit gebied valt onder "${zg}": MiGuide heeft hier geen zorggroep-contract.`
      : `Dit gebied valt onder zorggroep ${zg} (gecontracteerd).`);

    if (insurer === "ALL") {
      steps.push("Geen zorgverzekeraar gekozen: dit is de standaardroute van het gebied.");
    } else {
      const key = normalizeInsurerKey(insurer);
      const special = resolveWorkbookSpecialRouting(r.feature, insurer);
      const rule = zorggroepInsurerRules.get(normalizeText(zg));
      if (special) {
        chain.push(insurer);
        steps.push(`Bijzonderheid: ${zg} + ${insurer} gaat via ${special.moduleName}.`);
      } else if (rule) {
        const listed = rule.verzekeraars.has(key);
        const applies = rule.modus === "alleen" ? !listed : listed;
        const names = [...rule.verzekeraars].map(concernLabel).join(", ");
        if (applies) {
          chain.push(rule.modus === "alleen" ? `alleen ${names}` : `uitzondering ${names}`, insurer);
          steps.push(rule.modus === "alleen"
            ? `${zg} heeft alleen contract met ${names}; ${insurer} valt daarbuiten en gaat via ${rule.module}.`
            : `Uitzondering voor ${zg}: ${names} gaat via ${rule.module}.`);
        } else {
          chain.push(insurer);
          steps.push(rule.modus === "alleen"
            ? `${insurer} valt onder ${names}: de route van ${zg} geldt.`
            : `${insurer} valt niet onder de uitzondering (${names}): de route van ${zg} geldt.`);
        }
      } else if (noContract) {
        chain.push(insurer);
        steps.push(`Zonder zorggroep-contract bepaalt de zorgverzekeraar de route: ${insurer} gaat via ${r.module || "de verzekeraar"}.`);
      } else {
        chain.push(insurer);
        steps.push(`${insurer}: de route van ${zg} geldt.`);
      }
    }
    if (r.module) {
      chain.push({ module: r.module });
      steps.push(`${r.module} → ${r.stroom}, prestatiecode ${r.prestatiecode}.`);
    }
    return `
      <div class="why">
        <p class="eyebrow">Waarom?</p>
        <div class="chain">${chain.map((c) => (typeof c === "object"
          ? `<span class="chip chip-key">${esc(c.module)}</span>`
          : `<span class="chip">${esc(c)}</span>`)).join('<span class="arrow" aria-hidden="true">→</span>')}</div>
        <details class="more why-more">
          <summary>Uitleg</summary>
          <ol class="steps">${steps.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
          ${r.description ? `<p class="desc">${esc(r.description)}</p>` : ""}
        </details>
      </div>`;
  }

  const display = (pc) => (/^\d{4}[A-Z]{2}$/.test(pc) ? `${pc.slice(0, 4)} ${pc.slice(4)}` : pc);

  function alertsHtml() {
    if (!logicLoaded()) return "";
    const out = [];
    const insurerKey = normalizeInsurerKey(currentZorgverzekeraar);
    const alert = (id, title, text, button, done) => out.push(`
      <div class="alert${done ? " is-done" : ""}" data-alert="${id}">
        <strong>${esc(title)}</strong>${esc(text)}
        <div class="alert-actions">${done ? `<span>✓ ${esc(button)}</span>` : `<button type="button" data-ack="${id}">${esc(button)}</button>`}</div>
      </div>`);
    if (ui.ready && currentSelectionIsZhz()) {
      alert("zhz", "Regio Zuid-Holland Zuid", "Verwijzingen uit deze regio mogen uitsluitend via Monter worden verwerkt, niet via Zorgdomein.", "Begrepen", zhzReferralAcknowledged);
    }
    if (insurerKey === "vgz") {
      alert("vgz", "Let op bij VGZ", "Controleer of de verwijzing afkomstig is van een huisarts of specialist. VGZ keurt declaraties niet goed als de verwijzing van een specialist komt.", "Ik heb gecontroleerd", zorgverzekeraarNoticeAcknowledged);
    }
    if (insurerKey === "rma") {
      alert("rma", "RMA (asielzoekersverzekering)", "De GLI (Gecombineerde Leefstijlinterventie) wordt niet vergoed binnen deze verzekering.", "Begrepen", rmaNoticeAcknowledged);
    }
    return out.join("");
  }

  function renderResult({ title, meta = "", note = "", postcodeItems = null, postcodeMeta = "", why = {} }) {
    const r = computeResult();
    if (!r) {
      renderEmpty(`Geen zorggroep gevonden voor ${title}`, "Controleer de invoer, of zoek op de gemeente of woonplaats.");
      return null;
    }
    const zgName = getZorggroepName(r.feature);
    const noContract = isNoContractFeature(r.feature);
    const others = r.scoped.slice(1).map(getZorggroepName);
    const insurerChosen = currentZorgverzekeraar !== "ALL";
    $("result").innerHTML = `
      <section class="section enter">
        <h2 class="title num">${esc(title)}</h2>
        ${meta ? `<p class="meta">${esc(meta)}</p>` : ""}
        <div class="zg-row">
          <span class="swatch" style="background:${esc(colorFromString(zgName))}"></span>
          <span class="zg-name">${esc(zgName)}</span>
          <span class="tag ${noContract ? "" : "tag-ok"}">${noContract ? "Geen zorggroep-contract" : "Gecontracteerd"}</span>
        </div>
        ${others.length ? `<p class="meta">Ook in dit gebied: ${esc(others.join(", "))}</p>` : ""}
        <dl class="facts">
          <div class="fact fact-key"><dt>Facturatiemodule</dt><dd>${esc(r.module || "Per zorgverzekeraar")}</dd></div>
          <div class="fact"><dt>Facturatiestroom</dt><dd>${esc(r.stroom || "Per zorgverzekeraar")}</dd></div>
          <div class="fact"><dt>Prestatiecode</dt><dd class="num">${esc(r.prestatiecode || "–")}</dd></div>
        </dl>
        ${buildWhy(r, why)}
        ${alertsHtml()}
        ${insurerChosen ? "" : `<p class="note">Kies een zorgverzekeraar: de facturatiemodule kan per verzekeraar verschillen.</p>`}
        ${note ? `<p class="note">${esc(note)}</p>` : ""}
      </section>
      <section class="section">
        <details class="more">
          <summary>Plaatsen <span class="count num" id="cityCount"></span></summary>
          <ul id="cityList" class="list"></ul>
        </details>
      </section>
      <section class="section">
        <details class="more" open>
          <summary>Postcodes</summary>
          <p id="postcodeListMeta" class="meta"></p>
          <ul id="postcodeList" class="list num"></ul>
        </details>
      </section>`;
    updateCityList(r.scoped);
    $("cityCount").textContent = `(${$("cityList").querySelectorAll("li").length})`;
    if (postcodeItems) setPostcodePanelState(postcodeMeta, postcodeItems);
    return r;
  }

  function renderIdle() {
    $("result").innerHTML = `
      <section class="section empty">
        <p class="title">Zoek op postcode of gemeente</p>
        <p class="meta">Of klik op een gebied op de kaart.</p>
        ${alertsHtml()}
      </section>`;
  }

  function renderEmpty(title, hint) {
    writeUrl(); // geen resultaat: geen misleidende deellink laten staan
    $("result").innerHTML = `
      <section class="section empty enter">
        <p class="title num">${esc(title)}</p>
        <p class="meta">${esc(hint)}</p>
        ${alertsHtml()}
      </section>`;
  }

  function renderLoading() {
    $("result").innerHTML = `<div class="skel" aria-label="Laden"><span></span><span></span><span></span><span></span><span></span></div>`;
  }

  function renderError(text) {
    $("result").innerHTML = `
      <section class="section">
        <div class="alert alert-error" role="alert"><strong>Er ging iets mis</strong>${esc(text)}
          <div class="alert-actions"><button type="button" id="retryBtn">Opnieuw proberen</button></div>
        </div>
      </section>`;
  }

  // ---------------------------------------------------------------------------------------
  // 4. Zoeken (zelfde stappen als executeSearch in de huidige tool)
  // ---------------------------------------------------------------------------------------
  async function runSearch(raw, { updateUrl = true } = {}) {
    const text = String(raw || "").trim();
    closeSuggest();
    if (!text) { resetSelection(); renderIdle(); writeUrl(); return; }
    renderLoading();
    if (isMobile()) setSheet("half");
    try {
      if (!ui.ready) setMapStatus("Kaartgegevens laden…");
      await ensureData();
      setMapStatus("");
    } catch (err) {
      console.error(err);
      setMapStatus("");
      renderError("De kaartgegevens konden niet worden geladen. Controleer de internetverbinding.");
      return;
    }
    zhzReferralAcknowledged = false;
    currentFilter = "ALL";
    $("filterZorggroep").value = "ALL";
    const compact = text.replace(/\s+/g, "");
    if (isPostcodeInput(compact)) await searchPostcode(compact, updateUrl);
    else searchGemeente(text, updateUrl);
  }

  async function searchPostcode(compact, updateUrl) {
    const pc = formatPostcode(compact) || formatPostcode4(compact);
    const shown = display(pc);
    $("q").value = shown;
    ui.last = { kind: "postcode", value: pc };
    try {
      const postcodeOverride = findPostcodeOverride(pc, currentZorgverzekeraar);
      const locationOverride = findPostcodeLocationOverride(pc);
      const [lookup, plaatsInfo] = await Promise.all([
        lookupPostcodeToGemeente(pc),
        lookupPostcodePlaatsInfo(pc).catch(() => null),
      ]);
      if (ui.last?.value !== pc) return; // inmiddels een nieuwe zoekopdracht
      const usingLocationFallback = Boolean(locationOverride && !(lookup.postcodes || []).length && !plaatsInfo);
      const override = postcodeOverride?.zorggroep
        ? postcodeOverride
        : (locationOverride?.zorggroep ? { zorggroep: locationOverride.zorggroep } : null);
      const gemeente = lookup.gemeenten[0] || plaatsInfo?.gemeentenaam || locationOverride?.gemeente || "";
      const woonplaats = plaatsInfo?.woonplaatsnaam || locationOverride?.woonplaats || "";

      if (!gemeente && !override) {
        resetSelection();
        renderEmpty(`Geen zorggroep gevonden voor ${shown}`, "Deze postcode staat niet in de PDOK-postcodedata. Controleer de postcode, of zoek op de gemeente of woonplaats.");
        return;
      }
      const hasDomain = allFeatures.some((f) => featureMatchesLocationName(f, woonplaats) || featureMatchesLocationName(f, gemeente));
      if (!hasDomain && !override) {
        resetSelection();
        renderEmpty(`Geen zorggroep gevonden voor ${shown}`, `${woonplaats || gemeente} valt niet binnen een zorggroep. Zoek eventueel op een nabije gemeente.`);
        return;
      }

      let note = `Postcode ${shown} gevonden bij ${woonplaats || gemeente}.`;
      if (override) {
        const f = getFeatureByZorggroepName(override.zorggroep);
        const name = f ? getZorggroepName(f) : override.zorggroep;
        const candidates = [woonplaats, gemeente].filter(Boolean);
        const preferred = candidates.find((n) => featureMatchesLocationName(f, n));
        setGemeenteContext(preferred ? preferred : "", candidates);
        currentFilter = f ? name : "ALL";
        const ovNote = String(override.note || "").trim();
        note = usingLocationFallback
          ? `Postbuspostcode ${shown} valt qua gemeente onder ${woonplaats || gemeente || "deze locatie"} en gebruikt ${name} als zorggroep.`
          : `Postcode ${shown} gekoppeld aan ${name}${woonplaats || gemeente ? ` bij ${woonplaats || gemeente}` : ""}.${ovNote ? ` Uitzondering: ${ovNote}` : ""}`;
      } else {
        setGemeenteContext(woonplaats || gemeente, [woonplaats, gemeente]);
      }

      let postcodeItems = [pc];
      let postcodeMeta = `Postcode ${shown}`;
      if ((lookup.postcodes || []).length) {
        const range = formatCompactRangeLine(summarizePostcodeRange(lookup.postcodes));
        postcodeItems = [range || "Geen postcode-range gevonden"];
        postcodeMeta = `Zoekresultaat ${shown} (${woonplaats || gemeente})`;
      } else if (usingLocationFallback) {
        postcodeItems = [gemeente && `Gemeente: ${gemeente}`, woonplaats && woonplaats !== gemeente && `Woonplaats: ${woonplaats}`].filter(Boolean);
        postcodeMeta = `Postbuspostcode ${shown}`;
      }

      const r = renderResult({
        why: { kind: "postcode", shown, place: woonplaats || gemeente, gemeente, override: Boolean(override), overrideNote: String(override?.note || "").trim() },
        title: `${shown}${woonplaats || gemeente ? ` · ${woonplaats || gemeente}` : ""}`,
        meta: insurerLabel(),
        note,
        postcodeItems,
        postcodeMeta,
      });
      if (!r) return;
      applySelection(r.scoped.slice(0, 1));
      restyleRegions();
      flyTo(boundsForGemeente(gemeente) || ui.layerByFeature.get(r.feature)?.getBounds());
      if (updateUrl) writeUrl("postcode", pc);
    } catch (err) {
      console.error(err);
      renderError("Postcode zoeken via PDOK is nu niet beschikbaar. Probeer het zo opnieuw of zoek op gemeente.");
    }
  }

  function searchGemeente(text, updateUrl) {
    const match = bestMatches(text)[0];
    ui.last = { kind: "gemeente", value: match || text };
    if (!match) {
      resetSelection();
      renderEmpty(`Geen zorggroep gevonden voor "${text}"`, "Controleer de spelling, kies een suggestie of zoek op postcode.");
      return;
    }
    $("q").value = match;
    setGemeenteContext(match);
    const r = renderResult({ title: match, meta: insurerLabel(), why: { kind: "gemeente", place: match } });
    if (!r) return;
    applySelection(r.scoped.slice(0, 1));
    restyleRegions();
    const gemeente = cityToGemeenteName(match, ui.gemeenteByNorm) || match;
    flyTo(boundsForGemeente(gemeente) || ui.layerByFeature.get(r.feature)?.getBounds());
    if (updateUrl) writeUrl("gemeente", match);
  }

  // Klik op een gebied: zelfde als de huidige tool (zorggroep kiezen + postcodes laden).
  function selectRegion(feature) {
    if (!ui.ready) return;
    const name = getZorggroepName(feature);
    currentFilter = name;
    setGemeenteContext("");
    $("q").value = "";
    $("filterZorggroep").value = [...$("filterZorggroep").options].some((o) => o.value === name) ? name : "ALL";
    ui.last = { kind: "zorggroep", value: name };
    const gemeenten = feature.properties?.gemeenten || [];
    const r = renderResult({
      why: { kind: "zorggroep" },
      title: name,
      meta: [feature.properties?.regio && feature.properties.regio !== name ? `Regio ${feature.properties.regio}` : "", `${gemeenten.length} gemeenten`, insurerLabel()].filter(Boolean).join(" · "),
    });
    if (!r) return;
    applySelection([feature]);
    restyleRegions();
    if (isMobile()) setSheet("half");
    loadPostcodesForFeature(feature);
    writeUrl();
  }

  function insurerLabel() {
    return currentZorgverzekeraar === "ALL" ? "Alle zorgverzekeraars" : `Zorgverzekeraar: ${currentZorgverzekeraar}`;
  }

  function resetSelection() {
    setGemeenteContext("");
    applySelection([]);
    restyleRegions();
  }

  function rerun() {
    if (ui.last?.kind === "postcode" || ui.last?.kind === "gemeente") runSearch(ui.last.value, { updateUrl: true });
    else if (ui.last?.kind === "zorggroep") {
      const f = getFeatureByZorggroepName(ui.last.value);
      if (f) selectRegion(f);
    } else {
      restyleRegions();
      renderIdle();
    }
  }

  // ---------------------------------------------------------------------------------------
  // 5. Autocomplete (combobox, toetsenbord-navigeerbaar)
  // ---------------------------------------------------------------------------------------
  function bestMatches(query) {
    const q = normalizeText(query);
    if (!q) return [];
    const starts = ui.gemeenten.filter((n) => normalizeText(n).startsWith(q));
    const contains = ui.gemeenten.filter((n) => { const v = normalizeText(n); return v.includes(q) && !v.startsWith(q); });
    return [...starts, ...contains].slice(0, 8);
  }

  let suggestTimer;
  function onInput() {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(renderSuggest, 120);
  }

  function renderSuggest() {
    const value = $("q").value.trim();
    const compact = value.replace(/\s+/g, "");
    const list = $("suggest");
    ui.activeIndex = -1;
    $("q").removeAttribute("aria-activedescendant");
    if (!value) return closeSuggest();
    let items = [];
    if (/^\d{1,4}[a-zA-Z]{0,2}$/.test(compact)) {
      const pc = formatPostcode(compact) || formatPostcode4(compact);
      items = pc ? [{ value: pc, label: `Zoek postcode ${display(pc)}` }] : [];
      if (!pc) return closeSuggest();
    } else if (!ui.ready) {
      list.innerHTML = `<li class="hint" role="presentation">Gegevens laden…</li>`;
      list.hidden = false;
      $("q").setAttribute("aria-expanded", "true");
      return;
    } else {
      items = bestMatches(value).map((n) => ({ value: n, label: n }));
    }
    if (!items.length) {
      list.innerHTML = `<li class="hint" role="presentation">Geen gemeente gevonden. Probeer een postcode.</li>`;
    } else {
      list.innerHTML = items.map((it, i) =>
        `<li id="opt-${i}" role="option" aria-selected="false" data-value="${esc(it.value)}">${esc(it.label)}</li>`).join("");
    }
    list.hidden = false;
    $("q").setAttribute("aria-expanded", "true");
  }

  function closeSuggest() {
    $("suggest").hidden = true;
    $("suggest").innerHTML = "";
    $("q").setAttribute("aria-expanded", "false");
    $("q").removeAttribute("aria-activedescendant");
    ui.activeIndex = -1;
  }

  function moveActive(delta) {
    const options = [...$("suggest").querySelectorAll('[role="option"]')];
    if (!options.length) return;
    ui.activeIndex = (ui.activeIndex + delta + options.length) % options.length;
    options.forEach((o, i) => o.setAttribute("aria-selected", String(i === ui.activeIndex)));
    $("q").setAttribute("aria-activedescendant", options[ui.activeIndex].id);
    options[ui.activeIndex].scrollIntoView({ block: "nearest" });
  }

  // ---------------------------------------------------------------------------------------
  // 6. Formulier, filters, verzekeraar
  // ---------------------------------------------------------------------------------------
  function fillInsurers() {
    const select = $("insurer");
    const current = select.value;
    const names = (typeof runtimeInsurerNames !== "undefined" && runtimeInsurerNames.length) ? runtimeInsurerNames : DEFAULT_ZORGVERZEKERAARS;
    const sorted = [...new Set(names)].sort((a, b) => a.localeCompare(b, "nl"));
    select.innerHTML = `<option value="ALL">Alle zorgverzekeraars</option>` + sorted.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
    const wanted = new URLSearchParams(location.search).get("verzekeraar");
    select.value = [...select.options].some((o) => o.value === current) && current !== "ALL" ? current : (wanted && [...select.options].some((o) => o.value === wanted) ? wanted : "ALL");
    currentZorgverzekeraar = select.value;
  }

  function fillFilters() {
    const zg = $("filterZorggroep");
    const names = [...new Set(allFeatures.map(getZorggroepName))].sort((a, b) => a.localeCompare(b, "nl"));
    zg.innerHTML = `<option value="ALL">Alle zorggroepen</option>` + names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
    const st = $("filterStroom");
    st.innerHTML = `<option value="ALL">Alle facturatiestromen</option>` + Object.values(FACTURATIESTROMEN).map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  }

  function writeUrl(kind, value) {
    const url = new URL(location.href);
    url.search = "";
    if (kind && value) url.searchParams.set(kind, value);
    if (kind && currentZorgverzekeraar !== "ALL") url.searchParams.set("verzekeraar", currentZorgverzekeraar);
    history.replaceState(null, "", url);
  }

  $("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const options = [...$("suggest").querySelectorAll('[role="option"]')];
    const chosen = ui.activeIndex >= 0 ? options[ui.activeIndex]?.dataset.value : null;
    runSearch(chosen || $("q").value);
  });
  $("q").addEventListener("input", onInput);
  $("q").addEventListener("focus", () => { if (isMobile() && sheet.state === "peek") setSheet("half"); });
  $("q").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if ($("suggest").hidden) renderSuggest(); moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    else if (e.key === "Escape") closeSuggest();
  });
  $("suggest").addEventListener("mousedown", (e) => e.preventDefault()); // focus in het veld houden
  $("suggest").addEventListener("click", (e) => {
    const opt = e.target.closest('[role="option"]');
    if (opt) runSearch(opt.dataset.value);
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".combo")) closeSuggest(); });

  $("insurer").addEventListener("change", () => {
    if (!logicLoaded()) return; // wordt na het laden alsnog overgenomen (fillInsurers)
    currentZorgverzekeraar = $("insurer").value;
    zorgverzekeraarNoticeAcknowledged = false;
    rmaNoticeAcknowledged = false;
    if (ui.ready) rerun(); else renderIdle();
  });
  $("filterZorggroep").addEventListener("change", () => {
    if (!ui.ready) return;
    const name = $("filterZorggroep").value;
    if (name === "ALL") { currentFilter = "ALL"; rerun(); return; }
    const f = getFeatureByZorggroepName(name);
    if (f) { selectRegion(f); flyTo(ui.layerByFeature.get(f)?.getBounds()); }
  });
  $("filterStroom").addEventListener("change", () => {
    if (!ui.ready) return;
    currentDeclaratiestroom = $("filterStroom").value;
    if (ui.ready) rerun();
  });

  $("resetBtn").addEventListener("click", () => {
    $("q").value = "";
    $("insurer").value = "ALL";
    $("filterZorggroep").value = "ALL";
    $("filterStroom").value = "ALL";
    if (ui.ready) {
      currentZorgverzekeraar = "ALL";
      currentFilter = "ALL";
      currentDeclaratiestroom = "ALL";
      zorgverzekeraarNoticeAcknowledged = false;
      zhzReferralAcknowledged = false;
      rmaNoticeAcknowledged = false;
      resetSelection();
    }
    ui.last = null;
    closeSuggest();
    renderIdle();
    writeUrl();
    fitNetherlands(!reduceMotion);
    $("q").focus();
  });

  $("result").addEventListener("click", (e) => {
    const ack = e.target.closest("[data-ack]");
    if (ack) {
      if (ack.dataset.ack === "zhz") zhzReferralAcknowledged = true;
      if (ack.dataset.ack === "vgz") zorgverzekeraarNoticeAcknowledged = true;
      if (ack.dataset.ack === "rma") rmaNoticeAcknowledged = true;
      const box = ack.closest(".alert");
      box.classList.add("is-done");
      ack.replaceWith(Object.assign(document.createElement("span"), { textContent: `✓ ${ack.textContent}` }));
    }
    if (e.target.closest("#retryBtn")) rerun();
  });

  // ---------------------------------------------------------------------------------------
  // 7. Thema en menu staan in site.js; bij een themawissel alleen de kaartkleuren bijwerken
  // ---------------------------------------------------------------------------------------
  document.addEventListener("zt:theme", restyleRegions);

  // ---------------------------------------------------------------------------------------
  // 8. Mobiel onderpaneel (versleepbaar; alleen transform)
  // ---------------------------------------------------------------------------------------
  const sheet = ZT.initSheet($("panel"), $("sheetHandle"));
  const setSheet = (state) => sheet.set(state);
  window.addEventListener("resize", () => {
    lmap.invalidateSize();
    updateMinZoom();
  });

  // ---------------------------------------------------------------------------------------
  // 9. Start: eerst de pagina tonen, dan de zware kaartdata laden (lazy)
  // ---------------------------------------------------------------------------------------
  renderIdle();
  setSheet("peek");
  fitNetherlands(false);
  const params = new URLSearchParams(location.search);
  const initial = params.get("postcode") || params.get("gemeente");
  if (initial) $("q").value = initial;
  // Na de eerste weergave laden (setTimeout i.p.v. requestAnimationFrame: werkt ook in een achtergrondtab).
  setTimeout(async () => {
    setMapStatus("Kaartgegevens laden…");
    try {
      await ensureData();
      setMapStatus("");
      if (initial) runSearch(initial, { updateUrl: false });
      else renderIdle();
    } catch (err) {
      console.error(err);
      setMapStatus("");
      renderError("De kaartgegevens konden niet worden geladen. Controleer de internetverbinding.");
    }
  }, 0);
})();
