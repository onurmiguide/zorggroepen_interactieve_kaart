/* MiGuide Zorgtools - Adminomgeving (vanilla JS SPA). */
(function () {
  "use strict";

  const api = window.MiGuideApi;
  const THEME_KEY = "miguide_theme";

  const state = {
    user: null,
    activeTab: "dashboard",
    dataVersion: null,
    cache: {},
    formDirty: false,
  };

  const el = (id) => document.getElementById(id);

  // ---------------- Theme ----------------
  function setTheme(mode) {
    const dark = mode === "dark";
    document.documentElement.classList.toggle("dark", dark);
    document.body.classList.toggle("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    const icon = el("themeToggleIcon");
    if (icon) icon.innerHTML = dark ? "&#9790;" : "&#9728;";
    document.querySelectorAll("[data-logo-light]").forEach((img) => {
      const light = img.getAttribute("data-logo-light");
      const darkLogo = img.getAttribute("data-logo-dark");
      img.src = dark ? (darkLogo || light) : light;
    });
  }
  function initTheme() {
    setTheme(localStorage.getItem(THEME_KEY) || "light");
    const btn = el("themeToggle");
    if (btn) btn.addEventListener("click", () => {
      setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
    });
  }

  // ---------------- Utils ----------------
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
  }
  function toast(message, type) {
    const root = el("toastRoot");
    const node = document.createElement("div");
    node.className = `zga-toast zga-toast-${type || "info"}`;
    node.textContent = message;
    root.appendChild(node);
    setTimeout(() => { node.style.opacity = "0"; node.style.transition = "opacity .3s"; }, 3200);
    setTimeout(() => node.remove(), 3600);
  }
  const ROLE_LABELS = { viewer: "Alleen lezen", editor: "Bewerker", admin: "Admin", super_admin: "Super admin" };
  const ROLE_LEVEL = { viewer: 1, editor: 2, admin: 3, super_admin: 4 };
  function canEdit() { return (ROLE_LEVEL[state.user?.role] || 0) >= 2; }
  // Publiceren naar GitHub kan alleen lokaal (online is er geen git); online worden
  // wijzigingen direct in de database opgeslagen en zijn ze meteen live.
  function isLocalAdmin() { return ["localhost", "127.0.0.1"].includes(window.location.hostname); }
  function canPublish() { return isLocalAdmin() && (ROLE_LEVEL[state.user?.role] || 0) >= 3; }
  function isSuperAdmin() { return state.user?.role === "super_admin"; }

  // ---------------- Modal ----------------
  function openModal({ title, body, footer, onClose }) {
    el("modalTitle").textContent = title || "";
    const modalBody = el("modalBody");
    modalBody.innerHTML = "";
    if (typeof body === "string") modalBody.innerHTML = body;
    else if (body) modalBody.appendChild(body);
    const modalFooter = el("modalFooter");
    modalFooter.innerHTML = "";
    (footer || []).forEach((b) => modalFooter.appendChild(b));
    const root = el("modalRoot");
    root.classList.remove("hidden");
    root.classList.add("flex");
    state.formDirty = false;
    state._modalOnClose = onClose || null;
  }
  function closeModal(force) {
    if (!force && state.formDirty) {
      if (!window.confirm("Er zijn niet-opgeslagen wijzigingen. Toch sluiten?")) return;
    }
    const root = el("modalRoot");
    root.classList.add("hidden");
    root.classList.remove("flex");
    state.formDirty = false;
    if (state._modalOnClose) { try { state._modalOnClose(); } catch (e) {} }
    state._modalOnClose = null;
  }
  function makeButton(label, cls, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }
  function confirmDialog({ title, message, confirmLabel, danger, onConfirm }) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<p class="text-sm leading-6 text-slate-600 dark:text-slate-300">${escapeHtml(message)}</p>`;
    const cancel = makeButton("Annuleren", "zga-btn-ghost", () => closeModal(true));
    const ok = makeButton(confirmLabel || "Bevestigen", danger ? "zga-btn-danger" : "zga-btn-primary", async () => {
      ok.disabled = true;
      try { await onConfirm(); closeModal(true); }
      catch (err) { toast(err.message || "Mislukt", "error"); ok.disabled = false; }
    });
    openModal({ title: title || "Bevestigen", body: wrap, footer: [cancel, ok] });
  }

  // ---------------- DataTable ----------------
  /* columns: [{key,label,render?(row),sortable?,sortValue?(row)}] */
  function DataTable(container, { columns, rows, searchKeys, searchPlaceholder, emptyText, limit }) {
    let search = "";
    let sortKey = null;
    let sortDir = 1;
    let showAll = false;

    const wrap = document.createElement("div");
    const controls = document.createElement("div");
    controls.className = "mb-3 flex items-center gap-2";
    const input = document.createElement("input");
    input.type = "search";
    input.className = "zga-input max-w-xs";
    input.placeholder = searchPlaceholder || "Zoeken...";
    input.addEventListener("input", () => { search = input.value.toLowerCase().trim(); draw(); });
    controls.appendChild(input);
    const count = document.createElement("span");
    count.className = "text-xs font-medium text-slate-500 dark:text-slate-400";
    controls.appendChild(count);
    wrap.appendChild(controls);

    const tableWrap = document.createElement("div");
    tableWrap.className = "zga-table-wrap";
    const table = document.createElement("table");
    table.className = "zga-table";
    tableWrap.appendChild(table);
    wrap.appendChild(tableWrap);
    // Lange lijsten (bijv. alle woonplaatsen): eerst een deel tonen, rest via zoeken of "Toon alles".
    const more = document.createElement("div");
    more.className = "mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400";
    wrap.appendChild(more);

    function filtered() {
      let list = rows.slice();
      if (search && searchKeys) {
        list = list.filter((r) => searchKeys.some((k) => String(r[k] == null ? "" : r[k]).toLowerCase().includes(search)));
      }
      if (sortKey) {
        const col = columns.find((c) => c.key === sortKey);
        list.sort((a, b) => {
          const va = col.sortValue ? col.sortValue(a) : a[sortKey];
          const vb = col.sortValue ? col.sortValue(b) : b[sortKey];
          if (va == null) return 1; if (vb == null) return -1;
          if (typeof va === "number" && typeof vb === "number") return (va - vb) * sortDir;
          return String(va).localeCompare(String(vb), "nl") * sortDir;
        });
      }
      return list;
    }

    function draw() {
      const all = filtered();
      const list = limit && !showAll ? all.slice(0, limit) : all;
      count.textContent = `${all.length} van ${rows.length}`;
      more.innerHTML = "";
      if (list.length < all.length) {
        more.appendChild(document.createTextNode(`Eerste ${list.length} van ${all.length} getoond. Zoek om te filteren, of `));
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "font-semibold text-sky-700 underline dark:text-sky-300";
        btn.textContent = "toon alles";
        btn.addEventListener("click", () => { showAll = true; draw(); });
        more.appendChild(btn);
      }
      const thead = `<thead><tr>${columns.map((c) => {
        const arrow = sortKey === c.key ? (sortDir === 1 ? " &#9650;" : " &#9660;") : "";
        const cursor = c.sortable ? ' style="cursor:pointer"' : "";
        return `<th data-sort="${c.sortable ? c.key : ""}"${cursor}>${escapeHtml(c.label)}${arrow}</th>`;
      }).join("")}</tr></thead>`;
      const tbody = list.length
        ? `<tbody>${list.map((row) => `<tr>${columns.map((c) => `<td>${c.render ? c.render(row) : escapeHtml(row[c.key])}</td>`).join("")}</tr>`).join("")}</tbody>`
        : `<tbody><tr><td colspan="${columns.length}" class="py-6 text-center text-sm text-slate-400">${escapeHtml(emptyText || "Geen resultaten.")}</td></tr></tbody>`;
      table.innerHTML = thead + tbody;
      table.querySelectorAll("th[data-sort]").forEach((th) => {
        const key = th.getAttribute("data-sort");
        if (!key) return;
        th.addEventListener("click", () => {
          if (sortKey === key) sortDir *= -1; else { sortKey = key; sortDir = 1; }
          draw();
        });
      });
      // row action buttons
      table.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const action = btn.getAttribute("data-action");
          const id = Number(btn.getAttribute("data-id"));
          const row = rows.find((r) => r.id === id);
          if (container._rowAction) container._rowAction(action, row);
        });
      });
    }

    container.innerHTML = "";
    container.appendChild(wrap);
    container._redraw = draw;
    draw();
  }

  function actionButtons(id, opts) {
    const o = opts || {};
    const buttons = [];
    if (o.edit !== false && canEdit()) buttons.push(`<button class="zga-btn-soft-edit" data-action="edit" data-id="${id}">Bewerken</button>`);
    if (o.toggle && canEdit()) {
      const activeren = String(o.toggleLabel || "").toLowerCase().startsWith("activeren");
      buttons.push(`<button class="${activeren ? "zga-btn-soft-ok" : "zga-btn-soft-warn"}" data-action="toggle" data-id="${id}">${o.toggleLabel}</button>`);
    }
    if (o.delete !== false && canEdit()) buttons.push(`<button class="zga-btn-soft-danger" data-action="delete" data-id="${id}">Verwijderen</button>`);
    return `<div class="flex flex-wrap gap-1">${buttons.join("")}</div>`;
  }

  // Extra bevestiging bij het opslaan van een bestaande (bewerkte) record.
  function confirmEdit(isEdit) {
    return !isEdit || window.confirm("Weet je zeker dat je deze wijziging wilt opslaan?");
  }
  function statusBadge(active) {
    return active
      ? '<span class="zga-badge zga-badge-green">Actief</span>'
      : '<span class="zga-badge zga-badge-slate">Inactief</span>';
  }

  // ---------------- Form helpers ----------------
  function field(labelText, inputHtml, hint) {
    return `<label class="grid gap-1 text-sm">
      <span class="font-medium text-slate-700 dark:text-slate-200">${escapeHtml(labelText)}</span>
      ${inputHtml}
      ${hint ? `<span class="text-xs text-slate-400">${escapeHtml(hint)}</span>` : ""}
    </label>`;
  }
  function markDirtyOn(form) {
    form.addEventListener("input", () => { state.formDirty = true; });
    form.addEventListener("change", () => { state.formDirty = true; });
  }

  // ================= TABS =================
  const TABS = [
    { id: "dashboard", label: "Dashboard", render: renderDashboard },
    { id: "zorggroepen", label: "Zorggroepen", render: renderZorggroepen },
    { id: "zorgverzekeraars", label: "Zorgverzekeraars", render: renderZorgverzekeraars },
    { id: "facturatiestromen", label: "Facturatiestromen", render: renderFacturatiestromen },
    { id: "contracten", label: "Contracten / Matrix", render: renderContracten },
    { id: "postcodes", label: "Postcodes", render: renderPostcodes },
    { id: "gebruikers", label: "Gebruikers", render: renderGebruikers, superAdminOnly: true },
    { id: "history", label: "History", render: renderHistory },
  ];

  function renderTabNav() {
    const nav = el("tabNav");
    nav.innerHTML = "";
    TABS.filter((t) => !t.superAdminOnly || isSuperAdmin()).forEach((t) => {
      const b = document.createElement("button");
      b.className = "zga-tab" + (t.id === state.activeTab ? " is-active" : "");
      b.textContent = t.label;
      b.addEventListener("click", () => selectTab(t.id));
      nav.appendChild(b);
    });
  }
  function selectTab(id) {
    state.activeTab = id;
    renderTabNav();
    const tab = TABS.find((t) => t.id === id);
    const content = el("tabContent");
    content.innerHTML = '<div class="py-10 text-center text-sm text-slate-400">Laden...</div>';
    Promise.resolve(tab.render(content)).catch((err) => {
      content.innerHTML = `<div class="zga-card text-sm text-red-600">${escapeHtml(err.message || "Laden mislukt.")}</div>`;
    });
    refreshVersionBadge();
  }

  async function refreshVersionBadge() {
    try {
      const v = await api.publicVersion();
      state.dataVersion = v.data_version;
      const badge = el("dataVersionBadge");
      badge.textContent = `Data v${v.data_version}`;
      badge.classList.remove("hidden");
    } catch (e) {}
  }

  // ---------------- Dashboard ----------------
  async function renderDashboard(content) {
    const stats = await api.get("/api/admin/stats");
    const kpis = [
      { num: stats.zorggroepen_active, lbl: `Actieve zorggroepen (van ${stats.zorggroepen_total})` },
      { num: stats.zorgverzekeraars_active, lbl: "Actieve zorgverzekeraars" },
      { num: stats.facturatiestromen_active, lbl: "Facturatiestromen/modules" },
      { num: stats.contract_rules_total, lbl: "Contractregels" },
      { num: stats.users_total, lbl: "Gebruikers" },
    ];
    const recent = (stats.recent_changes || []).map((c) =>
      `<li class="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 text-sm dark:border-slate-800">
        <span><span class="zga-badge zga-badge-blue">${escapeHtml(c.action)}</span> ${escapeHtml(c.entity_type)} <span class="text-slate-400">#${escapeHtml(c.entity_id)}</span></span>
        <span class="text-xs text-slate-400">${escapeHtml(c.actor_name)} &middot; ${escapeHtml(fmtDate(c.created_at))}</span>
      </li>`).join("") || '<li class="py-2 text-sm text-slate-400">Nog geen wijzigingen.</li>';
    content.innerHTML = `
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        ${kpis.map((k) => `<div class="zga-kpi"><div class="num">${k.num}</div><div class="lbl">${escapeHtml(k.lbl)}</div></div>`).join("")}
      </div>
      <div class="mt-4 zga-card">
        <h2 class="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Laatste wijzigingen</h2>
        <ul>${recent}</ul>
      </div>
      <p class="mt-3 text-xs text-slate-400">Wijzigingen die je hier opslaat worden direct zichtbaar in de publieke kaart (data-versie loopt op).</p>`;
  }

  // ---------------- Zorggroepen ----------------
  async function renderZorggroepen(content) {
    const rows = await api.get("/api/admin/zorggroepen");
    state.cache.zorggroepen = rows;
    const header = topBar("Zorggroepen", canEdit() ? () => zorggroepForm(null) : null, "Nieuwe zorggroep");
    content.innerHTML = "";
    content.appendChild(header);
    const tableHost = document.createElement("div");
    content.appendChild(tableHost);
    DataTable(tableHost, {
      columns: [
        { key: "name", label: "Naam", sortable: true },
        { key: "regio", label: "Regio", sortable: true },
        { key: "color", label: "Kleur", render: (r) => r.color
            ? `<span class="inline-flex items-center gap-1"><span style="display:inline-block;width:14px;height:14px;border-radius:4px;border:1px solid rgba(0,0,0,.2);background:${escapeHtml(r.color)}"></span><span class="text-xs text-slate-500">${escapeHtml(r.color)}</span></span>`
            : `<span class="text-xs text-slate-400">auto</span>` },
        { key: "has_contract", label: "Contract", render: (r) => r.has_contract
            ? `<span class="zga-badge zga-badge-green">Ja</span>`
            : `<span class="zga-badge zga-badge-slate">Nee (grijs)</span>`, sortable: true, sortValue: (r) => (r.has_contract ? 1 : 0) },
        { key: "cities", label: "Plaatsen", render: (r) => `<span class="zga-badge zga-badge-slate">${r.locations.length}</span>`, sortable: true, sortValue: (r) => r.locations.length },
        { key: "website", label: "Website", render: (r) => r.website ? `<a class="text-sky-600 hover:underline" href="${escapeHtml(r.website)}" target="_blank" rel="noopener">link</a>` : "<span class='text-slate-400'>-</span>" },
        { key: "is_active", label: "Status", render: (r) => statusBadge(r.is_active), sortable: true, sortValue: (r) => (r.is_active ? 1 : 0) },
        { key: "_acties", label: "Acties", render: (r) => actionButtons(r.id, { toggle: true, toggleLabel: r.is_active ? "Deactiveren" : "Activeren" }) },
      ],
      rows, searchKeys: ["name", "regio"], searchPlaceholder: "Zoek zorggroep of regio...",
    });
    tableHost._rowAction = (action, row) => {
      if (action === "edit") zorggroepForm(row);
      else if (action === "toggle") toggleActive("/api/admin/zorggroepen", row, () => selectTab("zorggroepen"));
      else if (action === "delete") deleteEntity("/api/admin/zorggroepen", row.id, `zorggroep "${row.name}"`, () => selectTab("zorggroepen"));
    };
  }

  function zorggroepForm(row) {
    const isEdit = !!row;
    const locations = row ? row.locations.map((l) => ({ ...l })) : [];
    const form = document.createElement("form");
    form.className = "grid gap-3";
    form.innerHTML = `
      ${field("Naam *", `<input name="name" class="zga-input" required value="${escapeHtml(row?.name || "")}" />`)}
      ${field("Regio", `<input name="regio" class="zga-input" value="${escapeHtml(row?.regio || "")}" />`)}
      ${field("Website", `<input name="website" class="zga-input" placeholder="https://..." value="${escapeHtml(row?.website || "")}" />`, "Leeg of begint met http:// of https://")}
      <div>
        <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Kleur op de kaart</span>
        <div class="mt-1 flex items-center gap-3">
          <input type="color" id="zgColor" value="${escapeHtml(row?.color || "#3388ff")}" class="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-950" />
          <label class="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" id="zgAutoColor" ${row?.color ? "" : "checked"} /> Automatische kleur (op naam)
          </label>
        </div>
        <span class="text-xs text-slate-400">Vink uit en kies een kleur om die zorggroep een vaste kaartkleur te geven.</span>
      </div>
      ${field("Contract met MiGuide", `<select name="has_contract" class="zga-select"><option value="true"${row && row.has_contract === false ? "" : " selected"}>Ja - gekleurd op de kaart, zorggroep-route</option><option value="false"${row && row.has_contract === false ? " selected" : ""}>Nee - grijs op de kaart, geen-contract-route</option></select>`, "Bepaalt de kleur op beide kaarten en de facturatieroute in de Zorgtool.")}
      ${field("Actief", `<select name="is_active" class="zga-select"><option value="true"${row && !row.is_active ? "" : " selected"}>Actief</option><option value="false"${row && !row.is_active ? " selected" : ""}>Inactief</option></select>`)}
      <div>
        <div class="mb-1 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Plaatsen</span>
          <button type="button" id="zgAddLoc" class="zga-btn-soft">+ Plaats</button>
        </div>
        <div id="zgLocList" class="grid gap-2"></div>
      </div>`;
    markDirtyOn(form);

    const locList = form.querySelector("#zgLocList");
    function drawLocs() {
      locList.innerHTML = "";
      if (!locations.length) locList.innerHTML = '<p class="text-xs text-slate-400">Nog geen plaatsen toegevoegd.</p>';
      locations.forEach((loc, idx) => {
        const rowEl = document.createElement("div");
        rowEl.className = "flex items-center gap-2";
        rowEl.innerHTML = `
          <input class="zga-input" data-loc-field="city_name" data-idx="${idx}" placeholder="Plaats" value="${escapeHtml(loc.city_name || "")}" />
          <input class="zga-input" data-loc-field="gemeente_name" data-idx="${idx}" placeholder="Gemeente (optioneel)" value="${escapeHtml(loc.gemeente_name || "")}" />
          <button type="button" class="zga-btn-soft" data-loc-remove="${idx}">&times;</button>`;
        locList.appendChild(rowEl);
      });
      locList.querySelectorAll("[data-loc-field]").forEach((inp) => {
        inp.addEventListener("input", () => {
          const i = Number(inp.getAttribute("data-idx"));
          locations[i][inp.getAttribute("data-loc-field")] = inp.value;
          state.formDirty = true;
        });
      });
      locList.querySelectorAll("[data-loc-remove]").forEach((b) => {
        b.addEventListener("click", () => { locations.splice(Number(b.getAttribute("data-loc-remove")), 1); state.formDirty = true; drawLocs(); });
      });
    }
    drawLocs();
    form.querySelector("#zgAddLoc").addEventListener("click", () => { locations.push({ city_name: "", gemeente_name: "", notes: "" }); drawLocs(); });

    const save = makeButton(isEdit ? "Opslaan" : "Toevoegen", "zga-btn-primary", async () => {
      if (!confirmEdit(isEdit)) return;
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      if (!name) { toast("Naam is verplicht.", "error"); return; }
      const autoColor = form.querySelector("#zgAutoColor").checked;
      const colorValue = autoColor ? "" : form.querySelector("#zgColor").value;
      const payload = {
        name,
        regio: String(fd.get("regio") || "").trim(),
        website: String(fd.get("website") || "").trim(),
        color: colorValue,
        has_contract: fd.get("has_contract") === "true",
        is_active: fd.get("is_active") === "true",
        locations: locations.filter((l) => (l.city_name || "").trim()).map((l) => ({ city_name: l.city_name.trim(), gemeente_name: (l.gemeente_name || "").trim(), notes: (l.notes || "").trim() })),
      };
      save.disabled = true;
      try {
        if (isEdit) await api.put(`/api/admin/zorggroepen/${row.id}`, payload);
        else await api.post("/api/admin/zorggroepen", payload);
        state.formDirty = false;
        toast(isEdit ? "Zorggroep opgeslagen." : "Zorggroep toegevoegd.", "success");
        closeModal(true);
        selectTab("zorggroepen");
      } catch (err) { toast(err.message, "error"); save.disabled = false; }
    });
    openModal({ title: isEdit ? `Zorggroep bewerken` : "Nieuwe zorggroep", body: form, footer: [makeButton("Annuleren", "zga-btn-ghost", () => closeModal()), save] });
  }

  // ---------------- Zorgverzekeraars ----------------
  async function renderZorgverzekeraars(content) {
    const rows = await api.get("/api/admin/zorgverzekeraars");
    const header = topBar("Zorgverzekeraars", canEdit() ? () => zorgverzekeraarForm(null) : null, "Nieuwe verzekeraar");
    content.innerHTML = ""; content.appendChild(header);
    const host = document.createElement("div"); content.appendChild(host);
    DataTable(host, {
      columns: [
        { key: "name", label: "Naam", sortable: true },
        { key: "concern_key", label: "Concern", sortable: true, render: (r) => `<span class="zga-badge zga-badge-blue">${escapeHtml(r.concern_key || "-")}</span>` },
        { key: "aliases", label: "Aliassen", render: (r) => r.aliases.length ? r.aliases.map((a) => `<span class="zga-chip">${escapeHtml(a)}</span>`).join(" ") : "<span class='text-slate-400'>-</span>" },
        { key: "is_active", label: "Status", sortable: true, sortValue: (r) => (r.is_active ? 1 : 0), render: (r) => statusBadge(r.is_active) },
        { key: "_acties", label: "Acties", render: (r) => actionButtons(r.id, { toggle: true, toggleLabel: r.is_active ? "Deactiveren" : "Activeren" }) },
      ],
      rows, searchKeys: ["name", "concern_key"], searchPlaceholder: "Zoek verzekeraar of concern...",
    });
    host._rowAction = (action, row) => {
      if (action === "edit") zorgverzekeraarForm(row);
      else if (action === "toggle") toggleActive("/api/admin/zorgverzekeraars", row, () => selectTab("zorgverzekeraars"));
      else if (action === "delete") deleteEntity("/api/admin/zorgverzekeraars", row.id, `verzekeraar "${row.name}"`, () => selectTab("zorgverzekeraars"));
    };
  }

  function zorgverzekeraarForm(row) {
    const isEdit = !!row;
    const aliases = row ? row.aliases.slice() : [];
    const form = document.createElement("form");
    form.className = "grid gap-3";
    form.innerHTML = `
      ${field("Naam *", `<input name="name" class="zga-input" required value="${escapeHtml(row?.name || "")}" />`)}
      ${field("Concern-sleutel", `<input name="concern_key" class="zga-input" value="${escapeHtml(row?.concern_key || "")}" />`, "Bepaalt de facturatie-route in de Zorgtool. Gebruik het concern van een bestaande verzekeraar om diens route te volgen, bijv. 'cz', 'vgz', 'dsw' of 'menzis digitaal 2026'.")}
      ${field("Actief", `<select name="is_active" class="zga-select"><option value="true"${row && !row.is_active ? "" : " selected"}>Actief</option><option value="false"${row && !row.is_active ? " selected" : ""}>Inactief</option></select>`)}
      <div>
        <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Aliassen</span>
        <div class="mt-1 flex gap-2">
          <input id="aliasInput" class="zga-input" placeholder="Alias toevoegen en Enter" />
          <button type="button" id="aliasAdd" class="zga-btn-soft">+</button>
        </div>
        <div id="aliasChips" class="mt-2 flex flex-wrap gap-1"></div>
      </div>`;
    markDirtyOn(form);
    const chips = form.querySelector("#aliasChips");
    function drawChips() {
      chips.innerHTML = aliases.length ? "" : '<span class="text-xs text-slate-400">Geen aliassen.</span>';
      aliases.forEach((a, idx) => {
        const c = document.createElement("span");
        c.className = "zga-chip";
        c.innerHTML = `${escapeHtml(a)} <button type="button" data-rm="${idx}">&times;</button>`;
        chips.appendChild(c);
      });
      chips.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { aliases.splice(Number(b.getAttribute("data-rm")), 1); state.formDirty = true; drawChips(); }));
    }
    drawChips();
    const aliasInput = form.querySelector("#aliasInput");
    function addAlias() {
      const v = aliasInput.value.trim();
      if (v && !aliases.includes(v)) { aliases.push(v); state.formDirty = true; drawChips(); }
      aliasInput.value = "";
    }
    form.querySelector("#aliasAdd").addEventListener("click", addAlias);
    aliasInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addAlias(); } });

    const save = makeButton(isEdit ? "Opslaan" : "Toevoegen", "zga-btn-primary", async () => {
      if (!confirmEdit(isEdit)) return;
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      if (!name) { toast("Naam is verplicht.", "error"); return; }
      const payload = { name, concern_key: String(fd.get("concern_key") || "").trim(), aliases, is_active: fd.get("is_active") === "true" };
      save.disabled = true;
      try {
        if (isEdit) await api.put(`/api/admin/zorgverzekeraars/${row.id}`, payload);
        else await api.post("/api/admin/zorgverzekeraars", payload);
        state.formDirty = false; toast("Opgeslagen.", "success"); closeModal(true); selectTab("zorgverzekeraars");
      } catch (err) { toast(err.message, "error"); save.disabled = false; }
    });
    openModal({ title: isEdit ? "Verzekeraar bewerken" : "Nieuwe verzekeraar", body: form, footer: [makeButton("Annuleren", "zga-btn-ghost", () => closeModal()), save] });
  }

  // ---------------- Facturatiestromen ----------------
  async function renderFacturatiestromen(content) {
    const rows = await api.get("/api/admin/facturatiestromen");
    const header = topBar("Facturatiestromen & modules", canEdit() ? () => facturatiestroomForm(null) : null, "Nieuw item");
    content.innerHTML = ""; content.appendChild(header);
    const host = document.createElement("div"); content.appendChild(host);
    DataTable(host, {
      columns: [
        { key: "kind", label: "Type", sortable: true, render: (r) => r.kind === "module" ? '<span class="zga-badge zga-badge-amber">Module</span>' : '<span class="zga-badge zga-badge-blue">Stroom</span>' },
        { key: "label", label: "Label", sortable: true },
        { key: "module_name", label: "Module", render: (r) => escapeHtml(r.module_name || "-") },
        { key: "prestatiecode", label: "Prestatiecode", render: (r) => r.prestatiecode ? `<span class="zga-badge zga-badge-slate">${escapeHtml(r.prestatiecode)}</span>` : "-" },
        { key: "is_active", label: "Status", sortable: true, sortValue: (r) => (r.is_active ? 1 : 0), render: (r) => statusBadge(r.is_active) },
        { key: "_acties", label: "Acties", render: (r) => actionButtons(r.id, { toggle: true, toggleLabel: r.is_active ? "Deactiveren" : "Activeren" }) },
      ],
      rows, searchKeys: ["label", "module_name", "prestatiecode", "code"], searchPlaceholder: "Zoek label, module of code...",
    });
    host._rowAction = (action, row) => {
      if (action === "edit") facturatiestroomForm(row);
      else if (action === "toggle") toggleActive("/api/admin/facturatiestromen", row, () => selectTab("facturatiestromen"));
      else if (action === "delete") deleteEntity("/api/admin/facturatiestromen", row.id, `item "${row.label}"`, () => selectTab("facturatiestromen"));
    };
  }

  function facturatiestroomForm(row) {
    const isEdit = !!row;
    const form = document.createElement("form");
    form.className = "grid gap-3";
    form.innerHTML = `
      ${field("Code *", `<input name="code" class="zga-input" required value="${escapeHtml(row?.code || "")}" />`, "Unieke sleutel, bijv. STROOM_1 of module-esv.")}
      ${field("Label *", `<input name="label" class="zga-input" required value="${escapeHtml(row?.label || "")}" />`)}
      ${field("Type", `<select name="kind" class="zga-select"><option value="stroom"${row?.kind === "module" ? "" : " selected"}>Facturatiestroom</option><option value="module"${row?.kind === "module" ? " selected" : ""}>Facturatiemodule</option></select>`)}
      ${field("Modulenaam", `<input name="module_name" class="zga-input" value="${escapeHtml(row?.module_name || "")}" />`)}
      ${field("Prestatiecode", `<input name="prestatiecode" class="zga-input" value="${escapeHtml(row?.prestatiecode || "")}" />`)}
      ${field("Omschrijving", `<textarea name="description" class="zga-textarea">${escapeHtml(row?.description || "")}</textarea>`)}
      ${field("Actief", `<select name="is_active" class="zga-select"><option value="true"${row && !row.is_active ? "" : " selected"}>Actief</option><option value="false"${row && !row.is_active ? " selected" : ""}>Inactief</option></select>`)}`;
    markDirtyOn(form);
    const save = makeButton(isEdit ? "Opslaan" : "Toevoegen", "zga-btn-primary", async () => {
      if (!confirmEdit(isEdit)) return;
      const fd = new FormData(form);
      const code = String(fd.get("code") || "").trim();
      const label = String(fd.get("label") || "").trim();
      if (!code || !label) { toast("Code en label zijn verplicht.", "error"); return; }
      const payload = {
        code, label, kind: fd.get("kind"),
        module_name: String(fd.get("module_name") || "").trim(),
        prestatiecode: String(fd.get("prestatiecode") || "").trim(),
        description: String(fd.get("description") || "").trim(),
        is_active: fd.get("is_active") === "true",
      };
      save.disabled = true;
      try {
        if (isEdit) await api.put(`/api/admin/facturatiestromen/${row.id}`, payload);
        else await api.post("/api/admin/facturatiestromen", payload);
        state.formDirty = false; toast("Opgeslagen.", "success"); closeModal(true); selectTab("facturatiestromen");
      } catch (err) { toast(err.message, "error"); save.disabled = false; }
    });
    openModal({ title: isEdit ? "Facturatie-item bewerken" : "Nieuw facturatie-item", body: form, footer: [makeButton("Annuleren", "zga-btn-ghost", () => closeModal()), save] });
  }

  // ---------------- Contracten / Matrix ----------------
  async function renderContracten(content) {
    const [rules, zorggroepen, verzekeraars, stromen] = await Promise.all([
      api.get("/api/admin/contract-rules"),
      api.get("/api/admin/zorggroepen"),
      api.get("/api/admin/zorgverzekeraars"),
      api.get("/api/admin/facturatiestromen"),
    ]);
    state.cache.contractRefs = { zorggroepen, verzekeraars, stromen };
    const header = topBar("Contractregels (matrix)", canEdit() ? () => contractForm(null) : null, "Nieuwe regel");
    content.innerHTML = ""; content.appendChild(header);
    const host = document.createElement("div"); content.appendChild(host);
    const statusBadgeFor = (s) => {
      const map = { gecontracteerd: "zga-badge-green", "niet gecontracteerd": "zga-badge-red", concept: "zga-badge-amber" };
      return `<span class="zga-badge ${map[(s || "").toLowerCase()] || "zga-badge-slate"}">${escapeHtml(s || "-")}</span>`;
    };
    DataTable(host, {
      columns: [
        { key: "zorggroep_name", label: "Zorggroep", sortable: true },
        { key: "zorgverzekeraar_name", label: "Zorgverzekeraar", sortable: true, render: (r) => escapeHtml(r.zorgverzekeraar_name || "(alle)") },
        { key: "facturatiestroom_label", label: "Facturatiestroom", render: (r) => escapeHtml(r.facturatiestroom_label || "-") },
        { key: "contract_status", label: "Status", sortable: true, render: (r) => statusBadgeFor(r.contract_status) },
        { key: "notes", label: "Opmerking", render: (r) => escapeHtml(r.notes || "") },
        { key: "_acties", label: "Acties", render: (r) => actionButtons(r.id) },
      ],
      rows: rules, searchKeys: ["zorggroep_name", "zorgverzekeraar_name", "facturatiestroom_label", "contract_status"],
      searchPlaceholder: "Zoek in matrix...",
      emptyText: "Nog geen contractregels. Voeg er een toe om de matrix te vullen.",
    });
    host._rowAction = (action, row) => {
      if (action === "edit") contractForm(row);
      else if (action === "delete") deleteEntity("/api/admin/contract-rules", row.id, "contractregel", () => selectTab("contracten"));
    };
  }

  function contractForm(row) {
    const isEdit = !!row;
    const { zorggroepen, verzekeraars, stromen } = state.cache.contractRefs;
    const opt = (list, selId, allowEmpty, emptyLabel) => {
      let html = allowEmpty ? `<option value="">${escapeHtml(emptyLabel || "(geen)")}</option>` : "";
      html += list.map((x) => `<option value="${x.id}"${x.id === selId ? " selected" : ""}>${escapeHtml(x.name || x.label)}</option>`).join("");
      return html;
    };
    const statusOptions = ["gecontracteerd", "niet gecontracteerd", "concept"];
    const form = document.createElement("form");
    form.className = "grid gap-3";
    form.innerHTML = `
      ${field("Zorggroep *", `<select name="zorggroep_id" class="zga-select" required>${opt(zorggroepen, row?.zorggroep_id, true, "Kies zorggroep")}</select>`)}
      ${field("Zorgverzekeraar", `<select name="zorgverzekeraar_id" class="zga-select">${opt(verzekeraars, row?.zorgverzekeraar_id, true, "(alle verzekeraars)")}</select>`)}
      ${field("Facturatiestroom", `<select name="facturatiestroom_id" class="zga-select">${opt(stromen, row?.facturatiestroom_id, true, "(geen)")}</select>`)}
      ${field("Contractstatus", `<select name="contract_status" class="zga-select">${statusOptions.map((s) => `<option value="${s}"${(row?.contract_status || "gecontracteerd") === s ? " selected" : ""}>${s}</option>`).join("")}</select>`)}
      <div class="grid grid-cols-2 gap-3">
        ${field("Geldig vanaf", `<input name="valid_from" class="zga-input" placeholder="2026-01-01" value="${escapeHtml(row?.valid_from || "")}" />`)}
        ${field("Geldig tot", `<input name="valid_to" class="zga-input" placeholder="leeg = doorlopend" value="${escapeHtml(row?.valid_to || "")}" />`)}
      </div>
      ${field("Opmerking", `<textarea name="notes" class="zga-textarea">${escapeHtml(row?.notes || "")}</textarea>`)}
      ${field("Actief", `<select name="is_active" class="zga-select"><option value="true"${row && !row.is_active ? "" : " selected"}>Actief</option><option value="false"${row && !row.is_active ? " selected" : ""}>Inactief</option></select>`)}`;
    markDirtyOn(form);
    const save = makeButton(isEdit ? "Opslaan" : "Toevoegen", "zga-btn-primary", async () => {
      if (!confirmEdit(isEdit)) return;
      const fd = new FormData(form);
      const zg = fd.get("zorggroep_id");
      if (!zg) { toast("Kies een zorggroep.", "error"); return; }
      const payload = {
        zorggroep_id: Number(zg),
        zorgverzekeraar_id: fd.get("zorgverzekeraar_id") ? Number(fd.get("zorgverzekeraar_id")) : null,
        facturatiestroom_id: fd.get("facturatiestroom_id") ? Number(fd.get("facturatiestroom_id")) : null,
        contract_status: fd.get("contract_status"),
        valid_from: String(fd.get("valid_from") || "").trim(),
        valid_to: String(fd.get("valid_to") || "").trim(),
        notes: String(fd.get("notes") || "").trim(),
        is_active: fd.get("is_active") === "true",
      };
      save.disabled = true;
      try {
        if (isEdit) await api.put(`/api/admin/contract-rules/${row.id}`, payload);
        else await api.post("/api/admin/contract-rules", payload);
        state.formDirty = false; toast("Opgeslagen.", "success"); closeModal(true); selectTab("contracten");
      } catch (err) { toast(err.message, "error"); save.disabled = false; }
    });
    openModal({ title: isEdit ? "Contractregel bewerken" : "Nieuwe contractregel", body: form, footer: [makeButton("Annuleren", "zga-btn-ghost", () => closeModal()), save] });
  }

  // ---------------- Postcodes ----------------
  const PC_BASE = "/api/admin/postcode-overrides";

  function concernsToText(arr) { return (arr || []).join(", "); }
  function textToConcerns(text) { return String(text || "").split(",").map((s) => s.trim()).filter(Boolean); }

  async function renderPostcodes(content) {
    if (!state.cache.zorggroepen) {
      try { state.cache.zorggroepen = await api.get("/api/admin/zorggroepen"); } catch (e) {}
    }
    content.innerHTML = `
      <div class="mb-3 flex items-center justify-between gap-3">
        <h1 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Postcode-uitzonderingen</h1>
      </div>
      <p class="mb-3 text-sm text-slate-500 dark:text-slate-400">Hiermee stuur je af van de standaard kaart-/zorggroepbepaling. Exacte postcodes gaan vóór ranges, en ranges gaan vóór de brede gemeente-/plaatslogica.</p>
      <div class="mb-3 flex flex-wrap gap-1" id="pcSubNav"></div>
      <div id="pcHost"></div>`;
    const subs = [
      { id: "exact", label: "Exacte postcodes (PC6)" },
      { id: "ranges", label: "Postcode-ranges (PC4)" },
      { id: "location", label: "Locatie-postcodes" },
      { id: "places", label: "Plaatsnamen (plaats → gemeente)" },
    ];
    let active = "exact";
    const nav = content.querySelector("#pcSubNav");
    const host = content.querySelector("#pcHost");
    function drawNav() {
      nav.innerHTML = "";
      subs.forEach((s) => {
        const b = document.createElement("button");
        b.className = "zga-tab" + (s.id === active ? " is-active" : "");
        b.textContent = s.label;
        b.addEventListener("click", () => { active = s.id; drawNav(); loadSub(); });
        nav.appendChild(b);
      });
    }
    async function loadSub() {
      host.innerHTML = '<div class="py-6 text-center text-sm text-slate-400">Laden...</div>';
      if (active === "exact") await loadExact();
      else if (active === "ranges") await loadRanges();
      else if (active === "places") await loadPlaces();
      else await loadLocation();
    }
    async function loadPlaces() {
      const rows = await api.get(PLACES_BASE);
      const bar = topBar("", canEdit() ? () => placeForm(loadSub, null) : null, "Nieuwe plaatsnaam");
      host.innerHTML = "";
      const uitleg = document.createElement("p");
      uitleg.className = "mb-2 text-sm text-slate-500 dark:text-slate-400";
      uitleg.textContent = "Koppel een plaats (dorp of woonplaats) aan de gemeente waarin die ligt. Daarna kun je die plaats bij een zorggroep invullen en kleurt de kaart de juiste gemeente. Deze lijst is leidend voor beide kaarten; aanpassen, deactiveren of verwijderen werkt direct door. Alle Nederlandse woonplaatsen (BAG) staan erin; een plaatsnaam die vaker voorkomt staat er met de gemeente achter, bijv. \"Beek (Berg en Dal)\".";
      host.appendChild(uitleg); host.appendChild(bar);
      const t = document.createElement("div"); host.appendChild(t);
      DataTable(t, {
        columns: [
          { key: "plaatsnaam", label: "Plaatsnaam", sortable: true },
          { key: "gemeente", label: "Gemeente", sortable: true, render: (r) => (r.gemeente ? escapeHtml(r.gemeente) : '<span class="text-slate-400">— (niet inkleuren)</span>') },
          { key: "is_active", label: "Status", sortable: true, sortValue: (r) => (r.is_active ? 1 : 0), render: (r) => statusBadge(r.is_active) },
          { key: "_acties", label: "Acties", render: (r) => actionButtons(r.id) },
        ], rows, searchKeys: ["plaatsnaam", "gemeente"], searchPlaceholder: "Zoek plaats of gemeente...", limit: 200,
      });
      t._rowAction = (a, r) => { if (a === "edit") placeForm(loadSub, r); else if (a === "delete") deleteSimple(`${PLACES_BASE}/${r.id}`, `plaatsnaam ${r.plaatsnaam}`, loadSub); };
    }
    async function loadExact() {
      const rows = await api.get(`${PC_BASE}/exact`);
      const bar = topBar("", canEdit() ? () => exactForm(loadSub, null) : null, "Nieuwe exacte postcode");
      host.innerHTML = ""; host.appendChild(bar);
      const t = document.createElement("div"); host.appendChild(t);
      DataTable(t, {
        columns: [
          { key: "postcode6", label: "Postcode", sortable: true },
          { key: "zorggroep", label: "Zorggroep", sortable: true },
          { key: "source_sheet", label: "Bron", render: (r) => escapeHtml(r.source_sheet || "-") },
          { key: "note", label: "Notitie", render: (r) => escapeHtml(r.note || "") },
          { key: "is_active", label: "Status", sortable: true, sortValue: (r) => (r.is_active ? 1 : 0), render: (r) => statusBadge(r.is_active) },
          { key: "_acties", label: "Acties", render: (r) => actionButtons(r.id) },
        ], rows, searchKeys: ["postcode6", "zorggroep", "source_sheet", "note"], searchPlaceholder: "Zoek postcode of zorggroep...",
      });
      t._rowAction = (a, r) => { if (a === "edit") exactForm(loadSub, r); else if (a === "delete") deleteSimple(`${PC_BASE}/exact/${r.id}`, `postcode ${r.postcode6}`, loadSub); };
    }
    // PC4-tab: automatisch overzicht van alle gecontracteerde ranges, of de bewerkbare uitzonderingen.
    let rangesView = "overzicht";
    async function loadRanges() {
      const toggle = document.createElement("div");
      toggle.className = "mb-3 flex flex-wrap gap-2";
      [["overzicht", "Alle gecontracteerde ranges"], ["uitzonderingen", "Uitzonderingen (bewerkbaar)"]].forEach(([id, label]) => {
        toggle.appendChild(makeButton(label, rangesView === id ? "zga-btn-primary" : "zga-btn-ghost", () => { rangesView = id; loadSub(); }));
      });
      const body = document.createElement("div");
      if (rangesView === "overzicht") await loadRangeOverview(body); else await loadRangeExceptions(body);
      host.innerHTML = ""; host.appendChild(toggle); host.appendChild(body);
    }
    async function loadRangeOverview(target) {
      const data = await api.get(`${PC_BASE}/ranges/overzicht`);
      const rows = data.ranges || [];
      const uitleg = document.createElement("p");
      uitleg.className = "mb-2 text-sm text-slate-500 dark:text-slate-400";
      uitleg.textContent = `Automatisch berekend uit de plaatsen van elke gecontracteerde zorggroep (plaats → gemeente → alle PC4's in die gemeente), plus de uitzonderingen. Pas je plaatsen of uitzonderingen aan, dan verandert dit overzicht vanzelf mee. Zoek op een PC4 (bijv. 3012) om te zien bij welke zorggroep die hoort. Losse PC6-uitzonderingen gaan hier nog vóór.`;
      target.appendChild(uitleg);
      const missing = Object.entries(data.niet_gekoppelde_plaatsen || {});
      if (missing.length) {
        const warn = document.createElement("p");
        warn.className = "mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
        warn.textContent = "Plaatsen zonder gemeente (tellen niet mee): " + missing.map(([zg, plaatsen]) => `${zg}: ${plaatsen.join(", ")}`).join(" · ");
        target.appendChild(warn);
      }
      const t = document.createElement("div"); target.appendChild(t);
      DataTable(t, {
        columns: [
          { key: "zorggroep", label: "Zorggroep", sortable: true, render: (r) => escapeHtml(r.zorggroep) + (r.alleen_voor ? ` <span class="zga-badge zga-badge-blue">alleen ${escapeHtml(r.alleen_voor)}</span>` : "") },
          { key: "start_pc4", label: "Van", sortable: true },
          { key: "end_pc4", label: "Tot en met", sortable: true },
          { key: "aantal_pc4", label: "Aantal PC4", sortable: true },
          { key: "gemeenten", label: "Gemeente(n)", render: (r) => escapeHtml(r.gemeenten) },
          { key: "bron", label: "Bron", sortable: true },
          { key: "deels", label: "Deels in gebied", render: (r) => (r.deels ? `<span class="text-xs text-amber-700 dark:text-amber-300">${escapeHtml(r.deels)}</span>` : "") },
        ], rows, searchKeys: ["zorggroep", "gemeenten", "pc4s", "alleen_voor"], searchPlaceholder: "Zoek PC4, zorggroep of gemeente...", limit: 300,
      });
    }
    async function loadRangeExceptions(target) {
      const rows = await api.get(`${PC_BASE}/ranges`);
      const bar = topBar("", canEdit() ? () => rangeForm(loadSub, null) : null, "Nieuwe range");
      target.appendChild(bar);
      const t = document.createElement("div"); target.appendChild(t);
      DataTable(t, {
        columns: [
          { key: "start_pc4", label: "Van", sortable: true },
          { key: "end_pc4", label: "Tot en met", sortable: true },
          { key: "zorggroep", label: "Zorggroep", sortable: true },
          { key: "source_sheet", label: "Bron", render: (r) => escapeHtml(r.source_sheet || "-") },
          { key: "is_active", label: "Status", sortable: true, sortValue: (r) => (r.is_active ? 1 : 0), render: (r) => statusBadge(r.is_active) },
          { key: "_acties", label: "Acties", render: (r) => actionButtons(r.id) },
        ], rows, searchKeys: ["start_pc4", "end_pc4", "zorggroep", "source_sheet"], searchPlaceholder: "Zoek range of zorggroep...",
      });
      t._rowAction = (a, r) => { if (a === "edit") rangeForm(loadSub, r); else if (a === "delete") deleteSimple(`${PC_BASE}/ranges/${r.id}`, `range ${r.start_pc4}-${r.end_pc4}`, loadSub); };
    }
    async function loadLocation() {
      const rows = await api.get(`${PC_BASE}/location`);
      const bar = topBar("", canEdit() ? () => locationForm(loadSub, null) : null, "Nieuwe locatie-postcode");
      host.innerHTML = ""; host.appendChild(bar);
      const t = document.createElement("div"); host.appendChild(t);
      DataTable(t, {
        columns: [
          { key: "postcode6", label: "Postcode", sortable: true },
          { key: "woonplaats", label: "Woonplaats", sortable: true },
          { key: "gemeente", label: "Gemeente", sortable: true },
          { key: "zorggroep", label: "Zorggroep", sortable: true },
          { key: "source", label: "Bron", render: (r) => escapeHtml(r.source || "") },
          { key: "_acties", label: "Acties", render: (r) => actionButtons(r.id) },
        ], rows, searchKeys: ["postcode6", "woonplaats", "gemeente", "zorggroep"], searchPlaceholder: "Zoek postcode of plaats...",
      });
      t._rowAction = (a, r) => { if (a === "edit") locationForm(loadSub, r); else if (a === "delete") deleteSimple(`${PC_BASE}/location/${r.id}`, `locatie ${r.postcode6}`, loadSub); };
    }
    drawNav();
    await loadSub();
  }

  function zorggroepDatalist() {
    const names = (state.cache.zorggroepen || []).map((z) => z.name);
    const extra = ["Geen zorggroep contract", "ESV", "Kennemerland", "ZHZ CZ", "ZHZ VGZ", "Zorggroep Gezondheid Amsterdam"];
    const all = Array.from(new Set([...names, ...extra]));
    return `<datalist id="zgNames">${all.map((n) => `<option value="${escapeHtml(n)}"></option>`).join("")}</datalist>`;
  }

  function exactForm(after, row) {
    const isEdit = !!row;
    const form = document.createElement("form");
    form.className = "grid gap-3";
    form.innerHTML = `
      ${field("Postcode (1234AB) *", `<input name="postcode6" class="zga-input" required value="${escapeHtml(row?.postcode6 || "")}" />`)}
      ${field("Zorggroep *", `<input name="zorggroep" class="zga-input" list="zgNames" required value="${escapeHtml(row?.zorggroep || "")}" />`, "Gebruik 'Geen zorggroep contract' om een postcode uit een brede regio te halen.")}
      ${zorggroepDatalist()}
      ${field("Bron", `<input name="source_sheet" class="zga-input" value="${escapeHtml(row?.source_sheet || "Handmatige uitzondering")}" />`)}
      ${field("Notitie", `<textarea name="note" class="zga-textarea">${escapeHtml(row?.note || "")}</textarea>`)}
      ${field("Verzekeraar-concerns (optioneel, komma-gescheiden)", `<input name="concerns" class="zga-input" value="${escapeHtml(concernsToText(row?.insurer_concerns))}" />`, "Leeg = geldt voor alle verzekeraars.")}
      ${field("Actief", `<select name="is_active" class="zga-select"><option value="true"${row && !row.is_active ? "" : " selected"}>Actief</option><option value="false"${row && !row.is_active ? " selected" : ""}>Inactief</option></select>`)}`;
    markDirtyOn(form);
    const save = makeButton(isEdit ? "Opslaan" : "Toevoegen", "zga-btn-primary", async () => {
      if (!confirmEdit(isEdit)) return;
      const fd = new FormData(form);
      const payload = {
        postcode6: String(fd.get("postcode6") || "").trim(),
        zorggroep: String(fd.get("zorggroep") || "").trim(),
        source_sheet: String(fd.get("source_sheet") || "").trim(),
        note: String(fd.get("note") || "").trim(),
        insurer_concerns: textToConcerns(fd.get("concerns")),
        is_active: fd.get("is_active") === "true",
      };
      if (!payload.postcode6 || !payload.zorggroep) { toast("Postcode en zorggroep zijn verplicht.", "error"); return; }
      save.disabled = true;
      try {
        if (isEdit) await api.put(`${PC_BASE}/exact/${row.id}`, payload); else await api.post(`${PC_BASE}/exact`, payload);
        state.formDirty = false; toast("Opgeslagen.", "success"); closeModal(true); after();
      } catch (err) { toast(err.message, "error"); save.disabled = false; }
    });
    openModal({ title: isEdit ? "Exacte postcode bewerken" : "Nieuwe exacte postcode", body: form, footer: [makeButton("Annuleren", "zga-btn-ghost", () => closeModal()), save] });
  }

  function rangeForm(after, row) {
    const isEdit = !!row;
    const form = document.createElement("form");
    form.className = "grid gap-3";
    form.innerHTML = `
      <div class="grid grid-cols-2 gap-3">
        ${field("Van (PC4) *", `<input name="start_pc4" class="zga-input" required value="${escapeHtml(row?.start_pc4 || "")}" placeholder="1234" />`)}
        ${field("Tot en met (PC4) *", `<input name="end_pc4" class="zga-input" required value="${escapeHtml(row?.end_pc4 || "")}" placeholder="1299" />`)}
      </div>
      ${field("Zorggroep *", `<input name="zorggroep" class="zga-input" list="zgNames" required value="${escapeHtml(row?.zorggroep || "")}" />`)}
      ${zorggroepDatalist()}
      ${field("Bron", `<input name="source_sheet" class="zga-input" value="${escapeHtml(row?.source_sheet || "Handmatige uitzondering")}" />`)}
      ${field("Verzekeraar-concerns (optioneel, komma-gescheiden)", `<input name="concerns" class="zga-input" value="${escapeHtml(concernsToText(row?.insurer_concerns))}" />`)}
      ${field("Actief", `<select name="is_active" class="zga-select"><option value="true"${row && !row.is_active ? "" : " selected"}>Actief</option><option value="false"${row && !row.is_active ? " selected" : ""}>Inactief</option></select>`)}`;
    markDirtyOn(form);
    const save = makeButton(isEdit ? "Opslaan" : "Toevoegen", "zga-btn-primary", async () => {
      if (!confirmEdit(isEdit)) return;
      const fd = new FormData(form);
      const payload = {
        start_pc4: String(fd.get("start_pc4") || "").trim(),
        end_pc4: String(fd.get("end_pc4") || "").trim(),
        zorggroep: String(fd.get("zorggroep") || "").trim(),
        source_sheet: String(fd.get("source_sheet") || "").trim(),
        insurer_concerns: textToConcerns(fd.get("concerns")),
        is_active: fd.get("is_active") === "true",
      };
      if (!payload.start_pc4 || !payload.end_pc4 || !payload.zorggroep) { toast("Van, tot en zorggroep zijn verplicht.", "error"); return; }
      save.disabled = true;
      try {
        if (isEdit) await api.put(`${PC_BASE}/ranges/${row.id}`, payload); else await api.post(`${PC_BASE}/ranges`, payload);
        state.formDirty = false; toast("Opgeslagen.", "success"); closeModal(true); after();
      } catch (err) { toast(err.message, "error"); save.disabled = false; }
    });
    openModal({ title: isEdit ? "Range bewerken" : "Nieuwe range", body: form, footer: [makeButton("Annuleren", "zga-btn-ghost", () => closeModal()), save] });
  }

  function locationForm(after, row) {
    const isEdit = !!row;
    const form = document.createElement("form");
    form.className = "grid gap-3";
    form.innerHTML = `
      ${field("Postcode (1234AB) *", `<input name="postcode6" class="zga-input" required value="${escapeHtml(row?.postcode6 || "")}" />`)}
      ${field("Woonplaats", `<input name="woonplaats" class="zga-input" value="${escapeHtml(row?.woonplaats || "")}" />`)}
      ${field("Gemeente", `<input name="gemeente" class="zga-input" value="${escapeHtml(row?.gemeente || "")}" />`)}
      ${field("Zorggroep *", `<input name="zorggroep" class="zga-input" list="zgNames" required value="${escapeHtml(row?.zorggroep || "")}" />`)}
      ${zorggroepDatalist()}
      ${field("Bron", `<input name="source" class="zga-input" value="${escapeHtml(row?.source || "")}" />`)}
      ${field("Actief", `<select name="is_active" class="zga-select"><option value="true"${row && !row.is_active ? "" : " selected"}>Actief</option><option value="false"${row && !row.is_active ? " selected" : ""}>Inactief</option></select>`)}`;
    markDirtyOn(form);
    const save = makeButton(isEdit ? "Opslaan" : "Toevoegen", "zga-btn-primary", async () => {
      if (!confirmEdit(isEdit)) return;
      const fd = new FormData(form);
      const payload = {
        postcode6: String(fd.get("postcode6") || "").trim(),
        woonplaats: String(fd.get("woonplaats") || "").trim(),
        gemeente: String(fd.get("gemeente") || "").trim(),
        zorggroep: String(fd.get("zorggroep") || "").trim(),
        source: String(fd.get("source") || "").trim(),
        is_active: fd.get("is_active") === "true",
      };
      if (!payload.postcode6 || !payload.zorggroep) { toast("Postcode en zorggroep zijn verplicht.", "error"); return; }
      save.disabled = true;
      try {
        if (isEdit) await api.put(`${PC_BASE}/location/${row.id}`, payload); else await api.post(`${PC_BASE}/location`, payload);
        state.formDirty = false; toast("Opgeslagen.", "success"); closeModal(true); after();
      } catch (err) { toast(err.message, "error"); save.disabled = false; }
    });
    openModal({ title: isEdit ? "Locatie-postcode bewerken" : "Nieuwe locatie-postcode", body: form, footer: [makeButton("Annuleren", "zga-btn-ghost", () => closeModal()), save] });
  }

  const PLACES_BASE = "/api/admin/place-aliases";

  function placeForm(after, row) {
    const isEdit = !!row;
    const form = document.createElement("form");
    form.className = "grid gap-3";
    form.innerHTML = `
      ${field("Plaatsnaam *", `<input name="plaatsnaam" class="zga-input" required placeholder="bijv. Epse" value="${escapeHtml(row?.plaatsnaam || "")}" />`)}
      ${field("Gemeente", `<input name="gemeente" class="zga-input" placeholder="bijv. Lochem" value="${escapeHtml(row?.gemeente || "")}" />`, "De officiële gemeentenaam waarin de plaats ligt (zoals op de kaart). Leeg laten = deze plaats niet inkleuren.")}
      ${field("Actief", `<select name="is_active" class="zga-select"><option value="true"${row && !row.is_active ? "" : " selected"}>Actief</option><option value="false"${row && !row.is_active ? " selected" : ""}>Inactief</option></select>`)}`;
    markDirtyOn(form);
    const save = makeButton(isEdit ? "Opslaan" : "Toevoegen", "zga-btn-primary", async () => {
      if (!confirmEdit(isEdit)) return;
      const fd = new FormData(form);
      const payload = {
        plaatsnaam: String(fd.get("plaatsnaam") || "").trim(),
        gemeente: String(fd.get("gemeente") || "").trim(),
        is_active: fd.get("is_active") === "true",
      };
      if (!payload.plaatsnaam) { toast("Plaatsnaam is verplicht.", "error"); return; }
      save.disabled = true;
      try {
        if (isEdit) await api.put(`${PLACES_BASE}/${row.id}`, payload); else await api.post(PLACES_BASE, payload);
        state.formDirty = false; toast("Opgeslagen.", "success"); closeModal(true); after();
      } catch (err) { toast(err.message, "error"); save.disabled = false; }
    });
    openModal({ title: isEdit ? "Plaatsnaam bewerken" : "Nieuwe plaatsnaam", body: form, footer: [makeButton("Annuleren", "zga-btn-ghost", () => closeModal()), save] });
  }

  function deleteSimple(url, label, after) {
    confirmDialog({
      title: "Verwijderen",
      message: `Weet je zeker dat je ${label} wilt verwijderen?`,
      confirmLabel: "Verwijderen", danger: true,
      onConfirm: async () => { await api.del(url); toast("Verwijderd.", "success"); after(); },
    });
  }

  // ---------------- Gebruikers ----------------
  async function renderGebruikers(content) {
    if (!isSuperAdmin()) { content.innerHTML = '<div class="zga-card text-sm text-slate-500">Alleen een super_admin mag gebruikers beheren.</div>'; return; }
    const rows = await api.get("/api/admin/users");
    const header = topBar("Gebruikers", () => userForm(null), "Nieuwe gebruiker");
    content.innerHTML = ""; content.appendChild(header);
    const host = document.createElement("div"); content.appendChild(host);
    DataTable(host, {
      columns: [
        { key: "name", label: "Naam", sortable: true },
        { key: "email", label: "E-mail", sortable: true },
        { key: "role", label: "Rol", sortable: true, render: (r) => `<span class="zga-badge zga-badge-blue">${escapeHtml(ROLE_LABELS[r.role] || r.role)}</span>` },
        { key: "is_active", label: "Status", sortable: true, sortValue: (r) => (r.is_active ? 1 : 0), render: (r) => statusBadge(r.is_active) },
        { key: "_acties", label: "Acties", render: (r) => actionButtons(r.id, { toggle: r.id !== state.user.id, toggleLabel: r.is_active ? "Deactiveren" : "Activeren", delete: r.id !== state.user.id }) },
      ],
      rows, searchKeys: ["name", "email", "role"], searchPlaceholder: "Zoek gebruiker...",
    });
    host._rowAction = (action, row) => {
      if (action === "edit") userForm(row);
      else if (action === "toggle") toggleActive("/api/admin/users", row, () => selectTab("gebruikers"));
      else if (action === "delete") deleteEntity("/api/admin/users", row.id, `gebruiker "${row.name}"`, () => selectTab("gebruikers"));
    };
  }

  function userForm(row) {
    const isEdit = !!row;
    const roles = ["viewer", "editor", "admin", "super_admin"];
    const form = document.createElement("form");
    form.className = "grid gap-3";
    form.innerHTML = `
      ${field("Naam *", `<input name="name" class="zga-input" required value="${escapeHtml(row?.name || "")}" />`)}
      ${field("E-mail *", `<input name="email" type="email" class="zga-input" required value="${escapeHtml(row?.email || "")}" />`)}
      ${field(isEdit ? "Nieuw wachtwoord" : "Wachtwoord *", `<input name="password" type="password" class="zga-input" ${isEdit ? "" : "required"} autocomplete="new-password" />`, isEdit ? "Laat leeg om ongewijzigd te laten. Min. 8 tekens." : "Minimaal 8 tekens.")}
      ${field("Rol", `<select name="role" class="zga-select">${roles.map((r) => `<option value="${r}"${(row?.role || "editor") === r ? " selected" : ""}>${escapeHtml(ROLE_LABELS[r])}</option>`).join("")}</select>`)}
      ${field("Actief", `<select name="is_active" class="zga-select"><option value="true"${row && !row.is_active ? "" : " selected"}>Actief</option><option value="false"${row && !row.is_active ? " selected" : ""}>Inactief</option></select>`)}`;
    markDirtyOn(form);
    const save = makeButton(isEdit ? "Opslaan" : "Toevoegen", "zga-btn-primary", async () => {
      if (!confirmEdit(isEdit)) return;
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const email = String(fd.get("email") || "").trim();
      const password = String(fd.get("password") || "");
      if (!name || !email) { toast("Naam en e-mail zijn verplicht.", "error"); return; }
      if (!isEdit && password.length < 8) { toast("Wachtwoord moet minstens 8 tekens zijn.", "error"); return; }
      save.disabled = true;
      try {
        if (isEdit) {
          const payload = { name, email, role: fd.get("role"), is_active: fd.get("is_active") === "true" };
          if (password) payload.password = password;
          await api.put(`/api/admin/users/${row.id}`, payload);
        } else {
          await api.post("/api/admin/users", { name, email, password, role: fd.get("role"), is_active: fd.get("is_active") === "true" });
        }
        state.formDirty = false; toast("Opgeslagen.", "success"); closeModal(true); selectTab("gebruikers");
      } catch (err) { toast(err.message, "error"); save.disabled = false; }
    });
    openModal({ title: isEdit ? "Gebruiker bewerken" : "Nieuwe gebruiker", body: form, footer: [makeButton("Annuleren", "zga-btn-ghost", () => closeModal()), save] });
  }

  // ---------------- History ----------------
  async function renderHistory(content) {
    content.innerHTML = `
      <div class="zga-card mb-3">
        <div class="flex flex-wrap items-end gap-2">
          <label class="grid gap-1 text-sm"><span class="font-medium">Entiteit</span>
            <select id="hEntity" class="zga-select">
              <option value="">Alle</option>
              <option value="zorggroep">Zorggroep</option>
              <option value="zorgverzekeraar">Zorgverzekeraar</option>
              <option value="facturatiestroom">Facturatiestroom</option>
              <option value="contract_rule">Contractregel</option>
              <option value="user">Gebruiker</option>
              <option value="auth">Login/Logout</option>
            </select></label>
          <label class="grid gap-1 text-sm"><span class="font-medium">Actie</span>
            <select id="hAction" class="zga-select">
              <option value="">Alle</option><option value="create">create</option><option value="update">update</option>
              <option value="delete">delete</option><option value="login">login</option><option value="logout">logout</option>
            </select></label>
          <label class="grid gap-1 text-sm"><span class="font-medium">Gebruiker (e-mail)</span>
            <input id="hActor" class="zga-input" placeholder="bevat..." /></label>
          <button id="hApply" class="zga-btn-primary">Filteren</button>
        </div>
      </div>
      <div id="historyHost"></div>`;
    const load = async () => {
      const params = new URLSearchParams();
      if (el("hEntity").value) params.set("entity_type", el("hEntity").value);
      if (el("hAction").value) params.set("action", el("hAction").value);
      if (el("hActor").value.trim()) params.set("actor_email", el("hActor").value.trim());
      params.set("limit", "300");
      const logs = await api.get(`/api/admin/audit-logs?${params.toString()}`);
      const host = el("historyHost");
      DataTable(host, {
        columns: [
          { key: "created_at", label: "Tijdstip", sortable: true, render: (r) => escapeHtml(fmtDate(r.created_at)) },
          { key: "actor_name", label: "Gebruiker", sortable: true, render: (r) => `${escapeHtml(r.actor_name || "-")}<div class="text-xs text-slate-400">${escapeHtml(r.actor_email || "")}</div>` },
          { key: "action", label: "Actie", sortable: true, render: (r) => `<span class="zga-badge zga-badge-blue">${escapeHtml(r.action)}</span>` },
          { key: "entity_type", label: "Entiteit", sortable: true, render: (r) => `${escapeHtml(r.entity_type)} <span class="text-slate-400">#${escapeHtml(r.entity_id)}</span>` },
          { key: "_diff", label: "Wijziging", render: (r) => diffCell(r) },
          { key: "_herstel", label: "Herstel", render: (r) => (canEdit() && isRollbackable(r))
              ? `<button class="zga-btn-soft-warn" data-action="rollback" data-id="${r.id}">&#8634; Herstel</button>`
              : "" },
        ],
        rows: logs, searchKeys: ["actor_name", "actor_email", "entity_type", "action"],
        searchPlaceholder: "Zoek in history...",
        emptyText: "Geen logregels gevonden.",
      });
      host._rowAction = (a, r) => { if (a === "rollback") doRollback(r, load); };
    };
    el("hApply").addEventListener("click", load);
    await load();
  }

  const ROLLBACK_ENTITIES = new Set([
    "zorggroep", "zorgverzekeraar", "facturatiestroom", "contract_rule",
    "postcode_override", "location_override", "range_override", "user",
  ]);
  function isRollbackable(log) {
    return ROLLBACK_ENTITIES.has(log.entity_type) && ["create", "update", "delete"].includes(log.action);
  }
  function doRollback(log, after) {
    const what = log.action === "create" ? "het aanmaken terugdraaien (record verwijderen)"
      : log.action === "delete" ? "dit verwijderde item terugzetten"
      : "deze wijziging terugdraaien naar de vorige waarde";
    confirmDialog({
      title: "Herstellen / rollback",
      message: `Weet je zeker dat je ${what}? Voor ${log.entity_type} #${log.entity_id}. Deze herstelactie wordt zelf ook gelogd.`,
      confirmLabel: "Herstellen", danger: false,
      onConfirm: async () => {
        const res = await api.post(`/api/admin/audit-logs/${log.id}/rollback`);
        toast(res.detail || "Hersteld.", "success");
        refreshVersionBadge();
        after();
      },
    });
  }

  function diffCell(row) {
    let oldObj = {}, newObj = {};
    try { oldObj = row.old_value_json ? JSON.parse(row.old_value_json) : {}; } catch (e) {}
    try { newObj = row.new_value_json ? JSON.parse(row.new_value_json) : {}; } catch (e) {}
    const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
    const skip = new Set(["updated_at", "created_at"]);
    const changed = keys.filter((k) => !skip.has(k) && JSON.stringify(oldObj[k]) !== JSON.stringify(newObj[k]));
    if (!changed.length) {
      const summary = row.action === "create" ? "Nieuw aangemaakt" : row.action === "delete" ? "Verwijderd" : (row.action === "login" || row.action === "logout") ? "-" : "Geen veldwijziging";
      return `<span class="text-xs text-slate-400">${summary}</span>`;
    }
    const shortKeys = changed.slice(0, 3).join(", ") + (changed.length > 3 ? "…" : "");
    const detail = changed.map((k) =>
      `<div><strong>${escapeHtml(k)}</strong>: <span class="zga-diff zga-diff-old">${escapeHtml(JSON.stringify(oldObj[k] ?? ""))}</span> &rarr; <span class="zga-diff zga-diff-new">${escapeHtml(JSON.stringify(newObj[k] ?? ""))}</span></div>`
    ).join("");
    return `<details><summary class="cursor-pointer text-xs text-slate-500">${escapeHtml(changed.length)} veld(en): ${escapeHtml(shortKeys)}</summary><div class="mt-1 grid gap-1">${detail}</div></details>`;
  }

  // ---------------- Shared actions ----------------
  function topBar(title, onAdd, addLabel) {
    const bar = document.createElement("div");
    bar.className = "mb-3 flex items-center justify-between gap-3";
    bar.innerHTML = `<h1 class="text-lg font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(title)}</h1>`;
    if (onAdd) {
      const b = makeButton("+ " + (addLabel || "Toevoegen"), "zga-btn-primary", onAdd);
      bar.appendChild(b);
    }
    return bar;
  }
  function toggleActive(base, row, after) {
    const activate = !row.is_active;
    confirmDialog({
      title: activate ? "Activeren" : "Deactiveren",
      message: activate ? `Weet je zeker dat je "${row.name || row.label}" wilt activeren?` : `Weet je zeker dat je "${row.name || row.label}" wilt deactiveren? Het verdwijnt dan uit de publieke kaart.`,
      confirmLabel: activate ? "Activeren" : "Deactiveren",
      danger: !activate,
      onConfirm: async () => { await api.put(`${base}/${row.id}`, { is_active: activate }); toast("Status bijgewerkt.", "success"); after(); },
    });
  }
  function deleteEntity(base, id, label, after) {
    confirmDialog({
      title: "Verwijderen",
      message: `Weet je zeker dat je ${label} definitief wilt verwijderen? Deze actie wordt gelogd in de history.`,
      confirmLabel: "Verwijderen",
      danger: true,
      onConfirm: async () => { await api.del(`${base}/${id}?hard=true`); toast("Verwijderd.", "success"); after(); },
    });
  }

  // ---------------- Auth flow ----------------
  function showLogin() {
    el("appView").classList.add("hidden");
    const lv = el("loginView");
    lv.classList.remove("hidden");
    lv.classList.add("flex");
  }
  function showApp() {
    const lv = el("loginView");
    lv.classList.add("hidden");
    lv.classList.remove("flex");
    el("appView").classList.remove("hidden");
    el("currentUserName").textContent = state.user.name;
    el("currentUserRole").textContent = ROLE_LABELS[state.user.role] || state.user.role;
    const pubBtn = el("publishBtn");
    if (pubBtn) pubBtn.classList.toggle("hidden", !canPublish());
    renderTabNav();
    selectTab("dashboard");
  }

  function handlePublish() {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <p class="text-sm leading-6 text-slate-600 dark:text-slate-300">
        Dit schrijft de huidige database naar <code>zg-data/zorggroepen.json</code> en
        <code>zg-data/postcode_overrides.json</code> (met automatische backup) en doet daarna een
        <strong>git commit + push naar GitHub</strong>. Na de deploy wordt de live site bijgewerkt.
      </p>
      <p class="mt-2 text-xs text-slate-400">Alleen deze twee databestanden worden gecommit; de admin-code blijft buiten de commit.</p>`;
    const cancel = makeButton("Annuleren", "zga-btn-ghost", () => closeModal(true));
    const ok = makeButton("Publiceren & pushen", "zga-btn-primary", async () => {
      ok.disabled = true; ok.textContent = "Bezig...";
      try {
        const res = await api.post("/api/admin/publish?push=true");
        closeModal(true);
        showPublishResult(res);
        refreshVersionBadge();
      } catch (err) {
        toast(err.message || "Publiceren mislukt", "error");
        ok.disabled = false; ok.textContent = "Publiceren & pushen";
      }
    });
    openModal({ title: "Publiceren naar GitHub", body: wrap, footer: [cancel, ok] });
  }

  function showPublishResult(res) {
    const lines = (res.log || []).map((l) => `<li>${escapeHtml(l)}</li>`).join("");
    const status = res.ok
      ? (res.pushed ? '<span class="zga-badge zga-badge-green">Gepusht naar GitHub</span>'
        : (res.committed ? '<span class="zga-badge zga-badge-amber">Lokaal gecommit, niet gepusht</span>'
          : '<span class="zga-badge zga-badge-blue">JSON bijgewerkt</span>'))
      : '<span class="zga-badge zga-badge-red">Aandacht nodig</span>';
    const wrap = document.createElement("div");
    wrap.innerHTML = `<div class="mb-2">${status}${res.branch ? ` <span class="text-xs text-slate-400">branch: ${escapeHtml(res.branch)}</span>` : ""}</div>
      <ul class="zga-diff list-disc pl-5">${lines}</ul>`;
    openModal({ title: "Resultaat publiceren", body: wrap, footer: [makeButton("Sluiten", "zga-btn-primary", () => closeModal(true))] });
    if (res.ok && res.pushed) toast("Gepubliceerd en gepusht naar GitHub.", "success");
    else if (res.ok) toast("Data bijgewerkt.", "success");
    else toast("Publiceren vereist aandacht, zie details.", "error");
  }

  async function handleLogin(e) {
    e.preventDefault();
    const btn = el("loginSubmit");
    const errBox = el("loginError");
    errBox.classList.add("hidden");
    btn.disabled = true; btn.textContent = "Bezig...";
    try {
      const user = await api.login(el("loginEmail").value.trim(), el("loginPassword").value);
      state.user = user;
      el("loginPassword").value = "";
      showApp();
    } catch (err) {
      errBox.textContent = err.message || "Inloggen mislukt.";
      errBox.classList.remove("hidden");
    } finally {
      btn.disabled = false; btn.textContent = "Inloggen";
    }
  }

  async function handleLogout() {
    try { await api.logout(); } catch (e) {}
    state.user = null;
    showLogin();
  }

  async function init() {
    initTheme();
    el("loginForm").addEventListener("submit", handleLogin);
    el("logoutBtn").addEventListener("click", handleLogout);
    const pubBtn = el("publishBtn");
    if (pubBtn) pubBtn.addEventListener("click", handlePublish);
    document.querySelectorAll("[data-modal-close]").forEach((b) => b.addEventListener("click", () => closeModal()));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && el("modalRoot").classList.contains("flex")) closeModal(); });
    window.addEventListener("beforeunload", (e) => { if (state.formDirty) { e.preventDefault(); e.returnValue = ""; } });

    try {
      state.user = await api.me();
      showApp();
    } catch (err) {
      if (err.code === "NETWORK") {
        el("loginError").textContent = "Backend niet bereikbaar. Start de server op poort 8000.";
        el("loginError").classList.remove("hidden");
      }
      showLogin();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
