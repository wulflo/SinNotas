import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import "katex/dist/katex.min.css";
import type { FSRSRating } from "../editor/fsrs";
import {
  appendOcclusionMasks,
  clampImageOcclusionRegion,
  updateImageOcclusionInContent,
} from "../editor/image-occlusion";
import { DocumentHistory, type DocumentHistoryEntry } from "../editor/history";
import { sanitizeHtml } from "../editor/markdown";
import { findNodeLocation } from "../editor/tree-engine";
import { initialVaultPages, VaultStore } from "../store/vault";
import { ReviewProgressStore, type ReviewProgressEvent } from "../store/review-progress";
import type { BlockNode, Flashcard, FlashcardType, ImageOcclusionRegion, PageData } from "../types";
import { FlashcardsManager } from "../views/flashcards-manager";
import {
  buildDeckTree,
  collectDeckPageTitles,
  flattenDeckRows,
  getDeckSelectionState,
  searchDeckTree,
  visibleDeckRoots,
  type DeckNode,
} from "../views/flashcard-decks";
import { DECK_SEPARATOR, normalizeDeckTitle } from "../deck-title";
import { hideAppSplash } from "../splash";
import { requestDesktopEditor, requestReviewMode } from "../app-mode";
import {
  currentLanguagePreference,
  initializeLocalization,
  setLanguagePreference,
  translate,
  type LanguagePreference,
} from "../i18n";
import {
  applyFontSizes,
  fontSizeDefinition,
  readFontSize,
  readFontSizes,
  writeFontSize,
} from "../typography";
import {
  checkForUpdates,
  getCurrentVersion,
  getUpdatePlatform,
  installAvailableUpdate,
  subscribeUpdateState,
  type UpdateState,
} from "../services/updater";
import { formatBytes } from "../services/update-utils";
import { installAndroidSafeArea, type AndroidSafeAreaWindow } from "./android-safe-area";
import { NOTES_RENDER_CHUNK, paginateNotes } from "./notes-pagination";
import "./mobile.css";

interface VaultSnapshot {
  rootPath: string;
  vaultName: string;
  pages: PageData[];
  skipped?: SkippedEntry[];
}

interface SkippedEntry {
  path: string;
  reason: string;
}

interface EditingContext {
  cardId: string;
  pageId: string;
  blockId: string;
  cardType: FlashcardType;
}

interface OcclusionEditingContext {
  cardId: string;
  pageId: string;
  blockId: string;
  regionIndex: number;
  current: ImageOcclusionRegion;
  draft: ImageOcclusionRegion;
  regions: ImageOcclusionRegion[];
}

interface OcclusionDragState {
  mode: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  stageWidth: number;
  stageHeight: number;
  region: ImageOcclusionRegion;
}

const ACCENT_STORAGE_KEY = "sinnotas-accent";
const THEME_STORAGE_KEY = "sinnotas-theme";
const FLASHCARD_PAGES_STORAGE_KEY = "sinnotas-flashcard-pages";
const LEARNING_MODE_STORAGE_KEY = "sinnotas-learning-mode";
const DEFAULT_ACCENT = "teal" as const;
type MobileTheme = "light" | "dark";
const ACCENT_COLORS = [
  { id: "blue", label: "Azul" },
  { id: "green", label: "Verde" },
  { id: "violet", label: "Violeta" },
  { id: "amber", label: "Ámbar" },
  { id: "rose", label: "Rosa" },
  { id: "cyan", label: "Cian" },
  { id: "teal", label: "Turquesa" },
  { id: "indigo", label: "Índigo" },
  { id: "orange", label: "Naranja" },
  { id: "fuchsia", label: "Fucsia" },
] as const;
type AccentColor = (typeof ACCENT_COLORS)[number]["id"];

function isAccentColor(value: string | null | undefined): value is AccentColor {
  return ACCENT_COLORS.some((accent) => accent.id === value);
}

function isAndroidRuntime(): boolean {
  const platform = (import.meta.env.TAURI_ENV_PLATFORM || "").toLowerCase();
  return isTauri() && (platform === "android" || /android/i.test(navigator.userAgent));
}

function cloneOcclusionRegion(region: ImageOcclusionRegion): ImageOcclusionRegion {
  return {
    ...region,
    ...(region.points ? { points: region.points.map(({ x, y }) => ({ x, y })) } : {}),
  };
}

const RATING_BUTTONS: Array<{ rating: FSRSRating; label: string; className: string }> = [
  { rating: 1, label: "Otra vez", className: "again" },
  { rating: 2, label: "Difícil", className: "hard" },
  { rating: 3, label: "Bien", className: "good" },
  { rating: 4, label: "Fácil", className: "easy" },
];

const MOBILE_ICONS = {
  cards: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="7" width="14" height="12" rx="2.5"></rect>
      <path d="M7 3.5h10.5A2.5 2.5 0 0 1 20 6v9"></path>
      <path d="M7.5 12h5"></path>
    </svg>`,
  notes: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2.5"></rect>
      <path d="M8 8h8"></path>
      <path d="M8 12h8"></path>
      <path d="M8 16h5"></path>
    </svg>`,
  editor: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
    </svg>`,
  settings: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 7h10"></path>
      <path d="M18 7h2"></path>
      <circle cx="16" cy="7" r="2"></circle>
      <path d="M4 17h2"></path>
      <path d="M10 17h10"></path>
      <circle cx="8" cy="17" r="2"></circle>
    </svg>`,
  close: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 6 6 18"></path>
      <path d="m6 6 12 12"></path>
    </svg>`,
  undo: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5"></path>
      <path d="M4 9h9a7 7 0 1 1 0 14h-2"></path>
    </svg>`,
  redo: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m15 14 5-5-5-5"></path>
      <path d="M20 9h-9a7 7 0 1 0 0 14h2"></path>
    </svg>`,
  sun: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4"></circle>
      <path d="M12 2v2"></path>
      <path d="M12 20v2"></path>
      <path d="m4.93 4.93 1.42 1.42"></path>
      <path d="m17.65 17.65 1.42 1.42"></path>
      <path d="M2 12h2"></path>
      <path d="M20 12h2"></path>
      <path d="m6.35 17.65-1.42 1.42"></path>
      <path d="m19.07 4.93-1.42 1.42"></path>
    </svg>`,
  moon: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"></path>
    </svg>`,
  check: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m5 12 4 4L19 6"></path>
    </svg>`,
};

