const AUTH_SESSION_KEY = "miguide_auth_ok";
const THEME_STORAGE_KEY = "miguide_theme";
const REFERRAL_API_BASE = window.REFERRAL_API_BASE || "http://127.0.0.1:8001";
const PDFJS_CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const TESSERACT_CDN_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
const APIFREELLM_API_KEY = window.APIFREELLM_API_KEY || "";
const APIFREELLM_API_URL = "https://apifreellm.com/api/v1/chat";
const APIFREELLM_MODEL = "apifreellm";

const FALLBACK_SCHEMA = {
  status: "draft",
  tool: "losse-verwijzing-verwerken",
  input_types: ["pdf", "image"],
  fields: {
    sender: {
      name: "",
      agb_code: "",
      organization: "",
      organization_agb_code: "",
      street: "",
      house_number: "",
      postal_code: "",
      city: ""
    },
    person: {
      initials: "",
      first_name: "",
      last_name: "",
      date_of_birth: "",
      gender: "",
      bsn: ""
    },
    contact: {
      street: "",
      house_number: "",
      postal_code: "",
      city: "",
      phone: "",
      email: ""
    },
    referral: {
      referral_date: "",
      zd_number: "",
      gp_name: "",
      practice_name: "",
      agb_code: "",
      care_product_name: "",
      care_question: "",
      reason: "",
      clinical_information: "",
      referral_type: ""
    },
    insurance: {
      insurer: "",
      policy_number: "",
      insured_number: ""
    },
    meta: {
      source_file: "",
      source_type: "",
      ocr_used: false,
      extraction_method: "",
      page_count: null,
      confidence: null,
      review_required: true
    }
  }
};

const state = {
  schema: null,
  output: null,
  selectedFile: null,
  previewUrl: "",
  initialized: false,
  processing: false
};

const refs = {};
const REQUIRED_FIELD_PATHS = [
  "sender.name",
  "sender.agb_code",
  "person.first_name",
  "person.last_name",
  "person.date_of_birth",
  "person.bsn",
  "contact.street",
  "contact.house_number",
  "contact.postal_code",
  "contact.city",
  "insurance.insurer",
  "referral.referral_date",
  "referral.gp_name",
  "referral.practice_name",
  "referral.care_product_name"
];
const externalScriptPromises = new Map();

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getSourceType(file) {
  if (!file) {
    return "";
  }
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return "pdf";
  }
  if (String(file.type || "").startsWith("image/")) {
    return "image";
  }
  return "unknown";
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

  if (refs.themeToggle) {
    refs.themeToggle.setAttribute("aria-label", nextMode === "dark" ? "Dark mode actief" : "Light mode actief");
    refs.themeToggle.setAttribute("title", nextMode === "dark" ? "Dark mode" : "Light mode");
  }

  if (refs.themeToggleIcon) {
    refs.themeToggleIcon.textContent = nextMode === "dark" ? "🌙" : "☀";
  }

  if (refs.siteLogo) {
    const lightLogo = refs.siteLogo.getAttribute("data-logo-light");
    const darkLogo = refs.siteLogo.getAttribute("data-logo-dark");
    refs.siteLogo.src = nextMode === "dark" ? (darkLogo || lightLogo || refs.siteLogo.src) : (lightLogo || refs.siteLogo.src);
  }
}

function initThemeToggle() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  setTheme(saved || "light");

  if (refs.themeToggle && !refs.themeToggle.dataset.themeBound) {
    refs.themeToggle.dataset.themeBound = "1";
    refs.themeToggle.addEventListener("click", () => {
      setTheme(isDarkModeActive() ? "light" : "dark");
    });
  }
}

function getPdfLib() {
  return window.pdfjsLib || window["pdfjs-dist/build/pdf"] || null;
}

function loadExternalScript(url, isReady, label) {
  if (typeof isReady === "function" && isReady()) {
    return Promise.resolve();
  }

  if (externalScriptPromises.has(url)) {
    return externalScriptPromises.get(url);
  }

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-external-src="${url}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`${label} laden mislukt.`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.externalSrc = url;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error(`${label} laden mislukt.`)), { once: true });
    document.head.appendChild(script);
  }).then(() => {
    if (typeof isReady === "function" && !isReady()) {
      throw new Error(`${label} is geladen, maar niet beschikbaar in de pagina.`);
    }
  });

  externalScriptPromises.set(url, promise);
  return promise;
}

async function ensureFrontendProcessingLibraries() {
  if (!getPdfLib()) {
    setStatus("Lokale PDF-verwerking laden...", "processing");
    await loadExternalScript(PDFJS_CDN_URL, () => Boolean(getPdfLib()), "PDF.js");
  }

  if (!window.Tesseract) {
    setStatus("Lokale OCR laden...", "processing");
    await loadExternalScript(TESSERACT_CDN_URL, () => Boolean(window.Tesseract), "Tesseract.js");
  }
}

