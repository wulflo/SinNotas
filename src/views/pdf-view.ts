import { invoke } from "@tauri-apps/api/core";
import { translate } from "../i18n";
import type {
  PdfDocumentInfo,
  PdfListItem,
  PdfTextPage,
  PdfTextRun,
} from "../types";

type PdfBinary = ArrayBuffer | Uint8Array | number[];

const MIN_RENDER_WIDTH = 320;
const MAX_RENDER_WIDTH = 2400;
const RETENTION_STORAGE_KEY = "sinnotas-pdf-retention";
const DAY_MS = 24 * 60 * 60 * 1000;
const CAPTURE_MIN_SIZE = 10;

export interface PdfReaderHost {
  /** Inserta el texto seleccionado en la nota activa. */
  insertText(text: string, source: string): Promise<void>;
  /** Guarda una captura y la inserta como imagen; puede abrir el editor de oclusiones. */
  insertCapture(bytes: Uint8Array, fileName: string, openOcclusion: boolean): Promise<void>;
  /** Pide confirmación antes de borrar un documento de la biblioteca. */
  confirmDelete(item: PdfListItem): Promise<boolean>;
}

interface PendingCapture {
  bytes: Uint8Array;
  fileName: string;
}

interface DragPoint {
  x: number;
  y: number;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const decimals = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unit]}`;
}

function formatDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  return new Date(timestamp).toLocaleDateString();
}

function toBlob(binary: PdfBinary): Blob {
  if (binary instanceof Uint8Array) {
    const copy = new Uint8Array(binary.byteLength);
    copy.set(binary);
    return new Blob([copy.buffer], { type: "image/png" });
  }
  if (binary instanceof ArrayBuffer) {
    return new Blob([binary], { type: "image/png" });
  }
  if (Array.isArray(binary)) {
    return new Blob([new Uint8Array(binary)], { type: "image/png" });
  }
  throw new Error("El motor PDF devolvió una imagen con un formato inesperado.");
}

function captureFileName(title: string, page: number): string {
  const safe = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "Documento";
  return `${safe}-p${page + 1}-${Date.now()}.png`;
}

/**
 * Lector de documentos: biblioteca del vault, enlaces externos, render PNG,
 * capa de texto seleccionable y captura de regiones para oclusiones.
 */
export class PdfReaderView {
  private readonly host: PdfReaderHost;
  private readonly listEl: HTMLElement;
  private readonly libraryEmptyEl: HTMLElement;
  private readonly importButton: HTMLButtonElement;
  private readonly retentionSelect: HTMLSelectElement;
  private readonly currentRetentionSelect: HTMLSelectElement;
  private readonly prevButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly fitButton: HTMLButtonElement;
  private readonly textButton: HTMLButtonElement;
  private readonly captureButton: HTMLButtonElement;
  private readonly titleEl: HTMLElement;
  private readonly metaEl: HTMLElement;
  private readonly indicatorEl: HTMLElement;
  private readonly stageEl: HTMLElement;
  private readonly stageEmptyEl: HTMLElement;
  private readonly pageEl: HTMLElement;
  private readonly imageEl: HTMLImageElement;
  private readonly textLayerEl: HTMLElement;
  private readonly captureLayerEl: HTMLElement;
  private readonly captureSelectionEl: HTMLElement;
  private readonly selectionActionsEl: HTMLElement;
  private readonly captureActionsEl: HTMLElement;
  private readonly captureLabelEl: HTMLElement;
  private readonly insertSelectionButton: HTMLButtonElement;
  private readonly copySelectionButton: HTMLButtonElement;
  private readonly clearSelectionButton: HTMLButtonElement;
  private readonly insertCaptureButton: HTMLButtonElement;
  private readonly insertOcclusionButton: HTMLButtonElement;
  private readonly cancelCaptureButton: HTMLButtonElement;
  private readonly statusEl: HTMLElement;

  private items: PdfListItem[] = [];
  private current: PdfDocumentInfo | null = null;
  private currentPage = 0;
  private objectUrl: string | null = null;
  private renderSequence = 0;
  private lastRenderPage = -1;
  private lastRenderWidth = 0;
  private resizeTimer: number | null = null;
  private initialized = false;
  private loading = false;

  private textEnabled = false;
  private textCache = new Map<string, PdfTextPage>();
  private captureMode = false;
  private captureStart: DragPoint | null = null;
  private pendingCapture: PendingCapture | null = null;
  private selectedText = "";

  constructor(root: HTMLElement, host: PdfReaderHost) {
    this.host = host;
    const query = <T extends Element>(selector: string): T => {
      const element = root.querySelector<T>(selector);
      if (!element) throw new Error(`Falta el elemento ${selector} en la vista PDF.`);
      return element;
    };

    this.listEl = query("#pdf-list");
    this.libraryEmptyEl = query("#pdf-library-empty");
    this.importButton = query<HTMLButtonElement>("#pdf-import");
    this.retentionSelect = query<HTMLSelectElement>("#pdf-retention");
    this.currentRetentionSelect = query<HTMLSelectElement>("#pdf-current-retention");
    this.prevButton = query<HTMLButtonElement>("#pdf-prev");
    this.nextButton = query<HTMLButtonElement>("#pdf-next");
    this.fitButton = query<HTMLButtonElement>("#pdf-fit");
    this.textButton = query<HTMLButtonElement>("#pdf-toggle-text");
    this.captureButton = query<HTMLButtonElement>("#pdf-capture");
    this.titleEl = query("#pdf-current-title");
    this.metaEl = query("#pdf-current-meta");
    this.indicatorEl = query("#pdf-page-indicator");
    this.stageEl = query("#pdf-stage");
    this.stageEmptyEl = query("#pdf-stage-empty");
    this.pageEl = query("#pdf-page");
    this.imageEl = query<HTMLImageElement>("#pdf-page-image");
    this.textLayerEl = query("#pdf-text-layer");
    this.captureLayerEl = query("#pdf-capture-layer");
    this.captureSelectionEl = query("#pdf-capture-selection");
    this.selectionActionsEl = query("#pdf-selection-actions");
    this.captureActionsEl = query("#pdf-capture-actions");
    this.captureLabelEl = query("#pdf-capture-label");
    this.insertSelectionButton = query<HTMLButtonElement>("#pdf-insert-selection");
    this.copySelectionButton = query<HTMLButtonElement>("#pdf-copy-selection");
    this.clearSelectionButton = query<HTMLButtonElement>("#pdf-clear-selection");
    this.insertCaptureButton = query<HTMLButtonElement>("#pdf-insert-capture");
    this.insertOcclusionButton = query<HTMLButtonElement>("#pdf-insert-occlusion");
    this.cancelCaptureButton = query<HTMLButtonElement>("#pdf-cancel-capture");
    this.statusEl = query("#pdf-status");

    this.restoreRetentionPreference();

    this.importButton.addEventListener("click", () => void this.importPdf());
    this.prevButton.addEventListener("click", () => this.goToPage(this.currentPage - 1));
    this.nextButton.addEventListener("click", () => this.goToPage(this.currentPage + 1));
    this.fitButton.addEventListener("click", () => void this.renderCurrentPage(true));
    this.textButton.addEventListener("click", () => void this.setTextMode(!this.textEnabled));
    this.captureButton.addEventListener("click", () => void this.toggleCaptureMode());
    this.retentionSelect.addEventListener("change", () => this.saveRetentionPreference());
    this.currentRetentionSelect.addEventListener("change", () => void this.applyCurrentRetention());
    this.insertSelectionButton.addEventListener("click", () => void this.insertSelectedText());
    this.copySelectionButton.addEventListener("click", () => void this.copySelectedText());
    this.clearSelectionButton.addEventListener("click", () => this.clearSelection());
    this.insertCaptureButton.addEventListener("click", () => void this.insertPendingCapture(false));
    this.insertOcclusionButton.addEventListener("click", () => void this.insertPendingCapture(true));
    this.cancelCaptureButton.addEventListener("click", () => this.exitCaptureMode());

    this.captureLayerEl.addEventListener("pointerdown", (event) => this.onCapturePointerDown(event));
    this.captureLayerEl.addEventListener("pointermove", (event) => this.onCapturePointerMove(event));
    this.captureLayerEl.addEventListener("pointerup", (event) => void this.onCapturePointerUp(event));
    this.captureLayerEl.addEventListener("pointercancel", () => this.resetCaptureDrag());
    document.addEventListener("selectionchange", () => this.handleSelectionChange());
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (this.captureMode || this.pendingCapture) this.exitCaptureMode();
      if (this.selectedText) this.clearSelection();
    });

    const observer = new ResizeObserver(() => this.scheduleResizeRender());
    observer.observe(this.stageEl);
  }

  /** Se llama cada vez que el usuario entra en la vista PDF. */
  async onActivate(): Promise<void> {
    if (!this.initialized) {
      this.initialized = true;
      await this.refreshLibrary(true);
      return;
    }
    if (!this.current && this.items.length > 0) {
      const firstAvailable = this.items.find((item) => !item.missing);
      if (firstAvailable) await this.open(firstAvailable.relativePath);
    }
  }

  private setStatus(message: string): void {
    this.statusEl.textContent = message;
  }

  private restoreRetentionPreference(): void {
    let stored = "";
    try {
      stored = window.localStorage.getItem(RETENTION_STORAGE_KEY) || "";
    } catch {
      stored = "";
    }
    const allowed = Array.from(this.retentionSelect.options).map((option) => option.value);
    this.retentionSelect.value = allowed.includes(stored) ? stored : "";
  }

  private saveRetentionPreference(): void {
    try {
      window.localStorage.setItem(RETENTION_STORAGE_KEY, this.retentionSelect.value);
    } catch {
      // Sin localStorage la preferencia solo dura la sesión actual.
    }
  }

  private updateButtons(): void {
    const pageCount = this.current?.pageCount ?? 0;
    const busy = this.loading;
    this.prevButton.disabled = busy || !this.current || this.currentPage <= 0;
    this.nextButton.disabled = busy || !this.current || this.currentPage >= pageCount - 1;
    this.fitButton.disabled = busy || !this.current;
    this.textButton.disabled = busy || !this.current;
    this.captureButton.disabled = busy || !this.current;
    this.textButton.classList.toggle("active", this.textEnabled);
    this.textButton.setAttribute("aria-pressed", String(this.textEnabled));
    this.captureButton.classList.toggle("active", this.captureMode);
    this.captureButton.setAttribute("aria-pressed", String(this.captureMode));
    this.currentRetentionSelect.disabled = busy || !this.current || !this.current.linked;
    this.importButton.disabled = busy;
    this.indicatorEl.textContent = this.current
      ? `${this.currentPage + 1} / ${pageCount}`
      : "— / —";
  }

  private updateHeader(): void {
    if (!this.current) {
      this.titleEl.textContent = "Ningún documento abierto";
      this.metaEl.textContent = "";
      this.pageEl.hidden = true;
      this.stageEmptyEl.hidden = false;
      this.currentRetentionSelect.value = "";
      this.updateButtons();
      return;
    }

    this.titleEl.textContent = this.current.title;
    const parts = [
      formatBytes(this.current.fileSize),
      `${this.current.pageCount} páginas`,
    ];
    if (this.current.linked) parts.push(translate("Enlazado"));
    if (this.current.expiresAt) {
      parts.push(`${translate("Caduca el")} ${formatDate(this.current.expiresAt)}`);
    }
    this.metaEl.textContent = parts.join(" · ");
    this.syncCurrentRetention();
    this.updateButtons();
  }

  private syncCurrentRetention(): void {
    const select = this.currentRetentionSelect;
    select.querySelector('option[data-dynamic="true"]')?.remove();
    const expiresAt = this.current?.expiresAt ?? null;
    if (!this.current?.linked || !expiresAt) {
      select.value = "";
      return;
    }

    const remainingDays = Math.max(1, Math.ceil((expiresAt - Date.now()) / DAY_MS));
    const known = ["1", "7", "30", "90"];
    if (known.includes(String(remainingDays))) {
      select.value = String(remainingDays);
      return;
    }

    const dynamic = document.createElement("option");
    dynamic.value = `expires-${remainingDays}`;
    dynamic.textContent = `Caduca en ${remainingDays} días`;
    dynamic.dataset.dynamic = "true";
    dynamic.disabled = true;
    select.add(dynamic, 0);
    select.value = dynamic.value;
  }

  private renderLibrary(): void {
    this.listEl.replaceChildren();
    this.libraryEmptyEl.hidden = this.items.length > 0;

    for (const item of this.items) {
      const row = document.createElement("div");
      row.className = "pdf-library-row";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "pdf-library-item";
      if (this.current?.relativePath === item.relativePath) {
        button.classList.add("is-active");
        button.setAttribute("aria-current", "page");
      }
      if (item.missing) button.classList.add("is-missing");
      button.title = item.sourcePath || item.relativePath;

      const title = document.createElement("span");
      title.className = "pdf-library-item-title";
      title.textContent = item.title;

      const meta = document.createElement("span");
      meta.className = "pdf-library-item-meta";
      if (item.missing) {
        meta.textContent = "Archivo original no encontrado";
        meta.classList.add("is-missing");
      } else {
        const parts = [
          formatBytes(item.fileSize),
          formatDate(item.modified),
        ];
        if (item.linked) parts.push(translate("Enlazado"));
        if (item.expiresAt) parts.push(`${translate("Caduca el")} ${formatDate(item.expiresAt)}`);
        meta.textContent = parts.filter(Boolean).join(" · ");
      }

      button.append(title, meta);
      button.addEventListener("click", () => void this.open(item.relativePath));
      row.appendChild(button);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "pdf-library-item-remove";
      removeButton.textContent = "×";
      const removeLabel = item.linked ? "Quitar enlace" : "Eliminar PDF";
      removeButton.title = removeLabel;
      removeButton.setAttribute("aria-label", `${removeLabel}: ${item.title}`);
      removeButton.addEventListener("click", () => void this.deleteItem(item));
      row.appendChild(removeButton);

      this.listEl.appendChild(row);
    }
  }

  async refreshLibrary(autoOpen: boolean): Promise<void> {
    this.setStatus("Leyendo la biblioteca de documentos…");
    try {
      this.items = await invoke<PdfListItem[]>("pdf_list");
      if (
        this.current &&
        !this.items.some((item) => item.relativePath === this.current?.relativePath)
      ) {
        this.closeCurrent();
      }
      this.renderLibrary();
      const firstAvailable = this.items.find((item) => !item.missing);
      if (autoOpen && firstAvailable && !this.current) {
        await this.open(firstAvailable.relativePath);
      } else {
        this.setStatus("");
        this.updateHeader();
      }
    } catch (error) {
      this.items = [];
      this.renderLibrary();
      this.setStatus(`No se pudo leer la biblioteca de documentos: ${errorMessage(error)}`);
      this.updateHeader();
    }
  }

  async open(relativePath: string): Promise<void> {
    this.setStatus("Abriendo documento…");
    this.loading = true;
    this.updateButtons();
    this.exitCaptureMode();
    this.clearSelection();
    try {
      const info = await invoke<PdfDocumentInfo>("pdf_open", { path: relativePath });
      this.current = info;
      this.currentPage = 0;
      this.lastRenderPage = -1;
      this.objectUrl = this.revokeObjectUrl(this.objectUrl);
      this.clearTextLayer();
      this.renderLibrary();
      this.updateHeader();
      this.stageEmptyEl.hidden = true;
      await this.renderCurrentPage(true);
      this.setStatus("");
    } catch (error) {
      this.setStatus(`No se pudo abrir el PDF: ${errorMessage(error)}`);
    } finally {
      this.loading = false;
      this.updateButtons();
    }
  }

  private async renderCurrentPage(force = false): Promise<void> {
    if (!this.current) return;

    const cssWidth = Math.max(MIN_RENDER_WIDTH, Math.floor(this.stageEl.clientWidth - 48));
    const deviceScale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
    const targetWidth = Math.max(
      MIN_RENDER_WIDTH,
      Math.min(MAX_RENDER_WIDTH, Math.round(cssWidth * deviceScale)),
    );

    if (
      !force &&
      this.currentPage === this.lastRenderPage &&
      Math.abs(targetWidth - this.lastRenderWidth) < 16
    ) {
      return;
    }

    const sequence = ++this.renderSequence;
    const pageIndex = this.currentPage;
    const relativePath = this.current.relativePath;
    this.loading = true;
    this.updateButtons();
    this.setStatus("Renderizando página…");

    try {
      const binary = await invoke<PdfBinary>("pdf_render_page", {
        path: relativePath,
        pageIndex,
        targetWidth,
      });
      if (
        sequence !== this.renderSequence ||
        !this.current ||
        this.current.relativePath !== relativePath ||
        this.currentPage !== pageIndex
      ) {
        return;
      }

      const nextUrl = URL.createObjectURL(toBlob(binary));
      const previousUrl = this.objectUrl;
      this.objectUrl = nextUrl;

      this.imageEl.onload = () => {
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        this.pageEl.hidden = false;
        this.stageEmptyEl.hidden = true;
        this.applyPageGeometry(cssWidth);
        this.setStatus("");
        if (this.textEnabled) void this.renderTextLayer();
      };
      this.imageEl.onerror = () => {
        URL.revokeObjectURL(nextUrl);
        if (this.objectUrl === nextUrl) this.objectUrl = null;
        this.setStatus("No se pudo mostrar la página renderizada.");
      };
      this.imageEl.style.width = "100%";
      this.imageEl.style.height = "100%";
      this.imageEl.alt = `Página ${this.currentPage + 1} de ${this.current.pageCount}`;
      this.imageEl.src = nextUrl;

      this.lastRenderPage = this.currentPage;
      this.lastRenderWidth = targetWidth;
    } catch (error) {
      if (sequence === this.renderSequence) {
        this.setStatus(`No se pudo renderizar la página: ${errorMessage(error)}`);
      }
    } finally {
      if (sequence === this.renderSequence) {
        this.loading = false;
        this.updateButtons();
      }
    }
  }

  private applyPageGeometry(cssWidth: number): void {
    const page = this.current?.pages[this.currentPage];
    if (!page || page.widthPoints <= 0) return;
    const cssHeight = Math.round(cssWidth * (page.heightPoints / page.widthPoints));
    this.pageEl.style.width = `${cssWidth}px`;
    this.pageEl.style.height = `${cssHeight}px`;
  }

  private async renderTextLayer(): Promise<void> {
    if (!this.current || !this.textEnabled) {
      this.textLayerEl.hidden = true;
      this.textLayerEl.replaceChildren();
      return;
    }

    const relativePath = this.current.relativePath;
    const pageIndex = this.currentPage;
    const cacheKey = `${relativePath}::${pageIndex}`;
    this.textLayerEl.replaceChildren();

    let textPage = this.textCache.get(cacheKey);
    if (!textPage) {
      try {
        textPage = await invoke<PdfTextPage>("pdf_page_text", {
          path: relativePath,
          pageIndex,
        });
        if (this.textCache.size >= 32) {
          const oldest = this.textCache.keys().next().value;
          if (oldest) this.textCache.delete(oldest);
        }
        this.textCache.set(cacheKey, textPage);
      } catch (error) {
        this.textLayerEl.hidden = true;
        this.setStatus(`No se pudo leer el texto de la página: ${errorMessage(error)}`);
        return;
      }
    }

    if (
      !this.current ||
      this.current.relativePath !== relativePath ||
      this.currentPage !== pageIndex ||
      !this.textEnabled
    ) {
      return;
    }

    if (textPage.runs.length === 0) {
      this.textLayerEl.hidden = true;
      this.setStatus("Esta página no tiene texto seleccionable (puede ser un escaneo).");
      return;
    }

    const cssHeight = this.pageEl.clientHeight || this.imageEl.clientHeight;
    if (cssHeight <= 0) {
      this.textLayerEl.hidden = true;
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const run of textPage.runs) {
      const span = document.createElement("span");
      this.applyTextRunStyle(span, run, cssHeight);
      span.textContent = run.text;
      fragment.appendChild(span);
    }
    this.textLayerEl.replaceChildren(fragment);
    this.textLayerEl.hidden = false;
    this.setStatus("Selecciona texto sobre la página para insertarlo en la nota.");
  }

  private applyTextRunStyle(span: HTMLSpanElement, run: PdfTextRun, cssHeight: number): void {
    span.style.left = `${(run.x * 100).toFixed(4)}%`;
    span.style.top = `${(run.y * 100).toFixed(4)}%`;
    span.style.width = `${(run.width * 100).toFixed(4)}%`;
    span.style.height = `${(run.height * 100).toFixed(4)}%`;
    span.style.fontSize = `${Math.max(1, run.height * cssHeight * 0.94).toFixed(2)}px`;
  }

  private async setTextMode(enabled: boolean): Promise<void> {
    if (this.textEnabled === enabled) return;
    this.textEnabled = enabled;
    this.clearSelection();
    if (enabled) {
      this.exitCaptureMode();
      this.updateButtons();
      await this.renderTextLayer();
    } else {
      this.textLayerEl.hidden = true;
      this.textLayerEl.replaceChildren();
      this.setStatus("");
      this.updateButtons();
    }
  }

  private clearTextLayer(): void {
    this.textLayerEl.hidden = true;
    this.textLayerEl.replaceChildren();
  }

  private handleSelectionChange(): void {
    if (!this.textEnabled) {
      this.selectionActionsEl.hidden = true;
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      this.selectionActionsEl.hidden = true;
      return;
    }

    const range = selection.getRangeAt(0);
    if (!this.textLayerEl.contains(range.commonAncestorContainer)) {
      this.selectionActionsEl.hidden = true;
      return;
    }

    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (!text) {
      this.selectionActionsEl.hidden = true;
      return;
    }

    this.selectedText = text;
    this.selectionActionsEl.hidden = false;
  }

  private clearSelection(): void {
    this.selectedText = "";
    this.selectionActionsEl.hidden = true;
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
  }

  private async insertSelectedText(): Promise<void> {
    if (!this.current || !this.selectedText) return;
    const text = this.selectedText;
    const source = `${this.current.title} · página ${this.currentPage + 1}`;
    try {
      await this.host.insertText(text, source);
      this.clearSelection();
      this.setStatus("Texto insertado en la nota.");
    } catch (error) {
      this.setStatus(`No se pudo insertar el texto: ${errorMessage(error)}`);
    }
  }

  private async copySelectedText(): Promise<void> {
    if (!this.selectedText) return;
    try {
      await navigator.clipboard.writeText(this.selectedText);
      this.setStatus("Texto copiado al portapapeles.");
    } catch {
      this.setStatus("No se pudo copiar el texto.");
    }
  }

  private async toggleCaptureMode(): Promise<void> {
    if (this.captureMode || this.pendingCapture) {
      this.exitCaptureMode();
      return;
    }
    if (!this.current) return;
    if (this.textEnabled) await this.setTextMode(false);
    this.clearSelection();
    this.captureMode = true;
    this.captureStart = null;
    this.pendingCapture = null;
    this.captureLayerEl.classList.remove("is-locked");
    this.captureLayerEl.hidden = false;
    this.captureSelectionEl.hidden = true;
    this.captureActionsEl.hidden = true;
    this.updateButtons();
    this.setStatus("Arrastra sobre la página para capturar una región.");
  }

  private exitCaptureMode(): void {
    this.captureMode = false;
    this.captureStart = null;
    this.pendingCapture = null;
    this.captureLayerEl.hidden = true;
    this.captureLayerEl.classList.remove("is-locked");
    this.captureSelectionEl.hidden = true;
    this.captureActionsEl.hidden = true;
    this.updateButtons();
  }

  private capturePoint(event: PointerEvent): DragPoint {
    const rect = this.captureLayerEl.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height))),
    };
  }

  private onCapturePointerDown(event: PointerEvent): void {
    if (!this.captureMode || event.button !== 0) return;
    event.preventDefault();
    this.captureStart = this.capturePoint(event);
    this.captureLayerEl.setPointerCapture(event.pointerId);
    this.captureSelectionEl.hidden = false;
    this.updateCaptureSelection(this.captureStart, this.captureStart);
  }

  private onCapturePointerMove(event: PointerEvent): void {
    if (!this.captureMode || !this.captureStart) return;
    event.preventDefault();
    this.updateCaptureSelection(this.captureStart, this.capturePoint(event));
  }

  private async onCapturePointerUp(event: PointerEvent): Promise<void> {
    if (!this.captureMode || !this.captureStart) return;
    event.preventDefault();
    const start = this.captureStart;
    const end = this.capturePoint(event);
    this.captureStart = null;
    if (this.captureLayerEl.hasPointerCapture(event.pointerId)) {
      this.captureLayerEl.releasePointerCapture(event.pointerId);
    }

    const rect = this.normalizedRect(start, end);
    const layerRect = this.captureLayerEl.getBoundingClientRect();
    const pixelWidth = rect.width * layerRect.width;
    const pixelHeight = rect.height * layerRect.height;
    if (pixelWidth < CAPTURE_MIN_SIZE || pixelHeight < CAPTURE_MIN_SIZE) {
      this.captureSelectionEl.hidden = true;
      this.setStatus("La región es demasiado pequeña. Arrastra un área mayor.");
      return;
    }

    this.updateCaptureSelection(start, end);
    try {
      await this.prepareCapture(rect);
    } catch (error) {
      this.setStatus(`No se pudo preparar la captura: ${errorMessage(error)}`);
    }
  }

  private normalizedRect(start: DragPoint, end: DragPoint): { x: number; y: number; width: number; height: number } {
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }

  private updateCaptureSelection(start: DragPoint, end: DragPoint): void {
    const rect = this.normalizedRect(start, end);
    const layerRect = this.captureLayerEl.getBoundingClientRect();
    this.captureSelectionEl.style.left = `${rect.x * 100}%`;
    this.captureSelectionEl.style.top = `${rect.y * 100}%`;
    this.captureSelectionEl.style.width = `${rect.width * 100}%`;
    this.captureSelectionEl.style.height = `${rect.height * 100}%`;
    this.captureLabelEl.textContent = `Región capturada · ${Math.round(rect.width * layerRect.width)} × ${Math.round(rect.height * layerRect.height)} px`;
  }

  private async prepareCapture(rect: { x: number; y: number; width: number; height: number }): Promise<void> {
    if (!this.current || !this.imageEl.naturalWidth || !this.imageEl.naturalHeight) {
      throw new Error("La página aún no está lista.");
    }

    const sx = Math.round(rect.x * this.imageEl.naturalWidth);
    const sy = Math.round(rect.y * this.imageEl.naturalHeight);
    const sw = Math.max(1, Math.round(rect.width * this.imageEl.naturalWidth));
    const sh = Math.max(1, Math.round(rect.height * this.imageEl.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo crear el lienzo de captura.");
    context.drawImage(this.imageEl, sx, sy, sw, sh, 0, 0, sw, sh);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!blob) throw new Error("No se pudo codificar la captura como PNG.");
    const bytes = new Uint8Array(await blob.arrayBuffer());

    this.pendingCapture = {
      bytes,
      fileName: captureFileName(this.current.title, this.currentPage),
    };
    this.captureMode = false;
    this.captureLayerEl.classList.add("is-locked");
    this.captureActionsEl.hidden = false;
    this.updateButtons();
    this.setStatus("Elige si quieres insertar la captura o crear una oclusión.");
  }

  private async insertPendingCapture(openOcclusion: boolean): Promise<void> {
    const pending = this.pendingCapture;
    if (!pending) return;
    this.insertCaptureButton.disabled = true;
    this.insertOcclusionButton.disabled = true;
    try {
      await this.host.insertCapture(pending.bytes, pending.fileName, openOcclusion);
      this.exitCaptureMode();
      this.setStatus(
        openOcclusion
          ? "Captura insertada. Dibuja las áreas que quieras ocultar."
          : "Captura insertada en la nota.",
      );
    } catch (error) {
      this.setStatus(`No se pudo insertar la captura: ${errorMessage(error)}`);
    } finally {
      this.insertCaptureButton.disabled = false;
      this.insertOcclusionButton.disabled = false;
    }
  }

  private resetCaptureDrag(): void {
    this.captureStart = null;
    this.captureSelectionEl.hidden = true;
  }

  private scheduleResizeRender(): void {
    if (!this.current || this.stageEl.clientWidth <= 0) return;
    if (this.resizeTimer !== null) window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      this.resizeTimer = null;
      if (this.current && !this.loading) void this.renderCurrentPage();
    }, 180);
  }

  private goToPage(index: number): void {
    if (!this.current) return;
    const clamped = Math.max(0, Math.min(this.current.pageCount - 1, index));
    if (clamped === this.currentPage) return;
    this.exitCaptureMode();
    this.clearSelection();
    this.currentPage = clamped;
    this.clearTextLayer();
    this.updateButtons();
    void this.renderCurrentPage(true);
  }

  private async importPdf(): Promise<void> {
    this.importButton.disabled = true;
    this.setStatus("Enlazando PDF…");
    try {
      const keepDays = this.retentionSelect.value
        ? Number(this.retentionSelect.value)
        : null;
      const imported = await invoke<PdfDocumentInfo | null>("pdf_import", { keepDays });
      if (!imported) {
        this.setStatus("");
        return;
      }

      const listItem: PdfListItem = {
        relativePath: imported.relativePath,
        title: imported.title,
        fileSize: imported.fileSize,
        modified: imported.modified,
        linked: imported.linked,
        missing: false,
        sourcePath: imported.sourcePath,
        expiresAt: imported.expiresAt,
      };
      const existingIndex = this.items.findIndex(
        (item) => item.relativePath === imported.relativePath,
      );
      if (existingIndex >= 0) this.items[existingIndex] = listItem;
      else this.items.push(listItem);
      this.items.sort((left, right) => left.title.localeCompare(right.title));

      this.current = imported;
      this.currentPage = 0;
      this.lastRenderPage = -1;
      this.objectUrl = this.revokeObjectUrl(this.objectUrl);
      this.exitCaptureMode();
      this.clearSelection();
      this.clearTextLayer();
      this.renderLibrary();
      this.updateHeader();
      this.stageEmptyEl.hidden = true;
      await this.renderCurrentPage(true);
      this.setStatus("PDF enlazado.");
    } catch (error) {
      this.setStatus(`No se pudo enlazar el PDF: ${errorMessage(error)}`);
    } finally {
      this.importButton.disabled = false;
      this.updateButtons();
    }
  }

  private async applyCurrentRetention(): Promise<void> {
    if (!this.current?.linked) return;
    const raw = this.currentRetentionSelect.value;
    if (raw.startsWith("expires-")) return;
    const keepDays = raw ? Number(raw) : null;
    this.currentRetentionSelect.disabled = true;
    try {
      await invoke<boolean>("pdf_set_expiry", {
        path: this.current.relativePath,
        keepDays,
      });
      this.current.expiresAt = keepDays ? Date.now() + keepDays * DAY_MS : null;
      const item = this.items.find(
        (entry) => entry.relativePath === this.current?.relativePath,
      );
      if (item) item.expiresAt = this.current.expiresAt;
      this.renderLibrary();
      this.updateHeader();
      this.setStatus(
        keepDays
          ? `El enlace se conservará ${keepDays} ${keepDays === 1 ? "día" : "días"}.`
          : "El enlace se conservará hasta que lo quites manualmente.",
      );
    } catch (error) {
      this.setStatus(`No se pudo programar la caducidad: ${errorMessage(error)}`);
      this.syncCurrentRetention();
    } finally {
      this.updateButtons();
    }
  }

  private async deleteItem(item: PdfListItem): Promise<void> {
    const accepted = await this.host.confirmDelete(item);
    if (!accepted) return;
    this.setStatus("Eliminando documento…");
    try {
      await invoke<boolean>("pdf_delete", { path: item.relativePath });
      this.textCache.clear();
      if (this.current?.relativePath === item.relativePath) {
        this.closeCurrent();
      }
      await this.refreshLibrary(false);
      this.setStatus(
        item.linked
          ? "Enlace eliminado. El archivo original no se ha modificado."
          : "PDF eliminado de la biblioteca del vault.",
      );
    } catch (error) {
      this.setStatus(`No se pudo eliminar el documento: ${errorMessage(error)}`);
    }
  }

  private closeCurrent(): void {
    this.current = null;
    this.currentPage = 0;
    this.lastRenderPage = -1;
    this.objectUrl = this.revokeObjectUrl(this.objectUrl);
    this.imageEl.removeAttribute("src");
    this.pageEl.hidden = true;
    this.stageEmptyEl.hidden = false;
    this.textLayerEl.hidden = true;
    this.textLayerEl.replaceChildren();
    this.textCache.clear();
    this.exitCaptureMode();
    this.clearSelection();
    this.updateHeader();
  }

  private revokeObjectUrl(url: string | null): null {
    if (url) URL.revokeObjectURL(url);
    return null;
  }
}