const IMAGE_MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
  bmp: "image/bmp",
};

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Falta el elemento ${selector} en la vista móvil.`);
  return element;
}

function clonePages(pages: PageData[]): PageData[] {
  return JSON.parse(JSON.stringify(pages)) as PageData[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sameStringArray(left: string[] | null, right: string[] | null): boolean {
  if (left === null || right === null) return left === right;
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

class MobileReviewApp {
  private readonly manager = new FlashcardsManager();
  private readonly vault = new VaultStore();
  private readonly history = new DocumentHistory();
  private readonly reviewProgress = new ReviewProgressStore();
  private readonly historySeeded = new Set<string>();
  private readonly imageUrls = new Map<string, string>();
  private readonly imageFallbackUrls = new Map<string, string>();
  private lastHistoryPageId: string | null = null;
  private lastHistoryCardId: string | null = null;
  private lastDiskSyncAt = 0;
  private diskSyncInFlight = false;
  private historyActionInFlight = false;

  private pages: PageData[] = [];
  private editing: EditingContext | null = null;
  private occlusionEditing: OcclusionEditingContext | null = null;
  private occlusionDrag: OcclusionDragState | null = null;
  private accent: AccentColor = DEFAULT_ACCENT;
  private notesSearch = "";
  private notesDraft = new Map<string, boolean>();
  private notesCollapsed = new Set<string>();
  private notesCurrentPage = 1;
  private notesTotalPages = 1;
  private notesRenderToken = 0;
  private toastTimer: number | null = null;
  private busy = false;
  private learningMode = false;
  private imageRequest = 0;
  private updateUiReady = false;
  private lastUpdateStatus: UpdateState["status"] = "idle";

  private readonly root: HTMLDivElement;
  private readonly refs: {
    card: HTMLElement;
    question: HTMLElement;
    answer: HTMLElement;
    empty: HTMLElement;
    emptyTitle: HTMLElement;
    emptyDetail: HTMLElement;
    type: HTMLElement;
    source: HTMLElement;
    fsrs: HTMLElement;
    counter: HTMLElement;
    progress: HTMLElement;
    reveal: HTMLButtonElement;
    ratings: HTMLElement;
    edit: HTMLButtonElement;
    undoButton: HTMLButtonElement;
    redoButton: HTMLButtonElement;
    vaultName: HTMLElement;
    vaultButton: HTMLButtonElement;
    refreshButton: HTMLButtonElement;
    notesButton: HTMLButtonElement;
    notesBadge: HTMLElement;
    themeOptions: HTMLElement;
    notesSheet: HTMLElement;
    notesSearchInput: HTMLInputElement;
    notesList: HTMLElement;
    notesPagination: HTMLElement;
    notesPrevButton: HTMLButtonElement;
    notesNextButton: HTMLButtonElement;
    notesPageInfo: HTMLElement;
    learningToggle: HTMLButtonElement;
    editor: HTMLElement;
    questionField: HTMLElement;
    answerField: HTMLElement;
    textField: HTMLElement;
    questionInput: HTMLTextAreaElement;
    answerInput: HTMLTextAreaElement;
    textInput: HTMLTextAreaElement;
    saveEditor: HTMLButtonElement;
    settingsSheet: HTMLElement;
    drawer: HTMLElement;
    accentGrid: HTMLElement;
    fontSizeInput: HTMLInputElement;
    fontSizeValue: HTMLOutputElement;
    occlusionEditor: HTMLElement;
    occlusionStage: HTMLElement;
    occlusionImage: HTMLImageElement;
    occlusionMasks: HTMLElement;
    occlusionHandle: HTMLElement;
    occlusionGrip: HTMLElement;
    occlusionCoords: HTMLElement;
    saveOcclusion: HTMLButtonElement;
    updateSection: HTMLElement;
    updateCurrentVersion: HTMLElement;
    updateAvailable: HTMLElement;
    updateNewVersion: HTMLElement;
    updateCheckButton: HTMLButtonElement;
    updateInstallButton: HTMLButtonElement;
    updateProgress: HTMLProgressElement;
    updateProgressLabel: HTMLElement;
    updateStatus: HTMLElement;
    updateNotesWrap: HTMLDetailsElement;
    updateNotes: HTMLElement;
    vaultGate: HTMLElement;
    vaultGateMessage: HTMLElement;
    toast: HTMLElement;
  };

  constructor() {
    this.root = document.createElement("div");
    this.root.className = "mobile-review";
    this.root.innerHTML = `
      <header class="mobile-header">
        <button class="mobile-brand" type="button" data-action="menu" aria-label="Abrir menú" aria-expanded="false" title="Abrir menú">
          <span class="mobile-logo" aria-hidden="true">Sn</span>
          <div class="mobile-brand-text">
            <strong>Sin Notas</strong>
            <small data-vault-name>Repaso</small>
          </div>
        </button>
        <div class="mobile-header-actions">
          <button class="mobile-icon-button mobile-history-button" type="button" data-action="undo" aria-label="Deshacer" title="Deshacer" disabled>${MOBILE_ICONS.undo}</button>
          <button class="mobile-icon-button mobile-history-button" type="button" data-action="redo" aria-label="Rehacer" title="Rehacer" disabled>${MOBILE_ICONS.redo}</button>
        </div>
      </header>

      <div class="mobile-progress" role="progressbar" aria-label="Progreso del repaso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <span data-progress></span>
      </div>

      <main class="mobile-main">
        <section class="mobile-card" data-card aria-live="polite">
          <div class="mobile-card-meta">
            <span class="mobile-pill" data-card-type>FSRS</span>
            <span class="mobile-card-source" data-card-source></span>
            <span class="mobile-card-fsrs" data-card-fsrs></span>
          </div>
          <div class="mobile-card-body">
            <div class="mobile-question markdown-rendered" data-question></div>
            <div class="mobile-answer markdown-rendered" data-answer hidden></div>
          </div>
          <div class="mobile-empty" data-empty hidden>
            <span class="mobile-empty-icon" aria-hidden="true">${MOBILE_ICONS.check}</span>
            <h1 data-empty-title>Todo al día</h1>
            <p data-empty-detail>No hay tarjetas pendientes en esta bóveda.</p>
          </div>
        </section>
      </main>

      <footer class="mobile-actions">
        <div class="mobile-card-tools">
          <span class="mobile-counter" data-counter>0 / 0</span>
          <div class="mobile-card-tool-actions">
            <button class="mobile-edit-button" type="button" data-action="edit" hidden>Editar tarjeta</button>
          </div>
        </div>
        <button class="mobile-reveal" type="button" data-action="reveal">Mostrar respuesta</button>
        <div class="mobile-ratings" data-ratings hidden>
          ${RATING_BUTTONS.map(({ rating, label, className }) => `
            <button class="mobile-rating ${className}" type="button" data-action="rate" data-rating="${rating}">
              <span>${label}</span>
              <small data-interval="${rating}">—</small>
            </button>
          `).join("")}
        </div>
      </footer>

      <div class="mobile-editor-scrim" data-editor hidden>
        <section class="mobile-editor" role="dialog" aria-modal="true" aria-labelledby="mobile-editor-title">
          <header class="mobile-editor-header">
            <h2 id="mobile-editor-title">Editar tarjeta</h2>
            <button class="mobile-icon-button" type="button" data-action="close-editor" aria-label="Cerrar editor">${MOBILE_ICONS.close}</button>
          </header>
          <label class="mobile-editor-field" data-question-field>
            <span>Pregunta</span>
            <textarea data-edit-question rows="3" spellcheck="false"></textarea>
          </label>
          <label class="mobile-editor-field" data-answer-field>
            <span>Respuesta</span>
            <textarea data-edit-answer rows="3" spellcheck="false"></textarea>
          </label>
          <label class="mobile-editor-field" data-text-field hidden>
            <span>Texto de la tarjeta</span>
            <textarea data-edit-text rows="6" spellcheck="false"></textarea>
          </label>
          <p class="mobile-editor-hint">Solo se modifica este bloque. Se conservan las propiedades FSRS, la etiqueta #card y el resto de la nota.</p>
          <footer class="mobile-editor-actions">
            <button class="mobile-secondary" type="button" data-action="close-editor">Cancelar</button>
            <button class="mobile-primary" type="button" data-action="save-editor" data-save-editor>Guardar</button>
          </footer>
        </section>
      </div>

      <div class="mobile-editor-scrim" data-settings-sheet hidden>
        <section class="mobile-editor mobile-settings-editor" role="dialog" aria-modal="true" aria-labelledby="mobile-settings-title">
          <header class="mobile-editor-header">
            <h2 id="mobile-settings-title">Ajustes</h2>
            <button class="mobile-icon-button" type="button" data-action="close-settings" aria-label="Cerrar ajustes">${MOBILE_ICONS.close}</button>
          </header>

          <h3 class="mobile-appearance-title">Tema</h3>
          <div class="mobile-theme-options" data-theme-options role="group" aria-label="Tema">
            <button class="mobile-theme-option" type="button" data-action="set-theme" data-theme-option="light" aria-pressed="false">
              <span aria-hidden="true">${MOBILE_ICONS.sun}</span>
              <small>Claro</small>
            </button>
            <button class="mobile-theme-option" type="button" data-action="set-theme" data-theme-option="dark" aria-pressed="false">
              <span aria-hidden="true">${MOBILE_ICONS.moon}</span>
              <small>Oscuro</small>
            </button>
          </div>
          <p class="mobile-editor-hint mobile-theme-hint">Elige el tema de la app. Se guarda en este dispositivo y se comparte con la versión de escritorio.</p>

          <h3 class="mobile-appearance-title">Color de acento</h3>
          <div class="mobile-accent-grid" data-accent-grid role="group" aria-label="Colores de acento">
            ${ACCENT_COLORS.map(({ id, label }) => `
              <button class="mobile-accent-option" type="button" data-action="set-accent" data-accent-option="${id}" aria-label="${label}" title="${label}" aria-pressed="false">
                <span class="mobile-accent-swatch" data-accent-swatch="${id}" aria-hidden="true"></span>
                <small>${label}</small>
              </button>
            `).join("")}
          </div>
          <p class="mobile-editor-hint">El color se guarda en este dispositivo y se comparte con la versión de escritorio.</p>

          <h3 class="mobile-appearance-title">Tamaño de texto global</h3>
          <label class="mobile-font-size-control" for="mobile-font-size">
            <input id="mobile-font-size" type="range" min="${fontSizeDefinition("ui").min}" max="${fontSizeDefinition("ui").max}" step="${fontSizeDefinition("ui").step}" value="${readFontSize("ui")}" data-mobile-font-size />
            <output data-mobile-font-size-value for="mobile-font-size">${readFontSize("ui")} px</output>
          </label>
          <p class="mobile-editor-hint">Todos los textos de la app se adaptan a este tamaño.</p>

          <h3 class="mobile-appearance-title">Idioma</h3>
          <div class="mobile-lang-options">
            <button class="mobile-lang-option" type="button" data-action="set-lang" data-lang="auto">Automático (Sistema)</button>
            <button class="mobile-lang-option" type="button" data-action="set-lang" data-lang="es">Español</button>
            <button class="mobile-lang-option" type="button" data-action="set-lang" data-lang="en">English</button>
            <button class="mobile-lang-option" type="button" data-action="set-lang" data-lang="zh">中文</button>
          </div>
          <p class="mobile-editor-hint">El idioma se guarda en este dispositivo.</p>

          <h3 class="mobile-appearance-title">Actualizaciones</h3>
          <div class="mobile-update-card" data-update-section>
            <div class="mobile-update-row">
              <span>Versión instalada</span>
              <strong data-update-current-version>—</strong>
            </div>
            <div class="mobile-update-row" data-update-available hidden>
              <span>Nueva versión</span>
              <strong data-update-new-version>—</strong>
            </div>
            <div class="mobile-settings-actions">
              <button class="mobile-secondary" type="button" data-action="check-updates">Buscar actualizaciones</button>
              <button class="mobile-primary" type="button" data-action="install-update" data-update-install hidden>Descargar APK</button>
            </div>
            <progress class="mobile-update-progress" data-update-progress max="1" value="0" hidden></progress>
            <span class="mobile-update-progress-label" data-update-progress-label hidden></span>
            <p class="mobile-editor-hint mobile-update-status" data-update-status role="status" aria-live="polite"></p>
            <details class="mobile-update-notes" data-update-notes hidden>
              <summary>Notas de la versión</summary>
              <pre data-update-notes-content></pre>
            </details>
          </div>
          <p class="mobile-editor-hint">Sin Notas solo consulta GitHub cuando pulsás el botón. El APK se guarda en Descargas/SinNotas; abrilo desde un gestor de archivos para instalarlo.</p>

          <h3 class="mobile-appearance-title">Bóveda y mantenimiento</h3>
          <div class="mobile-settings-actions">
            <button class="mobile-secondary" type="button" data-action="vault">Cambiar bóveda</button>
            <button class="mobile-secondary" type="button" data-action="refresh">Actualizar tarjetas</button>
            <button class="mobile-secondary" type="button" data-action="full-editor">Abrir páginas y editor</button>
            <button class="mobile-secondary" type="button" data-action="reload-app">Recargar aplicación</button>
          </div>
        </section>
      </div>

      <div class="mobile-editor-scrim" data-notes-sheet hidden>
        <section class="mobile-editor mobile-notes-editor" role="dialog" aria-modal="true" aria-labelledby="mobile-notes-title">
          <header class="mobile-editor-header">
            <h2 id="mobile-notes-title">Mazos del repaso</h2>
            <button class="mobile-icon-button" type="button" data-action="close-notes" aria-label="Cerrar selector de mazos">${MOBILE_ICONS.close}</button>
          </header>
          <div class="mobile-notes-toolbar">
            <input class="mobile-notes-search" type="search" data-notes-search placeholder="Buscar mazo o nota…" autocomplete="off" spellcheck="false" aria-label="Filtrar mazos y notas">
            <div class="mobile-notes-bulk-actions">
              <button class="mobile-link-button" type="button" data-action="notes-all">Todos</button>
              <button class="mobile-link-button" type="button" data-action="notes-none">Ninguno</button>
            </div>
          </div>
          <div class="mobile-notes-list" data-notes-list role="tree" aria-multiselectable="true" aria-label="Mazos y notas con tarjetas"></div>
          <div class="mobile-notes-pagination" data-notes-pagination hidden>
            <button class="mobile-link-button" type="button" data-action="notes-prev" disabled>← Anterior</button>
            <span class="mobile-notes-page-info" data-notes-page-info role="status" aria-live="polite">Página 1 de 1</span>
            <button class="mobile-link-button" type="button" data-action="notes-next" disabled>Siguiente →</button>
          </div>
          <p class="mobile-editor-hint">Usa <code>→</code> en el título para crear mazos y submazos (también acepta <code>::</code>). Marca un mazo para incluir todas sus notas hijas. La búsqueda no cambia la selección.</p>
          <footer class="mobile-editor-actions">
            <button class="mobile-secondary" type="button" data-action="close-notes">Cancelar</button>
            <button class="mobile-primary" type="button" data-action="apply-notes">Aplicar selección</button>
          </footer>
        </section>
      </div>

      <div class="mobile-editor-scrim" data-occlusion-editor hidden>
        <section class="mobile-editor mobile-occlusion-editor" role="dialog" aria-modal="true" aria-labelledby="mobile-occlusion-title">
          <header class="mobile-editor-header">
            <h2 id="mobile-occlusion-title">Editar oclusión</h2>
            <button class="mobile-icon-button" type="button" data-action="close-occlusion" aria-label="Cerrar editor de oclusión">${MOBILE_ICONS.close}</button>
          </header>
          <p class="mobile-editor-hint">Arrastra la zona resaltada para moverla. Usa el tirador inferior derecho para cambiar el tamaño.</p>
          <div class="mobile-occlusion-stage" data-occlusion-stage>
            <img data-occlusion-image alt="Imagen de la tarjeta de oclusión" decoding="async">
            <div class="mobile-occlusion-masks" data-occlusion-masks aria-hidden="true"></div>
            <div class="mobile-occlusion-handle" data-occlusion-handle tabindex="0" aria-label="Zona de oclusión seleccionada">
              <span class="mobile-occlusion-grip" data-occlusion-grip aria-hidden="true"></span>
            </div>
          </div>
          <p class="mobile-occlusion-coords" data-occlusion-coords></p>
          <footer class="mobile-editor-actions">
            <button class="mobile-secondary" type="button" data-action="close-occlusion">Cancelar</button>
            <button class="mobile-primary" type="button" data-action="save-occlusion" data-save-occlusion>Guardar oclusión</button>
          </footer>
        </section>
      </div>

      <div class="mobile-drawer-scrim" data-drawer hidden>
        <aside class="mobile-drawer" role="dialog" aria-modal="true" aria-labelledby="mobile-drawer-title">
          <header class="mobile-editor-header">
            <h2 id="mobile-drawer-title">Menú de repaso</h2>
            <button class="mobile-icon-button" type="button" data-action="close-drawer" aria-label="Cerrar menú">${MOBILE_ICONS.close}</button>
          </header>
          <div class="mobile-drawer-actions">
            <button class="mobile-drawer-action mobile-learning-toggle" type="button" data-action="toggle-learning" role="switch" aria-checked="false" aria-label="Aprendizaje">
              <span aria-hidden="true">${MOBILE_ICONS.cards}</span>
              <strong>Aprendizaje</strong>
              <small>Repasa sin guardar el progreso FSRS</small>
              <span class="mobile-switch" aria-hidden="true"></span>
            </button>
            <button class="mobile-drawer-action mobile-notes-button" type="button" data-action="notes">
              <span aria-hidden="true">${MOBILE_ICONS.notes}</span>
              <strong>Repasar notas</strong>
              <small>Elegir qué notas aportan tarjetas</small>
              <span class="mobile-filter-badge" data-notes-badge hidden></span>
            </button>
            <button class="mobile-drawer-action" type="button" data-action="full-editor">
              <span aria-hidden="true">${MOBILE_ICONS.editor}</span>
              <strong>Abrir páginas y editor</strong>
              <small>Abrir el editor completo de la bóveda</small>
            </button>
            <button class="mobile-drawer-action" type="button" data-action="settings">
              <span aria-hidden="true">${MOBILE_ICONS.settings}</span>
              <strong>Ajustes</strong>
              <small>Tema, color, tamaño de texto e idioma</small>
            </button>
          </div>
        </aside>
      </div>

      <div class="mobile-vault-gate" data-vault-gate hidden>
        <section class="mobile-vault-gate-card" role="dialog" aria-modal="true" aria-labelledby="mobile-vault-gate-title">
          <span class="mobile-vault-gate-logo" aria-hidden="true">Sn</span>
          <h1 id="mobile-vault-gate-title">Elige tu bóveda</h1>
          <p data-vault-gate-message>Selecciona la carpeta donde están tus notas. Sin Notas recordará el permiso para las próximas veces.</p>
          <button class="mobile-primary" type="button" data-action="choose-vault">Elegir carpeta</button>
        </section>
      </div>

      <div class="mobile-toast" data-toast role="status" aria-live="polite"></div>
    `;

    this.refs = {
      card: requireElement(this.root, "[data-card]"),
      question: requireElement(this.root, "[data-question]"),
      answer: requireElement(this.root, "[data-answer]"),
      empty: requireElement(this.root, "[data-empty]"),
      emptyTitle: requireElement(this.root, "[data-empty-title]"),
      emptyDetail: requireElement(this.root, "[data-empty-detail]"),
      type: requireElement(this.root, "[data-card-type]"),
      source: requireElement(this.root, "[data-card-source]"),
      fsrs: requireElement(this.root, "[data-card-fsrs]"),
      counter: requireElement(this.root, "[data-counter]"),
      progress: requireElement(this.root, ".mobile-progress"),
      reveal: requireElement(this.root, "[data-action='reveal']"),
      ratings: requireElement(this.root, "[data-ratings]"),
      edit: requireElement(this.root, "[data-action='edit']"),
      undoButton: requireElement(this.root, "[data-action='undo']"),
      redoButton: requireElement(this.root, "[data-action='redo']"),
      vaultName: requireElement(this.root, "[data-vault-name]"),
      vaultButton: requireElement(this.root, "[data-action='vault']"),
      refreshButton: requireElement(this.root, "[data-action='refresh']"),
      notesButton: requireElement(this.root, "[data-action='notes']"),
      notesBadge: requireElement(this.root, "[data-notes-badge]"),
      themeOptions: requireElement(this.root, "[data-theme-options]"),
      notesSheet: requireElement(this.root, "[data-notes-sheet]"),
      notesSearchInput: requireElement(this.root, "[data-notes-search]"),
      notesList: requireElement(this.root, "[data-notes-list]"),
      notesPagination: requireElement(this.root, "[data-notes-pagination]"),
      notesPrevButton: requireElement(this.root, "[data-action='notes-prev']"),
      notesNextButton: requireElement(this.root, "[data-action='notes-next']"),
      notesPageInfo: requireElement(this.root, "[data-notes-page-info]"),
      learningToggle: requireElement(this.root, "[data-action='toggle-learning']"),
      editor: requireElement(this.root, "[data-editor]"),
      questionField: requireElement(this.root, "[data-question-field]"),
      answerField: requireElement(this.root, "[data-answer-field]"),
      textField: requireElement(this.root, "[data-text-field]"),
      questionInput: requireElement(this.root, "[data-edit-question]"),
      answerInput: requireElement(this.root, "[data-edit-answer]"),
      textInput: requireElement(this.root, "[data-edit-text]"),
      saveEditor: requireElement(this.root, "[data-save-editor]"),
      settingsSheet: requireElement(this.root, "[data-settings-sheet]"),
      drawer: requireElement(this.root, "[data-drawer]"),
      accentGrid: requireElement(this.root, "[data-accent-grid]"),
      fontSizeInput: requireElement(this.root, "[data-mobile-font-size]"),
      fontSizeValue: requireElement(this.root, "[data-mobile-font-size-value]"),
      occlusionEditor: requireElement(this.root, "[data-occlusion-editor]"),
      occlusionStage: requireElement(this.root, "[data-occlusion-stage]"),
      occlusionImage: requireElement(this.root, "[data-occlusion-image]"),
      occlusionMasks: requireElement(this.root, "[data-occlusion-masks]"),
      occlusionHandle: requireElement(this.root, "[data-occlusion-handle]"),
      occlusionGrip: requireElement(this.root, "[data-occlusion-grip]"),
      occlusionCoords: requireElement(this.root, "[data-occlusion-coords]"),
      saveOcclusion: requireElement(this.root, "[data-save-occlusion]"),
      updateSection: requireElement(this.root, "[data-update-section]"),
      updateCurrentVersion: requireElement(this.root, "[data-update-current-version]"),
      updateAvailable: requireElement(this.root, "[data-update-available]"),
      updateNewVersion: requireElement(this.root, "[data-update-new-version]"),
      updateCheckButton: requireElement(this.root, "[data-action='check-updates']"),
      updateInstallButton: requireElement(this.root, "[data-update-install]"),
      updateProgress: requireElement(this.root, "[data-update-progress]"),
      updateProgressLabel: requireElement(this.root, "[data-update-progress-label]"),
      updateStatus: requireElement(this.root, "[data-update-status]"),
      updateNotesWrap: requireElement(this.root, "[data-update-notes]"),
      updateNotes: requireElement(this.root, "[data-update-notes-content]"),
      vaultGate: requireElement(this.root, "[data-vault-gate]"),
      vaultGateMessage: requireElement(this.root, "[data-vault-gate-message]"),
      toast: requireElement(this.root, "[data-toast]"),
    };
  }

  public mount(): void {
    document.documentElement.dataset.appMode = "flashcards";
    document.body.classList.add("mobile-review-body");
    // `replaceChildren` eliminaría el splash del HTML inicial; conservarlo para
    // que cubra la carga inicial y se retire cuando la bóveda esté lista.
    const splash = document.getElementById("app-splash");
    document.body.replaceChildren(this.root);
    if (splash) document.body.appendChild(splash);
    // Reaplica las insets nativas cuando el documento ya está montado: en
    // WebView < 140 el script de inicio puede correr antes de que Android
    // entregue los valores reales.
    installAndroidSafeArea(window as unknown as AndroidSafeAreaWindow);
    // Fallback de seguridad: ocultar splash tras 15 segundos si algo se cuelga
    const splashTimeout = window.setTimeout(() => {
      try {
        hideAppSplash();
      } catch {}
    }, 15000);
    this.applyTheme(this.readStoredTheme() ?? this.systemTheme(), false);
    this.applyAccent(this.readStoredAccent(), false);
    this.applyStoredFontSizes();
    this.learningMode = this.readStoredLearningMode();
    // El modo Aprendizaje debe incluir también las tarjetas que aún no vencen,
    // incluso si la app se abre con el interruptor ya activo.
    this.manager.setIncludeAllCards(this.learningMode);
    this.updateLearningSwitch();
    this.updateLanguageButtons();
    this.bindEvents();
    this.initUpdateSettings();
    void this.bootstrapVault().finally(() => {
      window.clearTimeout(splashTimeout);
    });
  }

  /**
   * En Android el primer arranque debe elegir una carpeta real mediante SAF.
   * Antes se abría siempre el directorio privado `files`, lo que impedía usar
   * una bóveda existente del usuario.
   */
  private async bootstrapVault(): Promise<void> {
    let rootPath = this.vault.getActiveRootPath();
    if (isAndroidRuntime()) {
      if (!rootPath) {
        try {
          rootPath = await invoke<string | null>("pick_vault_root");
        } catch (error) {
          console.error("No se pudo abrir el selector inicial de bóvedas:", error);
          rootPath = null;
        }
        if (!rootPath) {
          hideAppSplash();
          this.showVaultGate();
          return;
        }
      }
    }
    await this.loadAndApply(rootPath, undefined, true);
  }

  private showVaultGate(message?: string): void {
    if (message) this.refs.vaultGateMessage.textContent = translate(message);
    this.refs.vaultGate.hidden = false;
    this.setBusy(false);
  }

  private hideVaultGate(): void {
    this.refs.vaultGate.hidden = true;
  }

  private bindEvents(): void {
    this.root.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!target || this.busy) return;
      const action = target.dataset.action;
      if (action === "reveal") this.reveal();
      else if (action === "edit") this.openEditor();
      else if (action === "undo") {
        void this.undo();
      } else if (action === "redo") {
        void this.redo();
      } else if (action === "rate") {
        const rating = Number(target.dataset.rating) as FSRSRating;
        void this.rate(rating);
      } else if (action === "refresh") {
        this.closeSettings();
        void this.loadAndApply(this.vault.getActiveRootPath(), "Tarjetas actualizadas");
      } else if (action === "vault") {
        this.closeSettings();
        void this.pickVault();
      } else if (action === "choose-vault") {
        void this.pickVault();
      } else if (action === "full-editor") {
        requestDesktopEditor();
        window.location.reload();
      } else if (action === "switch-mode") {
        requestReviewMode();
        window.location.reload();
      } else if (action === "menu") {
        this.openDrawer();
      } else if (action === "close-drawer") {
        this.closeDrawer();
      } else if (action === "toggle-learning") {
        this.setLearningMode(!this.learningMode);
      } else if (action === "settings") {
        this.openSettings();
      } else if (action === "close-settings") {
        this.closeSettings();
      } else if (action === "notes") {
        this.closeDrawer();
        this.openNotes();
      } else if (action === "close-notes") {
        this.closeNotes();
      } else if (action === "notes-all") {
        this.setAllNotesSelected(true);
      } else if (action === "notes-none") {
        this.setAllNotesSelected(false);
      } else if (action === "notes-prev") {
        if (this.notesCurrentPage > 1) {
          this.notesCurrentPage--;
          this.renderNotesList({ resetScroll: true });
        }
      } else if (action === "notes-next") {
        if (this.notesCurrentPage < this.notesTotalPages) {
          this.notesCurrentPage++;
          this.renderNotesList({ resetScroll: true });
        }
      } else if (action === "apply-notes") {
        this.applyNotesSelection();
      } else if (action === "set-theme") {
        const option = target.dataset.themeOption;
        if (option === "light" || option === "dark") {
          this.applyTheme(option);
          this.showToast(option === "light" ? "Tema claro activado" : "Tema oscuro activado");
        }
      } else if (action === "close-editor") {
        this.closeEditor();
      } else if (action === "save-editor") {
        void this.saveEditor();
      } else if (action === "reload-app") {
        this.closeSettings();
        this.closeDrawer();
        window.location.reload();
        return;
      } else if (action === "check-updates") {
        void checkForUpdates();
      } else if (action === "install-update") {
        void installAvailableUpdate();
      } else if (action === "set-lang") {
        const lang = target.dataset.lang;
        if (lang === "auto" || lang === "es" || lang === "en" || lang === "zh") {
          setLanguagePreference(lang as LanguagePreference);
          this.updateLanguageButtons();
        }
      } else if (action === "set-accent") {
        const accent = target.dataset.accentOption;
        if (isAccentColor(accent)) {
          this.applyAccent(accent);
          const label = ACCENT_COLORS.find((option) => option.id === accent)?.label || accent;
          this.showToast(`Color de acento: ${label}`);
        }
      } else if (action === "close-occlusion") {
        this.closeOcclusionEditor();
      } else if (action === "save-occlusion") {
        void this.saveOcclusionEditor();
      }
    });

    this.refs.editor.addEventListener("click", (event) => {
      if (event.target === this.refs.editor) this.closeEditor();
    });
    this.refs.settingsSheet.addEventListener("click", (event) => {
      if (event.target === this.refs.settingsSheet) this.closeSettings();
    });
    this.refs.drawer.addEventListener("click", (event) => {
      if (event.target === this.refs.drawer) this.closeDrawer();
    });
    this.refs.notesSheet.addEventListener("click", (event) => {
      if (event.target === this.refs.notesSheet) this.closeNotes();
    });
    this.refs.fontSizeInput.addEventListener("input", () => {
      const size = writeFontSize("ui", Number(this.refs.fontSizeInput.value));
      this.applyStoredFontSizes();
      this.refs.fontSizeValue.value = `${size} px`;
    });
    this.refs.occlusionEditor.addEventListener("click", (event) => {
      if (event.target === this.refs.occlusionEditor) this.closeOcclusionEditor();
    });
    this.refs.notesSearchInput.addEventListener("input", () => {
      this.notesSearch = this.refs.notesSearchInput.value;
      // La búsqueda redefine la lista visible: volver a la primera página.
      this.notesCurrentPage = 1;
      this.renderNotesList({ resetScroll: true });
    });

    this.refs.occlusionHandle.addEventListener("pointerdown", (event) => {
      this.startOcclusionDrag(event, "move");
    });
    this.refs.occlusionGrip.addEventListener("pointerdown", (event) => {
      this.startOcclusionDrag(event, "resize");
    });
    this.refs.occlusionHandle.addEventListener("keydown", (event) => {
      this.nudgeOcclusionFromKeyboard(event);
    });

    document.addEventListener("keydown", (event) => {
      if (!this.refs.occlusionEditor.hidden) {
        if (event.key === "Escape") this.closeOcclusionEditor();
        return;
      }
      if (!this.refs.drawer.hidden) {
        if (event.key === "Escape") this.closeDrawer();
        return;
      }
      if (!this.refs.settingsSheet.hidden) {
        if (event.key === "Escape") this.closeSettings();
        return;
      }
      if (!this.refs.notesSheet.hidden) {
        if (event.key === "Escape") this.closeNotes();
        return;
      }
      if (!this.refs.editor.hidden) {
        if (event.key === "Escape") this.closeEditor();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.matches("input, textarea, select") || target.isContentEditable)
      ) {
        return;
      }
      if (event.repeat) return;

      if (event.key === " " || event.key === "Enter") {
        if (!this.manager.isRevealed() && this.manager.getCurrentCard()) {
          event.preventDefault();
          this.reveal();
        }
        return;
      }
      if (this.manager.isRevealed()) {
        if (["1", "2", "3", "4"].includes(event.key)) {
          event.preventDefault();
          void this.rate(Number(event.key) as FSRSRating);
        } else if (event.key.toLowerCase() === "e") {
          event.preventDefault();
          this.openEditor();
        }
      }
    });

    window.addEventListener("focus", () => {
      void this.syncFromDiskIfIdle();
    });
    window.addEventListener("vault-operation-error", (event) => {
      const message = (event as CustomEvent<string>).detail;
      if (message) this.showToast(message);
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void this.syncFromDiskIfIdle();
    });
  }

  private async loadAndApply(
    rootPath: string | null | undefined,
    successMessage?: string,
    initial = false
  ): Promise<void> {
    this.setBusy(true);
    try {
      const previousRoot = this.vault.getActiveRootPath();
      const activeCard = this.manager.getCurrentCard();
      const activeCardId = activeCard?.id || null;
      const wasRevealed = this.manager.isRevealed();
      const snapshot = await this.loadVault(rootPath);
      await this.reviewProgress.load(snapshot.rootPath !== previousRoot);
      this.applySnapshot(
        snapshot,
        activeCardId ? { cardId: activeCardId, revealed: wasRevealed } : undefined
      );
      this.render();
      if (successMessage) this.showToast(successMessage);
    } catch (error) {
      console.error("No se pudo cargar la bóveda de repaso:", error);
      if (initial) {
        if (isAndroidRuntime()) {
          this.showVaultGate(
            "No se pudo abrir la bóveda guardada. Elige la carpeta de nuevo para renovar el permiso."
          );
        } else {
          this.showEmpty(
            "No se pudo abrir la bóveda",
            "Comprueba los permisos de la carpeta e inténtalo de nuevo."
          );
        }
      }
      this.showToast(`No se pudo cargar la bóveda: ${errorMessage(error)}`);
    } finally {
      // La primera carga ya terminó (con éxito o error): retirar el splash.
      if (initial) hideAppSplash();
      this.setBusy(false);
    }
  }

  /**
   * Sincronización silenciosa al volver a la app. No se ejecuta con un
   * diálogo abierto, para no perder lo que el usuario está editando.
   */
  private async syncFromDiskIfIdle(): Promise<void> {
    if (
      !isTauri() ||
      document.hidden ||
      this.busy ||
      this.historyActionInFlight ||
      this.diskSyncInFlight
    ) {
      return;
    }
    if (
      !this.refs.editor.hidden ||
      !this.refs.occlusionEditor.hidden ||
      !this.refs.notesSheet.hidden ||
      !this.refs.settingsSheet.hidden ||
      !this.refs.drawer.hidden
    ) {
      return;
    }
    if (Date.now() - this.lastDiskSyncAt < 1800) return;

    this.diskSyncInFlight = true;
    // Bloquea repasos/ediciones mientras se reemplaza la bóveda: de lo
    // contrario una tarjeta calificada a medias podría guardarse sobre la
    // versión antigua y pisar los cambios que acaban de llegar del escritorio.
    this.setBusy(true);
    try {
      await this.vault.flushPendingFileOperations();
      const snapshot = await this.loadVault(this.vault.getActiveRootPath());
      this.lastDiskSyncAt = Date.now();
      if (JSON.stringify(snapshot.pages) === JSON.stringify(this.pages)) return;

      const activeCardId = this.manager.getCurrentCard()?.id || null;
      const wasRevealed = this.manager.isRevealed();
      await this.reviewProgress.load(true);
      this.applySnapshot(snapshot);
      if (activeCardId) {
        const refreshed = this.manager.refreshCard(
          this.pages,
          activeCardId,
          "new-first",
          wasRevealed
        );
        if (!refreshed) this.manager.scanVault(this.pages, "new-first");
      }
      this.render();
      this.showToast("Bóveda actualizada con los últimos cambios.");
    } catch (error) {
      console.warn("No se pudo sincronizar la bóveda móvil desde disco:", error);
    } finally {
      this.diskSyncInFlight = false;
      this.setBusy(false);
    }
  }

  private async loadVault(rootPath: string | null | undefined): Promise<VaultSnapshot> {
    if (!isTauri()) {
      return {
        rootPath: "local",
        vaultName: "Vault local",
        pages: clonePages(this.vault.getPages()),
      };
    }

    const requested = rootPath === undefined ? this.vault.getActiveRootPath() : rootPath;
    const snapshot = await invoke<VaultSnapshot>("load_vault", { rootPath: requested ?? null });

    // Primera ejecución de la APK: el vault interno está vacío. Se siembran las
    // notas de ejemplo para que el repaso tenga tarjetas y el usuario pueda
    // probar FSRS, cloze y oclusiones sin depender del escritorio.
    if (snapshot.pages.length === 0 && !requested) {
      const seeded = clonePages(initialVaultPages);
      const root = snapshot.rootPath.replace(/[\\/]+$/, "");
      seeded.forEach((page) => {
        if (!page.path.startsWith(snapshot.rootPath)) {
          page.path = `${root}/${page.path.replace(/^[\\/]+/, "")}`;
        }
      });
      this.vault.replaceVault(seeded, snapshot.rootPath, snapshot.vaultName);
      await Promise.all(seeded.map((page) => this.vault.savePage(page, true)));
      return { ...snapshot, pages: seeded };
    }

    return snapshot;
  }

  private applySnapshot(
    snapshot: VaultSnapshot,
    preserve?: { cardId: string; revealed: boolean }
  ): void {
    this.hideVaultGate();
    this.pages = snapshot.pages;
    this.vault.replaceVault(snapshot.pages, snapshot.rootPath, snapshot.vaultName);
    this.history.clearAll();
    this.historySeeded.clear();
    this.manager.setPageFilter(this.readStoredPageFilter());
    this.manager.scanVault(this.pages, "new-first", preserve);
    this.reconcilePageFilter();
    this.refs.vaultName.textContent = snapshot.vaultName;
    this.refs.vaultButton.title = snapshot.rootPath;
    this.refs.vaultButton.setAttribute("aria-label", `Bóveda actual: ${snapshot.vaultName}`);
    this.updateFilterIndicator();
    this.updateHistoryButtons();
    if (snapshot.skipped && snapshot.skipped.length > 0) {
      this.showToast(`Se omitieron ${snapshot.skipped.length} notas (errores de lectura/permisos/tamaño).`);
    }
  }

  private readStoredPageFilter(): string[] | null {
    try {
      const stored = localStorage.getItem(FLASHCARD_PAGES_STORAGE_KEY);
      if (!stored) return null;
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) return null;
      return parsed.filter((value): value is string => typeof value === "string");
    } catch {
      return null;
    }
  }

  private writeStoredPageFilter(filter: string[] | null): void {
    try {
      localStorage.setItem(FLASHCARD_PAGES_STORAGE_KEY, JSON.stringify(filter));
    } catch {
      // El filtro sigue activo aunque el WebView no permita persistirlo.
    }
  }

  /** Descarta del filtro notas que ya no existen o no tienen tarjetas, y
   * resuelve alias de separador (`::`) al título exacto que hay en la bóveda. */
  private reconcilePageFilter(): void {
    const current = this.manager.getPageFilter();
    if (current === null) return;
    const pageByNormalizedTitle = new Map(
      this.manager
        .getPagesWithCards()
        .map((title) => [normalizeDeckTitle(title).toLowerCase(), title])
    );
    const valid = [
      ...new Set(
        current
          .map((title) =>
            pageByNormalizedTitle.get(normalizeDeckTitle(title).toLowerCase())
          )
          .filter((title): title is string => Boolean(title))
      ),
    ];
    if (sameStringArray(current, valid)) return;
    const next = current.length > 0 && valid.length === 0 ? null : valid;
    this.manager.setPageFilter(next);
    this.manager.scanVault(this.pages, "new-first");
    this.writeStoredPageFilter(next);
  }

  private updateFilterIndicator(): void {
    const filter = this.manager.getPageFilter();
    const active = filter !== null;
    this.refs.notesButton.classList.toggle("is-active", active);
    this.refs.notesBadge.hidden = !active;
    this.refs.notesBadge.textContent = active ? String(filter.length) : "";
    if (!active) {
      this.refs.notesButton.setAttribute("aria-label", "Seleccionar notas para repasar");
      this.refs.notesButton.title = "Seleccionar notas";
    } else if (filter.length === 0) {
      this.refs.notesButton.setAttribute("aria-label", "Ninguna nota seleccionada");
      this.refs.notesButton.title = "Ninguna nota seleccionada";
    } else {
      const label = `${filter.length} ${filter.length === 1 ? "nota seleccionada" : "notas seleccionadas"}`;
      this.refs.notesButton.setAttribute("aria-label", label);
      this.refs.notesButton.title = label;
    }
  }

  private openNotes(): void {
    if (this.busy) return;
    const pages = this.manager.getPagesWithCards();
    const active = this.manager.getPageFilter();
    this.notesDraft = new Map(
      pages.map((title) => [title, active === null || active.includes(title)])
    );
    this.notesSearch = "";
    this.notesCurrentPage = 1;
    this.refs.notesSearchInput.value = "";
    this.renderNotesList({ resetScroll: true });
    this.refs.notesSheet.hidden = false;
    this.syncOverlayState();
  }

  private closeNotes(): void {
    // Invalida los lotes de render pendientes si se cierra a mitad de página.
    this.notesRenderToken++;
    this.refs.notesSheet.hidden = true;
    this.syncOverlayState();
  }

  private setAllNotesSelected(selected: boolean): void {
    this.manager.getPagesWithCards().forEach((title) => {
      this.notesDraft.set(title, selected);
    });
    this.renderNotesList();
  }

  /** Marca un mazo completo, incluidos todos sus mazos y notas hijas. */
  private setDeckSelected(node: DeckNode, selected: boolean): void {
    for (const title of collectDeckPageTitles(node)) {
      this.notesDraft.set(title, selected);
    }
    this.renderNotesList();
  }

  private renderNotesList(options: { resetScroll?: boolean } = {}): void {
    // Cada render invalida los lotes del anterior. Con cientos de notas, añadir
    // todas las filas de golpe bloqueaba el WebView y el modal parecía colapsar.
    const renderToken = ++this.notesRenderToken;
    const previousScroll = this.refs.notesList.scrollTop;
    const pages = this.manager.getPagesWithCards();

    const tree = buildDeckTree(pages, {
      cardCount: (title) => this.manager.getCardCountForPage(title),
    });
    const search = searchDeckTree(tree, this.notesSearch);
    const visibleRoots = visibleDeckRoots(tree, search);

    // Se pagina por mazos raíz completos; al expandir uno, sus hijos bajan con
    // él y nunca quedan separados entre dos páginas.
    const page = paginateNotes(visibleRoots, this.notesCurrentPage);
    this.notesCurrentPage = page.currentPage;
    this.notesTotalPages = page.totalPages;

    this.refs.notesPagination.hidden = page.totalPages <= 1;
    this.refs.notesPrevButton.disabled = page.currentPage <= 1;
    this.refs.notesNextButton.disabled = page.currentPage >= page.totalPages;
    this.refs.notesPageInfo.textContent = `Página ${page.currentPage} de ${page.totalPages}`;

    this.refs.notesList.replaceChildren();
    if (options.resetScroll) this.refs.notesList.scrollTop = 0;
    if (pages.length === 0) {
      this.refs.notesPagination.hidden = true;
      const empty = document.createElement("p");
      empty.className = "mobile-notes-empty";
      empty.textContent = "No hay notas con tarjetas en esta bóveda.";
      this.refs.notesList.appendChild(empty);
      return;
    }
    if (visibleRoots.length === 0) {
      this.refs.notesPagination.hidden = true;
      const empty = document.createElement("p");
      empty.className = "mobile-notes-empty";
      empty.textContent = "Ningún mazo ni nota coincide con la búsqueda.";
      this.refs.notesList.appendChild(empty);
      return;
    }

    const rows = flattenDeckRows(page.items, search, (nodeId) =>
      this.notesCollapsed.has(nodeId)
    );

    // Carga escalonada: la página se pinta en lotes pequeños por fotograma.
    const appendChunk = (startIndex: number): void => {
      if (renderToken !== this.notesRenderToken) return;
      const end = Math.min(startIndex + NOTES_RENDER_CHUNK, rows.length);
      for (let index = startIndex; index < end; index++) {
        const row = rows[index];
        this.appendDeckRow(row.node, row.depth, search.matched.has(row.node.id));
      }
      if (end < rows.length) {
        window.requestAnimationFrame(() => appendChunk(end));
      } else if (!options.resetScroll) {
        // Mantiene la posición al marcar una casilla o contraer un mazo.
        this.refs.notesList.scrollTop = previousScroll;
      }
    };
    appendChunk(0);
  }

  private appendDeckRow(node: DeckNode, depth: number, matchedBySearch: boolean): void {
    const row = document.createElement("div");
    row.className = "mobile-deck-row";
    row.classList.toggle("is-search-match", matchedBySearch);
    row.style.setProperty("--deck-depth", String(depth));
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-level", String(depth + 1));
    row.title = node.path.join(DECK_SEPARATOR);

    if (node.children.length > 0) {
      const collapsed = this.notesCollapsed.has(node.id);
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "mobile-deck-toggle";
      toggle.setAttribute("aria-label", collapsed ? "Expandir mazo" : "Contraer mazo");
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.textContent = collapsed ? "▸" : "▾";
      toggle.addEventListener("click", () => {
        if (this.notesCollapsed.has(node.id)) this.notesCollapsed.delete(node.id);
        else this.notesCollapsed.add(node.id);
        this.renderNotesList();
      });
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "mobile-deck-toggle is-placeholder";
      spacer.setAttribute("aria-hidden", "true");
      row.appendChild(spacer);
    }

    const label = document.createElement("label");
    label.className = "mobile-deck-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const state = getDeckSelectionState(
      node,
      (title) => this.notesDraft.get(title) ?? false
    );
    checkbox.checked = state === "checked";
    checkbox.indeterminate = state === "indeterminate";
    checkbox.setAttribute("aria-label", node.path.join(DECK_SEPARATOR));
    checkbox.addEventListener("change", () => {
      this.setDeckSelected(node, checkbox.checked);
    });
    label.appendChild(checkbox);

    const name = document.createElement("span");
    name.className = "mobile-deck-name";
    name.textContent = node.name;
    label.appendChild(name);
    row.appendChild(label);

    const detail = document.createElement("small");
    detail.className = "mobile-deck-count";
    detail.textContent =
      node.totalPageCount > 1
        ? `${node.totalCardCount} tarjetas · ${node.totalPageCount} notas`
        : `${node.totalCardCount} ${node.totalCardCount === 1 ? "tarjeta" : "tarjetas"}`;
    row.appendChild(detail);

    this.refs.notesList.appendChild(row);
  }

  private applyNotesSelection(): void {
    const pages = this.manager.getPagesWithCards();
    const selected = pages.filter((title) => this.notesDraft.get(title) ?? false);
    const filter = pages.length === 0 || selected.length === pages.length ? null : selected;
    this.manager.setPageFilter(filter);
    this.manager.scanVault(this.pages, "new-first");
    this.writeStoredPageFilter(filter);
    this.closeNotes();
    this.render();
    this.updateFilterIndicator();
    this.showToast(
      filter === null
        ? "Repasando todas las notas"
        : selected.length === 0
          ? "Ninguna nota seleccionada"
          : `Repasando ${selected.length} ${selected.length === 1 ? "nota" : "notas"}`
    );
  }

  private async pickVault(): Promise<void> {
    if (!isTauri()) {
      this.showToast("Abrir otra bóveda solo está disponible en la aplicación.");
      return;
    }
    this.setBusy(true);
    try {
      const picked = await invoke<string | null>("pick_vault_root");
      if (!picked) {
        this.setBusy(false);
        return;
      }
      await this.loadAndApply(picked, "Bóveda abierta");
    } catch (error) {
      console.error("No se pudo abrir el selector de bóvedas:", error);
      this.showToast("No se pudo abrir otra bóveda. Selecciona una carpeta con permiso de acceso.");
      this.setBusy(false);
    }
  }

  private reveal(): void {
    if (this.busy || this.historyActionInFlight) return;
    const card = this.manager.getCurrentCard();
    if (!card || this.manager.isRevealed()) return;
    this.manager.reveal();
    this.render();
  }

  private async rate(rating: FSRSRating): Promise<void> {
    if (this.busy || this.historyActionInFlight) return;
    if (!this.manager.isRevealed()) return;
    const card = this.manager.getCurrentCard();
    if (!card) return;

    // En modo Aprendizaje la tarjeta avanza, pero no se modifica su estado
    // FSRS ni su fecha de vencimiento: es una sesión de práctica sin guardar.
    const result = this.manager.rate(rating, !this.learningMode);
    if (!result) return;

    if (this.learningMode) {
      this.render();
      this.updateHistoryButtons();
      return;
    }

    const page = this.pages.find((candidate) => candidate.title === result.card.pageTitle);
    if (!page) {
      this.showToast("La nota de esta tarjeta ya no está disponible.");
      this.render();
      return;
    }
    const location = findNodeLocation(page.blocks, result.card.blockId);
    if (!location) {
      this.showToast("No se encontró el bloque de la tarjeta en la nota.");
      this.render();
      return;
    }

    const block = location.parentList[location.index];
    const previousContent = block.content;
    const before = FlashcardsManager.readScheduleSnapshot(previousContent);
    block.content = FlashcardsManager.updateBlockFSRS(
      previousContent,
      result.fsrs,
      result.intervalDays,
      result.easeFactor
    );
    const after = FlashcardsManager.readScheduleSnapshot(block.content);

    this.render();
    this.setBusy(true);
    try {
      await this.vault.savePage(page, true);
      await this.reviewProgress.record({
        pagePath: page.path,
        pageTitle: page.title,
        blockId: result.card.blockId,
        cardId: result.card.id,
        cardType: result.card.cardType,
        rating,
        before,
        after,
      });
    } catch (error) {
      block.content = previousContent;
      this.history.clearPage(page.id);
      this.history.seed(page.id, page.blocks, page.title);
      this.manager.scanVault(this.pages, "new-first");
      const refreshed = this.manager.refreshCard(this.pages, card.id, "new-first", true);
      if (!refreshed) this.manager.scanVault(this.pages, "new-first");
      this.render();
      console.error("No se pudo guardar el repaso de la tarjeta:", error);
      this.showToast("No se pudo guardar el repaso. Revisa los permisos de la bóveda.");
    } finally {
      this.setBusy(false);
      this.updateHistoryButtons();
    }
  }

  private openEditor(): void {
    if (this.busy || this.historyActionInFlight) return;
    const card = this.manager.getCurrentCard();
    if (!card) return;
    if (card.cardType === "image-occlusion") {
      this.openOcclusionEditor(card);
      return;
    }
    const page = this.pages.find((candidate) => candidate.title === card.pageTitle);
    if (!page) return;
    const location = findNodeLocation(page.blocks, card.blockId);
    if (!location) return;

    const fields = FlashcardsManager.readEditableFields(
      location.parentList[location.index].content,
      card.cardType
    );
    const isBasic = card.cardType === "basic";
    this.refs.questionField.hidden = !isBasic;
    this.refs.answerField.hidden = !isBasic;
    this.refs.textField.hidden = isBasic;
    this.refs.questionInput.value = fields.question;
    this.refs.answerInput.value = fields.answer;
    this.refs.textInput.value = fields.text;

    this.editing = {
      cardId: card.id,
      pageId: page.id,
      blockId: card.blockId,
      cardType: card.cardType,
    };
    this.refs.editor.hidden = false;
    this.root.classList.add("has-editor");
    const firstInput = this.refs.answerInput.hidden ? this.refs.questionInput : (this.refs.answerInput.disabled ? this.refs.questionInput : this.refs.answerInput);
    window.setTimeout(() => {
      firstInput.focus();
      try { firstInput.setSelectionRange(firstInput.value.length, firstInput.value.length); } catch {}
    }, 30);
  }

  private closeEditor(): void {
    this.editing = null;
    this.refs.editor.hidden = true;
    this.syncOverlayState();
  }

  private syncOverlayState(): void {
    this.root.classList.toggle(
      "has-editor",
      !this.refs.editor.hidden ||
        !this.refs.settingsSheet.hidden ||
        !this.refs.drawer.hidden ||
        !this.refs.notesSheet.hidden ||
        !this.refs.occlusionEditor.hidden
    );
  }

  private async saveEditor(): Promise<void> {
    if (!this.editing) return;
    const { cardId, pageId, blockId, cardType } = this.editing;
    const fields = {
      question: this.refs.questionInput.value,
      answer: this.refs.answerInput.value,
      text: this.refs.textInput.value,
    };

    const isBasic = cardType === "basic";
    const required = isBasic ? fields.question.trim() : fields.text.trim();
    if (!required) {
      this.showToast(isBasic ? "La pregunta no puede estar vacía." : "El texto no puede estar vacío.");
      return;
    }

    const page = this.pages.find((candidate) => candidate.id === pageId);
    if (!page) {
      this.showToast("La nota ya no está disponible.");
      return;
    }
    const location = findNodeLocation(page.blocks, blockId);
    if (!location) {
      this.showToast("No se encontró el bloque de la tarjeta.");
      return;
    }

    const block = location.parentList[location.index];
    const previousContent = block.content;
    block.content = FlashcardsManager.applyCardEdit(block.content, cardType, fields);

    this.refs.saveEditor.disabled = true;
    this.setBusy(true);
    try {
      await this.vault.savePage(page, true);
      this.history.capture(page.id, page.blocks, page.title);
      const revealed = this.manager.isRevealed();
      this.manager.refreshCard(this.pages, cardId, "new-first", revealed);
      this.closeEditor();
      this.render();
      this.showToast("Tarjeta guardada. Propiedades y nota intactas.");
    } catch (error) {
      block.content = previousContent;
      console.error("No se pudo guardar la edición de la tarjeta:", error);
      this.showToast("No se pudo guardar la tarjeta. Revisa los permisos de la bóveda.");
    } finally {
      this.refs.saveEditor.disabled = false;
      this.setBusy(false);
    }
  }

  private seedHistoryFor(page: PageData): void {
    if (this.historySeeded.has(page.id)) return;
    this.history.seed(page.id, page.blocks, page.title);
    this.historySeeded.add(page.id);
  }

  /** Página de la tarjeta visible; es la que reciben los botones deshacer/rehacer. */
  private currentHistoryPage(): PageData | null {
    const card = this.manager.getCurrentCard();
    if (!card) return null;
    return this.pages.find((page) => page.title === card.pageTitle) ?? null;
  }

  private updateHistoryButtons(): void {
    const page = this.currentHistoryPage();
    const canUndoReview = this.reviewProgress.canUndo();
    const canRedoReview = this.reviewProgress.canRedo();
    this.refs.undoButton.disabled =
      this.busy ||
      this.historyActionInFlight ||
      (!canUndoReview && (!page || !this.history.canUndo(page.id)));
    this.refs.redoButton.disabled =
      this.busy ||
      this.historyActionInFlight ||
      (!canRedoReview && (!page || !this.history.canRedo(page.id)));
    this.refs.undoButton.title = canUndoReview
      ? "Deshacer último repaso"
      : "Deshacer cambio";
    this.refs.undoButton.setAttribute(
      "aria-label",
      canUndoReview ? "Deshacer último repaso" : "Deshacer cambio"
    );
    this.refs.redoButton.title = canRedoReview ? "Rehacer repaso" : "Rehacer cambio";
    this.refs.redoButton.setAttribute(
      "aria-label",
      canRedoReview ? "Rehacer repaso" : "Rehacer cambio"
    );
  }

  private locateReviewBlock(event: ReviewProgressEvent): { page: PageData; block: BlockNode } | null {
    const page =
      this.pages.find((candidate) => candidate.path === event.pagePath) ||
      this.pages.find((candidate) => candidate.title === event.pageTitle);
    if (!page) return null;
    const location = findNodeLocation(page.blocks, event.blockId);
    if (!location) return null;
    return { page, block: location.parentList[location.index] };
  }

  private async applyReviewSnapshot(
    event: ReviewProgressEvent,
    direction: "undo" | "redo"
  ): Promise<boolean> {
    const target = this.locateReviewBlock(event);
    if (!target) {
      this.showToast("No se encontró la tarjeta del último repaso.");
      return false;
    }
    const expected = direction === "undo" ? event.after : event.before;
    const next = direction === "undo" ? event.before : event.after;
    const current = FlashcardsManager.readScheduleSnapshot(target.block.content);
    if (!FlashcardsManager.scheduleSnapshotsEqual(current, expected)) {
      this.showToast(
        "La tarjeta cambió en otro dispositivo o nota; no se puede aplicar ese repaso."
      );
      return false;
    }

    const previousContent = target.block.content;
    target.block.content = FlashcardsManager.applyScheduleSnapshot(target.block.content, next);
    try {
      await this.vault.savePage(target.page, true);
      this.history.clearPage(target.page.id);
      this.history.seed(target.page.id, target.page.blocks, target.page.title);
      this.historySeeded.add(target.page.id);
      return true;
    } catch (error) {
      target.block.content = previousContent;
      console.error("No se pudo guardar el cambio de repaso:", error);
      this.showToast("No se pudo guardar el cambio de repaso.");
      return false;
    }
  }

  private async undo(): Promise<void> {
    if (this.busy || this.historyActionInFlight) return;
    this.historyActionInFlight = true;
    this.updateHistoryButtons();
    try {
      if (await this.undoLastReview()) return;
      const page = this.currentHistoryPage();
      if (!page) return;
      const entry = this.history.undo(page.id, page.blocks, page.title);
      if (!entry) return;
      await this.applyHistoryEntry(page, entry, "Cambio deshecho.");
    } finally {
      this.historyActionInFlight = false;
      this.updateHistoryButtons();
    }
  }

  private async redo(): Promise<void> {
    if (this.busy || this.historyActionInFlight) return;
    this.historyActionInFlight = true;
    this.updateHistoryButtons();
    try {
      if (await this.redoLastReview()) return;
      const page = this.currentHistoryPage();
      if (!page) return;
      const entry = this.history.redo(page.id, page.blocks, page.title);
      if (!entry) return;
      await this.applyHistoryEntry(page, entry, "Cambio rehecho.");
    } finally {
      this.historyActionInFlight = false;
      this.updateHistoryButtons();
    }
  }

  private async undoLastReview(): Promise<boolean> {
    const event = this.reviewProgress.takeUndo();
    if (!event) {
      this.updateHistoryButtons();
      return false;
    }
    const applied = await this.applyReviewSnapshot(event, "undo");
    if (!applied) {
      this.reviewProgress.restoreUndo(event);
      this.updateHistoryButtons();
      return true;
    }
    await this.reviewProgress.commitUndo(event);
    const target = this.locateReviewBlock(event);
    const refreshed = target
      ? this.manager.refreshCardSchedule(
          event.cardId,
          target.block.content,
          "new-first",
          event.cardId,
          false
        )
      : null;
    if (!refreshed) {
      this.manager.scanVault(this.pages, "new-first");
      this.manager.refreshCard(this.pages, event.cardId, "new-first", false);
    }
    this.render();
    this.updateHistoryButtons();
    this.showToast("Último repaso deshecho.");
    return true;
  }

  private async redoLastReview(): Promise<boolean> {
    const event = this.reviewProgress.takeRedo();
    if (!event) {
      this.updateHistoryButtons();
      return false;
    }
    const applied = await this.applyReviewSnapshot(event, "redo");
    if (!applied) {
      this.reviewProgress.restoreRedo(event);
      this.updateHistoryButtons();
      return true;
    }
    await this.reviewProgress.commitRedo(event);
    const target = this.locateReviewBlock(event);
    const refreshed = target
      ? this.manager.refreshCardSchedule(
          event.cardId,
          target.block.content,
          "new-first",
          event.cardId,
          false
        )
      : null;
    if (!refreshed) {
      this.manager.scanVault(this.pages, "new-first");
      this.manager.refreshCard(this.pages, event.cardId, "new-first", false);
    }
    this.render();
    this.updateHistoryButtons();
    this.showToast("Repaso rehecho.");
    return true;
  }

  private async applyHistoryEntry(
    page: PageData,
    entry: DocumentHistoryEntry,
    message: string
  ): Promise<void> {
    const card = this.manager.getCurrentCard();
    const cardId = card?.id;
    const revealed = this.manager.isRevealed();
    const previousBlocks = page.blocks;
    const previousTitle = page.title;
    page.blocks = entry.blocks;
    page.title = entry.title;

    this.setBusy(true);
    try {
      await this.vault.savePage(page, true);
      this.history.markApplied(page.id, page.blocks, page.title);
      if (cardId) {
        this.manager.refreshCard(this.pages, cardId, "new-first", revealed);
      } else {
        this.manager.scanVault(this.pages, "new-first");
      }
      this.render();
      this.showToast(message);
    } catch (error) {
      page.blocks = previousBlocks;
      page.title = previousTitle;
      // El guardado falló: se descarta el historial de esta nota para no dejar
      // pilas de deshacer/rehacer desincronizadas con el contenido real.
      this.history.clearPage(page.id);
      this.history.seed(page.id, page.blocks, page.title);
      console.error("No se pudo restaurar el historial de la nota:", error);
      this.showToast("No se pudo guardar el cambio en la bóveda.");
    } finally {
      this.setBusy(false);
    }
  }

  private readStoredTheme(): MobileTheme | null {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      // Algunos WebViews pueden bloquear localStorage.
    }
    return null;
  }

  private systemTheme(): MobileTheme {
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  private applyTheme(theme: MobileTheme, persist = true): void {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    if (persist) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // El cambio visual sigue funcionando aunque no se pueda persistir.
      }
    }
    this.refs.themeOptions
      .querySelectorAll<HTMLButtonElement>("[data-theme-option]")
      .forEach((button) => {
        const selected = button.dataset.themeOption === theme;
        button.setAttribute("aria-pressed", String(selected));
        button.classList.toggle("is-active", selected);
      });
  }

  private readStoredAccent(): AccentColor {
    try {
      const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
      if (isAccentColor(stored)) return stored;
    } catch {
      // Algunos WebViews pueden bloquear localStorage; se usa el color por defecto.
    }
    return DEFAULT_ACCENT;
  }

  private applyAccent(accent: AccentColor, persist = true): void {
    this.accent = accent;
    document.documentElement.setAttribute("data-accent", accent);
    if (persist) {
      try {
        localStorage.setItem(ACCENT_STORAGE_KEY, accent);
      } catch {
        // El cambio visual sigue funcionando aunque no se pueda persistir.
      }
    }
    this.refs.accentGrid
      .querySelectorAll<HTMLButtonElement>("[data-accent-option]")
      .forEach((button) => {
        const selected = button.dataset.accentOption === accent;
        button.setAttribute("aria-pressed", String(selected));
        button.classList.toggle("is-active", selected);
      });
  }

  private applyStoredFontSizes(): void {
    const sizes = readFontSizes();
    applyFontSizes(sizes);
    this.refs.fontSizeInput.value = String(sizes.ui);
    this.refs.fontSizeValue.value = `${sizes.ui} px`;
  }

  private readStoredLearningMode(): boolean {
    try {
      return localStorage.getItem(LEARNING_MODE_STORAGE_KEY) === "true";
    } catch {
      // Si el WebView bloquea localStorage, el modo sigue funcionando en memoria.
      return false;
    }
  }

  private setLearningMode(active: boolean): void {
    this.learningMode = active;
    try {
      localStorage.setItem(LEARNING_MODE_STORAGE_KEY, String(active));
    } catch {
      // El cambio de modo sigue funcionando aunque no se pueda persistir.
    }

    // Al activar el modo, la cola se reinicia con todas las tarjetas (no solo
    // las vencidas). Al desactivarlo también se reinicia con todas para poder
    // repasar de verdad, en esta misma sesión, lo que se acaba de practicar.
    // Los escaneos posteriores vuelven a la cola normal de vencidas.
    this.manager.setIncludeAllCards(active);
    this.manager.restartWithAllCards();

    this.updateLearningSwitch();
    this.render();
    this.showToast(
      translate(
        active
          ? "Modo aprendizaje activado: los repasos no se guardan."
          : "Modo aprendizaje desactivado: los repasos se guardan."
      )
    );
  }

  private updateLearningSwitch(): void {
    const label = translate("Aprendizaje");
    const detail = translate("Repasa sin guardar el progreso FSRS");
    this.refs.learningToggle.setAttribute("aria-checked", String(this.learningMode));
    this.refs.learningToggle.setAttribute("aria-label", label);
    this.refs.learningToggle.classList.toggle("is-active", this.learningMode);
    const strong = this.refs.learningToggle.querySelector("strong");
    const small = this.refs.learningToggle.querySelector("small");
    if (strong) strong.textContent = label;
    if (small) small.textContent = detail;
    this.root.classList.toggle("is-learning-mode", this.learningMode);
  }

  private updateLanguageButtons(): void {
    const preference = currentLanguagePreference();
    this.refs.settingsSheet
      .querySelectorAll<HTMLButtonElement>("[data-action='set-lang']")
      .forEach((button) => {
        const selected = button.dataset.lang === preference;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
  }

  private openDrawer(): void {
    if (this.busy) return;
    this.refs.drawer.hidden = false;
    this.root
      .querySelector<HTMLElement>("[data-action='menu']")
      ?.setAttribute("aria-expanded", "true");
    this.syncOverlayState();
    window.setTimeout(() => this.refs.learningToggle.focus(), 30);
  }

  private closeDrawer(): void {
    this.refs.drawer.hidden = true;
    this.root
      .querySelector<HTMLElement>("[data-action='menu']")
      ?.setAttribute("aria-expanded", "false");
    this.syncOverlayState();
  }

  private openSettings(): void {
    this.closeDrawer();
    this.applyStoredFontSizes();
    this.updateLanguageButtons();
    this.refs.settingsSheet.hidden = false;
    this.syncOverlayState();
    const selected = this.refs.accentGrid.querySelector<HTMLButtonElement>(
      `[data-accent-option="${this.accent}"]`
    );
    window.setTimeout(() => selected?.focus(), 30);
  }

  private closeSettings(): void {
    this.refs.settingsSheet.hidden = true;
    this.syncOverlayState();
  }

  private openOcclusionEditor(card: Flashcard): void {
    if (!card.imageOcclusion) {
      this.showToast("Esta tarjeta de imagen no tiene una oclusión editable.");
      return;
    }
    const page = this.pages.find((candidate) => candidate.title === card.pageTitle);
    if (!page) return;
    const location = findNodeLocation(page.blocks, card.blockId);
    if (!location) {
      this.showToast("No se encontró el bloque de la tarjeta.");
      return;
    }

    const sourceRegions = card.imageOcclusions?.length
      ? card.imageOcclusions
      : [card.imageOcclusion];
    let regionIndex = sourceRegions.indexOf(card.imageOcclusion);
    if (regionIndex < 0) {
      regionIndex = sourceRegions.findIndex(
        (region) => JSON.stringify(region) === JSON.stringify(card.imageOcclusion)
      );
    }
    if (regionIndex < 0) regionIndex = 0;

    const current = cloneOcclusionRegion(sourceRegions[regionIndex] ?? card.imageOcclusion);
    const regions = sourceRegions.map(cloneOcclusionRegion);

    this.occlusionEditing = {
      cardId: card.id,
      pageId: page.id,
      blockId: card.blockId,
      regionIndex,
      current,
      draft: cloneOcclusionRegion(current),
      regions,
    };

    const image = this.refs.occlusionImage;
    image.onload = null;
    image.onerror = null;
    image.removeAttribute("src");
    this.refs.occlusionStage.classList.remove("has-error");
    this.refs.occlusionMasks.replaceChildren();

    this.refs.occlusionEditor.hidden = false;
    this.syncOverlayState();
    this.renderOcclusionEditor();

    image.onload = () => {
      if (!this.occlusionEditing || this.occlusionEditing.cardId !== card.id) return;
      this.renderOcclusionEditor();
      this.refs.occlusionHandle.focus();
    };
    image.onerror = () => {
      if (!this.occlusionEditing || this.occlusionEditing.cardId !== card.id) return;
      this.showToast("No se pudo cargar la imagen para editar la oclusión.");
      this.closeOcclusionEditor();
    };

    void this.resolveImageUrl(card.imageSource || current.source)
      .then((url) => {
        if (!this.occlusionEditing || this.occlusionEditing.cardId !== card.id) return;
        if (!url) {
          this.showToast("No se pudo cargar la imagen para editar la oclusión.");
          this.closeOcclusionEditor();
          return;
        }
        image.src = url;
      })
      .catch((error: unknown) => {
        if (!this.occlusionEditing || this.occlusionEditing.cardId !== card.id) return;
        console.error("No se pudo resolver la imagen de la oclusión:", error);
        this.showToast("No se pudo cargar la imagen para editar la oclusión.");
        this.closeOcclusionEditor();
      });
  }

  private renderOcclusionEditor(): void {
    const context = this.occlusionEditing;
    if (!context) return;

    const image = this.refs.occlusionImage;
    const displayRegions = context.regions.map((region, index) =>
      index === context.regionIndex ? context.draft : region
    );

    this.refs.occlusionMasks.replaceChildren();
    if (image.complete && image.naturalWidth > 0 && image.clientWidth > 0) {
      appendOcclusionMasks(
        this.refs.occlusionMasks,
        displayRegions,
        image,
        "image-occlusion-mask",
        context.draft
      );
    }

    const { x, y, width, height } = context.draft;
    const handle = this.refs.occlusionHandle;
    handle.style.left = `${x * 100}%`;
    handle.style.top = `${y * 100}%`;
    handle.style.width = `${width * 100}%`;
    handle.style.height = `${height * 100}%`;
    const description = `${Math.round(x * 100)}% de izquierda, ${Math.round(y * 100)}% desde arriba, ${Math.round(width * 100)}% × ${Math.round(height * 100)}%`;
    this.refs.occlusionCoords.textContent = description;
    handle.setAttribute("aria-valuetext", description);
  }

  private startOcclusionDrag(event: PointerEvent, mode: OcclusionDragState["mode"]): void {
    if (!this.occlusionEditing) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = this.refs.occlusionStage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    event.preventDefault();
    event.stopPropagation();
    this.occlusionDrag = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      stageWidth: rect.width,
      stageHeight: rect.height,
      region: cloneOcclusionRegion(this.occlusionEditing.draft),
    };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // Si el navegador no soporta captura, los listeners globales siguen sirviendo.
    }
    document.addEventListener("pointermove", this.onOcclusionPointerMove, { passive: false });
    document.addEventListener("pointerup", this.onOcclusionPointerUp);
    document.addEventListener("pointercancel", this.onOcclusionPointerUp);
  }

  private readonly onOcclusionPointerMove = (event: PointerEvent): void => {
    const drag = this.occlusionDrag;
    const context = this.occlusionEditing;
    if (!drag || !context || event.pointerId !== drag.pointerId) return;
    event.preventDefault();

    const dx = (event.clientX - drag.startX) / drag.stageWidth;
    const dy = (event.clientY - drag.startY) / drag.stageHeight;
    const start = drag.region;

    if (drag.mode === "resize") {
      const width = Math.min(1 - start.x, Math.max(0.02, start.width + dx));
      const height = Math.min(1 - start.y, Math.max(0.02, start.height + dy));
      const scaleX = start.width > 0 ? width / start.width : 1;
      const scaleY = start.height > 0 ? height / start.height : 1;
      context.draft = clampImageOcclusionRegion({
        ...start,
        width,
        height,
        points: start.points?.map((point) => ({
          x: start.x + (point.x - start.x) * scaleX,
          y: start.y + (point.y - start.y) * scaleY,
        })),
      });
    } else {
      const x = Math.min(1 - start.width, Math.max(0, start.x + dx));
      const y = Math.min(1 - start.height, Math.max(0, start.y + dy));
      const actualDx = x - start.x;
      const actualDy = y - start.y;
      context.draft = clampImageOcclusionRegion({
        ...start,
        x,
        y,
        points: start.points?.map((point) => ({
          x: Math.min(1, Math.max(0, point.x + actualDx)),
          y: Math.min(1, Math.max(0, point.y + actualDy)),
        })),
      });
    }
    this.renderOcclusionEditor();
  };

  private readonly onOcclusionPointerUp = (): void => {
    this.occlusionDrag = null;
    document.removeEventListener("pointermove", this.onOcclusionPointerMove);
    document.removeEventListener("pointerup", this.onOcclusionPointerUp);
    document.removeEventListener("pointercancel", this.onOcclusionPointerUp);
  };

  private nudgeOcclusionFromKeyboard(event: KeyboardEvent): void {
    const context = this.occlusionEditing;
    if (!context || !event.key.startsWith("Arrow")) return;
    const step = event.shiftKey ? 0.02 : 0.01;
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if (dx === 0 && dy === 0) return;
    event.preventDefault();

    const start = context.draft;
    const x = Math.min(1 - start.width, Math.max(0, start.x + dx));
    const y = Math.min(1 - start.height, Math.max(0, start.y + dy));
    const actualDx = x - start.x;
    const actualDy = y - start.y;
    context.draft = clampImageOcclusionRegion({
      ...start,
      x,
      y,
      points: start.points?.map((point) => ({
        x: Math.min(1, Math.max(0, point.x + actualDx)),
        y: Math.min(1, Math.max(0, point.y + actualDy)),
      })),
    });
    this.renderOcclusionEditor();
  }

  private async saveOcclusionEditor(): Promise<void> {
    const context = this.occlusionEditing;
    if (!context) return;
    const page = this.pages.find((candidate) => candidate.id === context.pageId);
    if (!page) {
      this.showToast("La nota ya no está disponible.");
      return;
    }
    const location = findNodeLocation(page.blocks, context.blockId);
    if (!location) {
      this.showToast("No se encontró el bloque de la tarjeta.");
      return;
    }

    const block = location.parentList[location.index];
    const previousContent = block.content;
    const updatedContent = updateImageOcclusionInContent(
      block.content,
      context.current,
      context.draft,
      context.regionIndex
    );
    if (updatedContent === block.content) {
      if (JSON.stringify(context.current) === JSON.stringify(context.draft)) {
        this.closeOcclusionEditor();
        this.showToast("La oclusión no cambió.");
      } else {
        this.showToast("No se pudo actualizar la oclusión del bloque.");
      }
      return;
    }
    block.content = updatedContent;

    this.refs.saveOcclusion.disabled = true;
    this.setBusy(true);
    try {
      await this.vault.savePage(page, true);
      this.history.capture(page.id, page.blocks, page.title);
      const revealed = this.manager.isRevealed();
      this.manager.refreshCard(this.pages, context.cardId, "new-first", revealed);
      this.closeOcclusionEditor();
      this.render();
      this.showToast("Oclusión guardada. Propiedades y nota intactas.");
    } catch (error) {
      block.content = previousContent;
      console.error("No se pudo guardar la oclusión:", error);
      this.showToast("No se pudo guardar la oclusión. Revisa los permisos de la bóveda.");
    } finally {
      this.refs.saveOcclusion.disabled = false;
      this.setBusy(false);
    }
  }

  private closeOcclusionEditor(): void {
    this.onOcclusionPointerUp();
    this.occlusionEditing = null;
    this.occlusionDrag = null;
    this.refs.occlusionImage.onload = null;
    this.refs.occlusionImage.onerror = null;
    this.refs.occlusionImage.removeAttribute("src");
    this.refs.occlusionMasks.replaceChildren();
    this.refs.occlusionEditor.hidden = true;
    this.refs.occlusionStage.classList.remove("has-error");
    this.syncOverlayState();
  }

  private render(): void {
    const total = this.manager.getCardsCount();
    const index = this.manager.getCurrentIndex();
    const card = this.manager.getCurrentCard();
    const revealed = this.manager.isRevealed();

    this.refs.card.classList.toggle("is-revealed", revealed);
    this.refs.card.classList.toggle("is-cloze", card?.cardType === "cloze");
    this.refs.card.classList.toggle("is-basic", card?.cardType === "basic");
    this.refs.question.replaceChildren();
    this.refs.question.hidden = false;
    this.refs.answer.replaceChildren();
    this.refs.answer.hidden = true;
    this.refs.empty.hidden = true;
    this.refs.ratings.hidden = true;
    this.refs.reveal.hidden = false;
    this.refs.edit.hidden = true;
    this.refs.type.hidden = false;
    this.refs.source.hidden = false;
    this.refs.fsrs.hidden = false;
    const historyPage = this.currentHistoryPage();
    const currentCard = this.manager.getCurrentCard();
    if (historyPage) {
      if (this.lastHistoryPageId !== historyPage.id || this.lastHistoryCardId !== (currentCard?.id || null)) {
        this.history.clearPage(historyPage.id);
        this.historySeeded.delete(historyPage.id);
        this.lastHistoryPageId = historyPage.id;
        this.lastHistoryCardId = currentCard?.id || null;
      }
      this.seedHistoryFor(historyPage);
    } else {
      this.lastHistoryCardId = null;
    }
    this.updateHistoryButtons();

    if (!card) {
      const filter = this.manager.getPageFilter();
      if (filter && filter.length === 0) {
        this.showEmpty(
          "Sin notas seleccionadas",
          "Abre el selector de notas con el botón ☰ y elige qué quieres repasar."
        );
      } else {
        this.showEmpty(
          "Todo al día",
          this.manager.getAllCardsCount() === 0
            ? "No hay tarjetas en esta bóveda. Abre otra carpeta para repasar sus notas."
            : "No hay tarjetas pendientes. Vuelve más tarde o actualiza la bóveda."
        );
      }
      return;
    }

    const progress = total > 0 ? ((index) / total) * 100 : 0;
    this.refs.counter.textContent = `${index + 1} / ${total}`;
    this.refs.progress.style.width = `${progress}%`;
    this.refs.progress.parentElement?.setAttribute("aria-valuenow", String(Math.round(progress)));
    this.refs.type.textContent = card.cardType === "image-occlusion"
      ? "IMAGEN"
      : card.cardType === "cloze"
        ? "CLOZE"
        : "BÁSICA";
    this.refs.source.textContent = card.pageTitle;
    this.refs.fsrs.textContent = this.learningMode
      ? translate("Aprendizaje · sin guardar")
      : `S ${card.fsrs.stability}d · D ${card.fsrs.difficulty} · ${card.fsrs.reps} reps`;

    if (card.cardType === "image-occlusion") {
      this.refs.question.appendChild(this.createImagePreview(card, revealed));
    } else if (card.cardType === "cloze" && revealed) {
      // En cloze la respuesta ya contiene el texto completo con los huecos
      // resueltos; mostrar también la pregunta duplicaría la tarjeta.
      this.refs.question.hidden = true;
      this.refs.answer.innerHTML = sanitizeHtml(card.answer);
      this.refs.answer.hidden = false;
    } else {
      this.refs.question.innerHTML = sanitizeHtml(card.question);
      if (revealed) {
        this.refs.answer.innerHTML = sanitizeHtml(card.answer);
        this.refs.answer.hidden = false;
      }
    }

    this.refs.edit.hidden = false;
    this.refs.edit.textContent = card.cardType === "image-occlusion"
      ? "Editar oclusión"
      : "Editar tarjeta";
    this.refs.reveal.hidden = revealed;
    this.refs.ratings.hidden = !revealed;

    const previews = this.manager.getRatingPreviews();
    if (previews) {
      this.root.querySelectorAll<HTMLElement>("[data-interval]").forEach((element) => {
        const rating = Number(element.dataset.interval) as FSRSRating;
        element.textContent = previews[rating].intervalText;
      });
    }
  }

  private showEmpty(title: string, detail: string): void {
    this.refs.empty.hidden = false;
    this.refs.emptyTitle.textContent = title;
    this.refs.emptyDetail.textContent = detail;
    this.refs.type.hidden = true;
    this.refs.source.hidden = true;
    this.refs.fsrs.hidden = true;
    this.refs.reveal.hidden = true;
    this.refs.ratings.hidden = true;
    this.refs.edit.hidden = true;
    this.refs.counter.textContent = `${this.manager.getCards().length} tarjetas`;
    this.refs.progress.style.width = "100%";
    this.refs.progress.parentElement?.setAttribute("aria-valuenow", "100");
  }

  private createImagePreview(card: Flashcard, revealed: boolean): HTMLDivElement {
    const preview = document.createElement("div");
    preview.className = "mobile-image-preview";

    const image = document.createElement("img");
    image.alt = "Imagen de la tarjeta";
    image.decoding = "async";
    preview.appendChild(image);

    const regions = card.imageOcclusions?.length
      ? card.imageOcclusions
      : card.imageOcclusion
        ? [card.imageOcclusion]
        : [];
    // En la respuesta se muestra únicamente la imagen limpia, sin máscaras ni
    // contornos: la oclusión solo tiene sentido durante la pregunta.
    const visibleMasks = revealed ? [] : regions;

    const layer = document.createElement("div");
    layer.className = "mobile-image-mask-layer";
    preview.appendChild(layer);

    image.addEventListener("load", () => {
      layer.replaceChildren();
      if (visibleMasks.length > 0) {
        appendOcclusionMasks(
          layer,
          visibleMasks,
          image,
          "image-occlusion-mask",
          revealed ? undefined : card.imageOcclusion
        );
      }
    }, { once: true });
    image.addEventListener("error", () => {
      preview.classList.add("has-error");
      const error = document.createElement("p");
      error.className = "mobile-image-error";
      error.textContent = "No se pudo cargar la imagen de esta tarjeta.";
      preview.appendChild(error);
    }, { once: true });

    void this.resolveImageUrl(card.imageSource)
      .then((url) => {
        if (url) image.src = url;
        else preview.classList.add("has-error");
      })
      .catch((error: unknown) => {
        console.error("No se pudo resolver la imagen de la tarjeta:", error);
        preview.classList.add("has-error");
      });

    return preview;
  }

  private async resolveImageUrl(source?: string): Promise<string | null> {
    if (!source) return null;
    if (/^data:image\/(?:png|jpe?g|webp|svg\+xml|gif|bmp);/i.test(source)) return source;
    if (/^(?:https?:|blob:)/i.test(source)) return source;
    if (/^(?:javascript:|vbscript:|data:)/i.test(source)) return null;

    const cached = this.imageUrls.get(source);
    if (cached) return cached;
    const cachedFallback = this.imageFallbackUrls.get(source);
    if (cachedFallback) return cachedFallback;

    let decoded = source;
    try {
      decoded = decodeURIComponent(source);
    } catch {
      // Se conserva la ruta literal si los escapes URI no son válidos.
    }

    if (!isTauri()) return decoded;

    const requestId = ++this.imageRequest;
    const root = this.vault.getActiveRootPath();
    const absolute = /^(?:\/|[a-z]:[\\/])/i.test(decoded)
      ? decoded
      : root
        ? await join(root, decoded.replace(/^\.\//, "").replace(/\\/g, "/"))
        : decoded;

    try {
      const canonical = await invoke<string>("resolve_image_path", { source: absolute });
      if (requestId === this.imageRequest) {
        const url = convertFileSrc(canonical);
        this.imageUrls.set(source, url);
        return url;
      }
    } catch (error) {
      console.warn("La URL de recurso falló; se intentará leer la imagen por IPC:", error);
    }

    try {
      const bytes = await invoke<number[]>("read_image_data", { source: absolute });
      const extension = decoded.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase() || "png";
      const blob = new Blob([Uint8Array.from(bytes)], {
        type: IMAGE_MIME_TYPES[extension] || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      this.imageFallbackUrls.set(source, url);
      return url;
    } catch (error) {
      console.error("No se pudo leer la imagen de la tarjeta:", error);
      return null;
    }
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.root.classList.toggle("is-busy", busy);
    this.refs.vaultButton.disabled = busy;
    this.refs.refreshButton.disabled = busy;
    this.refs.notesButton.disabled = busy;
    this.updateHistoryButtons();
  }

  private initUpdateSettings(): void {
    if (this.updateUiReady) return;
    this.updateUiReady = true;

    if (getUpdatePlatform() === "unsupported") {
      this.refs.updateSection.hidden = true;
      return;
    }

    void getCurrentVersion().then((version) => {
      if (version) this.refs.updateCurrentVersion.textContent = version;
    });

    subscribeUpdateState((state) => this.renderUpdateState(state));
    this.refs.updateCheckButton.addEventListener("click", () => {
      void checkForUpdates();
    });
    this.refs.updateInstallButton.addEventListener("click", () => {
      void installAvailableUpdate();
    });
  }

  private renderUpdateState(state: UpdateState): void {
    this.refs.updateCurrentVersion.textContent = state.currentVersion || "—";
    this.refs.updateAvailable.hidden = !state.newVersion;
    this.refs.updateNewVersion.textContent = state.newVersion ?? "—";

    const busy = state.status === "checking" || state.status === "downloading";
    this.refs.updateCheckButton.disabled = busy;
    this.refs.updateCheckButton.textContent =
      state.status === "checking" ? "Buscando…" : "Buscar actualizaciones";
    this.refs.updateInstallButton.hidden = state.status !== "available";
    this.refs.updateInstallButton.disabled = busy;

    this.refs.updateStatus.textContent = state.message ?? "";
    this.refs.updateStatus.dataset.status = state.status;

    const showProgress =
      state.status === "downloading" ||
      (state.status === "ready" && state.progress !== null);
    this.refs.updateProgress.hidden = !showProgress;
    this.refs.updateProgressLabel.hidden = !showProgress;
    if (showProgress) {
      if (state.progress === null) this.refs.updateProgress.removeAttribute("value");
      else this.refs.updateProgress.value = state.progress;
      const percent = state.progress === null ? "" : ` · ${Math.round(state.progress * 100)} %`;
      this.refs.updateProgressLabel.textContent =
        state.totalBytes > 0
          ? `${formatBytes(state.receivedBytes)} / ${formatBytes(state.totalBytes)}${percent}`
          : `${formatBytes(state.receivedBytes)}${percent}`;
    }

    this.refs.updateNotesWrap.hidden = !state.notes;
    this.refs.updateNotes.textContent = state.notes;

    // Avisar una sola vez cuando termina la descarga o aparece un error, sin
    // tapar la interfaz con toasts repetidos en cada actualización de progreso.
    if (state.status !== this.lastUpdateStatus) {
      if (state.status === "ready" && state.message) this.showToast(state.message);
      else if (state.status === "error" && state.message) this.showToast(state.message);
      this.lastUpdateStatus = state.status;
    }
  }

  private showToast(message: string): void {
    this.refs.toast.textContent = message;
    this.refs.toast.classList.add("is-visible");
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.refs.toast.classList.remove("is-visible");
      this.toastTimer = null;
    }, 3600);
  }
}

/** Monta la experiencia de repaso exclusiva para la APK Android/iOS. */
export function mountMobileReviewApp(): void {
  new MobileReviewApp().mount();
  // El idioma guardado se aplica también en la vista móvil. El observador de
  // i18n traduce el contenido que se renderiza de forma dinámica.
  initializeLocalization();
}

// Añadir navegación a todas las páginas en modo móvil