function setNestedValue(target, path, value) {
  const keys = path.split(".");
  let cursor = target;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    if (!cursor[key] || typeof cursor[key] !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
}

function getNestedValue(target, path) {
  return path.split(".").reduce((cursor, key) => (cursor ? cursor[key] : ""), target);
}

function getEmptyOutput(schema) {
  return {
    status: schema.status || "draft",
    tool: schema.tool || "losse-verwijzing-verwerken",
    input_types: Array.isArray(schema.input_types) ? [...schema.input_types] : [],
    fields: deepClone(schema.fields || {})
  };
}

function setStatus(message, type = "neutral") {
  refs.statusBanner.textContent = message;
  refs.statusBanner.classList.remove("processing", "success", "error");
  if (type !== "neutral") {
    refs.statusBanner.classList.add(type);
  }
}

function setSourceBadge(label) {
  refs.sourceTypeBadge.textContent = label || "Geen bron";
}

function setConfidenceBadge(label) {
  refs.confidenceBadge.textContent = label || "Review nodig";
}

function setPreviewFullscreenButtonState() {
  if (!refs.openPreviewFullscreenButton) {
    return;
  }
  refs.openPreviewFullscreenButton.disabled = !state.selectedFile;
}

function setProcessingState(isProcessing) {
  state.processing = isProcessing;
  refs.processButton.disabled = isProcessing || !state.selectedFile;
  refs.resetButton.disabled = isProcessing;
  refs.copyJsonButton.disabled = isProcessing;
  refs.downloadJsonButton.disabled = isProcessing;
  refs.fileInput.disabled = isProcessing;
}

function clearFullscreenPreviewContent() {
  if (!refs.fullscreenImagePreview || !refs.fullscreenPdfPreview || !refs.fullscreenEmptyPreview) {
    return;
  }
  refs.fullscreenImagePreview.hidden = true;
  refs.fullscreenImagePreview.removeAttribute("src");
  refs.fullscreenPdfPreview.hidden = true;
  refs.fullscreenPdfPreview.removeAttribute("src");
  refs.fullscreenEmptyPreview.hidden = false;
}

function syncFullscreenPreview() {
  if (!refs.fullscreenRawText) {
    return;
  }

  refs.fullscreenRawText.value = refs.rawText ? refs.rawText.value : "";
  setPreviewFullscreenButtonState();

  if (!state.selectedFile || !state.previewUrl) {
    clearFullscreenPreviewContent();
    return;
  }

  const sourceType = getSourceType(state.selectedFile);
  clearFullscreenPreviewContent();

  if (sourceType === "image") {
    refs.fullscreenImagePreview.src = state.previewUrl;
    refs.fullscreenImagePreview.hidden = false;
    refs.fullscreenEmptyPreview.hidden = true;
    return;
  }

  if (sourceType === "pdf") {
    refs.fullscreenPdfPreview.src = `${state.previewUrl}#toolbar=0&navpanes=0&scrollbar=1`;
    refs.fullscreenPdfPreview.hidden = false;
    refs.fullscreenEmptyPreview.hidden = true;
  }
}

function closePreviewFullscreen() {
  if (!refs.previewFullscreenModal) {
    return;
  }
  refs.previewFullscreenModal.hidden = true;
  refs.previewFullscreenModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("preview-modal-open");
}

function openPreviewFullscreen() {
  if (!state.selectedFile || !refs.previewFullscreenModal) {
    return;
  }

  syncFullscreenPreview();
  refs.previewFullscreenModal.hidden = false;
  refs.previewFullscreenModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("preview-modal-open");
  refs.closePreviewFullscreenButton?.focus();
}

function clearPreview() {
  closePreviewFullscreen();
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = "";
  }
  refs.imagePreview.hidden = true;
  refs.imagePreview.removeAttribute("src");
  refs.pdfPreview.hidden = true;
  refs.pdfPreview.removeAttribute("src");
  refs.emptyPreview.hidden = false;
  clearFullscreenPreviewContent();
  setPreviewFullscreenButtonState();
}

function renderPreview(file) {
  clearPreview();
  if (!file) {
    syncFullscreenPreview();
    return;
  }

  state.previewUrl = URL.createObjectURL(file);
  const sourceType = getSourceType(file);

  if (sourceType === "image") {
    refs.imagePreview.src = state.previewUrl;
    refs.imagePreview.hidden = false;
    refs.emptyPreview.hidden = true;
    return;
  }

  if (sourceType === "pdf") {
    refs.pdfPreview.src = `${state.previewUrl}#toolbar=0&navpanes=0&scrollbar=1`;
    refs.pdfPreview.hidden = false;
    refs.emptyPreview.hidden = true;
  }

  syncFullscreenPreview();
}

function renderOutput() {
  refs.jsonOutput.textContent = JSON.stringify(state.output, null, 2);
}

function syncReviewFormValues(fieldsSource) {
  const fields = refs.reviewForm.querySelectorAll("[data-path]");
  for (const field of fields) {
    const value = getNestedValue(fieldsSource, field.dataset.path);
    field.value = value ?? "";
  }
}

function renderForm() {
  syncReviewFormValues(state.output.fields);
  updateReviewSummary();
}

function renderValidation(items) {
  if (!Array.isArray(items) || items.length === 0) {
    refs.validationList.innerHTML = '<li class="validation-empty">Nog geen validaties uitgevoerd.</li>';
    return;
  }

  refs.validationList.innerHTML = items
    .map((item) => `<li class="${item.className}">${item.text}</li>`)
    .join("");
}

function getBaseValidationMessages() {
  if (!state.selectedFile) {
    return [];
  }

  return [
    {
      className: "validation-ok",
      text: `Bestand geladen: ${state.selectedFile.name}`
    }
  ];
}

function resetOutput() {
  state.output = getEmptyOutput(state.schema || FALLBACK_SCHEMA);
  state.output.fields.meta.review_completed_at = "";
  state.output.fields.meta.review_status = "open";
  state.output.fields.meta.next_action = "";
  renderForm();
  renderOutput();
  renderValidation([]);
  refs.rawText.value = "";
  syncFullscreenPreview();
  setSourceBadge("Geen bron");
  setConfidenceBadge("Review nodig");
}

function updateMetaFromFile(file) {
  const sourceType = getSourceType(file);
  state.output.fields.meta.source_file = file ? file.name : "";
  state.output.fields.meta.source_type = sourceType;
  state.output.fields.meta.ocr_used = false;
  state.output.fields.meta.confidence = null;
  state.output.fields.meta.review_required = true;
  state.output.fields.meta.extraction_method = "";
  state.output.fields.meta.page_count = null;
}

function updateRawTextPlaceholder(file) {
  if (!file) {
    refs.rawText.value = "";
    return;
  }

  const sourceType = getSourceType(file);
  const lines = [
    "Document nog niet verwerkt",
    "",
    `Bestand: ${file.name}`,
    `Type: ${sourceType || "onbekend"}`,
    `Grootte: ${Math.round(file.size / 1024)} KB`,
    "",
    "Klik op 'Start verwerking' om in fase 2 de ruwe tekst uit PDF parsing of OCR te laden."
  ];
  refs.rawText.value = lines.join("\n");
  syncFullscreenPreview();
}

function handleFileSelection(file) {
  state.selectedFile = file || null;
  refs.processButton.disabled = !file;

  if (!file) {
    clearPreview();
    resetOutput();
    setStatus("Nog geen bestand gekozen.");
    return;
  }

  renderPreview(file);
  updateMetaFromFile(file);
  updateRawTextPlaceholder(file);
  renderOutput();
  renderValidation(getBaseValidationMessages());
  setSourceBadge(getSourceType(file).toUpperCase() || "Onbekend");
  setConfidenceBadge("Handmatige review");
  setStatus(`Bestand geselecteerd: ${file.name}. Klaar voor verwerking.`, "success");
}

