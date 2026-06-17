/**
 * Gedeelde API-client voor MiGuide Zorgtools.
 * Wordt gebruikt door de adminomgeving en (optioneel) door de publieke kaart.
 *
 * De adminomgeving wordt same-origin geserveerd door de FastAPI-backend
 * (standaard http://127.0.0.1:8000/admin/), zodat de HttpOnly sessie-cookie
 * automatisch meegestuurd wordt.
 */
(function (global) {
  "use strict";

  function resolveBase() {
    if (global.MIGUIDE_ADMIN_API) {
      return String(global.MIGUIDE_ADMIN_API).replace(/\/$/, "");
    }
    // Geopend als los bestand -> wijs naar lokale backend.
    if (global.location && global.location.protocol === "file:") {
      return "http://127.0.0.1:8000";
    }
    // Anders same-origin (relatieve paden).
    return "";
  }

  const API_BASE = resolveBase();

  async function request(method, path, body, options) {
    const opts = options || {};
    const init = {
      method,
      credentials: "include",
      headers: {},
    };
    if (body !== undefined && body !== null) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, init);
    } catch (networkError) {
      const err = new Error("Backend niet bereikbaar. Draait de server op poort 8000?");
      err.code = "NETWORK";
      throw err;
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const detail = typeof payload === "string"
        ? payload
        : (payload && (payload.detail || payload.message)) || `Fout (${response.status})`;
      const err = new Error(Array.isArray(detail) ? formatValidationError(detail) : detail);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  }

  function formatValidationError(detailList) {
    try {
      return detailList
        .map((item) => {
          const loc = Array.isArray(item.loc) ? item.loc.slice(1).join(".") : "";
          return loc ? `${loc}: ${item.msg}` : item.msg;
        })
        .join(" | ");
    } catch (e) {
      return "Validatiefout.";
    }
  }

  const api = {
    base: API_BASE,
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    del: (path) => request("DELETE", path),

    // Auth
    login: (email, password) => request("POST", "/api/auth/login", { email, password }),
    logout: () => request("POST", "/api/auth/logout"),
    me: () => request("GET", "/api/auth/me"),

    // Public
    publicZorggroepen: () => request("GET", "/api/public/zorggroepen"),
    publicVersion: () => request("GET", "/api/public/version"),
  };

  global.MiGuideApi = api;
})(window);
