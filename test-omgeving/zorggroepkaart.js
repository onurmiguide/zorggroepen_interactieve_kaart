/* Zorggroep kaart - testomgeving. Nieuwe UI bovenop de bestaande logica van
 * /script/alle-zorggroepen.js (zelfde data, gecontracteerd/geen-contract-lagen, directory en info).
 */
"use strict";

(() => {
  const { $, esc, isMobile } = ZT;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const NL_BOUNDS = L.latLngBounds([50.72, 3.25], [53.58, 7.25]);
  const KIND = { CONTRACT: "contract", NC: "nc", UNC: "unc" };

  const st = {
    ready: false,
    filter: "all",
    infoByGroup: new Map(),
    dir: { all: [], contracted: [], "no-contract": [] },
    uncoveredCount: 0,
    layers: {},              // kind -> L.GeoJSON
    layerByName: new Map(),  // genormaliseerde naam -> laag (gecontracteerd of geen-contract-zorggroep)
    selected: null,
  };

  // ---------------------------------------------------------------------------------------
  // Kaart
  // ---------------------------------------------------------------------------------------
  const lmap = L.map("map", { zoomControl: false, preferCanvas: true, maxBounds: NL_BOUNDS.pad(0.6), maxBoundsViscosity: 1, zoomSnap: 0.25 });
  L.control.zoom({ position: "topright", zoomInTitle: "Inzoomen", zoomOutTitle: "Uitzoomen" }).addTo(lmap);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(lmap);
  lmap.getContainer().querySelectorAll(".leaflet-control-zoom a").forEach((a) => a.setAttribute("aria-label", a.title));

  const mapStatus = document.createElement("div");
  mapStatus.className = "map-status";
  mapStatus.setAttribute("role", "status");
  mapStatus.hidden = true;
  lmap.getContainer().appendChild(mapStatus);
  const setMapStatus = (text) => { mapStatus.textContent = text || ""; mapStatus.hidden = !text; };

  function updateMinZoom() {
    lmap.setMinZoom(0);
    const z = lmap.getBoundsZoom(NL_BOUNDS, false, L.point(0, 0));
    lmap.setMinZoom(Number.isFinite(z) ? Math.max(5, Math.floor(z * 4) / 4) : 6);
  }
  function mapPadding() {
    if (isMobile()) {
      const visible = window.innerHeight - $("panel").getBoundingClientRect().top;
      return { paddingTopLeft: [20, 20], paddingBottomRight: [20, Math.max(20, visible + 12)] };
    }
    const right = Math.round($("panel").getBoundingClientRect().right);
    return { paddingTopLeft: [right + 120, 40], paddingBottomRight: [40, 40] };
  }
  function fitNetherlands(animate = false) {
    updateMinZoom();
    lmap.fitBounds(NL_BOUNDS, { ...mapPadding(), animate });
  }
  function flyTo(bounds) {
    if (!bounds || !bounds.isValid()) return;
    const opts = { ...mapPadding(), maxZoom: 10 };
    if (reduceMotion) lmap.fitBounds(bounds, { ...opts, animate: false });
    else lmap.flyToBounds(bounds, { ...opts, duration: 0.8, easeLinearity: 0.25 });
  }

  // ---------------------------------------------------------------------------------------
  // Stijlen (zelfde lagen als de huidige kaart, in de nieuwe kleuren)
  // ---------------------------------------------------------------------------------------
  function baseStyle(kind, feature) {
    const line = { color: cssVar("--region-line"), weight: 0.8, opacity: 1 };
    if (kind === KIND.CONTRACT) return { ...line, fillColor: colorFromString(feature.properties.zorggroep), fillOpacity: 0.36 };
    if (kind === KIND.NC) return { ...line, fillColor: cssVar("--nc-fill"), fillOpacity: 0.6 };
    return { ...line, fillColor: cssVar("--unc-fill"), fillOpacity: 0.5 };
  }
  const hoverStyle = () => ({ fillColor: cssVar("--brand-tint-2"), fillOpacity: 0.65 });
  const selectedStyle = () => ({ color: cssVar("--brand"), weight: 1.8, opacity: 1, fillOpacity: 0.55 });

  function restyle() {
    Object.entries(st.layers).forEach(([kind, group]) => group.eachLayer((l) => l.setStyle(baseStyle(kind, l.feature))));
    if (st.selected) st.selected.setStyle(selectedStyle());
  }
  document.addEventListener("zt:theme", restyle);

  function makeLayer(kind, features) {
    const group = L.geoJSON({ type: "FeatureCollection", features }, {
      style: (f) => baseStyle(kind, f),
      onEachFeature: (feature, layer) => {
        layer._ztKind = kind;
        const p = feature.properties || {};
        const tip = kind === KIND.CONTRACT
          ? `<strong>${esc(p.zorggroep)}</strong><br>Gecontracteerd`
          : kind === KIND.NC
            ? `<strong>${esc(p.zorggroep)}</strong><br>${esc((p.gemeenten || []).join(", "))} · Geen contract`
            : `<strong>Geen contract met MiGuide</strong><br>${esc(p.naam)}`;
        layer.bindTooltip(tip, { sticky: true, direction: "top", offset: [0, -6] });
        if (kind !== KIND.UNC) st.layerByName.set(normalizeText(p.zorggroep), layer);
        layer.on("mouseover", () => { if (layer !== st.selected) layer.setStyle(hoverStyle()); });
        layer.on("mouseout", () => { if (layer !== st.selected) layer.setStyle(baseStyle(kind, feature)); });
        layer.on("click", () => select(layer, { fly: false }));
      },
    });
    st.layers[kind] = group;
    return group;
  }

  function applyFilter() {
    const show = {
      [KIND.CONTRACT]: st.filter === "all" || st.filter === "contracted",
      [KIND.NC]: st.filter === "all" || st.filter === "no-contract",
      [KIND.UNC]: st.filter === "all" || st.filter === "no-contract",
    };
    // Volgorde: grijs onder, gecontracteerd bovenop (zoals de huidige kaart).
    [KIND.UNC, KIND.NC, KIND.CONTRACT].forEach((kind) => {
      const group = st.layers[kind];
      if (!group) return;
      if (show[kind] && !lmap.hasLayer(group)) group.addTo(lmap);
      if (!show[kind] && lmap.hasLayer(group)) group.remove();
    });
    if (st.selected && !lmap.hasLayer(st.layers[st.selected._ztKind])) clearSelection();
    document.querySelectorAll("[data-filter]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === st.filter)));
    renderDirectory();
  }

  // ---------------------------------------------------------------------------------------
  // Selectie en details (zelfde inhoud als de pop-ups van de huidige kaart)
  // ---------------------------------------------------------------------------------------
  function select(layer, { fly = true } = {}) {
    if (st.selected && st.selected !== layer) st.selected.setStyle(baseStyle(st.selected._ztKind, st.selected.feature));
    st.selected = layer;
    layer.setStyle(selectedStyle());
    layer.bringToFront();
    renderDetail(layer);
    renderDirectory();
    if (fly) flyTo(layer.getBounds());
    if (isMobile()) sheet.set("half");
  }

  function clearSelection() {
    if (st.selected) st.selected.setStyle(baseStyle(st.selected._ztKind, st.selected.feature));
    st.selected = null;
    renderDetail(null);
    renderDirectory();
  }

  function infoItems(entries) {
    return `<ul class="info-list">${entries.map((e) => `
      <li><strong>${esc(e.name || "Onbekend")}</strong>
        ${e.note ? `<span class="muted">${esc(e.note)}</span>` : ""}
        ${e.website ? `<a href="${esc(e.website)}" target="_blank" rel="noopener noreferrer">${esc(e.website)}</a>` : `<span class="muted">Geen website gekoppeld</span>`}
      </li>`).join("")}</ul>`;
  }

  function renderDetail(layer) {
    const box = $("detail");
    if (!layer) {
      box.innerHTML = `<p class="title">Kies een gebied</p><p class="meta">Klik op de kaart of kies een zorggroep in de lijst hieronder.</p>`;
      return;
    }
    const p = layer.feature.properties || {};
    const kind = layer._ztKind;
    const gemeenten = Array.isArray(p.gemeenten) ? p.gemeenten : (p.naam ? [p.naam] : []);
    let tag, title, info;
    if (kind === KIND.CONTRACT) {
      tag = `<span class="tag tag-ok">Gecontracteerd</span>`;
      title = p.zorggroep;
      const entries = st.infoByGroup.get(normalizeText(p.zorggroep)) || [];
      info = infoItems(entries.length ? entries : [{ name: p.zorggroep, website: p.website || "", note: "Nog geen extra directory-informatie gekoppeld voor deze kaartregio." }]);
    } else if (kind === KIND.NC) {
      tag = `<span class="tag">Geen contract met MiGuide</span>`;
      title = p.zorggroep;
      info = infoItems([{ name: p.zorggroep, website: p.website || "", note: p.note || "Voor deze zorggroep is nog geen contract met MiGuide gekoppeld." }]);
    } else {
      tag = `<span class="tag">Geen contract met MiGuide</span>`;
      title = p.naam;
      info = `<p class="note">Voor deze gemeente is geen zorggroep met contract bekend.</p>`;
    }
    box.innerHTML = `
      <div class="enter">
        <div class="detail-head">
          <div>${tag}<h2 class="title" style="margin-top:6px">${esc(title)}</h2></div>
          <button type="button" class="icon-btn" id="detailClose" aria-label="Selectie sluiten">✕</button>
        </div>
        ${gemeenten.length ? `<p class="meta">${gemeenten.length} gemeente${gemeenten.length === 1 ? "" : "n"}: ${esc(gemeenten.join(", "))}</p>` : ""}
        ${info}
      </div>`;
    $("detailClose").addEventListener("click", clearSelection);
  }

  // ---------------------------------------------------------------------------------------
  // Lijst (zelfde directory en toelichting als de huidige kaart)
  // ---------------------------------------------------------------------------------------
  function renderDirectory() {
    const entries = st.dir[st.filter] || [];
    $("dirCount").textContent = `${entries.length} zorggroep${entries.length === 1 ? "" : "en"}`;
    const selectedName = st.selected && st.selected._ztKind !== KIND.UNC ? normalizeText(st.selected.feature.properties.zorggroep) : "";
    $("dir").innerHTML = entries.length ? entries.map((e) => {
      const contracted = e.status === "contracted";
      const swatch = contracted ? colorFromString(e.name) : cssVar("--nc-fill");
      return `<li>
        <button type="button" data-name="${esc(e.name)}" aria-current="${normalizeText(e.name) === selectedName}">
          <span class="swatch" style="background:${esc(swatch)}"></span>
          <span>${esc(e.name)}</span>
          <span class="tag ${contracted ? "tag-ok" : ""}">${contracted ? "Gecontracteerd" : "Geen contract"}</span>
        </button>
        ${e.website ? `<a class="site-link" href="${esc(e.website)}" target="_blank" rel="noopener noreferrer">${esc(e.website)}</a>` : ""}
      </li>`;
    }).join("") : `<li><p class="meta">Geen zorggroepen zichtbaar voor deze filter.</p></li>`;

    const extra = st.uncoveredCount;
    $("dirHint").textContent = st.filter === "contracted"
      ? "Deze lijst toont de zorggroepen die op de kaart als gecontracteerd zichtbaar zijn."
      : st.filter === "no-contract"
        ? (extra > 0 ? `Zorggroepen zonder contract die al aan een gemeente zijn gekoppeld. Daarnaast zijn er nog ${extra} losse gemeenten zonder betrouwbare zorggroepkoppeling.` : "Zorggroepen zonder contract die al aan gemeenten zijn gekoppeld.")
        : (extra > 0 ? `Gecontracteerde en niet-gecontracteerde zorggroepen samen. Daarnaast zijn er nog ${extra} losse gemeenten zonder betrouwbare zorggroepkoppeling.` : "Alle zorggroepen die op de kaart zichtbaar en benoemd zijn.");
  }

  $("dir").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-name]");
    if (!btn) return;
    const layer = st.layerByName.get(normalizeText(btn.dataset.name));
    if (layer) select(layer, { fly: true });
  });
  document.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => {
    st.filter = b.dataset.filter;
    if (st.ready) applyFilter();
    else document.querySelectorAll("[data-filter]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));

  // ---------------------------------------------------------------------------------------
  // Laden: bestaande logica + dezelfde bronnen als de huidige kaart
  // ---------------------------------------------------------------------------------------
  function renderLoading() {
    $("detail").innerHTML = `<div class="skel" aria-label="Laden"><span></span><span></span><span></span></div>`;
    $("dir").innerHTML = "";
    $("dirCount").textContent = "";
  }
  function renderError() {
    $("detail").innerHTML = `
      <div class="alert alert-error" role="alert"><strong>De kaart kon niet worden geladen</strong>Controleer de internetverbinding en probeer het opnieuw.
        <div class="alert-actions"><button type="button" id="retryBtn">Opnieuw proberen</button></div>
      </div>`;
    $("retryBtn").addEventListener("click", load);
  }

  async function load() {
    renderLoading();
    setMapStatus("Kaartgegevens laden…");
    try {
      if (typeof buildContractFeatures !== "function") {
        await ZT.loadLegacyScript("/script/alle-zorggroepen.js", /\r?\ninit\(\);\s*$/, () => typeof buildContractFeatures === "function");
      }
      const [zgData, infoData, gemeenteFeatures] = await Promise.all([
        fetchZorggroepenData(),
        fetch("/zg-data/alle-zorggroepen-info.json").then((r) => { if (!r.ok) throw new Error(`info ${r.status}`); return r.json(); }),
        fetchAllGemeenteFeatures(),
      ]);
      const zorggroepen = Array.isArray(zgData.zorggroepen) ? zgData.zorggroepen : [];
      applyPlaceAliases(zgData.place_aliases);
      const entries = Array.isArray(infoData.entries) ? infoData.entries : [];
      st.infoByGroup = buildInfoLookup(entries).infoByGroup;
      const contract = buildContractFeatures(zorggroepen, gemeenteFeatures);
      const noContract = buildNoContractGroupFeatures(entries, gemeenteFeatures, contract);
      st.dir = buildDirectoryEntries(contract, noContract, st.infoByGroup);

      // Gemeenten zonder enige zorggroep (zelfde berekening als renderUncoveredLayer).
      const covered = new Set();
      [...contract, ...noContract].forEach((f) => (f.properties.gemeenten || []).forEach((g) => covered.add(normalizeText(g))));
      const uncovered = gemeenteFeatures.filter((f) => f?.properties?.naam && !covered.has(normalizeText(f.properties.naam)));
      st.uncoveredCount = uncovered.length;

      Object.values(st.layers).forEach((g) => g.remove());
      st.layers = {};
      st.layerByName.clear();
      makeLayer(KIND.UNC, uncovered);
      makeLayer(KIND.NC, noContract);
      makeLayer(KIND.CONTRACT, contract);
      $("legendContract").style.background = contract[0] ? colorFromString(contract[0].properties.zorggroep) : cssVar("--brand-tint-2");

      st.ready = true;
      setMapStatus("");
      renderDetail(null);
      applyFilter();
    } catch (err) {
      console.error(err);
      setMapStatus("");
      renderError();
    }
  }

  const sheet = ZT.initSheet($("panel"), $("sheetHandle"));
  window.addEventListener("resize", () => { lmap.invalidateSize(); updateMinZoom(); });
  fitNetherlands(false);
  renderDetail(null);
  setTimeout(load, 0); // na de eerste weergave (ook in een achtergrondtab)
})();