function normalizeExtractedText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractLinesFromPdfItems(items) {
  const lines = [];
  let current = [];
  let lastY = null;

  for (const item of items) {
    const str = String(item.str || "").trim();
    if (!str) {
      continue;
    }

    const y = Array.isArray(item.transform) ? Number(item.transform[5]) : null;
    const lineBreak = item.hasEOL || (lastY !== null && y !== null && Math.abs(lastY - y) > 3);

    if (lineBreak && current.length) {
      lines.push(current.join(" ").trim());
      current = [];
    }

    current.push(str);
    lastY = y;
  }

  if (current.length) {
    lines.push(current.join(" ").trim());
  }

  return lines.join("\n");
}

function seemsUsefulText(text) {
  const cleaned = normalizeExtractedText(text);
  if (cleaned.length < 80) {
    return false;
  }
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  return wordCount >= 15;
}

function createPdfLoadingTask(arrayBuffer) {
  const pdfLib = getPdfLib();
  if (!pdfLib || typeof pdfLib.getDocument !== "function") {
    throw new Error("PDF.js is niet geladen.");
  }
  const pdfData = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  return pdfLib.getDocument({
    data: pdfData,
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false
  });
}

async function extractPdfTextDirect(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = createPdfLoadingTask(arrayBuffer);
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const textContent = await page.getTextContent();
    pages.push(extractLinesFromPdfItems(textContent.items || []));
  }

  return {
    text: normalizeExtractedText(pages.join("\n\n")),
    pageCount: pdf.numPages
  };
}

async function runTesseract(input, onProgress) {
  const result = await window.Tesseract.recognize(input, "nld+eng", {
    logger: (message) => {
      if (message.status === "recognizing text" && typeof onProgress === "function") {
        onProgress(message.progress || 0);
      }
    }
  });
  return normalizeExtractedText(result?.data?.text || "");
}

async function extractPdfTextWithOcr(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = createPdfLoadingTask(arrayBuffer);
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    setStatus(`OCR bezig op PDF pagina ${pageIndex} van ${pdf.numPages}...`, "processing");
    const page = await pdf.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;
    const pageText = await runTesseract(canvas, (progress) => {
      const percentage = Math.round(progress * 100);
      setStatus(`OCR bezig op PDF pagina ${pageIndex} van ${pdf.numPages} (${percentage}%)...`, "processing");
    });
    pages.push(pageText);
    await sleep(20);
  }

  return {
    text: normalizeExtractedText(pages.join("\n\n")),
    pageCount: pdf.numPages
  };
}

async function extractImageTextWithOcr(file) {
  setStatus("OCR bezig op afbeelding...", "processing");
  const text = await runTesseract(file, (progress) => {
    const percentage = Math.round(progress * 100);
    setStatus(`OCR bezig op afbeelding (${percentage}%)...`, "processing");
  });

  return {
    text,
    pageCount: 1
  };
}

async function extractDocumentText(file) {
  if (!getPdfLib()) {
    throw new Error("PDF.js is niet geladen.");
  }
  if (!window.Tesseract) {
    throw new Error("Tesseract is niet geladen.");
  }

  const sourceType = getSourceType(file);

  if (sourceType === "pdf") {
    const direct = await extractPdfTextDirect(file);
    if (seemsUsefulText(direct.text)) {
      return {
        ...direct,
        extractionMethod: "pdf_text",
        ocrUsed: false
      };
    }

    const ocr = await extractPdfTextWithOcr(file);
    return {
      ...ocr,
      extractionMethod: "pdf_ocr",
      ocrUsed: true
    };
  }

  if (sourceType === "image") {
    const ocr = await extractImageTextWithOcr(file);
    return {
      ...ocr,
      extractionMethod: "image_ocr",
      ocrUsed: true
    };
  }

  throw new Error("Bestandstype wordt nog niet ondersteund.");
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function splitNonEmptyLines(text) {
  return normalizeExtractedText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isSectionHeader(line) {
  const normalized = normalizeKey(line);
  return [
    "verzender",
    "patient",
    "verwijzingsgegevens",
    "kerndeel klinische informatie"
  ].includes(normalized);
}

function getSectionId(line) {
  const normalized = normalizeKey(line);
  if (normalized === "verzender") {
    return "sender";
  }
  if (normalized === "patient") {
    return "patient";
  }
  if (normalized === "verwijzingsgegevens") {
    return "referral";
  }
  if (normalized === "kerndeel klinische informatie") {
    return "clinical";
  }
  return null;
}

function splitIntoSections(text) {
  const lines = splitNonEmptyLines(text);
  const sections = {
    sender: [],
    patient: [],
    referral: [],
    clinical: []
  };

  let currentSection = null;

  for (const line of lines) {
    const sectionId = getSectionId(line);
    if (sectionId) {
      currentSection = sectionId;
      continue;
    }

    if (isSectionHeader(line)) {
      continue;
    }

    if (currentSection) {
      sections[currentSection].push(line);
    }
  }

  return sections;
}

function lineLooksLikeLabel(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) {
    return false;
  }
  if (/^[A-Za-z][A-Za-z0-9()\-\/.\s]+:\s*$/.test(trimmed)) {
    return true;
  }
  if (/^[A-Za-z][A-Za-z0-9()\-\/.\s]+:\s*.+$/.test(trimmed)) {
    return true;
  }
  return false;
}

function collectValueLines(lines, startIndex) {
  const values = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }
    if (isSectionHeader(line) || lineLooksLikeLabel(line)) {
      break;
    }
    values.push(line.trim());
  }
  return values;
}

function parseSectionFields(lines) {
  const fields = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    // PDF text extraction can split "Organisatie AGB-code:" into 2 lines.
    if (
      normalizeKey(line) === "organisatie" &&
      index + 1 < lines.length &&
      normalizeKey(lines[index + 1]) === "agb code"
    ) {
      const values = collectValueLines(lines, index + 2);
      fields["organisatie agb code"] = values.join(" ").trim();
      index += values.length + 1;
      continue;
    }

    const inlineMatch = line.match(/^([^:]+):\s*(.*)$/);
    if (!inlineMatch) {
      continue;
    }

    const label = normalizeKey(inlineMatch[1]);
    const inlineValue = inlineMatch[2].trim();

    if (inlineValue) {
      fields[label] = inlineValue;
      continue;
    }

    const values = collectValueLines(lines, index + 1);
    fields[label] = values.join(" ").trim();
    index += values.length;
  }

  return fields;
}

function splitStreetAndHouseNumber(value) {
  const input = String(value || "").trim();
  if (!input) {
    return { street: "", house_number: "" };
  }

  const match = input.match(/^(.*?)(?:\s+)(\d+[A-Za-z0-9\-\/]*)$/);
  if (!match) {
    return { street: input, house_number: "" };
  }

  return {
    street: match[1].trim(),
    house_number: match[2].trim()
  };
}

function splitPostalCodeAndCity(value) {
  const input = String(value || "").trim();
  if (!input) {
    return { postal_code: "", city: "" };
  }

  const match = input.match(/(\d{4}\s?[A-Z]{2})\s+(.+)$/i);
  if (!match) {
    return { postal_code: "", city: input };
  }

  return {
    postal_code: match[1].toUpperCase().replace(/(\d{4})([A-Z]{2})/, "$1 $2"),
    city: match[2].trim()
  };
}

function cleanPhoneNumber(value) {
  const raw = String(value || "").trim();
  let digits = raw.replace(/\D+/g, "");

  if (!digits) {
    return "";
  }

  if (raw.startsWith("+31")) {
    digits = `0${digits.slice(2)}`;
  } else if (raw.startsWith("0031")) {
    digits = `0${digits.slice(4)}`;
  } else if (digits.startsWith("31") && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  } else if (digits.length === 9 && digits.startsWith("6")) {
    digits = `0${digits}`;
  }

  return /^06\d{8}$/.test(digits) ? digits : "";
}


function cleanBsn(value) {
  return String(value || "").replace(/\D+/g, "");
}

function isValidBsn(value) {
  return /^\d{9}$/.test(cleanBsn(value));
}

function cleanEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function splitPersonName(rawName) {
  const cleaned = String(rawName || "")
    .replace(/^(dhr\.?|de heer|mevr\.?|mevrouw)\s+/i, "")
    .trim();

  if (!cleaned) {
    return { initials: "", first_name: "", last_name: "" };
  }

  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { initials: parts[0].replace(/\./g, ""), first_name: parts[0], last_name: "" };
  }

  let surnameStart = parts.length - 1;
  while (surnameStart > 0 && /^[a-z]{1,4}$/.test(parts[surnameStart - 1])) {
    surnameStart -= 1;
  }

  const firstNames = parts.slice(0, surnameStart);
  const surnameParts = parts.slice(surnameStart);
  const initials = firstNames
    .map((part) => part.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .join("");

  return {
    initials,
    first_name: firstNames.join(" ").trim(),
    last_name: surnameParts.join(" ").trim()
  };
}

function inferGender(rawName) {
  const normalized = normalizeKey(rawName);
  if (normalized.startsWith("dhr") || normalized.startsWith("de heer")) {
    return "man";
  }
  if (normalized.startsWith("mevr") || normalized.startsWith("mevrouw")) {
    return "vrouw";
  }
  return "";
}

function inferReferralType(careProductName, careQuestion, clinicalInformation) {
  const combined = normalizeKey(`${careProductName} ${careQuestion} ${clinicalInformation}`);
  if (combined.includes("gli") && combined.includes("cool")) {
    return "GLI / COOL";
  }
  if (combined.includes("gli")) {
    return "GLI";
  }
  if (combined.includes("leefstijl")) {
    return "Leefstijl";
  }
  return "";
}

function extractClinicalInformation(lines) {
  return normalizeExtractedText(lines.join("\n"));
}

function extractJsonObjectFromText(text) {
  const rawInput = String(text || "").trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  if (!rawInput) {
    return {};
  }

  for (let startIndex = 0; startIndex < rawInput.length; startIndex += 1) {
    if (rawInput[startIndex] !== "{") {
      continue;
    }
    try {
      return JSON.parse(rawInput.slice(startIndex));
    } catch {
      continue;
    }
  }
  return {};
}

function normalizeAiSection(sectionName, sectionPayload) {
  if (!sectionPayload || typeof sectionPayload !== "object") {
    return {};
  }

  const normalized = {};
  for (const [key, value] of Object.entries(sectionPayload)) {
    const textValue = value == null ? "" : String(value).trim();
    if (!textValue) {
      continue;
    }
    normalized[String(key)] = textValue;
  }

  if (sectionName === "person" && normalized.bsn) {
    normalized.bsn = cleanBsn(normalized.bsn);
  }
  if (sectionName === "contact") {
    if (normalized.phone) {
      normalized.phone = cleanPhoneNumber(normalized.phone);
    }
    if (normalized.email) {
      normalized.email = cleanEmail(normalized.email);
    }
    if (normalized.postal_code) {
      normalized.postal_code = splitPostalCodeAndCity(`${normalized.postal_code} x`).postal_code;
    }
  }

  return normalized;
}

function mergeAiIntoExtracted(extracted, aiPayload) {
  const merged = deepClone(extracted);
  let aiUsed = false;

  for (const sectionName of ["sender", "person", "contact", "referral", "insurance"]) {
    const aiSection = normalizeAiSection(sectionName, aiPayload?.[sectionName]);
    if (!Object.keys(aiSection).length) {
      continue;
    }
    if (!merged[sectionName]) {
      merged[sectionName] = {};
    }
    for (const [key, value] of Object.entries(aiSection)) {
      if (!value || String(merged[sectionName][key] || "").trim()) {
        continue;
      }
      merged[sectionName][key] = value;
      aiUsed = true;
    }
  }

  return { extracted: merged, aiUsed };
}

function shouldUseAi(extracted, ocrUsed) {
  if (!APIFREELLM_API_KEY) {
    return false;
  }

  const missingRequired = getMissingRequiredFields({ meta: {}, ...extracted });
  if (ocrUsed || missingRequired.length) {
    return true;
  }

  return [
    extracted.person?.last_name,
    extracted.person?.date_of_birth,
    extracted.person?.bsn,
    extracted.contact?.phone,
    extracted.insurance?.insurer,
    extracted.referral?.care_product_name
  ].some((value) => !String(value || "").trim());
}

function buildAiPrompt(text, extracted) {
  const example = {
    sender: {
      name: "",
      agb_code: "",
      organization: "",
      organization_agb_code: "",
      street: "",
      house_number: "",
      postal_code: "",
      city: ""
    },
    person: {
      initials: "",
      first_name: "",
      last_name: "",
      date_of_birth: "",
      gender: "",
      bsn: ""
    },
    contact: {
      street: "",
      house_number: "",
      postal_code: "",
      city: "",
      phone: "",
      email: ""
    },
    referral: {
      referral_date: "",
      zd_number: "",
      gp_name: "",
      practice_name: "",
      agb_code: "",
      care_product_name: "",
      care_question: "",
      reason: "",
      clinical_information: "",
      referral_type: ""
    },
    insurance: {
      insurer: "",
      policy_number: "",
      insured_number: ""
    }
  };

  return [
    "Haal gestructureerde verwijzingsdata uit de onderstaande Nederlandse medische verwijsbrief.",
    "Geef alleen geldige JSON terug, zonder uitleg of markdown.",
    "Gebruik exact deze top-level keys: sender, person, contact, referral, insurance.",
    "Vul onbekende velden met een lege string.",
    "Voor telefoonnummers: geef Nederlandse mobiele nummers terug als 06XXXXXXXX.",
    "Voor BSN: alleen cijfers. Voor postcode: formaat 1234 AB.",
    "",
    `Bestaande rule-based extractie:\n${JSON.stringify(extracted)}`,
    "",
    `Gewenste JSON-vorm:\n${JSON.stringify(example)}`,
    "",
    `Documenttekst:\n${text}`
  ].join("\n");
}

async function callAiExtractorDirect(text, extracted) {
  if (!APIFREELLM_API_KEY) {
    return {};
  }

  const response = await fetch(APIFREELLM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${APIFREELLM_API_KEY}`
    },
    body: JSON.stringify({
      message: buildAiPrompt(text, extracted),
      model: APIFREELLM_MODEL
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.message || `ApiFreeLLM fout (${response.status})`);
  }

  const content = typeof payload?.response === "string"
    ? payload.response
    : typeof payload?.message === "string"
      ? payload.message
      : Array.isArray(payload?.choices) && payload.choices[0]?.message?.content
        ? payload.choices[0].message.content
        : "";

  return extractJsonObjectFromText(content);
}

function extractStructuredFields(text) {
  const sections = splitIntoSections(text);
  const senderFields = parseSectionFields(sections.sender);
  const patientFields = parseSectionFields(sections.patient);
  const referralFields = parseSectionFields(sections.referral);
  const clinicalInformation = extractClinicalInformation(sections.clinical);

  const senderAddress = splitStreetAndHouseNumber(senderFields["adres"]);
  const senderCity = splitPostalCodeAndCity(senderFields["woonplaats"]);
  const patientAddress = splitStreetAndHouseNumber(patientFields["adres"]);
  const patientCity = splitPostalCodeAndCity(patientFields["woonplaats"]);
  const personName = splitPersonName(patientFields["naam"]);

  const careQuestion = referralFields["zorgvraag"] || "";
  const clinicalReason = [careQuestion, clinicalInformation].filter(Boolean).join("\n\n");

  return {
    sender: {
      name: senderFields["naam"] || "",
      agb_code: senderFields["agb code"] || "",
      organization: senderFields["organisatie"] || "",
      organization_agb_code: senderFields["organisatie agb code"] || "",
      street: senderAddress.street,
      house_number: senderAddress.house_number,
      postal_code: senderCity.postal_code,
      city: senderCity.city
    },
    person: {
      initials: personName.initials,
      first_name: personName.first_name,
      last_name: personName.last_name,
      date_of_birth: patientFields["geboortedatum"] || "",
      gender: inferGender(patientFields["naam"]),
      bsn: cleanBsn(patientFields["bsn"])
    },
    contact: {
      street: patientAddress.street,
      house_number: patientAddress.house_number,
      postal_code: patientCity.postal_code,
      city: patientCity.city,
      phone: cleanPhoneNumber(
        patientFields["telefoonnummer"]
        || patientFields["telefoon"]
        || patientFields["tel"]
        || ""
      ),
      email: cleanEmail(patientFields["e mailadres"] || patientFields["e-mailadres"] || "")
    },
    referral: {
      referral_date: referralFields["verwijzingsdatum"] || "",
      zd_number: referralFields["zd nummer zorgdomein"] || "",
      gp_name: senderFields["naam"] || "",
      practice_name: senderFields["organisatie"] || "",
      agb_code: senderFields["agb code"] || "",
      care_product_name: referralFields["naam zorgproduct"] || "",
      care_question: careQuestion,
      reason: clinicalReason,
      clinical_information: clinicalInformation,
      referral_type: inferReferralType(referralFields["naam zorgproduct"], careQuestion, clinicalInformation)
    },
    insurance: {
      insurer: patientFields["zorgverzekeraar"] || "",
      policy_number: patientFields["verzekeringsnummer"] || "",
      insured_number: patientFields["verzekeringsnummer"] || ""
    }
  };
}

function mergeExtractedFields(extracted) {
  for (const [sectionName, sectionValues] of Object.entries(extracted)) {
    if (!state.output.fields[sectionName]) {
      state.output.fields[sectionName] = {};
    }
    for (const [key, value] of Object.entries(sectionValues)) {
      state.output.fields[sectionName][key] = value || "";
    }
  }
}

function getFieldInput(path) {
  return refs.reviewForm.querySelector(`[data-path="${path}"]`);
}

function getMissingRequiredFields(fieldsSource = state.output?.fields || {}) {
  const missing = [];
  for (const path of REQUIRED_FIELD_PATHS) {
    const value = getNestedValue(fieldsSource, path);
    if (!String(value || "").trim()) {
      missing.push(path);
    }
  }
  return missing;
}

function formatFieldLabel(path) {
  const input = getFieldInput(path);
  const label = input ? input.closest("label") : null;
  const span = label ? label.querySelector("span") : null;
  return span ? span.textContent.trim() : path;
}

function updateFieldHighlighting(missingPaths) {
  const allFields = refs.reviewForm.querySelectorAll("label");
  for (const label of allFields) {
    label.classList.remove("field-missing");
  }

  for (const path of missingPaths) {
    const input = getFieldInput(path);
    const label = input ? input.closest("label") : null;
    if (label) {
      label.classList.add("field-missing");
    }
  }
}

function determineNextAction(missingCount) {
  if (!state.selectedFile) {
    return "";
  }
  if (missingCount === 0) {
    return "Klaar voor overdracht / vervolgverwerking";
  }
  if (missingCount <= 3) {
    return "Laatste review en aanvullen ontbrekende velden";
  }
  return "Handmatige controle en aanvulling nodig";
}

function updateReviewSummary() {
  if (!refs.requiredFieldsCount) {
    return;
  }

  const missing = getMissingRequiredFields();
  const filledCount = REQUIRED_FIELD_PATHS.length - missing.length;
  const reviewCompleted = !state.output.fields.meta.review_required;
  const nextAction = determineNextAction(missing.length);

  state.output.fields.meta.next_action = nextAction;
  state.output.fields.meta.review_status = reviewCompleted ? "completed" : "open";

  refs.requiredFieldsCount.textContent = `${filledCount} / ${REQUIRED_FIELD_PATHS.length}`;
  refs.missingFieldsCount.textContent = String(missing.length);
  refs.reviewStatusBadge.textContent = reviewCompleted ? "Gecontroleerd" : "Open";
  refs.reviewStatusBadge.classList.remove("neutral", "success", "warn");
  refs.reviewStatusBadge.classList.add(reviewCompleted ? "success" : (missing.length ? "warn" : "neutral"));

  updateFieldHighlighting(missing);

  if (!state.selectedFile) {
    refs.missingFieldsList.innerHTML = '<li class="validation-empty">Nog geen reviewstatus beschikbaar.</li>';
  } else if (missing.length === 0) {
    refs.missingFieldsList.innerHTML = `<li class="validation-ok">Alle verplichte velden zijn ingevuld. Volgende stap: ${nextAction}</li>`;
  } else {
    refs.missingFieldsList.innerHTML = missing
      .map((path) => `<li>${formatFieldLabel(path)}</li>`)
      .join("");
  }
}

function getFilledFieldCount(extracted) {
  let count = 0;
  for (const section of Object.values(extracted)) {
    for (const value of Object.values(section)) {
      if (String(value || "").trim()) {
        count += 1;
      }
    }
  }
  return count;
}

function isValidPostalCode(value) {
  return /^\d{4}\s?[A-Z]{2}$/i.test(String(value || "").trim());
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isLikelyPhoneNumber(value) {
  const digits = cleanPhoneNumber(value);
  return /^06\d{8}$/.test(digits);
}


function determineConfidence(extracted, ocrUsed) {
  const filledCount = getFilledFieldCount(extracted);
  const coreValues = [
    extracted.person.last_name,
    extracted.person.date_of_birth,
    extracted.person.bsn,
    extracted.contact.postal_code,
    extracted.insurance.insurer,
    extracted.referral.referral_date,
    extracted.referral.gp_name
  ];
  const coreFilled = coreValues.filter((value) => String(value || "").trim()).length;

  if (!ocrUsed && coreFilled >= 6 && filledCount >= 18) {
    return "high";
  }
  if (coreFilled >= 4 && filledCount >= 12) {
    return "medium";
  }
  return "low";
}

function buildExtractionValidationMessages(result, extracted) {
  const messages = getBaseValidationMessages();
  const filledCount = getFilledFieldCount(extracted);
  const issues = [];

  if (!extracted.person.first_name && !extracted.person.last_name) {
    issues.push("Patientnaam niet betrouwbaar herkend.");
  }

  if (!extracted.person.bsn) {
    issues.push("BSN niet gevonden.");
  } else if (!isValidBsn(extracted.person.bsn)) {
    issues.push("BSN controleren: moet 9 cijfers zijn.");
  }

  if (!extracted.contact.postal_code) {
    issues.push("Postcode patient ontbreekt.");
  } else if (!isValidPostalCode(extracted.contact.postal_code)) {
    issues.push(`Postcode patient controleren (${extracted.contact.postal_code}).`);
  }

  if (!extracted.insurance.insurer) {
    issues.push("Zorgverzekeraar niet gevonden.");
  }

  if (!extracted.contact.phone) {
    issues.push("Telefoonnummer ontbreekt.");
  } else if (!isLikelyPhoneNumber(extracted.contact.phone)) {
    issues.push(`Telefoonnummer controleren (${extracted.contact.phone}).`);
  }

  if (extracted.contact.email && !isValidEmail(extracted.contact.email)) {
    issues.push(`E-mailadres controleren (${extracted.contact.email}).`);
  }

  if (!extracted.referral.care_product_name) {
    issues.push("Naam zorgproduct ontbreekt.");
  }

  if (!extracted.referral.clinical_information) {
    issues.push("Klinische informatie niet gevonden.");
  }

  if (result.ocrUsed) {
    issues.push("OCR gebruikt, extra controle op leesfouten nodig.");
  }

  if (issues.length === 0) {
    messages.push({
      className: "validation-ok",
      text: `Alles lijkt goed. ${filledCount} velden automatisch gevuld.`
    });
    return messages;
  }

  messages.push({
    className: "validation-warn",
    text: `${filledCount} velden automatisch gevuld. Alles lijkt goed behalve ${issues.length} aandachtspunt(en) hieronder.`
  });

  for (const issue of issues) {
    messages.push({
      className: "validation-warn",
      text: issue
    });
  }

  return messages;
}

function createLocalExtractionPayload(result, extracted, options = {}) {
  const aiUsed = Boolean(options.aiUsed);
  const aiError = options.aiError ? String(options.aiError) : "";
  const schema = state.schema || FALLBACK_SCHEMA;
  const output = getEmptyOutput(schema);

  for (const [sectionName, sectionValues] of Object.entries(extracted)) {
    if (!output.fields[sectionName]) {
      output.fields[sectionName] = {};
    }
    for (const [key, value] of Object.entries(sectionValues)) {
      output.fields[sectionName][key] = value || "";
    }
  }

  const confidence = determineConfidence(extracted, result.ocrUsed);
  const missing = getMissingRequiredFields(output.fields);
  output.fields.meta = {
    ...(output.fields.meta || {}),
    source_file: state.selectedFile ? state.selectedFile.name : "",
    source_type: getSourceType(state.selectedFile),
    ocr_used: result.ocrUsed,
    extraction_method: result.extractionMethod,
    page_count: result.pageCount,
    confidence,
    ai_used: aiUsed,
    ai_provider: aiUsed ? "apifreellm" : "",
    review_required: true,
    review_completed_at: "",
    review_status: "open",
    next_action: determineNextAction(missing.length)
  };

  const validation = [
    {
      className: "validation-warn",
      text: "Backend niet bereikbaar. Lokale browserverwerking gebruikt."
    },
    ...buildExtractionValidationMessages(result, extracted)
  ];

  if (aiUsed) {
    validation.unshift({
      className: "validation-ok",
      text: "ApiFreeLLM gebruikt als AI-aanvulling op de lokale extractie."
    });
  }

  if (aiError) {
    validation.unshift({
      className: "validation-warn",
      text: `AI-aanvulling overgeslagen: ${aiError}`
    });
  }

  return {
    raw_text: result.text,
    output,
    validation,
    source_badge: `${result.extractionMethod === "pdf_text" ? "PDF tekst (lokaal)" : "OCR (lokaal)"}${aiUsed ? " + AI" : ""}`,
    confidence_badge: {
      high: "Hoge match",
      medium: "Middelmatige match",
      low: "Lage match"
    }[confidence] || "Review nodig"
  };
}

async function processDocumentLocally(file) {
  setStatus("Document lokaal uitlezen...", "processing");
  await ensureFrontendProcessingLibraries();
  const result = await extractDocumentText(file);
  try {
    setStatus("Ruwe tekst naar serververwerking sturen...", "processing");
    return await processExtractedTextViaApi({
      raw_text: result.text,
      filename: file?.name || "verwijzing",
      source_type: getSourceType(file),
      extraction_method: result.extractionMethod,
      page_count: result.pageCount,
      ocr_used: result.ocrUsed
    });
  } catch (apiError) {
    let extracted = extractStructuredFields(result.text);
    let aiUsed = false;
    let aiError = "";

    if (shouldUseAi(extracted, result.ocrUsed)) {
      try {
        setStatus("ApiFreeLLM AI-aanvulling uitvoeren...", "processing");
        const aiPayload = await callAiExtractorDirect(result.text, extracted);
        const merged = mergeAiIntoExtracted(extracted, aiPayload);
        extracted = merged.extracted;
        aiUsed = merged.aiUsed;
      } catch (directAiError) {
        aiError = directAiError.message || "onbekende fout";
      }
    }

    const localPayload = createLocalExtractionPayload(result, extracted, { aiUsed, aiError });
    localPayload.validation.unshift({
      className: "validation-warn",
      text: `Serverstructurering niet beschikbaar. Lokale fallback gebruikt (${apiError.message || "onbekende fout"}).`
    });
    return localPayload;
  }
}

function shouldTryLocalFallback(error) {
  if (isBackendUnavailableError(error)) {
    return true;
  }

  const message = String(error && error.message ? error.message : error || "").toLowerCase();
  return Boolean(
    message.includes("backend fout")
    || message.includes("not found")
    || message.includes("(404)")
    || message.includes("verwerking mislukt")
    || message.includes("ocr")
    || message.includes("pymupdf")
    || message.includes("tesseract")
  );
}

function applyExtractionResult(payload) {
  refs.rawText.value = payload.raw_text || "";
  state.output = deepClone(payload.output || getEmptyOutput(state.schema || FALLBACK_SCHEMA));
  if (!state.output.fields) {
    state.output.fields = deepClone((state.schema || FALLBACK_SCHEMA).fields || {});
  }
  syncFullscreenPreview();
  setSourceBadge(payload.source_badge || "Geen bron");
  setConfidenceBadge(payload.confidence_badge || "Review nodig");
  renderForm();
  syncReviewFormValues(state.output.fields);
  renderValidation(Array.isArray(payload.validation) ? payload.validation : []);
  renderOutput();
}


function bindReviewForm() {
  const fields = refs.reviewForm.querySelectorAll("[data-path]");
  for (const field of fields) {
    field.addEventListener("input", () => {
      const nextValue = field.dataset.path === "contact.phone"
        ? cleanPhoneNumber(field.value)
        : field.value.trim();
      if (field.dataset.path === "contact.phone" && field.value !== nextValue) {
        field.value = nextValue;
      }
      setNestedValue(state.output.fields, field.dataset.path, nextValue);
      state.output.fields.meta.review_required = true;
      state.output.fields.meta.review_completed_at = "";
      state.output.fields.meta.review_status = "open";
      renderOutput();
      updateReviewSummary();
    });
  }
}


async function loadSchema() {
  try {
    const response = await fetch(`${REFERRAL_API_BASE}/api/schema`);
    if (!response.ok) {
      throw new Error(`Schema laden mislukt (${response.status})`);
    }
    return await response.json();
  } catch (error) {
    console.warn("Fallback schema gebruikt:", error);
    return deepClone(FALLBACK_SCHEMA);
  }
}

async function processDocumentViaApi(file) {
  const formData = new FormData();
  formData.append("file", file);

  let response;
  try {
    response = await fetch(`${REFERRAL_API_BASE}/api/process-referral`, {
      method: "POST",
      body: formData
    });
  } catch (error) {
    const networkError = new Error(`Backend niet bereikbaar op ${REFERRAL_API_BASE}.`);
    networkError.code = "BACKEND_UNREACHABLE";
    throw networkError;
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { detail: await response.text() };

  if (!response.ok) {
    throw new Error(payload.detail || `Backend fout (${response.status})`);
  }

  return payload;
}

async function processExtractedTextViaApi(payload) {
  let response;
  try {
    response = await fetch(`${REFERRAL_API_BASE}/api/process-referral-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    const networkError = new Error(`Backend niet bereikbaar op ${REFERRAL_API_BASE}.`);
    networkError.code = "BACKEND_UNREACHABLE";
    throw networkError;
  }

  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json")
    ? await response.json()
    : { detail: await response.text() };

  if (!response.ok) {
    throw new Error(result.detail || `Backend fout (${response.status})`);
  }

  return result;
}

function isBackendUnavailableError(error) {
  return Boolean(error && error.code === "BACKEND_UNREACHABLE");
}


function collectRefs() {
  refs.fileInput = document.getElementById("fileInput");
  refs.processButton = document.getElementById("processButton");
  refs.resetButton = document.getElementById("resetButton");
  refs.copyJsonButton = document.getElementById("copyJsonButton");
  refs.downloadJsonButton = document.getElementById("downloadJsonButton");
  refs.statusBanner = document.getElementById("statusBanner");
  refs.sourceTypeBadge = document.getElementById("sourceTypeBadge");
  refs.confidenceBadge = document.getElementById("confidenceBadge");
  refs.siteLogo = document.getElementById("siteLogo");
  refs.themeToggle = document.getElementById("themeToggle");
  refs.themeToggleIcon = document.getElementById("themeToggleIcon");
  refs.imagePreview = document.getElementById("imagePreview");
  refs.pdfPreview = document.getElementById("pdfPreview");
  refs.emptyPreview = document.getElementById("emptyPreview");
  refs.openPreviewFullscreenButton = document.getElementById("openPreviewFullscreenButton");
  refs.previewFullscreenModal = document.getElementById("previewFullscreenModal");
  refs.closePreviewFullscreenButton = document.getElementById("closePreviewFullscreenButton");
  refs.fullscreenImagePreview = document.getElementById("fullscreenImagePreview");
  refs.fullscreenPdfPreview = document.getElementById("fullscreenPdfPreview");
  refs.fullscreenEmptyPreview = document.getElementById("fullscreenEmptyPreview");
  refs.fullscreenRawText = document.getElementById("fullscreenRawText");
  refs.rawText = document.getElementById("rawText");
  refs.reviewForm = document.getElementById("reviewForm");
  refs.validationList = document.getElementById("validationList");
  refs.jsonOutput = document.getElementById("jsonOutput");
  refs.reviewStatusBadge = document.getElementById("reviewStatusBadge");
  refs.requiredFieldsCount = document.getElementById("requiredFieldsCount");
  refs.missingFieldsCount = document.getElementById("missingFieldsCount");
  refs.missingFieldsList = document.getElementById("missingFieldsList");
  refs.markReviewedButton = document.getElementById("markReviewedButton");
}

function bindPreviewFullscreen() {
  if (refs.openPreviewFullscreenButton && !refs.openPreviewFullscreenButton.dataset.bound) {
    refs.openPreviewFullscreenButton.dataset.bound = "1";
    refs.openPreviewFullscreenButton.addEventListener("click", openPreviewFullscreen);
  }

  if (refs.closePreviewFullscreenButton && !refs.closePreviewFullscreenButton.dataset.bound) {
    refs.closePreviewFullscreenButton.dataset.bound = "1";
    refs.closePreviewFullscreenButton.addEventListener("click", closePreviewFullscreen);
  }

  if (refs.previewFullscreenModal && !refs.previewFullscreenModal.dataset.bound) {
    refs.previewFullscreenModal.dataset.bound = "1";
    refs.previewFullscreenModal.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.hasAttribute("data-close-preview-modal")) {
        closePreviewFullscreen();
      }
    });
  }

  if (!document.body.dataset.previewModalBound) {
    document.body.dataset.previewModalBound = "1";
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && refs.previewFullscreenModal && !refs.previewFullscreenModal.hidden) {
        closePreviewFullscreen();
      }
    });
  }
}

function ensureAuthorizedSession() {
  if (sessionStorage.getItem(AUTH_SESSION_KEY) === "1") {
    return true;
  }
  window.location.href = "../index.html";
  return false;
}

async function handleProcess() {
  if (!state.selectedFile) {
    setStatus("Kies eerst een PDF of afbeelding.", "error");
    return;
  }

  try {
    setProcessingState(true);
    setStatus("Documentverwerking gestart...", "processing");
    const result = await processDocumentViaApi(state.selectedFile);
    applyExtractionResult(result);
    setStatus("Document verwerkt. Ruwe tekst staat klaar voor review.", "success");
  } catch (error) {
    if (shouldTryLocalFallback(error)) {
      try {
        const localResult = await processDocumentLocally(state.selectedFile);
        applyExtractionResult(localResult);
        setStatus("Document lokaal verwerkt in de browser. Serververwerking was niet beschikbaar.", "success");
        return;
      } catch (fallbackError) {
        console.error("Lokale fallback mislukt:", fallbackError);
        refs.rawText.value = `Verwerking mislukt.\n\nTechnische melding:\n${fallbackError && fallbackError.message ? fallbackError.message : String(fallbackError)}`;
        syncFullscreenPreview();
        renderValidation([
          ...getBaseValidationMessages(),
          {
            className: "validation-error",
            text: `Lokale extractie mislukt: ${fallbackError.message || "onbekende fout"}`
          }
        ]);
        setStatus("Verwerking mislukt. Serververwerking en lokale fallback konden niet afronden.", "error");
        return;
      }
    }

    console.error(error);
    refs.rawText.value = `Verwerking mislukt.\n\nTechnische melding:\n${error && error.message ? error.message : String(error)}`;
    syncFullscreenPreview();
    renderValidation([
      ...getBaseValidationMessages(),
      {
        className: "validation-error",
        text: `Extractie mislukt: ${error.message || "onbekende fout"}`
      }
    ]);
    setStatus("Verwerking mislukt. Backend controleren en opnieuw proberen.", "error");
  } finally {
    setProcessingState(false);
  }
}


function handleReset() {
  refs.fileInput.value = "";
  state.selectedFile = null;
  setProcessingState(false);
  refs.processButton.disabled = true;
  clearPreview();
  resetOutput();
  setStatus("Nog geen bestand gekozen.");
}

async function handleCopyJson() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(state.output, null, 2));
    setStatus("JSON gekopieerd naar klembord.", "success");
  } catch (error) {
    console.error(error);
    setStatus("JSON kopieren is mislukt.", "error");
  }
}

function handleDownloadJson() {
  const filenameBase = (state.selectedFile?.name || "verwijzing")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "verwijzing";

  const blob = new Blob([JSON.stringify(state.output, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filenameBase}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus("JSON download gestart.", "success");
}

function handleMarkReviewed() {
  if (!state.selectedFile) {
    setStatus("Laad eerst een document voordat je review afrondt.", "error");
    return;
  }

  const missing = getMissingRequiredFields();
  if (missing.length > 0) {
    setStatus("Review kan nog niet worden afgerond. Vul eerst de verplichte velden aan.", "error");
    updateReviewSummary();
    return;
  }

  state.output.fields.meta.review_required = false;
  state.output.fields.meta.review_completed_at = new Date().toISOString();
  state.output.fields.meta.review_status = "completed";
  updateReviewSummary();
  renderOutput();
  setConfidenceBadge("Review afgerond");
  setStatus("Review afgerond. JSON is klaar voor export of vervolgverwerking.", "success");
}

async function init() {
  if (state.initialized) {
    return;
  }
  if (!ensureAuthorizedSession()) {
    return;
  }

  collectRefs();
  initThemeToggle();
  state.schema = await loadSchema();
  resetOutput();
  bindReviewForm();
  bindPreviewFullscreen();
  setPreviewFullscreenButtonState();

  refs.fileInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    handleFileSelection(file);
  });

  refs.rawText.addEventListener("input", syncFullscreenPreview);
  refs.processButton.addEventListener("click", handleProcess);
  refs.resetButton.addEventListener("click", handleReset);
  refs.copyJsonButton.addEventListener("click", handleCopyJson);
  refs.downloadJsonButton.addEventListener("click", handleDownloadJson);
  refs.markReviewedButton.addEventListener("click", handleMarkReviewed);

  refs.processButton.disabled = true;
  setStatus("Nog geen bestand gekozen.");
  state.initialized = true;
}

document.addEventListener("DOMContentLoaded", init);




