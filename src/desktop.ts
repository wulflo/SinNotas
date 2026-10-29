import {
  BlockNode,
  PageData,
  PageRevision,
  ViewType,
  CursorState,
  TypographyType,
  KanbanStatus,
  ImageOcclusionRegion,
  Flashcard,
  KanbanTask,
  SnapshotState,
  SnapshotActiveNote,
  VaultCacheDelta,
} from "./types";
import "katex/dist/katex.min.css";
import "./style.css";
import "./material-aero.css";
import { hideAppSplash } from "./splash";
import { requestReviewMode } from "./app-mode";
import {
  insertBlockAfter,
  insertBlocksAfter,
  enterAtEnd,
  generateId,
  splitBlock,
  indentBlock,
  outdentBlock,
  moveBlockTo,
  deleteOrMergeBlock,
  moveBlockUp,
  moveBlockDown,
  removeBlock,
  insertImageBlockAfter,
  toggleTaskStatus,
  applyFormatting,
  clearFormatting,
  toggleCollapse,
  getFlatVisibleBlocks,
  findNodeLocation,
  getAllBlocksFlat,
  getSelectedBlockRoots,
  removeBlocks,
  cloneTree,
  indentBlocks,
  outdentBlocks,
} from "./editor/tree-engine";
import { DocumentHistory } from "./editor/history";
import { VaultStore } from "./store/vault";
import {
  DECK_SEPARATOR,
  hasInvalidDeckTitleCharacters,
  normalizeDeckTitle,
  splitDeckTitle,
} from "./deck-title";
import {
  buildDeckTree,
  collectDeckPageTitles,
  compareDeckNodesByName,
  flattenDeckRows,
  getDeckSelectionState,
  normalizeDeckSearchText,
  searchDeckTree,
  sortDeckTree,
  visibleDeckRoots,
  type DeckNode,
  type DeckTree,
} from "./views/flashcard-decks";
import { ReviewProgressStore, type ReviewProgressEvent } from "./store/review-progress";
import { collectOutgoingLinks } from "./store/wikilinks";
import { connectedPageTitles } from "./views/graph-neighborhood";
import { selectSidebarPages } from "./store/sidebar-selection";
import {
  ContentSearchIndex,
  buildSnippet,
  visibleBlockText,
  fold,
  locateMatch,
  type ContentHit,
} from "./store/content-search";
import { readImage as readClipboardImage, readText as readClipboardText } from "@tauri-apps/plugin-clipboard-manager";
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { join } from "@tauri-apps/api/path";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  serializePageAsPlainText,
} from "./store/export";
import { GraphView, GRAPH_COLOR_PALETTE } from "./views/graph-view";
import {
  defaultGraphSettings,
  loadGraphSettings,
  normalizeGraphSettings,
  saveGraphSettings,
  type GraphColorRule,
  type GraphSettings,
} from "./views/graph-settings";
import { FlashcardsManager, type FlashcardReviewOrder } from "./views/flashcards-manager";
import { FlashcardLoader, type FlashcardLoadProgress } from "./views/flashcard-loader";
import { KanbanManager } from "./views/kanban-view";
import {
  filterAllPages,
  formatPageDate,
  isAllPagesSort,
  nextAllPagesSort,
  pageCreatedMs,
  pageUpdatedMs,
  sortAllPages,
  type AllPagesSort,
  type AllPagesSortKey,
} from "./views/all-pages";
import { VirtualList } from "./views/virtual-list";
import { ConceptMapView } from "./views/concept-map-view";
import { FSRSRating } from "./editor/fsrs";
import {
  CONTROLLER_TYPE_OPTIONS,
  buttonLabelsFor,
  firstConnectedGamepad,
  GamepadListener,
  type ControllerType,
} from "./gamepad";
import { renderMarkdownToHtml, sanitizeHtml, stripCardTag, stripSystemProperties } from "./editor/markdown";
import { isAllowedRemoteImageUrl } from "./editor/url-safety";
import { sanitizePastedHtmlToMarkdown } from "./editor/paste-sanitizer";
import { findMatchesInBlocks, type NoteMatch } from "./editor/note-search";
import {
  editMarkdownTable,
  escapeTableCell,
  findMarkdownTableRanges,
  type MarkdownTableModel,
  type TableEditAction,
} from "./editor/markdown-table";
import {
  appendOcclusionMasks,
  clampImageOcclusionRegion,
  normalizeImageOcclusionRegion,
  occlusionRegionsMatch,
  parseImageOcclusions,
} from "./editor/image-occlusion";
import { renderMathToHtml } from "./editor/math";
import { currentLanguage, initializeLocalization, onLanguageChange, translate } from "./i18n";
import {
  checkForUpdates,
  getCurrentVersion,
  getUpdatePlatform,
  installAvailableUpdate,
  subscribeUpdateState,
  type UpdateState,
} from "./services/updater";
import { formatBytes } from "./services/update-utils";
import {
  FONT_SIZE_DEFINITIONS,
  applyFontSizes,
  clampFontSize,
  fontSizeDefinition,
  mobileFontScale,
  readFontSizes,
  resetFontSizes,
  writeFontSize,
  type FontSizeKey,
} from "./typography";
import {
  progressStageFromPoints,
  type ChemicalElement,
  type MoleculeStage,
} from "./periodic-elements";

function scaledFontSize(px: number): string {
  return `calc(${px}px * var(--ls-font-scale, 1))`;
}

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

interface RegisteredVault {
  rootPath: string;
  name: string;
  lastOpenedAt: number;
}

interface UnusedAttachmentsReport {
  scanned: number;
  removed: string[];
  kept: number;
  failed: string[];
}

const VAULT_REGISTRY_KEY = "sinnotas-vault-registry-v1";
let registeredVaults: RegisteredVault[] = loadVaultRegistry();
let isVaultSwitching = false;

// Vault & Views
const vault = new VaultStore();
/** Historial de deshacer/rehacer por nota (Ctrl+Z / Ctrl+Y). */
const documentHistory = new DocumentHistory();
let currentPage: PageData = vault.getPageByTitle("Welcome to SinNotas") || vault.getPages()[0];
let currentView: ViewType = "editor";
/** Página actual del listado de diarios existentes. */
let journalsPage = 1;
const JOURNALS_PAGE_SIZE = 10;
/** Temporizador de debounce para renombrar la nota al editar su título. */
let pageTitleRenameTimer: number | null = null;
/** Nota para la que se agendó el renombrado pendiente. */
let pageTitleRenamePageId: string | null = null;
/** Último título guardado correctamente (en disco y localStorage). */
let lastValidPageTitle = currentPage.title;

// Cada guardado registra el estado de la nota en el historial de deshacer.
vault.onBeforeSave((page) => {
  documentHistory.capture(page.id, page.blocks, page.title);
});

/* Historial de snapshots: la configuración vive en el backend (.sinnotas/chronos/). */

let cursorState: CursorState | null = {
  blockId: currentPage.blocks[0]?.id || "b-1",
  offset: 0,
};
/**
 * Bullet vacío que ya se desindentó con Enter. El siguiente Enter crea un
 * hermano en ese nivel en lugar de desindentarlo otra vez. Se limpia al
 * escribir o al ejecutar otra acción sobre el bullet; se conserva si el foco
 * sale y vuelve, porque el bullet ya está en el nivel desindentado.
 */
let enterOutdentedBlockId: string | null = null;
let selectedBulletIds: string[] = [];
let bulletSelectionAnchorId: string | null = null;
let pointerSelectionActive = false;
let boxSelectionStart: { x: number; y: number } | null = null;
let boxSelectionRoot: HTMLElement | null = null;
let boxSelectionScrollRoot: HTMLElement | null = null;
let boxSelectionPointer: { x: number; y: number } | null = null;
let boxSelectionScrollFrame: number | null = null;
let pendingBoxSelection: { x: number; y: number; root: HTMLElement } | null = null;
/** Arrastre vertical que empieza sobre el texto de un bullet: puede convertirse
 * en selección por caja sin romper el clic normal ni la selección de texto. */
let pendingTextDragSelection: { x: number; y: number; root: HTMLElement } | null = null;
let boxSelectionOverlay: HTMLDivElement | null = null;
let slashMenu: HTMLDivElement | null = null;
let slashMenuState: {
  editor: HTMLElement;
  blockId: string;
  start: number;
  end: number;
  query: string;
  selectedIndex: number;
} | null = null;

let tableContextMenu: HTMLDivElement | null = null;
let tableContextMenuState: {
  table: HTMLTableElement;
  targetCell: HTMLTableCellElement;
  rowIndex: number;
  colIndex: number;
} | null = null;

let draggedRow: HTMLTableRowElement | null = null;
let draggedColIndex: number | null = null;

interface QueryResult {
  title: string;
  snippet?: string;
}

function executeQuery(queryText: string): QueryResult[] {
  const lowerQuery = queryText.toLowerCase();
  const results: QueryResult[] = [];
  
  const allBlocks = vault.getPages().flatMap(page => 
    getAllBlocksFlat(page.blocks).map(block => ({
      page,
      block
    }))
  );
  
  const searchTerm = lowerQuery.replace(/^query\s*/i, "").replace(/^search\s*/i, "").trim();
  
  if (searchTerm.startsWith("tag:")) {
    const tag = searchTerm.slice(4).trim();
    allBlocks.forEach(({ page, block }) => {
      const content = getVisibleBlockContent(block.content).toLowerCase();
      if (content.includes(`#${tag}`) || content.includes(`tag:${tag}`)) {
        const existing = results.find(r => r.title === page.title);
        if (!existing) {
          results.push({
            title: page.title,
            snippet: getVisibleBlockContent(block.content).slice(0, 100)
          });
        }
      }
    });
  } else if (searchTerm.startsWith("link:")) {
    const linkTitle = searchTerm.slice(5).trim().toLowerCase();
    vault.getPages().forEach(page => {
      const hasLink = getAllBlocksFlat(page.blocks).some(block =>
        getVisibleBlockContent(block.content).toLowerCase().includes(`[[${linkTitle}`)
      );
      if (hasLink) {
        results.push({ title: page.title });
      }
    });
  } else {
    vault.getPages().forEach(page => {
      if (page.title.toLowerCase().includes(searchTerm)) {
        results.push({ title: page.title });
      }
    });
    
    allBlocks.forEach(({ page, block }) => {
      const content = getVisibleBlockContent(block.content).toLowerCase();
      if (content.includes(searchTerm) && !results.find(r => r.title === page.title)) {
        results.push({
          title: page.title,
          snippet: getVisibleBlockContent(block.content).slice(0, 100)
        });
      }
    });
  }
  
  return results.slice(0, 10);
}

const flashcardsManager = new FlashcardsManager();
/** Escaneo por lotes + caché por versión del vault para Flashcards. */
const flashcardLoader = new FlashcardLoader(flashcardsManager);
let desktopReady = false;
let flashcardLoading = false;
/** Evita re-renderizar la pantalla de "completado" en cada tick. */
let flashcardDueRecheckTimer: number | null = null;
const FLASHCARD_DUE_RECHECK_MS = 30_000;
/** Diario compartido en .sinnotas/progress/reviews.json para deshacer repasos. */
const reviewProgress = new ReviewProgressStore();
let reviewHistoryActionInFlight = false;
const storedFlashcardReviewOrder = localStorage.getItem("sinnotas-flashcard-review-order");
let flashcardReviewOrder: FlashcardReviewOrder =
  storedFlashcardReviewOrder === "new-first" ||
  storedFlashcardReviewOrder === "reviews-first" ||
  storedFlashcardReviewOrder === "mixed"
    ? storedFlashcardReviewOrder
    : "mixed";

const storedFlashcardPages = localStorage.getItem("sinnotas-flashcard-pages");
let flashcardPageFilter: string[] | null = null;
if (storedFlashcardPages) {
  try {
    const parsed = JSON.parse(storedFlashcardPages);
    if (Array.isArray(parsed)) {
      // Un array vacío significa "ninguna nota seleccionada"; null/ausente = todas.
      flashcardPageFilter = parsed.filter((value: unknown) => typeof value === "string");
    }
  } catch {
    flashcardPageFilter = null;
  }
}
// Aplicar la selección guardada al arrancar para que la sesión respete el filtro.
flashcardsManager.setPageFilter(flashcardPageFilter);

/** Modos de orden del selector de notas a repasar. */
type FlashcardPagesSortMode = "title-asc" | "title-desc" | "created-desc" | "created-asc";
const FLASHCARD_PAGES_SORT_STORAGE_KEY = "sinnotas-flashcard-sort";
const FLASHCARD_PAGES_SORT_MODES: FlashcardPagesSortMode[] = [
  "title-asc",
  "title-desc",
  "created-desc",
  "created-asc",
];

const storedFlashcardPagesSort = localStorage.getItem(FLASHCARD_PAGES_SORT_STORAGE_KEY);
let flashcardPagesSortMode: FlashcardPagesSortMode =
  storedFlashcardPagesSort !== null &&
  (FLASHCARD_PAGES_SORT_MODES as string[]).includes(storedFlashcardPagesSort)
    ? (storedFlashcardPagesSort as FlashcardPagesSortMode)
    : "title-asc";

/** Texto (sans acentos) con el que se filtran los mazos en el selector. */
let flashcardPagesSearchText = "";

/** Página actual del paginado del selector. Se vuelve a 1 al cambiar de
 * búsqueda u orden clave. Cada página contiene mazos raíz completos. */
let flashcardPagesCurrentPage = 1;
/** Total de páginas de la lista visible (con búsqueda aplicada). */
let flashcardPagesTotalPages = 1;
const FLASHCARD_PAGES_PER_PAGE = 20;

/** Mazos contraídos por el usuario. El estado vive mientras dure la app para
 * que marcar una casilla no vuelva a desplegar todo el árbol. */
const flashcardDeckCollapsed = new Set<string>();

/** Borrador de casillas mientras el usuario navega entre páginas del
 * paginado. Sin este mapa, re-renderizar una página perdería los cambios
 * hechos en otras; persiste hasta "Guardar selección". */
const flashcardPagesDraftSelection = new Map<string, boolean>();

/** Estado predeterminado (sin tocar) de una nota según el filtro guardado. */
function flashcardPageDefaultState(title: string): boolean {
  if (flashcardPageFilter === null) return true;
  const normalized = normalizeDeckTitle(title).toLowerCase();
  return flashcardPageFilter.some(
    (stored) => normalizeDeckTitle(stored).toLowerCase() === normalized
  );
}

/** Al renombrar una nota, traslada su selección y su filtro al título nuevo. */
function renameFlashcardPageReferences(oldTitle: string, newTitle: string): void {
  if (flashcardPageFilter !== null) {
    const oldNormalized = normalizeDeckTitle(oldTitle).toLowerCase();
    let changed = false;
    const nextFilter = flashcardPageFilter.map((title) => {
      if (normalizeDeckTitle(title).toLowerCase() !== oldNormalized) return title;
      changed = true;
      return newTitle;
    });
    if (changed) {
      flashcardPageFilter = [...new Set(nextFilter)];
      localStorage.setItem("sinnotas-flashcard-pages", JSON.stringify(flashcardPageFilter));
      flashcardsManager.setPageFilter(flashcardPageFilter);
    }
  }

  if (flashcardPagesDraftSelection.has(oldTitle)) {
    const selected = flashcardPagesDraftSelection.get(oldTitle) as boolean;
    flashcardPagesDraftSelection.delete(oldTitle);
    flashcardPagesDraftSelection.set(newTitle, selected);
  }
}

/** Fecha de creación consultada al backend (y pendientes), indexadas por
 * `<raíz del vault>\u0000<ruta de la nota>` para invalidarse entre vaults. */
const flashcardPagesCreatedTimes = new Map<string, number | null>();
let flashcardPagesCreatedTimesInFlight = false;

const kanbanManager = new KanbanManager();
let graphView: GraphView | null = null;
let graphDataVersion = -1;
/** Título cuya vecindad se está mostrando; null = grafo completo. */
let graphNeighborhoodOrigin: string | null = null;
let graphRenderedNeighborhood: string | null = null;
const btnGraphNeighborhood = document.getElementById(
  "btn-graph-neighborhood"
) as HTMLButtonElement | null;
const btnGraphShowAll = document.getElementById("btn-graph-show-all") as HTMLButtonElement | null;
const graphNeighborhoodLabel = document.getElementById(
  "graph-neighborhood-label"
) as HTMLSpanElement | null;

let graphPreviewPageTitle: string | null = null;
let graphPreviewTransitionTimer: number | null = null;
let journalCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

// Context Menu Target State
let contextTargetBlockId: string | null = null;
let contextTargetPage: PageData | null = null;
let contextSelectionRange: { start: number; end: number } = { start: 0, end: 0 };
let lastEditorSelection: { blockId: string; start: number; end: number } | null = null;
let contextImageSource: string | null = null;
let imageInsertTargetBlockId: string | null = null;
let imageInsertOpensOcclusion = false;
let imageOcclusionTarget: { blockId: string; source: string } | null = null;
let imageOcclusionRegions: ImageOcclusionRegion[] = [];
let imageOcclusionDraft: ImageOcclusionRegion | null = null;
let imageOcclusionPolygonPoints: Array<{ x: number; y: number }> = [];
let imageOcclusionShape: NonNullable<ImageOcclusionRegion["shape"]> = "rect";
const resolvedImagePaths = new Map<string, string>();
const resolvedImageFallbackUrls = new Map<string, string>();
const accentColors = [
  "blue",
  "green",
  "violet",
  "amber",
  "rose",
  "cyan",
  "teal",
  "indigo",
  "orange",
  "fuchsia",
  "gray",
] as const;
type AccentColor = (typeof accentColors)[number];
let selectedImageOcclusionIndex: number | null = null;
let pomodoroMode: "focus" | "break" = "focus";
let pomodoroRemainingSeconds = 25 * 60;
let pomodoroInterval: number | null = null;
let pomodoroFocusMinutes = 25;
let pomodoroBreakMinutes = 5;
let pomodoroLongBreakMinutes = 15;
let pomodoroSessionsBeforeLongBreak = 4;
let pomodoroCompletedFocusSessions = 0;
let pomodoroIsLongBreak = false;
// Distingue una pausa real del estado inicial/detenido para pintar la píldora.
let pomodoroPaused = false;
let pomodoroHeadbarVisible = true;
let pomodoroSoundEnabled = true;
let pomodoroAudioContextRef: AudioContext | null = null;
interface FlashcardProgressStats {
  date: string;
  reviewsToday: number;
  totalReviews: number;
  focusSeconds: number;
  points: number;
}
const flashcardProgressStorageKey = "sinnotas-flashcard-progress";
const flashcardPointDeltas: Record<FSRSRating, number> = {
  1: -2, // Otra vez
  2: 0, // Difícil
  3: 2, // Bien
  4: 3, // Fácil
};
let flashcardProgressStats: FlashcardProgressStats = {
  date: new Date().toLocaleDateString("en-CA"),
  reviewsToday: 0,
  totalReviews: 0,
  focusSeconds: 0,
  points: 0,
};
let imageOcclusionPointerAction: {
  pointerId: number;
  mode: "draw" | "move" | "resize";
  start: { x: number; y: number };
  originalRegion?: ImageOcclusionRegion;
  regionIndex?: number;
  edge?: string;
} | null = null;
interface SavedImagePath {
  relativePath: string;
  absolutePath: string;
}
interface TextDialogOptions {
  inputType?: "text" | "date";
  allowEmpty?: boolean;
  message?: string;
  validate?: (value: string) => string | null;
}
let textDialogResolver: ((value: string | null) => void) | null = null;
let textDialogAllowEmpty = false;
let textDialogValidator: ((value: string) => string | null) | null = null;
let confirmDialogResolver: ((value: boolean) => void) | null = null;

// Sidebar Context Menu State
let sidebarContextPageId: string | null = null;
let sidebarContextPageTitle: string | null = null;

// DOM Elements
const blocksContainer = document.getElementById("blocks-container") as HTMLDivElement;
const backlinksContainer = document.getElementById("backlinks-list") as HTMLDivElement;
const refCountBadge = document.getElementById("ref-count") as HTMLSpanElement;
const outgoingLinksContainer = document.getElementById("outgoing-links-list") as HTMLDivElement | null;
const outgoingCountBadge = document.getElementById("outgoing-count") as HTMLSpanElement | null;
const sidebarLeft = document.getElementById("sidebar-left") as HTMLElement;
const sidebarPagesList = document.getElementById("sidebar-pages-list") as HTMLDivElement;
const sidebarSearchInput = document.getElementById("sidebar-search-input") as HTMLInputElement;
const searchResultsDropdown = document.getElementById("search-results-dropdown") as HTMLDivElement;
const pageTitleHeading = document.getElementById("page-title-heading") as HTMLHeadingElement;
const noteFindBar = document.getElementById("note-find-bar") as HTMLDivElement | null;
const noteFindInput = document.getElementById("note-find-input") as HTMLInputElement | null;
const noteFindCount = document.getElementById("note-find-count") as HTMLSpanElement | null;
const btnNoteFindPrev = document.getElementById("btn-note-find-prev") as HTMLButtonElement | null;
const btnNoteFindNext = document.getElementById("btn-note-find-next") as HTMLButtonElement | null;
const btnNoteFindClose = document.getElementById("btn-note-find-close") as HTMLButtonElement | null;
const btnSplitView = document.getElementById("btn-split-view") as HTMLButtonElement | null;
const referencePane = document.getElementById("reference-pane") as HTMLElement | null;
const referencePaneCount = document.getElementById("reference-pane-count") as HTMLSpanElement | null;
const referenceSlots = document.getElementById("reference-slots") as HTMLDivElement | null;
const btnAddReferencePane = document.getElementById("btn-add-reference-pane") as HTMLButtonElement | null;
const btnCloseReferencePane = document.getElementById(
  "btn-close-reference-pane"
) as HTMLButtonElement | null;
const pagePropertiesContainer = document.getElementById("page-properties-container") as HTMLDivElement;
const headbarBreadcrumb = document.getElementById("headbar-breadcrumb") as HTMLDivElement;

/**
 * La barra superior solo tiene una línea: si el título es largo se recorta con
 * puntos suspensivos (ver `.headbar-page-breadcrumb` en `style.css`) y el texto
 * completo queda disponible en el tooltip.
 */
function setHeadbarTitle(title: string): void {
  headbarBreadcrumb.innerText = title;
  if (title) headbarBreadcrumb.title = title;
  else headbarBreadcrumb.removeAttribute("title");
}
const completionProgress = document.getElementById("completion-progress") as HTMLDivElement;
const btnAddBullet = document.getElementById("btn-add-bullet") as HTMLButtonElement;
const contextMenu = document.getElementById("custom-context-menu") as HTMLDivElement;
const bulletContextMenu = document.getElementById("bullet-context-menu") as HTMLDivElement;
const contextTextSelection = document.getElementById("context-text-selection") as HTMLDivElement;
const ctxIndentBtn = document.getElementById("ctx-indent") as HTMLButtonElement | null;
const ctxOutdentBtn = document.getElementById("ctx-outdent") as HTMLButtonElement | null;
const sidebarContextMenu = document.getElementById("sidebar-context-menu") as HTMLDivElement;
const navigationContextMenu = document.getElementById("navigation-context-menu") as HTMLDivElement;
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar") as HTMLButtonElement;
const btnWindowMinimize = document.getElementById("btn-window-minimize") as HTMLButtonElement | null;
const btnWindowMaximize = document.getElementById("btn-window-maximize") as HTMLButtonElement | null;
const btnWindowClose = document.getElementById("btn-window-close") as HTMLButtonElement | null;
const toastNotification = document.getElementById("toast-notification") as HTMLDivElement;
const activeVaultName = document.getElementById("active-vault-name") as HTMLSpanElement;
const btnSelectVault = document.getElementById("btn-select-vault") as HTMLButtonElement;
const vaultManagerOverlay = document.getElementById("vault-manager-overlay") as HTMLDivElement;
const vaultManagerList = document.getElementById("vault-manager-list") as HTMLDivElement;
const btnCloseVaultManager = document.getElementById("btn-close-vault-manager") as HTMLButtonElement;
const btnAddVault = document.getElementById("btn-add-vault") as HTMLButtonElement;
const vaultManagerStatus = document.getElementById("vault-manager-status") as HTMLSpanElement;
const imageFileInput = document.getElementById("image-file-input") as HTMLInputElement;
const contextImageOcclusion = document.getElementById("ctx-image-occlusion") as HTMLDivElement;
const appDialogOverlay = document.getElementById("app-dialog-overlay") as HTMLDivElement;
const appDialogForm = document.getElementById("app-dialog-form") as HTMLFormElement;
const appDialogTitle = document.getElementById("app-dialog-title") as HTMLHeadingElement;
const appDialogMessage = document.getElementById("app-dialog-message") as HTMLParagraphElement;
const appDialogInputLabel = document.getElementById("app-dialog-input-label") as HTMLLabelElement;
const appDialogInput = document.getElementById("app-dialog-input") as HTMLInputElement;
const appDialogCancel = document.getElementById("app-dialog-cancel") as HTMLButtonElement;
const appDialogAccept = document.getElementById("app-dialog-accept") as HTMLButtonElement;
const appDialogError = document.getElementById("app-dialog-error") as HTMLParagraphElement;
const imageOcclusionOverlay = document.getElementById("image-occlusion-overlay") as HTMLDivElement;
const imageOcclusionImage = document.getElementById("image-occlusion-source") as HTMLImageElement;
const imageOcclusionLayer = document.getElementById("image-occlusion-layer") as HTMLDivElement;
const imageOcclusionList = document.getElementById("image-occlusion-list") as HTMLDivElement;
const imageOcclusionShapeSelect = document.getElementById("image-occlusion-shape") as HTMLSelectElement;
const imageOcclusionColorInput = document.getElementById("image-occlusion-color") as HTMLInputElement;
const imageOcclusionHintInput = document.getElementById("image-occlusion-hint") as HTMLInputElement;
const imageOcclusionFinishPolygon = document.getElementById("image-occlusion-finish-polygon") as HTMLButtonElement;
const imageOcclusionScaleDown = document.getElementById("image-occlusion-scale-down") as HTMLButtonElement;
const imageOcclusionScaleUp = document.getElementById("image-occlusion-scale-up") as HTMLButtonElement;
const imageOcclusionRotateLeft = document.getElementById("image-occlusion-rotate-left") as HTMLButtonElement;
const imageOcclusionRotateRight = document.getElementById("image-occlusion-rotate-right") as HTMLButtonElement;
const imageOcclusionAlignLeft = document.getElementById("image-occlusion-align-left") as HTMLButtonElement;
const imageOcclusionAlignCenter = document.getElementById("image-occlusion-align-center") as HTMLButtonElement;
const imageOcclusionAlignRight = document.getElementById("image-occlusion-align-right") as HTMLButtonElement;
const imageOcclusionAlignTop = document.getElementById("image-occlusion-align-top") as HTMLButtonElement;
const imageOcclusionAlignMiddle = document.getElementById("image-occlusion-align-middle") as HTMLButtonElement;
const imageOcclusionAlignBottom = document.getElementById("image-occlusion-align-bottom") as HTMLButtonElement;
const imageOcclusionDistributeHorizontal = document.getElementById("image-occlusion-distribute-horizontal") as HTMLButtonElement;
const imageOcclusionDistributeVertical = document.getElementById("image-occlusion-distribute-vertical") as HTMLButtonElement;
const flashcardFocusToggle = document.getElementById("btn-flashcard-focus") as HTMLButtonElement;
const flashcardReviewUndo = document.getElementById("btn-review-undo") as HTMLButtonElement;
const flashcardReviewRedo = document.getElementById("btn-review-redo") as HTMLButtonElement;
const flashcardSyncButton = document.getElementById("btn-flashcards-refresh") as HTMLButtonElement;
const flashcardReviewTools = document.getElementById("flashcard-review-tools") as HTMLElement;
const pomodoroClock = document.getElementById("pomodoro-clock") as HTMLDivElement;
const pomodoroModeLabel = document.getElementById("pomodoro-mode") as HTMLSpanElement;
const pomodoroToggle = document.getElementById("btn-pomodoro-toggle") as HTMLButtonElement;
const pomodoroReset = document.getElementById("btn-pomodoro-reset") as HTMLButtonElement;
const pomodoroShortBreak = document.getElementById("btn-pomodoro-short-break") as HTMLButtonElement | null;
const pomodoroLongBreak = document.getElementById("btn-pomodoro-long-break") as HTMLButtonElement | null;
const pomodoroFocusDurationInput = document.getElementById("pomodoro-focus-duration") as HTMLSelectElement;
const pomodoroBreakDurationInput = document.getElementById("pomodoro-break-duration") as HTMLSelectElement;
const pomodoroLongBreakDurationInput = document.getElementById("pomodoro-long-break-duration") as HTMLSelectElement;
const pomodoroSessionsBeforeLongBreakInput = document.getElementById("pomodoro-sessions-before-long-break") as HTMLSelectElement;
const pomodoroShowHeadbarInput = document.getElementById("pomodoro-show-headbar") as HTMLInputElement;
const pomodoroSoundInput = document.getElementById("pomodoro-sound") as HTMLInputElement;
const headbarPomodoro = document.getElementById("headbar-pomodoro") as HTMLDivElement;
// El propio reloj es el botón de iniciar/pausar.
const headbarPomodoroClock = document.getElementById("headbar-pomodoro-clock") as HTMLButtonElement;
const flashcardKeyAgain = document.getElementById("flashcard-key-again") as HTMLInputElement;
const flashcardKeyHard = document.getElementById("flashcard-key-hard") as HTMLInputElement;
const flashcardKeyGood = document.getElementById("flashcard-key-good") as HTMLInputElement;
const flashcardKeyEasy = document.getElementById("flashcard-key-easy") as HTMLInputElement;
const flashcardStatToday = document.getElementById("flashcard-stat-today") as HTMLElement;
const flashcardStatTotal = document.getElementById("flashcard-stat-total") as HTMLElement;
const flashcardStatFocus = document.getElementById("flashcard-stat-focus") as HTMLElement;
const flashcardGrowthTree = document.querySelector<SVGSVGElement>("#flashcard-growth-tree")!;
const flashcardTreeProgress = document.getElementById("flashcard-tree-progress") as HTMLSpanElement;
const flashcardPointsBadge = document.getElementById("flashcard-points-badge") as HTMLSpanElement;
const pageExportToggle = document.getElementById("btn-open-page-export") as HTMLButtonElement;
const pageExportDropdown = document.getElementById("page-export-dropdown") as HTMLDivElement;
const supportLink = document.getElementById("btn-support") as HTMLAnchorElement;

// Settings & Actions Elements
const btnSettingsToggle = document.getElementById("btn-settings-toggle") as HTMLButtonElement;
const settingsOverlay = document.getElementById("settings-overlay") as HTMLDivElement;
const settingsDropdownMenu = document.getElementById("settings-dropdown-menu") as HTMLDivElement;
const btnCloseSettings = document.getElementById("btn-close-settings") as HTMLButtonElement;
const btnThemeSwitch = document.getElementById("btn-theme-switch") as HTMLButtonElement;
const pageWidthSlider = document.getElementById("page-width-slider") as HTMLInputElement;
const pageWidthValue = document.getElementById("page-width-value") as HTMLOutputElement;
const typographyControls = document.getElementById("typography-controls") as HTMLDivElement | null;
const btnResetTypography = document.getElementById("btn-reset-typography") as HTMLButtonElement | null;
const btnMobileBackToReview = document.getElementById(
  "btn-mobile-back-to-review"
) as HTMLButtonElement | null;
const btnEnterReviewMode = document.getElementById(
  "btn-enter-review-mode"
) as HTMLButtonElement | null;
const glowIntensitySlider = document.getElementById("glow-intensity-slider") as HTMLInputElement;
const glowIntensityValue = document.getElementById("glow-intensity-value") as HTMLOutputElement;
const btnDeletePage = document.getElementById("btn-delete-page") as HTMLButtonElement;
const btnPageHistory = document.getElementById("btn-page-history") as HTMLButtonElement;
const btnClearBulletProperties = document.getElementById("btn-clear-bullet-properties") as HTMLButtonElement;
const btnCleanUnusedAttachments = document.getElementById("btn-clean-unused-attachments") as HTMLButtonElement;
const unusedAttachmentsStatus = document.getElementById("unused-attachments-status") as HTMLParagraphElement;
const btnClearCache = document.getElementById("btn-clear-cache") as HTMLButtonElement;
const btnClearFlashcardStats = document.getElementById("btn-clear-flashcard-stats") as HTMLButtonElement;
const btnClearAllFlashcards = document.getElementById("btn-clear-all-flashcards") as HTMLButtonElement;
const clearAllFlashcardsStatus = document.getElementById("clear-all-flashcards-status") as HTMLParagraphElement;
const btnDeleteAllSnapshots = document.getElementById("btn-delete-all-snapshots") as HTMLButtonElement;
const btnReloadApp = document.getElementById("btn-reload-app") as HTMLButtonElement;
const updateSettingsSection = document.getElementById("update-settings-section") as HTMLElement | null;
const updateCurrentVersion = document.getElementById("update-current-version") as HTMLElement | null;
const updateAvailableRow = document.getElementById("update-available-row") as HTMLElement | null;
const updateNewVersion = document.getElementById("update-new-version") as HTMLElement | null;
const btnCheckUpdates = document.getElementById("btn-check-updates") as HTMLButtonElement | null;
const btnInstallUpdate = document.getElementById("btn-install-update") as HTMLButtonElement | null;
const updateProgressWrap = document.getElementById("update-progress-wrap") as HTMLElement | null;
const updateProgress = document.getElementById("update-progress") as HTMLProgressElement | null;
const updateProgressLabel = document.getElementById("update-progress-label") as HTMLElement | null;
const updateStatus = document.getElementById("update-status") as HTMLElement | null;
const updateNotesWrap = document.getElementById("update-notes-wrap") as HTMLDetailsElement | null;
const updateNotes = document.getElementById("update-notes") as HTMLElement | null;
const languageSelect = document.getElementById("interface-language") as HTMLSelectElement;
const flashcardReviewOrderSelect = document.getElementById("flashcard-review-order") as HTMLSelectElement;
const flashcardRecalcActionSelect = document.getElementById("flashcard-recalc-action") as HTMLSelectElement;
const flashcardRecalcHelp = document.getElementById("flashcard-recalc-help") as HTMLElement;
const flashcardRecalcStatus = document.getElementById("flashcard-recalc-status") as HTMLElement;
const btnFlashcardRecalc = document.getElementById("btn-flashcard-recalc") as HTMLButtonElement;
const flashcardPagesContainer = document.getElementById("flashcard-pages-container") as HTMLDivElement;
const flashcardPagesList = document.getElementById("flashcard-pages-list") as HTMLDivElement;
const btnFlashcardPagesSelectAll = document.getElementById("btn-flashcard-pages-select-all") as HTMLButtonElement;
const btnFlashcardPagesSelectNone = document.getElementById("btn-flashcard-pages-select-none") as HTMLButtonElement;
const btnFlashcardPagesSave = document.getElementById("btn-flashcard-pages-save") as HTMLButtonElement;
const flashcardPagesStatus = document.getElementById("flashcard-pages-status") as HTMLSpanElement;
const flashcardPagesSearch = document.getElementById("flashcard-pages-search") as HTMLInputElement | null;
const flashcardPagesSort = document.getElementById("flashcard-pages-sort") as HTMLSelectElement | null;
const flashcardTextSizeInput = document.getElementById("flashcard-text-size") as HTMLInputElement | null;
const flashcardTextSizeValue = document.getElementById("flashcard-text-size-value") as HTMLOutputElement | null;
const cardFontDecreaseButton = document.getElementById("btn-card-font-decrease") as HTMLButtonElement | null;
const cardFontIncreaseButton = document.getElementById("btn-card-font-increase") as HTMLButtonElement | null;
const cardFontSizeValue = document.getElementById("card-font-size-value") as HTMLOutputElement | null;
const btnOpenFlashcardSettings = document.getElementById("btn-open-flashcard-settings") as HTMLButtonElement | null;
const btnOpenReviewSettings = document.getElementById("btn-open-review-settings") as HTMLButtonElement | null;
const btnOpenPomodoroSettings = document.getElementById("btn-open-pomodoro-settings") as HTMLButtonElement | null;
// Snapshots (activados por nota, con historial en .sinnotas/chronos/)
const snapshotStatusText = document.getElementById("snapshot-status-text") as HTMLSpanElement;
const snapshotStateDot = document.getElementById("snapshot-state-dot") as HTMLSpanElement;
const btnSnapshotToggle = document.getElementById("btn-snapshot-toggle") as HTMLInputElement;
const snapshotActivateForm = document.getElementById("snapshot-activate-form") as HTMLFormElement;
const snapshotDurationDays = document.getElementById("snapshot-duration-days") as HTMLInputElement;
const snapshotIntervalHours = document.getElementById("snapshot-interval-hours") as HTMLInputElement;
const snapshotLimitEnabled = document.getElementById("snapshot-limit-enabled") as HTMLInputElement;
const snapshotMaxPerDay = document.getElementById("snapshot-max-per-day") as HTMLInputElement;
const snapshotFormError = document.getElementById("snapshot-form-error") as HTMLParagraphElement;
const snapshotFolderHint = document.getElementById("snapshot-folder-hint") as HTMLSpanElement;
const snapshotActiveNotesList = document.getElementById("snapshot-active-notes-list") as HTMLDivElement;
const btnOpenSnapshotHistory = document.getElementById("btn-open-snapshot-history") as HTMLButtonElement;
const systemFontSelect = document.getElementById("system-font-select") as HTMLSelectElement;
initializeLocalization(languageSelect);

// Gamepad Elements
const gamepadEnabledCheckbox = document.getElementById("gamepad-enabled-checkbox") as HTMLInputElement;
const gamepadStatusIndicator = document.getElementById("gamepad-status-indicator") as HTMLElement;
const gamepadControllerTypeSelect = document.getElementById("gamepad-controller-type") as HTMLSelectElement;
const btnGamepadDetect = document.getElementById("btn-gamepad-detect") as HTMLButtonElement;
const gamepadBtnAgain = document.getElementById("gamepad-btn-again") as HTMLSelectElement;
const gamepadBtnHard = document.getElementById("gamepad-btn-hard") as HTMLSelectElement;
const gamepadBtnGood = document.getElementById("gamepad-btn-good") as HTMLSelectElement;
const gamepadBtnEasy = document.getElementById("gamepad-btn-easy") as HTMLSelectElement;
const gamepadBtnShowAnswer = document.getElementById("gamepad-btn-show-answer") as HTMLSelectElement;
const gamepadBtnFocusMode = document.getElementById("gamepad-btn-focus-mode") as HTMLSelectElement;
const gamepadBtnUndoReview = document.getElementById("gamepad-btn-undo-review") as HTMLSelectElement;
const gamepadBtnRedoReview = document.getElementById("gamepad-btn-redo-review") as HTMLSelectElement;
const gamepadMappingSelects: HTMLSelectElement[] = [
  gamepadBtnAgain,
  gamepadBtnHard,
  gamepadBtnGood,
  gamepadBtnEasy,
  gamepadBtnShowAnswer,
  gamepadBtnFocusMode,
  gamepadBtnUndoReview,
  gamepadBtnRedoReview,
];
let gamepadListener: GamepadListener | null = null;

// Navigation elements
const navEditor = document.getElementById("nav-editor") as HTMLElement;
const navJournals = document.getElementById("nav-journals") as HTMLElement;
const navFlashcards = document.getElementById("nav-flashcards") as HTMLElement;
const navGraph = document.getElementById("nav-graph") as HTMLElement;
const navKanban = document.getElementById("nav-kanban") as HTMLElement;
const navAllPages = document.getElementById("nav-all-pages") as HTMLElement;
const btnHistoryBack = document.getElementById("btn-history-back") as HTMLButtonElement;
const btnHistoryForward = document.getElementById("btn-history-forward") as HTMLButtonElement;

// View Panels
const viewEditor = document.getElementById("view-editor") as HTMLElement;
const viewJournals = document.getElementById("view-journals") as HTMLElement;
const viewFlashcards = document.getElementById("view-flashcards") as HTMLElement;
const viewGraph = document.getElementById("view-graph") as HTMLElement;
const graphPreviewEl = document.getElementById("graph-preview") as HTMLElement;
const graphPreviewKickerEl = document.getElementById("graph-preview-kicker") as HTMLElement;
const graphPreviewTitleEl = document.getElementById("graph-preview-title") as HTMLElement;
const graphPreviewBodyEl = document.getElementById("graph-preview-body") as HTMLElement;
const graphPreviewMetaEl = document.getElementById("graph-preview-meta") as HTMLElement;
const graphPreviewColorsEl = document.getElementById("graph-preview-colors") as HTMLElement;
const graphPreviewOpenButton = document.getElementById("graph-preview-open") as HTMLButtonElement;
const graphPreviewCloseButton = document.getElementById("graph-preview-close") as HTMLButtonElement;
const viewKanban = document.getElementById("view-kanban") as HTMLElement;
const viewAllPages = document.getElementById("view-all-pages") as HTMLElement;
const kanbanHideCompleted = document.getElementById("kanban-hide-completed") as HTMLInputElement;
let draggedKanbanTask: KanbanTask | null = null;
kanbanHideCompleted.checked = localStorage.getItem("sinnotas-kanban-hide-completed") === "true";
kanbanHideCompleted.addEventListener("change", () => {
  localStorage.setItem("sinnotas-kanban-hide-completed", String(kanbanHideCompleted.checked));
  renderKanbanBoard();
});
document.querySelectorAll<HTMLElement>(".kanban-column[data-kanban-status]").forEach((column) => {
  column.addEventListener("dragover", (event) => {
    if (!draggedKanbanTask) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    column.classList.add("drop-target");
  });
  column.addEventListener("dragleave", (event) => {
    if (event.relatedTarget instanceof Node && column.contains(event.relatedTarget)) return;
    column.classList.remove("drop-target");
  });
  column.addEventListener("drop", (event) => {
    event.preventDefault();
    column.classList.remove("drop-target");
    const status = column.dataset.kanbanStatus;
    if (!draggedKanbanTask || (status !== "todo" && status !== "doing" && status !== "done")) return;
    updateTaskState(draggedKanbanTask, status);
    draggedKanbanTask = null;
  });
});

// History Modal Elements
const historyModalOverlay = document.getElementById("history-modal-overlay") as HTMLDivElement;
const btnCloseHistory = document.getElementById("btn-close-history") as HTMLButtonElement;
const historyRevisionsList = document.getElementById("history-revisions-list") as HTMLDivElement;
const historyPreviewContent = document.getElementById("history-preview-content") as HTMLDivElement;
const historyPreviewMeta = document.getElementById("history-preview-meta") as HTMLDivElement;
const historyModalTitle = document.getElementById("history-modal-title") as HTMLHeadingElement;
const btnRestoreVersion = document.getElementById("btn-restore-version") as HTMLButtonElement;
let selectedRevisionId: string | null = null;

// Concept Map Modal Elements
const conceptMapOverlay = document.getElementById("concept-map-overlay") as HTMLDivElement;
const conceptMapTitle = document.getElementById("concept-map-title") as HTMLHeadingElement;
const conceptMapSubtitle = document.getElementById("concept-map-subtitle") as HTMLSpanElement;
const btnCloseConceptMap = document.getElementById("btn-close-concept-map") as HTMLButtonElement;
const btnConceptMapZoomIn = document.getElementById("btn-concept-map-zoom-in") as HTMLButtonElement;
const btnConceptMapZoomOut = document.getElementById("btn-concept-map-zoom-out") as HTMLButtonElement;
const btnConceptMapReset = document.getElementById("btn-concept-map-reset") as HTMLButtonElement;
const conceptMapNodeDetail = document.getElementById("concept-map-node-detail") as HTMLDivElement | null;
const conceptMapNodeDetailTitle = document.getElementById("concept-map-node-detail-title") as HTMLDivElement | null;
const conceptMapNodeDetailBody = document.getElementById("concept-map-node-detail-body") as HTMLDivElement | null;
const btnCloseConceptMapNode = document.getElementById("btn-close-concept-map-node") as HTMLButtonElement | null;
const btnConceptMap = document.getElementById("btn-concept-map") as HTMLButtonElement;
const btnShortcuts = document.getElementById("btn-shortcuts") as HTMLButtonElement | null;
const shortcutsModalOverlay = document.getElementById("shortcuts-modal-overlay") as HTMLDivElement;
const btnCloseShortcuts = document.getElementById("btn-close-shortcuts") as HTMLButtonElement | null;
const conceptMapView = new ConceptMapView("concept-map-canvas", "concept-map-canvas-wrap", "concept-map-empty");

const modalOverlays: HTMLElement[] = [];
[settingsOverlay, historyModalOverlay, conceptMapOverlay, shortcutsModalOverlay, appDialogOverlay, vaultManagerOverlay, imageOcclusionOverlay].forEach((o) => {
  if (o) modalOverlays.push(o);
});
modalOverlays.forEach((overlay) => {
  overlay.hidden = true;
  overlay.remove();
});

function hasMountedModal(): boolean {
  return modalOverlays.some((overlay) => overlay && overlay.isConnected);
}

function hasMountedModalExcept(overlay: HTMLElement | null): boolean {
  return modalOverlays.some((candidate) => candidate !== overlay && candidate.isConnected);
}

function mountOverlay(overlay: HTMLElement | null): void {
  if (!overlay) return;
  if (!overlay.isConnected) document.body.appendChild(overlay);
  overlay.hidden = false;
}

function unmountOverlay(overlay: HTMLElement | null): void {
  if (!overlay) return;
  overlay.hidden = true;
  overlay.remove();
}

/* ==================== MOVIMIENTO DE MENÚS ==================== */
const MENU_CLOSE_MS = 150;
const OVERLAY_CLOSE_MS = 160;
const displayMenuCloseTimers = new WeakMap<HTMLElement, number>();

/** Devuelve 0 cuando el usuario pidió reducir el movimiento. */
function motionDuration(duration: number): number {
  if (typeof window.matchMedia !== "function") return duration;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
}

/** Reinicia una animación CSS aunque el elemento ya la hubiera ejecutado. */
function replayAnimation(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function openDisplayMenu(element: HTMLElement, display: "flex" | "block"): void {
  const pending = displayMenuCloseTimers.get(element);
  if (pending !== undefined) {
    window.clearTimeout(pending);
    displayMenuCloseTimers.delete(element);
  }
  element.classList.remove("is-menu-closing");
  element.style.display = display;
  replayAnimation(element, "is-menu-opening");
}

function closeDisplayMenu(element: HTMLElement | null): void {
  if (!element || element.style.display === "none" || displayMenuCloseTimers.has(element)) return;
  element.classList.remove("is-menu-opening");
  element.classList.add("is-menu-closing");
  const finish = () => {
    displayMenuCloseTimers.delete(element);
    element.classList.remove("is-menu-closing");
    element.style.display = "none";
  };
  const delay = motionDuration(MENU_CLOSE_MS);
  if (delay === 0) {
    finish();
    return;
  }
  displayMenuCloseTimers.set(element, window.setTimeout(finish, delay));
}

window.addEventListener("error", (event) => {
  if (!hasMountedModal()) return;
  console.error("Error no controlado mientras había un modal abierto:", event.error || event.message);
  closeAllModalOverlays();
  showToast("Ocurrió un error en un diálogo. Se cerró para liberar la interfaz.");
});

window.addEventListener("unhandledrejection", (event) => {
  if (!hasMountedModal()) return;
  console.error("Promesa rechazada mientras había un modal abierto:", event.reason);
  closeAllModalOverlays();
  showToast("Ocurrió un error en un diálogo. Se cerró para liberar la interfaz.");
});

/* ==================== TOAST NOTIFICATION ==================== */
let toastTimeout: number | null = null;
function showToast(message: string, duration = 2500) {
  if (toastTimeout) clearTimeout(toastTimeout);
  toastNotification.innerText = message;
  toastNotification.classList.add("visible");
  toastTimeout = window.setTimeout(() => {
    toastNotification.classList.remove("visible");
  }, duration);
}

window.addEventListener("vault-operation-error", (event) => {
  const message = (event as CustomEvent<string>).detail;
  if (message) showToast(message);
});

/* ==================== GUARDADO AL CERRAR ==================== */
// Web: intentar volcar las ediciones diferidas antes de abandonar la página.
window.addEventListener("beforeunload", () => {
  void vault.flushPendingSaves();
});

// Tauri: esperar a que terminen las escrituras pendientes antes de destruir la ventana.
if (isTauri()) {
  document.body.classList.add("is-tauri");
  const appWindow = getCurrentWindow();
  const updateMaximizeIcon = async () => {
    if (!btnWindowMaximize) return;
    const maximized = await appWindow.isMaximized();
    btnWindowMaximize.title = maximized ? "Restaurar" : "Maximizar";
    btnWindowMaximize.setAttribute("aria-label", maximized ? "Restaurar" : "Maximizar");
    btnWindowMaximize.innerHTML = maximized
      ? '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1h8v8" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="1" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>'
      : '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  };
  btnWindowMinimize?.addEventListener("click", () => { void appWindow.minimize(); });
  btnWindowMaximize?.addEventListener("click", async () => {
    await appWindow.toggleMaximize();
    await updateMaximizeIcon();
  });
  btnWindowClose?.addEventListener("click", () => { void appWindow.close(); });
  void appWindow.onResized(() => { void updateMaximizeIcon(); });
  void updateMaximizeIcon();
  void getCurrentWindow()
    .onCloseRequested(async (event) => {
      event.preventDefault();
      try {
        await vault.flushPendingSaves();
      } catch (error) {
        console.error("No se pudieron guardar los cambios antes de cerrar:", error);
      } finally {
        await getCurrentWindow().destroy();
      }
    })
    .catch((error: unknown) => {
      console.error("No se pudo registrar el guardado al cerrar:", error);
    });
}

function closeAppDialog(): void {
  unmountOverlay(appDialogOverlay);
  const resolveText = textDialogResolver;
  const resolveConfirm = confirmDialogResolver;
  textDialogResolver = null;
  textDialogAllowEmpty = false;
  confirmDialogResolver = null;
  resetTextDialogValidation();      // ← nueva
  appDialogInput.type = "text";
  resolveText?.(null);
  resolveConfirm?.(false);
}

function resetTextDialogValidation(): void {
  textDialogValidator = null;
  appDialogError.hidden = true;
  appDialogError.innerText = "";
  appDialogAccept.disabled = false;
}

function runTextDialogValidation(): boolean {
  if (!textDialogValidator) return true;
  const error = textDialogValidator(appDialogInput.value.trim());
  appDialogError.hidden = !error;
  appDialogError.innerText = error ?? "";
  appDialogAccept.disabled = !!error;
  return !error;
}

function runModalBoundary(
  modalName: string,
  fallback: () => void,
  render: () => void
): void {
  try {
    render();
  } catch (error) {
    console.error(`No se pudo mostrar el modal ${modalName}:`, error);
    fallback();
    showToast("Ocurrió un error en un diálogo. Se cerró para liberar la interfaz.");
  }
}

function showTextDialog(
  title: string,
  label: string,
  value: string,
  options: TextDialogOptions = {}
): Promise<string | null> {
  return new Promise((resolve) => {
    textDialogResolver = resolve;
    textDialogAllowEmpty = options.allowEmpty === true;
    runModalBoundary("el diálogo", closeAppDialog, () => {
      appDialogTitle.innerText = title;
      appDialogMessage.innerText = options.message || "";
      appDialogMessage.hidden = !options.message;
      appDialogInputLabel.hidden = false;
      appDialogInputLabel.innerText = label;
      appDialogInput.hidden = false;
      appDialogInput.type = options.inputType || "text";
      appDialogInput.required = !textDialogAllowEmpty;
      appDialogInput.value = value;
      textDialogValidator = options.validate ?? null;
      appDialogError.hidden = true;
      appDialogAccept.disabled = false;
      appDialogAccept.innerText = translate("Guardar");
      mountOverlay(appDialogOverlay);
      requestAnimationFrame(() => {
        if (appDialogOverlay.hidden) return;
        appDialogInput.focus();
        if (appDialogInput.type !== "date") appDialogInput.select();
      });
    });
  });
}

function validatePageTitle(value: string, pageId: string): string | null {
  const name = normalizeDeckTitle(value);
  if (!name) return "El nombre no puede estar vacío.";
  if (hasInvalidDeckTitleCharacters(splitDeckTitle(name))) {
    return 'El nombre no puede contener \\ / : * ? " < > |. Para separar mazos usa →.';
  }
  const duplicate = vault
    .getPages()
    .some(
      (page) =>
        page.id !== pageId &&
        normalizeDeckTitle(page.title).toLowerCase() === name.toLowerCase()
    );
  if (duplicate) return "Ya existe una nota con ese nombre. Elige otro.";
  return null;
}

function showFallbackConfirm(message: string, acceptLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    confirmDialogResolver = resolve;
    runModalBoundary("el diálogo de confirmación", closeAppDialog, () => {
      appDialogTitle.innerText = "Confirmar acción";
      appDialogMessage.innerText = message;
      appDialogMessage.hidden = false;
      appDialogInputLabel.hidden = true;
      appDialogInput.hidden = true;
      appDialogInput.required = false;
      appDialogAccept.innerText = acceptLabel;
      mountOverlay(appDialogOverlay);
      appDialogAccept.focus();
    });
  });
}

appDialogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (textDialogResolver) {
    if (!runTextDialogValidation()) return;   // ← nuevo: el diálogo se queda abierto
    const resolve = textDialogResolver;
    const allowEmpty = textDialogAllowEmpty;
    textDialogResolver = null;
    textDialogAllowEmpty = false;
    resetTextDialogValidation();
    unmountOverlay(appDialogOverlay);
    const raw = appDialogInput.value.trim();
    appDialogInput.type = "text";
    resolve(allowEmpty ? raw : raw || null);
    return;
  }
  if (confirmDialogResolver) {
    const resolve = confirmDialogResolver;
    confirmDialogResolver = null;
    unmountOverlay(appDialogOverlay);
    resolve(true);
  }
});

appDialogInput.addEventListener("input", () => {
  runTextDialogValidation();
});

appDialogCancel.addEventListener("click", closeAppDialog);
appDialogOverlay.addEventListener("click", (event) => {
  if (event.target === appDialogOverlay) closeAppDialog();
});

async function confirmAction(message: string, acceptLabel: string): Promise<boolean> {
  return showFallbackConfirm(message, acceptLabel);
}

/* ==================== THEME & TYPOGRAPHY MANAGEMENT ==================== */
function setupPomodoroSelect(
  select: HTMLSelectElement,
  values: number[],
  suffix: string,
  selectedValue: number
): void {
  select.innerHTML = "";
  const allValues = values.includes(selectedValue) ? values : [...values, selectedValue].sort((a, b) => a - b);
  allValues.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = `${value}${suffix}`;
    select.appendChild(option);
  });
  select.value = String(selectedValue);
}

function initThemeAndTypography() {
  const savedTheme = localStorage.getItem("sinnotas-theme") || "dark";
  setTheme(savedTheme === "light");

  const savedAccent = localStorage.getItem("sinnotas-accent");
  setAccent(accentColors.includes(savedAccent as AccentColor) ? savedAccent as AccentColor : "blue");

  const savedFont = (localStorage.getItem("sinnotas-font") as TypographyType) || "sans";
  if (savedFont === "system") {
    const savedSystemFont = localStorage.getItem("sinnotas-system-font");
    if (savedSystemFont) {
      applySystemFont(savedSystemFont);
      if (systemFontSelect) systemFontSelect.value = savedSystemFont;
    } else {
      setFont("sans");
    }
  } else {
    setFont(savedFont);
  }

  const savedPageWidth = Number(localStorage.getItem("sinnotas-page-width")) || 820;
  setPageWidth(savedPageWidth);

  initTypographySettings();

  const savedGlowIntensityRaw = localStorage.getItem("sinnotas-glow-intensity");
  const savedGlowIntensity = savedGlowIntensityRaw === null ? 100 : Number(savedGlowIntensityRaw);
  setGlowIntensity(Number.isFinite(savedGlowIntensity) ? savedGlowIntensity : 100);

  const savedFocusMinutes = Number(localStorage.getItem("sinnotas-pomodoro-focus")) || 25;
  const savedBreakMinutes = Number(localStorage.getItem("sinnotas-pomodoro-break")) || 5;
  const savedLongBreakMinutes = Number(localStorage.getItem("sinnotas-pomodoro-long-break")) || 15;
  const savedSessionsBeforeLongBreak = Number(localStorage.getItem("sinnotas-pomodoro-sessions")) || 4;
  pomodoroFocusMinutes = Math.max(1, Math.min(120, savedFocusMinutes));
  pomodoroBreakMinutes = Math.max(1, Math.min(60, savedBreakMinutes));
  pomodoroLongBreakMinutes = Math.max(1, Math.min(120, savedLongBreakMinutes));
  pomodoroSessionsBeforeLongBreak = Math.max(1, Math.min(12, savedSessionsBeforeLongBreak));
  pomodoroHeadbarVisible = localStorage.getItem("sinnotas-pomodoro-headbar") !== "false";
  pomodoroSoundEnabled = localStorage.getItem("sinnotas-pomodoro-sound") !== "false";
  setupPomodoroSelect(pomodoroFocusDurationInput, [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 90, 120], " min", pomodoroFocusMinutes);
  setupPomodoroSelect(pomodoroBreakDurationInput, [1, 3, 5, 10, 15, 20, 30, 45, 60], " min", pomodoroBreakMinutes);
  setupPomodoroSelect(pomodoroLongBreakDurationInput, [5, 10, 15, 20, 25, 30, 45, 60, 90, 120], " min", pomodoroLongBreakMinutes);
  setupPomodoroSelect(pomodoroSessionsBeforeLongBreakInput, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "", pomodoroSessionsBeforeLongBreak);
  pomodoroShowHeadbarInput.checked = pomodoroHeadbarVisible;
  pomodoroSoundInput.checked = pomodoroSoundEnabled;
  pomodoroRemainingSeconds = pomodoroFocusMinutes * 60;

  flashcardKeyAgain.value = localStorage.getItem("sinnotas-flashcard-key-again") || "1";
  flashcardKeyHard.value = localStorage.getItem("sinnotas-flashcard-key-hard") || "2";
  flashcardKeyGood.value = localStorage.getItem("sinnotas-flashcard-key-good") || "3";
  flashcardKeyEasy.value = localStorage.getItem("sinnotas-flashcard-key-easy") || "4";

}

const FALLBACK_SYSTEM_FONTS = [
  "Arial",
  "Calibri",
  "Cambria",
  "Cantarell",
  "Comic Sans MS",
  "Consolas",
  "Courier New",
  "DejaVu Sans",
  "DejaVu Serif",
  "Georgia",
  "Helvetica",
  "Inter",
  "Liberation Sans",
  "Liberation Serif",
  "Noto Sans",
  "Open Sans",
  "Roboto",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Ubuntu",
  "Verdana",
];

let systemFontsLoadStarted = false;

/** Enumera fuentes nativas solo cuando el usuario abre Apariencia. */
function ensureSystemFontsLoaded(): void {
  if (systemFontsLoadStarted) return;
  systemFontsLoadStarted = true;
  void loadSystemFonts();
}

async function loadSystemFonts(): Promise<void> {
  if (!systemFontSelect) return;

  let families: string[] = [];

  // En Tauri `queryLocalFonts` no existe: el backend enumera las fuentes
  // nativas (fontconfig en Linux/macOS y el registro en Windows).
  if (isTauri()) {
    try {
      families = await invoke<string[]>("list_system_fonts");
    } catch (error) {
      console.warn("No se pudieron enumerar las fuentes nativas:", error);
    }
  }

  // Navegadores compatibles con Font Access API (modo web).
  if (families.length === 0 && "queryLocalFonts" in window) {
    try {
      // @ts-ignore - queryLocalFonts no está en los tipos estándar todavía.
      const fonts = await (window as any).queryLocalFonts();
      fonts.forEach((font: any) => {
        if (typeof font.family === "string" && font.family.trim()) {
          families.push(font.family.trim());
        }
      });
    } catch (error) {
      console.warn("No se pudieron cargar las fuentes locales:", error);
    }
  }

  if (families.length === 0) families = [...FALLBACK_SYSTEM_FONTS];

  const sortedFamilies = Array.from(new Set(families))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  systemFontSelect.querySelectorAll("option[data-system-font]").forEach((option) => option.remove());
  sortedFamilies.forEach((family) => {
    const option = document.createElement("option");
    option.value = family;
    option.textContent = family;
    option.dataset.systemFont = "true";
    systemFontSelect.appendChild(option);
  });

  // La fuente elegida se aplica al arrancar aunque el sistema no la enumere:
  // el CSS usará esa familia o su fallback si ya no está instalada.
  const savedSystemFont = localStorage.getItem("sinnotas-system-font");
  if (savedSystemFont) {
    if (!sortedFamilies.includes(savedSystemFont)) {
      const option = document.createElement("option");
      option.value = savedSystemFont;
      option.textContent = savedSystemFont;
      option.dataset.systemFont = "true";
      systemFontSelect.appendChild(option);
    }
    systemFontSelect.value = savedSystemFont;
    applySystemFont(savedSystemFont);
  }

  systemFontSelect.addEventListener("change", () => {
    const selectedFont = systemFontSelect.value;
    if (selectedFont) {
      applySystemFont(selectedFont);
      localStorage.setItem("sinnotas-system-font", selectedFont);
      settingsDropdownMenu.querySelectorAll<HTMLButtonElement>(".font-option-btn[data-font]").forEach((btn) => {
        btn.classList.remove("active");
      });
      showToast(`${translate("Tipografía del sistema aplicada")}: ${selectedFont}`);
    } else {
      localStorage.removeItem("sinnotas-system-font");
      setFont("sans");
    }
  });
}

function applySystemFont(fontFamily: string): void {
  document.documentElement.style.setProperty("--ls-system-font", `"${fontFamily}", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`);
  document.documentElement.setAttribute("data-font", "system");
  localStorage.setItem("sinnotas-font", "system");
  settingsDropdownMenu.querySelectorAll<HTMLButtonElement>(".font-option-btn[data-font]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.font === "system");
  });
  conceptMapView.refreshTypography();
  graphView?.refresh();
}

function setTheme(isLight: boolean) {
  if (isLight) {
    document.documentElement.setAttribute("data-theme", "light");
    btnThemeSwitch.innerText = "Modo Claro Activo";
    localStorage.setItem("sinnotas-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
    btnThemeSwitch.innerText = "Modo Oscuro Activo";
    localStorage.setItem("sinnotas-theme", "dark");
  }
}

function setAccent(accent: AccentColor): void {
  document.documentElement.setAttribute("data-accent", accent);
  localStorage.setItem("sinnotas-accent", accent);
  settingsDropdownMenu.querySelectorAll<HTMLButtonElement>("[data-accent-option]").forEach((button) => {
    const selected = button.dataset.accentOption === accent;
    button.setAttribute("aria-pressed", String(selected));
    button.classList.toggle("active", selected);
  });
}

function setFont(font: TypographyType) {
  document.documentElement.setAttribute("data-font", font);
  localStorage.setItem("sinnotas-font", font);

  if (font !== "system") {
    document.documentElement.style.removeProperty("--ls-system-font");
    localStorage.removeItem("sinnotas-system-font");
    if (systemFontSelect) systemFontSelect.value = "";
  }

  settingsDropdownMenu.querySelectorAll<HTMLButtonElement>(".font-option-btn[data-font]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.font === font);
  });
  conceptMapView.refreshTypography();
  graphView?.refresh();
}

function setPageWidth(value: number): void {
  const clamped = Math.max(600, Math.min(1200, value));
  const width = 600 + Math.round((clamped - 600) / 20) * 20;
  document.documentElement.style.setProperty("--ls-page-width", `${width}px`);
  pageWidthSlider.value = String(width);
  pageWidthValue.value = `${width} px`;
  localStorage.setItem("sinnotas-page-width", String(width));
}

function setGlowIntensity(value: number): void {
  // Tres posiciones: 0 % sin glow, 50 % glow bajo, 100 % glow actual.
  const clamped = Math.max(0, Math.min(100, Math.round(value / 50) * 50));
  document.documentElement.style.setProperty("--ls-glow-intensity", String(clamped / 100));
  if (glowIntensitySlider) glowIntensitySlider.value = String(clamped);
  if (glowIntensityValue) glowIntensityValue.value = `${clamped}%`;
  localStorage.setItem("sinnotas-glow-intensity", String(clamped));
}

let currentFontSizes = readFontSizes();

function renderFontSizeControls(): void {
  if (!typographyControls) return;
  const fragment = document.createDocumentFragment();
  FONT_SIZE_DEFINITIONS.forEach((definition) => {
    const row = document.createElement("label");
    row.className = "typography-control";
    row.dataset.fontSizeRow = definition.key;

    const name = document.createElement("span");
    name.textContent = translate(definition.label);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(definition.min);
    input.max = String(definition.max);
    input.step = String(definition.step);
    input.value = String(currentFontSizes[definition.key]);
    input.dataset.fontSizeInput = definition.key;
    input.setAttribute("aria-label", translate(definition.label));

    const unitLabel = definition.unit === "em" ? "em" : "px";
    const output = document.createElement("output");
    output.dataset.fontSizeOutput = definition.key;
    output.value = `${currentFontSizes[definition.key]} ${unitLabel}`;

    input.addEventListener("input", () => {
      currentFontSizes[definition.key] = writeFontSize(
        definition.key,
        Number(input.value)
      );
      // Actualizar solo la variable afectada evita reescribir las otras 10
      // en cada movimiento del slider, lo que provocaba bloqueos.
      const def = fontSizeDefinition(definition.key);
      document.documentElement.style.setProperty(
        def.cssVariable,
        def.unit === "em"
          ? String(currentFontSizes[definition.key])
          : `${currentFontSizes[definition.key]}px`
      );
      if (definition.key === "ui") {
        const scale = mobileFontScale(currentFontSizes.ui);
        document.documentElement.style.setProperty("--ls-font-scale", String(scale));
        document.documentElement.style.setProperty("--mobile-font-scale", String(scale));
      }
      output.value = `${currentFontSizes[definition.key]} ${unitLabel}`;
    });

    row.append(name, input, output);
    fragment.appendChild(row);
  });

  typographyControls.replaceChildren(fragment);
  applyFontSizes(currentFontSizes);
}

function refreshFontSizeControls(): void {
  if (!typographyControls) return;
  currentFontSizes = readFontSizes();
  typographyControls
    .querySelectorAll<HTMLInputElement>("[data-font-size-input]")
    .forEach((input) => {
      const key = input.dataset.fontSizeInput as FontSizeKey | undefined;
      if (!key) return;
      const value = currentFontSizes[key];
      const unitLabel = fontSizeDefinition(key).unit === "em" ? "em" : "px";
      input.value = String(value);
      const output = typographyControls.querySelector<HTMLOutputElement>(
        `[data-font-size-output="${key}"]`
      );
      if (output) output.value = `${value} ${unitLabel}`;
    });
  applyFontSizes(currentFontSizes);
  if (flashcardTextSizeInput && flashcardTextSizeValue) {
    const value = currentFontSizes.flashcardText;
    flashcardTextSizeInput.value = String(value);
    flashcardTextSizeValue.value = `${value} em`;
  }
}

function initTypographySettings(): void {
  currentFontSizes = readFontSizes();
  renderFontSizeControls();
  btnResetTypography?.addEventListener("click", () => {
    resetFontSizes();
    refreshFontSizeControls();
    showToast(translate("Tamaños de texto restaurados"));
  });
}

let graphSettingsUiReady = false;

type FlashcardSettingsSection = "general" | "review" | "pomodoro";
const FLASHCARD_SETTINGS_SECTION_KEY = "sinnotas-flashcard-settings-section";

function isFlashcardSettingsSection(value: unknown): value is FlashcardSettingsSection {
  return value === "general" || value === "review" || value === "pomodoro";
}

function readFlashcardSettingsSection(): FlashcardSettingsSection {
  const stored = localStorage.getItem(FLASHCARD_SETTINGS_SECTION_KEY);
  return isFlashcardSettingsSection(stored) ? stored : "general";
}

function switchFlashcardSettingsSection(
  section: FlashcardSettingsSection,
  persist = true
): void {
  settingsDropdownMenu
    .querySelectorAll<HTMLButtonElement>("[data-flashcard-settings-section]")
    .forEach((tab) => {
      const selected = tab.dataset.flashcardSettingsSection === section;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
  settingsDropdownMenu
    .querySelectorAll<HTMLElement>("[data-flashcard-settings-content]")
    .forEach((panel) => {
      const selected = panel.dataset.flashcardSettingsContent === section;
      panel.hidden = !selected;
      panel.classList.toggle("active", selected);
    });
  if (persist) localStorage.setItem(FLASHCARD_SETTINGS_SECTION_KEY, section);
}

settingsDropdownMenu
  .querySelectorAll<HTMLButtonElement>("[data-flashcard-settings-section]")
  .forEach((tab) => {
    tab.addEventListener("click", () => {
      const section = tab.dataset.flashcardSettingsSection;
      if (isFlashcardSettingsSection(section)) switchFlashcardSettingsSection(section);
    });
  });

switchFlashcardSettingsSection(readFlashcardSettingsSection(), false);

/** Abre Ajustes directamente en la subsección de Flashcards indicada. */
function openFlashcardSettings(section: FlashcardSettingsSection = "general"): void {
  switchSettingsTab("flashcards");
  switchFlashcardSettingsSection(section);
  openSettingsOverlay();
}

function switchSettingsTab(tabName: string): void {
  settingsDropdownMenu.querySelectorAll<HTMLButtonElement>("[data-settings-tab]").forEach((tab) => {
    const selected = tab.dataset.settingsTab === tabName;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  settingsDropdownMenu.querySelectorAll<HTMLElement>("[data-settings-panel]").forEach((panel) => {
    const selected = panel.dataset.settingsPanel === tabName;
    panel.hidden = !selected;
    panel.classList.toggle("active", selected);
  });
  localStorage.setItem("sinnotas-settings-tab", tabName);
  if (tabName === "flashcards") {
    // Al abrir/cambiar a esta pestaña, resincronizar con el vault actual para
    // que las notas borradas desaparezcan y las nuevas aparezcan.
    renderFlashcardPagesFilter(true);
  }
  if (tabName === "saved") {
    void refreshActiveSnapshotNotesList();
  }
  if (tabName === "appearance" && settingsOverlay.isConnected) {
    ensureSystemFontsLoaded();
  }
}

settingsDropdownMenu.querySelectorAll<HTMLButtonElement>("[data-settings-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.dataset.settingsTab) switchSettingsTab(tab.dataset.settingsTab);
  });
});

const settingsTabNames = ["appearance", "flashcards", "saved", "advanced"];
// Las pestañas "Repaso" y "Pomodoro" ahora viven dentro de Flashcards, y
// "Grafo" se movió a la propia vista de grafo. Si el usuario tenía una de
// ellas seleccionada, se abre Flashcards en la subsección correspondiente.
const storedSettingsTab = localStorage.getItem("sinnotas-settings-tab");
if (storedSettingsTab === "graph") {
  localStorage.setItem("sinnotas-settings-tab", "appearance");
} else if (storedSettingsTab === "review" || storedSettingsTab === "pomodoro") {
  localStorage.setItem("sinnotas-settings-tab", "flashcards");
  localStorage.setItem(FLASHCARD_SETTINGS_SECTION_KEY, storedSettingsTab);
  switchFlashcardSettingsSection(storedSettingsTab, false);
}
const initialSettingsTab = localStorage.getItem("sinnotas-settings-tab");
switchSettingsTab(
  initialSettingsTab && settingsTabNames.includes(initialSettingsTab)
    ? initialSettingsTab
    : "appearance"
);

// Flashcard settings
flashcardReviewOrderSelect.value = flashcardReviewOrder;
flashcardReviewOrderSelect.addEventListener("change", () => {
  const value = flashcardReviewOrderSelect.value;
  if (value !== "new-first" && value !== "reviews-first" && value !== "mixed") return;
  flashcardReviewOrder = value;
  localStorage.setItem("sinnotas-flashcard-review-order", value);
  if (currentView === "flashcards") startFlashcardsSession();
  showToast(translate("Orden de repaso actualizado."));
});

// Tamaño de texto de la tarjeta: 0.8em (mínimo) a 3em (máximo), 1em por defecto.
function syncFlashcardSizeControls(): void {
  const value = clampFontSize("flashcardText", currentFontSizes.flashcardText);
  if (cardFontSizeValue) cardFontSizeValue.value = `${value} em`;
  if (cardFontDecreaseButton) cardFontDecreaseButton.disabled = value <= 0.8;
  if (cardFontIncreaseButton) cardFontIncreaseButton.disabled = value >= 3;
}

/** Ajusta el texto de la tarjeta con los botones − / + sin abrir Ajustes. */
function nudgeFlashcardTextSize(delta: number): void {
  const next = clampFontSize("flashcardText", currentFontSizes.flashcardText + delta);
  if (next === currentFontSizes.flashcardText) return;
  applyFlashcardTextSize(next);
  if (currentView === "flashcards") updateFlashcardUI();
}

function applyFlashcardTextSize(value: number): void {
  const clamped = writeFontSize("flashcardText", value);
  currentFontSizes.flashcardText = clamped;
  applyFontSizes(currentFontSizes);
  if (flashcardTextSizeInput) flashcardTextSizeInput.value = String(clamped);
  if (flashcardTextSizeValue) flashcardTextSizeValue.value = `${clamped} em`;
  syncFlashcardSizeControls();
  // Mantiene el control de Apariencia en sintonía cuando el cambio viene de
  // los botones − / + de la tarjeta (T13).
  refreshFontSizeControls();
}

if (flashcardTextSizeInput && flashcardTextSizeValue) {
  const initial = clampFontSize("flashcardText", currentFontSizes.flashcardText);
  flashcardTextSizeInput.value = String(initial);
  flashcardTextSizeValue.value = `${initial} em`;
  document.documentElement.style.setProperty("--ls-flashcard-text-em", String(initial));
  flashcardTextSizeInput.addEventListener("input", () => {
    applyFlashcardTextSize(Number.parseFloat(flashcardTextSizeInput!.value));
    if (currentView === "flashcards") updateFlashcardUI();
  });
}
syncFlashcardSizeControls();

cardFontDecreaseButton?.addEventListener("click", () => nudgeFlashcardTextSize(-0.1));
cardFontIncreaseButton?.addEventListener("click", () => nudgeFlashcardTextSize(0.1));

btnOpenFlashcardSettings?.addEventListener("click", () => openFlashcardSettings("general"));
btnOpenReviewSettings?.addEventListener("click", () => openFlashcardSettings("review"));
btnOpenPomodoroSettings?.addEventListener("click", () => openFlashcardSettings("pomodoro"));

/** Fecha de creación (ms) de una nota: diarios usan su journalDate; el resto
 * la birthtime del archivo pedida al backend. `undefined` = aún desconocida. */
function flashcardPageCreatedMs(page: PageData | undefined): number | null {
  if (page?.journalDate) {
    const parsed = Date.parse(`${page.journalDate}T00:00:00Z`);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (!page) return null;
  // El snapshot de Rust ya trae la creación: evita una invocación extra.
  if (typeof page.createdAtMs === "number" && Number.isFinite(page.createdAtMs)) {
    return page.createdAtMs;
  }
  const root = vault.getActiveRootPath() ?? "";
  const cached = flashcardPagesCreatedTimes.get(`${root}\u0000${page.path}`);
  return cached === null || cached === undefined ? null : cached;
}

/** Pide al backend las fechas de creación faltantes (una sola invocación por
 * lote) y devuelve true si al terminar quedaron datos nuevos para ordenar. */
async function fillFlashcardPagesCreatedTimes(titles: string[]): Promise<boolean> {
  if (flashcardPagesCreatedTimesInFlight) return false;
  const root = vault.getActiveRootPath() ?? "";
  const missing = [
    ...new Set(
      titles
        .map((title) => vault.getPageByTitle(title))
        .filter((page): page is PageData => Boolean(page))
        .filter((page) => !page.journalDate)
        .filter((page) => !flashcardPagesCreatedTimes.has(`${root}\u0000${page.path}`))
        .map((page) => page.path),
    ),
  ];
  if (missing.length === 0) return false;

  flashcardPagesCreatedTimesInFlight = true;
  try {
    const response = await invoke<
      Array<{ path: string; createdAt: number | null }>
    >("read_note_created_times", { paths: missing });
    response.forEach((entry) => {
      flashcardPagesCreatedTimes.set(`${root}\u0000${entry.path}`, entry.createdAt);
    });
    // Lotes cuyo backend falló devuelven null: guardados para no reintentar en bucle.
    missing.forEach((path) => {
      if (!flashcardPagesCreatedTimes.has(`${root}\u0000${path}`)) {
        flashcardPagesCreatedTimes.set(`${root}\u0000${path}`, null);
      }
    });
    return true;
  } catch {
    // Sin fechas del backend la ordenación por creación deja las desconocidas al final.
    missing.forEach((path) => {
      flashcardPagesCreatedTimes.set(`${root}\u0000${path}`, null);
    });
    return false;
  } finally {
    flashcardPagesCreatedTimesInFlight = false;
  }
}

/** Fecha más antigua de las notas que forman un mazo, incluidos sus hijos.
 * Se usa para ordenar el árbol por creación sin romper la jerarquía. */
function buildFlashcardDeckCreatedCache(tree: DeckTree): Map<string, number | null> {
  const cache = new Map<string, number | null>();

  const visit = (node: DeckNode): number | null => {
    let earliest: number | null = null;
    for (const title of node.pageTitles) {
      const createdAt = flashcardPageCreatedMs(vault.getPageByTitle(title));
      if (createdAt !== null && (earliest === null || createdAt < earliest)) {
        earliest = createdAt;
      }
    }
    for (const child of node.children) {
      const childCreatedAt = visit(child);
      if (childCreatedAt !== null && (earliest === null || childCreatedAt < earliest)) {
        earliest = childCreatedAt;
      }
    }
    cache.set(node.id, earliest);
    return earliest;
  };

  tree.roots.forEach(visit);
  return cache;
}

/** Comparador del árbol según el orden elegido en Ajustes. */
function createFlashcardDeckComparator(
  tree: DeckTree
): (left: DeckNode, right: DeckNode) => number {
  if (flashcardPagesSortMode === "title-asc") return compareDeckNodesByName;
  if (flashcardPagesSortMode === "title-desc") {
    return (left, right) => -compareDeckNodesByName(left, right);
  }

  const createdCache = buildFlashcardDeckCreatedCache(tree);
  return (left, right) => {
    const leftCreated = createdCache.get(left.id) ?? null;
    const rightCreated = createdCache.get(right.id) ?? null;
    if (leftCreated === null && rightCreated === null) {
      return compareDeckNodesByName(left, right);
    }
    if (leftCreated === null) return 1;
    if (rightCreated === null) return -1;
    const difference =
      flashcardPagesSortMode === "created-desc"
        ? rightCreated - leftCreated
        : leftCreated - rightCreated;
    return difference || compareDeckNodesByName(left, right);
  };
}

/** Estado efectivo de una nota: borrador del usuario > filtro guardado. */
function flashcardPageSelected(title: string): boolean {
  return flashcardPagesDraftSelection.has(title)
    ? (flashcardPagesDraftSelection.get(title) as boolean)
    : flashcardPageDefaultState(title);
}

/** Vuelve a pintar el árbol conservando la posición del scroll. */
function renderFlashcardDecksPreservingScroll(): void {
  const scrollTop = flashcardPagesList.scrollTop;
  renderFlashcardPagesFilter(false);
  flashcardPagesList.scrollTop = scrollTop;
}

/** Marca o desmarca un mazo completo, incluidos todos sus descendientes. */
function setFlashcardDeckSelection(node: DeckNode, selected: boolean): void {
  for (const title of collectDeckPageTitles(node)) {
    flashcardPagesDraftSelection.set(title, selected);
  }
  updateFlashcardPagesDirtyState();
  renderFlashcardDecksPreservingScroll();
}

/** Añade una fila del árbol con su indentación y su casilla tri-estado. */
function appendFlashcardDeckRow(
  node: DeckNode,
  depth: number,
  matchedBySearch: boolean
): void {
  const row = document.createElement("div");
  row.className = "flashcard-deck-row";
  row.classList.toggle("is-search-match", matchedBySearch);
  row.style.setProperty("--deck-depth", String(depth));
  row.setAttribute("role", "treeitem");
  row.setAttribute("aria-level", String(depth + 1));
  row.title = node.path.join(DECK_SEPARATOR);

  if (node.children.length > 0) {
    const collapsed = flashcardDeckCollapsed.has(node.id);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "flashcard-deck-toggle";
    toggle.setAttribute("aria-label", collapsed ? "Expandir mazo" : "Contraer mazo");
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.textContent = collapsed ? "▸" : "▾";
    toggle.addEventListener("click", () => {
      if (flashcardDeckCollapsed.has(node.id)) flashcardDeckCollapsed.delete(node.id);
      else flashcardDeckCollapsed.add(node.id);
      renderFlashcardDecksPreservingScroll();
    });
    row.appendChild(toggle);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "flashcard-deck-toggle is-placeholder";
    spacer.setAttribute("aria-hidden", "true");
    row.appendChild(spacer);
  }

  const label = document.createElement("label");
  label.className = "flashcard-deck-label";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  const state = getDeckSelectionState(node, flashcardPageSelected);
  checkbox.checked = state === "checked";
  checkbox.indeterminate = state === "indeterminate";
  checkbox.setAttribute("aria-label", node.path.join(DECK_SEPARATOR));
  checkbox.addEventListener("change", () => {
    setFlashcardDeckSelection(node, checkbox.checked);
  });
  label.appendChild(checkbox);

  const name = document.createElement("span");
  name.className = "flashcard-deck-name";
  name.textContent = node.name;
  label.appendChild(name);
  row.appendChild(label);

  const count = document.createElement("span");
  count.className = "flashcard-deck-count";
  const cardLabel = translate(node.totalCardCount === 1 ? "tarjeta" : "tarjetas");
  const noteLabel = translate(node.totalPageCount === 1 ? "nota" : "notas");
  count.textContent =
    node.totalPageCount > 1
      ? `${node.totalCardCount} ${cardLabel} · ${node.totalPageCount} ${noteLabel}`
      : `${node.totalCardCount} ${cardLabel}`;
  row.appendChild(count);

  flashcardPagesList.appendChild(row);
}

/** Renderiza el árbol de mazos formado por los títulos de las notas.
 * Cada nota es un mazo; `→` en el título separa mazos y submazos. La
 * selección se guarda como títulos exactos de notas, así que el árbol es solo
 * una capa de presentación sobre el mismo filtro de siempre. */
function showFlashcardPagesLoading(message = "Escaneando notas…"): void {
  if (!flashcardPagesList || !flashcardPagesContainer) return;
  flashcardPagesContainer.hidden = false;
  flashcardPagesList.replaceChildren();
  flashcardPagesTotalPages = 1;
  const loading = document.createElement("div");
  loading.className = "settings-help";
  loading.id = "flashcard-pages-loading";
  loading.style.margin = "0";
  loading.innerText = message;
  flashcardPagesList.appendChild(loading);
  if (btnFlashcardPagesSave) btnFlashcardPagesSave.disabled = true;
  if (flashcardPagesStatus) flashcardPagesStatus.textContent = "";
  const paginationEl = document.getElementById("flashcard-pages-pagination");
  if (paginationEl) paginationEl.hidden = true;
}

function updateFlashcardPagesProgress(progress: FlashcardLoadProgress): void {
  const loading = document.getElementById("flashcard-pages-loading");
  if (!loading) return;
  const total = Math.max(1, progress.totalPages);
  const percent = Math.min(100, Math.round((progress.scannedPages / total) * 100));
  loading.innerText = `Escaneando notas… ${percent}% (${progress.cards} ${
    progress.cards === 1 ? "tarjeta" : "tarjetas"
  })`;
}

function renderFlashcardPagesFilter(_scanVault = true): void {
  if (!flashcardPagesList || !flashcardPagesContainer) return;

  if (!desktopReady) {
    showFlashcardPagesLoading("Preparando las notas…");
    return;
  }

  const vaultPages = vault.getPages();
  const version = vault.getMutationVersion();
  const cached = flashcardLoader.getCachedCards(vaultPages, version);

  if (!cached) {
    // Sin caché hay que escanear; `scanVault=false` solo evita reescanear
    // cuando ya hay datos, no deja la lista atascada en "Escaneando".
    // El estado de carga se pinta antes de arrancar: con un vault vacío el
    // escaneo termina de forma síncrona y su render debe ser el último.
    showFlashcardPagesLoading();
    if (!flashcardLoader.isLoading()) {
      ensureFlashcardScan({
        order: flashcardReviewOrder,
        onDone: () => renderFlashcardPagesFilter(false),
      });
    }
    return;
  }

  // Si la caché es válida pero el manager aún no la tiene (por ejemplo, tras
  // abrir Ajustes antes que Flashcards), aplicarla sin volver a escanear.
  if (flashcardsManager.getAllCards() !== cached) {
    const active = flashcardsManager.getCurrentCard();
    flashcardsManager.setDetectedCards(
      cached,
      flashcardReviewOrder,
      active ? { cardId: active.id, revealed: flashcardsManager.isRevealed() } : undefined
    );
  }

  const pages = flashcardsManager.getPagesWithCards();
  const pageByNormalizedTitle = new Map(
    pages.map((title) => [normalizeDeckTitle(title).toLowerCase(), title])
  );

  // El borrador puede contener notas que ya no existen (borradas o renombradas).
  // Se descartan para no conservar selecciones fantasma; si solo cambió el
  // separador (`::` → `→`), se traslada la selección al título actual.
  for (const title of [...flashcardPagesDraftSelection.keys()]) {
    const actualTitle = pageByNormalizedTitle.get(normalizeDeckTitle(title).toLowerCase());
    if (!actualTitle) {
      flashcardPagesDraftSelection.delete(title);
    } else if (actualTitle !== title) {
      const selected = flashcardPagesDraftSelection.get(title) as boolean;
      flashcardPagesDraftSelection.delete(title);
      flashcardPagesDraftSelection.set(actualTitle, selected);
    }
  }

  // Si el filtro guardado apunta a notas que ya no existen en este vault,
  // descartar esas entradas (o volver a "todas" si no queda ninguna). También
  // se resuelven alias antiguos (`::`) al título exacto que hay en el vault.
  if (flashcardPageFilter !== null) {
    const validFilter = [
      ...new Set(
        flashcardPageFilter
          .map((title) => pageByNormalizedTitle.get(normalizeDeckTitle(title).toLowerCase()))
          .filter((title): title is string => Boolean(title))
      ),
    ];
    const filterChanged =
      validFilter.length !== flashcardPageFilter.length ||
      validFilter.some((title, index) => title !== flashcardPageFilter?.[index]);
    if (filterChanged) {
      flashcardPageFilter = flashcardPageFilter.length > 0 && validFilter.length === 0
        ? null
        : validFilter;
      localStorage.setItem("sinnotas-flashcard-pages", JSON.stringify(flashcardPageFilter));
      flashcardsManager.setPageFilter(flashcardPageFilter);
    }
  }

  if (pages.length === 0) {
    flashcardPagesList.replaceChildren();
    flashcardPagesTotalPages = 1;
    const empty = document.createElement("div");
    empty.className = "settings-help";
    empty.style.margin = "0";
    empty.innerText = "No se encontraron notas con flashcards en el vault.";
    flashcardPagesList.appendChild(empty);
    flashcardPagesContainer.hidden = true;
    if (btnFlashcardPagesSave) btnFlashcardPagesSave.disabled = true;
    if (flashcardPagesStatus) flashcardPagesStatus.textContent = "";
    const paginationEl = document.getElementById("flashcard-pages-pagination");
    if (paginationEl) paginationEl.hidden = true;
    return;
  }
  flashcardPagesContainer.hidden = false;

  // Las fechas se piden en segundo plano; al llegar se reordena el árbol.
  if (flashcardPagesSortMode.startsWith("created-")) {
    void fillFlashcardPagesCreatedTimes(pages).then((changed) => {
      if (changed) renderFlashcardDecksPreservingScroll();
    });
  }

  const tree = buildDeckTree(pages, {
    cardCount: (title) => flashcardsManager.getCardCountForPage(title),
  });
  sortDeckTree(tree, createFlashcardDeckComparator(tree));
  const search = searchDeckTree(tree, flashcardPagesSearchText);
  const visibleRoots = visibleDeckRoots(tree, search);

  // Se pagina por mazos raíz completos: así un mazo y sus hijos nunca quedan
  // separados entre dos páginas. Lo contraído no ocupa espacio.
  const totalPages = Math.max(1, Math.ceil(visibleRoots.length / FLASHCARD_PAGES_PER_PAGE));
  flashcardPagesTotalPages = totalPages;
  if (flashcardPagesCurrentPage > totalPages) flashcardPagesCurrentPage = totalPages;
  if (flashcardPagesCurrentPage < 1) flashcardPagesCurrentPage = 1;
  const start = (flashcardPagesCurrentPage - 1) * FLASHCARD_PAGES_PER_PAGE;
  const pageRoots = visibleRoots.slice(start, start + FLASHCARD_PAGES_PER_PAGE);
  const rows = flattenDeckRows(pageRoots, search, (nodeId) =>
    flashcardDeckCollapsed.has(nodeId)
  );

  const paginationEl = document.getElementById("flashcard-pages-pagination");
  const prevBtn = document.getElementById("flashcard-pages-prev") as HTMLButtonElement | null;
  const nextBtn = document.getElementById("flashcard-pages-next") as HTMLButtonElement | null;
  const pageInfoEl = document.getElementById("flashcard-pages-page-info") as HTMLSpanElement | null;

  if (totalPages > 1 && paginationEl) {
    paginationEl.hidden = false;
    if (prevBtn) prevBtn.disabled = flashcardPagesCurrentPage === 1;
    if (nextBtn) nextBtn.disabled = flashcardPagesCurrentPage === totalPages;
    if (pageInfoEl) pageInfoEl.textContent = `Página ${flashcardPagesCurrentPage} de ${totalPages}`;
  } else if (paginationEl) {
    paginationEl.hidden = true;
  }

  flashcardPagesList.replaceChildren();

  if (visibleRoots.length === 0) {
    flashcardPagesTotalPages = 1;
    if (paginationEl) paginationEl.hidden = true;
    const empty = document.createElement("div");
    empty.className = "settings-help";
    empty.style.margin = "0";
    empty.innerText = "No hay mazos ni notas que coincidan con la búsqueda.";
    flashcardPagesList.appendChild(empty);
    updateFlashcardPagesDirtyState();
    return;
  }

  rows.forEach(({ node, depth }) => {
    appendFlashcardDeckRow(node, depth, search.matched.has(node.id));
  });

  updateFlashcardPagesDirtyState();
}

btnFlashcardPagesSelectAll.addEventListener("click", () => {
  flashcardsManager.getPagesWithCards().forEach((title) => {
    flashcardPagesDraftSelection.set(title, true);
  });
  updateFlashcardPagesDirtyState();
  renderFlashcardDecksPreservingScroll();
});

btnFlashcardPagesSelectNone.addEventListener("click", () => {
  flashcardsManager.getPagesWithCards().forEach((title) => {
    flashcardPagesDraftSelection.set(title, false);
  });
  updateFlashcardPagesDirtyState();
  renderFlashcardDecksPreservingScroll();
});

btnFlashcardPagesSave.addEventListener("click", saveFlashcardPagesSelection);

/** Sincroniza el valor del selector de orden con el estado persistido. */
function syncFlashcardPagesSortValue(): void {
  if (flashcardPagesSort) flashcardPagesSort.value = flashcardPagesSortMode;
}

if (flashcardPagesSearch) {
  flashcardPagesSearch.addEventListener("input", () => {
    flashcardPagesSearchText = flashcardPagesSearch.value.trim();
    // La búsqueda redefine los resultados: volver a la primera página.
    flashcardPagesCurrentPage = 1;
    renderFlashcardPagesFilter(false);
    flashcardPagesList.scrollTop = 0;
  });
}

if (flashcardPagesSort) {
  syncFlashcardPagesSortValue();
  flashcardPagesSort.addEventListener("change", () => {
    const selected = flashcardPagesSort.value;
    flashcardPagesSortMode =
      selected !== null && FLASHCARD_PAGES_SORT_MODES.includes(selected as FlashcardPagesSortMode)
        ? (selected as FlashcardPagesSortMode)
        : "title-asc";
    localStorage.setItem(FLASHCARD_PAGES_SORT_STORAGE_KEY, flashcardPagesSortMode);
    // Cambiar la clasificación reinicia el paginado desde la primera página.
    flashcardPagesCurrentPage = 1;
    renderFlashcardPagesFilter(false);
    flashcardPagesList.scrollTop = 0;
  });
}

document.getElementById("flashcard-pages-prev")?.addEventListener("click", () => {
  if (flashcardPagesCurrentPage > 1) {
    flashcardPagesCurrentPage--;
    renderFlashcardPagesFilter(false);
    flashcardPagesList.scrollTop = 0;
  }
});

document.getElementById("flashcard-pages-next")?.addEventListener("click", () => {
  // Usa el total ya calculado con la búsqueda aplicada; el vault completo no
  // sirve cuando la lista visible está filtrada.
  if (flashcardPagesCurrentPage < flashcardPagesTotalPages) {
    flashcardPagesCurrentPage++;
    renderFlashcardPagesFilter(false);
    flashcardPagesList.scrollTop = 0;
  }
});

/** Lee la selección efectiva y devuelve el filtro equivalente
 * (null = todas las notas; array = solo esas; array vacío = ninguna).
 * Prioridad: borrador del usuario (sobrevive al paginado y a la búsqueda) >
 * estado guardado; las notas nunca tocadas quedan como estaban. */
function readFlashcardPagesSelection(): string[] | null {
  const pages = flashcardsManager.getPagesWithCards();
  const effective = pages.filter((title) =>
    flashcardPagesDraftSelection.has(title)
      ? flashcardPagesDraftSelection.get(title)
      : flashcardPageDefaultState(title)
  );
  return effective.length === pages.length && pages.length > 0 ? null : effective;
}

/** Compara la selección actual con la guardada y habilita el botón Guardar si difiere. */
function updateFlashcardPagesDirtyState(): void {
  if (!btnFlashcardPagesSave || !flashcardPagesStatus) return;
  const effective = readFlashcardPagesSelection();
  const normalize = (value: string[] | null) => (value === null ? null : [...value].sort());
  const dirty = JSON.stringify(normalize(effective)) !== JSON.stringify(normalize(flashcardPageFilter));
  btnFlashcardPagesSave.disabled = !dirty;
  flashcardPagesStatus.textContent = dirty ? translate("Cambios sin guardar") : "";
}

/** Aplica y persiste la selección de notas marcadas, y reinicia la sesión de repaso. */
function saveFlashcardPagesSelection(): void {
  const effective = readFlashcardPagesSelection();
  flashcardPageFilter = effective;
  localStorage.setItem("sinnotas-flashcard-pages", JSON.stringify(flashcardPageFilter));
  flashcardsManager.setPageFilter(flashcardPageFilter);
  // La selección guardada se vuelve el "estado base"; el borrador se limpia.
  flashcardPagesDraftSelection.clear();
  if (currentView === "flashcards") startFlashcardsSession();
  renderFlashcardPagesFilter(false);
  showToast(
    effective === null
      ? translate("Se repasarán las tarjetas de todas las notas.")
      : effective.length === 0
        ? translate("No hay notas seleccionadas: no se repasará ninguna tarjeta.")
        : translate("Se repasarán solo las tarjetas de las notas seleccionadas.")
  );
}

function renderFlashcardRecalcControls(): void {
  const reset = flashcardRecalcActionSelect.value === "reset";
  flashcardRecalcHelp.textContent = translate(
    reset
      ? "Elimina las propiedades de programación FSRS y convierte todas las tarjetas en nuevas. Esta acción no se puede deshacer."
      : "Recalcula la fecha de vencimiento usando la última revisión y el intervalo programado."
  );
  btnFlashcardRecalc.textContent = translate(
    reset ? "Restablecer propiedades" : "Recalcular fechas"
  );
}

flashcardRecalcActionSelect.addEventListener("change", () => {
  flashcardRecalcStatus.textContent = "";
  renderFlashcardRecalcControls();
});
renderFlashcardRecalcControls();

btnFlashcardRecalc.addEventListener("click", async () => {
  const action = flashcardRecalcActionSelect.value === "reset" ? "reset" : "due-dates";
  if (action === "reset") {
    const confirmed = await confirmAction(
      "Se eliminará el progreso de repaso de todas las tarjetas y volverán a contar como nuevas. ¿Continuar?",
      "Restablecer propiedades"
    );
    if (!confirmed) return;
  }

  flashcardRecalcStatus.textContent = "";
  flashcardRecalcActionSelect.disabled = true;
  btnFlashcardRecalc.disabled = true;
  btnFlashcardRecalc.textContent = translate("Procesando...");

  try {
    flashcardsManager.scanVault(vault.getPages(), flashcardReviewOrder);
    const uniqueCards = new Map<string, Flashcard>();
    const cardCountByBlock = new Map<string, number>();
    flashcardsManager.getAllCards().forEach((card) => {
      const key = `${card.pageTitle}\u0000${card.blockId}`;
      uniqueCards.set(key, card);
      cardCountByBlock.set(key, (cardCountByBlock.get(key) || 0) + 1);
    });

    const pages = vault.getPages();
    const pageByTitle = new Map(pages.map((page) => [page.title.toLowerCase(), page]));
    const changedPages = new Set<PageData>();
    let updatedCards = 0;

    for (const [key, card] of uniqueCards) {
      const page = pageByTitle.get(card.pageTitle.toLowerCase());
      if (!page) continue;
      const location = findNodeLocation(page.blocks, card.blockId);
      if (!location) continue;

      const block = location.parentList[location.index];
      const updatedContent =
        action === "reset"
          ? FlashcardsManager.clearFSRSProgress(block.content)
          : FlashcardsManager.recalculateDueDate(block.content);
      if (updatedContent === null || updatedContent === block.content) continue;

      block.content = updatedContent;
      changedPages.add(page);
      updatedCards += cardCountByBlock.get(key) || 1;
    }

    if (changedPages.size > 0) {
      await Promise.all(Array.from(changedPages).map((page) => vault.savePage(page)));
      const currentPageChanged = Array.from(changedPages).some(
        (page) => page.id === currentPage.id
      );
      if (currentPageChanged) {
        currentPage = vault.getPageByTitle(currentPage.title) || currentPage;
        if (currentView === "editor") renderEditor();
      }
      renderSidebar();
      if (currentView === "flashcards") startFlashcardsSession();
    }

    const message =
      updatedCards > 0
        ? `${translate("Tarjetas actualizadas:")} ${updatedCards}`
        : translate("No había tarjetas que actualizar.");
    flashcardRecalcStatus.textContent = message;
    showToast(message);
  } catch (error) {
    console.error("No se pudieron recalcular las propiedades de las Flashcards:", error);
    const message = translate("No se pudieron actualizar las propiedades de las tarjetas.");
    flashcardRecalcStatus.textContent = message;
    showToast(message);
  } finally {
    flashcardRecalcActionSelect.disabled = false;
    btnFlashcardRecalc.disabled = false;
    renderFlashcardRecalcControls();
  }
});

// Gamepad Configuration
const gamepadMappingActionKeys = [
  "sinnotas-gamepad-btn-again",
  "sinnotas-gamepad-btn-hard",
  "sinnotas-gamepad-btn-good",
  "sinnotas-gamepad-btn-easy",
  "sinnotas-gamepad-btn-show-answer",
  "sinnotas-gamepad-btn-focus-mode",
  "sinnotas-gamepad-btn-undo-review",
  "sinnotas-gamepad-btn-redo-review",
] as const;

/** Rellena el selector de tipo de mando. */
CONTROLLER_TYPE_OPTIONS.forEach((option) => {
  const el = document.createElement("option");
  el.value = option.value;
  el.textContent = option.label;
  gamepadControllerTypeSelect.appendChild(el);
});

/** Rellena cada select de mapeo con las etiquetas del tipo de mando elegido,
 * conservando el valor guardado si sigue siendo válido. */
function populateGamepadMappingSelects(): void {
  const labels = buttonLabelsFor(gamepadControllerTypeSelect.value as ControllerType | "");
  gamepadMappingSelects.forEach((select) => {
    const previous = select.value;
    select.replaceChildren();
    const none = document.createElement("option");
    none.value = "";
    none.textContent = translate("No asignado");
    select.appendChild(none);
    labels.forEach((label, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${label}`;
      select.appendChild(option);
    });
    // Restaurar valor guardado solo si el índice sigue existiendo.
    select.value = previous;
  });
}

// Cargar valores guardados del tipo de mando y mapeos.
const storedControllerType = localStorage.getItem("sinnotas-gamepad-controller-type");
gamepadControllerTypeSelect.value =
  storedControllerType && CONTROLLER_TYPE_OPTIONS.some((o) => o.value === storedControllerType)
    ? storedControllerType
    : "";
populateGamepadMappingSelects();
gamepadMappingSelects.forEach((select, index) => {
  select.value = localStorage.getItem(gamepadMappingActionKeys[index]) || "";
});
gamepadEnabledCheckbox.checked = localStorage.getItem("sinnotas-gamepad-enabled") === "true";

function updateGamepadStatus(): void {
  if (!gamepadEnabledCheckbox.checked) {
    gamepadStatusIndicator.textContent = translate("Mando desactivado");
    gamepadStatusIndicator.style.color = "var(--ls-text-muted)";
    return;
  }
  const gp = firstConnectedGamepad();
  if (gp) {
    gamepadStatusIndicator.textContent = `${translate("Mando conectado")}: ${gp.id}`;
  } else {
    gamepadStatusIndicator.textContent = translate("Mando no detectado");
  }
  gamepadStatusIndicator.style.color = gp
    ? "var(--ls-bullet-color)"
    : "var(--ls-text-muted)";
}

/** Acción de gamepad: solo se ejecuta en la vista de flashcards y,
 * para calificar, únicamente tras haber revelado la respuesta. */
function handleGamepadButton(index: number): void {
  if (currentView !== "flashcards" || flashcardExplorerActive) return;
  const idx = String(index);
  if (idx === gamepadBtnShowAnswer.value) {
    if (!flashcardsManager.isRevealed()) handleRevealAnswer();
    return;
  }
  if (idx === gamepadBtnFocusMode.value) {
    flashcardFocusToggle.click();
    return;
  }
  if (idx === gamepadBtnUndoReview.value) {
    void undoLastReview();
    return;
  }
  if (idx === gamepadBtnRedoReview.value) {
    void redoLastReview();
    return;
  }
  // Calificar solo después de revelar (evita saltarse tarjetas por accidente).
  if (!flashcardsManager.isRevealed()) return;
  if (idx === gamepadBtnAgain.value) applyFSRSRating(1);
  else if (idx === gamepadBtnHard.value) applyFSRSRating(2);
  else if (idx === gamepadBtnGood.value) applyFSRSRating(3);
  else if (idx === gamepadBtnEasy.value) applyFSRSRating(4);
}

/** Desplaza la vista de Flashcards con el joystick (eje vertical). */
function handleGamepadAxes(gamepad: Gamepad): void {
  if (currentView !== "flashcards" || flashcardExplorerActive) return;
  const axes = gamepad.axes || [];
  let value = axes.length >= 2 ? axes[1] ?? 0 : 0;
  if (Math.abs(value) < 0.25 && axes.length >= 4) value = axes[3] ?? 0;
  if (Math.abs(value) < 0.25) return;
  const view = document.getElementById("view-flashcards");
  const scrollRoot = view ? findScrollableAncestor(view) : null;
  if (!scrollRoot) return;
  const speed = Math.sign(value) * Math.min(24, Math.ceil((Math.abs(value) - 0.25) * 40));
  scrollRoot.scrollTop += speed;
}

function startGamepadPolling(): void {
  if (gamepadListener) return;
  // El listener usa detección de flanco: cada pulsación se dispara una sola
  // vez, aunque se mantenga el botón mantenido (evita el ráfago de toggles).
  gamepadListener = new GamepadListener(
    (buttonIndex) => handleGamepadButton(buttonIndex),
    (gamepad) => handleGamepadAxes(gamepad)
  );
  gamepadListener.start();
  updateGamepadStatus();
}

function stopGamepadPolling(): void {
  gamepadListener?.stop();
  gamepadListener = null;
  updateGamepadStatus();
}

gamepadEnabledCheckbox.addEventListener("change", () => {
  localStorage.setItem("sinnotas-gamepad-enabled", String(gamepadEnabledCheckbox.checked));
  if (gamepadEnabledCheckbox.checked) startGamepadPolling();
  else stopGamepadPolling();
});

gamepadMappingSelects.forEach((select, index) => {
  select.addEventListener("change", () => {
    localStorage.setItem(gamepadMappingActionKeys[index], select.value);
  });
});

gamepadControllerTypeSelect.addEventListener("change", () => {
  localStorage.setItem("sinnotas-gamepad-controller-type", gamepadControllerTypeSelect.value);
  populateGamepadMappingSelects();
});

// Botón "Detectar mando": los navegadores solo exponen gamepads tras un gesto
// del usuario, así que conviene un sondeo explícito con feedback.
btnGamepadDetect.addEventListener("click", () => {
  gamepadStatusIndicator.textContent = translate("Buscando gamepad... pulse un botón...");
  gamepadStatusIndicator.style.color = "var(--ls-text-muted)";
  let attempts = 0;
  const probe = window.setInterval(() => {
    attempts += 1;
    const gp = firstConnectedGamepad();
    if (gp || attempts >= 20) {
      clearInterval(probe);
      if (!gamepadEnabledCheckbox.checked) {
        gamepadEnabledCheckbox.checked = true;
        localStorage.setItem("sinnotas-gamepad-enabled", "true");
        startGamepadPolling();
      } else {
        updateGamepadStatus();
      }
    }
  }, 250);
});

window.addEventListener("gamepadconnected", () => {
  if (!gamepadEnabledCheckbox.checked) {
    gamepadEnabledCheckbox.checked = true;
    localStorage.setItem("sinnotas-gamepad-enabled", "true");
    startGamepadPolling();
  } else {
    updateGamepadStatus();
  }
});
window.addEventListener("gamepaddisconnected", updateGamepadStatus);

if (gamepadEnabledCheckbox.checked) startGamepadPolling();
updateGamepadStatus();

pomodoroFocusDurationInput.addEventListener("change", () => {
  const value = Math.max(1, Math.min(120, Number(pomodoroFocusDurationInput.value) || 25));
  pomodoroFocusMinutes = value;
  pomodoroFocusDurationInput.value = String(value);
  localStorage.setItem("sinnotas-pomodoro-focus", String(value));
  if (pomodoroMode === "focus" && pomodoroInterval === null) {
    pomodoroRemainingSeconds = value * 60;
    renderPomodoro();
  }
});

pomodoroBreakDurationInput.addEventListener("change", () => {
  const value = Math.max(1, Math.min(60, Number(pomodoroBreakDurationInput.value) || 5));
  pomodoroBreakMinutes = value;
  pomodoroBreakDurationInput.value = String(value);
  localStorage.setItem("sinnotas-pomodoro-break", String(value));
  if (pomodoroMode === "break" && !pomodoroIsLongBreak && pomodoroInterval === null) {
    pomodoroRemainingSeconds = value * 60;
    renderPomodoro();
  }
});

pomodoroLongBreakDurationInput.addEventListener("change", () => {
  const value = Math.max(1, Math.min(120, Number(pomodoroLongBreakDurationInput.value) || 15));
  pomodoroLongBreakMinutes = value;
  pomodoroLongBreakDurationInput.value = String(value);
  localStorage.setItem("sinnotas-pomodoro-long-break", String(value));
  if (pomodoroMode === "break" && pomodoroIsLongBreak && pomodoroInterval === null) {
    pomodoroRemainingSeconds = value * 60;
    renderPomodoro();
  }
});

pomodoroSessionsBeforeLongBreakInput.addEventListener("change", () => {
  const value = Math.max(1, Math.min(12, Number(pomodoroSessionsBeforeLongBreakInput.value) || 4));
  pomodoroSessionsBeforeLongBreak = value;
  pomodoroSessionsBeforeLongBreakInput.value = String(value);
  localStorage.setItem("sinnotas-pomodoro-sessions", String(value));
});

pomodoroShowHeadbarInput.addEventListener("change", () => {
  pomodoroHeadbarVisible = pomodoroShowHeadbarInput.checked;
  localStorage.setItem("sinnotas-pomodoro-headbar", String(pomodoroHeadbarVisible));
  renderPomodoro();
});

pomodoroSoundInput.addEventListener("change", () => {
  pomodoroSoundEnabled = pomodoroSoundInput.checked;
  localStorage.setItem("sinnotas-pomodoro-sound", String(pomodoroSoundEnabled));
  // Crear/reanudar el contexto dentro del gesto del usuario evita que el
  // primer aviso quede bloqueado por la política de autoplay del WebView.
  if (pomodoroSoundEnabled) void pomodoroAudio();
});

function clearBlockProperties(blocks: BlockNode[]): number {
  let removed = 0;
  blocks.forEach((block) => {
    const { text, properties } = splitBlockProperties(block.content);
    removed += properties.length;
    block.content = text;
    removed += clearBlockProperties(block.children);
  });
  return removed;
}

[flashcardKeyAgain, flashcardKeyHard, flashcardKeyGood, flashcardKeyEasy].forEach((input) => {
  input.addEventListener("change", () => {
    localStorage.setItem(`sinnotas-${input.id}`, input.value);
  });
});

btnClearBulletProperties.addEventListener("click", async () => {
  const confirmed = await confirmAction(
    "Se eliminarán las propiedades de todos los bullets y el Frontmatter de las páginas del vault activo. El texto de las notas y sus archivos se conservarán. ¿Continuar?",
    "Borrar propiedades"
  );
  if (!confirmed) return;

  const pages = vault.getPages();
  let removedProperties = 0;
  pages.forEach((page) => {
    removedProperties += clearBlockProperties(page.blocks);
    removedProperties += page.frontmatter?.length || 0;
    page.frontmatter = [];
  });

  try {
    await Promise.all(pages.map((page) => vault.savePage(page)));
    if (currentPage) {
      currentPage = vault.getPageByTitle(currentPage.title) || currentPage;
      renderEditor();
    }
    renderSidebar();
    showToast(`Se borraron ${removedProperties} propiedad(es) del vault.`);
  } catch (error) {
    console.error("No se pudieron guardar todas las notas tras borrar sus propiedades:", error);
    showToast("No se pudieron guardar todas las notas. Revisa la consola y el estado del vault.");
  }
});

btnCleanUnusedAttachments.addEventListener("click", async () => {
  if (!isTauri()) {
    showToast("La limpieza de adjuntos requiere la aplicación de escritorio.");
    return;
  }

  const confirmed = await confirmAction(
    "Se revisarán todas las notas y se eliminarán de assets las imágenes que no estén referenciadas en ninguna página. Esta acción no se puede deshacer. ¿Continuar?",
    "Eliminar imágenes"
  );
  if (!confirmed) return;

  btnCleanUnusedAttachments.disabled = true;
  unusedAttachmentsStatus.textContent = "Guardando notas antes de revisar los adjuntos…";
  try {
    await Promise.all(vault.getPages().map((page) => vault.savePage(page)));
    await vault.flushPendingFileOperations();
    unusedAttachmentsStatus.textContent = "Buscando imágenes no usadas…";
    const report = await invoke<UnusedAttachmentsReport>("delete_unused_attachments");
    const removedCount = report.removed.length;
    let message: string;
    if (report.scanned === 0) {
      message = "No se encontraron imágenes en la carpeta assets.";
    } else if (removedCount === 0) {
      message = `No hay imágenes sin usar: las ${report.scanned} imágenes de assets están referenciadas.`;
    } else {
      message = `Se eliminaron ${removedCount} de ${report.scanned} imágenes sin usar. Se conservaron ${report.kept}.`;
    }
    if (report.failed.length > 0) {
      message += ` No se pudieron borrar ${report.failed.length} archivo(s).`;
      console.error("No se pudieron eliminar algunos adjuntos:", report.failed);
    }
    unusedAttachmentsStatus.textContent = message;
    showToast(removedCount > 0
      ? `Limpieza completada: ${removedCount} imagen(es) eliminada(s).`
      : "No había imágenes sin usar en assets.");
  } catch (error) {
    console.error("No se pudieron eliminar los adjuntos sin usar:", error);
    unusedAttachmentsStatus.textContent = "No se pudo completar la limpieza de adjuntos.";
    showToast("No se pudieron eliminar los adjuntos sin usar. Revisa la consola.");
  } finally {
    btnCleanUnusedAttachments.disabled = false;
  }
});

btnClearCache.addEventListener("click", async () => {
  const confirmed = await confirmAction(
    "Se borrarán los cachés web temporales y los datos de sesión de esta aplicación. Las notas, archivos y preferencias guardadas se conservarán.",
    "Borrar caché"
  );
  if (!confirmed) return;

  try {
    let deletedCount = 0;
    if ("caches" in window) {
      const cacheNames = await window.caches.keys();
      const deletedCaches = await Promise.all(
        cacheNames.map((cacheName) => window.caches.delete(cacheName))
      );
      deletedCount = deletedCaches.filter(Boolean).length;
    }
    sessionStorage.clear();
    showToast(
      `Caché temporal borrada${"caches" in window ? ` (${deletedCount} caché(s))` : ""}.`
    );
  } catch (error) {
    console.error("No se pudo borrar la caché temporal:", error);
    showToast("No se pudo borrar toda la caché temporal. Revisa la consola para más detalles.");
  }
});

btnDeleteAllSnapshots.addEventListener("click", async () => {
  if (!isTauri()) {
    showToast(translate("Los snapshots solo están disponibles en la aplicación de escritorio."));
    return;
  }
  const confirmed = await confirmAction(
    "Se borrarán todas las versiones guardadas de todas las notas en .sinnotas/chronos/. Las notas originales no se tocarán. ¿Continuar?",
    "Borrar todos"
  );
  if (!confirmed) return;

  btnDeleteAllSnapshots.disabled = true;
  try {
    await invoke<number>("delete_all_snapshots");
    showToast(translate("Todos los snapshots fueron eliminados."));
    await refreshActiveSnapshotNotesList();
    if (currentPage?.path) {
      await refreshSnapshotState();
      await refreshHistorySnapshots();
    }
  } catch (error) {
    console.error("No se pudieron borrar todos los snapshots:", error);
    showToast(translate("No se pudieron borrar los snapshots."));
  } finally {
    btnDeleteAllSnapshots.disabled = false;
  }
});

btnAddBullet.addEventListener("click", () => {
  const flatBlocks = getAllBlocksFlat(currentPage.blocks);
  const lastBlock = flatBlocks[flatBlocks.length - 1];
  if (lastBlock) {
    const res = insertBlockAfter(currentPage.blocks, lastBlock.id, "");
    if (res) {
      currentPage.blocks = res.newTree;
      cursorState = { blockId: res.newBlockId, offset: 0 };
      vault.savePage(currentPage);
      renderBlocksTree();
      const newEditor = blocksContainer.querySelector<HTMLElement>(`.block-editor[data-id="${res.newBlockId}"]`);
      if (newEditor) {
        newEditor.focus();
      }
    }
  }
});

btnClearFlashcardStats.addEventListener("click", async () => {
  const confirmed = await confirmAction(
    "Se borrarán las estadísticas de repaso: repasos de hoy, repasos totales, minutos de enfoque y los puntos del átomo de progreso. La programación FSRS de las tarjetas no se modificará. ¿Continuar?",
    "Borrar estadísticas"
  );
  if (!confirmed) return;

  flashcardProgressStats = {
    date: currentLocalDate(),
    reviewsToday: 0,
    totalReviews: 0,
    focusSeconds: 0,
    points: 0,
  };
  saveFlashcardProgressStats();
  updateFlashcardProgressPanel();
  showToast("Estadísticas de repaso borradas.");
});

btnClearAllFlashcards.addEventListener("click", async () => {
  const confirmed = await confirmAction(
    "Se quitarán los marcadores de todas las flashcards del vault (#card, resaltados ==…==, cloze, separadores :: y datos de repaso). El contenido de los bullets se conservará. ¿Continuar?",
    "Eliminar flashcards"
  );
  if (!confirmed) return;

  const pages = vault.getPages();
  let removed = 0;
  pages.forEach((page) => {
    getAllBlocksFlat(page.blocks).forEach((block) => {
      if (!isFlashcardBlockContent(block.content)) return;
      const next = removeFlashcardMarkers(block.content);
      if (next === block.content) return;
      block.content = next;
      removed += 1;
    });
  });

  if (removed === 0) {
    clearAllFlashcardsStatus.textContent = "No se encontraron flashcards en el vault.";
    showToast("No se encontraron flashcards en el vault.");
    return;
  }

  btnClearAllFlashcards.disabled = true;
  clearAllFlashcardsStatus.textContent = "Guardando notas…";
  try {
    await Promise.all(pages.map((page) => vault.savePage(page)));
    if (currentPage) {
      currentPage = vault.getPageByTitle(currentPage.title) || currentPage;
      renderEditor();
    }
    flashcardLoader.invalidate();
    renderSidebar();
    if (flashcardExplorerActive) renderFlashcardExplorer();
    clearAllFlashcardsStatus.textContent = `Se quitaron los marcadores de ${removed} flashcard(s).`;
    showToast(`Flashcards eliminadas: ${removed}.`);
  } catch (error) {
    console.error("No se pudieron guardar las notas tras eliminar las flashcards:", error);
    clearAllFlashcardsStatus.textContent = "No se pudieron guardar todos los cambios.";
    showToast("No se pudieron guardar todos los cambios. Revisa la consola.");
  } finally {
    btnClearAllFlashcards.disabled = false;
  }
});

btnReloadApp.addEventListener("click", async () => {
  const confirmed = await confirmAction(
    "La interfaz se recargará. Las notas guardadas no se modificarán.",
    "Recargar"
  );
  if (!confirmed) return;

  window.location.reload();
});

/* ==================== ACTUALIZACIONES ==================== */
let updateSettingsReady = false;

function renderUpdateState(state: UpdateState): void {
  if (!updateCurrentVersion || !updateAvailableRow || !updateNewVersion || !btnCheckUpdates ||
      !btnInstallUpdate || !updateProgressWrap || !updateProgress || !updateProgressLabel ||
      !updateStatus || !updateNotesWrap || !updateNotes) {
    return;
  }

  updateCurrentVersion.textContent = state.currentVersion || "—";
  updateAvailableRow.hidden = !state.newVersion;
  updateNewVersion.textContent = state.newVersion ?? "—";

  const busy = state.status === "checking" || state.status === "downloading";
  btnCheckUpdates.disabled = busy;
  btnCheckUpdates.textContent = state.status === "checking" ? "Buscando…" : "Buscar actualizaciones";
  btnInstallUpdate.hidden = state.status !== "available";
  btnInstallUpdate.disabled = busy;
  btnInstallUpdate.textContent =
    getUpdatePlatform() === "android" ? "Descargar APK" : "Descargar e instalar";

  updateStatus.textContent = state.message ?? "";
  updateStatus.dataset.status = state.status;

  const showProgress =
    state.status === "downloading" || (state.status === "ready" && state.progress !== null);
  updateProgressWrap.hidden = !showProgress;
  if (showProgress) {
    if (state.progress === null) updateProgress.removeAttribute("value");
    else updateProgress.value = state.progress;
    const percent = state.progress === null ? "" : ` · ${Math.round(state.progress * 100)} %`;
    updateProgressLabel.textContent =
      state.totalBytes > 0
        ? `${formatBytes(state.receivedBytes)} / ${formatBytes(state.totalBytes)}${percent}`
        : `${formatBytes(state.receivedBytes)}${percent}`;
  }

  updateNotesWrap.hidden = !state.notes;
  updateNotes.textContent = state.notes;
}

function initUpdateSettings(): void {
  if (updateSettingsReady || !updateSettingsSection) return;
  updateSettingsReady = true;

  if (getUpdatePlatform() === "unsupported") {
    updateSettingsSection.hidden = true;
    return;
  }

  void getCurrentVersion().then((version) => {
    if (updateCurrentVersion && version) updateCurrentVersion.textContent = version;
  });

  subscribeUpdateState(renderUpdateState);
  btnCheckUpdates?.addEventListener("click", () => {
    void checkForUpdates();
  });
  btnInstallUpdate?.addEventListener("click", () => {
    void installAvailableUpdate();
  });
}

btnThemeSwitch.addEventListener("click", () => {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  setTheme(!isLight);
});

settingsDropdownMenu.querySelectorAll<HTMLButtonElement>("[data-accent-option]").forEach((button) => {
  button.addEventListener("click", () => {
    const accent = button.dataset.accentOption;
    if (accent && accentColors.includes(accent as AccentColor)) setAccent(accent as AccentColor);
  });
});

pageWidthSlider.addEventListener("input", () => {
  setPageWidth(Number(pageWidthSlider.value));
});

glowIntensitySlider.addEventListener("input", () => {
  setGlowIntensity(Number(glowIntensitySlider.value));
});

settingsDropdownMenu.querySelectorAll<HTMLButtonElement>(".font-option-btn[data-font]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const font = btn.dataset.font as TypographyType;
    if (font) setFont(font);
  });
});

let settingsOverlayCloseTimer: number | null = null;

function openSettingsOverlay(): void {
  if (settingsOverlayCloseTimer !== null) {
    window.clearTimeout(settingsOverlayCloseTimer);
    settingsOverlayCloseTimer = null;
  }
  settingsOverlay.classList.remove("is-overlay-closing");
  settingsDropdownMenu.classList.remove("is-opening");
  mountOverlay(settingsOverlay);
  replayAnimation(settingsOverlay, "is-overlay-opening");
  replayAnimation(settingsDropdownMenu, "is-opening");

  const activeTab = settingsDropdownMenu
    .querySelector<HTMLButtonElement>("[data-settings-tab].active")
    ?.dataset.settingsTab;
  if (activeTab === "flashcards") renderFlashcardPagesFilter(true);
  if (activeTab === "appearance") ensureSystemFontsLoaded();
  if (activeTab === "graph") syncGraphSettingsUi();
}

function closeSettingsOverlay(): void {
  if (
    !settingsOverlay.isConnected ||
    settingsOverlay.hidden ||
    settingsOverlayCloseTimer !== null
  ) {
    return;
  }
  settingsOverlay.classList.remove("is-overlay-opening");
  settingsDropdownMenu.classList.remove("is-opening");
  settingsOverlay.classList.add("is-overlay-closing");

  const finish = () => {
    settingsOverlayCloseTimer = null;
    settingsOverlay.classList.remove("is-overlay-closing");
    unmountOverlay(settingsOverlay);
  };
  const delay = motionDuration(OVERLAY_CLOSE_MS);
  if (delay === 0) {
    finish();
    return;
  }
  settingsOverlayCloseTimer = window.setTimeout(finish, delay);
}

btnSettingsToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen =
    settingsOverlay.isConnected && !settingsOverlay.classList.contains("is-overlay-closing");
  if (isOpen) closeSettingsOverlay();
  else openSettingsOverlay();
});

btnCloseSettings.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  closeSettingsOverlay();
});
settingsOverlay.addEventListener("click", (event) => {
  if (event.target === settingsOverlay) closeSettingsOverlay();
});

function closeHistoryModal(): void {
  historyModalOverlay.classList.remove("visible");
  unmountOverlay(historyModalOverlay);
}

function closeAllModalOverlays(): void {
  closeSettingsOverlay();
  closeHistoryModal();
  closeConceptMap();
  closeShortcutsModal();
  closeAppDialog();
  if (!imageOcclusionOverlay.hidden) closeImageOcclusionEditor();
  hideAllContextMenus();
}

historyModalOverlay.addEventListener("click", (event) => {
  if (event.target === historyModalOverlay) closeHistoryModal();
});

/* ==================== CONCEPT MAP ==================== */
let conceptMapHoverHideTimer: number | null = null;

function cancelConceptMapDetailHide(): void {
  if (conceptMapHoverHideTimer !== null) {
    window.clearTimeout(conceptMapHoverHideTimer);
    conceptMapHoverHideTimer = null;
  }
}

/** Oculta el detalle con una pequeña tolerancia para poder mover el ratón al panel. */
function scheduleConceptMapDetailHide(): void {
  cancelConceptMapDetailHide();
  conceptMapHoverHideTimer = window.setTimeout(() => {
    conceptMapHoverHideTimer = null;
    if (conceptMapNodeDetail) conceptMapNodeDetail.hidden = true;
    requestAnimationFrame(() => conceptMapView.refresh());
  }, 350);
}

function openConceptMap(): void {
  conceptMapTitle.innerText = currentPage.title;
  const count = getAllBlocksFlat(currentPage.blocks).length;
  conceptMapSubtitle.innerText = count === 1 ? "1 bullet" : `${count} bullets`;
  conceptMapView.onNodeClick = (nodeId, fullContent) => {
    cancelConceptMapDetailHide();
    showConceptMapNodeDetail(nodeId, fullContent);
  };
  conceptMapView.onNodeHover = (nodeId, fullContent) => {
    if (nodeId) {
      cancelConceptMapDetailHide();
      showConceptMapNodeDetail(nodeId, fullContent);
    } else {
      scheduleConceptMapDetailHide();
    }
  };
  if (conceptMapNodeDetail) conceptMapNodeDetail.hidden = true;
  mountOverlay(conceptMapOverlay);
  conceptMapOverlay.classList.add("visible");
  requestAnimationFrame(() => conceptMapView.setPage(currentPage));
}

/** Muestra el contenido completo del bloque pulsado en el mapa conceptual. */
function showConceptMapNodeDetail(nodeId: string, fullContent: string): void {
  if (!conceptMapNodeDetail || !conceptMapNodeDetailBody) return;
  const block = getAllBlocksFlat(currentPage.blocks).find((candidate) => candidate.id === nodeId);
  if (conceptMapNodeDetailTitle) {
    conceptMapNodeDetailTitle.textContent = block?.type === "image"
      ? "Imagen"
      : "Contenido del bullet";
  }
  const text = block?.type === "image"
    ? block.imageAlt?.trim() || "Imagen sin descripción"
    : stripCardTag(stripSystemProperties(fullContent || "")).trim();
  conceptMapNodeDetailBody.textContent = text || "(Sin contenido de texto)";
  conceptMapNodeDetail.hidden = false;
  requestAnimationFrame(() => conceptMapView.refresh());
}

function closeConceptMap(): void {
  cancelConceptMapDetailHide();
  conceptMapOverlay.classList.remove("visible");
  unmountOverlay(conceptMapOverlay);
  if (conceptMapNodeDetail) conceptMapNodeDetail.hidden = true;
}

conceptMapNodeDetail?.addEventListener("mouseenter", cancelConceptMapDetailHide);
conceptMapNodeDetail?.addEventListener("mouseleave", scheduleConceptMapDetailHide);

btnConceptMap.addEventListener("click", openConceptMap);
btnCloseConceptMap.addEventListener("click", closeConceptMap);
btnConceptMapZoomIn.addEventListener("click", () => conceptMapView.zoomIn());
btnConceptMapZoomOut.addEventListener("click", () => conceptMapView.zoomOut());
btnConceptMapReset.addEventListener("click", () => conceptMapView.fit());
btnCloseConceptMapNode?.addEventListener("click", () => {
  if (conceptMapNodeDetail) conceptMapNodeDetail.hidden = true;
  requestAnimationFrame(() => conceptMapView.refresh());
});
conceptMapOverlay.addEventListener("click", (event) => {
  if (event.target === conceptMapOverlay) closeConceptMap();
});

function openShortcutsModal(): void {
  if (hasMountedModalExcept(shortcutsModalOverlay)) return;
  mountOverlay(shortcutsModalOverlay);
  btnCloseShortcuts?.focus();
}

function closeShortcutsModal(): void {
  unmountOverlay(shortcutsModalOverlay);
}

function toggleShortcutsModal(): void {
  if (shortcutsModalOverlay.isConnected) {
    closeShortcutsModal();
  } else {
    openShortcutsModal();
  }
}

btnShortcuts?.addEventListener("click", () => {
  toggleShortcutsModal();
});
btnCloseShortcuts?.addEventListener("click", () => {
  closeShortcutsModal();
});
shortcutsModalOverlay.addEventListener("click", (event) => {
  if (event.target === shortcutsModalOverlay) closeShortcutsModal();
});

let pageExportCloseTimer: number | null = null;

function setPageExportMenuOpen(open: boolean): void {
  if (open) {
    if (pageExportCloseTimer !== null) {
      window.clearTimeout(pageExportCloseTimer);
      pageExportCloseTimer = null;
    }
    pageExportDropdown.classList.remove("is-menu-closing");
    pageExportDropdown.hidden = false;
    pageExportToggle.setAttribute("aria-expanded", "true");
    replayAnimation(pageExportDropdown, "is-menu-opening");
    return;
  }

  if (pageExportDropdown.hidden || pageExportCloseTimer !== null) return;
  pageExportDropdown.classList.remove("is-menu-opening");
  pageExportDropdown.classList.add("is-menu-closing");
  pageExportToggle.setAttribute("aria-expanded", "false");

  const finish = () => {
    pageExportCloseTimer = null;
    pageExportDropdown.classList.remove("is-menu-closing");
    pageExportDropdown.hidden = true;
  };
  const delay = motionDuration(MENU_CLOSE_MS);
  if (delay === 0) {
    finish();
    return;
  }
  pageExportCloseTimer = window.setTimeout(finish, delay);
}

pageExportToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = !pageExportDropdown.hidden && pageExportCloseTimer === null;
  setPageExportMenuOpen(!isOpen);
});


pageExportDropdown.addEventListener("click", (event) => event.stopPropagation());
window.addEventListener("click", (event) => {
  if (!(event.target instanceof Node) || !pageExportDropdown.contains(event.target)) {
    setPageExportMenuOpen(false);
  }
});

document.getElementById("btn-export-current-text")?.addEventListener("click", async () => {
  setPageExportMenuOpen(false);
  const fileName = `${currentPage.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_") || "pagina"}.txt`;
  try {
    const contents = serializePageAsPlainText(currentPage);
    if (isTauri()) {
      const savedPath = await invoke<string | null>("export_page_text", { contents, fileName });
      if (!savedPath) return;
      showToast("Página exportada como texto plano.");
    } else {
      const url = URL.createObjectURL(new Blob([contents], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Página exportada como ${fileName}.`);
    }
  } catch (error) {
    console.error("No se pudo exportar la página como texto plano:", error);
    showToast("No se pudo exportar la página. Revisa la consola para más detalles.");
  }
});

supportLink.addEventListener("click", (event) => {
  event.preventDefault();
  if (!isTauri()) {
    // Navegación vía ancla sintética con target="_blank": a diferencia de
    // window.open() con features de ventana, las navegaciones iniciadas por
    // una ancla no suelen ser bloqueadas por el popup blocker del navegador.
    const anchor = document.createElement("a");
    anchor.href = supportLink.href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }
  void openUrl(supportLink.href).catch((error: unknown) => {
    console.error("No se pudo abrir el enlace del repositorio en el navegador:", error);
    showToast("No se pudo abrir el repositorio en el navegador.");
  });
});

/* ==================== SIDEBAR COLLAPSE / EXPAND ==================== */
function initSidebarState() {
  if (document.body.classList.contains("mobile-full-editor")) {
    sidebarLeft.classList.remove("is-collapsed", "mobile-open");
    btnToggleSidebar.classList.remove("active");
    return;
  }
  const collapsed = localStorage.getItem("sinnotas-sidebar-collapsed") === "true";
  if (collapsed) {
    sidebarLeft.classList.add("is-collapsed");
    btnToggleSidebar.classList.remove("active");
  } else {
    sidebarLeft.classList.remove("is-collapsed");
    btnToggleSidebar.classList.add("active");
  }
}

function toggleSidebar() {
  if (document.body.classList.contains("mobile-full-editor")) {
    sidebarLeft.classList.remove("is-collapsed");
    const isOpen = sidebarLeft.classList.toggle("mobile-open");
    btnToggleSidebar.classList.toggle("active", isOpen);
    return;
  }
  const isCurrentlyCollapsed = sidebarLeft.classList.contains("is-collapsed");
  if (isCurrentlyCollapsed) {
    sidebarLeft.classList.remove("is-collapsed");
    btnToggleSidebar.classList.add("active");
    localStorage.setItem("sinnotas-sidebar-collapsed", "false");
  } else {
    sidebarLeft.classList.add("is-collapsed");
    btnToggleSidebar.classList.remove("active");
    localStorage.setItem("sinnotas-sidebar-collapsed", "true");
  }
}

btnToggleSidebar.addEventListener("click", toggleSidebar);

function closeMobileSidebar(): void {
  sidebarLeft.classList.remove("mobile-open");
  btnToggleSidebar.classList.remove("active");
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && sidebarLeft.classList.contains("mobile-open")) {
    closeMobileSidebar();
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!sidebarLeft.classList.contains("mobile-open")) return;
  const target = event.target as Node;
  if (sidebarLeft.contains(target) || btnToggleSidebar.contains(target)) return;
  closeMobileSidebar();
});

btnMobileBackToReview?.addEventListener("click", () => {
  requestReviewMode();
  window.location.reload();
});

btnEnterReviewMode?.addEventListener("click", () => {
  requestReviewMode();
  window.location.reload();
});

/* ==================== NAVIGATION HISTORY (BACK / FORWARD) ==================== */
interface NavigationHistoryEntry {
  view: ViewType;
  pageId: string;
}

const navigationHistory: NavigationHistoryEntry[] = [];
let navigationHistoryIndex = -1;

/** Última vista y página abiertas, para volver a ellas tras recargar la app. */
const LAST_VIEW_STORAGE_KEY = "sinnotas-last-view";
const LAST_PAGE_STORAGE_KEY = "sinnotas-last-page-id";

function persistLastNavigation(): void {
  try {
    localStorage.setItem(LAST_VIEW_STORAGE_KEY, currentView);
    localStorage.setItem(LAST_PAGE_STORAGE_KEY, currentPage.id);
  } catch {}
}

function readLastNavigation(): { view: ViewType; pageId: string } | null {
  try {
    const view = localStorage.getItem(LAST_VIEW_STORAGE_KEY);
    const pageId = localStorage.getItem(LAST_PAGE_STORAGE_KEY);
    if (!view || !pageId) return null;
    const validViews: ViewType[] = [
      "editor",
      "journals",
      "flashcards",
      "graph",
      "kanban",
      "all-pages",
    ];
    if (!validViews.includes(view as ViewType)) return null;
    return { view: view as ViewType, pageId };
  } catch {
    return null;
  }
}
let restoringNavigationHistory = false;

function updateHistoryButtons(): void {
  btnHistoryBack.disabled = navigationHistoryIndex <= 0;
  btnHistoryForward.disabled =
    navigationHistoryIndex < 0 || navigationHistoryIndex >= navigationHistory.length - 1;
}

function recordNavigationHistory(): void {
  if (restoringNavigationHistory) return;
  const entry: NavigationHistoryEntry = { view: currentView, pageId: currentPage.id };
  const currentEntry = navigationHistory[navigationHistoryIndex];
  if (currentEntry && currentEntry.view === entry.view && currentEntry.pageId === entry.pageId) {
    updateHistoryButtons();
    return;
  }
  navigationHistory.splice(navigationHistoryIndex + 1);
  navigationHistory.push(entry);
  navigationHistoryIndex = navigationHistory.length - 1;
  updateHistoryButtons();
  persistLastNavigation();
}

function resetNavigationHistory(): void {
  navigationHistory.length = 0;
  navigationHistoryIndex = -1;
  recordNavigationHistory();
}

function restoreNavigationHistory(index: number): void {
  const entry = navigationHistory[index];
  if (!entry || index === navigationHistoryIndex) return;

  const page = vault.getPages().find((candidate) => candidate.id === entry.pageId);
  if (entry.view === "editor" && !page) {
    // The page no longer exists (deleted or vault changed): drop stale entries.
    navigationHistory.splice(index, 1);
    if (index < navigationHistoryIndex) navigationHistoryIndex -= 1;
    updateHistoryButtons();
    return;
  }

  restoringNavigationHistory = true;
  try {
    navigationHistoryIndex = index;
    if (page && page.id !== currentPage.id) currentPage = page;
    if (entry.view === "editor") cursorState = { blockId: currentPage.blocks[0]?.id || "b-1", offset: 0 };
    switchView(entry.view);
  } finally {
    restoringNavigationHistory = false;
  }
  updateHistoryButtons();
}

btnHistoryBack.addEventListener("click", () => {
  if (navigationHistoryIndex > 0) restoreNavigationHistory(navigationHistoryIndex - 1);
});

btnHistoryForward.addEventListener("click", () => {
  if (navigationHistoryIndex < navigationHistory.length - 1) {
    restoreNavigationHistory(navigationHistoryIndex + 1);
  }
});

updateHistoryButtons();

/* ==================== NAVIGATION & VIEWS ==================== */
function switchView(view: ViewType) {
  // Antes de cambiar de vista/nota, persistir las ediciones de texto pendientes.
  void vault.flushPendingSaves();
  if (view !== "flashcards") setFlashcardFocusMode(false);
  if (view !== "flashcards") clearFlashcardDueRecheck();
  if (view !== "editor") closeNoteFind(false);
  if (view !== "graph") closeGraphPreview();
  currentView = view;

  // Solo el editor tiene una nota abierta. En el resto de vistas limpiamos el
  // breadcrumb y ocultamos las acciones de página para no arrastrar la última
  // nota visitada.
  const hasOpenPage = view === "editor";
  if (!hasOpenPage) setHeadbarTitle("");
  document.body.classList.toggle("no-active-page", !hasOpenPage);

  const navItems = [navEditor, navJournals, navFlashcards, navGraph, navKanban, navAllPages];
  navItems.forEach((item) => item.classList.remove("active"));

  const panels = [viewEditor, viewJournals, viewFlashcards, viewGraph, viewKanban, viewAllPages];
  panels.forEach((p) => p.classList.remove("active-view"));

  if (view === "editor") {
    navEditor.classList.add("active");
    viewEditor.classList.add("active-view");
    graphView?.stopSimulation();
    // Registrar la apertura antes de pintar: así openPage, loadPage, atrás,
    // adelante y el botón Editor quedan cubiertos, y el renderSidebar() del
    // final de switchView ya ve la lista actualizada.
    touchRecentPage(currentPage);
    renderEditor();
  } else if (view === "journals") {
    navJournals.classList.add("active");
    viewJournals.classList.add("active-view");
    graphView?.stopSimulation();
    renderJournalsView();
  } else if (view === "flashcards") {
    navFlashcards.classList.add("active");
    viewFlashcards.classList.add("active-view");
    graphView?.stopSimulation();
    startFlashcardsSession();
    // Si otro dispositivo repasó tarjetas mientras esta vista estaba cerrada,
    // los cambios se cargan al entrar (sin interrumpir el editor).
    void synchronizeVaultFromDisk({ notify: false }).then((changed) => {
      if (!changed) updateReviewHistoryButtons();
    });
  } else if (view === "graph") {
    navGraph.classList.add("active");
    viewGraph.classList.add("active-view");
    renderGraphView();
  } else if (view === "kanban") {
    navKanban.classList.add("active");
    viewKanban.classList.add("active-view");
    graphView?.stopSimulation();
    renderKanbanBoard();
  } else if (view === "all-pages") {
    navAllPages.classList.add("active");
    viewAllPages.classList.add("active-view");
    graphView?.stopSimulation();
    renderAllPagesView();
  }

  renderSidebar();
  recordNavigationHistory();
}

navEditor.addEventListener("click", () => switchView("editor"));
navJournals.addEventListener("click", () => switchView("journals"));
navFlashcards.addEventListener("click", () => switchView("flashcards"));
navGraph.addEventListener("click", () => switchView("graph"));
navKanban.addEventListener("click", () => switchView("kanban"));
navAllPages.addEventListener("click", () => {
  allPagesCurrentPage = 1;
  switchView("all-pages");
});

document.getElementById("all-pages-prev")?.addEventListener("click", () => {
  if (allPagesCurrentPage > 1) {
    allPagesCurrentPage--;
    renderAllPagesView();
  }
});

document.getElementById("all-pages-next")?.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(allPagesFiltered.length / ALL_PAGES_PER_PAGE));
  if (allPagesCurrentPage < totalPages) {
    allPagesCurrentPage++;
    renderAllPagesView();
  }
});

const allPagesSearchInput = document.getElementById(
  "all-pages-search"
) as HTMLInputElement | null;
const allPagesSortSelect = document.getElementById(
  "all-pages-sort"
) as HTMLSelectElement | null;

allPagesSearchInput?.addEventListener("input", () => {
  if (allPagesSearchTimer !== null) window.clearTimeout(allPagesSearchTimer);
  // Pequeño debounce para que un vault grande no reordene en cada pulsación.
  allPagesSearchTimer = window.setTimeout(() => {
    allPagesSearchTimer = null;
    allPagesSearchQuery = allPagesSearchInput.value;
    allPagesCurrentPage = 1;
    renderAllPagesView();
    allPagesSearchInput.focus({ preventScroll: true });
  }, 160);
});

allPagesSortSelect?.addEventListener("change", () => {
  const selected = allPagesSortSelect.value;
  allPagesSort = isAllPagesSort(selected) ? selected : "updated-desc";
  try {
    localStorage.setItem(ALL_PAGES_SORT_STORAGE_KEY, allPagesSort);
  } catch {
    // La ordenación sigue activa aunque no se pueda persistir.
  }
  allPagesCurrentPage = 1;
  renderAllPagesView();
});

/* ==================== OUTLINER EDITOR ==================== */
function isBlockElement(node: Node): boolean {
  if (!(node instanceof HTMLElement) || !["DIV", "P"].includes(node.tagName)) return false;
  // Los nodos atómicos de matemáticas/código se serializan con sus propios
  // delimitadores; no deben añadir saltos de línea extra a su alrededor.
  return node.dataset.mathSource === undefined && node.dataset.codeSource === undefined;
}

function serializeEditorNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (node instanceof HTMLElement) {
    // Elementos de interfaz (por ejemplo la barra de acciones de una tabla) no
    // forman parte del contenido Markdown.
    if (node.dataset.editorUi !== undefined) return "";
    // Nodos atómicos generados al renderizar: se reconstruye el Markdown exacto.
    const mathSource = node.dataset.mathSource;
    if (mathSource !== undefined) {
      return node.dataset.mathDisplay === "true" ? `$$${mathSource}$$` : `$${mathSource}$`;
    }
    const codeSource = node.dataset.codeSource;
    if (codeSource !== undefined) {
      if (node.tagName === "CODE") return `\`${codeSource}\``;
      const language = node.dataset.codeLanguage || "";
      return `${"```"}${language}\n${codeSource}\n${"```"}`;
    }
  }
  if (node instanceof HTMLElement && node.tagName === "STRONG") {
    return `**${Array.from(node.childNodes).map(serializeEditorNode).join("")}**`;
  }
  if (node instanceof HTMLElement && node.tagName === "EM") {
    return `*${Array.from(node.childNodes).map(serializeEditorNode).join("")}*`;
  }
  if (node instanceof HTMLElement && node.tagName === "U") {
    return `<u>${Array.from(node.childNodes).map(serializeEditorNode).join("")}</u>`;
  }
  if (node instanceof HTMLElement && node.tagName === "MARK") {
    return `==${Array.from(node.childNodes).map(serializeEditorNode).join("")}==`;
  }
  if (
    node instanceof HTMLElement &&
    node.classList.contains("wikilink-anchor") &&
    node.dataset.wikilinkTitle
  ) {
    return `[[${node.dataset.wikilinkTitle}]]`;
  }
  if (node instanceof HTMLElement && node.tagName === "TABLE" && node.classList.contains("markdown-block-table")) {
    const rows = Array.from(node.querySelectorAll("tr"));
    return rows.map((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll("th, td"));
      const cellTexts = cells.map((cell) => escapeTableCell(serializeEditorNode(cell).trim()));
      const line = `| ${cellTexts.join(" | ")} |`;
      if (rowIndex === 0) {
        const separator = cells
          .map((cell) => {
            const alignment = cell instanceof HTMLElement ? cell.dataset.align : "";
            if (alignment === "center") return ":---:";
            if (alignment === "right") return "---:";
            if (alignment === "left") return ":---";
            return "---";
          })
          .join(" | ");
        return `${line}\n| ${separator} |`;
      }
      return line;
    }).join("\n");
  }
  if (node instanceof HTMLElement && node.classList.contains("query-result-container")) {
    const queryText = node.dataset.query || "";
    return `{{query ${queryText}}}`;
  }
  if (node instanceof HTMLBRElement) return "\n";

  return Array.from(node.childNodes).map((child, index) => {
    const separator = index > 0 && isBlockElement(child) ? "\n" : "";
    return separator + serializeEditorNode(child);
  }).join("");
}

function serializeEditorContent(editor: HTMLElement): string {
  return serializeEditorNode(editor);
}

const IMAGE_EXTENSION_PATTERN = /\.(?:png|jpe?g|webp|svg|gif|bmp)$/i;
const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
};

function isSupportedMarkdownImageSource(source: string): boolean {
  if (/^data:image\/(?:png|jpe?g|webp|svg\+xml|gif|bmp);/i.test(source)) return true;
  if (/^(?:https?:|blob:)/i.test(source)) {
    try {
      return IMAGE_EXTENSION_PATTERN.test(new URL(source).pathname);
    } catch {
      return false;
    }
  }
  return IMAGE_EXTENSION_PATTERN.test(source.split(/[?#]/, 1)[0]);
}

function getStandaloneMarkdownImage(content: string): { source: string; alt: string } | null {
  const trimmed = content.trim();
  const match = trimmed.match(/^!\[([^\]\r\n]*)\]\(([^()\r\n]+)\)$/);
  const source = match?.[2].trim() || trimmed;
  if (!isSupportedMarkdownImageSource(source)) return null;
  const fileName = source.split(/[\\/]/).pop()?.split(/[?#]/, 1)[0] || "imagen";
  return {
    source,
    alt: match?.[1] || fileName.replace(/\.[^.]+$/, "") || "imagen",
  };
}

function ImageBlock(source: string, alt: string, blockId: string): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "max-w-full h-auto rounded-lg block my-2 cursor-pointer shadow-sm hover:ring-2 hover:ring-blue-400";
  image.alt = "Imagen";
  image.dataset.imageSource = source;
  image.loading = "lazy";
  image.decoding = "async";
  image.draggable = false;
  image.style.cursor = "pointer";
  image.title = alt || "Clic para editar oclusiones";
  image.addEventListener("pointerdown", (event) => event.preventDefault());
  image.addEventListener("click", () => openImageOcclusionEditor(blockId, source));
  let fallbackStarted = false;
  let fallbackUrl: string | null = null;
  const showLoadError = (url: string, error?: unknown) => {
    image.classList.add("image-block-failed");
    image.alt = `No se pudo cargar: ${source} (${url})`;
    image.title = `Falló la carga de ${source} desde ${url}`;
    console.error("Falló la carga de un bloque de imagen:", {
      source,
      url,
      vaultRoot: vault.getActiveRootPath(),
      error,
    });
  };
  const loadVaultBytes = async (): Promise<void> => {
    if (!isTauri() || fallbackStarted) return;
    fallbackStarted = true;
    try {
      const bytes = await invoke<number[]>("read_image_data", { source });
      if (!image.isConnected) return;
      const extension = imageExtension(source) || "png";
      const mimeTypes: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        svg: "image/svg+xml",
        gif: "image/gif",
        bmp: "image/bmp",
      };
      const data = Uint8Array.from(bytes);
      fallbackUrl = URL.createObjectURL(new Blob([data.buffer], {
        type: mimeTypes[extension] || "application/octet-stream",
      }));
      image.addEventListener("load", () => {
        image.classList.remove("image-block-failed");
        if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
        fallbackUrl = null;
      }, { once: true });
      image.addEventListener("error", () => {
        showLoadError(fallbackUrl || image.src, new Error("Falló también la carga del recurso Blob."));
      }, { once: true });
      image.src = fallbackUrl;
    } catch (error) {
      showLoadError(image.currentSrc || image.src || "URL vacía", error);
    }
  };
  image.addEventListener("error", () => {
    if (fallbackStarted) {
      showLoadError(image.currentSrc || image.src || "URL vacía");
      return;
    }
    void loadVaultBytes();
  });
  void resolveImageUrl(source).then((url) => {
    if (!url) throw new Error("No se pudo resolver la ruta de la imagen.");
    image.src = url;
  }).catch((error: unknown) => {
    console.error("No se pudo resolver la ruta de un bloque de imagen mediante asset:", {
      source,
      vaultRoot: vault.getActiveRootPath(),
      error,
    });
    void loadVaultBytes();
  });
  return image;
}

function createEditorTableCell(
  cell: HTMLTableCellElement,
  text: string,
  colIndex: number,
  alignment: MarkdownTableModel["alignments"][number]
): void {
  cell.className = "table-cell";
  cell.contentEditable = "true";
  cell.dataset.colIndex = String(colIndex);
  if (alignment) {
    cell.dataset.align = alignment;
    cell.classList.add(`markdown-align-${alignment}`);
  }
  const inlineContent = document.createElement("div");
  renderMarkdownText(inlineContent, text);
  cell.append(...Array.from(inlineContent.childNodes));
}

function buildEditorTable(table: MarkdownTableModel, tableIndex: number): HTMLTableElement {
  const element = document.createElement("table");
  element.className = "markdown-block-table";
  element.dataset.tableIndex = String(tableIndex);

  const thead = element.createTHead();
  const headerRow = document.createElement("tr");
  headerRow.className = "table-row";
  headerRow.dataset.rowIndex = "0";
  headerRow.draggable = true;
  table.header.forEach((text, colIndex) => {
    const cell = document.createElement("th");
    createEditorTableCell(cell, text, colIndex, table.alignments[colIndex] ?? null);
    headerRow.appendChild(cell);
  });
  thead.appendChild(headerRow);

  const tbody = element.createTBody();
  table.rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    tr.className = "table-row";
    tr.dataset.rowIndex = String(rowIndex + 1);
    tr.draggable = true;
    row.forEach((text, colIndex) => {
      const cell = document.createElement("td");
      createEditorTableCell(cell, text, colIndex, table.alignments[colIndex] ?? null);
      tr.appendChild(cell);
    });
    tbody.appendChild(tr);
  });
  return element;
}

function createTableToolbar(table: HTMLTableElement): HTMLDivElement {
  const toolbar = document.createElement("div");
  toolbar.className = "table-toolbar";
  toolbar.dataset.editorUi = "true";
  toolbar.contentEditable = "false";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Editar tabla");

  const actions: Array<{ action: TableEditAction; label: string; title: string }> = [
    { action: "add-row-below", label: "+ Fila", title: "Añadir fila" },
    { action: "add-col-right", label: "+ Col", title: "Añadir columna" },
    { action: "delete-row", label: "− Fila", title: "Eliminar fila" },
    { action: "delete-col", label: "− Col", title: "Eliminar columna" },
  ];

  for (const { action, label, title } of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "table-toolbar-button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyTableEditToBlockTable(table, action);
    });
    toolbar.appendChild(button);
  }
  return toolbar;
}

function activeTableCell(table: HTMLTableElement): HTMLTableCellElement | null {
  const focused = document.activeElement;
  if (focused instanceof HTMLTableCellElement && table.contains(focused)) return focused;
  return table.querySelector<HTMLTableCellElement>(".table-cell");
}

function applyTableEditToBlockTable(table: HTMLTableElement, action: TableEditAction): void {
  const editor = table.closest<HTMLElement>(".block-editor");
  if (!editor) return;
  const blockItem = editor.closest<HTMLElement>(".block-item");
  const blockId = blockItem?.dataset.id;
  const location = blockId ? findNodeLocation(currentPage.blocks, blockId) : null;
  if (!location) return;

  const content = serializeEditorContent(editor);
  const tableIndex = Number(table.dataset.tableIndex || "0");
  const cells = table.querySelectorAll<HTMLTableCellElement>(".table-cell");
  const active = activeTableCell(table);
  const allRows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tr"));
  const rowIndex = active?.parentElement
    ? allRows.indexOf(active.parentElement as HTMLTableRowElement)
    : 0;
  const colIndex = active ? Number(active.dataset.colIndex || "0") : 0;

  const next = editMarkdownTable(content, tableIndex, action, rowIndex, colIndex);
  if (next === content || cells.length === 0) return;

  const node = location.parentList[location.index];
  setVisibleBlockContent(node, next);
  void vault.savePage(currentPage);
  renderMarkdownText(editor, next);

  let targetRow = rowIndex;
  let targetCol = colIndex;
  if (action === "add-row-above") targetRow = rowIndex <= 0 ? 1 : rowIndex;
  else if (action === "add-row-below") targetRow = rowIndex + 1;
  else if (action === "delete-row") targetRow = Math.max(1, rowIndex);
  else if (action === "add-col-left") targetCol = colIndex;
  else if (action === "add-col-right") targetCol = colIndex + 1;
  else if (action === "delete-col") targetCol = Math.max(0, colIndex);

  const nextTable = editor.querySelectorAll<HTMLTableElement>("table.markdown-block-table")[tableIndex];
  const nextRows = nextTable ? Array.from(nextTable.querySelectorAll<HTMLTableRowElement>("tr")) : [];
  const nextCell =
    nextRows[Math.min(targetRow, nextRows.length - 1)]?.querySelectorAll<HTMLTableCellElement>(".table-cell")[
      Math.min(targetCol, Math.max(0, (nextRows[0]?.querySelectorAll(".table-cell").length || 1) - 1))
    ] ?? null;
  if (nextCell) {
    nextCell.focus();
    try {
      const range = document.createRange();
      range.selectNodeContents(nextCell);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch {
      // Ignorar errores de selección en navegadores antiguos.
    }
  }
}

function renderMarkdownText(editor: HTMLElement, content: string): void {
  const isEditing = document.activeElement === editor;
  const tableRanges = findMarkdownTableRanges(content);
  if (tableRanges.length > 0) {
    const fragment = document.createDocumentFragment();
    const appendRichSegment = (segment: string) => {
      if (!segment) return;
      const container = document.createElement("span");
      renderMarkdownText(container, segment);
      fragment.append(...Array.from(container.childNodes));
    };
    let currentPos = 0;
    tableRanges.forEach((range, tableIndex) => {
      appendRichSegment(content.slice(currentPos, range.index));
      const table = buildEditorTable(range.model, tableIndex);
      const wrapper = document.createElement("div");
      wrapper.className = "markdown-table-wrapper";
      wrapper.append(createTableToolbar(table), table);
      fragment.appendChild(wrapper);
      currentPos = range.index + range.length;
    });
    appendRichSegment(content.slice(currentPos));
    editor.replaceChildren(fragment);
    return;
  }

  const queryPattern = /\{\{query\s*([^\}]*)\}\}/;
  const queryMatch = content.match(queryPattern);
  if (queryMatch && !isEditing) {
    const queryIndex = queryMatch.index ?? 0;
    const queryText = queryMatch[1].trim();
    const beforeQuery = content.slice(0, queryIndex);
    const afterQuery = content.slice(queryIndex + queryMatch[0].length);
    
    const fragment = document.createDocumentFragment();
    if (beforeQuery) {
      const beforeContainer = document.createElement("span");
      renderMarkdownText(beforeContainer, beforeQuery);
      fragment.append(...Array.from(beforeContainer.childNodes));
    }
    
    const queryContainer = document.createElement("div");
    queryContainer.className = "query-result-container";
    queryContainer.dataset.query = queryText;
    
    const queryLabel = document.createElement("div");
    queryLabel.className = "query-label";
    queryLabel.textContent = `Query: ${queryText}`;
    queryContainer.appendChild(queryLabel);
    
    const resultsList = document.createElement("div");
    resultsList.className = "query-results";
    
    const results = executeQuery(queryText);
    if (results.length === 0) {
      const noResults = document.createElement("div");
      noResults.className = "query-no-results";
      noResults.textContent = "No se encontraron resultados";
      resultsList.appendChild(noResults);
    } else {
      results.forEach(result => {
        const resultItem = document.createElement("div");
        resultItem.className = "query-result-item";
        const link = document.createElement("a");
        link.className = "query-result-link";
        link.href = "#";
        link.dataset.wikilinkTitle = result.title;
        link.textContent = result.title;
        link.addEventListener("pointerdown", (event) => event.preventDefault());
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const page = vault.getPages().find(p => p.title === result.title);
          if (page) {
            currentPage = page;
            renderBlocksTree();
            renderSidebar();
          }
        });
        resultItem.appendChild(link);
        if (result.snippet) {
          const snippet = document.createElement("div");
          snippet.className = "query-result-snippet";
          snippet.textContent = result.snippet;
          resultItem.appendChild(snippet);
        }
        resultsList.appendChild(resultItem);
      });
    }
    
    queryContainer.appendChild(resultsList);
    fragment.appendChild(queryContainer);
    
    if (afterQuery) {
      const afterContainer = document.createElement("span");
      renderMarkdownText(afterContainer, afterQuery);
      fragment.append(...Array.from(afterContainer.childNodes));
    }
    
    editor.replaceChildren(fragment);
    return;
  }

  const fragment = document.createDocumentFragment();
  if (!isEditing) {
    // Bloques cercados y matemáticas en bloque: se renderizan como nodos
    // atómicos que conservan su fuente original para serializar sin pérdidas.
    const blockPattern = /(```+|~~~+)([^\n]*)\n([\s\S]*?)\n\1|(?<!\$)\$\$([\s\S]+?)\$\$(?!\$)/g;
    let lastBlockIndex = 0;
    let blockMatch: RegExpExecArray | null;
    while ((blockMatch = blockPattern.exec(content)) !== null) {
      if (blockMatch.index > lastBlockIndex) {
        appendInlineMarkdown(fragment, content.slice(lastBlockIndex, blockMatch.index), false);
      }
      if (blockMatch[1] !== undefined && blockMatch[3] !== undefined) {
        const pre = document.createElement("pre");
        pre.className = "code-block";
        pre.contentEditable = "false";
        pre.dataset.codeSource = blockMatch[3];
        const language = (blockMatch[2] || "").trim();
        if (language) pre.dataset.codeLanguage = language;
        const codeEl = document.createElement("code");
        codeEl.textContent = blockMatch[3];
        pre.appendChild(codeEl);
        fragment.appendChild(pre);
      } else if (blockMatch[4] !== undefined) {
        const source = blockMatch[4].trim();
        const display = document.createElement("div");
        display.className = "math-display";
        display.contentEditable = "false";
        display.dataset.mathSource = source;
        display.dataset.mathDisplay = "true";
        display.innerHTML = renderMathToHtml(source, true);
        fragment.appendChild(display);
      }
      lastBlockIndex = blockPattern.lastIndex;
    }
    if (lastBlockIndex < content.length) {
      appendInlineMarkdown(fragment, content.slice(lastBlockIndex), false);
    }
  } else {
    // Mientras se edita se muestra el Markdown crudo: así el cursor y el
    // portapapeles trabajan sobre texto plano y no sobre nodos de KaTeX.
    appendInlineMarkdown(fragment, content, true);
  }
  editor.replaceChildren(fragment);
}

function appendInlineMarkdown(
  fragment: DocumentFragment,
  content: string,
  isEditing: boolean
): void {
  const inlinePattern =
    /`([^`\r\n]+)`|\[\[([^\]\r\n]+)\]\]|\*\*([^*\r\n]+)\*\*|\*([^*\r\n]+)\*|_([^_\r\n]+)_|<u>([^<\r\n]+)<\/u>|==([^=\r\n]+)==|(?<![\\$])\$(?!\$)([^$\r\n]+?)\$(?!\$)|(?<![\p{L}\p{N}_])#([\p{L}\p{N}_/-]{1,100})/gu;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = inlinePattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(content.slice(lastIndex, match.index)));
    }

    if (isEditing) {
      fragment.appendChild(document.createTextNode(match[0]));
      lastIndex = inlinePattern.lastIndex;
      continue;
    }

    const inlineCode = match[1];
    const title = match[2]?.trim();
    const bold = match[3];
    const italic = match[4];
    const italicAlt = match[5];
    const underline = match[6];
    const highlight = match[7];
    const inlineMathSource = match[8];
    const hashtag = match[9];

    if (inlineCode !== undefined) {
      const codeEl = document.createElement("code");
      codeEl.className = "code-inline";
      codeEl.contentEditable = "false";
      codeEl.dataset.codeSource = inlineCode;
      codeEl.textContent = inlineCode;
      fragment.appendChild(codeEl);
    } else if (title) {
      const link = document.createElement("a");
      link.className = "wikilink-anchor";
      link.dataset.wikilinkTitle = title;
      link.href = "#";
      link.textContent = title;
      link.contentEditable = "false";
      link.setAttribute("role", "link");
      link.addEventListener("pointerdown", (event) => event.preventDefault());
      fragment.appendChild(link);
    } else if (inlineMathSource !== undefined) {
      const span = document.createElement("span");
      span.className = "math-inline";
      span.contentEditable = "false";
      span.dataset.mathSource = inlineMathSource;
      span.innerHTML = renderMathToHtml(inlineMathSource, false);
      fragment.appendChild(span);
    } else if (hashtag !== undefined) {
      // Etiquetas como #card: se muestran como pill con el color de acento.
      // El textContent conserva el "#" para serializar el Markdown sin cambios.
      const tag = document.createElement("span");
      tag.className = "editor-tag";
      tag.textContent = `#${hashtag}`;
      fragment.appendChild(tag);
    } else {
      const tagName = bold !== undefined ? "strong"
        : italic !== undefined || italicAlt !== undefined ? "em"
          : underline !== undefined ? "u"
            : "mark";
      const value = bold || italic || italicAlt || underline || highlight || "";
      const formatted = document.createElement(tagName);
      formatted.textContent = value;
      fragment.appendChild(formatted);
    }
    lastIndex = inlinePattern.lastIndex;
  }
  if (lastIndex < content.length) {
    fragment.appendChild(document.createTextNode(content.slice(lastIndex)));
  }
}

function wikilinksMatchEditor(editor: HTMLElement, content: string): boolean {
  if (document.activeElement === editor) return true;
  const expected = Array.from(content.matchAll(/\[\[([^\]\r\n]+)\]\]/g), (match) => match[1].trim());
  const rendered = Array.from(
    editor.querySelectorAll<HTMLElement>(".wikilink-anchor[data-wikilink-title]"),
    (link) => link.dataset.wikilinkTitle || ""
  );
  return expected.length === rendered.length && expected.every((title, index) => title === rendered[index]);
}

interface WikilinkAutocompleteState {
  editor: HTMLElement;
  blockId: string;
  linkStart: number;
  cursorEnd: number;
  query: string;
  selectedIndex: number;
}

let wikilinkAutocompleteMenu: HTMLDivElement | null = null;
let wikilinkAutocompleteState: WikilinkAutocompleteState | null = null;

function getWikilinkAutocompleteMenu(): HTMLDivElement {
  if (wikilinkAutocompleteMenu) return wikilinkAutocompleteMenu;
  wikilinkAutocompleteMenu = document.createElement("div");
  wikilinkAutocompleteMenu.className = "wikilink-autocomplete";
  wikilinkAutocompleteMenu.setAttribute("role", "listbox");
  wikilinkAutocompleteMenu.hidden = true;
  document.body.appendChild(wikilinkAutocompleteMenu);
  return wikilinkAutocompleteMenu;
}

function hideWikilinkAutocomplete(): void {
  if (wikilinkAutocompleteMenu) wikilinkAutocompleteMenu.hidden = true;
  wikilinkAutocompleteState = null;
}

function updateWikilinkAutocomplete(editor: HTMLElement, blockId: string): void {
  const content = serializeEditorContent(editor);
  const cursorEnd = getCaretOffset(editor);
  const linkStart = content.lastIndexOf("[[", cursorEnd - 1);
  if (
    linkStart < 0 ||
    content.slice(linkStart, cursorEnd).includes("]]") ||
    content.indexOf("]]", linkStart + 2) >= cursorEnd
  ) {
    if (wikilinkAutocompleteState?.editor === editor) hideWikilinkAutocomplete();
    return;
  }
  const query = content.slice(linkStart + 2, cursorEnd);
  if (/[\r\n\]]/.test(query)) {
    hideWikilinkAutocomplete();
    return;
  }

  const selection = window.getSelection();
  const caretRange = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  if (!caretRange || !editor.contains(caretRange.startContainer)) return;
  caretRange.collapse(false);
  const caretRect = caretRange.getBoundingClientRect();
  const menu = getWikilinkAutocompleteMenu();
  const matchingPages = vault.getPages()
    .filter((page) => page.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((left, right) => left.title.localeCompare(right.title))
    .slice(0, 8);
  const exactMatch = matchingPages.some((page) => page.title.toLocaleLowerCase() === query.trim().toLocaleLowerCase());
  const entries: Array<{ title: string; create: boolean }> = [];
  if (query.trim() && !exactMatch) entries.push({ title: query.trim(), create: true });
  matchingPages.forEach((page) => entries.push({ title: page.title, create: false }));

  wikilinkAutocompleteState = {
    editor,
    blockId,
    linkStart,
    cursorEnd,
    query,
    selectedIndex: 0,
  };
  menu.replaceChildren();
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "wikilink-autocomplete-empty";
    empty.textContent = translate("No hay notas coincidentes.");
    menu.appendChild(empty);
  } else {
    entries.forEach((entry, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = `wikilink-autocomplete-option${index === 0 ? " selected" : ""}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(index === 0));
      option.dataset.index = String(index);
      option.dataset.title = entry.title;
      option.dataset.create = String(entry.create);
      option.textContent = entry.create
        ? `＋ ${translate("Crear nota")} "${entry.title}"`
        : `📄 ${entry.title}`;
      option.addEventListener("pointerdown", (event) => event.preventDefault());
      option.addEventListener("click", () => {
        void completeWikilink(entry.title, entry.create);
      });
      menu.appendChild(option);
    });
  }

  menu.hidden = false;
  const left = Math.max(8, Math.min(caretRect.left, window.innerWidth - 320));
  const top = Math.min(caretRect.bottom + 4, window.innerHeight - menu.offsetHeight - 8);
  menu.style.left = `${left}px`;
  menu.style.top = `${Math.max(8, top)}px`;
}

async function completeWikilink(title: string, create: boolean): Promise<void> {
  const state = wikilinkAutocompleteState;
  if (!state) return;
  const safeTitle = title.trim().replace(/[\[\]\r\n]/g, "");
  if (!safeTitle) return;
  let page = vault.getPageByTitle(safeTitle);
  if (!page && create) {
    page = vault.createPage(safeTitle);
    renderSidebar();
  }
  if (!page) return;

  const targetPage = findPageForBlock(state.blockId);
  const location = targetPage ? findNodeLocation(targetPage.blocks, state.blockId) : null;
  if (!targetPage || !location) {
    hideWikilinkAutocomplete();
    return;
  }
  const content = serializeEditorContent(state.editor);
  const replacement = `[[${page.title}]]`;
  const nextContent = content.slice(0, state.linkStart) + replacement + content.slice(state.cursorEnd);
  setVisibleBlockContent(location.parentList[location.index], nextContent);
  const nextCaret = state.linkStart + replacement.length;
  hideWikilinkAutocomplete();
  cursorState = { blockId: state.blockId, offset: nextCaret };
  try {
    await vault.savePage(targetPage);
    renderBlocksTree();
  } catch (error) {
    console.error("No se pudo guardar el Wikilink en la nota:", error);
    showToast("No se pudo guardar el Wikilink.");
  }
}

document.addEventListener("pointerdown", (event) => {
  if (!wikilinkAutocompleteMenu || wikilinkAutocompleteMenu.hidden) return;
  if (event.target instanceof Node && !wikilinkAutocompleteMenu.contains(event.target) &&
    !(event.target instanceof Element && event.target.closest(".block-editor"))) {
    hideWikilinkAutocomplete();
  }
});

function getCaretOffset(element: HTMLElement): number {
  let offset = 0;
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    offset = serializeEditorNode(preCaretRange.cloneContents()).length;
  }
  return offset;
}

function getRenderedCaretOffset(element: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return getCaretOffset(element);
  const range = selection.getRangeAt(0);
  const endpoint = range.endContainer;
  if (!element.contains(endpoint) && endpoint !== element) return getCaretOffset(element);

  let offset = 0;
  let found = false;
  const visit = (node: Node): void => {
    if (found) return;
    if (node === endpoint) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += Math.min(range.endOffset, node.textContent?.length || 0);
      } else {
        for (let index = 0; index < Math.min(range.endOffset, node.childNodes.length); index += 1) {
          offset += serializeEditorNode(node.childNodes[index]).length;
        }
      }
      found = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent?.length || 0;
      return;
    }
    if (
      node instanceof HTMLElement &&
      (node.dataset.mathSource !== undefined || node.dataset.codeSource !== undefined)
    ) {
      offset += serializeEditorNode(node).length;
      return;
    }
    if (node instanceof HTMLElement && node.classList.contains("wikilink-anchor")) {
      offset += serializeEditorNode(node).length;
      return;
    }
    if (node instanceof HTMLBRElement) {
      offset += serializeEditorNode(node).length;
      return;
    }

    const delimiters = node instanceof HTMLElement
      ? node.tagName === "STRONG" ? ["**", "**"]
        : node.tagName === "EM" ? ["*", "*"]
          : node.tagName === "U" ? ["<u>", "</u>"]
            : node.tagName === "MARK" ? ["==", "=="]
              : null
      : null;
    if (delimiters) offset += delimiters[0].length;
    for (const child of Array.from(node.childNodes)) {
      visit(child);
      if (found) return;
    }
    if (delimiters) offset += delimiters[1].length;
  };
  visit(element);
  return found ? offset : getCaretOffset(element);
}

function setCaretOffset(element: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;

  const range = document.createRange();
  let current = 0;
  let found = false;

  function traverse(node: Node) {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || "").length;
      if (current + len >= offset) {
        range.setStart(node, Math.min(offset - current, len));
        range.collapse(true);
        found = true;
        return;
      }
      current += len;
    } else if (
      node instanceof HTMLElement &&
      (node.dataset.mathSource !== undefined || node.dataset.codeSource !== undefined)
    ) {
      const atomicLength = serializeEditorNode(node).length;
      if (offset <= current + atomicLength) {
        if (offset - current > atomicLength / 2) range.setStartAfter(node);
        else range.setStartBefore(node);
        range.collapse(true);
        found = true;
        return;
      }
      current += atomicLength;
    } else if (node instanceof HTMLElement && node.classList.contains("wikilink-anchor")) {
      const linkLength = serializeEditorNode(node).length;
      if (offset <= current + linkLength) {
        if (offset - current > linkLength / 2) range.setStartAfter(node);
        else range.setStartBefore(node);
        range.collapse(true);
        found = true;
        return;
      }
      current += linkLength;
    } else if (node instanceof HTMLImageElement && node.dataset.markdownSource) {
      const imageLength = serializeEditorNode(node).length;
      if (offset <= current + imageLength) {
        range.setStartBefore(node);
        range.collapse(true);
        found = true;
        return;
      }
      current += imageLength;
    } else if (node instanceof HTMLBRElement) {
      if (offset <= current + 1) {
        range.setStartBefore(node);
        range.collapse(true);
        found = true;
        return;
      }
      current += 1;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
      }
    }
  }

  traverse(element);
  if (!found) {
    range.selectNodeContents(element);
    range.collapse(false);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

function splitBlockProperties(content: string): { text: string; properties: string[] } {
  const textLines: string[] = [];
  const properties: string[] = [];
  content.split(/\r?\n/).forEach((line) => {
    if (/^[\w-]+::\s*.*$/i.test(line.trim())) properties.push(line.trim());
    else textLines.push(line);
  });
  return { text: textLines.join("\n"), properties };
}

function splitTaskPrefix(content: string): { prefix: string; text: string } {
  const match = content.match(/^(TODO|LATER|DOING|NOW|DONE)\s+/i);
  return match
    ? { prefix: match[0], text: content.slice(match[0].length) }
    : { prefix: "", text: content };
}

function getVisibleBlockContent(content: string): string {
  return splitTaskPrefix(splitBlockProperties(content).text).text;
}

function setVisibleBlockContent(node: BlockNode, text: string): void {
  const { properties } = splitBlockProperties(node.content);
  const { prefix } = splitTaskPrefix(splitBlockProperties(node.content).text);
  node.content = `${prefix}${text}${properties.length ? `\n${properties.join("\n")}` : ""}`;
}

function isFlashcardBlockContent(content: string): boolean {
  const { text, properties } = splitBlockProperties(content);
  return (
    /#card\b/i.test(text) ||
    text.includes("::") ||
    /\{\{(?:c\d+::|cloze\s+)/i.test(text) ||
    /==.*?==/.test(text) ||
    properties.some((property) => /^image-occlusions::/i.test(property))
  );
}

function ensureBlockCreatedAt(node: BlockNode): void {
  const { text, properties } = splitBlockProperties(node.content);
  if (properties.some((property) => /^created-at::/i.test(property))) return;
  properties.push(`created-at:: ${new Date().toISOString()}`);
  node.content = `${text}${text && properties.length ? "\n" : ""}${properties.join("\n")}`;
}

function cloneImageOcclusionRegion(region: ImageOcclusionRegion): ImageOcclusionRegion {
  return {
    ...region,
    ...(region.points ? { points: region.points.map(({ x, y }) => ({ x, y })) } : {}),
  };
}

function saveBlockImageOcclusions(
  node: BlockNode,
  source: string,
  regions: ImageOcclusionRegion[]
): void {
  const { text, properties } = splitBlockProperties(node.content);
  const { prefix, text: visibleText } = splitTaskPrefix(text);
  const retained = properties.filter((property) => !/^image-occlusions::/i.test(property));
  const merged = [
    ...parseImageOcclusions(node.content)
      .filter((region) => region.source !== source)
      .map(cloneImageOcclusionRegion),
    ...regions.map((region) =>
      cloneImageOcclusionRegion(clampImageOcclusionRegion({ ...region, source }))
    ),
  ];
  if (merged.length > 0) retained.push(`image-occlusions:: ${JSON.stringify(merged)}`);
  node.content = `${prefix}${visibleText}${retained.length ? `\n${retained.join("\n")}` : ""}`;
}

function imageAbsolutePath(source: string): string | null {
  const resolvedPath = resolvedImagePaths.get(source);
  if (resolvedPath) return resolvedPath;
  const localSource = source.startsWith("file://")
    ? decodeURIComponent(new URL(source).pathname)
    : source;
  const root = vault.getActiveRootPath();
  const candidatePath = /^(?:\/|[a-z]:[\\/])/i.test(localSource)
    ? localSource
    : root
      ? `${root.replace(/[\\/]+$/, "")}/${localSource.replace(/^[\\/]+/, "")}`
      : "";
  if (!candidatePath) return null;
  const slashPath = candidatePath.replace(/\\/g, "/");
  const driveMatch = slashPath.match(/^([a-z]:)\/?/i);
  const rooted = slashPath.startsWith("/") || driveMatch !== null;
  const pathBody = driveMatch ? slashPath.slice(driveMatch[0].length) : slashPath.replace(/^\/+/, "");
  const segments: string[] = [];
  pathBody.split("/").forEach((segment) => {
    if (!segment || segment === ".") return;
    if (segment === "..") {
      if (segments.length > 0 && segments[segments.length - 1] !== "..") segments.pop();
      else if (!rooted) segments.push(segment);
      return;
    }
    segments.push(segment);
  });
  const absolutePath = driveMatch
    ? `${driveMatch[1]}/${segments.join("/")}`
    : rooted
      ? `/${segments.join("/")}`
      : segments.join("/");
  return absolutePath || null;
}

function imageSourceUrl(source: string): string | null {
  if (/^data:image\/(?:png|jpe?g|webp|svg\+xml|gif|bmp);/i.test(source)) return source;
  if (/^(?:https?:|blob:)/i.test(source)) return source;
  if (/^(?:javascript:|data:|vbscript:)/i.test(source)) return null;
  if (!isTauri()) return source;

  const absolutePath = imageAbsolutePath(source);
  if (!absolutePath) return null;
  return convertFileSrc(absolutePath);
}

async function resolveImageUrl(source: string): Promise<string | null> {
  if (/^data:image\/(?:png|jpe?g|webp|svg\+xml|gif|bmp);/i.test(source)) return source;
  if (/^(?:https?:|blob:)/i.test(source)) return source;
  if (/^(?:javascript:|data:|vbscript:)/i.test(source)) return null;
  if (!isTauri()) return imageSourceUrl(source);

  let decodedSource = source;
  try {
    decodedSource = source.startsWith("file://")
      ? decodeURIComponent(new URL(source).pathname)
      : decodeURIComponent(source);
  } catch (error) {
    if (error instanceof URIError) {
      console.warn(`La ruta de imagen contiene escapes URI inválidos: ${source}`);
    } else {
      throw error;
    }
  }
  const root = vault.getActiveRootPath();
  const sourcePath = /^(?:\/|[a-z]:[\\/])/i.test(decodedSource) || source.startsWith("file://")
    ? imageAbsolutePath(decodedSource) || decodedSource
    : root
      ? await join(root, decodedSource.replace(/^\.\//, "").replace(/\\/g, "/"))
      : decodedSource;
  const absolutePath = resolvedImagePaths.get(source) || resolvedImagePaths.get(decodedSource) ||
    await invoke<string>("resolve_image_path", { source: sourcePath });
  resolvedImagePaths.set(source, absolutePath);
  resolvedImagePaths.set(decodedSource, absolutePath);
  return convertFileSrc(absolutePath);
}

async function imageUrlLoads(url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const probe = new Image();
    probe.onload = () => resolve();
    probe.onerror = () => reject(new Error(`No se pudo cargar la imagen desde ${url}`));
    probe.src = url;
  });
}

async function resolveDisplayImageUrl(source: string): Promise<string> {
  const cacheKey = `${vault.getActiveRootPath()}\0${source}`;
  const cachedFallbackUrl = resolvedImageFallbackUrls.get(cacheKey);
  if (cachedFallbackUrl) return cachedFallbackUrl;

  let assetError: unknown;
  try {
    const assetUrl = await resolveImageUrl(source);
    if (assetUrl) {
      await imageUrlLoads(assetUrl);
      return assetUrl;
    }
  } catch (error) {
    assetError = error;
  }

  if (isTauri()) {
    try {
      const bytes = await invoke<number[]>("read_image_data", { source });
      const extension = imageExtension(source) || "png";
      const mimeTypes: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        svg: "image/svg+xml",
        gif: "image/gif",
        bmp: "image/bmp",
      };
      const blobUrl = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], {
        type: mimeTypes[extension] || "application/octet-stream",
      }));
      try {
        await imageUrlLoads(blobUrl);
      } catch (error) {
        URL.revokeObjectURL(blobUrl);
        throw error;
      }
      resolvedImageFallbackUrls.set(cacheKey, blobUrl);
      return blobUrl;
    } catch (error) {
      throw new Error(
        `Fallaron la URL de recurso y la lectura nativa de la imagen: ${source}. ` +
        `Recurso: ${String(assetError)}. Lectura nativa: ${String(error)}`
      );
    }
  }

  throw assetError instanceof Error
    ? assetError
    : new Error(`No se pudo resolver la imagen: ${source}`);
}

function clearResolvedImages(): void {
  resolvedImagePaths.clear();
  resolvedImageFallbackUrls.forEach((url) => URL.revokeObjectURL(url));
  resolvedImageFallbackUrls.clear();
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("No se pudo leer la imagen seleccionada."));
    }, { once: true });
    reader.addEventListener("error", () => reject(reader.error || new Error("Error al leer la imagen.")), { once: true });
    reader.readAsDataURL(file);
  });
}

function imageExtension(fileName: string): string | null {
  const cleanFileName = fileName.split(/[?#]/, 1)[0];
  if (!IMAGE_EXTENSION_PATTERN.test(cleanFileName)) return null;
  return cleanFileName.slice(cleanFileName.lastIndexOf(".") + 1).toLowerCase();
}

function timestampImageFileName(extension: string): string {
  const now = new Date();
  const twoDigits = (value: number) => String(value).padStart(2, "0");
  const threeDigits = (value: number) => String(value).padStart(3, "0");
  const timestamp = [
    now.getFullYear(),
    twoDigits(now.getMonth() + 1),
    twoDigits(now.getDate()),
  ].join("") + "_" + [
    twoDigits(now.getHours()),
    twoDigits(now.getMinutes()),
    twoDigits(now.getSeconds()),
  ].join("") + threeDigits(now.getMilliseconds());
  return `img_${timestamp}.${extension}`;
}

function dataUrlToImageFile(source: string): File | null {
  const match = /^data:(image\/[a-z0-9.+-]+)((?:;[^,]*)?),([\s\S]*)$/i.exec(source.trim());
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const extension = IMAGE_MIME_EXTENSIONS[mime];
  if (!extension) return null;
  try {
    let bytes: Uint8Array;
    if (/;\s*base64(?:;|$)/i.test(match[2])) {
      const binary = atob(match[3].replace(/\s/g, ""));
      bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(match[3]));
    }
    return new File([bytes.buffer as ArrayBuffer], timestampImageFileName(extension), { type: mime });
  } catch (error) {
    console.error("No se pudo convertir una imagen del portapapeles:", error);
    return null;
  }
}

function fileUrlToLocalPath(source: string): string | null {
  try {
    const url = new URL(source);
    if (url.protocol !== "file:") return null;
    let path = decodeURIComponent(url.pathname);
    if (/^\/[a-z]:\//i.test(path)) path = path.slice(1);
    return path || null;
  } catch {
    return null;
  }
}

async function imageSourceToFile(source: string): Promise<File | null> {
  const trimmed = source.trim();
  if (!trimmed) return null;
  if (/^data:image\//i.test(trimmed)) return dataUrlToImageFile(trimmed);
  if (!isAllowedRemoteImageUrl(trimmed, window.location.href)) {
    throw new Error("URL no permitida por motivos de seguridad.");
  }

  const response = await fetch(trimmed);
  if (!response.ok) throw new Error(`La imagen respondió con ${response.status}.`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error(`El contenido descargado no es una imagen (${blob.type || "sin tipo"}).`);
  }
  const extension = IMAGE_MIME_EXTENSIONS[blob.type]
    || imageExtension(new URL(trimmed, window.location.href).pathname)
    || "png";
  return new File([blob], timestampImageFileName(extension), { type: blob.type });
}

async function insertClipboardImageSource(source: string, blockId: string, page?: PageData): Promise<void> {
  const targetPage = page || findPageForBlock(blockId) || currentPage;
  if (!findNodeLocation(targetPage.blocks, blockId)) {
    showToast("No se encontró el bloque donde insertar la imagen.");
    return;
  }

  const localPath = /^file:/i.test(source)
    ? fileUrlToLocalPath(source)
    : isTauri() && /^(?:\/|[a-z]:[\\/])/i.test(source) && imageExtension(source) !== null
      ? source
      : null;
  if (localPath) {
    if (!isTauri()) {
      showToast("La imagen del portapapeles solo se puede leer en la aplicación de escritorio.");
      return;
    }
    await insertDroppedImagePath(localPath, blockId, targetPage);
    return;
  }

  try {
    const file = await imageSourceToFile(source);
    if (!file) {
      showToast("No se pudo leer la imagen del portapapeles.");
      return;
    }
    await insertImageFile(file, blockId, false, targetPage);
  } catch (error) {
    console.error("No se pudo importar la imagen pegada desde el portapapeles:", error);
    showToast("No se pudo descargar la imagen pegada. Prueba a copiarla como archivo o a arrastrarla desde una carpeta.");
  }
}

async function insertImageBlock(source: string, fileName: string, blockId: string, page?: PageData): Promise<string> {
  const targetPage = page || findPageForBlock(blockId) || currentPage;
  const previousTree = targetPage.blocks;
  const targetLocation = findNodeLocation(previousTree, blockId);
  if (!targetLocation) throw new Error("No se encontró el bloque donde insertar la imagen.");
  const cursorOffset = getVisibleBlockContent(targetLocation.parentList[targetLocation.index].content).length;
  const alt = fileName.replace(/\.[^.]+$/, "").replace(/[\[\]()\\]/g, "_") || "imagen";
  const result = insertImageBlockAfter(previousTree, blockId, source, alt);
  if (!result) throw new Error("No se encontró el bloque donde insertar la imagen.");

  targetPage.blocks = result.newTree;
  cursorState = { blockId, offset: cursorOffset };
  try {
    await vault.savePage(targetPage);
    renderBlocksTree();
    return result.newBlockId;
  } catch (error) {
    targetPage.blocks = previousTree;
    cursorState = null;
    renderBlocksTree();
    try {
      await vault.savePage(targetPage);
    } catch (rollbackError) {
      console.error("No se pudo restaurar la página tras fallar la inserción de imagen:", rollbackError);
    }
    throw error;
  }
}

function supportedImageExtension(file: File): string | null {
  if (file.type) return IMAGE_MIME_EXTENSIONS[file.type] || null;
  return imageExtension(file.name);
}

async function convertImageFileToPng(file: File): Promise<File | null> {
  if (file.type && !file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width <= 0 || bitmap.height <= 0) return null;
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(bitmap, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });
      if (!blob) return null;
      return new File([blob], timestampImageFileName("png"), { type: "image/png" });
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

async function insertImageFile(file: File, blockId: string, openOcclusionAfterInsert = false, page?: PageData): Promise<void> {
  const targetPage = page || findPageForBlock(blockId) || currentPage;
  let uploadFile = file;
  let extension = supportedImageExtension(uploadFile);
  if (!extension) {
    const converted = await convertImageFileToPng(file);
    if (!converted) {
      showToast("Formato de imagen no compatible. Usa PNG, JPG, WEBP, GIF, BMP o SVG.");
      return;
    }
    uploadFile = converted;
    extension = "png";
  }
  if (!findNodeLocation(targetPage.blocks, blockId)) {
    showToast("No se encontró el bloque donde insertar la imagen.");
    return;
  }
  const sizeLimit = isTauri() ? 5 * 1024 * 1024 : 512 * 1024;
  if (uploadFile.size === 0 || uploadFile.size > sizeLimit) {
    showToast(`La imagen debe pesar menos de ${isTauri() ? "5 MB" : "512 KB"} en este entorno.`);
    return;
  }

  try {
    let source: string;
    if (isTauri()) {
      const bytes = Array.from(new Uint8Array(await uploadFile.arrayBuffer()));
      const fileName = timestampImageFileName(extension);
      const savedImage = await invoke<SavedImagePath>("save_image", { fileName, bytes });
      source = savedImage.relativePath;
      resolvedImagePaths.set(source, savedImage.absolutePath);
    } else {
      source = await fileToDataUrl(uploadFile);
    }

    const insertedBlockId = await insertImageBlock(source, uploadFile.name, blockId, targetPage);
    showToast("Imagen insertada en el bloque.");
    if (openOcclusionAfterInsert && insertedBlockId) {
      openImageOcclusionEditor(insertedBlockId, source);
    }
  } catch (error) {
    console.error("No se pudo insertar la imagen:", error);
    showToast("No se pudo guardar la imagen en el vault.");
  }
}

async function insertDroppedImagePath(sourcePath: string, blockId: string, page?: PageData): Promise<void> {
  const targetPage = page || findPageForBlock(blockId) || currentPage;
  const fileName = sourcePath.split(/[\\/]/).pop() || "";
  const extension = imageExtension(fileName);
  if (!extension) return;
  if (!isTauri()) return;
  if (!findNodeLocation(targetPage.blocks, blockId)) {
    showToast("No se encontró el bloque donde insertar la imagen.");
    return;
  }

  try {
    const savedImage = await invoke<SavedImagePath>("save_dropped_image", {
      sourcePath,
      fileName: timestampImageFileName(extension),
    });
    resolvedImagePaths.set(savedImage.relativePath, savedImage.absolutePath);
    await insertImageBlock(savedImage.relativePath, fileName, blockId, targetPage);
    showToast("Imagen copiada a assets/ e insertada en el bloque.");
  } catch (error) {
    console.error("No se pudo copiar la imagen arrastrada al vault:", error);
    showToast("No se pudo copiar la imagen al vault. Comprueba su formato y tamaño (máximo 5 MB).");
  }
}

function editorFromDropTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(".block-editor, .block-item[data-id]");
}

let lastClipboardImagePasteAt = 0;
let lastClipboardTextPasteAt = 0;
let nativeClipboardPasteInFlight = false;

async function nativeClipboardImageFile(): Promise<File | null> {
  if (!isTauri()) return null;
  let clipboardImage: Awaited<ReturnType<typeof readClipboardImage>> | null = null;
  try {
    clipboardImage = await readClipboardImage();
    const [{ width, height }, rgba] = await Promise.all([
      clipboardImage.size(),
      clipboardImage.rgba(),
    ]);
    if (width <= 0 || height <= 0 || rgba.byteLength !== width * height * 4) return null;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!blob) return null;
    return new File([blob], timestampImageFileName("png"), { type: "image/png" });
  } catch {
    // Es normal que el portapapeles no contenga una imagen (por ejemplo, al pegar texto).
    return null;
  } finally {
    if (clipboardImage) {
      await clipboardImage.close().catch(() => undefined);
    }
  }
}

async function pasteNativeClipboardImage(blockId: string, force = false, page?: PageData): Promise<boolean> {
  if (!isTauri() || nativeClipboardPasteInFlight) return false;
  if (
    !force &&
    (Date.now() - lastClipboardImagePasteAt < 800 || Date.now() - lastClipboardTextPasteAt < 800)
  ) {
    return false;
  }

  nativeClipboardPasteInFlight = true;
  try {
    const file = await nativeClipboardImageFile();
    if (!file) return false;
    if (
      !force &&
      (Date.now() - lastClipboardImagePasteAt < 1200 || Date.now() - lastClipboardTextPasteAt < 1200)
    ) {
      return false;
    }
    await insertImageFile(file, blockId, false, page);
    lastClipboardImagePasteAt = Date.now();
    return true;
  } finally {
    nativeClipboardPasteInFlight = false;
  }
}

async function insertClipboardImageFile(file: File, blockId: string, page?: PageData): Promise<void> {
  if (supportedImageExtension(file)) {
    await insertImageFile(file, blockId, false, page);
    return;
  }

  if (isTauri()) {
    if (nativeClipboardPasteInFlight || Date.now() - lastClipboardImagePasteAt < 800) return;
    if (await pasteNativeClipboardImage(blockId, true, page)) return;
  }

  const converted = await convertImageFileToPng(file);
  if (!converted) {
    showToast("Formato de imagen no compatible. Usa PNG, JPG, WEBP, GIF, BMP o SVG.");
    return;
  }
  await insertImageFile(converted, blockId, false, page);
}

function clipboardImageFile(clipboard: DataTransfer | null): File | null {
  if (!clipboard) return null;
  const directFile = Array.from(clipboard.files || []).find((candidate) =>
    candidate.type.startsWith("image/") || imageExtension(candidate.name) !== null
  );
  if (directFile) return directFile;

  return Array.from(clipboard.items || [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .find((candidate): candidate is File =>
      candidate !== null &&
      (candidate.type.startsWith("image/") || imageExtension(candidate.name) !== null)
    ) || null;
}

function clipboardHtmlImageSource(clipboard: DataTransfer | null): string | null {
  const html = clipboard?.getData("text/html");
  if (html) {
    try {
      let sanitizedHtml = html;
      try {
        const DOMPurifyModule = (window as any).DOMPurify;
        if (DOMPurifyModule && typeof DOMPurifyModule.sanitize === "function") {
          sanitizedHtml = DOMPurifyModule.sanitize(html, { ALLOWED_TAGS: ["img"], ALLOWED_ATTR: ["src", "srcset"], FORBID_TAGS: ["script", "iframe", "object", "embed"], FORBID_ATTR: ["onerror", "onload", "onclick"] });
        } else {
          sanitizedHtml = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+on\w+\s*=[^>]+>/gi, (m: string) => m.replace(/on\w+\s*=[^>\s]+/gi, ""));
        }
      } catch {
        sanitizedHtml = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/ on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
      }
      const documentFragment = new DOMParser().parseFromString(sanitizedHtml, "text/html");
      const image = documentFragment.querySelector("img");
      const source = image?.getAttribute("src")?.trim()
        || image?.getAttribute("srcset")?.split(",")[0]?.trim().split(/\s+/)[0]
        || "";
      if (source && !/^(?:javascript:|vbscript:)/i.test(source)) return source;
    } catch (error) {
      console.warn("No se pudo interpretar el HTML del portapapeles:", error);
    }
  }

  const uriList = clipboard?.getData("text/uri-list")
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
  if (uriList && (/^file:/i.test(uriList) || IMAGE_EXTENSION_PATTERN.test(uriList))) {
    return uriList;
  }

  const text = clipboard?.getData("text/plain")?.trim();
  if (
    text &&
    (
      /^data:image\//i.test(text) ||
      /^(?:blob:|https?:|file:)/i.test(text) ||
      (IMAGE_EXTENSION_PATTERN.test(text) && !/\s/.test(text))
    )
  ) {
    return text;
  }
  return null;
}

blocksContainer.addEventListener("dragover", (event: DragEvent) => {
  if (isTauri()) return;
  if (!event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});

blocksContainer.addEventListener("drop", (event: DragEvent) => {
  if (isTauri()) {
    event.preventDefault();
    return;
  }
  const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
    imageExtension(file.name) !== null || file.type.startsWith("image/")
  );
  const editor = editorFromDropTarget(event.target);
  if (!files.length || !editor?.dataset.id) return;

  event.preventDefault();
  for (const file of files) void insertImageFile(file, editor.dataset.id);
});

interface NativeFileDropPayload {
  paths: string[];
  position?: { x: number; y: number };
}

function editorAtNativeDropPosition(position?: { x: number; y: number }): HTMLElement | null {
  if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
    const scale = window.devicePixelRatio || 1;
    const points = [
      [position.x / scale, position.y / scale],
      [position.x, position.y],
      [position.x * scale, position.y * scale],
    ];
    for (const [x, y] of points) {
      const editor = editorFromDropTarget(document.elementFromPoint(x, y));
      if (editor?.dataset.id) return editor;
    }
    return null;
  }

  const focusedEditor = document.activeElement instanceof HTMLElement &&
    document.activeElement.matches(".block-editor, .block-item[data-id]")
    ? editorFromDropTarget(document.activeElement)
    : null;
  return focusedEditor?.dataset.id ? focusedEditor : null;
}

async function handleNativeImageDrop(payload: NativeFileDropPayload): Promise<void> {
  if (!Array.isArray(payload.paths)) return;
  const editor = editorAtNativeDropPosition(payload.position);
  let blockId = editor?.dataset.id || "";
  if (!blockId && cursorState?.blockId && findNodeLocation(currentPage.blocks, cursorState.blockId)) {
    blockId = cursorState.blockId;
  }
  if (!blockId) {
    const flatBlocks = getAllBlocksFlat(currentPage.blocks);
    blockId = flatBlocks[flatBlocks.length - 1]?.id || "";
  }
  if (!blockId) return;
  for (const path of payload.paths) {
    if (imageExtension(path) !== null) {
      await insertDroppedImagePath(path, blockId);
    }
  }
}

function readEditorSelection(editor: HTMLElement, blockId: string): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null;

  const prefixRange = range.cloneRange();
  prefixRange.selectNodeContents(editor);
  prefixRange.setEnd(range.startContainer, range.startOffset);
  const start = serializeEditorNode(prefixRange.cloneContents()).length;
  const end = start + serializeEditorNode(range.cloneContents()).length;
  lastEditorSelection = { blockId, start, end };
  return { start, end };
}

/**
 * Inserta texto plano en la posición del caret del editor, sin HTML del
 * portapapeles: `insertText` escribe nodos de texto, y el contenido nuevo
 * vivirá en el modelo Markdown (con su saneado al renderizar).
 */
function pasteTextInputIntoEditor(editor: HTMLElement, text: string): void {
  const MAX_PASTE_TEXT_LENGTH = 200_000;
  if (text.length > MAX_PASTE_TEXT_LENGTH) {
    showToast(translate("El texto pegado era demasiado largo y se recortó."));
  }
  const bounded = text.length > MAX_PASTE_TEXT_LENGTH ? text.slice(0, MAX_PASTE_TEXT_LENGTH) : text;
  editor.focus();
  if (!document.execCommand("insertText", false, bounded)) {
    console.warn("No se pudo insertar el texto pegado.");
  }
}

function setContextSelection(editor: HTMLElement, blockId: string): void {  const selection = readEditorSelection(editor, blockId) ||
    (lastEditorSelection?.blockId === blockId
      ? { start: lastEditorSelection.start, end: lastEditorSelection.end }
      : null);
  contextSelectionRange = selection || { start: 0, end: 0 };
}

/** Página que contiene un bloque, incluso si no es la página del editor principal. */
function findPageForBlock(blockId: string): PageData | null {
  if (findNodeLocation(currentPage.blocks, blockId)) return currentPage;
  if (contextTargetPage && findNodeLocation(contextTargetPage.blocks, blockId)) return contextTargetPage;
  for (const page of vault.getPages()) {
    if (findNodeLocation(page.blocks, blockId)) return page;
  }
  return null;
}

function getContextPage(): PageData {
  return contextTargetPage || currentPage;
}

/** Página a la que pertenece la selección actual de bullets. */
function getSelectionPage(): PageData {
  const firstSelected = selectedBulletIds[0];
  return (firstSelected && findPageForBlock(firstSelected)) || currentPage;
}

function getSelectedContextText(): string | null {
  if (!contextTargetBlockId) return null;
  const page = getContextPage();
  const location = findNodeLocation(page.blocks, contextTargetBlockId);
  if (!location) return null;
  const content = getVisibleBlockContent(location.parentList[location.index].content);
  const { start, end } = contextSelectionRange;
  return end > start && end <= content.length ? content.slice(start, end) : null;
}

function serializeBlockSubtree(block: BlockNode, depth = 0): string {
  const { text: rawText, properties } = splitBlockProperties(block.content);
  const visibleContent = rawText;
  const bulletText = block.type === "image"
    ? `![${block.imageAlt || "imagen"}](${visibleContent.split(/\r?\n/, 1)[0]})`
    : visibleContent;
  const indentation = "  ".repeat(depth);
  const lines = [`${indentation}- ${bulletText}`];
  properties.forEach((property) => lines.push(`${indentation}${property}`));
  block.children.forEach((child) => {
    lines.push(serializeBlockSubtree(child, depth + 1));
  });
  return lines.join("\n");
}

async function writeClipboardText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch (error) {
    console.warn("El portapapeles moderno no está disponible; se intentará el respaldo:", error);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("El WebView rechazó la copia al portapapeles.");
}

function parseBulletClipboard(markdown: string): BlockNode[] {
  const roots: BlockNode[] = [];
  const stack: Array<{ indent: number; block: BlockNode }> = [];
  let lastBlock: BlockNode | null = null;

  markdown.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    const bullet = line.match(/^(\s*)(?:[-*+]|\d+\.)\s+(.*)$/);
    if (!bullet) {
      if (lastBlock && /^[\w-]+::\s*.*$/i.test(line.trim())) {
        lastBlock.content += `\n${line.trim()}`;
      } else if (lastBlock) {
        lastBlock.content += `\n${line.trim()}`;
      } else {
        const block: BlockNode = {
          id: generateId(),
          type: "text",
          content: line.trim(),
          children: [],
          collapsed: false,
        };
        roots.push(block);
        lastBlock = block;
      }
      return;
    }

    const indent = bullet[1].replace(/\t/g, "  ").length;
    const content = bullet[2];
    const image = getStandaloneMarkdownImage(content);
    const block: BlockNode = {
      id: generateId(),
      type: image ? "image" : "text",
      content: image?.source || content,
      ...(image ? { imageAlt: image.alt } : {}),
      children: [],
      collapsed: false,
    };
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
    if (stack.length > 0) stack[stack.length - 1].block.children.push(block);
    else roots.push(block);
    stack.push({ indent, block });
    lastBlock = block;
  });

  return roots;
}

async function cutSelectedBullets(page: PageData = getSelectionPage()): Promise<void> {
  if (await copySelectedBullets(page) && selectedBulletIds.length > 0) {
    await deleteSelectedBullets(page);
  }
}

async function pasteBulletClipboard(targetBlockId: string, clipboardText: string, page: PageData = currentPage): Promise<void> {
  const blocks = parseBulletClipboard(clipboardText);
  if (blocks.length === 0) return;
  const newTree = insertBlocksAfter(page.blocks, targetBlockId, blocks);
  if (!newTree) return;
  const previousTree = page.blocks;
  page.blocks = newTree;
  selectedBulletIds = [];
  bulletSelectionAnchorId = null;
  cursorState = { blockId: blocks[blocks.length - 1].id, offset: getVisibleBlockContent(blocks[blocks.length - 1].content).length };
  try {
    await vault.savePage(page, true);
    renderBlocksTree();
    showToast("Bullets pegados conservando su jerarquía.");
  } catch (error) {
    console.error("No se pudieron pegar los bullets:", error);
    page.blocks = previousTree;
    cursorState = null;
    renderBlocksTree();
    showToast("No se pudieron pegar los bullets en el vault.");
  }
}

function getBulletEditorRoots(): HTMLElement[] {
  const roots: HTMLElement[] = [blocksContainer];
  const journalsContainer = document.getElementById("journals-container");
  if (journalsContainer) roots.push(journalsContainer);
  return roots;
}

function refreshBulletSelection(): void {
  const selected = new Set(selectedBulletIds);
  getBulletEditorRoots().forEach((root) => {
    root.querySelectorAll<HTMLElement>(".block-item[data-id]").forEach((item) => {
      const isSelected = selected.has(item.dataset.id || "");
      item.classList.toggle("is-selected", isSelected);
      item.querySelector<HTMLElement>(":scope > .block-row")?.classList.toggle("is-selected", isSelected);
    });
  });
}

function getBoxSelectionOverlay(): HTMLDivElement {
  if (boxSelectionOverlay) return boxSelectionOverlay;
  boxSelectionOverlay = document.createElement("div");
  boxSelectionOverlay.className = "bullet-selection-box";
  boxSelectionOverlay.hidden = true;
  document.body.appendChild(boxSelectionOverlay);
  return boxSelectionOverlay;
}

function clearBulletSelection(): void {
  selectedBulletIds = [];
  bulletSelectionAnchorId = null;
  refreshBulletSelection();
}

function selectBulletRange(anchorId: string, focusId: string, extend = false, page: PageData = currentPage): void {
  const visible = getFlatVisibleBlocks(page.blocks);
  const anchorIndex = visible.findIndex((block) => block.id === anchorId);
  const focusIndex = visible.findIndex((block) => block.id === focusId);
  if (anchorIndex < 0 || focusIndex < 0) return;
  if (!extend) bulletSelectionAnchorId = anchorId;
  const start = Math.min(anchorIndex, focusIndex);
  const end = Math.max(anchorIndex, focusIndex);
  const selected = new Set(extend ? selectedBulletIds : []);
  visible.slice(start, end + 1).forEach((block) => selected.add(block.id));
  selectedBulletIds = visible.filter((block) => selected.has(block.id)).map((block) => block.id);
  refreshBulletSelection();
}

async function copySelectedBullets(page: PageData = getSelectionPage()): Promise<boolean> {
  const roots = getSelectedBlockRoots(page.blocks, new Set(selectedBulletIds));
  if (roots.length === 0) return false;
  const text = roots.map((block) => serializeBlockSubtree(block)).filter(Boolean).join("\n");
  if (!text) return false;
  try {
    await writeClipboardText(text);
    showToast("Bullets copiados al portapapeles.");
    return true;
  } catch (error) {
    console.error("No se pudieron copiar los bullets seleccionados:", error);
    showToast("No se pudieron copiar los bullets seleccionados.");
    return false;
  }
}

async function deleteSelectedBullets(page: PageData = getSelectionPage()): Promise<void> {
  const ids = new Set(selectedBulletIds);
  if (ids.size === 0) return;
  const previousTree = page.blocks;
  const previousFlat = getFlatVisibleBlocks(previousTree);
  const firstSelectedIndex = previousFlat.findIndex((block) => ids.has(block.id));
  const nextFocus = previousFlat.slice(firstSelectedIndex + 1).find((block) => !ids.has(block.id)) ||
    [...previousFlat.slice(0, firstSelectedIndex)].reverse().find((block) => !ids.has(block.id));
  const nextTree = removeBlocks(previousTree, ids);
  page.blocks = nextTree;
  selectedBulletIds = [];
  bulletSelectionAnchorId = null;
  cursorState = nextFocus && findNodeLocation(nextTree, nextFocus.id)
    ? { blockId: nextFocus.id, offset: 0 }
    : { blockId: nextTree[0].id, offset: 0 };
  try {
    await vault.savePage(page);
    renderBlocksTree();
  } catch (error) {
    console.error("No se pudieron eliminar los bullets seleccionados:", error);
    page.blocks = previousTree;
    cursorState = null;
    renderBlocksTree();
    void vault.savePage(page).catch((restoreError: unknown) => {
      console.error("No se pudo persistir el árbol restaurado de bullets:", restoreError);
    });
    showToast("No se pudieron eliminar los bullets seleccionados.");
  }
}

/** Indenta todos los bullets seleccionados un nivel (Tab con selección múltiple). */
function indentSelectedBullets(page: PageData = getSelectionPage()): boolean {
  const ids = new Set(selectedBulletIds);
  if (ids.size === 0) return false;
  const newTree = indentBlocks(page.blocks, ids);
  if (!newTree) return false;
  page.blocks = newTree;
  void vault.savePage(page);
  renderBlocksTree();
  return true;
}

/** Desindenta todos los bullets seleccionados un nivel (Shift+Tab con selección múltiple). */
function outdentSelectedBullets(page: PageData = getSelectionPage()): boolean {
  const ids = new Set(selectedBulletIds);
  if (ids.size === 0) return false;
  const newTree = outdentBlocks(page.blocks, ids);
  if (!newTree) return false;
  page.blocks = newTree;
  void vault.savePage(page);
  renderBlocksTree();
  return true;
}

/**
 * Quita de un bullet los marcadores que lo convierten en flashcard (`#card`,
 * resaltados/cloze y sus propiedades de programación) conservando el texto.
 */
function removeFlashcardMarkers(content: string): string {
  const cardPropertyPattern =
    /^(?:card-[a-z-]+|last-reviewed|interval-days|ease-factor|due-date|image-occlusions)::/i;
  const keptLines = content
    .split(/\r?\n/)
    .filter((line) => !cardPropertyPattern.test(line.trim()));
  // Separar propiedades del texto visible: solo se transforma el texto.
  const { text, properties } = splitBlockProperties(keptLines.join("\n"));
  let visible = text;
  // Cloze estilo Anki: {{c1::texto}}, {{cloze texto}} o {{texto}} → texto.
  visible = visible.replace(/\{\{(?:c\d+::|cloze\s+)?([^}\n]*)\}\}/gi, "$1");
  // Resaltado usado como cloze: ==texto== → texto.
  visible = visible.replace(/==([^=\n]+)==/g, "$1");
  // Etiquetas de tarjeta.
  visible = stripCardTag(visible).replace(/#flashcards?\b/gi, "");
  // El separador `::` también genera una tarjeta básica; se conserva como
  // puntuación normal para que el bullet siga siendo legible.
  visible = visible.replace(/\s*::\s*/g, " : ");
  const cleaned = visible
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return [cleaned, ...properties].filter((part) => part.length > 0).join("\n");
}

/**
 * Quita una única región de la propiedad `image-occlusions::` conservando el
 * resto de oclusiones y el contenido del bloque.
 */
function removeImageOcclusionMarker(content: string, region: ImageOcclusionRegion): string {
  const propertyMatch = content.match(
    /(^|\n)([ \t]*)image-occlusions::\s*(\[[^\n]*\])/i
  );
  if (!propertyMatch || propertyMatch.index === undefined) return content;

  let rawRegions: unknown;
  try {
    rawRegions = JSON.parse(propertyMatch[3]);
  } catch {
    return content;
  }
  if (!Array.isArray(rawRegions)) return content;

  const index = rawRegions.findIndex((candidate) => {
    const normalized = normalizeImageOcclusionRegion(candidate);
    return normalized !== null && occlusionRegionsMatch(normalized, region);
  });
  if (index < 0) return content;

  rawRegions.splice(index, 1);
  const newline = propertyMatch[1] || "";
  const indentation = propertyMatch[2] || "";
  const replacement = rawRegions.length > 0
    ? `${newline}${indentation}image-occlusions:: ${JSON.stringify(rawRegions)}`
    : "";
  const start = propertyMatch.index;
  const next = content.slice(0, start) + replacement + content.slice(start + propertyMatch[0].length);
  return rawRegions.length > 0 ? next : next.replace(/\n{3,}/g, "\n\n").trim();
}

/** Selecciona todos los bullets visibles de una página. */
function selectAllBullets(page: PageData = currentPage): void {
  const visible = getFlatVisibleBlocks(page.blocks);
  if (visible.length === 0) return;
  selectedBulletIds = visible.map((block) => block.id);
  bulletSelectionAnchorId = visible[0].id;
  refreshBulletSelection();
}

/** Elimina las flashcards de los bullets seleccionados sin borrar su contenido. */
function deleteFlashcardsInSelection(page: PageData = getSelectionPage()): boolean {
  const ids = new Set(selectedBulletIds);
  if (ids.size === 0) return false;
  let changed = false;
  getAllBlocksFlat(page.blocks).forEach((block) => {
    if (!ids.has(block.id) || !isFlashcardBlockContent(block.content)) return;
    const next = removeFlashcardMarkers(block.content);
    if (next === block.content) return;
    block.content = next;
    changed = true;
  });
  if (!changed) {
    showToast("La selección no contiene flashcards que eliminar.");
    return false;
  }
  void vault.savePage(page);
  renderBlocksTree();
  refreshBulletSelection();
  showToast("Flashcards eliminadas; el contenido se conservó.");
  return true;
}

/** Convierte en tarjeta básica (#card) los bullets seleccionados. */
function createBasicCardFromSelection(page: PageData = getSelectionPage()): boolean {
  const ids = selectedBulletIds.length > 0
    ? new Set(selectedBulletIds)
    : cursorState
      ? new Set([cursorState.blockId])
      : new Set<string>();
  if (ids.size === 0) return false;
  let changed = false;
  getAllBlocksFlat(page.blocks).forEach((block) => {
    if (!ids.has(block.id) || block.type === "image") return;
    const visible = getVisibleBlockContent(block.content);
    if (!visible.trim() || isFlashcardBlockContent(block.content)) return;
    setVisibleBlockContent(block, `${visible.trim()} #card`);
    ensureBlockCreatedAt(block);
    changed = true;
  });
  if (!changed) {
    showToast("No hay bullets de texto para convertir en tarjeta.");
    return false;
  }
  void vault.savePage(page);
  renderBlocksTree();
  showToast("Tarjeta básica creada.");
  return true;
}

function renderBlockNode(node: BlockNode, parent: HTMLElement, page: PageData = currentPage) {
  const item = document.createElement("div");
  item.className = `block-item${selectedBulletIds.includes(node.id) ? " is-selected" : ""}`;
  item.dataset.id = node.id;
  item.dataset.pageId = page.id;

  const hasChildren = node.children && node.children.length > 0;

  const row = document.createElement("div");
  row.className = `block-row${selectedBulletIds.includes(node.id) ? " is-selected" : ""}`;

  // Handle (Chevron + Bullet)
  const handle = document.createElement("div");
  handle.className = "block-bullet-handle";

  const { text: contentWithoutProperties, properties } = splitBlockProperties(node.content);
  if (properties.length > 0) {
    const propertyDetails = document.createElement("details");
    propertyDetails.className = "block-properties";
    const summary = document.createElement("summary");
    summary.title = "Mostrar propiedades del bullet";
    summary.setAttribute("aria-label", "Mostrar propiedades del bullet");
    const propertyList = document.createElement("div");
    propertyList.className = "block-properties-list";
    properties.forEach((property) => {
      const propertyItem = document.createElement("div");
      propertyItem.innerText = property;
      propertyList.appendChild(propertyItem);
    });
    propertyDetails.append(summary, propertyList);
    handle.appendChild(propertyDetails);
  }

  const toggle = document.createElement("span");
  toggle.className = `collapse-toggle ${hasChildren ? "" : "is-hidden"} ${node.collapsed ? "is-collapsed" : ""
    }`;
  toggle.innerHTML = "▼";
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    page.blocks = toggleCollapse(page.blocks, node.id);
    vault.savePage(page);
    renderBlocksTree();
  });
  handle.appendChild(toggle);

  const bullet = document.createElement("div");
  bullet.className = `bullet-dot ${hasChildren && node.collapsed ? "has-collapsed-children" : ""}`;
  bullet.draggable = true;
  bullet.title = "Arrastra para mover; suelta sobre otro bullet para anidar";
  bullet.addEventListener("click", (event: MouseEvent) => {
    if (event.shiftKey) {
      selectBulletRange(bulletSelectionAnchorId || node.id, node.id, false, page);
    } else {
      clearBulletSelection();
      bulletSelectionAnchorId = node.id;
    }
    const editor = item.querySelector<HTMLElement>(".block-editor");
    editor?.focus();
  });
  bullet.addEventListener("contextmenu", (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedBulletIds.includes(node.id)) {
      selectBulletRange(node.id, node.id, false, page);
    }
    contextTargetBlockId = node.id;
    contextTargetPage = page;
    contextImageSource = null;
    contextSelectionRange = { start: 0, end: 0 };
    showBulletContextMenu(event.clientX, event.clientY);
  });
  bullet.addEventListener("dragstart", (event: DragEvent) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-sinnotas-block", node.id);
    event.dataTransfer.setData("text/plain", node.id);
    item.classList.add("is-dragging");
  });
  bullet.addEventListener("dragend", () => {
    const root = item.closest<HTMLElement>(".blocks-tree") ?? blocksContainer;
    root.querySelectorAll(".block-item.is-dragging, .block-row.drop-target-before, .block-row.drop-target-after, .block-row.drop-target-inside")
      .forEach((element) => element.classList.remove(
        "is-dragging",
        "drop-target-before",
        "drop-target-after",
        "drop-target-inside"
      ));
  });
  item.addEventListener("dragover", (event: DragEvent) => {
    if (!event.dataTransfer?.types.includes("application/x-sinnotas-block")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rowElement = item.querySelector<HTMLElement>(":scope > .block-row");
    if (!rowElement) return;
    rowElement.classList.remove("drop-target-before", "drop-target-after", "drop-target-inside");
    const targetIsBullet = event.target instanceof Element && !!event.target.closest(".bullet-dot");
    const bounds = rowElement.getBoundingClientRect();
    const relativeY = (event.clientY - bounds.top) / Math.max(bounds.height, 1);
    const position = targetIsBullet || (relativeY >= 0.3 && relativeY <= 0.7)
      ? "inside"
      : relativeY < 0.3 ? "before" : "after";
    rowElement.classList.add(`drop-target-${position}`);
  });
  item.addEventListener("dragleave", (event: DragEvent) => {
    if (event.relatedTarget instanceof Node && item.contains(event.relatedTarget)) return;
    item.querySelector<HTMLElement>(":scope > .block-row")?.classList.remove(
      "drop-target-before",
      "drop-target-after",
      "drop-target-inside"
    );
  });
  item.addEventListener("drop", (event: DragEvent) => {
    const sourceId = event.dataTransfer?.getData("application/x-sinnotas-block");
    if (!sourceId) return;
    event.preventDefault();
    event.stopPropagation();
    const rowElement = item.querySelector<HTMLElement>(":scope > .block-row");
    if (!rowElement) return;
    const classes = rowElement.classList;
    const position = classes.contains("drop-target-inside")
      ? "inside"
      : classes.contains("drop-target-before") ? "before" : "after";
    const newTree = moveBlockTo(page.blocks, sourceId, node.id, position);
    if (!newTree) return;
    const previousTree = page.blocks;
    page.blocks = newTree;
    cursorState = { blockId: sourceId, offset: 0 };
    void (async () => {
      try {
        await vault.savePage(page);
        renderBlocksTree();
      } catch (error) {
        console.error("No se pudo guardar el nuevo orden de los bullets:", error);
        page.blocks = previousTree;
        cursorState = null;
        renderBlocksTree();
        showToast("No se pudo guardar el nuevo orden de los bullets.");
      }
    })();
  });
  handle.appendChild(bullet);
  row.appendChild(handle);

  if (node.type === "image") {
    const source = splitBlockProperties(node.content).text.trim().split(/\r?\n/, 1)[0];
    const image = ImageBlock(source, node.imageAlt || "Imagen", node.id);
    image.classList.add("block-image-node");
    image.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      contextTargetBlockId = node.id;
      contextTargetPage = page;
      contextImageSource = source;
      contextSelectionRange = { start: 0, end: 0 };
      showBlockContextMenu(event.clientX, event.clientY);
    });
    row.appendChild(image);
  } else {
    const editorWrap = document.createElement("div");
    editorWrap.className = "block-editor-wrap";

    const isTodo = /^(TODO|LATER)\s+/i.test(node.content);
    const isDoing = /^(DOING|NOW)\s+/i.test(node.content);
    const isDone = /^DONE\s+/i.test(node.content);

    if (isTodo || isDoing || isDone) {
      const taskPill = document.createElement("span");
      taskPill.className = `task-pill ${isTodo ? "todo" : isDoing ? "doing" : "done"}`;
      taskPill.innerText = isTodo ? "TODO" : isDoing ? "DOING" : "DONE";
      taskPill.addEventListener("click", () => {
        node.content = applyTaskCompletionReward(node.content, toggleTaskStatus(node.content));
        void vault.savePage(page);
        renderBlocksTree();
      });
      editorWrap.appendChild(taskPill);
    }

    const editor = document.createElement("div");
    editor.className = `block-editor ${isDone ? "block-content-done" : ""}`;
    editor.contentEditable = "true";
    editor.spellcheck = false;
    editor.dataset.id = node.id;
    editor.dataset.placeholder = "Escribe algo...";
    const headingLevel = properties.find((property) => /^heading::\s*h?[1-6]\b/i.test(property))
      ?.match(/^heading::\s*h?([1-6])\b/i)?.[1];
    if (headingLevel) {
      editor.dataset.heading = headingLevel;
    }
    const textColor = properties.find((property) => /^color::\s*#[\da-f]{6}\b/i.test(property))
      ?.match(/^color::\s*(#[\da-f]{6})\b/i)?.[1];
    const backgroundColor = properties.find((property) => /^background-color::\s*#[\da-f]{6}\b/i.test(property))
      ?.match(/^background-color::\s*(#[\da-f]{6})\b/i)?.[1];
    if (textColor) editor.style.color = textColor;
    if (backgroundColor) {
      editor.style.backgroundColor = `${backgroundColor}22`;
      editor.style.borderRadius = "6px";
      editor.style.paddingInline = "4px";
    }

    const rawContent = splitTaskPrefix(contentWithoutProperties).text;
    renderMarkdownText(editor, rawContent);

    editor.addEventListener("input", () => {
      const loc = findNodeLocation(page.blocks, node.id);
      if (!loc) return;
      const currentNode = loc.parentList[loc.index];
      const content = serializeEditorContent(editor);
      const standaloneImage = getStandaloneMarkdownImage(content);
      if (standaloneImage) {
        const previousContent = currentNode.content;
        const previousType = currentNode.type;
        const previousAlt = currentNode.imageAlt;
        currentNode.type = "image";
        currentNode.imageAlt = standaloneImage.alt;
        setVisibleBlockContent(currentNode, standaloneImage.source);
        cursorState = null;
        void vault.savePage(page).then(() => renderBlocksTree()).catch((error: unknown) => {
          console.error("No se pudo convertir el bullet en imagen:", error);
          currentNode.content = previousContent;
          currentNode.type = previousType;
          if (previousAlt === undefined) delete currentNode.imageAlt;
          else currentNode.imageAlt = previousAlt;
          cursorState = { blockId: node.id, offset: content.length };
          void vault.savePage(page).catch((rollbackError: unknown) => {
            console.error("No se pudo restaurar el bullet de texto:", rollbackError);
          });
          renderBlocksTree();
          showToast("No se pudo guardar el bloque de imagen.");
        });
        return;
      }

      currentNode.type = "text";
      delete currentNode.imageAlt;
      const caretOffset = getCaretOffset(editor);
      const wasFlashcard = isFlashcardBlockContent(currentNode.content);
      setVisibleBlockContent(currentNode, content);
      if (!wasFlashcard && isFlashcardBlockContent(currentNode.content)) {
        ensureBlockCreatedAt(currentNode);
      }
      if (
        content !== getVisibleBlockContent(currentNode.content) ||
        !wikilinksMatchEditor(editor, content)
      ) {
        renderMarkdownText(editor, getVisibleBlockContent(currentNode.content));
        setCaretOffset(editor, caretOffset);
      }
      vault.scheduleSavePage(page);
      updateWikilinkAutocomplete(editor, node.id);
      updateSlashMenu(editor, node.id);
    });

    editor.addEventListener("focus", () => {
      const content = serializeEditorContent(editor);
      const offset = getRenderedCaretOffset(editor);
      renderMarkdownText(editor, content);
      setCaretOffset(editor, offset);
      updateSlashMenu(editor, node.id);
    });
    editor.addEventListener("blur", () => {
      void vault.flushPendingSaves();
      const content = serializeEditorContent(editor);
      renderMarkdownText(editor, content);
      if (wikilinkAutocompleteState?.editor === editor) hideWikilinkAutocomplete();
      if (slashMenuState?.editor === editor) hideSlashMenu();
    });

    editor.addEventListener("mouseup", (event: MouseEvent) => {
      const selection = readEditorSelection(editor, node.id);
      if (!selection && event.button === 0 && lastEditorSelection?.blockId === node.id) {
        lastEditorSelection = null;
      }
    });
    editor.addEventListener("keyup", (event) => {
      const selection = readEditorSelection(editor, node.id);
      if (!selection && lastEditorSelection?.blockId === node.id) lastEditorSelection = null;
      if (event.key === "Escape") return;
      if (
        (event.key === "ArrowDown" || event.key === "ArrowUp") &&
        wikilinkAutocompleteState &&
        wikilinkAutocompleteMenu &&
        !wikilinkAutocompleteMenu.hidden
      ) {
        return;
      }
      updateWikilinkAutocomplete(editor, node.id);
    });

    editor.addEventListener("click", (event) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>(".wikilink-anchor[data-wikilink-title]")
        : null;
      const title = target?.dataset.wikilinkTitle;
      if (title) {
        event.preventDefault();
        event.stopPropagation();
        hideWikilinkAutocomplete();
        loadPage(title);
        return;
      }
      if (event.shiftKey) {
        selectBulletRange(bulletSelectionAnchorId || node.id, node.id, false, page);
      } else {
        clearBulletSelection();
        bulletSelectionAnchorId = node.id;
      }
    });

    editor.addEventListener("contextmenu", (event) => {
      const target = event.target instanceof HTMLElement
        ? event.target.closest<HTMLTableCellElement>(".table-cell")
        : null;
      if (target) {
        event.preventDefault();
        event.stopPropagation();
        const table = target.closest<HTMLTableElement>(".markdown-block-table");
        if (table) {
          contextTargetPage = page;
          showTableContextMenu(table, target, event.clientX, event.clientY);
        }
      }
    });

    editor.addEventListener("mousedown", (event) => {
      const rowHandle = event.target instanceof HTMLElement
        ? event.target.closest<HTMLTableRowElement>(".table-row")
        : null;
      if (rowHandle && event.offsetX < 12) {
        const row = rowHandle;
        draggedRow = row;
        row.style.opacity = "0.5";
        event.preventDefault();
      }
      
      const colHandle = event.target instanceof HTMLElement
        ? event.target.closest<HTMLTableCellElement>(".table-cell")
        : null;
      if (colHandle && event.offsetY < 12) {
        draggedColIndex = parseInt(colHandle.dataset.colIndex || "0");
        event.preventDefault();
      }
    });

    editor.addEventListener("mouseup", (event) => {
      if (draggedRow) {
        const targetRow = event.target instanceof HTMLElement
          ? event.target.closest<HTMLElement>(".table-row")
          : null;
        if (targetRow && targetRow !== draggedRow) {
          const table = draggedRow.closest<HTMLTableElement>(".markdown-block-table");
          if (table) {
            const fromIndex = parseInt(draggedRow.dataset.rowIndex || "0");
            const toIndex = parseInt(targetRow.dataset.rowIndex || "0");
            moveTableRow(table, fromIndex, toIndex);
            saveTableChanges(editor);
          }
        }
        draggedRow.style.opacity = "1";
        draggedRow = null;
      }
      
      if (draggedColIndex !== null) {
        const targetCell = event.target instanceof HTMLElement
          ? event.target.closest<HTMLTableCellElement>(".table-cell")
          : null;
        if (targetCell) {
          const table = targetCell.closest<HTMLTableElement>(".markdown-block-table");
          if (table) {
            const toIndex = parseInt(targetCell.dataset.colIndex || "0");
            if (toIndex !== draggedColIndex) {
              moveTableColumn(table, draggedColIndex, toIndex);
              saveTableChanges(editor);
            }
          }
        }
        draggedColIndex = null;
      }
    });

    editor.addEventListener("keydown", (event: KeyboardEvent) => {
      handleEditorKeyDown(event, node.id, page, editor);
    });
    editor.addEventListener("paste", (event: ClipboardEvent) => {
      const file = clipboardImageFile(event.clipboardData);
      const imageSource = file ? null : clipboardHtmlImageSource(event.clipboardData);
      if (file || imageSource) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (file) {
          if (supportedImageExtension(file)) lastClipboardImagePasteAt = Date.now();
          void insertClipboardImageFile(file, node.id, page);
          return;
        }
        if (imageSource) {
          lastClipboardImagePasteAt = Date.now();
          void insertClipboardImageSource(imageSource, node.id, page);
        }
        return;
      }

      const text = event.clipboardData?.getData("text/plain");
      if (text) {
        lastClipboardTextPasteAt = Date.now();
        return;
      }
      if (isTauri()) void pasteNativeClipboardImage(node.id, false, page);
    });
    editor.addEventListener("paste", (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text/plain");
      if (!text || (!selectedBulletIds.length && !/^\s*(?:[-*+]|\d+\.)\s+/m.test(text))) return;
      // Para listas de bullets de origen rico: el HTML se convierte con lista
      // blanca a Markdown antes de la reconstrucción jerárquica, así el
      // pegado respeta la indentación y el formato inline permitido.
      const html = event.clipboardData?.getData("text/html") || "";
      const richBulletText = html ? sanitizePastedHtmlToMarkdown(html) : "";
      // Preferir la versión whitelisted del HTML cuando conserva la lista; así
      // el pegado rico respeta la indentación y el formato inline permitido.
      const textList = richBulletText && /^\s*(?:[-*+]|\d+\.)\s+/m.test(richBulletText)
        ? richBulletText
        : /^\s*(?:[-*+]|\d+\.)\s+/m.test(text || "") ? text : "";
      if (!textList) return;
      event.preventDefault();
      // El pegado rich de bullets ya se resuelve aquí con la jerarquía; se
      // corta la burbuja para que el pegado textual seguro del document no
      // duplique el contenido.
      event.stopImmediatePropagation();
      void pasteBulletClipboard(node.id, textList, page);
    });

    editor.addEventListener("contextmenu", (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      contextTargetBlockId = node.id;
      contextTargetPage = page;
      contextImageSource = null;
      setContextSelection(editor, node.id);
      showBlockContextMenu(event.clientX, event.clientY);
    });

    editorWrap.appendChild(editor);
    row.appendChild(editorWrap);
  }
  item.appendChild(row);

  if (hasChildren) {
    const childrenContainer = document.createElement("div");
    childrenContainer.className = `block-children ${node.collapsed ? "is-hidden" : ""}`;
    for (const child of node.children) {
      renderBlockNode(child, childrenContainer, page);
    }
    item.appendChild(childrenContainer);
  }

  parent.appendChild(item);
}

function renderBlocksTree() {
  // Vaciar el árbol colapsa el contenido y reinicia el scroll del contenedor.
  // Guardamos y restauramos la posición para que acciones como crear una
  // flashcard no lleven al usuario al inicio de la página.
  const scrollRoot = blocksContainer.closest<HTMLElement>(".content-scroll");
  const previousScrollTop = scrollRoot?.scrollTop ?? 0;

  blocksContainer.innerHTML = "";
  for (const block of currentPage.blocks) {
    renderBlockNode(block, blocksContainer, currentPage);
  }
  refreshBulletSelection();

  if (cursorState) {
    const target = blocksContainer.querySelector<HTMLElement>(
      `.block-editor[data-id="${cursorState.blockId}"]`
    );
    if (target) {
      target.focus({ preventScroll: true });
      setCaretOffset(target, cursorState.offset);
    }
  }

  if (scrollRoot) scrollRoot.scrollTop = previousScrollTop;

  // Cuando la vista de Diarios está activa, los bloques visibles se muestran
  // en #journals-container (el editor principal queda oculto). Así que hay que
  // refrescar también esa vista para que los cambios estructurales (Enter,
  // indentar, borrar, colapsar...) se vean de inmediato sin recargar la app.
  if (currentView === "journals") {
    renderJournalsView();
    if (cursorState) {
      const journalEditor = viewJournals.querySelector<HTMLElement>(
        `.block-editor[data-id="${cursorState.blockId}"]`
      );
      if (journalEditor) {
        journalEditor.focus();
        setCaretOffset(journalEditor, cursorState.offset);
      }
    }
  }
}

function beginBoxSelection(event: PointerEvent, root: HTMLElement): void {
  clearBulletSelection();
  window.getSelection()?.removeAllRanges();
  boxSelectionRoot = root;
  boxSelectionScrollRoot = findScrollableAncestor(root);
  boxSelectionStart = { x: event.clientX, y: event.clientY };
  pendingBoxSelection = null;
  const overlay = getBoxSelectionOverlay();
  overlay.hidden = false;
  overlay.style.left = `${event.clientX}px`;
  overlay.style.top = `${event.clientY}px`;
  overlay.style.width = "0";
  overlay.style.height = "0";
  pointerSelectionActive = true;
  document.body.classList.add("is-bullet-selecting");
  event.preventDefault();
}

function installBlockSelectionHandler(root: HTMLElement): void {
  root.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    if (event.target === root && !event.shiftKey) {
      beginBoxSelection(event, root);
      return;
    }
    const row = event.target.closest<HTMLElement>(".block-row");
    const item = row?.closest<HTMLElement>(".block-item");
    const id = item?.dataset.id;
    if (!row || !id) return;
    if (event.target.closest(".collapse-toggle, .block-properties")) return;
    const targetIsEditorOrBullet = event.target.closest(".block-editor, .bullet-dot");
    if (targetIsEditorOrBullet && !event.shiftKey) {
      // Un arrastre vertical sobre el texto se convertirá en selección por caja
      // (con auto-scroll). Un clic o un arrastre horizontal conserva el caret y
      // la selección de texto nativa.
      if (event.target.closest(".block-editor")) {
        pendingTextDragSelection = { x: event.clientX, y: event.clientY, root };
      }
      return;
    }
    if (event.shiftKey) {
      selectBulletRange(bulletSelectionAnchorId || id, id);
    } else {
      clearBulletSelection();
      bulletSelectionAnchorId = id;
      selectedBulletIds = [id];
      refreshBulletSelection();
    }
    if (!event.target.closest(".block-editor")) {
      item.querySelector<HTMLElement>(":scope > .block-row .block-editor")?.focus();
    }
    pointerSelectionActive = true;
    // Un arrastre que empieza en el fondo de una fila también puede convertirse
    // en selección por caja: así no hace falta acertar en un hueco de la fila.
    if (!targetIsEditorOrBullet && !event.shiftKey) {
      pendingBoxSelection = { x: event.clientX, y: event.clientY, root };
      document.body.classList.add("is-bullet-selecting");
    }
  });
}

installBlockSelectionHandler(blocksContainer);
{
  const journalsContainer = document.getElementById("journals-container");
  if (journalsContainer) installBlockSelectionHandler(journalsContainer);
}

// Zona vacía alrededor de los bullets (debajo del último, márgenes del lienzo).
// Al arrastrar desde aquí se dibuja la caja de selección aunque el puntero no
// empiece exactamente sobre el contenedor de bloques.
[document.querySelector<HTMLElement>("#view-editor .content-scroll"),
  document.querySelector<HTMLElement>("#view-journals .content-scroll")].forEach((scrollRoot) => {
  if (!scrollRoot) return;
  scrollRoot.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    const view = scrollRoot.closest<HTMLElement>(".view-panel");
    if (!view || !view.classList.contains("active-view")) return;
    if (
      event.target.closest(
        ".block-row, .block-editor, .bullet-dot, .collapse-toggle, .block-properties, " +
          ".page-title-row, .page-properties-container, .references-panel, .journal-calendar, " +
          ".journal-date-badge, button, a, input, textarea, select, [contenteditable='true']"
      )
    ) {
      return;
    }
    const root = currentView === "journals"
      ? document.getElementById("journals-container")
      : blocksContainer;
    if (root) beginBoxSelection(event, root);
  });
});

/** Actualiza la caja y la selección con la posición actual del puntero. */
function applyBoxSelection(x: number, y: number): void {
  if (!boxSelectionStart) return;
  const left = Math.min(boxSelectionStart.x, x);
  const top = Math.min(boxSelectionStart.y, y);
  const width = Math.abs(x - boxSelectionStart.x);
  const height = Math.abs(y - boxSelectionStart.y);
  const root = boxSelectionRoot ?? blocksContainer;
  const scrollRoot = boxSelectionScrollRoot ?? findScrollableAncestor(root);
  const overlay = getBoxSelectionOverlay();
  // El rectángulo de selección puede anclarse arriba del área visible al
  // hacer scroll. Para que la caja no tape el encabezado ni la barra lateral,
  // se recorta solo su representación visual; la selección real conserva el
  // rectángulo completo.
  let overlayTop = top;
  let overlayHeight = height;
  if (scrollRoot) {
    const bounds = scrollRoot.getBoundingClientRect();
    const visibleTop = Math.max(top, bounds.top);
    const visibleBottom = Math.min(top + height, bounds.bottom);
    overlayTop = visibleTop;
    overlayHeight = Math.max(0, visibleBottom - visibleTop);
  }
  overlay.style.left = `${left}px`;
  overlay.style.top = `${overlayTop}px`;
  overlay.style.width = `${width}px`;
  overlay.style.height = `${overlayHeight}px`;

  const selectionRect = new DOMRect(left, top, width, height);
  const selected: string[] = [];
  root.querySelectorAll<HTMLElement>(".block-item[data-id]").forEach((item) => {
    if (!item.offsetParent) return;
    const row = item.querySelector<HTMLElement>(":scope > .block-row");
    const id = item.dataset.id;
    if (!row || !id) return;
    const rect = row.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    if (
      rect.right >= selectionRect.left &&
      rect.left <= selectionRect.right &&
      rect.bottom >= selectionRect.top &&
      rect.top <= selectionRect.bottom
    ) selected.push(id);
  });
  selectedBulletIds = selected;
  refreshBulletSelection();
}

/**
 * Busca el contenedor que realmente desplaza el contenido. No siempre es
 * `.content-scroll`: en algunas vistas el scroll lo hace el panel o una capa
 * intermedia, y el auto-scroll debe funcionar igualmente.
 */
function findScrollableAncestor(root: HTMLElement | null): HTMLElement | null {
  let current: HTMLElement | null = root;
  while (current) {
    const style = getComputedStyle(current);
    if (
      /(auto|scroll)/.test(style.overflowY) &&
      current.scrollHeight > current.clientHeight + 1
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Desplaza el lienzo cuando el puntero se acerca al borde durante una
 * selección por caja, para poder abarcar bullets fuera de la vista.
 */
function scheduleBoxAutoScroll(): void {
  if (boxSelectionScrollFrame !== null) return;
  const step = () => {
    boxSelectionScrollFrame = null;
    if (!pointerSelectionActive || !boxSelectionStart || !boxSelectionPointer) return;
    const root = boxSelectionRoot ?? blocksContainer;
    const scrollRoot = boxSelectionScrollRoot ?? findScrollableAncestor(root);
    if (!scrollRoot) return;
    const rect = scrollRoot.getBoundingClientRect();
    const edge = 48;
    let delta = 0;
    if (boxSelectionPointer.y > rect.bottom - edge) {
      delta = Math.min(28, Math.ceil((boxSelectionPointer.y - (rect.bottom - edge)) / 2) + 4);
    } else if (boxSelectionPointer.y < rect.top + edge) {
      delta = -Math.min(28, Math.ceil(((rect.top + edge) - boxSelectionPointer.y) / 2) + 4);
    }
    if (delta === 0) return;
    const previous = scrollRoot.scrollTop;
    scrollRoot.scrollTop = previous + delta;
    const scrolled = scrollRoot.scrollTop - previous;
    if (scrolled === 0) return;
    // El ancla de la selección vive en el contenido, no en la pantalla: al
    // desplazar el lienzo, la caja sigue cubriendo los bullets que ya han
    // pasado por el puntero en lugar de quedarse solo con los visibles.
    boxSelectionStart.y -= scrolled;
    applyBoxSelection(boxSelectionPointer.x, boxSelectionPointer.y);
    boxSelectionScrollFrame = requestAnimationFrame(step);
  };
  boxSelectionScrollFrame = requestAnimationFrame(step);
}

window.addEventListener("pointermove", (event: PointerEvent) => {
  if (pendingTextDragSelection) {
    const dx = event.clientX - pendingTextDragSelection.x;
    const dy = event.clientY - pendingTextDragSelection.y;
    if (Math.hypot(dx, dy) < 8) return;
    // Solo los arrastres claramente verticales seleccionan bullets. Los
    // horizontales siguen sirviendo para seleccionar texto dentro del bullet.
    if (Math.abs(dy) < Math.abs(dx) * 1.15) {
      pendingTextDragSelection = null;
      return;
    }
    const pending = pendingTextDragSelection;
    pendingTextDragSelection = null;
    clearBulletSelection();
    window.getSelection()?.removeAllRanges();
    boxSelectionRoot = pending.root;
    boxSelectionScrollRoot = findScrollableAncestor(pending.root);
    boxSelectionStart = { x: pending.x, y: pending.y };
    boxSelectionPointer = { x: event.clientX, y: event.clientY };
    pendingBoxSelection = null;
    pointerSelectionActive = true;
    document.body.classList.add("is-bullet-selecting");
    getBoxSelectionOverlay().hidden = false;
    applyBoxSelection(event.clientX, event.clientY);
    scheduleBoxAutoScroll();
    return;
  }

  if (!pointerSelectionActive) return;
  if (pendingBoxSelection) {
    const dx = event.clientX - pendingBoxSelection.x;
    const dy = event.clientY - pendingBoxSelection.y;
    if (Math.hypot(dx, dy) < 5) return;
    const pending = pendingBoxSelection;
    pendingBoxSelection = null;
    boxSelectionRoot = pending.root;
    boxSelectionScrollRoot = findScrollableAncestor(pending.root);
    boxSelectionStart = { x: pending.x, y: pending.y };
    window.getSelection()?.removeAllRanges();
    document.body.classList.add("is-bullet-selecting");
    getBoxSelectionOverlay().hidden = false;
  }
  if (boxSelectionStart) {
    boxSelectionPointer = { x: event.clientX, y: event.clientY };
    applyBoxSelection(event.clientX, event.clientY);
    scheduleBoxAutoScroll();
    return;
  }
  const item = document.elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>(".block-item[data-id]");
  const id = item?.dataset.id;
  if (id && bulletSelectionAnchorId) {
    selectBulletRange(bulletSelectionAnchorId, id);
  }
});

function finishPointerSelection(): void {
  pointerSelectionActive = false;
  pendingBoxSelection = null;
  pendingTextDragSelection = null;
  boxSelectionStart = null;
  boxSelectionRoot = null;
  boxSelectionScrollRoot = null;
  boxSelectionPointer = null;
  if (boxSelectionScrollFrame !== null) {
    cancelAnimationFrame(boxSelectionScrollFrame);
    boxSelectionScrollFrame = null;
  }
  document.body.classList.remove("is-bullet-selecting");
  if (boxSelectionOverlay) boxSelectionOverlay.hidden = true;
}

window.addEventListener("pointerup", finishPointerSelection);
window.addEventListener("pointercancel", finishPointerSelection);

// Mientras se seleccionan bullets, no permitir que el navegador reinicie una
// selección de texto nativa (por ejemplo, al arrastrar desde el texto).
document.addEventListener("selectstart", (event) => {
  if (pointerSelectionActive || boxSelectionStart) event.preventDefault();
});

document.addEventListener("keydown", (event: KeyboardEvent) => {
  if (selectedBulletIds.length === 0) return;
  const target = event.target;
  if (target instanceof HTMLElement && (
    target.matches("input, textarea, select") ||
    (target.isContentEditable && target.matches(".block-editor"))
  )) return;

  const hasTextSelection = Boolean(window.getSelection() && !window.getSelection()?.isCollapsed);

  // Atajos de tarjetas y selección masiva cuando el foco no está en un editor
  // de bloque (por ejemplo, tras una selección por caja).
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey) {
    const key = event.key.toLowerCase();
    if (key === "a") {
      event.preventDefault();
      selectAllBullets();
      return;
    }
    if (key === "c") {
      event.preventDefault();
      createBasicCardFromSelection();
      return;
    }
    if (key === "d") {
      event.preventDefault();
      deleteFlashcardsInSelection();
      return;
    }
  }

  // Selección múltiple: indentar/desindentar/borrar con foco fuera del editor.
  // El arrastre de ratón puede dejar una selección de texto nativa residual,
  // así que estas operaciones no dependen de hasTextSelection.
  if (selectedBulletIds.length > 1) {
    const isTab = event.key === "Tab" || event.code === "Tab";
    if (isTab && !event.shiftKey) {
      event.preventDefault();
      indentSelectedBullets();
      return;
    }
    if (isTab && event.shiftKey) {
      event.preventDefault();
      outdentSelectedBullets();
      return;
    }
    if (event.key === "ArrowRight" && event.altKey) {
      event.preventDefault();
      indentSelectedBullets();
      return;
    }
    if (event.key === "ArrowLeft" && event.altKey) {
      event.preventDefault();
      outdentSelectedBullets();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      void deleteSelectedBullets();
      return;
    }
  }

  if (!hasTextSelection && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
    event.preventDefault();
    void copySelectedBullets();
  } else if (!hasTextSelection && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x") {
    event.preventDefault();
    void cutSelectedBullets();
  } else if (!hasTextSelection && (event.key === "Delete" || event.key === "Backspace")) {
    event.preventDefault();
    void deleteSelectedBullets();
  }
});

/* ==================== UNDO / REDO (Ctrl+Z / Ctrl+Y) ==================== */
/**
 * Aplica un snapshot al documento actual y vuelve a renderizar el árbol.
 * Se marca como "restaurando" para que el hook onBeforeSave no vuelva a
 * empujar el snapshot en la pila de deshacer.
 */
function applyHistoryEntry(entry: { blocks: BlockNode[]; title: string }): void {
  documentHistory.beginRestore();
  try {
    currentPage.blocks = cloneTree(entry.blocks);
    // El título solo cambia vía renombrado explícito; no se revierte aquí.
    cursorState = currentPage.blocks[0]
      ? { blockId: currentPage.blocks[0].id, offset: 0 }
      : null;
    clearBulletSelection();
    renderBlocksTree();
    void vault.savePage(currentPage);
    documentHistory.markApplied(currentPage.id, currentPage.blocks, currentPage.title);
  } finally {
    documentHistory.endRestore();
  }
}

function performUndo(): void {
  if (currentView === "flashcards") {
    void undoLastReview();
    return;
  }
  const entry = documentHistory.undo(currentPage.id, currentPage.blocks, currentPage.title);
  if (!entry) {
    showToast(translate("No hay cambios que deshacer."));
    return;
  }
  applyHistoryEntry(entry);
  showToast(translate("Cambio deshecho."));
}

function performRedo(): void {
  if (currentView === "flashcards") {
    void redoLastReview();
    return;
  }
  const entry = documentHistory.redo(currentPage.id, currentPage.blocks, currentPage.title);
  if (!entry) {
    showToast(translate("No hay cambios que rehacer."));
    return;
  }
  applyHistoryEntry(entry);
  showToast(translate("Cambio rehecho."));
}

document.addEventListener("keydown", (event: KeyboardEvent) => {
  const mod = event.ctrlKey || event.metaKey;
  if (!mod) return;

  const key = event.key.toLowerCase();
  const isUndo = key === "z" && !event.shiftKey;
  // Ctrl+Y es el atajo clásico de rehacer; Ctrl+Shift+Z es la alternativa estándar.
  const isRedo = key === "y" || (key === "z" && event.shiftKey);
  if (!isUndo && !isRedo) return;

  const target = event.target;
  // En campos nativos (input, textarea, select) se deja el deshacer del navegador.
  if (target instanceof HTMLElement && target.matches("input, textarea, select")) return;
  // En otros contenteditable (p. ej. el título de la página) también es nativo.
  if (target instanceof HTMLElement && target.isContentEditable && !target.matches(".block-editor")) return;

  event.preventDefault();
  if (isUndo) performUndo();
  else performRedo();
});

/** Intención pendiente de "Pegar sin formato" (Ctrl+Shift+V). */
let pendingPlainPaste = false;

function consumePendingPlainPaste(): boolean {
  const pending = pendingPlainPaste;
  pendingPlainPaste = false;
  return pending;
}

// El paste no lleva modificadores: Ctrl+Shift+V se marca aquí un instante
// antes de que llegue el evento paste (keydown en profundidad documental).
document.addEventListener(
  "keydown",
  (event: KeyboardEvent) => {
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.shiftKey && event.key.toLowerCase() === "v") {
      pendingPlainPaste = true;
      return;
    }
    // Otras teclas descartan la intención pendiente; mantener Shift no.
    if (event.key !== "Shift") pendingPlainPaste = false;
  },
  true
);

// La intención se consume al soltar la tecla para que no se pegue en agua
// con otro pegado posterior (p. ej. el flujo de bullets o el menú).
document.addEventListener(
  "keyup",
  (event: KeyboardEvent) => {
    if (event.key.toLowerCase() === "v" || !event.shiftKey) pendingPlainPaste = false;
  },
  true
);

document.addEventListener("paste", (event: ClipboardEvent) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.isContentEditable || !target.matches(".block-editor")) return;
  // Otras rutas (imágenes, listas de bullets) ya se encargaron o se encargan:
  // si la acción ya quedó interceptada, no hay nada que hacer aquí.
  if (event.defaultPrevented) return;
  // Los eventos paste no exponen modificadores de forma fiable: Ctrl+Shift+V
  // ("Pegar sin formato") se detectó en el keydown previo y quedó marcado.
  const plainOnly = consumePendingPlainPaste();
  const file = clipboardImageFile(event.clipboardData);
  const imageSource = file ? null : clipboardHtmlImageSource(event.clipboardData);
  if (!file && !imageSource) {
    const text = event.clipboardData?.getData("text/plain");
    if (text) {
      lastClipboardTextPasteAt = Date.now();
      // Pegado seguro: el portapapeles es dato no confiable y el pegado
      // nativo de contenteditable inserta HTML del origen (spans con color
      // y tamaño, líneas vacías de más, fuentes…). Lo reemplazamos por texto
      // plano: el HTML del portapapeles se convierte a Markdown con lista
      // blanca (negrita, cursiva, subrayado, tachado, código, listas con
      // indentación). "Pegar sin formato" (Ctrl+Shift+V) usa solo text/plain.
      event.preventDefault();
      const html = plainOnly ? "" : event.clipboardData?.getData("text/html") || "";
      const sanitized = plainOnly ? "" : sanitizePastedHtmlToMarkdown(html);
      pasteTextInputIntoEditor(target, sanitized || text);
      return;
    }
    let blockId = cursorState?.blockId && findNodeLocation(currentPage.blocks, cursorState.blockId)
      ? cursorState.blockId
      : "";
    if (!blockId) blockId = getAllBlocksFlat(currentPage.blocks)[0]?.id || "";
    if (blockId && isTauri()) void pasteNativeClipboardImage(blockId);
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  let blockId = cursorState?.blockId && findNodeLocation(currentPage.blocks, cursorState.blockId)
    ? cursorState.blockId
    : "";
  if (!blockId) {
    const flatBlocks = getAllBlocksFlat(currentPage.blocks);
    blockId = flatBlocks[0]?.id || "";
  }
  if (!blockId) return;
  if (file) {
    if (supportedImageExtension(file)) lastClipboardImagePasteAt = Date.now();
    void insertClipboardImageFile(file, blockId);
  } else if (imageSource) {
    lastClipboardImagePasteAt = Date.now();
    void insertClipboardImageSource(imageSource, blockId);
  }
});

document.addEventListener("keydown", (event: KeyboardEvent) => {
  if (!isTauri() || event.altKey || !(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() !== "v") return;
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.isContentEditable) return;

  window.setTimeout(() => {
    let blockId = target.closest<HTMLElement>(".block-item[data-id]")?.dataset.id || "";
    if (!blockId && cursorState?.blockId && findNodeLocation(currentPage.blocks, cursorState.blockId)) {
      blockId = cursorState.blockId;
    }
    if (!blockId) blockId = getAllBlocksFlat(currentPage.blocks)[0]?.id || "";
    if (blockId) void pasteNativeClipboardImage(blockId);
  }, 60);
}, true);

document.addEventListener("paste", (event: ClipboardEvent) => {
  if (!selectedBulletIds.length) return;
  const target = event.target;
  if (target instanceof HTMLElement && (
    target.matches("input, textarea, select") ||
    (target.isContentEditable && target.matches(".block-editor"))
  )) return;
  const text = event.clipboardData?.getData("text/plain");
  const anchorId = selectedBulletIds[0];
  if (!text || !anchorId) return;
  event.preventDefault();
  void pasteBulletClipboard(anchorId, text);
});

document.getElementById("ctx-insert-image")?.addEventListener("click", () => {
  const blockId = contextTargetBlockId;
  if (!blockId) return;
  imageInsertTargetBlockId = blockId;
  imageInsertOpensOcclusion = false;
  hideAllContextMenus();
  imageFileInput.click();
});

imageFileInput.addEventListener("change", () => {
  const file = imageFileInput.files?.[0];
  const blockId = imageInsertTargetBlockId;
  const openOcclusion = imageInsertOpensOcclusion;
  imageFileInput.value = "";
  imageInsertTargetBlockId = null;
  imageInsertOpensOcclusion = false;
  if (file && blockId) void insertImageFile(file, blockId, openOcclusion);
});

const slashCommands = [
  { id: "table", label: "Insertar tabla", keywords: "tabla table" },
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `heading-${index + 1}`,
    label: `Encabezado H${index + 1}`,
    keywords: `heading titulo h${index + 1}`,
  })),
  { id: "image", label: "Insertar imagen / adjunto", keywords: "imagen image archivo adjunto" },
  { id: "task", label: "Alternar tarea (TODO / DOING / DONE)", keywords: "tarea task todo" },
  { id: "cloze", label: "Crear hueco Cloze", keywords: "flashcard cloze hueco" },
  { id: "flashcard", label: "Crear Flashcard (#card)", keywords: "flashcard tarjeta card" },
  { id: "clear-properties", label: "Borrar propiedades del bullet", keywords: "propiedades properties clear borrar" },
  { id: "query", label: "Insertar query / consulta", keywords: "query consulta buscar búsqueda search tag etiqueta" },
  { id: "occlusion", label: "Insertar imagen y crear oclusión", keywords: "imagen oclusion occlusion" },
  ...[
    ["dc2626", "rojo"],
    ["2563eb", "azul"],
    ["16a34a", "verde"],
    ["ca8a04", "amarillo"],
    ["9333ea", "morado"],
  ].flatMap(([color, name]) => [
    { id: `color-text-${color}`, label: `Texto ${name}`, keywords: `color texto ${name}` },
    { id: `color-background-${color}`, label: `Fondo ${name}`, keywords: `color fondo ${name}` },
  ]),
];

function getSlashMenu(): HTMLDivElement {
  if (slashMenu) return slashMenu;
  slashMenu = document.createElement("div");
  slashMenu.className = "slash-command-menu";
  slashMenu.hidden = true;
  slashMenu.setAttribute("role", "listbox");
  slashMenu.setAttribute("aria-label", "Comandos");
  document.body.appendChild(slashMenu);
  return slashMenu;
}

function hideSlashMenu(): void {
  if (slashMenu) slashMenu.hidden = true;
  slashMenuState = null;
}

function updateSlashMenu(editor: HTMLElement, blockId: string): void {
  if (document.activeElement !== editor) {
    if (slashMenuState?.editor === editor) hideSlashMenu();
    return;
  }
  const text = serializeEditorContent(editor);
  const caret = getCaretOffset(editor);
  const beforeCaret = text.slice(0, caret);
  const match = beforeCaret.match(/(?:^|\s)\/([^\s/]*)$/);
  if (!match) {
    if (slashMenuState?.editor === editor) hideSlashMenu();
    return;
  }
  const slashOffset = caret - match[0].length + match[0].lastIndexOf("/");
  slashMenuState = {
    editor,
    blockId,
    start: slashOffset,
    end: caret,
    query: match[1].toLowerCase(),
    selectedIndex: 0,
  };

  const menu = getSlashMenu();
  const results = slashCommands.filter((command) =>
    `${command.label} ${command.keywords}`.toLowerCase().includes(slashMenuState?.query || "")
  );
  menu.replaceChildren();
  if (results.length === 0) {
    const empty = document.createElement("div");
    empty.className = "slash-command-empty";
    empty.textContent = "No se encontraron comandos";
    menu.appendChild(empty);
  } else {
    results.forEach((command, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `slash-command-option${index === 0 ? " selected" : ""}`;
      button.textContent = command.label;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(index === 0));
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        if (!slashMenuState) return;
        void executeSlashCommand(command.id);
      });
      menu.appendChild(button);
    });
  }
  const selection = window.getSelection();
  const caretRect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
  const editorRect = editor.getBoundingClientRect();
  const left = Math.max(8, Math.min((caretRect?.left || editorRect.left), window.innerWidth - 300));
  const top = Math.min((caretRect?.bottom || editorRect.bottom) + 6, window.innerHeight - 300);
  menu.style.left = `${left}px`;
  menu.style.top = `${Math.max(8, top)}px`;
  menu.hidden = false;
}

function setBlockProperty(blockId: string, propertyName: string, value: string | null, page: PageData = findPageForBlock(blockId) || currentPage): void {
  const location = findNodeLocation(page.blocks, blockId);
  if (!location) return;
  const node = location.parentList[location.index];
  const { text, properties } = splitBlockProperties(node.content);
  const retained = properties.filter((property) => !property.toLowerCase().startsWith(`${propertyName.toLowerCase()}::`));
  if (value !== null) retained.push(`${propertyName}:: ${value}`);
  node.content = `${text}${retained.length ? `\n${retained.join("\n")}` : ""}`;
}

function applyHeading(blockId: string, level: number, page: PageData = findPageForBlock(blockId) || currentPage): void {
  const targets = selectedBulletIds.length > 1 && selectedBulletIds.includes(blockId)
    ? selectedBulletIds
    : [blockId];
  targets.forEach((targetId) => setBlockProperty(targetId, "heading", `H${level}`, page));
  const location = findNodeLocation(page.blocks, blockId);
  if (location) {
    cursorState = {
      blockId,
      offset: getVisibleBlockContent(location.parentList[location.index].content).length,
    };
  }
  void vault.savePage(page);
  hideSlashMenu();
  hideAllContextMenus();
  renderBlocksTree();
}

function applyBlockColor(blockId: string, color: string | null, mode: "text" | "background", page: PageData = findPageForBlock(blockId) || currentPage): void {
  const targets = selectedBulletIds.length > 1 && selectedBulletIds.includes(blockId)
    ? selectedBulletIds
    : [blockId];
  targets.forEach((targetId) =>
    setBlockProperty(targetId, mode === "text" ? "color" : "background-color", color, page)
  );
  const location = findNodeLocation(page.blocks, blockId);
  if (location) {
    cursorState = {
      blockId,
      offset: getVisibleBlockContent(location.parentList[location.index].content).length,
    };
  }
  void vault.savePage(page);
  hideSlashMenu();
  hideAllContextMenus();
  renderBlocksTree();
}

async function executeSlashCommand(commandId: string): Promise<void> {
  const state = slashMenuState;
  if (!state) return;
  const page = findPageForBlock(state.blockId) || currentPage;
  const location = findNodeLocation(page.blocks, state.blockId);
  if (!location) {
    hideSlashMenu();
    return;
  }
  const node = location.parentList[location.index];
  const visibleText = getVisibleBlockContent(node.content);
  const withoutCommand = visibleText.slice(0, state.start) + visibleText.slice(state.end);
  hideSlashMenu();

  if (commandId === "image" || commandId === "occlusion") {
    setVisibleBlockContent(node, withoutCommand);
    await vault.savePage(page);
    renderBlocksTree();
    imageInsertTargetBlockId = state.blockId;
    imageInsertOpensOcclusion = commandId === "occlusion";
    imageFileInput.click();
    return;
  }
  if (commandId === "table") {
    const prefix = withoutCommand.trim();
    const table = "| Columna 1 | Columna 2 |\n| --- | --- |\n| Celda | Celda |";
    setVisibleBlockContent(node, prefix ? `${prefix}\n${table}` : table);
    cursorState = { blockId: state.blockId, offset: getVisibleBlockContent(node.content).length };
    void vault.savePage(page);
    renderBlocksTree();
    return;
  }
  if (commandId.startsWith("heading-")) {
    setVisibleBlockContent(node, withoutCommand);
    applyHeading(state.blockId, Number(commandId.slice("heading-".length)));
    return;
  }
  const colorCommand = commandId.match(/^color-(text|background)-([\da-f]{6})$/);
  if (colorCommand) {
    setVisibleBlockContent(node, withoutCommand);
    applyBlockColor(state.blockId, `#${colorCommand[2]}`, colorCommand[1] === "text" ? "text" : "background");
    return;
  }
  if (commandId === "task") {
    setVisibleBlockContent(node, withoutCommand);
    node.content = applyTaskCompletionReward(node.content, toggleTaskStatus(node.content));
  } else if (commandId === "flashcard") {
    setVisibleBlockContent(node, `${withoutCommand.trim()} #card`.trim());
    ensureBlockCreatedAt(node);
  } else if (commandId === "cloze") {
    const selected = state.editor.dataset.id === state.blockId
      ? readEditorSelection(state.editor, state.blockId)
      : null;
    const start = selected?.start ?? 0;
    const end = selected?.end ?? 0;
    const content = withoutCommand.trim();
    setVisibleBlockContent(
      node,
      end > start && end <= content.length
        ? `${content.slice(0, start)}==${content.slice(start, end)}==${content.slice(end)} #card`
        : `==${content || "texto"}== #card`
    );
    ensureBlockCreatedAt(node);
  } else if (commandId === "clear-properties") {
    const { text } = splitBlockProperties(node.content);
    setVisibleBlockContent(node, text);
    cursorState = { blockId: state.blockId, offset: text.length };
    void vault.savePage(page);
    renderBlocksTree();
    return;
  } else if (commandId === "query") {
    const queryText = withoutCommand.trim() || "search";
    setVisibleBlockContent(node, `${withoutCommand.trim()} {{query ${queryText}}}`.trim());
    cursorState = { blockId: state.blockId, offset: getVisibleBlockContent(node.content).length };
    void vault.savePage(page);
    renderBlocksTree();
    return;
  }
  cursorState = { blockId: state.blockId, offset: getVisibleBlockContent(node.content).length };
  void vault.savePage(page);
  renderBlocksTree();
}

function handleSlashMenuKeyDown(event: KeyboardEvent): boolean {
  if (!slashMenuState || !slashMenu || slashMenu.hidden) return false;
  const options = Array.from(slashMenu.querySelectorAll<HTMLButtonElement>(".slash-command-option"));
  if (event.key === "Escape") {
    event.preventDefault();
    hideSlashMenu();
    return true;
  }
  if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length) {
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    slashMenuState.selectedIndex = (slashMenuState.selectedIndex + delta + options.length) % options.length;
    options.forEach((option, index) => {
      const selected = index === slashMenuState?.selectedIndex;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-selected", String(selected));
    });
    options[slashMenuState.selectedIndex].scrollIntoView({ block: "nearest" });
    return true;
  }
  if (event.key === "Enter" && options.length) {
    event.preventDefault();
    options[slashMenuState.selectedIndex].click();
    return true;
  }
  return false;
}

function handleEditorKeyDown(e: KeyboardEvent, blockId: string, page: PageData = currentPage, editorElement?: HTMLElement) {
  const root = editorElement?.closest<HTMLElement>(".blocks-tree") ?? blocksContainer;
  const editor = editorElement ?? root.querySelector<HTMLElement>(
    `.block-editor[data-id="${blockId}"]`
  );
  if (!editor) return;

  if (e.key !== "Enter" || e.shiftKey) enterOutdentedBlockId = null;

  if (handleSlashMenuKeyDown(e)) return;

  if (wikilinkAutocompleteState?.editor === editor && wikilinkAutocompleteMenu && !wikilinkAutocompleteMenu.hidden) {
    const options = Array.from(
      wikilinkAutocompleteMenu.querySelectorAll<HTMLButtonElement>(".wikilink-autocomplete-option")
    );
    if (e.key === "Escape") {
      e.preventDefault();
      hideWikilinkAutocomplete();
      return;
    }
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && options.length > 0) {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      wikilinkAutocompleteState.selectedIndex =
        (wikilinkAutocompleteState.selectedIndex + delta + options.length) % options.length;
      options.forEach((option, index) => {
        const selected = index === wikilinkAutocompleteState?.selectedIndex;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-selected", String(selected));
      });
      options[wikilinkAutocompleteState.selectedIndex].scrollIntoView({ block: "nearest" });
      return;
    }
    if (e.key === "Enter" && options.length > 0) {
      e.preventDefault();
      const selected = options[wikilinkAutocompleteState.selectedIndex];
      if (selected.dataset.title) {
        void completeWikilink(selected.dataset.title, selected.dataset.create === "true");
      }
      return;
    }
  }

  const offset = getCaretOffset(editor);
  const textLen = serializeEditorContent(editor).length;
  const hasTextSelection = Boolean(window.getSelection() && !window.getSelection()?.isCollapsed);
  const hasBulletSelection = selectedBulletIds.length > 0;

  // Selección múltiple de bullets: las operaciones de grupo (indentar,
  // desindentar, borrar) tienen prioridad sobre las de un solo bloque y
  // funcionan aunque haya una selección de texto nativa residual (creada,
  // p. ej., por un arrastre real de ratón sobre los bullets).
  if (selectedBulletIds.length > 1) {
    const isTab = e.key === "Tab" || e.code === "Tab";
    if (isTab && !e.shiftKey) {
      e.preventDefault();
      indentSelectedBullets(page);
      return;
    }
    if (isTab && e.shiftKey) {
      e.preventDefault();
      outdentSelectedBullets(page);
      return;
    }
    if (e.key === "ArrowRight" && e.altKey) {
      e.preventDefault();
      indentSelectedBullets(page);
      return;
    }
    if (e.key === "ArrowLeft" && e.altKey) {
      e.preventDefault();
      outdentSelectedBullets(page);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      void deleteSelectedBullets(page);
      return;
    }
  }

  if (hasBulletSelection && !hasTextSelection && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
    e.preventDefault();
    void copySelectedBullets(page);
    return;
  }

  if (hasBulletSelection && !hasTextSelection && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
    e.preventDefault();
    void cutSelectedBullets(page);
    return;
  }

  if (hasBulletSelection && !hasTextSelection && (e.key === "Delete" || e.key === "Backspace")) {
    e.preventDefault();
    void deleteSelectedBullets(page);
    return;
  }

  // Atajos de selección masiva y tarjetas.
  // Ctrl/Cmd+Shift+A selecciona todos los bullets de la página; Ctrl/Cmd+A
  // amplía la selección actual a toda la página.
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "a") {
    if (e.shiftKey || selectedBulletIds.length > 0) {
      e.preventDefault();
      selectAllBullets(page);
      return;
    }
  }

  // Ctrl/Cmd+Shift+C crea una tarjeta básica desde la selección (o el bullet actual).
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "c") {
    e.preventDefault();
    createBasicCardFromSelection(page);
    return;
  }

  // Ctrl/Cmd+Shift+D elimina los marcadores de flashcard de la selección.
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "d") {
    e.preventDefault();
    deleteFlashcardsInSelection(page);
    return;
  }

  if (
    e.shiftKey &&
    (e.key === "ArrowUp" || e.key === "ArrowDown") &&
    ((e.key === "ArrowUp" && offset === 0) || (e.key === "ArrowDown" && offset >= textLen))
  ) {
    const visible = getFlatVisibleBlocks(page.blocks);
    const currentIndex = visible.findIndex((block) => block.id === blockId);
    const nextIndex = currentIndex + (e.key === "ArrowUp" ? -1 : 1);
    const target = visible[nextIndex];
    if (target) {
      e.preventDefault();
      selectBulletRange(bulletSelectionAnchorId || blockId, target.id, false, page);
      const targetEditor = root.querySelector<HTMLElement>(
        `.block-editor[data-id="${target.id}"]`
      );
      if (targetEditor) {
        targetEditor.focus();
        setCaretOffset(
          targetEditor,
          e.key === "ArrowUp" ? serializeEditorContent(targetEditor).length : 0
        );
      }
    }
    return;
  }

  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (offset >= textLen) {
      // Enter en un bullet vacío: primero lo desindenta un nivel y, en el
      // Enter siguiente, crea un hermano en ese nivel. Así se puede salir de
      // una jerarquía sin usar Shift+Tab, como en Logseq/Roam/RemNote.
      const res = enterAtEnd(
        page.blocks,
        blockId,
        enterOutdentedBlockId === blockId
      );
      if (res) {
        page.blocks = res.newTree;
        enterOutdentedBlockId = res.outdented ? blockId : null;
        cursorState = res.newBlockId
          ? { blockId: res.newBlockId, offset: 0 }
          : { blockId, offset: 0 };
        vault.savePage(page);
        renderBlocksTree();
      }
    } else {
      enterOutdentedBlockId = null;
      const res = splitBlock(page.blocks, blockId, offset);
      if (res) {
        page.blocks = res.newTree;
        cursorState = { blockId: res.newBlockId, offset: 0 };
        vault.savePage(page);
        renderBlocksTree();
      }
    }
    return;
  }

  // 1. Mover a la derecha con Alt + Flecha Derecha
  if (e.key === "ArrowRight" && e.altKey) {
    e.preventDefault();
    const newTree = indentBlock(page.blocks, blockId);
    if (newTree) {
      page.blocks = newTree;
      cursorState = { blockId, offset };
      vault.savePage(page);
      renderBlocksTree();
    }
    return;
  }

 // 2. Mover a la derecha con TAB simple (evalúa key o code)
if ((e.key === "Tab" || e.code === "Tab") && !e.shiftKey) {
  e.preventDefault();
  const newTree = indentBlock(page.blocks, blockId);
  if (newTree) {
    page.blocks = newTree;
    cursorState = { blockId, offset };
    vault.savePage(page);
    renderBlocksTree();
  }
  return;
}

// 3. Mover a la izquierda con Shift + TAB (evalúa key o code)
if ((e.key === "Tab" || e.code === "Tab") && e.shiftKey) {
  e.preventDefault();
  const newTree = outdentBlock(page.blocks, blockId);
  if (newTree) {
    page.blocks = newTree;
    cursorState = { blockId, offset };
    vault.savePage(page);
    renderBlocksTree();
  }
  return;
}

  if (e.key === "Backspace" && offset === 0) {
    const res = deleteOrMergeBlock(page.blocks, blockId);
    if (res) {
      e.preventDefault();
      page.blocks = res.newTree;
      cursorState = res.targetFocusId
        ? { blockId: res.targetFocusId, offset: res.cursorOffset }
        : null;
      vault.savePage(page);
      renderBlocksTree();
    }
    return;
  }

  if (e.key === "ArrowUp" && offset === 0) {
    const flat = getFlatVisibleBlocks(page.blocks);
    const idx = flat.findIndex((b) => b.id === blockId);
    if (idx > 0) {
      e.preventDefault();
      const prev = flat[idx - 1];
      const prevEl = root.querySelector<HTMLElement>(
        `.block-editor[data-id="${prev.id}"]`
      );
      if (prevEl) {
        prevEl.focus();
        setCaretOffset(prevEl, serializeEditorContent(prevEl).length);
      }
    }
  } else if (e.key === "ArrowDown" && offset >= textLen) {
    const flat = getFlatVisibleBlocks(page.blocks);
    const idx = flat.findIndex((b) => b.id === blockId);
    if (idx >= 0 && idx < flat.length - 1) {
      e.preventDefault();
      const next = flat[idx + 1];
      const nextEl = root.querySelector<HTMLElement>(
        `.block-editor[data-id="${next.id}"]`
      );
      if (nextEl) {
        nextEl.focus();
        setCaretOffset(nextEl, 0);
      }
    }
  }
}

let backlinksRenderToken = 0;

/**
 * Los retroenlaces recorren todos los bloques del vault. Se pintan en el
 * siguiente turno para que abrir una nota no espere a ese recorrido; el token
 * descarta resultados de una nota que ya no está abierta.
 */
function scheduleRenderBacklinks(): void {
  const token = ++backlinksRenderToken;
  const pageId = currentPage.id;
  window.setTimeout(() => {
    if (token !== backlinksRenderToken || currentPage.id !== pageId) return;
    renderBacklinks();
  }, 0);
}

function renderBacklinks() {
  const backlinks = vault.findBacklinksFor(currentPage.title);
  const outgoing = collectOutgoingLinks(currentPage);
  refCountBadge.innerText = backlinks.length.toString();
  if (outgoingCountBadge) outgoingCountBadge.innerText = outgoing.length.toString();
  backlinksContainer.innerHTML = "";
  if (outgoingLinksContainer) outgoingLinksContainer.innerHTML = "";

  if (backlinks.length === 0) {
    backlinksContainer.innerHTML =
      '<div class="empty-backlinks">No hay retroenlaces vinculados a esta página.</div>';
  } else {
    for (const ref of backlinks) {
      const card = document.createElement("div");
      card.className = "backlink-card";

      const source = document.createElement("div");
      source.className = "backlink-source";
      source.append(`📄 ${ref.source_page} `);
      const lineInfo = document.createElement("span");
      lineInfo.style.color = "var(--ls-text-muted)";
      lineInfo.style.fontSize = scaledFontSize(11);
      lineInfo.textContent = `(línea ${ref.line_number})`;
      source.append(lineInfo);
      source.addEventListener("click", () => {
        loadPage(ref.source_page);
      });

      const snippet = document.createElement("div");
      snippet.className = "backlink-snippet";

      const escaped = ref.snippet
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
      snippet.innerHTML = escaped.replace(
        /\[\[(.*?)\]\]/g,
        '<span class="wikilink-pill" data-page="$1">[[$1]]</span>'
      );

      snippet.querySelectorAll(".wikilink-pill").forEach((pill) => {
        pill.addEventListener("click", (e) => {
          e.stopPropagation();
          const target = (pill as HTMLElement).dataset.page;
          if (target) loadPage(target);
        });
      });

      card.appendChild(source);
      card.appendChild(snippet);
      backlinksContainer.appendChild(card);
    }
  }

  if (!outgoingLinksContainer) return;
  if (outgoing.length === 0) {
    outgoingLinksContainer.innerHTML =
      '<div class="empty-backlinks">Esta página no enlaza a ninguna otra nota.</div>';
    return;
  }

  for (const ref of outgoing) {
    const exists = Boolean(vault.getPageByTitle(ref.targetTitle));
    const card = document.createElement("div");
    card.className = `backlink-card outgoing-link-card${exists ? "" : " is-broken"}`;

    const target = document.createElement("div");
    target.className = "backlink-source";
    target.append(`→ ${ref.targetTitle}`);
    if (!exists) {
      const broken = document.createElement("span");
      broken.className = "outgoing-broken-badge";
      broken.textContent = translate("enlace roto");
      target.append(" ", broken);
    }
    const lineInfo = document.createElement("span");
    lineInfo.style.color = "var(--ls-text-muted)";
    lineInfo.style.fontSize = scaledFontSize(11);
    lineInfo.textContent = ` (${translate("línea")} ${ref.lineNumber})`;
    target.append(lineInfo);
    target.addEventListener("click", () => {
      if (!exists) showToast(`${translate("Creando la nota")} "${ref.targetTitle}"…`);
      loadPage(ref.targetTitle);
    });

    const snippet = document.createElement("div");
    snippet.className = "backlink-snippet";
    snippet.textContent = ref.alias
      ? `${translate("Alias")}: ${ref.alias}`
      : ref.snippet.trim();

    card.appendChild(target);
    card.appendChild(snippet);
    outgoingLinksContainer.appendChild(card);
  }
}

function renderEditor() {
  // Establecer la línea base del historial de deshacer para esta nota.
  documentHistory.seed(currentPage.id, currentPage.blocks, currentPage.title);
  // No pisar la edición del título que el usuario pueda tener en curso.
  if (document.activeElement !== pageTitleHeading) {
    pageTitleHeading.innerText = currentPage.title;
    lastValidPageTitle = currentPage.title;
  }
  setHeadbarTitle(currentPage.title);
  pagePropertiesContainer.replaceChildren();
  const frontmatter = currentPage.frontmatter || [];
  if (frontmatter.length > 0) {
    const properties = document.createElement("details");
    properties.className = "page-properties";
    const summary = document.createElement("summary");
    summary.innerText = `Propiedades de página (${frontmatter.length})`;
    const values = document.createElement("pre");
    values.className = "page-properties-values";
    values.textContent = frontmatter.join("\n");
    properties.append(summary, values);
    pagePropertiesContainer.appendChild(properties);
  }
  renderBlocksTree();
  scheduleRenderBacklinks();
  // Si la barra de búsqueda interna está abierta, sus coincidencias dependen
  // del contenido de la nota: recalcularlas al abrir otra página (T20).
  if (noteFindBar && !noteFindBar.hidden) runNoteFind(true);
}

function loadPage(title: string) {
  let target = vault.getPageByTitle(title);
  if (!target) {
    target = vault.createPage(title);
  }
  currentPage = target;
  showEditorPage();
}

function openPage(page: PageData) {
  currentPage = page;
  showEditorPage();
}

function showEditorPage() {
  cursorState = { blockId: currentPage.blocks[0]?.id || "b-1", offset: 0 };
  snapshotState = null;
  snapshotActivateForm.hidden = true;
  snapshotFormError.textContent = "";
  void refreshSnapshotState().then((state) => {
    if (!(state?.enabled && !state.expired && !state.clockAnomaly)) {
      syncSnapshotFormFromState();
    }
  });
  void refreshActiveSnapshotNotesList();
  switchView("editor");
}

/**
 * Confirma el título editado en el encabezado de la nota.
 * El título de una nota es su nombre de archivo, así que el cambio debe
 * renombrar el archivo y sincronizar título, ruta y contenido a la vez.
 */
function commitPageTitleRename(): void {
  // Si el usuario cambió de nota con el título a medio editar, el renombrado ya no aplica.
  if (pageTitleRenamePageId && pageTitleRenamePageId !== currentPage.id) return;

  const rawTitle = pageTitleHeading.innerText.trim();
  const newTitle = normalizeDeckTitle(rawTitle);

  const restoreTitle = (): void => {
    pageTitleHeading.innerText = lastValidPageTitle;
    setHeadbarTitle(lastValidPageTitle);
    currentPage.title = lastValidPageTitle;
    renderSidebar();
  };

  if (!newTitle) {
    restoreTitle();
    return;
  }

  // Si el usuario escribe `::`, `->` o `>`, el título se normaliza antes de
  // tocar el archivo: `:` y `>` no son válidos en Windows y `→` sí.
  if (rawTitle === lastValidPageTitle) {
    setHeadbarTitle(lastValidPageTitle);
    return;
  }
  if (newTitle === lastValidPageTitle) {
    pageTitleHeading.innerText = newTitle;
    setHeadbarTitle(newTitle);
    return;
  }
  if (newTitle !== rawTitle) pageTitleHeading.innerText = newTitle;

  const oldTitle = currentPage.title;
  const oldPath = currentPage.path;
  if (!vault.renamePage(currentPage.id, newTitle)) {
    showToast("No se pudo renombrar la nota.");
    restoreTitle();
    vault.savePage(currentPage);
    return;
  }

  renameFlashcardPageReferences(oldTitle, newTitle);
  lastValidPageTitle = newTitle;
  currentPage.title = newTitle;
  // El registro de recientes se guarda por ruta: si la nota estaba en la
  // lista, hay que sustituir la ruta antigua por la nueva.
  currentPage.path = vault.getPageByTitle(newTitle)?.path ?? currentPage.path;
  replaceRecentPath(oldPath, currentPage.path);
  vault.savePage(currentPage);
  setHeadbarTitle(newTitle);
  renderSidebar();
}

pageTitleHeading.addEventListener("input", () => {
  setHeadbarTitle(pageTitleHeading.innerText.trim());
  renderSidebar();
  // Renombrar el archivo físico al nuevo título (con debounce para no saturar en cada tecla)
  if (pageTitleRenameTimer) clearTimeout(pageTitleRenameTimer);
  pageTitleRenamePageId = currentPage.id;
  pageTitleRenameTimer = window.setTimeout(commitPageTitleRename, 600);
});

pageTitleHeading.addEventListener("paste", (event) => {
  const clipboard = event.clipboardData;
  if (!clipboard) return;
  const plainText = clipboard.getData("text/plain");
  if (plainText === undefined) return;
  event.preventDefault();
  // El título es texto plano: se descarta cualquier formato y se evita que un
  // HTML pegado se cuele en un elemento contentEditable.
  const singleLine = plainText.replace(/\r\n?/g, " ").replace(/[\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (!singleLine) return;
  const inserted = document.execCommand("insertText", false, singleLine);
  if (!inserted) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(singleLine));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    pageTitleHeading.dispatchEvent(new Event("input", { bubbles: true }));
  }
});

pageTitleHeading.addEventListener("blur", () => {
  if (pageTitleRenameTimer) {
    clearTimeout(pageTitleRenameTimer);
    pageTitleRenameTimer = null;
  }
  commitPageTitleRename();
});

/* ==================== PAGE DELETION ==================== */
async function deleteCurrentPage() {
  const confirmed = await confirmAction(
    `¿Estás seguro de que deseas eliminar permanentemente la página "${currentPage.title}"?`,
    "Eliminar"
  );
  if (!confirmed) return;

  vault.deletePage(currentPage.id);
  // La nota borrada puede tener flashcards: actualizar el selector de notas
  // (y descartar selecciones fantasma) aunque Ajustes esté cerrado.
  renderFlashcardPagesFilter(true);
  const remaining = vault.getPages();
  if (remaining.length > 0) {
    currentPage = remaining[0];
  } else {
    currentPage = vault.createPage("Bienvenido");
  }

  showToast("Página eliminada con éxito");
  loadPage(currentPage.title);
}

btnDeletePage.addEventListener("click", deleteCurrentPage);

/* ==================== PAGE VERSION HISTORY / SNAPSHOTS ==================== */
const SNAPSHOT_POLL_INTERVAL_MS = 60_000;
const SNAPSHOT_MAX_DAYS = 30;
let snapshotState: SnapshotState | null = null;
let snapshotPollTimer: number | null = null;
let snapshotBusy = false;

/** Formatea una duración en milisegundos de forma legible y sin depender del reloj. */
function formatSnapshotRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 48) {
    return minutes > 0 ? `${totalHours} h ${minutes} min` : `${totalHours} h`;
  }
  const days = Math.floor(totalHours / 24);
  const restHours = totalHours % 24;
  return restHours > 0 ? `${days} d ${restHours} h` : `${days} d`;
}

function describeSnapshotState(state: SnapshotState | null): string {
  if (!state) return translate("Snapshots no disponibles fuera de la aplicación.");
  if (state.clockAnomaly) {
    return translate("Snapshots en pausa: el reloj del sistema retrocedió.");
  }
  if (state.enabled && !state.expired) {
    const limit = state.maxPerDay > 0
      ? `${translate("máx.")} ${state.maxPerDay} ${translate("al día")}`
      : translate("sin límite diario");
    return [
      translate("Snapshots activos"),
      `${translate("quedan")} ${formatSnapshotRemaining(state.remainingMs)}`,
      `${translate("cada")} ${state.intervalHours} h`,
      limit,
    ].join(" · ");
  }
  if (state.expired) {
    return translate("La ventana de snapshots expiró. Actívala de nuevo para seguir registrando versiones.");
  }
  return translate("Snapshots desactivados. Actívalos para registrar versiones automáticamente.");
}

function updateSnapshotUi(): void {
  const state = snapshotState;
  const active = Boolean(state?.enabled && !state.expired && !state.clockAnomaly);
  const statusText = describeSnapshotState(state);
  if (snapshotStatusText) snapshotStatusText.textContent = statusText;
  if (snapshotStateDot) {
    snapshotStateDot.classList.toggle("is-active", active);
    snapshotStateDot.classList.toggle("is-paused", Boolean(state?.clockAnomaly));
    snapshotStateDot.classList.toggle("is-off", !active && !state?.clockAnomaly);
    snapshotStateDot.title = statusText;
  }
  // Update toggle switches
  if (btnSnapshotToggle) {
    btnSnapshotToggle.checked = active;
    btnSnapshotToggle.setAttribute("aria-expanded", String(!active));
    const label = document.getElementById("snapshot-toggle-label") as HTMLSpanElement;
    if (label) label.textContent = translate(active ? "Desactivar snapshots" : "Activar snapshots");
  }
  // El interruptor es el único control de activación/desactivación. Cuando
  // está activo ocultamos la configuración; al desactivarlo vuelve a mostrarse.
  if (snapshotActivateForm) snapshotActivateForm.hidden = active;
  if (snapshotFolderHint) {
    snapshotFolderHint.textContent = state?.storageFolder
      ? `${translate("Carpeta")}: ${state.storageFolder}`
      : "";
  }
  void refreshActiveSnapshotNotesList();
}

function syncSnapshotFormFromState(): void {
  const state = snapshotState;
  const duration = state?.durationDays && state.durationDays > 0
    ? Math.min(SNAPSHOT_MAX_DAYS, state.durationDays)
    : 7;
  const interval = state?.intervalHours && state.intervalHours > 0 ? state.intervalHours : 4;
  const limit = state?.maxPerDay ?? 8;
  snapshotDurationDays.value = String(duration);
  snapshotIntervalHours.value = String(interval);
  snapshotLimitEnabled.checked = limit > 0;
  snapshotMaxPerDay.value = String(limit > 0 ? limit : 8);
  snapshotMaxPerDay.disabled = !snapshotLimitEnabled.checked;
  snapshotFormError.textContent = "";
}

function setSnapshotFormDisabled(disabled: boolean): void {
  snapshotDurationDays.disabled = disabled;
  snapshotIntervalHours.disabled = disabled;
  snapshotLimitEnabled.disabled = disabled;
  snapshotMaxPerDay.disabled = disabled || !snapshotLimitEnabled.checked;
}

function setSnapshotBusy(busy: boolean): void {
  snapshotBusy = busy;
  if (btnSnapshotToggle) btnSnapshotToggle.disabled = busy;
  setSnapshotFormDisabled(busy);
}

async function refreshSnapshotState(): Promise<SnapshotState | null> {
  if (!isTauri() || !currentPage?.path) {
    snapshotState = null;
    updateSnapshotUi();
    return null;
  }
  try {
    snapshotState = await invoke<SnapshotState>("get_snapshot_state", { filePath: currentPage.path });
  } catch (error) {
    console.error("No se pudo consultar el estado de los snapshots:", error);
    snapshotState = null;
  }
  updateSnapshotUi();
  return snapshotState;
}

/** Pregunta al backend si toca guardar snapshots. El backend decide siempre. */
async function tickSnapshots(): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("tick_snapshots");
  } catch (error) {
    console.error("No se pudieron procesar los snapshots:", error);
  }
  await refreshSnapshotState();
}

function startSnapshotPolling(): void {
  if (snapshotPollTimer !== null) return;
  snapshotPollTimer = window.setInterval(() => {
    if (document.hidden) return;
    void tickSnapshots();
  }, SNAPSHOT_POLL_INTERVAL_MS);
}

/** Convierte el historial antiguo (`.sinnotas/revisions`) a `.sinnotas/chronos/`. */
async function migrateLegacySnapshotFiles(): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("migrate_legacy_snapshots");
  } catch (error) {
    console.error("No se pudieron migrar los snapshots antiguos:", error);
  }
}

/** Lee el estado inicial y arranca el sondeo periódico del backend. */
async function initializeSnapshotSubsystem(): Promise<void> {
  await tickSnapshots();
  startSnapshotPolling();
}

/** Vuelve a leer la lista de snapshots de la nota actual si el modal está abierto. */
async function refreshHistorySnapshots(): Promise<void> {
  if (!historyModalOverlay.classList.contains("visible")) return;
  try {
    const revisions = await vault.getRevisions(currentPage, true);
    if (historyModalOverlay.classList.contains("visible")) renderRevisionsList(revisions);
  } catch (error) {
    console.error("No se pudo cargar el historial:", error);
    historyPreviewContent.textContent = translate("No se pudo cargar el historial.");
  }
  void refreshSnapshotState();
  void refreshActiveSnapshotNotesList();
}

function openHistoryModal() {
  runModalBoundary("el historial", closeHistoryModal, () => {
    historyModalTitle.innerText = translate(`Historial de Versiones: ${currentPage.title}`);
    historyRevisionsList.replaceChildren();
    const loading = document.createElement("div");
    loading.className = "empty-backlinks";
    loading.style.padding = "12px";
    loading.textContent = translate("Cargando…");
    historyRevisionsList.appendChild(loading);
    btnRestoreVersion.style.display = "none";
    mountOverlay(historyModalOverlay);
    historyModalOverlay.classList.add("visible");
  });
  void (async () => {
    await refreshSnapshotState();
    // Si la ventana está activa y toca guardar, registra la versión más reciente
    // antes de mostrar el historial. Nunca se salta el intervalo ni el límite.
    if (snapshotState?.enabled && !snapshotState.expired && !snapshotState.clockAnomaly) {
      await tickSnapshots();
    }
    await refreshSnapshotState();
    if (!(snapshotState?.enabled && !snapshotState.expired && !snapshotState.clockAnomaly)) {
      syncSnapshotFormFromState();
    }
    await refreshHistorySnapshots();
  })();
}

function renderRevisionsList(revisions: PageRevision[]) {
  historyRevisionsList.replaceChildren();

  if (revisions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-backlinks";
    empty.style.padding = "12px";
    empty.textContent = translate("Sin snapshots previos aún.");
    historyRevisionsList.appendChild(empty);
    historyPreviewContent.textContent = translate(
      "Activa una ventana de snapshots o espera al siguiente intervalo para registrar versiones."
    );
    historyPreviewMeta.textContent = translate("Vista previa de la versión");
    btnRestoreVersion.style.display = "none";
    selectedRevisionId = null;
    return;
  }

  revisions.forEach((rev, idx) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `revision-item ${idx === 0 ? "active" : ""}`;

    const timestamp = document.createElement("div");
    timestamp.style.fontWeight = "600";
    timestamp.textContent = rev.timestamp;

    const summary = document.createElement("div");
    summary.style.color = "var(--ls-text-muted)";
    summary.style.fontSize = scaledFontSize(11);
    summary.textContent = translate(rev.summary || "Snapshot");

    item.append(timestamp, summary);
    item.addEventListener("click", () => {
      historyRevisionsList.querySelectorAll(".revision-item").forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      showRevisionPreview(rev.id, revisions);
    });

    historyRevisionsList.appendChild(item);
  });

  showRevisionPreview(revisions[0].id, revisions);
}

function showRevisionPreview(revId: string, revisions: PageRevision[]) {
  selectedRevisionId = revId;
  const rev = revisions.find((r) => r.id === revId);
  if (!rev) return;

  historyPreviewMeta.innerText = `${translate("Snapshot")}: ${rev.timestamp} (${rev.summary ? translate(rev.summary) : "—"})`;

  function formatOutline(blocks: BlockNode[], depth = 0): string {
    return blocks
      .map((b) => `${"  ".repeat(depth)}- ${b.content}\n${formatOutline(b.children || [], depth + 1)}`)
      .join("");
  }

  historyPreviewContent.innerText = formatOutline(rev.blocks);
  btnRestoreVersion.style.display = "inline-block";
}

// El interruptor activa o desactiva los snapshots directamente. Los campos de
// configuración solo se muestran cuando están desactivados, así que la acción
// de activar usa los valores visibles en ese momento.
function readSnapshotFormValues(): { durationDays: number; intervalHours: number; maxPerDay: number } | null {
  const durationDays = Math.trunc(Number(snapshotDurationDays.value));
  const intervalHours = Math.trunc(Number(snapshotIntervalHours.value));
  const maxPerDay = snapshotLimitEnabled.checked
    ? Math.trunc(Number(snapshotMaxPerDay.value))
    : 0;

  if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > SNAPSHOT_MAX_DAYS) {
    snapshotFormError.textContent = translate("La duración debe estar entre 1 y 30 días.");
    return null;
  }
  if (!Number.isFinite(intervalHours) || intervalHours < 1 || intervalHours > 168) {
    snapshotFormError.textContent = translate("El intervalo debe estar entre 1 y 168 horas.");
    return null;
  }
  if (snapshotLimitEnabled.checked && (!Number.isFinite(maxPerDay) || maxPerDay < 1 || maxPerDay > 96)) {
    snapshotFormError.textContent = translate("El límite diario debe estar entre 1 y 96 snapshots.");
    return null;
  }

  return { durationDays, intervalHours, maxPerDay };
}

async function activateSnapshotsFromForm(): Promise<void> {
  if (snapshotBusy || !currentPage?.path) return;
  const values = readSnapshotFormValues();
  if (!values) {
    // El interruptor ya cambió visualmente: devolverlo a su estado real.
    updateSnapshotUi();
    return;
  }

  setSnapshotBusy(true);
  snapshotFormError.textContent = "";
  try {
    snapshotState = await invoke<SnapshotState>("activate_snapshots", {
      filePath: currentPage.path,
      ...values,
    });
    updateSnapshotUi();
    showToast(translate("Snapshots activados."));
    await tickSnapshots();
    await refreshHistorySnapshots();
  } catch (error) {
    console.error("No se pudieron activar los snapshots:", error);
    snapshotFormError.textContent = translate("No se pudieron activar los snapshots. Revisa el vault e inténtalo de nuevo.");
    updateSnapshotUi();
  } finally {
    setSnapshotBusy(false);
  }
}

function handleSnapshotToggle(enable: boolean): void {
  if (snapshotBusy || !currentPage?.path) return;
  if (enable) {
    void activateSnapshotsFromForm();
    return;
  }

  void (async () => {
    const confirmed = await confirmAction(
      "Desactivar los snapshots de esta nota eliminará todas las versiones guardadas. ¿Continuar?",
      "Desactivar y eliminar"
    );
    if (!confirmed) {
      updateSnapshotUi();
      return;
    }
    setSnapshotBusy(true);
    try {
      snapshotState = await invoke<SnapshotState>("disable_snapshots", { filePath: currentPage.path });
      updateSnapshotUi();
      syncSnapshotFormFromState();
      showToast(translate("Snapshots desactivados."));
      await refreshHistorySnapshots();
    } catch (error) {
      console.error("Error al cambiar estado de snapshots:", error);
      showToast(translate("No se pudieron desactivar los snapshots."));
      updateSnapshotUi();
    } finally {
      setSnapshotBusy(false);
    }
  })();
}

if (btnSnapshotToggle) {
  btnSnapshotToggle.addEventListener("change", () => {
    handleSnapshotToggle(btnSnapshotToggle.checked);
  });
}

snapshotLimitEnabled.addEventListener("change", () => {
  snapshotMaxPerDay.disabled = snapshotBusy || !snapshotLimitEnabled.checked;
  if (snapshotLimitEnabled.checked && !snapshotMaxPerDay.value) {
    snapshotMaxPerDay.value = "8";
  }
});

snapshotActivateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void activateSnapshotsFromForm();
});

btnRestoreVersion.addEventListener("click", async () => {
  if (!selectedRevisionId) return;
  const confirmed = await confirmAction("¿Deseas restaurar la nota a esta versión?", "Restaurar");
  if (!confirmed) return;

  try {
    const restored = await vault.restoreSnapshot(currentPage, selectedRevisionId);
    if (!restored) {
      showToast(translate("No se pudo restaurar el snapshot."));
      return;
    }
    currentPage.blocks = restored.blocks;
    currentPage.frontmatter = restored.frontmatter;
    documentHistory.seed(currentPage.id, currentPage.blocks, currentPage.title);
    renderBlocksTree();
    closeHistoryModal();
    showToast("¡Nota restaurada con éxito a la versión seleccionada!");
  } catch (error) {
    console.error("No se pudo restaurar el snapshot:", error);
    showToast(translate("No se pudo restaurar el snapshot."));
  }
});

btnPageHistory.addEventListener("click", openHistoryModal);
btnCloseHistory.addEventListener("click", closeHistoryModal);
async function refreshActiveSnapshotNotesList(): Promise<void> {
  if (!isTauri() || !snapshotActiveNotesList) {
    if (snapshotActiveNotesList) snapshotActiveNotesList.replaceChildren();
    return;
  }
  try {
    const notes = await invoke<SnapshotActiveNote[]>("list_active_snapshot_notes");
    snapshotActiveNotesList.replaceChildren();
    if (notes.length === 0) {
      const empty = document.createElement("div");
      empty.className = "settings-help";
      empty.style.margin = "0";
      empty.textContent = translate("No hay notas con snapshots activos.");
      snapshotActiveNotesList.appendChild(empty);
      return;
    }
    for (const note of notes) {
      const row = document.createElement("div");
      row.className = "snapshot-note-row";

      const info = document.createElement("div");
      info.className = "snapshot-note-info";

      const title = document.createElement("div");
      title.className = "snapshot-note-title";
      title.title = note.notePath;
      title.textContent = note.noteTitle;

      const meta = document.createElement("div");
      meta.className = "snapshot-note-meta";
      const remaining = formatSnapshotRemaining(note.remainingMs);
      const versionLabel = translate(note.snapshotCount === 1 ? "versión guardada" : "versiones guardadas");
      meta.textContent = `${note.snapshotCount} ${versionLabel} · ${translate("Quedan")} ${remaining} · ${translate("Cada")} ${note.intervalHours} h`;

      info.append(title, meta);

      const actions = document.createElement("div");
      actions.className = "snapshot-note-actions";

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "font-option-btn";
      openBtn.textContent = translate("Abrir historial de esta nota");
      openBtn.addEventListener("click", () => {
        closeSettingsOverlay();
        loadPage(note.noteTitle);
        setTimeout(() => openHistoryModal(), 200);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "font-option-btn snapshot-danger";
      deleteBtn.textContent = translate("Borrar snapshots");
      deleteBtn.addEventListener("click", async () => {
        const confirmed = await confirmAction(
          `Borrar todas las versiones guardadas de "${note.noteTitle}". ¿Continuar?`,
          "Borrar"
        );
        if (!confirmed) return;
        try {
          await invoke("delete_note_snapshots", { filePath: note.notePath });
          showToast(translate("Snapshots eliminados."));
          await refreshActiveSnapshotNotesList();
          if (currentPage?.path === note.notePath) {
            await refreshSnapshotState();
            await refreshHistorySnapshots();
          }
        } catch (error) {
          console.error("No se pudieron borrar los snapshots:", error);
          showToast(translate("No se pudieron borrar los snapshots."));
        }
      });

      actions.append(openBtn, deleteBtn);
      row.append(info, actions);
      snapshotActiveNotesList.appendChild(row);
    }
  } catch (error) {
    console.error("No se pudo listar los snapshots activos:", error);
    if (snapshotActiveNotesList) {
      snapshotActiveNotesList.replaceChildren();
      const errorEl = document.createElement("div");
      errorEl.className = "settings-help";
      errorEl.style.margin = "0";
      errorEl.textContent = "No se pudo cargar el seguimiento de snapshots.";
      snapshotActiveNotesList.appendChild(errorEl);
    }
  }
}

btnOpenSnapshotHistory.addEventListener("click", () => {
  closeSettingsOverlay();
  openHistoryModal();
});

/* ==================== KANBAN BOARD VIEW ==================== */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function playCompletionProgress(): void {
  completionProgress.classList.remove("is-active");
  void completionProgress.offsetWidth;
  completionProgress.classList.add("is-active");
}

completionProgress.addEventListener("animationend", () => {
  completionProgress.classList.remove("is-active");
});

function localDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseTaskDueDateValue(value: string): Date | null {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    const date = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3])
    );
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return localDayStart(new Date(timestamp));
}

function taskDueUrgency(value: string): number {
  const due = parseTaskDueDateValue(value);
  if (!due) return 0;
  const days = Math.round((due.getTime() - localDayStart(new Date()).getTime()) / 86_400_000);
  return Math.max(0, Math.min(1, 1 - days / 21));
}

function formatTaskDueDate(value: string): string {
  const due = parseTaskDueDateValue(value);
  if (!due) return value;
  return due.toLocaleDateString(currentLanguage(), {
    day: "numeric",
    month: "short",
    ...(due.getFullYear() === new Date().getFullYear() ? {} : { year: "2-digit" as const }),
  });
}

function applyTaskDueTint(card: HTMLElement, dueDate: string): void {
  const urgency = taskDueUrgency(dueDate);
  const surface = Math.round(urgency * 10);
  const text = Math.round(urgency * 22);
  const border = Math.round(35 + urgency * 55);
  card.classList.add("has-due");
  card.style.setProperty("--due-surface", `${surface}%`);
  card.style.setProperty("--due-surface-rest", `${100 - surface}%`);
  card.style.setProperty("--due-text", `${text}%`);
  card.style.setProperty("--due-text-rest", `${100 - text}%`);
  card.style.setProperty("--due-border", `${border}%`);
  card.style.setProperty("--due-border-rest", `${100 - border}%`);
}

interface TaskDueDateTarget {
  pageTitle: string;
  blockId: string;
  dueDate?: string;
}

function taskDueDateInputValue(value?: string): string {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";
}

async function promptTaskDueDate(target: TaskDueDateTarget): Promise<void> {
  const value = await showTextDialog(
    translate("Fecha de vencimiento"),
    translate("Fecha"),
    taskDueDateInputValue(target.dueDate),
    {
      inputType: "date",
      allowEmpty: true,
      message: translate("Déjalo vacío para quitar la fecha."),
    }
  );
  if (value === null) return;
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    showToast(translate("Fecha no válida"));
    return;
  }
  saveTaskDueDate(target, value || null);
}

function saveTaskDueDate(target: TaskDueDateTarget, value: string | null): void {
  const page = vault.getPageByTitle(target.pageTitle);
  if (!page) {
    showToast(translate("No se encontró la nota de la tarea."));
    return;
  }
  const location = findNodeLocation(page.blocks, target.blockId);
  if (!location) {
    showToast(translate("No se encontró la tarea."));
    return;
  }
  const node = location.parentList[location.index];
  const { text, properties } = splitBlockProperties(node.content);
  const retained = properties.filter((property) => !/^task-due::/i.test(property.trim()));
  if (value) retained.push(`task-due:: ${value}`);
  node.content = `${text}${retained.length ? `\n${retained.join("\n")}` : ""}`;
  void vault.savePage(page).then(() => {
    if (currentPage.id === page.id && currentView === "editor") renderBlocksTree();
    if (currentView === "kanban") renderKanbanBoard();
    showToast(translate(value ? "Fecha de vencimiento actualizada." : "Fecha de vencimiento eliminada."));
  }).catch((error: unknown) => {
    console.error("No se pudo guardar la fecha de vencimiento:", error);
    showToast(translate("No se pudo guardar la fecha de vencimiento."));
  });
}

type KanbanVirtualLists = Record<KanbanStatus, VirtualList<KanbanTask>>;
let kanbanVirtualLists: KanbanVirtualLists | null = null;

function getKanbanVirtualLists(): KanbanVirtualLists {
  if (kanbanVirtualLists) return kanbanVirtualLists;
  const create = (id: string): VirtualList<KanbanTask> => {
    const element = document.getElementById(id) as HTMLDivElement;
    return new VirtualList<KanbanTask>({
      scroller: element,
      host: element,
      renderItem: (task) => createKanbanCard(task),
      estimateHeight: 96,
      gap: 8,
      overscan: 400,
      keyFor: (task) => task.id,
    });
  };
  kanbanVirtualLists = {
    todo: create("kanban-todo-list"),
    doing: create("kanban-doing-list"),
    done: create("kanban-done-list"),
  };
  return kanbanVirtualLists;
}

function createKanbanCard(task: KanbanTask): HTMLElement {
  const card = document.createElement("div");
  card.className = `kanban-card kanban-card-${task.status}`;
  if (task.dueDate && task.status !== "done") applyTaskDueTint(card, task.dueDate);
  card.draggable = true;
  card.dataset.taskId = task.id;
  card.setAttribute("aria-grabbed", "false");
  card.addEventListener("dragstart", (event) => {
    draggedKanbanTask = task;
    card.classList.add("is-dragging");
    card.setAttribute("aria-grabbed", "true");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", task.id);
    }
  });
  card.addEventListener("dragend", () => {
    draggedKanbanTask = null;
    card.classList.remove("is-dragging");
    card.setAttribute("aria-grabbed", "false");
    document.querySelectorAll(".kanban-column.drop-target").forEach((column) => {
      column.classList.remove("drop-target");
    });
  });

  const text = document.createElement("div");
  text.className = "kanban-card-text markdown-rendered";
  text.innerHTML = renderMarkdownToHtml(task.text);

  const footer = document.createElement("div");
  footer.className = "kanban-card-footer";

  const pill = document.createElement("span");
  pill.className = "kanban-source-pill";
  pill.innerText = `📄 ${task.pageTitle}`;
  pill.addEventListener("click", () => {
    loadPage(task.pageTitle);
  });

  footer.appendChild(pill);

  const dueButton = document.createElement("button");
  dueButton.type = "button";
  dueButton.className = "kanban-due-badge";
  dueButton.addEventListener("click", (event) => {
    event.stopPropagation();
    void promptTaskDueDate(task);
  });
  if (task.dueDate) {
    const dueLabel = formatTaskDueDate(task.dueDate);
    const editLabel = translate("Editar fecha de vencimiento");
    dueButton.innerText = `📅 ${dueLabel}`;
    dueButton.title = `${editLabel}: ${dueLabel}`;
    dueButton.setAttribute("aria-label", `${editLabel}: ${dueLabel}`);
    if (task.status === "done") {
      dueButton.classList.add("is-done");
    } else {
      const urgency = taskDueUrgency(task.dueDate);
      const textMix = Math.round(45 + urgency * 45);
      const surfaceMix = Math.round(7 + urgency * 9);
      dueButton.style.setProperty("--due-badge-text", `${textMix}%`);
      dueButton.style.setProperty("--due-badge-text-rest", `${100 - textMix}%`);
      dueButton.style.setProperty("--due-badge-surface", `${surfaceMix}%`);
      dueButton.style.setProperty("--due-badge-surface-rest", `${100 - surfaceMix}%`);
    }
  } else {
    const assignLabel = translate("Asignar fecha de vencimiento");
    dueButton.classList.add("is-empty");
    dueButton.innerText = "📅";
    dueButton.title = assignLabel;
    dueButton.setAttribute("aria-label", assignLabel);
  }
  footer.appendChild(dueButton);

  if (task.status === "doing" && task.doingStartedAt) {
    const elapsed = Math.floor((Date.now() - Date.parse(task.doingStartedAt)) / 1000);
    const durationText = formatDuration(elapsed);
    const durationBadge = document.createElement("span");
    durationBadge.className = "kanban-duration-badge";
    durationBadge.innerText = `⏱️ ${durationText}`;
    footer.appendChild(durationBadge);
  } else if (task.status === "done" && task.doingDurationSeconds) {
    const durationText = formatDuration(task.doingDurationSeconds);
    const durationBadge = document.createElement("span");
    durationBadge.className = "kanban-duration-badge";
    durationBadge.innerText = `✅ ${durationText}`;
    footer.appendChild(durationBadge);
  }

  card.appendChild(text);
  card.appendChild(footer);
  return card;
}

function renderKanbanBoard() {
  const countTodo = document.getElementById("count-todo") as HTMLSpanElement;
  const countDoing = document.getElementById("count-doing") as HTMLSpanElement;
  const countDone = document.getElementById("count-done") as HTMLSpanElement;
  const totalCount = document.getElementById("kanban-total-count") as HTMLSpanElement;

  const allTasks = kanbanManager.scanTasks(vault.getPages(), vault.getMutationVersion());
  totalCount.innerText = `${allTasks.length} tareas activas`;

  const todoTasks = kanbanManager.getTasksByStatus("todo");
  const doingTasks = kanbanManager.getTasksByStatus("doing");
  const doneTasks = kanbanManager.getTasksByStatus("done");

  countTodo.innerText = todoTasks.length.toString();
  countDoing.innerText = doingTasks.length.toString();
  countDone.innerText = doneTasks.length.toString();

  const lists = getKanbanVirtualLists();
  lists.todo.setItems(todoTasks);
  lists.doing.setItems(doingTasks);
  lists.done.setItems(kanbanHideCompleted.checked ? [] : doneTasks);
}

function updateTaskState(task: KanbanTask, newStatus: KanbanStatus) {
  if (task.status === newStatus) return;
  const formatted = KanbanManager.formatBlockWithStatus(task.content, newStatus);
  const newContent = applyTaskCompletionReward(task.content, formatted);
  vault.updateBlockContent(task.pageTitle, task.blockId, newContent);
  renderKanbanBoard();
}

/* ==================== BLOCK CONTEXT MENU ==================== */
function closeContextSubmenu(submenu: HTMLElement): void {
  submenu.classList.remove("is-open");
  submenu.querySelector<HTMLElement>(".context-submenu-trigger")?.setAttribute("aria-expanded", "false");
  const panel = submenu.querySelector<HTMLElement>(".context-submenu-panel");
  if (panel) panel.style.top = "";
}

function closeAllContextSubmenus(menu?: HTMLElement): void {
  const root = menu ?? document;
  root.querySelectorAll<HTMLElement>(".context-submenu.is-open").forEach(closeContextSubmenu);
}

function positionContextSubmenu(submenu: HTMLElement): void {
  const menu = submenu.closest<HTMLElement>(".custom-context-menu");
  const panel = submenu.querySelector<HTMLElement>(".context-submenu-panel");
  if (!menu || !panel) return;

  panel.style.top = "-6px";
  const menuRect = menu.getBoundingClientRect();
  const submenuRect = submenu.getBoundingClientRect();
  const panelWidth = panel.offsetWidth;
  const spaceRight = window.innerWidth - menuRect.right;
  const spaceLeft = menuRect.left;
  menu.classList.toggle("submenus-left", spaceRight < panelWidth + 12 && spaceLeft > spaceRight);

  const panelHeight = panel.offsetHeight;
  const minTop = 8 - submenuRect.top;
  const maxTop = window.innerHeight - 8 - panelHeight - submenuRect.top;
  let top = -6;
  if (top > maxTop) top = maxTop;
  if (top < minTop) top = minTop;
  panel.style.top = `${top}px`;
}

function openContextSubmenu(submenu: HTMLElement): void {
  const menu = submenu.closest<HTMLElement>(".custom-context-menu");
  menu?.querySelectorAll<HTMLElement>(".context-submenu.is-open").forEach((other) => {
    if (other !== submenu) closeContextSubmenu(other);
  });
  submenu.classList.add("is-open");
  submenu.querySelector<HTMLElement>(".context-submenu-trigger")?.setAttribute("aria-expanded", "true");
  positionContextSubmenu(submenu);
}

function initializeContextSubmenus(menu: HTMLElement): void {
  menu.querySelectorAll<HTMLElement>(".context-submenu").forEach((submenu) => {
    const trigger = submenu.querySelector<HTMLButtonElement>(".context-submenu-trigger");
    if (!trigger) return;
    let closeTimer: number | null = null;

    const cancelClose = () => {
      if (closeTimer !== null) {
        window.clearTimeout(closeTimer);
        closeTimer = null;
      }
    };
    const scheduleClose = () => {
      cancelClose();
      closeTimer = window.setTimeout(() => {
        closeTimer = null;
        closeContextSubmenu(submenu);
      }, 160);
    };

    submenu.addEventListener("mouseenter", () => {
      cancelClose();
      openContextSubmenu(submenu);
    });
    submenu.addEventListener("mouseleave", (event) => {
      if (event.relatedTarget instanceof Node && submenu.contains(event.relatedTarget)) return;
      scheduleClose();
    });
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      cancelClose();
      openContextSubmenu(submenu);
      trigger.focus({ preventScroll: true });
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openContextSubmenu(submenu);
        submenu.querySelector<HTMLElement>(".context-submenu-panel .menu-item")?.focus();
      } else if (event.key === "ArrowLeft" || event.key === "Escape") {
        event.preventDefault();
        closeContextSubmenu(submenu);
        trigger.focus();
      }
    });
    submenu.querySelector<HTMLElement>(".context-submenu-panel")?.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "Escape") return;
      event.preventDefault();
      closeContextSubmenu(submenu);
      trigger.focus();
    });
    submenu.addEventListener("focusin", () => {
      cancelClose();
      openContextSubmenu(submenu);
    });
    submenu.addEventListener("focusout", (event) => {
      if (event.relatedTarget instanceof Node && submenu.contains(event.relatedTarget)) return;
      scheduleClose();
    });
  });
}

function positionContextMenu(menu: HTMLElement, x: number, y: number): void {
  const menuWidth = menu.offsetWidth;
  const menuHeight = menu.offsetHeight;
  const clampedX = Math.max(10, Math.min(x, window.innerWidth - menuWidth - 10));
  const clampedY = Math.max(10, Math.min(y, window.innerHeight - menuHeight - 10));
  menu.style.left = `${clampedX}px`;
  menu.style.top = `${clampedY}px`;
}

function getTableContextMenu(): HTMLDivElement {
  if (tableContextMenu) return tableContextMenu;
  tableContextMenu = document.createElement("div");
  tableContextMenu.className = "custom-context-menu table-context-menu";
  tableContextMenu.innerHTML = `
    <div class="menu-item" data-action="add-row-above">
      <span>Añadir fila arriba</span>
    </div>
    <div class="menu-item" data-action="add-row-below">
      <span>Añadir fila abajo</span>
    </div>
    <div class="menu-item" data-action="delete-row">
      <span>Eliminar fila</span>
    </div>
    <div class="menu-divider"></div>
    <div class="menu-item" data-action="add-col-left">
      <span>Añadir columna izquierda</span>
    </div>
    <div class="menu-item" data-action="add-col-right">
      <span>Añadir columna derecha</span>
    </div>
    <div class="menu-item" data-action="delete-col">
      <span>Eliminar columna</span>
    </div>
    <div class="menu-divider"></div>
    <div class="menu-item" data-action="move-row-up">
      <span>Mover fila arriba</span>
    </div>
    <div class="menu-item" data-action="move-row-down">
      <span>Mover fila abajo</span>
    </div>
    <div class="menu-item" data-action="move-col-left">
      <span>Mover columna izquierda</span>
    </div>
    <div class="menu-item" data-action="move-col-right">
      <span>Mover columna derecha</span>
    </div>
  `;
  document.body.appendChild(tableContextMenu);
  
  tableContextMenu.querySelectorAll<HTMLDivElement>(".menu-item").forEach(item => {
    item.addEventListener("click", () => {
      const action = item.dataset.action;
      if (action && tableContextMenuState) {
        handleTableAction(action, tableContextMenuState);
      }
      hideAllContextMenus();
    });
  });
  
  return tableContextMenu;
}

function showTableContextMenu(table: HTMLTableElement, cell: HTMLTableCellElement, x: number, y: number) {
  const menu = getTableContextMenu();
  cell.focus();
  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tr"));
  const rowIndex = cell.parentElement ? rows.indexOf(cell.parentElement as HTMLTableRowElement) : 0;
  const colIndex = parseInt(cell.dataset.colIndex || "0");
  tableContextMenuState = { table, targetCell: cell, rowIndex, colIndex };
  
  runModalBoundary("el menú contextual de tabla", hideAllContextMenus, () => {
    closeDisplayMenu(contextMenu);
    closeDisplayMenu(bulletContextMenu);
    closeDisplayMenu(sidebarContextMenu);
    closeDisplayMenu(navigationContextMenu);
    openDisplayMenu(menu, "block");
    positionContextMenu(menu, x, y);
  });
}

function handleTableAction(action: string, state: { table: HTMLTableElement; rowIndex: number; colIndex: number }) {
  const { table } = state;
  const editor = table.closest<HTMLElement>(".block-editor");
  if (!editor) return;

  // Las acciones sobre filas/columnas se aplican al Markdown para mantener una
  // única fuente de verdad (y para que las alineaciones no se pierdan).
  applyTableEditToBlockTable(table, action as TableEditAction);
}

function moveTableRow(table: HTMLTableElement, fromIndex: number, toIndex: number) {
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>("tr"));
  const fromRow = rows[fromIndex - 1];
  const toRow = rows[toIndex - 1];
  if (!fromRow || !toRow || fromRow === toRow) return;

  if (toIndex < fromIndex) {
    tbody.insertBefore(fromRow, toRow);
  } else {
    tbody.insertBefore(fromRow, toRow.nextSibling);
  }

  updateTableRowIndices(table);
}

function moveTableColumn(table: HTMLTableElement, fromIndex: number, toIndex: number) {
  const allRows = Array.from(table.querySelectorAll("tr"));
  
  allRows.forEach(row => {
    const cells = Array.from(row.querySelectorAll("th, td"));
    if (fromIndex >= cells.length || toIndex >= cells.length) return;
    
    const cell = cells[fromIndex];
    if (toIndex < fromIndex) {
      row.insertBefore(cell, cells[toIndex]);
    } else {
      row.insertBefore(cell, cells[toIndex + 1]);
    }
  });
  
  updateTableColIndices(table);
}

function updateTableRowIndices(table: HTMLTableElement) {
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  
  if (thead) {
    const headerRow = thead.querySelector("tr");
    if (headerRow) headerRow.dataset.rowIndex = "0";
  }
  
  if (tbody) {
    Array.from(tbody.querySelectorAll("tr")).forEach((row, index) => {
      row.dataset.rowIndex = String(index + 1);
    });
  }
}

function updateTableColIndices(table: HTMLTableElement) {
  const allRows = Array.from(table.querySelectorAll("tr"));
  
  allRows.forEach(row => {
    const cells = Array.from(row.querySelectorAll<HTMLElement>("th, td"));
    cells.forEach((cell, index) => {
      cell.dataset.colIndex = String(index);
    });
  });
}

function saveTableChanges(editor: HTMLElement) {
  const blockItem = editor.closest<HTMLElement>(".block-item");
  if (!blockItem) return;
  
  const blockId = blockItem.dataset.id;
  if (!blockId) return;

  const page = findPageForBlock(blockId);
  if (!page) return;
  const location = findNodeLocation(page.blocks, blockId);
  if (!location) return;
  
  const content = serializeEditorContent(editor);
  setVisibleBlockContent(location.parentList[location.index], content);
  
  void vault.savePage(page);
}

function showBlockContextMenu(x: number, y: number) {
  runModalBoundary("el menú contextual", hideAllContextMenus, () => {
    closeDisplayMenu(bulletContextMenu);
    closeDisplayMenu(sidebarContextMenu);
    closeDisplayMenu(navigationContextMenu);
    if (tableContextMenu) closeDisplayMenu(tableContextMenu);
    contextMenu.classList.remove("submenus-left");
    closeAllContextSubmenus(contextMenu);
    contextTextSelection.hidden = getSelectedContextText() === null;
    contextImageOcclusion.hidden = contextImageSource === null;
    const title = contextMenu.querySelector<HTMLElement>(".context-menu-title");
    if (title) title.textContent = translate(contextImageSource === null ? "Texto" : "Imagen");
    openDisplayMenu(contextMenu, "flex");
    positionContextMenu(contextMenu, x, y);
  });
}

function showBulletContextMenu(x: number, y: number) {
  runModalBoundary("el menú contextual", hideAllContextMenus, () => {
    closeDisplayMenu(contextMenu);
    closeDisplayMenu(sidebarContextMenu);
    closeDisplayMenu(navigationContextMenu);
    if (tableContextMenu) closeDisplayMenu(tableContextMenu);
    bulletContextMenu.classList.remove("submenus-left");
    closeAllContextSubmenus(bulletContextMenu);
    contextTextSelection.hidden = true;
    contextImageOcclusion.hidden = true;
    contextSelectionRange = { start: 0, end: 0 };
    const hasMultipleBullets = selectedBulletIds.length > 1;
    const copyLabel = document.getElementById("ctx-copy-label");
    const cutLabel = document.getElementById("ctx-cut-label");
    const deleteLabel = document.getElementById("ctx-delete-label");
    if (copyLabel) copyLabel.textContent = translate(hasMultipleBullets ? "Copiar bullets seleccionados" : "Copiar bullet");
    if (cutLabel) cutLabel.textContent = translate(hasMultipleBullets ? "Cortar bullets seleccionados" : "Cortar bullet");
    if (deleteLabel) deleteLabel.textContent = translate(hasMultipleBullets ? "Borrar bullets seleccionados" : "Borrar bullet");
    const dueItem = document.getElementById("ctx-due-date");
    const dueValue = document.getElementById("ctx-due-date-value");
    if (dueItem) {
      const location = contextTargetBlockId
        ? findNodeLocation(getContextPage().blocks, contextTargetBlockId)
        : null;
      const content = location ? location.parentList[location.index].content : "";
      const dueDate = location ? KanbanManager.parseTaskDueDate(content) : undefined;
      const isTask = /^(?:TODO|LATER|DOING|NOW|DONE)\s+/i.test(
        splitBlockProperties(content).text.trimStart()
      );
      dueItem.hidden = !isTask && !dueDate;
      if (dueValue) {
        dueValue.textContent = dueDate ? formatTaskDueDate(dueDate) : "";
        dueValue.hidden = !dueDate;
      }
    }
    openDisplayMenu(bulletContextMenu, "flex");
    positionContextMenu(bulletContextMenu, x, y);
  });
}

function showSidebarContextMenu(x: number, y: number, pageId: string, pageTitle: string) {
  runModalBoundary("el menú contextual", hideAllContextMenus, () => {
    hideAllContextMenus();
    sidebarContextPageId = pageId;
    sidebarContextPageTitle = pageTitle;

    // Etiqueta dinámica de fijar/desfijar según el estado actual de la página.
    const page = vault.getPages().find((item) => item.id === pageId);
    const pinLabel = document.getElementById("sctx-pin-label");
    if (pinLabel) {
      pinLabel.textContent = translate(page?.pinned ? "Desfijar nota" : "Fijar nota");
    }

    // Abrir con la app del sistema solo en la aplicación de escritorio. Se usa
    // display en vez de `hidden`: el CSS de .menu-item puede anularlo.
    const openSystemItem = document.getElementById("sctx-open-system");
    if (openSystemItem) openSystemItem.style.display = isTauri() ? "" : "none";

    openDisplayMenu(sidebarContextMenu, "flex");
    // Medir el menú ya visible para el anclaje; las constantes quedan como
    // respaldo si la medida no está disponible (display 0).
    const menuWidth = sidebarContextMenu.offsetWidth > 0 ? sidebarContextMenu.offsetWidth : 200;
    const menuHeight = sidebarContextMenu.offsetHeight > 0 ? sidebarContextMenu.offsetHeight : 186;
    const clampedX = Math.min(x, window.innerWidth - menuWidth - 10);
    const clampedY = Math.min(y, window.innerHeight - menuHeight - 10);

    sidebarContextMenu.style.left = `${clampedX}px`;
    sidebarContextMenu.style.top = `${clampedY}px`;
  });
}

function hideAllContextMenus() {
  closeDisplayMenu(contextMenu);
  closeDisplayMenu(bulletContextMenu);
  closeDisplayMenu(sidebarContextMenu);
  closeDisplayMenu(navigationContextMenu);
  if (tableContextMenu) closeDisplayMenu(tableContextMenu);
  closeAllContextSubmenus();
  contextMenu.classList.remove("submenus-left");
  bulletContextMenu.classList.remove("submenus-left");
  contextTextSelection.hidden = true;
  contextTargetBlockId = null;
  contextTargetPage = null;
  contextImageSource = null;
  contextImageOcclusion.hidden = true;
  tableContextMenuState = null;
}

window.addEventListener("click", (e) => {
  if (
    !contextMenu.contains(e.target as Node) &&
    !bulletContextMenu.contains(e.target as Node) &&
    !sidebarContextMenu.contains(e.target as Node) &&
    !navigationContextMenu.contains(e.target as Node) &&
    !(tableContextMenu && tableContextMenu.contains(e.target as Node))
  ) {
    hideAllContextMenus();
  }
});

const closeMenuOnAction = (event: MouseEvent) => {
  if (
    event.target instanceof Element &&
    event.target.closest(".menu-item, .fmt-btn") &&
    !event.target.closest(".context-submenu-trigger")
  ) {
    hideAllContextMenus();
  }
};
contextMenu.addEventListener("click", closeMenuOnAction);
bulletContextMenu.addEventListener("click", closeMenuOnAction);
sidebarContextMenu.addEventListener("click", closeMenuOnAction);
navigationContextMenu.addEventListener("click", closeMenuOnAction);
initializeContextSubmenus(contextMenu);
initializeContextSubmenus(bulletContextMenu);

/* ==================== NAVIGATION CONTEXT MENU ====================
 * Replaces the webview's native context menu (Back/Forward/Reload/Inspect)
 * with an in-app menu that follows the active color theme. */
function showNavigationContextMenu(x: number, y: number) {
  runModalBoundary("el menú de navegación", hideAllContextMenus, () => {
    closeDisplayMenu(contextMenu);
    closeDisplayMenu(bulletContextMenu);
    closeDisplayMenu(sidebarContextMenu);
    if (tableContextMenu) closeDisplayMenu(tableContextMenu);
    openDisplayMenu(navigationContextMenu, "flex");
    positionContextMenu(navigationContextMenu, x, y);
  });
}

const graphCanvasEl = document.getElementById("graph-canvas");
document.addEventListener("contextmenu", (event) => {
  if (graphCanvasEl && graphCanvasEl.contains(event.target as Node)) { event.preventDefault(); return; }
  const target = event.target;
  const isFormField = target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    // Other editable zones (e.g. the page title) keep the native cut/copy/paste menu.
    // The block editor has its own handler that stops propagation before this listener.
    (target instanceof HTMLElement && target.isContentEditable && !target.closest(".block-editor"));
  if (isFormField) return;
  event.preventDefault();
  const x = event.clientX;
  const y = event.clientY;
  // An app menu handler already ran synchronously for this event and is open.
  // Menus are hidden by CSS (not inline), so computed style is required here.
  const anyAppMenuVisible = [
    contextMenu,
    bulletContextMenu,
    sidebarContextMenu,
    tableContextMenu,
  ].some(
    (menu) =>
      menu !== null &&
      !menu.classList.contains("is-menu-closing") &&
      getComputedStyle(menu).display !== "none"
  );
  if (anyAppMenuVisible) return;
  // Right-clicking while our navigation menu is open just repositions it.
  if (
    getComputedStyle(navigationContextMenu).display !== "none" &&
    !navigationContextMenu.classList.contains("is-menu-closing")
  ) {
    hideAllContextMenus();
  }
  showNavigationContextMenu(x, y);
});

document.getElementById("navctx-back")?.addEventListener("click", () => {
  if (navigationHistoryIndex > 0) restoreNavigationHistory(navigationHistoryIndex - 1);
  hideAllContextMenus();
});

document.getElementById("navctx-forward")?.addEventListener("click", () => {
  if (navigationHistoryIndex < navigationHistory.length - 1) {
    restoreNavigationHistory(navigationHistoryIndex + 1);
  }
  hideAllContextMenus();
});

document.getElementById("navctx-reload")?.addEventListener("click", () => {
  hideAllContextMenus();
  window.location.reload();
});

async function copyOrCutContextSelection(cut: boolean): Promise<void> {
  const blockId = contextTargetBlockId;
  const selectedText = getSelectedContextText();
  if (!blockId || selectedText === null) return;
  const page = getContextPage();

  try {
    await writeClipboardText(selectedText);
  } catch (error) {
    console.error("No se pudo copiar la selección al portapapeles:", error);
    showToast("No se pudo acceder al portapapeles.");
    hideAllContextMenus();
    return;
  }

  if (cut) {
    const location = findNodeLocation(page.blocks, blockId);
    if (location) {
      const block = location.parentList[location.index];
      const content = getVisibleBlockContent(block.content);
      const { start, end } = contextSelectionRange;
      setVisibleBlockContent(block, content.slice(0, start) + content.slice(end));
      await vault.savePage(page);
      renderBlocksTree();
    }
  }
  hideAllContextMenus();
}

function deleteContextSelection(): void {
  const blockId = contextTargetBlockId;
  if (!blockId || getSelectedContextText() === null) return;
  const page = getContextPage();
  const location = findNodeLocation(page.blocks, blockId);
  if (location) {
    const block = location.parentList[location.index];
    const content = getVisibleBlockContent(block.content);
    const { start, end } = contextSelectionRange;
    setVisibleBlockContent(block, content.slice(0, start) + content.slice(end));
    void vault.savePage(page);
    renderBlocksTree();
  }
  hideAllContextMenus();
}

document.getElementById("ctx-text-copy")?.addEventListener("click", () => {
  void copyOrCutContextSelection(false);
});
document.getElementById("ctx-text-cut")?.addEventListener("click", () => {
  void copyOrCutContextSelection(true);
});
document.getElementById("ctx-text-delete")?.addEventListener("click", deleteContextSelection);
ctxIndentBtn?.addEventListener("click", () => {
  if (!currentPage) return;
  const ids = selectedBulletIds.length ? selectedBulletIds : (contextTargetBlockId ? [contextTargetBlockId] : []);
  if (ids.length === 0) return;
  const previousTree = currentPage.blocks;
  const newTree = indentBlocks(previousTree, new Set(ids));
  if (!newTree) return;
  currentPage.blocks = newTree;
  documentHistory.capture(currentPage.id, previousTree, currentPage.title);
  vault.savePage(currentPage);
  renderBlocksTree();
  contextMenu.classList.remove("visible");
});
ctxOutdentBtn?.addEventListener("click", () => {
  if (!currentPage) return;
  const ids = selectedBulletIds.length ? selectedBulletIds : (contextTargetBlockId ? [contextTargetBlockId] : []);
  if (ids.length === 0) return;
  const previousTree = currentPage.blocks;
  const newTree = outdentBlocks(previousTree, new Set(ids));
  if (!newTree) return;
  currentPage.blocks = newTree;
  documentHistory.capture(currentPage.id, previousTree, currentPage.title);
  vault.savePage(currentPage);
  renderBlocksTree();
  contextMenu.classList.remove("visible");
});
document.getElementById("ctx-text-paste")?.addEventListener("click", () => {
  void pasteContextSelection(true);
});
document.getElementById("ctx-text-paste-plain")?.addEventListener("click", () => {
  void pasteContextSelection(false);
});

/**
 * Lee el portapapeles para el menú (fuera del evento paste no hay
 * clipboardData): primero se intenta la lectura rica de la Clipboard API
 * (con límite de tiempo; en algunos webviews no se concede) y como respaldo
 * el plugin oficial de Tauri o readText, ambos de solo texto.
 */
async function readClipboardForPaste(): Promise<{ text: string; html: string } | null> {
  try {
    const clipboard = navigator.clipboard;
    if (clipboard?.read) {
      const richRead = (async (): Promise<{ text: string; html: string } | null> => {
        const items = await clipboard.read();
        let text = "";
        let html = "";
        for (const item of items) {
          if (item.types.includes("text/plain")) {
            text = await (await item.getType("text/plain")).text();
          }
          if (item.types.includes("text/html")) {
            html = await (await item.getType("text/html")).text();
          }
        }
        return { text, html };
      })();
      const rich = await Promise.race([
        richRead.catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
      ]);
      if (rich && (rich.text || rich.html)) return rich;
    }
  } catch {
    // Sin permiso o API no disponible: sigue el respaldo de solo texto.
  }
  try {
    if (isTauri()) {
      const text = await readClipboardText();
      return { text, html: "" };
    }
    if (navigator.clipboard?.readText) {
      return { text: await navigator.clipboard.readText(), html: "" };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Pegado desde el menú contextual. Con formato: el HTML del portapapeles se
 * convierte con lista blanca a Markdown y las listas de bullets usan el
 * flujo de reconstrucción jerárquica del editor. Sin formato: solo el
 * text/plain crudo. En ambos casos el resultado vive en el modelo Markdown,
 * nunca HTML del portapapeles inyectado directo al DOM.
 */
async function pasteContextSelection(withFormat: boolean): Promise<void> {
  const blockId = contextTargetBlockId;
  hideAllContextMenus();
  if (!blockId) return;
  const page = getContextPage();
  const location = findNodeLocation(page.blocks, blockId);
  if (!location) return;
  const block = location.parentList[location.index];
  // En un bloque de imagen el pegado vive en su propio flujo auditado; aquí
  // el pegado de texto no debe tocar el contenido de imagen.
  if (block.type === "image") return;
  const content = getVisibleBlockContent(block.content);

  const clipboard = await readClipboardForPaste();
  const payload = clipboard ? (withFormat
    ? (clipboard.html ? sanitizePastedHtmlToMarkdown(clipboard.html) || clipboard.text : clipboard.text)
    : clipboard.text) : "";
  if (!payload.trim()) {
    if (!clipboard) showToast(translate("No se pudo acceder al portapapeles."));
    return;
  }

  if (withFormat && /^\s*(?:[-*+]|\d+\.)\s+/m.test(payload)) {
    await pasteBulletClipboard(blockId, payload, page);
    return;
  }

  const { start, end } = contextSelectionRange;
  const caret = Math.min(end, content.length);
  setVisibleBlockContent(block, content.slice(0, start) + payload + content.slice(caret));
  await vault.savePage(page);
  renderBlocksTree();
}

// Format toolbar in context menu
contextMenu.querySelectorAll<HTMLButtonElement>(".fmt-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!contextTargetBlockId) return;
    const page = getContextPage();
    const fmt = btn.dataset.fmt as "bold" | "italic" | "underline" | "strike" | "code";
    const loc = findNodeLocation(page.blocks, contextTargetBlockId);
    if (loc) {
      const node = loc.parentList[loc.index];
      setVisibleBlockContent(node, applyFormatting(
        getVisibleBlockContent(node.content),
        fmt,
        contextSelectionRange.start,
        contextSelectionRange.end
      ));
      vault.savePage(page);
      renderBlocksTree();
    }
    hideAllContextMenus();
  });
});

// Cloze Deletion Context Action
document.getElementById("ctx-cloze")?.addEventListener("click", () => {
  if (!contextTargetBlockId) return;
  const page = getContextPage();
  const loc = findNodeLocation(page.blocks, contextTargetBlockId);
  if (loc) {
    const node = loc.parentList[loc.index];
    const { start, end } = contextSelectionRange;
    const text = getVisibleBlockContent(node.content);
    if (end > start && end <= text.length) {
      const selected = text.slice(start, end);
      setVisibleBlockContent(node, text.slice(0, start) + `==${selected}==` + text.slice(end));
    } else {
      setVisibleBlockContent(node, `==${text}==`);
    }
    if (!getVisibleBlockContent(node.content).includes("#card")) {
      setVisibleBlockContent(node, `${getVisibleBlockContent(node.content)} #card`);
    }
    ensureBlockCreatedAt(node);
    vault.savePage(page);
    renderBlocksTree();
  }
  hideAllContextMenus();
});

// Convert to Flashcard
document.getElementById("ctx-flashcard")?.addEventListener("click", () => {
  if (!contextTargetBlockId) return;
  const page = getContextPage();
  const loc = findNodeLocation(page.blocks, contextTargetBlockId);
  if (loc) {
    const node = loc.parentList[loc.index];
    const text = getVisibleBlockContent(node.content);
    if (!/#card\b/i.test(text)) {
      setVisibleBlockContent(node, `${text} #card`);
    }
    ensureBlockCreatedAt(node);
    vault.savePage(page);
    renderBlocksTree();
  }
  hideAllContextMenus();
});

// Quita los marcadores de flashcard conservando el contenido del bullet.
document.getElementById("ctx-remove-flashcard")?.addEventListener("click", () => {
  if (
    selectedBulletIds.length > 1 &&
    contextTargetBlockId &&
    selectedBulletIds.includes(contextTargetBlockId)
  ) {
    deleteFlashcardsInSelection();
    hideAllContextMenus();
    return;
  }
  if (!contextTargetBlockId) return;
  const page = getContextPage();
  const loc = findNodeLocation(page.blocks, contextTargetBlockId);
  if (loc) {
    const node = loc.parentList[loc.index];
    const next = isFlashcardBlockContent(node.content)
      ? removeFlashcardMarkers(node.content)
      : node.content;
    if (next === node.content) {
      showToast("Este bullet no es una flashcard.");
    } else {
      node.content = next;
      void vault.savePage(page);
      renderBlocksTree();
      showToast("Flashcard eliminada; el contenido se conservó.");
    }
  }
  hideAllContextMenus();
});

// Toggle Task
document.getElementById("ctx-task")?.addEventListener("click", () => {
  if (!contextTargetBlockId) return;
  const page = getContextPage();
  const loc = findNodeLocation(page.blocks, contextTargetBlockId);
  if (loc) {
    const node = loc.parentList[loc.index];
    node.content = applyTaskCompletionReward(node.content, toggleTaskStatus(node.content));
    vault.savePage(page);
    renderBlocksTree();
  }
  hideAllContextMenus();
});

// Task due date
document.getElementById("ctx-due-date")?.addEventListener("click", () => {
  const blockId = contextTargetBlockId;
  if (!blockId) return;
  const page = getContextPage();
  const location = findNodeLocation(page.blocks, blockId);
  if (!location) return;
  const dueDate = KanbanManager.parseTaskDueDate(location.parentList[location.index].content);
  const pageTitle = page.title;
  hideAllContextMenus();
  void promptTaskDueDate({ pageTitle, blockId, dueDate });
});

contextMenu.querySelectorAll<HTMLButtonElement>("[data-heading]").forEach((button) => {
  button.addEventListener("click", () => {
    const level = Number(button.dataset.heading);
    if (contextTargetBlockId && level >= 1 && level <= 6) applyHeading(contextTargetBlockId, level);
  });
});

contextMenu.querySelectorAll<HTMLButtonElement>(".context-color-swatch[data-color]").forEach((button) => {
  button.addEventListener("click", () => {
    const color = button.dataset.color;
    const mode = contextMenu.querySelector<HTMLInputElement>('input[name="context-color-mode"]:checked')?.value;
    if (contextTargetBlockId && color && (mode === "text" || mode === "background")) {
      applyBlockColor(contextTargetBlockId, color, mode);
    }
  });
});

document.getElementById("ctx-clear-color")?.addEventListener("click", () => {
  if (!contextTargetBlockId) return;
  const page = getContextPage();
  setBlockProperty(contextTargetBlockId, "color", null, page);
  setBlockProperty(contextTargetBlockId, "background-color", null, page);
  void vault.savePage(page);
  renderBlocksTree();
  hideAllContextMenus();
});

// Clear inline formatting (bold, italic, underline, strike, code, cloze)
document.getElementById("ctx-clear-format")?.addEventListener("click", () => {
  if (!contextTargetBlockId) return;
  const page = getContextPage();
  const targets = selectedBulletIds.length > 1 && selectedBulletIds.includes(contextTargetBlockId)
    ? selectedBulletIds
    : [contextTargetBlockId];
  targets.forEach((targetId) => {
    const loc = findNodeLocation(page.blocks, targetId);
    if (!loc) return;
    const node = loc.parentList[loc.index];
    const isMulti = targets.length > 1;
    const range = isMulti ? { start: 0, end: 0 } : contextSelectionRange;
    setVisibleBlockContent(node, clearFormatting(
      getVisibleBlockContent(node.content),
      range.start,
      range.end
    ));
  });
  vault.savePage(page);
  renderBlocksTree();
  hideAllContextMenus();
});

// Move Up
document.getElementById("ctx-move-up")?.addEventListener("click", () => {
  if (!contextTargetBlockId) return;
  const page = getContextPage();
  const updated = moveBlockUp(page.blocks, contextTargetBlockId);
  if (updated) {
    page.blocks = updated;
    vault.savePage(page);
    renderBlocksTree();
  }
  hideAllContextMenus();
});

// Move Down
document.getElementById("ctx-move-down")?.addEventListener("click", () => {
  if (!contextTargetBlockId) return;
  const page = getContextPage();
  const updated = moveBlockDown(page.blocks, contextTargetBlockId);
  if (updated) {
    page.blocks = updated;
    vault.savePage(page);
    renderBlocksTree();
  }
  hideAllContextMenus();
});

async function copyOrCutContextTarget(cut: boolean): Promise<void> {
  const blockId = contextTargetBlockId;
  if (!blockId) return;
  const page = getContextPage();
  if (selectedBulletIds.length > 1) {
    try {
      const roots = getSelectedBlockRoots(page.blocks, new Set(selectedBulletIds));
      const markdown = roots.map((root) => serializeBlockSubtree(root)).join("\n");
      await writeClipboardText(markdown);
      if (cut) await deleteSelectedBullets(page);
      else showToast("Bullets seleccionados copiados.");
    } catch (error) {
      console.error("No se pudieron copiar los bullets seleccionados:", error);
      showToast("No se pudieron copiar los bullets seleccionados.");
    }
    hideAllContextMenus();
    return;
  }
  const location = findNodeLocation(page.blocks, blockId);
  if (!location) {
    hideAllContextMenus();
    return;
  }
  const block = location.parentList[location.index];

  try {
    await writeClipboardText(serializeBlockSubtree(block));
  } catch (error) {
    console.error("No se pudo copiar el contenido al portapapeles:", error);
    showToast("No se pudo acceder al portapapeles.");
    hideAllContextMenus();
    return;
  }

  if (cut) {
    page.blocks = removeBlock(page.blocks, blockId);
    void vault.savePage(page);
    renderBlocksTree();
  }
  hideAllContextMenus();
}

document.getElementById("ctx-copy")?.addEventListener("click", () => {
  void copyOrCutContextTarget(false);
});
document.getElementById("ctx-cut")?.addEventListener("click", () => {
  void copyOrCutContextTarget(true);
});

document.getElementById("ctx-delete")?.addEventListener("click", () => {
  const page = getContextPage();
  if (selectedBulletIds.length > 1) {
    void deleteSelectedBullets(page);
    hideAllContextMenus();
    return;
  }
  if (!contextTargetBlockId) return;
  const location = findNodeLocation(page.blocks, contextTargetBlockId);
  if (!location) {
    hideAllContextMenus();
    return;
  }
  page.blocks = removeBlock(page.blocks, contextTargetBlockId);
  vault.savePage(page);
  renderBlocksTree();
  hideAllContextMenus();
});

function renderImageOcclusionEditor(): void {
  imageOcclusionLayer.replaceChildren();
  appendOcclusionMasks(imageOcclusionLayer, imageOcclusionRegions);
  if (imageOcclusionDraft) {
    appendOcclusionMasks(imageOcclusionLayer, [imageOcclusionDraft]);
  }


  imageOcclusionRegions.forEach((region, index) => {
    const selection = document.createElement("div");
    selection.className = `image-occlusion-selection${selectedImageOcclusionIndex === index ? " selected" : ""}`;
    selection.dataset.occlusionIndex = String(index);
    selection.style.left = `${region.x * 100}%`;
    selection.style.top = `${region.y * 100}%`;
    selection.style.width = `${region.width * 100}%`;
    selection.style.height = `${region.height * 100}%`;
    selection.style.transform = `rotate(${region.rotation || 0}deg)`;
    selection.setAttribute("aria-label", `${translate("Área")} ${index + 1}`);

    if (selectedImageOcclusionIndex === index) {
      ["n", "ne", "e", "se", "s", "sw", "w", "nw"].forEach((edge) => {
        const handle = document.createElement("span");
        handle.className = `image-occlusion-resize-handle handle-${edge}`;
        handle.dataset.occlusionIndex = String(index);
        handle.dataset.occlusionHandle = edge;
        handle.setAttribute("aria-hidden", "true");
        selection.appendChild(handle);
      });
    }
    imageOcclusionLayer.appendChild(selection);
  });

  const selectedRegion = selectedImageOcclusionIndex === null
    ? null
    : imageOcclusionRegions[selectedImageOcclusionIndex] || null;
  const selectedHint = selectedRegion?.hint || "";
  if (imageOcclusionHintInput.value !== selectedHint) imageOcclusionHintInput.value = selectedHint;
  imageOcclusionHintInput.disabled = !selectedRegion;
  const selectedColor = selectedRegion?.color || imageOcclusionColorInput.value || "#4ade80";
  if (imageOcclusionColorInput.value !== selectedColor) imageOcclusionColorInput.value = selectedColor;
  document.querySelectorAll<HTMLButtonElement>(
    "#image-occlusion-scale-down, #image-occlusion-scale-up, #image-occlusion-rotate-left, #image-occlusion-rotate-right, " +
    "#image-occlusion-align-left, #image-occlusion-align-center, #image-occlusion-align-right, " +
    "#image-occlusion-align-top, #image-occlusion-align-middle, #image-occlusion-align-bottom"
  ).forEach((button) => {
    button.disabled = !selectedRegion;
  });
  document.querySelectorAll<HTMLButtonElement>(
    "#image-occlusion-distribute-horizontal, #image-occlusion-distribute-vertical"
  ).forEach((button) => {
    button.disabled = imageOcclusionRegions.length < 3;
  });
  imageOcclusionFinishPolygon.hidden = imageOcclusionShape !== "polygon" || imageOcclusionPolygonPoints.length < 3;

  imageOcclusionList.replaceChildren();
  if (imageOcclusionRegions.length === 0) {
    const empty = document.createElement("span");
    empty.className = "image-occlusion-empty";
    empty.innerText = "Todavía no hay áreas ocultas. Arrastra sobre la imagen para añadir una.";
    imageOcclusionList.appendChild(empty);
    return;
  }

  imageOcclusionRegions.forEach((_, index) => {
    const row = document.createElement("div");
    row.className = `image-occlusion-list-item${selectedImageOcclusionIndex === index ? " selected" : ""}`;
    row.dataset.regionIndex = String(index);
    const label = document.createElement("span");
    label.innerText = `Área ${index + 1}`;
    label.addEventListener("click", () => {
      selectedImageOcclusionIndex = index;
      renderImageOcclusionEditor();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn-icon";
    remove.title = `Eliminar área ${index + 1}`;
    remove.innerText = "×";
    row.append(label, remove);
    imageOcclusionList.appendChild(row);
  });
}

function openImageOcclusionEditor(blockId: string, source: string): void {
  const targetPage = findPageForBlock(blockId);
  const location = targetPage ? findNodeLocation(targetPage.blocks, blockId) : null;
  if (!location) {
    showToast("No se encontró el bloque de la imagen.");
    return;
  }
  runModalBoundary("el editor de oclusiones", closeImageOcclusionEditor, () => {
    const node = location.parentList[location.index];
    imageOcclusionTarget = { blockId, source };
    imageOcclusionRegions = parseImageOcclusions(node.content)
      .filter((region) => region.source === source)
      .map(cloneImageOcclusionRegion);
    imageOcclusionDraft = null;
    imageOcclusionPolygonPoints = [];
    imageOcclusionPointerAction = null;
    selectedImageOcclusionIndex = null;
    imageOcclusionShape = "rect";
    imageOcclusionShapeSelect.value = "rect";
    imageOcclusionHintInput.value = "";
    imageOcclusionImage.removeAttribute("src");
    imageOcclusionOverlay.classList.add("image-block-loading");
    mountOverlay(imageOcclusionOverlay);
    imageOcclusionImage.onload = () => {
      if (imageOcclusionTarget?.blockId === blockId && imageOcclusionTarget.source === source) {
        imageOcclusionOverlay.classList.remove("image-block-loading", "image-block-load-error");
        renderImageOcclusionEditor();
      }
    };
    imageOcclusionImage.onerror = () => {
      if (imageOcclusionTarget?.blockId === blockId && imageOcclusionTarget.source === source) {
        console.error(`No se pudo cargar la imagen para crear oclusiones: ${source}`);
        closeImageOcclusionEditor();
        showToast("No se pudo cargar la imagen. Se cerró el editor de oclusiones.");
      }
    };
    void resolveDisplayImageUrl(source).then((url) => {
      if (imageOcclusionTarget?.blockId !== blockId || imageOcclusionTarget.source !== source) return;
      imageOcclusionImage.src = url;
    }).catch((error: unknown) => {
      if (imageOcclusionTarget?.blockId !== blockId || imageOcclusionTarget.source !== source) return;
      console.error("No se pudo resolver la ruta de imagen para las oclusiones:", error);
      closeImageOcclusionEditor();
      showToast("No se pudo abrir la imagen. Se cerró el editor de oclusiones.");
    });
    renderImageOcclusionEditor();
  });
}

async function saveImageOcclusionEditor(): Promise<void> {
  if (!imageOcclusionTarget) return;
  const targetPage = findPageForBlock(imageOcclusionTarget.blockId);
  const location = targetPage ? findNodeLocation(targetPage.blocks, imageOcclusionTarget.blockId) : null;
  if (!targetPage || !location) {
    showToast("No se encontró el bloque donde guardar las oclusiones.");
    return;
  }

  const saveButton = document.getElementById("btn-save-image-occlusion") as HTMLButtonElement;
  const originalLabel = saveButton.innerText;
  saveButton.disabled = true;
  saveButton.innerText = "Guardando...";
  try {
    const node = location.parentList[location.index];
    saveBlockImageOcclusions(node, imageOcclusionTarget.source, imageOcclusionRegions);
    if (imageOcclusionRegions.length > 0) ensureBlockCreatedAt(node);
    await vault.savePage(targetPage, true);
    renderBlocksTree();
    startFlashcardsSession();
    showToast(`${imageOcclusionRegions.length} oclusión(es) guardada(s) en ${targetPage.title}.`);
    closeImageOcclusionEditor();
  } catch (error) {
    console.error("No se pudieron guardar las oclusiones:", error);
    showToast("No se pudieron guardar las oclusiones. Revisa los permisos de escritura del vault e inténtalo de nuevo.");
  } finally {
    saveButton.disabled = false;
    saveButton.innerText = originalLabel;
  }
}

function closeImageOcclusionEditor(): void {
  unmountOverlay(imageOcclusionOverlay);
  imageOcclusionTarget = null;
  imageOcclusionRegions = [];
  imageOcclusionDraft = null;
  imageOcclusionPointerAction = null;
  selectedImageOcclusionIndex = null;
  imageOcclusionImage.onload = null;
  imageOcclusionImage.onerror = null;
  imageOcclusionImage.removeAttribute("src");
  imageOcclusionOverlay.classList.remove("image-block-loading", "image-block-load-error");
}

function imagePoint(event: PointerEvent): { x: number; y: number } | null {
  const bounds = imageOcclusionImage.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return null;
  return {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
  };
}

function regionWithPolygonBounds(
  source: string,
  points: Array<{ x: number; y: number }>,
  color: string,
  hint: string
): ImageOcclusionRegion {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    source,
    x,
    y,
    width: Math.max(0.01, Math.max(...xs) - x),
    height: Math.max(0.01, Math.max(...ys) - y),
    shape: "polygon",
    points: points.map((point) => ({ ...point })),
    color,
    hint,
  };
}

function finishOcclusionPolygon(): void {
  if (imageOcclusionPolygonPoints.length < 3 || !imageOcclusionTarget) return;
  imageOcclusionRegions.push(regionWithPolygonBounds(
    imageOcclusionTarget.source,
    imageOcclusionPolygonPoints,
    imageOcclusionColorInput.value,
    ""
  ));
  selectedImageOcclusionIndex = imageOcclusionRegions.length - 1;
  imageOcclusionPolygonPoints = [];
  imageOcclusionDraft = null;
  renderImageOcclusionEditor();
}

function resizeOcclusionRegion(region: ImageOcclusionRegion, factor: number): ImageOcclusionRegion {
  const centerX = region.x + region.width / 2;
  const centerY = region.y + region.height / 2;
  const width = Math.min(1, region.width * factor);
  const height = Math.min(1, region.height * factor);
  const x = Math.max(0, Math.min(1 - width, centerX - width / 2));
  const y = Math.max(0, Math.min(1 - height, centerY - height / 2));
  const points = region.points?.map((point) => ({
    x: x + ((point.x - region.x) / region.width) * width,
    y: y + ((point.y - region.y) / region.height) * height,
  }));
  return { ...region, x, y, width, height, points };
}

function moveOcclusionRegion(
  region: ImageOcclusionRegion,
  nextX: number,
  nextY: number
): ImageOcclusionRegion {
  const x = Math.max(0, Math.min(1 - region.width, nextX));
  const y = Math.max(0, Math.min(1 - region.height, nextY));
  const dx = x - region.x;
  const dy = y - region.y;
  return {
    ...region,
    x,
    y,
    points: region.points?.map((point) => ({
      x: Math.max(0, Math.min(1, point.x + dx)),
      y: Math.max(0, Math.min(1, point.y + dy)),
    })),
  };
}

type ImageOcclusionAlignment = "left" | "center" | "right" | "top" | "middle" | "bottom";

function alignSelectedOcclusionRegion(alignment: ImageOcclusionAlignment): void {
  if (selectedImageOcclusionIndex === null) return;
  const region = imageOcclusionRegions[selectedImageOcclusionIndex];
  if (!region) return;
  let x = region.x;
  let y = region.y;
  if (alignment === "left") x = 0;
  else if (alignment === "center") x = (1 - region.width) / 2;
  else if (alignment === "right") x = 1 - region.width;
  else if (alignment === "top") y = 0;
  else if (alignment === "middle") y = (1 - region.height) / 2;
  else if (alignment === "bottom") y = 1 - region.height;
  imageOcclusionRegions[selectedImageOcclusionIndex] = moveOcclusionRegion(region, x, y);
  renderImageOcclusionEditor();
}

function distributeOcclusionRegions(axis: "horizontal" | "vertical"): void {
  if (imageOcclusionRegions.length < 3) {
    showToast("Añade al menos tres áreas para poder distribuirlas.");
    return;
  }

  const entries = imageOcclusionRegions
    .map((region, index) => ({ region, index }))
    .sort((left, right) => axis === "horizontal"
      ? left.region.x - right.region.x
      : left.region.y - right.region.y);
  const first = entries[0];
  const last = entries[entries.length - 1];
  const isHorizontal = axis === "horizontal";
  const start = isHorizontal ? first.region.x : first.region.y;
  const end = isHorizontal
    ? last.region.x + last.region.width
    : last.region.y + last.region.height;
  const totalSize = entries.reduce(
    (sum, entry) => sum + (isHorizontal ? entry.region.width : entry.region.height),
    0
  );
  const gap = (end - start - totalSize) / (entries.length - 1);
  const firstCenter = isHorizontal
    ? first.region.x + first.region.width / 2
    : first.region.y + first.region.height / 2;
  const lastCenter = isHorizontal
    ? last.region.x + last.region.width / 2
    : last.region.y + last.region.height / 2;
  const centerStep = (lastCenter - firstCenter) / (entries.length - 1);

  let cursor = start + (isHorizontal ? first.region.width : first.region.height) + gap;
  entries.forEach((entry, position) => {
    if (position === 0 || position === entries.length - 1) return;
    const size = isHorizontal ? entry.region.width : entry.region.height;
    const coordinate = gap >= 0
      ? cursor
      : firstCenter + centerStep * position - size / 2;
    imageOcclusionRegions[entry.index] = isHorizontal
      ? moveOcclusionRegion(entry.region, coordinate, entry.region.y)
      : moveOcclusionRegion(entry.region, entry.region.x, coordinate);
    cursor += size + Math.max(0, gap);
  });

  renderImageOcclusionEditor();
  showToast(`Áreas distribuidas ${isHorizontal ? "horizontalmente" : "verticalmente"}.`);
}

imageOcclusionShapeSelect.addEventListener("change", () => {
  const shape = imageOcclusionShapeSelect.value;
  if (shape !== "rect" && shape !== "ellipse" && shape !== "polygon") return;
  imageOcclusionShape = shape;
  imageOcclusionPolygonPoints = [];
  imageOcclusionDraft = null;
  renderImageOcclusionEditor();
});

imageOcclusionColorInput.addEventListener("input", () => {
  if (selectedImageOcclusionIndex === null) return;
  const region = imageOcclusionRegions[selectedImageOcclusionIndex];
  if (!region) return;
  region.color = imageOcclusionColorInput.value;
  renderImageOcclusionEditor();
});

imageOcclusionHintInput.addEventListener("input", () => {
  if (selectedImageOcclusionIndex === null) return;
  const region = imageOcclusionRegions[selectedImageOcclusionIndex];
  if (!region) return;
  region.hint = imageOcclusionHintInput.value;
  renderImageOcclusionEditor();
});

imageOcclusionScaleDown.addEventListener("click", () => {
  if (selectedImageOcclusionIndex === null) return;
  const region = imageOcclusionRegions[selectedImageOcclusionIndex];
  if (!region) return;
  imageOcclusionRegions[selectedImageOcclusionIndex] = resizeOcclusionRegion(region, 0.9);
  renderImageOcclusionEditor();
});
imageOcclusionScaleUp.addEventListener("click", () => {
  if (selectedImageOcclusionIndex === null) return;
  const region = imageOcclusionRegions[selectedImageOcclusionIndex];
  if (!region) return;
  imageOcclusionRegions[selectedImageOcclusionIndex] = resizeOcclusionRegion(region, 1.1);
  renderImageOcclusionEditor();
});
const imageOcclusionRotationButtons = [
  [imageOcclusionRotateLeft, -15],
  [imageOcclusionRotateRight, 15],
] as const;
imageOcclusionRotationButtons.forEach(([button, angle]) => {
  button.addEventListener("click", () => {
    if (selectedImageOcclusionIndex === null) return;
    const region = imageOcclusionRegions[selectedImageOcclusionIndex];
    if (!region) return;
    region.rotation = ((region.rotation || 0) + angle + 360) % 360;
    renderImageOcclusionEditor();
  });
});
const imageOcclusionAlignmentButtons = [
  [imageOcclusionAlignLeft, "left"],
  [imageOcclusionAlignCenter, "center"],
  [imageOcclusionAlignRight, "right"],
  [imageOcclusionAlignTop, "top"],
  [imageOcclusionAlignMiddle, "middle"],
  [imageOcclusionAlignBottom, "bottom"],
] as const satisfies ReadonlyArray<readonly [HTMLButtonElement, ImageOcclusionAlignment]>;
imageOcclusionAlignmentButtons.forEach(([button, alignment]) => {
  button.addEventListener("click", () => {
    alignSelectedOcclusionRegion(alignment);
  });
});
imageOcclusionDistributeHorizontal.addEventListener("click", () => {
  distributeOcclusionRegions("horizontal");
});
imageOcclusionDistributeVertical.addEventListener("click", () => {
  distributeOcclusionRegions("vertical");
});
imageOcclusionFinishPolygon.addEventListener("click", finishOcclusionPolygon);

imageOcclusionLayer.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || imageOcclusionLayer.clientWidth === 0 || imageOcclusionLayer.clientHeight === 0) return;
  event.preventDefault();
  const point = imagePoint(event);
  if (!point) return;

  const handle = event.target instanceof Element
    ? event.target.closest<HTMLElement>("[data-occlusion-handle]")
    : null;
  const selection = event.target instanceof Element
    ? event.target.closest<HTMLElement>(".image-occlusion-selection")
    : null;
  const target = handle || selection;
  const regionIndex = target ? Number(target.dataset.occlusionIndex) : Number.NaN;

  if (Number.isInteger(regionIndex) && imageOcclusionRegions[regionIndex]) {
    selectedImageOcclusionIndex = regionIndex;
    const originalRegion = { ...imageOcclusionRegions[regionIndex] };
    if (originalRegion.points) originalRegion.points = originalRegion.points.map((point) => ({ ...point }));
    imageOcclusionPointerAction = {
      pointerId: event.pointerId,
      mode: handle ? "resize" : "move",
      start: point,
      originalRegion,
      regionIndex,
      edge: handle?.dataset.occlusionHandle,
    };
    imageOcclusionLayer.setPointerCapture(event.pointerId);
    renderImageOcclusionEditor();
    return;
  }

  selectedImageOcclusionIndex = null;
  if (imageOcclusionShape === "polygon") {
    imageOcclusionPolygonPoints.push(point);
    imageOcclusionDraft = regionWithPolygonBounds(
      imageOcclusionTarget?.source || "",
      imageOcclusionPolygonPoints,
      imageOcclusionColorInput.value,
      ""
    );
    if (event.detail >= 2) finishOcclusionPolygon();
    else renderImageOcclusionEditor();
    return;
  }

  imageOcclusionPointerAction = { pointerId: event.pointerId, mode: "draw", start: point };
  imageOcclusionDraft = {
    source: imageOcclusionTarget?.source || "",
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
    shape: imageOcclusionShape,
    color: imageOcclusionColorInput.value,
    hint: "",
  };
  imageOcclusionLayer.setPointerCapture(event.pointerId);
  renderImageOcclusionEditor();
});

imageOcclusionLayer.addEventListener("pointermove", (event) => {
  const action = imageOcclusionPointerAction;
  if (!action || action.pointerId !== event.pointerId) return;
  const point = imagePoint(event);
  if (!point) return;

  if (action.mode === "draw") {
    imageOcclusionDraft = {
      source: imageOcclusionTarget?.source || "",
      x: Math.min(action.start.x, point.x),
      y: Math.min(action.start.y, point.y),
      width: Math.abs(point.x - action.start.x),
      height: Math.abs(point.y - action.start.y),
      shape: imageOcclusionShape,
      color: imageOcclusionColorInput.value,
      hint: "",
    };
  } else if (action.originalRegion && action.regionIndex !== undefined) {
    const original = action.originalRegion;
    if (action.mode === "move") {
      const x = Math.max(0, Math.min(1 - original.width, original.x + point.x - action.start.x));
      const y = Math.max(0, Math.min(1 - original.height, original.y + point.y - action.start.y));
      const dx = x - original.x;
      const dy = y - original.y;
      imageOcclusionRegions[action.regionIndex] = {
        ...original,
        x,
        y,
        points: original.points?.map((vertex) => ({
          x: Math.max(0, Math.min(1, vertex.x + dx)),
          y: Math.max(0, Math.min(1, vertex.y + dy)),
        })),
      };
    } else {
      const edge = action.edge || "";
      const left = edge.includes("w")
        ? Math.max(0, Math.min(original.x + original.width - 0.01, original.x + point.x - action.start.x))
        : original.x;
      const right = edge.includes("e")
        ? Math.min(1, Math.max(original.x + 0.01, original.x + original.width + point.x - action.start.x))
        : original.x + original.width;
      const top = edge.includes("n")
        ? Math.max(0, Math.min(original.y + original.height - 0.01, original.y + point.y - action.start.y))
        : original.y;
      const bottom = edge.includes("s")
        ? Math.min(1, Math.max(original.y + 0.01, original.y + original.height + point.y - action.start.y))
        : original.y + original.height;
      const resized = {
        ...original,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      };
      resized.points = original.points?.map((vertex) => ({
        x: left + ((vertex.x - original.x) / original.width) * resized.width,
        y: top + ((vertex.y - original.y) / original.height) * resized.height,
      }));
      imageOcclusionRegions[action.regionIndex] = resized;
    }
  }
  renderImageOcclusionEditor();
});

imageOcclusionLayer.addEventListener("pointerup", (event) => {
  const action = imageOcclusionPointerAction;
  if (!action || action.pointerId !== event.pointerId) return;
  if (action.mode === "draw" && imageOcclusionDraft) {
    const point = imagePoint(event);
    if (point) {
      const region: ImageOcclusionRegion = {
        ...imageOcclusionDraft,
        x: Math.min(action.start.x, point.x),
        y: Math.min(action.start.y, point.y),
        width: Math.abs(point.x - action.start.x),
        height: Math.abs(point.y - action.start.y),
      };
      if (region.width >= 0.01 && region.height >= 0.01) {
        imageOcclusionRegions.push(region);
        selectedImageOcclusionIndex = imageOcclusionRegions.length - 1;
      }
    }
  }
  imageOcclusionPointerAction = null;
  imageOcclusionDraft = null;
  renderImageOcclusionEditor();
});

imageOcclusionLayer.addEventListener("pointercancel", (event) => {
  if (imageOcclusionPointerAction?.pointerId !== event.pointerId) return;
  imageOcclusionPointerAction = null;
  imageOcclusionDraft = null;
  renderImageOcclusionEditor();
});

imageOcclusionLayer.addEventListener("lostpointercapture", (event) => {
  if (imageOcclusionPointerAction?.pointerId !== event.pointerId) return;
  imageOcclusionPointerAction = null;
  imageOcclusionDraft = null;
  renderImageOcclusionEditor();
});

document.getElementById("ctx-image-occlusion")?.addEventListener("click", () => {
  const targetBlockId = contextTargetBlockId;
  const source = contextImageSource;
  hideAllContextMenus();
  if (targetBlockId && source) openImageOcclusionEditor(targetBlockId, source);
});

imageOcclusionOverlay.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const closeButton = target.closest("#btn-close-image-occlusion, #btn-cancel-image-occlusion");
  if (closeButton) {
    event.preventDefault();
    event.stopPropagation();
    closeImageOcclusionEditor();
    return;
  }
  if (target.closest("#btn-save-image-occlusion")) {
    event.preventDefault();
    event.stopPropagation();
    void saveImageOcclusionEditor();
    return;
  }
  const removeButton = target.closest<HTMLButtonElement>(".image-occlusion-list-item button");
  if (removeButton) {
    event.preventDefault();
    event.stopPropagation();
    const index = Number(removeButton.closest<HTMLElement>(".image-occlusion-list-item")?.dataset.regionIndex);
    if (!Number.isInteger(index) || !imageOcclusionRegions[index] || imageOcclusionPointerAction) return;
    imageOcclusionRegions.splice(index, 1);
    if (selectedImageOcclusionIndex === index) selectedImageOcclusionIndex = null;
    else if (selectedImageOcclusionIndex !== null && selectedImageOcclusionIndex > index) {
      selectedImageOcclusionIndex -= 1;
    }
    renderImageOcclusionEditor();
    showToast("Área de oclusión eliminada.");
  }
});
imageOcclusionOverlay.addEventListener("click", (event) => {
  if (event.target === imageOcclusionOverlay) closeImageOcclusionEditor();
});

/* ==================== SIDEBAR CONTEXT MENU ACTIONS ==================== */
document.getElementById("sctx-open")?.addEventListener("click", () => {
  const page = vault.getPages().find((item) => item.id === sidebarContextPageId);
  if (page) openPage(page);
  hideAllContextMenus();
});

document.getElementById("sctx-open-system")?.addEventListener("click", async () => {
  // Capturar el id antes de cerrar el menú (hideAllContextMenus lo limpia).
  const pageId = sidebarContextPageId;
  hideAllContextMenus();
  if (!pageId) return;
  const page = vault.getPages().find((item) => item.id === pageId);
  if (!page) return;
  try {
    // Vuelcar primero los guardados pendientes: así la .md en disco contiene
    // la última edición cuando se abre fuera de la app.
    await vault.flushPendingSaves();
    await invoke("open_note_with_default_app", { filePath: page.path });
  } catch (error) {
    console.error("No se pudo abrir la nota con la aplicación predeterminada:", error);
    showToast(translate("No se pudo abrir la nota con la aplicación predeterminada."));
  }
});

document.getElementById("sctx-rename")?.addEventListener("click", async () => {
  if (!sidebarContextPageId || !sidebarContextPageTitle) return;
  const pageId = sidebarContextPageId;
  const oldTitle = sidebarContextPageTitle;
  hideAllContextMenus();
  const newName = await showTextDialog("Renombrar nota", "Nombre de la nota", oldTitle, {
    validate: (value) => validatePageTitle(value, pageId),
  });
  const newTitle = newName ? normalizeDeckTitle(newName) : "";
  if (newTitle && newTitle !== oldTitle) {
    const oldPath = vault.getPageByTitle(oldTitle)?.path;
    const renamed = vault.renamePage(pageId, newTitle);
    if (!renamed) {
      showToast("No se pudo renombrar la nota.");
      return;
    }
    renameFlashcardPageReferences(oldTitle, newTitle);
    const newPath = vault.getPageByTitle(newTitle)?.path;
    if (currentPage.id === pageId) {
      currentPage.title = newTitle;
      currentPage.path = newPath ?? currentPage.path;
      pageTitleHeading.innerText = newTitle;
      setHeadbarTitle(newTitle);
      lastValidPageTitle = newTitle;
    }
    // Si la nota estaba en Recientes, sustituir su ruta (por id o no).
    if (oldPath && newPath) replaceRecentPath(oldPath, newPath);
    renderSidebar();
    if (currentView === "all-pages") renderAllPagesView();
    showToast(`Página renombrada a "${newTitle}"`);
  }
});

document.getElementById("sctx-copy-link")?.addEventListener("click", () => {
  const pageTitle = sidebarContextPageTitle;
  if (pageTitle) {
    navigator.clipboard.writeText(`[[${pageTitle}]]`).then(() => {
      showToast(`¡Enlace [[${pageTitle}]] copiado al portapapeles!`);
    });
  }
  hideAllContextMenus();
});

document.getElementById("sctx-pin")?.addEventListener("click", async () => {
  if (!sidebarContextPageId || !sidebarContextPageTitle) return;
  const pageId = sidebarContextPageId;
  const pageTitle = sidebarContextPageTitle;
  hideAllContextMenus();
  const page = vault.getPages().find((item) => item.id === pageId);
  if (!page) return;
  page.pinned = !page.pinned;
  page.pinnedAt = page.pinned ? new Date().toISOString() : undefined;
  await vault.savePage(page);
  renderSidebar();
  if (currentView === "all-pages") renderAllPagesView();
  showToast(page.pinned ? `Página "${pageTitle}" fijada` : `Página "${pageTitle}" desfijada`);
});

document.getElementById("sctx-delete")?.addEventListener("click", async () => {
  if (!sidebarContextPageId || !sidebarContextPageTitle) return;
  const pageId = sidebarContextPageId;
  const pageTitle = sidebarContextPageTitle;
  const confirmed = await confirmAction(
    `¿Estás seguro de que deseas eliminar la página "${pageTitle}"?`,
    "Eliminar"
  );
  if (confirmed) {
    vault.deletePage(pageId);
    // La nota eliminada puede aportar flashcards: refrescar el selector de
    // notas y descartar selecciones que ya no existen.
    renderFlashcardPagesFilter(true);
    renderSidebar();
    if (currentView === "all-pages") renderAllPagesView();
    if (currentPage.id === pageId) {
      const remaining = vault.getPages();
      loadPage(remaining[0]?.title || "Bienvenido");
    }
    showToast(`Página "${pageTitle}" eliminada`);
  }
  hideAllContextMenus();
});

/* ==================== FLASHCARDS SESSION (FSRS-4.5) ==================== */
const cardProgressEl = document.getElementById("card-progress") as HTMLSpanElement;
const cardTypePill = document.getElementById("card-type-pill") as HTMLSpanElement;
const cardSourceEl = document.getElementById("card-source") as HTMLSpanElement;
const cardFsrsBadge = document.getElementById("card-fsrs-badge") as HTMLSpanElement;
const cardQuestionEl = document.getElementById("card-question") as HTMLDivElement;
const cardAnswerEl = document.getElementById("card-answer") as HTMLDivElement;
const cardParentContextEl = document.getElementById("card-parent-context") as HTMLDivElement | null;
const btnShowAnswer = document.getElementById("btn-show-answer") as HTMLButtonElement;

/**
 * En cloze la respuesta contiene el texto completo con los huecos resueltos.
 * Al revelarla se oculta la pregunta para no mostrar a la vez el hueco vacío y
 * el hueco resuelto. El resto de tipos conserva pregunta y respuesta visibles.
 */
function syncClozeRevealLayout(card: Flashcard | null, revealed: boolean): void {
  const clozeOnly = card?.cardType === "cloze" && revealed;
  cardQuestionEl.classList.toggle("cloze-hidden", clozeOnly);
  cardAnswerEl.classList.toggle("cloze-only", clozeOnly);
  // El anverso de las tarjetas básicas se muestra un 20 % más grande que el
  // reverso; las cloze mantienen el mismo tamaño en ambos lados.
  flashcardReviewPane.classList.toggle("is-basic", card?.cardType === "basic");
}
const fsrsActions = document.getElementById("fsrs-actions") as HTMLDivElement;
const flashcardReviewTab = document.getElementById("tab-flashcard-review") as HTMLButtonElement;
const flashcardExplorerTab = document.getElementById("tab-flashcard-explorer") as HTMLButtonElement;
const flashcardReviewPane = document.getElementById("flashcard-review-pane") as HTMLDivElement;
const flashcardExplorerPane = document.getElementById("flashcard-explorer-pane") as HTMLDivElement;
const flashcardExplorerList = document.getElementById("flashcard-explorer-list") as HTMLDivElement;
const flashcardExplorerCount = document.getElementById("flashcard-explorer-count") as HTMLSpanElement;
const flashcardExplorerSort = document.getElementById("flashcard-explorer-sort") as HTMLSelectElement;
const flashcardExplorerSearch = document.getElementById("flashcard-explorer-search") as HTMLInputElement;
const flashcardExplorerPagination = document.getElementById("flashcard-explorer-pagination") as HTMLDivElement;
const flashcardExplorerPrev = document.getElementById("flashcard-explorer-prev") as HTMLButtonElement;
const flashcardExplorerNext = document.getElementById("flashcard-explorer-next") as HTMLButtonElement;
const flashcardExplorerPageInfo = document.getElementById("flashcard-explorer-page-info") as HTMLSpanElement;
let flashcardExplorerActive = false;
type FlashcardExplorerSort = "due-date" | "last-reviewed" | "created-at";
const FLASHCARD_EXPLORER_PAGE_SIZE = 50;
const FLASHCARD_EXPLORER_SORT_STORAGE_KEY = "sinnotas-flashcard-explorer-sort";
let flashcardExplorerSearchText = "";
let flashcardExplorerPage = 1;
let flashcardExplorerSearchTimer: number | null = null;
let flashcardExplorerProgressRenderTimer: number | null = null;
// Clave propia: antes compartía clave con el orden de notas de Ajustes y ambos
// selectores se pisaban entre sí.
const savedFlashcardSort = localStorage.getItem(FLASHCARD_EXPLORER_SORT_STORAGE_KEY);
let flashcardExplorerSortBy: FlashcardExplorerSort =
  savedFlashcardSort === "last-reviewed" || savedFlashcardSort === "created-at"
    ? savedFlashcardSort
    : "due-date";
flashcardExplorerSort.value = flashcardExplorerSortBy;

/** Renderiza solo las tarjetas visibles: con 15.000 tarjetas, crear un nodo
 * por tarjeta bloqueaba la interfaz ~79 s y disparaba la memoria a 3,3 GB. */
const flashcardExplorerVirtual = new VirtualList<Flashcard>({
  scroller: flashcardExplorerPane,
  host: flashcardExplorerList,
  renderItem: (card) => createFlashcardExplorerItem(card),
  estimateHeight: 210,
  gap: 10,
  overscan: 400,
  keyFor: (card) => card.id,
  emptyText: "No se encontraron tarjetas en las notas del vault.",
});

const intAgain = document.getElementById("int-again") as HTMLElement;
const intHard = document.getElementById("int-hard") as HTMLElement;
const intGood = document.getElementById("int-good") as HTMLElement;
const intEasy = document.getElementById("int-easy") as HTMLElement;

function currentLocalDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const taskCompletionPoints = 3;

/**
 * Reinicia el progreso diario (repasos de hoy, tiempo de enfoque y puntos del
 * átomo) cuando cambia la fecha local. Los repasos totales se conservan.
 */
function resetFlashcardDailyProgress(): boolean {
  const today = currentLocalDate();
  if (flashcardProgressStats.date === today) return false;

  flashcardProgressStats.date = today;
  flashcardProgressStats.reviewsToday = 0;
  flashcardProgressStats.focusSeconds = 0;
  flashcardProgressStats.points = 0;
  saveFlashcardProgressStats();
  updateFlashcardProgressPanel();
  return true;
}

/** Programa el reinicio diario a las 00:00 y lo repite cada día. */
function scheduleFlashcardDailyReset(): void {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
  window.setTimeout(() => {
    resetFlashcardDailyProgress();
    scheduleFlashcardDailyReset();
  }, Math.max(1000, nextMidnight.getTime() - now.getTime()));
}

function installFlashcardDailyResetWatchers(): void {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resetFlashcardDailyProgress();
  });
  window.addEventListener("focus", () => resetFlashcardDailyProgress());
}

function awardProgressPoints(points: number): void {
  if (points <= 0) return;
  resetFlashcardDailyProgress();
  flashcardProgressStats.points = Math.max(0, flashcardProgressStats.points + points);
  saveFlashcardProgressStats();
  updateFlashcardProgressPanel();
}

function applyTaskCompletionReward(previousContent: string, nextContent: string): string {
  if (/^DONE\s+/i.test(previousContent) || !/^DONE\s+/i.test(nextContent)) {
    return nextContent;
  }
  playCompletionProgress();
  if (KanbanManager.hasCompletionReward(nextContent)) return nextContent;
  awardProgressPoints(taskCompletionPoints);
  showToast(
    `${translate("Tarea completada")} · +${taskCompletionPoints} ${translate("puntos para el átomo de progreso")}`
  );
  return KanbanManager.markCompletionReward(nextContent);
}

function saveFlashcardProgressStats(): void {
  try {
    localStorage.setItem(flashcardProgressStorageKey, JSON.stringify(flashcardProgressStats));
  } catch (error) {
    console.error("No se pudieron guardar las estadísticas de repaso:", error);
  }
}

function loadFlashcardProgressStats(): void {
  const stored = localStorage.getItem(flashcardProgressStorageKey);
  if (stored) {
    try {
      const value: unknown = JSON.parse(stored);
      if (value && typeof value === "object") {
        const candidate = value as Partial<FlashcardProgressStats>;
        const totalReviews = Number.isSafeInteger(candidate.totalReviews) && candidate.totalReviews! >= 0
          ? candidate.totalReviews!
          : 0;
        const points = Number.isSafeInteger(candidate.points) && candidate.points! >= 0
          ? candidate.points!
          : totalReviews;
        flashcardProgressStats = {
          date: typeof candidate.date === "string" ? candidate.date : currentLocalDate(),
          reviewsToday: Number.isSafeInteger(candidate.reviewsToday) && candidate.reviewsToday! >= 0
            ? candidate.reviewsToday!
            : 0,
          totalReviews,
          points,
          focusSeconds: Number.isSafeInteger(candidate.focusSeconds) && candidate.focusSeconds! >= 0
            ? candidate.focusSeconds!
            : 0,
        };
      }
    } catch (error) {
      console.error("No se pudieron leer las estadísticas de repaso guardadas:", error);
    }
  }
  if (flashcardProgressStats.date !== currentLocalDate()) {
    resetFlashcardDailyProgress();
  }
  updateFlashcardProgressPanel();
}

let renderedFlashcardPoints: number | null = null;
let renderedFlashcardStageKey: string | null = null;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function createSvgElement(tag: string): SVGElement {
  return document.createElementNS(SVG_NAMESPACE, tag);
}

/** Posiciones de un racimo hexagonal compacto, ordenadas desde el centro. */
function hexClusterPositions(count: number, spacing: number): { x: number; y: number }[] {
  const candidates: { x: number; y: number; distance: number }[] = [];
  const range = 4;
  for (let q = -range; q <= range; q++) {
    for (let s = -range; s <= range; s++) {
      if (Math.abs(-q - s) > range) continue;
      const x = spacing * (q + s / 2);
      const y = spacing * (Math.sqrt(3) / 2) * s;
      candidates.push({ x, y, distance: Math.hypot(x, y) });
    }
  }
  candidates.sort((left, right) => left.distance - right.distance);
  const selected = candidates.slice(0, count);
  if (selected.length === 0) return [];
  const centerX = selected.reduce((sum, point) => sum + point.x, 0) / selected.length;
  const centerY = selected.reduce((sum, point) => sum + point.y, 0) / selected.length;
  return selected.map(({ x, y }) => ({ x: x - centerX, y: y - centerY }));
}

function appendNucleonLabel(
  tree: SVGSVGElement,
  x: number,
  y: number,
  radius: number,
  symbol: string,
  className: string
): void {
  const label = createSvgElement("text");
  label.setAttribute("x", String(x));
  label.setAttribute("y", String(y));
  label.setAttribute("class", className);
  label.style.fontSize = scaledFontSize(Math.max(6, radius * 1.5));
  label.textContent = symbol;
  tree.appendChild(label);
}

/** Estado inicial: un único protón, sin neutrones ni electrones. */
function renderProtonStage(tree: SVGSVGElement): void {
  tree.setAttribute("aria-label", "Protón solitario: 1 protón, sin neutrones ni electrones");
  const cx = 80;
  const cy = 70;

  const glow = createSvgElement("circle");
  glow.setAttribute("cx", String(cx));
  glow.setAttribute("cy", String(cy));
  glow.setAttribute("r", "24");
  glow.setAttribute("class", "atom-nucleus-glow");
  tree.appendChild(glow);

  const proton = createSvgElement("circle");
  proton.setAttribute("cx", String(cx));
  proton.setAttribute("cy", String(cy));
  proton.setAttribute("r", "10");
  proton.setAttribute("class", "atom-proton");
  tree.appendChild(proton);

  appendNucleonLabel(tree, cx, cy, 10, "+", "atom-proton-label");
}

function renderElementStage(
  tree: SVGSVGElement,
  element: ChemicalElement,
  reducedMotion: boolean
): void {
  const cx = 80;
  const cy = 70;

  tree.setAttribute(
    "aria-label",
    `Átomo de ${element.name}: ${element.z} ${element.z === 1 ? "protón" : "protones"}, ` +
      `${element.neutrons} ${element.neutrons === 1 ? "neutrón" : "neutrones"} y ` +
      `${element.z} ${element.z === 1 ? "electrón" : "electrones"} en órbita`
  );

  // Para elementos pesados el núcleo se representa con un máximo de 10
  // protones y 10 neutrones para que siga siendo legible.
  const protonCount = Math.min(element.z, 10);
  const neutronCount = Math.min(element.neutrons, 10);
  const nucleonCount = protonCount + neutronCount;

  const glow = createSvgElement("circle");
  glow.setAttribute("cx", String(cx));
  glow.setAttribute("cy", String(cy));
  glow.setAttribute("r", nucleonCount > 12 ? "27" : "24");
  glow.setAttribute("class", "atom-nucleus-glow");
  tree.appendChild(glow);

  const spacing =
    nucleonCount <= 1 ? 0 : nucleonCount <= 2 ? 11 : nucleonCount <= 6 ? 9.5 : nucleonCount <= 12 ? 8 : 7;
  const particleRadius =
    nucleonCount <= 1 ? 8 : nucleonCount <= 2 ? 5.6 : nucleonCount <= 6 ? 5 : nucleonCount <= 12 ? 4.3 : 3.5;
  const positions = hexClusterPositions(nucleonCount, spacing);

  const nucleons: { type: "proton" | "neutron" }[] = [];
  const maxCount = Math.max(protonCount, neutronCount);
  for (let index = 0; index < maxCount; index++) {
    if (index < protonCount) nucleons.push({ type: "proton" });
    if (index < neutronCount) nucleons.push({ type: "neutron" });
  }

  positions.forEach((position, index) => {
    const nucleon = nucleons[index];
    if (!nucleon) return;
    const x = cx + position.x;
    const y = cy + position.y;

    const circle = createSvgElement("circle");
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", String(particleRadius));
    circle.setAttribute("class", nucleon.type === "proton" ? "atom-proton" : "atom-neutron");
    tree.appendChild(circle);

    if (nucleon.type === "proton") {
      appendNucleonLabel(tree, x, y, particleRadius, "+", "atom-proton-label");
    } else if (particleRadius >= 4.5) {
      appendNucleonLabel(tree, x, y, particleRadius, "n", "atom-neutron-label");
    }
  });

  const electronCount = Math.min(element.z, 14);
  const orbitCount = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(element.z / 2))));
  const orbits = Array.from({ length: orbitCount }, (_, index) => ({
    rx: 40 + index * 7,
    ry: 18 + index * 3.5,
    angle: index * 32,
    duration: 24 + index * 4,
  }));

  for (const orbit of orbits) {
    const ellipse = createSvgElement("ellipse");
    ellipse.setAttribute("cx", String(cx));
    ellipse.setAttribute("cy", String(cy));
    ellipse.setAttribute("rx", String(orbit.rx));
    ellipse.setAttribute("ry", String(orbit.ry));
    ellipse.setAttribute("class", "atom-orbit");
    ellipse.setAttribute("transform", `rotate(${orbit.angle} ${cx} ${cy})`);
    tree.appendChild(ellipse);
  }

  const electronsPerOrbit = new Array<number>(orbitCount).fill(0);
  for (let index = 0; index < electronCount; index++) {
    electronsPerOrbit[index % orbitCount] += 1;
  }

  const ellipsePath = (rx: number, ry: number): string =>
    `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`;

  for (let orbitIndex = 0; orbitIndex < orbitCount; orbitIndex++) {
    const electronTotal = electronsPerOrbit[orbitIndex];
    if (electronTotal === 0) continue;

    const orbit = orbits[orbitIndex];
    const tiltedOrbit = createSvgElement("g");
    tiltedOrbit.setAttribute("transform", `rotate(${orbit.angle} ${cx} ${cy})`);

    for (let electronIndex = 0; electronIndex < electronTotal; electronIndex++) {
      const electron = createSvgElement("g");
      electron.setAttribute("class", "atom-electron");

      if (reducedMotion) {
        const angle = (electronIndex / electronTotal) * Math.PI * 2;
        const x = cx + orbit.rx * Math.cos(angle);
        const y = cy + orbit.ry * Math.sin(angle);
        electron.setAttribute("transform", `translate(${x} ${y})`);
      } else {
        const motion = createSvgElement("animateMotion");
        motion.setAttribute("path", ellipsePath(orbit.rx, orbit.ry));
        motion.setAttribute("dur", `${orbit.duration}s`);
        motion.setAttribute("begin", `${-(electronIndex / electronTotal) * orbit.duration - orbitIndex * 1.5}s`);
        motion.setAttribute("repeatCount", "indefinite");
        electron.appendChild(motion);
      }

      const halo = createSvgElement("circle");
      halo.setAttribute("r", "9");
      halo.setAttribute("class", "atom-electron-halo");
      electron.appendChild(halo);

      const body = createSvgElement("circle");
      body.setAttribute("r", "5.2");
      body.setAttribute("class", "atom-electron-body");
      electron.appendChild(body);

      const minus = createSvgElement("text");
      minus.setAttribute("x", "0");
      minus.setAttribute("y", "0");
      minus.setAttribute("class", "atom-electron-label");
      minus.style.fontSize = scaledFontSize(11);
      minus.textContent = "−";
      electron.appendChild(minus);

      tiltedOrbit.appendChild(electron);
    }

    tree.appendChild(tiltedOrbit);
  }
}

function atomRadius(element: string, explicit?: number): number {
  if (explicit !== undefined) return explicit;
  if (element === "H") return 7;
  if (element === "O") return 9.5;
  if (element === "N") return 10;
  if (element === "P") return 10;
  return 10.5;
}

/** Dibuja un esquema ball-and-stick de la molécula indicada. */
function renderMoleculeStage(tree: SVGSVGElement, molecule: MoleculeStage): void {
  tree.setAttribute("aria-label", `Molécula: ${molecule.name} (${molecule.formula})`);

  const halo = createSvgElement("circle");
  halo.setAttribute("cx", "80");
  halo.setAttribute("cy", "70");
  halo.setAttribute("r", "58");
  halo.setAttribute("class", "molecule-halo");
  tree.appendChild(halo);

  const bondLayer = createSvgElement("g");
  bondLayer.setAttribute("class", "molecule-bonds");
  tree.appendChild(bondLayer);

  for (const bond of molecule.bonds) {
    const start = molecule.atoms[bond.a];
    const end = molecule.atoms[bond.b];
    if (!start || !end) continue;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = -dy / length;
    const normalY = dx / length;
    const order = bond.order ?? 1;
    const offsets = order === 3 ? [-3.1, 0, 3.1] : order === 2 ? [-2.1, 2.1] : [0];

    for (const offset of offsets) {
      const line = createSvgElement("line");
      line.setAttribute("x1", String(start.x + normalX * offset));
      line.setAttribute("y1", String(start.y + normalY * offset));
      line.setAttribute("x2", String(end.x + normalX * offset));
      line.setAttribute("y2", String(end.y + normalY * offset));
      line.setAttribute("class", "molecule-bond");
      bondLayer.appendChild(line);
    }
  }

  for (const atom of molecule.atoms) {
    const radius = atomRadius(atom.el, atom.r);
    const circle = createSvgElement("circle");
    circle.setAttribute("cx", String(atom.x));
    circle.setAttribute("cy", String(atom.y));
    circle.setAttribute("r", String(radius));
    circle.setAttribute("class", `mol-atom mol-atom-${atom.el}`);
    tree.appendChild(circle);

    if (atom.el !== "H") {
      const label = createSvgElement("text");
      label.setAttribute("x", String(atom.x));
      label.setAttribute("y", String(atom.y));
      label.setAttribute("class", `mol-atom-label mol-atom-label-${atom.el}`);
      label.style.fontSize = scaledFontSize(Math.max(7, radius * 0.95));
      label.textContent = atom.el;
      tree.appendChild(label);
    }
  }
}

function updateFlashcardProgressTree(force = false): void {
  const tree = flashcardGrowthTree;
  if (!tree) return;

  const points = Math.max(0, Math.floor(flashcardProgressStats.points));
  const stage = progressStageFromPoints(points);
  const stageKey =
    stage.kind === "proton"
      ? "proton"
      : stage.kind === "element"
        ? `element:${stage.element.z}`
        : `molecule:${stage.molecule.id}`;

  const pointsChanged = renderedFlashcardPoints !== points;
  if (pointsChanged) {
    renderedFlashcardPoints = points;
    if (flashcardTreeProgress) {
      const pointsText = `${points} ${points === 1 ? "punto" : "puntos"}`;
      flashcardTreeProgress.textContent =
        stage.kind === "proton"
          ? `${pointsText} · Protón`
          : stage.kind === "element"
            ? `${pointsText} · ${stage.element.name} (Z=${stage.element.z})`
            : `${pointsText} · ${stage.molecule.formula} · ${stage.molecule.name}`;
    }
  }

  // The visual only changes when the stage changes. This also keeps the
  // electron animation running while the Pomodoro timer updates the panel.
  if (!force && renderedFlashcardStageKey === stageKey) return;
  renderedFlashcardStageKey = stageKey;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  tree.replaceChildren();

  if (stage.kind === "proton") {
    renderProtonStage(tree);
  } else if (stage.kind === "element") {
    renderElementStage(tree, stage.element, reducedMotion);
  } else {
    renderMoleculeStage(tree, stage.molecule);
  }
}

function updateFlashcardProgressPanel(): void {
  flashcardStatToday.textContent = String(flashcardProgressStats.reviewsToday);
  flashcardStatTotal.textContent = String(flashcardProgressStats.totalReviews);
  flashcardStatFocus.textContent = String(Math.floor(flashcardProgressStats.focusSeconds / 60));
  const points = Math.max(0, Math.floor(flashcardProgressStats.points));
  const pointsLabel = `${points} ${points === 1 ? "pt" : "pts"}`;
  if (flashcardPointsBadge.textContent !== pointsLabel) flashcardPointsBadge.textContent = pointsLabel;
  updateFlashcardProgressTree();
}

/**
 * Un único AudioContext, creado de forma perezosa. Crear uno por pitido agota
 * recursos en WebView y, además, la política de autoplay exige que el primero
 * se cree dentro de un gesto del usuario (Iniciar, Pausar o el propio ajuste).
 */
function pomodoroAudio(): AudioContext | null {
  try {
    if (!pomodoroAudioContextRef) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      pomodoroAudioContextRef = new AudioCtx();
    }
    if (pomodoroAudioContextRef.state === "suspended") {
      void pomodoroAudioContextRef.resume();
    }
    return pomodoroAudioContextRef;
  } catch {
    return null;
  }
}

/** Aviso corto: dos notas ascendentes al terminar enfoque, descendentes al descanso. */
function playPomodoroChime(kind: "focus-end" | "break-end"): void {
  if (!pomodoroSoundEnabled) return;
  const ctx = pomodoroAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const frequencies = kind === "focus-end" ? [660, 880] : [520, 392];
  frequencies.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + index * 0.18;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.4);
  });
}

function renderPomodoro(): void {
  const minutes = Math.floor(pomodoroRemainingSeconds / 60);
  const seconds = pomodoroRemainingSeconds % 60;
  const timeString = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  pomodoroClock.textContent = timeString;
  pomodoroModeLabel.textContent = pomodoroMode === "focus"
    ? "Enfoque"
    : pomodoroIsLongBreak ? "Descanso largo" : "Descanso corto";
  pomodoroToggle.textContent = pomodoroInterval === null ? "Iniciar" : "Pausar";

  const isShortBreak = pomodoroMode === "break" && !pomodoroIsLongBreak;
  const isLongBreak = pomodoroMode === "break" && pomodoroIsLongBreak;
  pomodoroShortBreak?.classList.toggle("active", isShortBreak);
  pomodoroShortBreak?.setAttribute("aria-pressed", String(isShortBreak));
  pomodoroLongBreak?.classList.toggle("active", isLongBreak);
  pomodoroLongBreak?.setAttribute("aria-pressed", String(isLongBreak));

  headbarPomodoroClock.textContent = timeString;
  headbarPomodoro.hidden = !pomodoroHeadbarVisible;

  const isRunning = pomodoroInterval !== null;
  const actionLabel = isRunning ? "Pausar Pomodoro" : "Iniciar Pomodoro";
  headbarPomodoroClock.title = actionLabel;
  headbarPomodoroClock.setAttribute("aria-label", `${timeString} · ${actionLabel}`);
  headbarPomodoroClock.classList.toggle("is-running", isRunning);
  headbarPomodoroClock.classList.toggle("is-paused", !isRunning && pomodoroPaused);
}

/** Salta directamente a un descanso corto o largo y lo inicia. */
function startPomodoroBreak(isLong: boolean): void {
  stopPomodoro();
  pomodoroMode = "break";
  pomodoroIsLongBreak = isLong;
  pomodoroRemainingSeconds =
    (isLong ? pomodoroLongBreakMinutes : pomodoroBreakMinutes) * 60;
  startPomodoro();
}

function stopPomodoro(): void {
  if (pomodoroInterval !== null) {
    window.clearInterval(pomodoroInterval);
    pomodoroInterval = null;
    saveFlashcardProgressStats();
  }
  pomodoroPaused = true;
  renderPomodoro();
}

function startPomodoro(): void {
  pomodoroPaused = false;
  if (pomodoroInterval !== null) return;
  // Crear el contexto aquí (gesto del usuario) evita que el primer aviso
  // quede silenciado por la política de autoplay.
  if (pomodoroSoundEnabled) void pomodoroAudio();
  pomodoroInterval = window.setInterval(() => {
    if (pomodoroMode === "focus") {
      resetFlashcardDailyProgress();
      flashcardProgressStats.focusSeconds += 1;
      updateFlashcardProgressPanel();
      if (flashcardProgressStats.focusSeconds % 15 === 0) saveFlashcardProgressStats();
    }
    pomodoroRemainingSeconds -= 1;
    if (pomodoroRemainingSeconds <= 0) {
      if (pomodoroMode === "focus") {
        pomodoroCompletedFocusSessions += 1;
        pomodoroIsLongBreak = pomodoroCompletedFocusSessions % pomodoroSessionsBeforeLongBreak === 0;
        pomodoroMode = "break";
        pomodoroRemainingSeconds = (pomodoroIsLongBreak ? pomodoroLongBreakMinutes : pomodoroBreakMinutes) * 60;
        playPomodoroChime("focus-end");
        showToast(
          pomodoroIsLongBreak
            ? "Ciclo completado. Disfruta de un descanso largo."
            : "Pomodoro completado. Tómate un descanso corto."
        );
      } else {
        pomodoroMode = "focus";
        pomodoroIsLongBreak = false;
        pomodoroRemainingSeconds = pomodoroFocusMinutes * 60;
        playPomodoroChime("break-end");
        showToast("Descanso completado. ¡A seguir repasando!");
      }
      saveFlashcardProgressStats();
    }
    renderPomodoro();
  }, 1000);
  renderPomodoro();
}

pomodoroToggle.addEventListener("click", () => {
  if (pomodoroInterval === null) startPomodoro();
  else stopPomodoro();
});

headbarPomodoroClock.addEventListener("click", () => {
  if (pomodoroInterval === null) startPomodoro();
  else stopPomodoro();
});
pomodoroReset.addEventListener("click", () => {
  stopPomodoro();
  pomodoroMode = "focus";
  pomodoroIsLongBreak = false;
  pomodoroCompletedFocusSessions = 0;
  pomodoroRemainingSeconds = pomodoroFocusMinutes * 60;
  pomodoroPaused = false;
  renderPomodoro();
});

pomodoroShortBreak?.addEventListener("click", () => startPomodoroBreak(false));
pomodoroLongBreak?.addEventListener("click", () => startPomodoroBreak(true));

function setFlashcardFocusMode(enabled: boolean): void {
  if (flashcardExplorerActive && enabled) return;
  document.getElementById("app")?.classList.toggle("flashcard-focus-mode", enabled);
  flashcardFocusToggle.setAttribute("aria-pressed", String(enabled));
  flashcardFocusToggle.classList.toggle("active", enabled);
  flashcardFocusToggle.textContent = enabled ? "Salir de focus" : "Modo focus";
}

flashcardFocusToggle.addEventListener("click", () => {
  setFlashcardFocusMode(!document.getElementById("app")?.classList.contains("flashcard-focus-mode"));
});

function scheduleFlashcardExplorerProgressRender(): void {
  if (flashcardExplorerProgressRenderTimer !== null) return;
  // Repintar el explorador en cada lote reordena miles de tarjetas; 350 ms es
  // suficiente para que se vea el avance sin competir con el escaneo.
  flashcardExplorerProgressRenderTimer = window.setTimeout(() => {
    flashcardExplorerProgressRenderTimer = null;
    if (flashcardExplorerActive) renderFlashcardExplorer();
  }, 350);
}

interface EnsureFlashcardScanOptions {
  order?: FlashcardReviewOrder;
  preserve?: { cardId: string; revealed: boolean };
  onProgress?: (progress: FlashcardLoadProgress) => void;
  onDone?: (cards: readonly Flashcard[]) => void;
}

/**
 * Punto único de entrada al escaneo de flashcards. Reutiliza la caché o la
 * carga en curso y reparte el trabajo en lotes para no bloquear la interfaz.
 */
function ensureFlashcardScan(options: EnsureFlashcardScanOptions = {}): void {
  if (!desktopReady) return;
  const pages = vault.getPages();
  const version = vault.getMutationVersion();
  const cached = flashcardLoader.getCachedCards(pages, version);
  // Si ya hay una sesión visible (aunque sea la pantalla de completado) no se
  // pinta "Escaneando": al volver de otra ventana la tarjeta debe quedarse
  // quieta hasta que el nuevo escaneo termine (T18).
  const sessionActive = flashcardsManager.getCardsCount() > 0;
  if (!cached && !sessionActive) flashcardLoading = true;

  flashcardLoader.load(pages, version, {
    order: options.order ?? flashcardReviewOrder,
    preserve: options.preserve,
    onProgress: (progress) => {
      flashcardLoading = !progress.done;
      updateFlashcardPagesProgress(progress);
      options.onProgress?.(progress);
      if (currentView === "flashcards") {
        if (flashcardExplorerActive) {
          scheduleFlashcardExplorerProgressRender();
        } else if (!progress.done && !sessionActive) {
          updateFlashcardLoadingState(progress);
        }
      }
    },
    onDone: (cards) => {
      flashcardLoading = false;
      options.onDone?.(cards);
    },
  });
}

function updateFlashcardLoadingState(progress: FlashcardLoadProgress): void {
  const total = Math.max(1, progress.totalPages);
  const percent = Math.min(100, Math.round((progress.scannedPages / total) * 100));
  cardProgressEl.hidden = false;
  cardProgressEl.innerText = `Escaneando ${progress.scannedPages}/${progress.totalPages}`;
  cardTypePill.style.display = "inline-block";
  cardTypePill.innerText = "CARGANDO";
  cardSourceEl.innerText = "Leyendo tus notas…";
  cardFsrsBadge.innerText = `${progress.cards} tarjetas encontradas`;
  syncCardParentContext(null);
  cardQuestionEl.replaceChildren();
  cardQuestionEl.innerText = `Preparando flashcards… ${percent}%`;
  cardAnswerEl.replaceChildren();
  cardAnswerEl.style.display = "none";
  cardAnswerEl.classList.remove("visible");
  syncClozeRevealLayout(null, false);
  btnShowAnswer.style.display = "none";
  fsrsActions.classList.remove("visible");
}

function renderFlashcardSessionResult(): void {
  flashcardLoading = false;
  if (flashcardsManager.getCardsCount() === 0) {
    const allCardCount = flashcardsManager.getAllCardsCount();
    const filterActive = flashcardPageFilter !== null;
    const filterEmpty = flashcardPageFilter?.length === 0;
    cardProgressEl.hidden = false;
    cardProgressEl.innerText = "0 de 0";
    cardTypePill.style.display = "none";
    cardSourceEl.innerText =
      allCardCount === 0
        ? "Sin tarjetas"
        : filterActive
          ? "Sin tarjetas pendientes en las notas seleccionadas"
          : "Sin tarjetas pendientes";
    cardFsrsBadge.innerText = "";
    syncCardParentContext(null);
    cardQuestionEl.innerText =
      allCardCount === 0
        ? "No se encontraron flashcards con #card, :: o huecos Cloze (==...==) en tus notas."
        : filterEmpty
          ? "No hay ninguna nota seleccionada para el repaso. Marca y guarda las notas en Ajustes › Flashcards."
          : filterActive
            ? "No hay tarjetas pendientes en las notas seleccionadas. Vuelve cuando llegue su fecha de vencimiento o amplía la selección de notas."
            : "No hay tarjetas pendientes de repaso. Vuelve cuando llegue su fecha de vencimiento.";
    cardAnswerEl.style.display = "none";
    syncClozeRevealLayout(null, false);
    btnShowAnswer.style.display = "none";
    fsrsActions.classList.remove("visible");
    if (allCardCount > 0) scheduleFlashcardDueRecheck();
    return;
  }

  cardTypePill.style.display = "inline-block";
  updateFlashcardUI();
}

function startFlashcardsSession(preserve?: { cardId: string; revealed: boolean }) {
  loadFlashcardProgressStats();
  renderPomodoro();
  const pages = vault.getPages();
  const version = vault.getMutationVersion();
  const cached = flashcardLoader.getCachedCards(pages, version);
  if (!cached && flashcardsManager.getCardsCount() === 0) {
    updateFlashcardLoadingState(
      flashcardLoader.isLoading()
        ? flashcardLoader.getProgress()
        : {
            scannedPages: 0,
            totalPages: pages.length,
            cards: 0,
            done: false,
            fromCache: false,
          }
    );
  }

  ensureFlashcardScan({
    order: flashcardReviewOrder,
    preserve,
    onDone: () => {
      renderFlashcardPagesFilter(false);
      // El explorador solo se pinta cuando su pestaña está visible. Entrar en
      // "Repasar" ya no reconstruye miles de tarjetas que nadie está mirando.
      if (flashcardExplorerActive) renderFlashcardExplorer();
      renderFlashcardSessionResult();
    },
  });
}

function showFlashcardPanel(showExplorer: boolean) {
  if (showExplorer) setFlashcardFocusMode(false);
  flashcardExplorerActive = showExplorer;
  flashcardReviewTab.classList.toggle("active", !showExplorer);
  flashcardExplorerTab.classList.toggle("active", showExplorer);
  flashcardReviewTab.setAttribute("aria-selected", String(!showExplorer));
  flashcardExplorerTab.setAttribute("aria-selected", String(showExplorer));
  flashcardReviewPane.hidden = showExplorer;
  flashcardExplorerPane.hidden = !showExplorer;
  cardProgressEl.hidden = showExplorer;
  flashcardReviewTools.hidden = showExplorer;
  flashcardFocusToggle.hidden = showExplorer;
  if (showExplorer) renderFlashcardExplorer();
}

flashcardReviewTab.addEventListener("click", () => showFlashcardPanel(false));
flashcardExplorerTab.addEventListener("click", () => showFlashcardPanel(true));
flashcardExplorerSort.addEventListener("change", () => {
  const value = flashcardExplorerSort.value;
  if (value !== "due-date" && value !== "last-reviewed" && value !== "created-at") return;
  flashcardExplorerSortBy = value;
  localStorage.setItem(FLASHCARD_EXPLORER_SORT_STORAGE_KEY, value);
  flashcardExplorerPage = 1;
  flashcardExplorerVirtual.scrollToTop();
  renderFlashcardExplorer();
});

flashcardExplorerSearch.addEventListener("input", () => {
  flashcardExplorerSearchText = flashcardExplorerSearch.value.trim();
  flashcardExplorerPage = 1;
  flashcardExplorerVirtual.scrollToTop();
  if (flashcardExplorerSearchTimer !== null) {
    window.clearTimeout(flashcardExplorerSearchTimer);
  }
  // 120 ms: suficiente para no ordenar 15.000 tarjetas en cada tecla.
  flashcardExplorerSearchTimer = window.setTimeout(() => {
    flashcardExplorerSearchTimer = null;
    renderFlashcardExplorer();
  }, 120);
});

flashcardExplorerPrev.addEventListener("click", () => {
  if (flashcardExplorerPage > 1) {
    flashcardExplorerPage -= 1;
    flashcardExplorerVirtual.scrollToTop();
    renderFlashcardExplorer();
  }
});

flashcardExplorerNext.addEventListener("click", () => {
  flashcardExplorerPage += 1;
  flashcardExplorerVirtual.scrollToTop();
  renderFlashcardExplorer();
});

function formatFlashcardDate(value?: string): string {
  if (!value) return "Sin registro";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no válida"
    : new Intl.DateTimeFormat(currentLanguage(), { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function createImageOcclusionPreview(card: Flashcard, revealed: boolean): HTMLDivElement {
  const preview = document.createElement("div");
  preview.className = "flashcard-image-preview";
  preview.classList.add("image-block-loading");

  const image = document.createElement("img");
  image.alt = "";
  image.addEventListener("load", () => {
    preview.classList.remove("image-block-loading", "image-block-load-error");
  }, { once: true });
  image.addEventListener("error", () => {
    preview.classList.remove("image-block-loading");
    preview.classList.add("image-block-load-error");
    console.error(`No se pudo cargar la imagen de oclusión para ${card.pageTitle}.`);
  }, { once: true });
  preview.appendChild(image);
  if (card.imageSource) {
    void resolveDisplayImageUrl(card.imageSource).then((url) => {
      image.src = url;
    }).catch((error: unknown) => {
      preview.classList.remove("image-block-loading");
      preview.classList.add("image-block-load-error");
      console.error("No se pudo resolver una imagen de Flashcard:", error);
    });
  }
  if (card.imageOcclusion) {
    const regions = card.imageOcclusions?.length
      ? card.imageOcclusions
      : [card.imageOcclusion];
    // En la respuesta se muestra únicamente la imagen limpia, sin máscaras ni
    // contornos: la oclusión solo tiene sentido durante la pregunta.
    const visibleMasks = revealed ? [] : regions;
    if (visibleMasks.length === 0) return preview;
    const layer = document.createElement("div");
    layer.className = "flashcard-image-mask-layer";
    image.addEventListener("load", () => {
      appendOcclusionMasks(
        layer,
        visibleMasks,
        image,
        "image-occlusion-mask",
        revealed ? undefined : card.imageOcclusion
      );
    }, { once: true });
    preview.appendChild(layer);
  }
  return preview;
}

function flashcardExplorerSortTime(card: Flashcard): number {
  const value = flashcardExplorerSortBy === "due-date"
    ? card.dueDate
    : flashcardExplorerSortBy === "last-reviewed"
      ? card.fsrs.lastReviewDate
      : card.createdAt;
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

/** Elimina una tarjeta desde el explorador quitando sus marcadores, sin borrar el texto. */
async function deleteFlashcardFromExplorer(card: Flashcard): Promise<void> {
  const page = vault.getPages().find((candidate) => candidate.title === card.pageTitle);
  if (!page) {
    showToast("No se encontró la nota de la tarjeta.");
    return;
  }
  const location = findNodeLocation(page.blocks, card.blockId);
  if (!location) {
    showToast("No se encontró el bullet de la tarjeta.");
    return;
  }
  const node = location.parentList[location.index];
  const next = card.cardType === "image-occlusion" && card.imageOcclusion
    ? removeImageOcclusionMarker(node.content, card.imageOcclusion)
    : isFlashcardBlockContent(node.content)
      ? removeFlashcardMarkers(node.content)
      : node.content;
  if (next === node.content) {
    showToast("No se pudieron quitar los marcadores de la tarjeta.");
    return;
  }
  node.content = next;
  try {
    await vault.savePage(page, true);
    flashcardLoader.invalidate();
    renderFlashcardExplorer();
    showToast("Tarjeta eliminada; el contenido se conservó.");
  } catch (error) {
    console.error("No se pudo eliminar la tarjeta:", error);
    showToast("No se pudo guardar el cambio en el vault.");
  }
}

function createFlashcardExplorerItem(card: Flashcard): HTMLElement {
  const item = document.createElement("article");
  item.className = "flashcard-explorer-item";

  const header = document.createElement("header");
  const kind = document.createElement("strong");
  kind.innerText = card.cardType === "image-occlusion"
    ? "IMAGEN"
    : card.cardType === "cloze"
      ? "CLOZE"
      : "BÁSICA";
  const source = document.createElement("button");
  source.className = "flashcard-source-link";
  source.type = "button";
  source.innerText = card.pageTitle;
  source.title = `Abrir la nota ${card.pageTitle}`;
  source.addEventListener("click", () => loadPage(card.pageTitle));

  const remove = document.createElement("button");
  remove.className = "flashcard-explorer-remove";
  remove.type = "button";
  remove.title = "Eliminar la flashcard conservando el contenido";
  remove.setAttribute("aria-label", "Eliminar flashcard");
  remove.textContent = "✕";
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    void deleteFlashcardFromExplorer(card);
  });

  header.append(kind, source, remove);

  const question = document.createElement("div");
  question.className = "flashcard-explorer-question markdown-rendered";
  if (card.cardType === "image-occlusion") {
    question.appendChild(createImageOcclusionPreview(card, false));
  } else {
    question.innerHTML = sanitizeHtml(card.question);
  }

  const answer = document.createElement("div");
  answer.className = "flashcard-explorer-answer markdown-rendered";
  if (card.cardType === "image-occlusion") {
    answer.appendChild(createImageOcclusionPreview(card, true));
  } else {
    answer.innerHTML = sanitizeHtml(card.answer);
  }

  const dates = document.createElement("dl");
  dates.className = "flashcard-explorer-dates";
  [
    ["Próximo repaso", formatFlashcardDate(card.dueDate)],
    ["Último repaso", formatFlashcardDate(card.fsrs.lastReviewDate)],
    ["Creada", formatFlashcardDate(card.createdAt)],
  ].forEach(([label, value]) => {
    const entry = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = label;
    const date = document.createElement("dd");
    date.textContent = value;
    entry.append(term, date);
    dates.appendChild(entry);
  });

  // En el explorador se muestra solo la parte útil para identificar la tarjeta:
  // las básicas enseñan solo el campo base (pregunta) y las cloze/oclusión
  // solo la parte revelada (respuesta), para no ocupar espacio.
  if (card.cardType === "basic") {
    item.append(header, dates, question);
  } else {
    item.append(header, dates, answer);
  }
  return item;
}

function flashcardSearchHaystack(card: Flashcard): string {
  if (card.searchText) return card.searchText;
  return normalizeDeckSearchText(
    `${card.pageTitle} ${card.question} ${card.answer}`.replace(/<[^>]*>/g, " ")
  );
}

function renderFlashcardExplorer(): void {
  if (!flashcardExplorerActive) return;

  const pages = vault.getPages();
  const version = vault.getMutationVersion();
  const cached = flashcardLoader.getCachedCards(pages, version);
  const loading = flashcardLoader.isLoading();
  const willStartScan =
    desktopReady && !cached && !loading && !flashcardLoader.isFresh(pages, version);
  const sourceCards = cached ?? (loading ? flashcardLoader.getCardsForDisplay() : []);
  const searchToken = normalizeDeckSearchText(flashcardExplorerSearchText);
  const filtered = searchToken
    ? sourceCards.filter((card) => flashcardSearchHaystack(card).includes(searchToken))
    : sourceCards;

  // Calcular la clave de orden una sola vez evita ~200.000 Date.parse por
  // cada cambio de orden con 15.000 tarjetas.
  const decorated = filtered.map((card) => ({
    card,
    time: flashcardExplorerSortTime(card),
  }));
  decorated.sort((left, right) => {
    const byTime = left.time === right.time ? 0 : left.time < right.time ? -1 : 1;
    return byTime || left.card.pageTitle.localeCompare(right.card.pageTitle);
  });

  const total = decorated.length;
  const totalPages = Math.max(1, Math.ceil(total / FLASHCARD_EXPLORER_PAGE_SIZE));
  if (flashcardExplorerPage > totalPages) flashcardExplorerPage = totalPages;
  if (flashcardExplorerPage < 1) flashcardExplorerPage = 1;
  const start = (flashcardExplorerPage - 1) * FLASHCARD_EXPLORER_PAGE_SIZE;
  const pageCards = decorated
    .slice(start, start + FLASHCARD_EXPLORER_PAGE_SIZE)
    .map((entry) => entry.card);

  const progress = loading ? flashcardLoader.getProgress() : null;
  const progressLabel = progress
    ? ` · ${Math.round((progress.scannedPages / Math.max(1, progress.totalPages)) * 100)}%`
    : "";
  if (total === 0 && (loading || willStartScan) && !searchToken) {
    flashcardExplorerCount.innerText = "Preparando tarjetas…";
  } else if (searchToken) {
    flashcardExplorerCount.innerText =
      `${total} de ${sourceCards.length} ${sourceCards.length === 1 ? "tarjeta" : "tarjetas"}${progressLabel}`;
  } else {
    const noun = total === 1 ? "tarjeta" : "tarjetas";
    flashcardExplorerCount.innerText = `${total} ${noun}${loading ? " (cargando)" : ""}${progressLabel}`;
  }

  const emptyText = (loading || willStartScan) && total === 0
    ? "Preparando tarjetas…"
    : searchToken
      ? "No hay tarjetas que coincidan con la búsqueda."
      : "No se encontraron tarjetas en las notas del vault.";
  flashcardExplorerVirtual.setEmptyText(emptyText);
  flashcardExplorerVirtual.setItems(pageCards);

  if (totalPages > 1) {
    flashcardExplorerPagination.hidden = false;
    flashcardExplorerPrev.disabled = flashcardExplorerPage === 1;
    flashcardExplorerNext.disabled = flashcardExplorerPage === totalPages;
    flashcardExplorerPageInfo.textContent = `Página ${flashcardExplorerPage} de ${totalPages}`;
  } else {
    flashcardExplorerPagination.hidden = true;
  }

  // Si se abre el explorador antes de que el escaneo arranque (por ejemplo,
  // desde una restauración de vista), iniciarlo aquí sin bloquear.
  if (willStartScan) {
    ensureFlashcardScan({
      order: flashcardReviewOrder,
      onDone: () => {
        if (flashcardExplorerActive) renderFlashcardExplorer();
      },
    });
  }
}

/**
 * Muestra el bullet padre como contexto de la tarjeta. Es solo texto: se pinta
 * con `textContent` para no interpretar markdown ajeno a la tarjeta.
 */
function syncCardParentContext(card: Flashcard | null): void {
  if (!cardParentContextEl) return;
  const content = card?.parentContent?.trim() || "";
  cardParentContextEl.textContent = content;
  cardParentContextEl.hidden = content.length === 0;
}

/** Cancela el rechequeo periódico de tarjetas vencidas. */
function clearFlashcardDueRecheck(): void {
  if (flashcardDueRecheckTimer !== null) {
    window.clearTimeout(flashcardDueRecheckTimer);
    flashcardDueRecheckTimer = null;
  }
}

/**
 * Si la cola terminó pero alguna tarjeta ya venció (p. ej. un "Otra vez" con
 * paso corto), la reconstruye y vuelve a pintar. Devuelve true si hubo cambios.
 */
function refreshDueFlashcardQueue(): boolean {
  if (flashcardsManager.getAllCardsCount() === 0) return false;
  if (flashcardsManager.countDueCards() === 0) return false;
  flashcardsManager.refreshDueQueue(flashcardReviewOrder);
  updateFlashcardUI();
  return true;
}

/**
 * En la pantalla de completado se revisa cada 30 s si apareció alguna tarjeta
 * vencida. Así no hace falta reiniciar la sesión a mano (T23).
 */
function scheduleFlashcardDueRecheck(): void {
  if (flashcardDueRecheckTimer !== null) return;
  flashcardDueRecheckTimer = window.setTimeout(() => {
    flashcardDueRecheckTimer = null;
    if (currentView !== "flashcards" || flashcardLoading || flashcardExplorerActive) return;
    if (flashcardsManager.getCurrentCard()) return;
    if (refreshDueFlashcardQueue()) return;
    scheduleFlashcardDueRecheck();
  }, FLASHCARD_DUE_RECHECK_MS);
}

function updateFlashcardUI() {
  updateReviewHistoryButtons();
  if (flashcardLoading) return;
  const total = flashcardsManager.getCardsCount();
  const current = flashcardsManager.getCurrentIndex();
  const card = flashcardsManager.getCurrentCard();
  // updateFlashcardUI siempre deja la respuesta oculta hasta pulsar "Mostrar".
  syncClozeRevealLayout(card, false);

  if (!card) {
    if (refreshDueFlashcardQueue()) return;
    scheduleFlashcardDueRecheck();
    cardProgressEl.innerText = `${total} de ${total}`;
    cardTypePill.innerText = "FSRS";
    cardSourceEl.innerText = "🎉 ¡Completado!";
    cardFsrsBadge.innerText = "";
    syncCardParentContext(null);
    cardQuestionEl.innerText = "¡Has completado todas las tarjetas pendientes con FSRS-4.5!";
    cardAnswerEl.classList.remove("visible");
    btnShowAnswer.style.display = "inline-block";
    btnShowAnswer.innerText = "Reiniciar Sesión";
    btnShowAnswer.onclick = () => {
      flashcardsManager.restart();
      btnShowAnswer.innerText = "Mostrar Respuesta (Espacio)";
      btnShowAnswer.onclick = handleRevealAnswer;
      updateFlashcardUI();
    };
    fsrsActions.classList.remove("visible");
    return;
  }

  clearFlashcardDueRecheck();
  cardProgressEl.innerText = `Tarjeta ${current + 1} de ${total}`;
  cardTypePill.innerText = card.cardType === "image-occlusion"
    ? "IMAGEN"
    : card.cardType === "cloze"
      ? "CLOZE"
      : "BÁSICA";
  cardSourceEl.innerText = `Origen: ${card.pageTitle}`;
  cardFsrsBadge.innerText = `S: ${card.fsrs.stability}d • D: ${card.fsrs.difficulty} • Reps: ${card.fsrs.reps}`;
  syncCardParentContext(card);

  cardQuestionEl.replaceChildren();
  cardAnswerEl.replaceChildren();
  cardAnswerEl.style.display = "";
  if (card.cardType === "image-occlusion") {
    const preview = createImageOcclusionPreview(card, false);
    cardQuestionEl.appendChild(preview);
    cardAnswerEl.textContent = card.answer || "";
  } else {
    cardQuestionEl.innerHTML = sanitizeHtml(card.question);
    cardAnswerEl.innerHTML = sanitizeHtml(card.answer);
  }
  cardAnswerEl.classList.remove("visible");

  const previews = flashcardsManager.getRatingPreviews();
  if (previews) {
    intAgain.innerText = previews[1].intervalText;
    intHard.innerText = previews[2].intervalText;
    intGood.innerText = previews[3].intervalText;
    intEasy.innerText = previews[4].intervalText;
  }

  btnShowAnswer.style.display = "inline-block";
  btnShowAnswer.innerText = "Mostrar Respuesta (Espacio)";
  btnShowAnswer.onclick = handleRevealAnswer;
  fsrsActions.classList.remove("visible");
}

onLanguageChange(() => {
  renderSidebar();
  renderFlashcardRecalcControls();
  if (currentView === "flashcards") {
    renderFlashcardExplorer();
    updateFlashcardUI();
  } else if (currentView === "journals") {
    renderJournalsView();
  }
  if (graphPreviewPageTitle) {
    const page = vault.getPageByTitle(graphPreviewPageTitle);
    if (page) renderGraphPreviewContent(page);
  }
});

function handleRevealAnswer() {
  if (flashcardLoading) return;
  flashcardsManager.reveal();
  const card = flashcardsManager.getCurrentCard();
  cardQuestionEl.classList.remove("image-occlusion-active");
  if (card?.cardType === "image-occlusion") {
    const preview = cardQuestionEl.querySelector(".flashcard-image-preview") as HTMLDivElement;
    const layer = preview?.querySelector(".flashcard-image-mask-layer") as HTMLDivElement;
    // Al revelar se retiran las máscaras: la respuesta muestra solo la imagen
    // limpia. Antes se volvían a dibujar los contornos de las demás regiones,
    // un remanente de cuando se mostraban ambas versiones a la vez.
    layer?.replaceChildren();
  }
  syncClozeRevealLayout(card, true);
  cardAnswerEl.classList.add("visible");
  btnShowAnswer.style.display = "none";
  fsrsActions.classList.add("visible");
}

btnShowAnswer.addEventListener("click", handleRevealAnswer);

flashcardReviewUndo.addEventListener("click", () => {
  void undoLastReview();
});
flashcardReviewRedo.addEventListener("click", () => {
  void redoLastReview();
});
flashcardSyncButton.addEventListener("click", () => {
  void synchronizeVaultFromDisk({ notify: true, force: true });
});

document.querySelectorAll<HTMLButtonElement>(".btn-fsrs").forEach((btn) => {
  btn.addEventListener("click", () => {
    const rating = parseInt(btn.dataset.rating || "3", 10) as FSRSRating;
    const rect = btn.getBoundingClientRect();
    applyFSRSRating(rating, true, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  });
});

const celebrationCanvas = document.getElementById("celebration-canvas") as HTMLCanvasElement | null;
let celebrationFrame: number | null = null;

/**
 * Recompensa breve al calificar "Fácil". Es puramente decorativa: no toca el
 * DOM de la tarjeta ni bloquea la siguiente, y se cancela si se vuelve a
 * lanzar (T4).
 */
function launchEasyCelebration(origin?: { x: number; y: number }): void {
  const canvas = celebrationCanvas;
  if (!canvas) return;
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  if (celebrationFrame !== null) {
    window.cancelAnimationFrame(celebrationFrame);
    celebrationFrame = null;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  canvas.classList.add("is-active");

  const accent =
    getComputedStyle(document.documentElement).getPropertyValue("--ls-accent").trim() ||
    "#3b82f6";
  const colors = [accent, "#ffffff", "#facc15"];
  const startX = origin?.x ?? width / 2;
  const startY = origin?.y ?? height / 2;
  const duration = 820;
  const particles = Array.from({ length: 26 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.2 + Math.random() * 3.4;
    return {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.4,
      size: 2 + Math.random() * 2.6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.28,
    };
  });

  const started = performance.now();
  const draw = (now: number): void => {
    const elapsed = now - started;
    const progress = Math.min(1, elapsed / duration);
    context.clearRect(0, 0, width, height);
    const fade = 1 - progress;
    context.globalAlpha = Math.max(0, fade);
    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.12;
      particle.vx *= 0.99;
      particle.rotation += particle.spin;
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.fillStyle = particle.color;
      context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 1.7);
      context.restore();
    });
    context.globalAlpha = 1;

    if (progress < 1) {
      celebrationFrame = window.requestAnimationFrame(draw);
    } else {
      celebrationFrame = null;
      context.clearRect(0, 0, width, height);
      canvas.classList.remove("is-active");
    }
  };
  celebrationFrame = window.requestAnimationFrame(draw);
}

function applyFSRSRating(
  rating: FSRSRating,
  persist = true,
  celebrationOrigin?: { x: number; y: number }
) {
  // La vista se está reemplazando con cambios de otro dispositivo: calificar
  // ahora guardaría la página antigua sobre la versión recién leída.
  if (vaultSyncInFlight || isVaultSwitching || reviewHistoryActionInFlight || flashcardLoading) return;
  const card = flashcardsManager.getCurrentCard();
  if (!card) return;
  // Solo se acepta una calificación después de haber revelado la respuesta.
  // Evita que una tecla o botón accidental salte a la siguiente tarjeta.
  if (!flashcardsManager.isRevealed()) return;

  const result = flashcardsManager.rate(rating, persist);
  if (result) {
    if (rating === 4 && persist) launchEasyCelebration(celebrationOrigin);
    resetFlashcardDailyProgress();
    flashcardProgressStats.reviewsToday += 1;
    flashcardProgressStats.totalReviews += 1;
    flashcardProgressStats.points = Math.max(
      0,
      flashcardProgressStats.points + (flashcardPointDeltas[rating] ?? 0)
    );
    saveFlashcardProgressStats();
    updateFlashcardProgressPanel();
    const page = vault.getPageByTitle(card.pageTitle);
    if (page) {
      const loc = findNodeLocation(page.blocks, card.blockId);
      if (loc) {
        const block = loc.parentList[loc.index];
        const before = FlashcardsManager.readScheduleSnapshot(block.content);
        block.content = FlashcardsManager.updateBlockFSRS(
          block.content,
          result.fsrs,
          result.intervalDays,
          result.easeFactor
        );
        const after = FlashcardsManager.readScheduleSnapshot(block.content);
        void vault
          .savePage(page, true)
          .then(() =>
            reviewProgress.record({
              pagePath: page.path,
              pageTitle: page.title,
              blockId: card.blockId,
              cardId: card.id,
              cardType: card.cardType,
              rating,
              before,
              after,
            })
          )
          .then(() => updateReviewHistoryButtons())
          .catch((error: unknown) => {
            console.error("No se pudo guardar el repaso en .sinnotas/progress/reviews.json:", error);
          });
      }
    }
  }

  updateFlashcardUI();
}

/** Localiza la página y el bloque de un repaso guardado en el diario. */
function locateReviewBlock(event: ReviewProgressEvent): { page: PageData; block: BlockNode } | null {
  const page =
    vault.getPages().find((candidate) => candidate.path === event.pagePath) ||
    vault.getPageByTitle(event.pageTitle);
  if (!page) return null;
  const loc = findNodeLocation(page.blocks, event.blockId);
  if (!loc) return null;
  return { page, block: loc.parentList[loc.index] };
}

/**
 * Aplica el estado anterior (deshacer) o posterior (rehacer) de un repaso.
 * Solo actúa si la programación actual coincide con el estado esperado: si
 * otro equipo repasó la misma tarjeta después, no se pisa ese cambio.
 */
async function applyReviewSnapshot(
  event: ReviewProgressEvent,
  direction: "undo" | "redo"
): Promise<boolean> {
  const target = locateReviewBlock(event);
  if (!target) {
    showToast(translate("No se encontró la tarjeta del último repaso."));
    return false;
  }
  const expected = direction === "undo" ? event.after : event.before;
  const next = direction === "undo" ? event.before : event.after;
  const current = FlashcardsManager.readScheduleSnapshot(target.block.content);
  if (!FlashcardsManager.scheduleSnapshotsEqual(current, expected)) {
    showToast(
      translate(
        "La tarjeta cambió en otro dispositivo o nota; no se puede aplicar ese repaso."
      )
    );
    return false;
  }

  const previousContent = target.block.content;
  target.block.content = FlashcardsManager.applyScheduleSnapshot(target.block.content, next);
  documentHistory.beginRestore();
  try {
    await vault.savePage(target.page, true);
    documentHistory.markApplied(target.page.id, target.page.blocks, target.page.title);
    return true;
  } catch (error) {
    target.block.content = previousContent;
    console.error("No se pudo guardar el cambio de repaso:", error);
    showToast(translate("No se pudo guardar el cambio de repaso."));
    return false;
  } finally {
    documentHistory.endRestore();
  }
}

function adjustStatsForReviewEvent(event: ReviewProgressEvent, delta: 1 | -1): void {
  resetFlashcardDailyProgress();
  flashcardProgressStats.totalReviews = Math.max(
    0,
    flashcardProgressStats.totalReviews + delta
  );
  if (event.date === currentLocalDate()) {
    flashcardProgressStats.reviewsToday = Math.max(
      0,
      flashcardProgressStats.reviewsToday + delta
    );
  }
  flashcardProgressStats.points = Math.max(
    0,
    flashcardProgressStats.points + (flashcardPointDeltas[event.rating] ?? 0) * delta
  );
  saveFlashcardProgressStats();
  updateFlashcardProgressPanel();
}

/**
 * Refresca la cola de repaso tras deshacer o rehacer un repaso.
 *
 * El guard por vista es imprescindible: el gamepad puede invocar deshacer o
 * rehacer desde otras vistas, donde la sesión de flashcards no está activa.
 * El nombre de la función lo explicita, sin restringir el resto del flujo.
 *
 * - Deshacer: la sesión vuelve a la tarjeta del repaso deshecho, con la
 *   respuesta oculta y lista para puntuarse de nuevo; deshacer varias veces
 *   retrocede tarjeta a tarjeta. Se pasa `event.cardId` como tarjeta activa
 *   para que quede como actual tras reconstruir la cola.
 * - Rehacer: el repaso se vuelve a aplicar y la sesión avanza a la tarjeta
 *   siguiente de la cola. `getNextCardId` se calcula ANTES de refrescar porque
 *   `refreshCardSchedule` reconstruye la cola y muda los índices.
 *
 * En ambos casos la respuesta queda oculta (revealed false) y no se abre el
 * editor. Si el refresco falla, se reinicia la sesión (fallback previo).
 */
function refreshFlashcardsAfterReviewChange(
  event: ReviewProgressEvent,
  direction: "undo" | "redo"
): void {
  if (currentView === "flashcards") {
    const nextId = direction === "redo" ? flashcardsManager.getNextCardId(event.cardId) : null;
    const activeCardId = direction === "undo" ? event.cardId : nextId;
    const updated = locateReviewBlock(event);
    const refreshed = updated
      ? flashcardsManager.refreshCardSchedule(
          event.cardId,
          updated.block.content,
          flashcardReviewOrder,
          activeCardId,
          false
        )
      : null;
    if (refreshed) updateFlashcardUI();
    else startFlashcardsSession();
    renderFlashcardExplorer();
  }
}

async function undoLastReview(): Promise<void> {
  if (vaultSyncInFlight || isVaultSwitching || reviewHistoryActionInFlight) return;
  reviewHistoryActionInFlight = true;
  updateReviewHistoryButtons();
  try {
    const event = reviewProgress.takeUndo();
    if (!event) {
      showToast(translate("No hay ningún repaso reciente que deshacer."));
      return;
    }

    const applied = await applyReviewSnapshot(event, "undo");
    if (!applied) {
      reviewProgress.restoreUndo(event);
      return;
    }

    await reviewProgress.commitUndo(event);
    adjustStatsForReviewEvent(event, -1);
    refreshFlashcardsAfterReviewChange(event, "undo");
    showToast(translate("Último repaso deshecho."));
  } finally {
    reviewHistoryActionInFlight = false;
    updateReviewHistoryButtons();
  }
}

async function redoLastReview(): Promise<void> {
  if (vaultSyncInFlight || isVaultSwitching || reviewHistoryActionInFlight) return;
  reviewHistoryActionInFlight = true;
  updateReviewHistoryButtons();
  try {
    const event = reviewProgress.takeRedo();
    if (!event) {
      showToast(translate("No hay ningún repaso que rehacer."));
      return;
    }

    const applied = await applyReviewSnapshot(event, "redo");
    if (!applied) {
      reviewProgress.restoreRedo(event);
      return;
    }

    await reviewProgress.commitRedo(event);
    adjustStatsForReviewEvent(event, 1);
    refreshFlashcardsAfterReviewChange(event, "redo");
    showToast(translate("Repaso rehecho."));
  } finally {
    reviewHistoryActionInFlight = false;
    updateReviewHistoryButtons();
  }
}

function updateReviewHistoryButtons(): void {
  const inFlashcards = currentView === "flashcards";
  const blocked = !inFlashcards || reviewHistoryActionInFlight || vaultSyncInFlight;
  if (flashcardReviewUndo) flashcardReviewUndo.disabled = blocked || !reviewProgress.canUndo();
  if (flashcardReviewRedo) flashcardReviewRedo.disabled = blocked || !reviewProgress.canRedo();
}

/* ==================== GRAPH VIEW ==================== */
function formatGraphPreviewText(text: string): string {
  return text
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match: string, target: string, alias?: string) => alias || target)
    .replace(/\{\{(?:c\d+::|cloze\s+)?(.*?)\}\}/gi, "$1")
    .replace(/\*\*(.*?)\*\*|__(.*?)__/g, "$1$2")
    .replace(/\*(.*?)\*|_(.*?)_/g, "$1$2")
    .replace(/~~(.*?)~~|==(.*?)==/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function renderGraphPreviewContent(page: PageData): void {
  graphPreviewKickerEl.textContent = page.isJournal ? translate("Diario") : translate("Página");
  graphPreviewTitleEl.textContent = page.title;
  graphPreviewMetaEl.textContent = page.path;
  graphPreviewColorsEl.replaceChildren();
  const currentColor = graphView?.getNodeColor(page.title) ?? null;
  const neutralSwatch = document.createElement("button");
  neutralSwatch.className = "graph-color-swatch graph-color-swatch-neutral";
  neutralSwatch.type = "button";
  neutralSwatch.title = "Sin color manual (puede aplicar un grupo)";
  neutralSwatch.setAttribute("aria-label", "Sin color manual");
  if (currentColor === null) neutralSwatch.classList.add("is-active");
  neutralSwatch.addEventListener("click", () => {
    graphView?.setNodeColor(page.title, null);
    renderGraphPreviewContent(page);
  });
  graphPreviewColorsEl.appendChild(neutralSwatch);
  GRAPH_COLOR_PALETTE.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.className = "graph-color-swatch";
    swatch.type = "button";
    swatch.style.backgroundColor = color;
    swatch.title = color;
    swatch.setAttribute("aria-label", color);
    if (currentColor === color) swatch.classList.add("is-active");
    swatch.addEventListener("click", () => {
      graphView?.setNodeColor(page.title, color);
      renderGraphPreviewContent(page);
    });
    graphPreviewColorsEl.appendChild(swatch);
  });
  graphPreviewBodyEl.replaceChildren();

  const appendBlock = (block: BlockNode, depth: number): void => {
    const rawText = block.type === "image"
      ? block.imageAlt || translate("Imagen")
      : getVisibleBlockContent(block.content);
    const text = formatGraphPreviewText(rawText);

    if (text) {
      const line = document.createElement("div");
      line.className = "graph-preview-block";
      line.style.setProperty("--graph-preview-depth", String(Math.min(depth, 8)));

      const marker = document.createElement("span");
      marker.className = "graph-preview-marker";
      marker.textContent = block.type === "image" ? "▣" : "•";

      const content = document.createElement("span");
      content.className = "graph-preview-text";
      content.textContent = text;

      line.append(marker, content);
      graphPreviewBodyEl.appendChild(line);
    }

    block.children.forEach((child) => appendBlock(child, depth + 1));
  };

  page.blocks.forEach((block) => appendBlock(block, 0));

  if (!graphPreviewBodyEl.childElementCount) {
    const empty = document.createElement("p");
    empty.className = "graph-preview-empty";
    empty.textContent = translate("Esta nota no tiene contenido.");
    graphPreviewBodyEl.appendChild(empty);
  }
}

function closeGraphPreview(): void {
  if (graphPreviewTransitionTimer !== null) {
    window.clearTimeout(graphPreviewTransitionTimer);
    graphPreviewTransitionTimer = null;
  }
  graphPreviewEl.classList.remove("is-open", "is-switching");
  graphPreviewEl.setAttribute("aria-hidden", "true");
  graphPreviewPageTitle = null;
  graphView?.selectNode(null);
}

function showGraphPreview(pageTitle: string): void {
  const page = vault.getPageByTitle(pageTitle);
  if (!page) return;

  if (graphPreviewPageTitle === page.title && graphPreviewEl.classList.contains("is-open")) {
    closeGraphPreview();
    return;
  }

  if (graphPreviewTransitionTimer !== null) {
    window.clearTimeout(graphPreviewTransitionTimer);
    graphPreviewTransitionTimer = null;
  }

  const wasOpen = graphPreviewEl.classList.contains("is-open");
  graphPreviewPageTitle = page.title;
  graphView?.selectNode(page.title);
  graphPreviewEl.setAttribute("aria-hidden", "false");

  // Renderizar siempre el contenido de la nota seleccionada de inmediato. Si
  // se retrasaba, los clics rápidos entre nodos dejaban durante un instante el
  // título/cuerpo de la nota anterior (o incluso uno ya descartado).
  renderGraphPreviewContent(page);

  if (wasOpen) {
    graphPreviewEl.classList.add("is-switching");
    // Dos frames: uno para aplicar opacity 0 y otro para animar la entrada.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => graphPreviewEl.classList.remove("is-switching"));
    });
    return;
  }

  void graphPreviewEl.offsetWidth;
  graphPreviewEl.classList.add("is-open");
}

graphPreviewCloseButton.addEventListener("click", closeGraphPreview);
graphPreviewOpenButton.addEventListener("click", () => {
  if (!graphPreviewPageTitle) return;
  const title = graphPreviewPageTitle;
  closeGraphPreview();
  loadPage(title);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && graphPreviewEl.classList.contains("is-open")) {
    closeGraphPreview();
  }
});

function applyGraphPages(): void {
  if (!graphView) return;
  const allPages = vault.getPages();
  if (graphNeighborhoodOrigin) {
    const connected = connectedPageTitles(allPages, graphNeighborhoodOrigin);
    graphView.updateData(allPages.filter((page) => connected.has(page.title)));
    graphView.selectNode(graphNeighborhoodOrigin);
  } else {
    graphView.updateData(allPages);
  }
  graphRenderedNeighborhood = graphNeighborhoodOrigin;
  graphDataVersion = vault.getMutationVersion();
  if (btnGraphShowAll) {
    btnGraphShowAll.hidden = graphNeighborhoodOrigin === null;
    if (graphNeighborhoodLabel) {
      graphNeighborhoodLabel.textContent = graphNeighborhoodOrigin
        ? `${translate("Vecindad")}: ${graphNeighborhoodOrigin}`
        : translate("Ver todo el grafo");
    }
  }
}

/** Abre el grafo mostrando solo la nota actual y sus vecinas de 1 salto (T5). */
function openGraphNeighborhood(): void {
  graphNeighborhoodOrigin = currentPage.title;
  switchView("graph");
  requestAnimationFrame(() => {
    graphView?.resetView();
    graphView?.selectNode(currentPage.title);
  });
}

function clearGraphNeighborhood(): void {
  graphNeighborhoodOrigin = null;
  if (currentView === "graph") {
    renderGraphView();
    graphView?.resetView();
  }
}

function renderGraphView() {
  if (!graphView) {
    graphView = new GraphView("graph-canvas", (targetTitle: string) => {
      showGraphPreview(targetTitle);
    });
    (window as any).__graphClickBackground = () => closeGraphPreview();
  }
  graphView.resize();
  // Repintar solo cuando la bóveda cambió o cuando se entra/sale de la
  // vecindad. Volver a la pestaña del grafo ya no reconstruye nodos, enlaces y
  // lotes de revelado desde cero (con vaults grandes eso congelaba la
  // interfaz un instante en cada visita).
  const version = vault.getMutationVersion();
  if (version !== graphDataVersion || graphRenderedNeighborhood !== graphNeighborhoodOrigin) {
    applyGraphPages();
  }
  if (!graphSettingsPanel.hidden && graphSettingsUiReady) syncGraphSettingsUi();
}

btnGraphNeighborhood?.addEventListener("click", openGraphNeighborhood);
btnGraphShowAll?.addEventListener("click", clearGraphNeighborhood);


/* ==================== GRAPH SETTINGS UI ==================== */
let graphSettings: GraphSettings = loadGraphSettings();
let graphSettingsSaveTimer: number | null = null;

// Los ajustes del grafo viven ahora en un panel lateral de la propia vista de
// grafo (antes eran una pestaña de Ajustes). El panel es estático, así que sus
// listeners no se pierden al montar/desmontar el overlay de Ajustes.
const graphSettingsPanel = document.getElementById("graph-settings-panel") as HTMLElement;
const graphSettingsToggleButton = document.getElementById(
  "btn-toggle-graph-settings"
) as HTMLButtonElement | null;
const graphSettingsCloseButton = document.getElementById(
  "btn-close-graph-settings"
) as HTMLButtonElement | null;

function setGraphSettingsPanelOpen(open: boolean): void {
  if (!graphSettingsPanel) return;
  graphSettingsPanel.hidden = !open;
  graphSettingsToggleButton?.setAttribute("aria-expanded", String(open));
  graphSettingsToggleButton?.classList.toggle("active", open);
  if (open && graphSettingsUiReady) syncGraphSettingsUi();
}

if (graphSettingsToggleButton) {
  graphSettingsToggleButton.addEventListener("click", () => {
    setGraphSettingsPanelOpen(graphSettingsPanel.hidden);
  });
}
graphSettingsCloseButton?.addEventListener("click", () => setGraphSettingsPanelOpen(false));

// El overlay de Ajustes se quita del DOM al iniciar la app, así que los hijos
// deben buscarse cuando se usan (no al evaluar este módulo).
function graphColorRulesElement(): HTMLDivElement | null {
  return document.getElementById("graph-color-rules") as HTMLDivElement | null;
}

function graphRuleNameElement(): HTMLInputElement | null {
  return document.getElementById("graph-rule-name") as HTMLInputElement | null;
}

function graphRuleColorElement(): HTMLInputElement | null {
  return document.getElementById("graph-rule-color") as HTMLInputElement | null;
}

interface GraphSliderBinding {
  inputId: string;
  outputId: string;
  get: (settings: GraphSettings) => number;
  set: (settings: GraphSettings, value: number) => void;
  format: (value: number) => string;
}

const graphSliderBindings: GraphSliderBinding[] = [
  {
    inputId: "graph-repulsion",
    outputId: "graph-repulsion-value",
    get: (s) => s.physics.repulsion,
    set: (s, v) => { s.physics.repulsion = v; },
    format: (v) => String(Math.round(v)),
  },
  {
    inputId: "graph-link-strength",
    outputId: "graph-link-strength-value",
    get: (s) => s.physics.linkStrength,
    set: (s, v) => { s.physics.linkStrength = v; },
    format: (v) => v.toFixed(2),
  },
  {
    inputId: "graph-link-distance",
    outputId: "graph-link-distance-value",
    get: (s) => s.physics.linkDistance,
    set: (s, v) => { s.physics.linkDistance = v; },
    format: (v) => `${Math.round(v)} px`,
  },
  {
    inputId: "graph-center-strength",
    outputId: "graph-center-strength-value",
    get: (s) => s.physics.centerStrength,
    set: (s, v) => { s.physics.centerStrength = v; },
    format: (v) => v.toFixed(3),
  },
  {
    inputId: "graph-collision-strength",
    outputId: "graph-collision-strength-value",
    get: (s) => s.physics.collisionStrength,
    set: (s, v) => { s.physics.collisionStrength = v; },
    format: (v) => v.toFixed(1),
  },
  {
    inputId: "graph-velocity-decay",
    outputId: "graph-velocity-decay-value",
    get: (s) => s.physics.velocityDecay,
    set: (s, v) => { s.physics.velocityDecay = v; },
    format: (v) => v.toFixed(2),
  },
  {
    inputId: "graph-node-base",
    outputId: "graph-node-base-value",
    get: (s) => s.nodeBaseRadius,
    set: (s, v) => { s.nodeBaseRadius = v; },
    format: (v) => `${v.toFixed(1)} px`,
  },
  {
    inputId: "graph-node-connections",
    outputId: "graph-node-connections-value",
    get: (s) => s.nodePerConnectionRadius,
    set: (s, v) => { s.nodePerConnectionRadius = v; },
    format: (v) => `${v.toFixed(1)} px`,
  },
  {
    inputId: "graph-node-max",
    outputId: "graph-node-max-value",
    get: (s) => s.nodeMaxRadius,
    set: (s, v) => { s.nodeMaxRadius = v; },
    format: (v) => `${Math.round(v)} px`,
  },
  {
    inputId: "graph-link-width",
    outputId: "graph-link-width-value",
    get: (s) => s.linkWidth,
    set: (s, v) => { s.linkWidth = v; },
    format: (v) => `${v.toFixed(1)} px`,
  },
  {
    inputId: "graph-link-highlight-width",
    outputId: "graph-link-highlight-width-value",
    get: (s) => s.linkHighlightWidth,
    set: (s, v) => { s.linkHighlightWidth = v; },
    format: (v) => `${v.toFixed(1)} px`,
  },
  {
    inputId: "graph-label-zoom",
    outputId: "graph-label-zoom-value",
    get: (s) => s.labelZoomThreshold,
    set: (s, v) => { s.labelZoomThreshold = v; },
    format: (v) => `${v.toFixed(2)}×`,
  },
];

function cloneGraphSettingsForEdit(settings: GraphSettings): GraphSettings {
  return {
    ...settings,
    colorRules: settings.colorRules.map((rule) => ({ ...rule })),
    physics: { ...settings.physics },
  };
}

function scheduleGraphSettingsSave(): void {
  if (graphSettingsSaveTimer !== null) window.clearTimeout(graphSettingsSaveTimer);
  graphSettingsSaveTimer = window.setTimeout(() => {
    graphSettingsSaveTimer = null;
    saveGraphSettings(graphSettings);
  }, 120);
}

function applyGraphSettings(next: GraphSettings, persist = true): void {
  graphSettings = normalizeGraphSettings(next);
  graphView?.applySettings(graphSettings);
  // Refleja los límites cruzados (p. ej. radio máximo ≥ radio base).
  syncGraphSliderValues();
  if (persist) scheduleGraphSettingsSave();
}

function updateGraphSettings(mutator: (draft: GraphSettings) => void): void {
  const draft = cloneGraphSettingsForEdit(graphSettings);
  mutator(draft);
  applyGraphSettings(draft);
}

function graphSliderElements(binding: GraphSliderBinding): {
  input: HTMLInputElement | null;
  output: HTMLOutputElement | null;
} {
  return {
    input: document.getElementById(binding.inputId) as HTMLInputElement | null,
    output: document.getElementById(binding.outputId) as HTMLOutputElement | null,
  };
}

function syncGraphSliderValues(): void {
  for (const binding of graphSliderBindings) {
    const { input, output } = graphSliderElements(binding);
    const value = binding.get(graphSettings);
    if (input) input.value = String(value);
    if (output) output.value = binding.format(value);
  }
}

function renderGraphColorRules(): void {
  const container = graphColorRulesElement();
  if (!container) return;
  container.replaceChildren();

  graphSettings.colorRules.forEach((rule) => {
    const row = document.createElement("div");
    row.className = "graph-color-rule";

    const name = document.createElement("input");
    name.type = "text";
    name.value = rule.name;
    name.placeholder = "Texto del nombre";
    name.setAttribute("aria-label", "Texto del nombre del grupo de color");
    name.addEventListener("change", () => {
      const value = name.value.trim();
      if (!value) {
        name.value = rule.name;
        return;
      }
      updateGraphSettings((draft) => {
        const target = draft.colorRules.find((candidate) => candidate.id === rule.id);
        if (target) target.name = value;
      });
    });

    const color = document.createElement("input");
    color.type = "color";
    color.value = rule.color;
    color.setAttribute("aria-label", `Color para ${rule.name}`);
    color.addEventListener("input", () => {
      updateGraphSettings((draft) => {
        const target = draft.colorRules.find((candidate) => candidate.id === rule.id);
        if (target) target.color = color.value;
      });
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "font-option-btn";
    remove.textContent = "✕";
    remove.title = "Eliminar grupo";
    remove.setAttribute("aria-label", `Eliminar grupo ${rule.name}`);
    remove.addEventListener("click", () => {
      updateGraphSettings((draft) => {
        draft.colorRules = draft.colorRules.filter((candidate) => candidate.id !== rule.id);
      });
      renderGraphColorRules();
    });

    row.append(name, color, remove);
    container.appendChild(row);
  });
}

/** Sincroniza los controles con el estado guardado (al abrir la pestaña). */
function syncGraphSettingsUi(): void {
  syncGraphSliderValues();
  renderGraphColorRules();
}

function addGraphColorRule(): void {
  const nameInput = graphRuleNameElement();
  const name = nameInput?.value.trim() ?? "";
  if (!name) {
    nameInput?.focus();
    return;
  }
  const color = graphRuleColorElement()?.value || "#3b82f6";
  const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `graph-rule-${crypto.randomUUID()}`
    : `graph-rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const rule: GraphColorRule = { id, name, color };
  updateGraphSettings((draft) => {
    draft.colorRules = [...draft.colorRules, rule];
  });
  if (nameInput) nameInput.value = "";
  renderGraphColorRules();
}

function resetGraphSettings(): void {
  graphSettings = defaultGraphSettings();
  graphView?.applySettings(graphSettings);
  saveGraphSettings(graphSettings);
  syncGraphSettingsUi();
  showToast(translate("Ajustes del grafo restablecidos."));
}

// Delegación: los controles viven dentro del overlay, que se desmonta y vuelve
// a montar al abrir/cerrar Ajustes. Así los listeners siguen funcionando.
graphSettingsPanel.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const binding = graphSliderBindings.find((candidate) => candidate.inputId === target.id);
  if (!binding) return;
  const value = Number(target.value);
  if (!Number.isFinite(value)) return;
  const { output } = graphSliderElements(binding);
  if (output) output.value = binding.format(value);
  updateGraphSettings((draft) => binding.set(draft, value));
});

graphSettingsPanel.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const target = event.target;
  if (target instanceof HTMLElement && target.id === "graph-rule-name") {
    event.preventDefault();
    addGraphColorRule();
  }
});

graphSettingsPanel.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest("#btn-add-graph-color-rule")) {
    addGraphColorRule();
    return;
  }
  if (target.closest("#btn-reset-graph-settings")) {
    resetGraphSettings();
  }
});

syncGraphSettingsUi();
graphSettingsUiReady = true;

/* ==================== ALL PAGES VIEW ==================== */
const ALL_PAGES_PER_PAGE = 20;
const ALL_PAGES_SORT_STORAGE_KEY = "sinnotas-all-pages-sort";
let allPagesCurrentPage = 1;
let allPagesFiltered: PageData[] = [];
let allPagesSearchQuery = "";
let allPagesSearchTimer: number | null = null;

function readAllPagesSort(): AllPagesSort {
  try {
    const stored = localStorage.getItem(ALL_PAGES_SORT_STORAGE_KEY);
    return isAllPagesSort(stored) ? stored : "updated-desc";
  } catch {
    return "updated-desc";
  }
}

let allPagesSort: AllPagesSort = readAllPagesSort();

/* --- T2: anchos de columna persistentes --- */
const ALL_PAGES_WIDTHS_STORAGE_KEY = "sinnotas-all-pages-widths";
const ALL_PAGES_COLUMN_IDS = ["title", "blocks", "kind", "created", "updated", "actions"] as const;
type AllPagesColumnId = (typeof ALL_PAGES_COLUMN_IDS)[number];
const ALL_PAGES_DEFAULT_WIDTHS: Record<AllPagesColumnId, number> = {
  title: 300,
  blocks: 96,
  kind: 110,
  created: 165,
  updated: 165,
  actions: 96,
};
const ALL_PAGES_MIN_WIDTHS: Record<AllPagesColumnId, number> = {
  title: 80,
  blocks: 64,
  kind: 100,
  created: 110,
  updated: 110,
  actions: 50,
};
/* En el modo adaptativo el título conserva un mínimo más generoso que al
   arrastrar: así se recorta con puntos suspensivos pero sigue siendo legible. */
const ALL_PAGES_TITLE_FIT_MIN = 160;

function isAllPagesColumnId(value: unknown): value is AllPagesColumnId {
  return typeof value === "string" && (ALL_PAGES_COLUMN_IDS as readonly string[]).includes(value);
}

function readAllPagesColumnWidths(): Record<AllPagesColumnId, number> {
  const widths = { ...ALL_PAGES_DEFAULT_WIDTHS };
  try {
    const raw = localStorage.getItem(ALL_PAGES_WIDTHS_STORAGE_KEY);
    if (!raw) return widths;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return widths;
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isAllPagesColumnId(key)) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      widths[key] = Math.max(ALL_PAGES_MIN_WIDTHS[key], Math.min(1200, value));
    }
  } catch {
    // Un localStorage corrupto no debe romper la tabla.
  }
  return widths;
}

let allPagesColumnWidths = readAllPagesColumnWidths();
let allPagesRenderedWidths: Record<AllPagesColumnId, number> = { ...allPagesColumnWidths };
// Si el usuario nunca ha arrastrado una columna, la tabla se adapta al ancho
// disponible para que todo quepa y el título se recorte. En cuanto ajusta una
// columna, se respetan sus anchos (aunque eso active el scroll horizontal).
let allPagesHasCustomWidths = (() => {
  try {
    const raw = localStorage.getItem(ALL_PAGES_WIDTHS_STORAGE_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;
    // Una clave vacía o corrupta no debe desactivar el modo adaptativo.
    return Object.entries(parsed as Record<string, unknown>).some(
      ([key, value]) =>
        isAllPagesColumnId(key) && typeof value === "number" && Number.isFinite(value)
    );
  } catch {
    return false;
  }
})();

function allPagesTableAvailableWidth(table: HTMLTableElement): number {
  const container = table.closest<HTMLElement>(".table-view-container");
  if (!container) return 0;
  const style = window.getComputedStyle(container);
  const padding =
    (Number.parseFloat(style.paddingLeft) || 0) +
    (Number.parseFloat(style.paddingRight) || 0);
  return Math.max(0, container.clientWidth - padding);
}

/**
 * Reparte el ancho disponible: primero encoge o estira el título y, solo si
 * hace falta, reduce el resto de columnas hasta sus mínimos. Así el título
 * muestra puntos suspensivos en lugar de empujar la tabla fuera de la vista.
 */
function fittedAllPagesWidths(
  available: number
): Record<AllPagesColumnId, number> {
  const widths = { ...allPagesColumnWidths };
  if (available <= 0) return widths;
  const ids = [...ALL_PAGES_COLUMN_IDS];
  const total = ids.reduce((sum, id) => sum + widths[id], 0);
  if (total <= available) {
    widths.title += available - total;
    return widths;
  }

  let overflow = total - available;
  const titleShrink = Math.min(
    overflow,
    widths.title - Math.max(ALL_PAGES_MIN_WIDTHS.title, ALL_PAGES_TITLE_FIT_MIN)
  );
  widths.title -= titleShrink;
  overflow -= titleShrink;

  if (overflow > 0) {
    const otherIds = ids.filter((id) => id !== "title");
    const flexible = otherIds.reduce(
      (sum, id) => sum + (widths[id] - ALL_PAGES_MIN_WIDTHS[id]),
      0
    );
    if (flexible > 0) {
      const ratio = Math.min(1, overflow / flexible);
      otherIds.forEach((id) => {
        widths[id] -= (widths[id] - ALL_PAGES_MIN_WIDTHS[id]) * ratio;
      });
    }
  }

  ids.forEach((id) => {
    // Redondeo hacia abajo para que la suma nunca supere el ancho disponible
    // por culpa de los decimales (evita una barra de scroll de 1px).
    widths[id] = Math.max(ALL_PAGES_MIN_WIDTHS[id], Math.floor(widths[id]));
  });
  return widths;
}

function applyAllPagesColumnWidths(): void {
  const table = document.getElementById("all-pages-table") as HTMLTableElement | null;
  if (!table) return;
  const available = allPagesTableAvailableWidth(table);
  allPagesRenderedWidths = allPagesHasCustomWidths
    ? { ...allPagesColumnWidths }
    : fittedAllPagesWidths(available);
  table.querySelectorAll<HTMLTableColElement>("colgroup col[data-col]").forEach((col) => {
    const id = col.dataset.col;
    if (!isAllPagesColumnId(id)) return;
    col.style.width = `${allPagesRenderedWidths[id]}px`;
  });
}

function persistAllPagesColumnWidths(): void {
  try {
    localStorage.setItem(ALL_PAGES_WIDTHS_STORAGE_KEY, JSON.stringify(allPagesColumnWidths));
  } catch {
    // El redimensionado sigue funcionando durante la sesión.
  }
}

/** Actualiza `aria-sort` y el indicador visible de la cabecera activa. */
function syncAllPagesSortHeaders(): void {
  const table = document.getElementById("all-pages-table") as HTMLTableElement | null;
  if (!table) return;
  const { key, direction } = {
    key: allPagesSort.slice(0, allPagesSort.lastIndexOf("-")) as AllPagesSortKey,
    direction: allPagesSort.endsWith("-asc") ? "asc" : "desc",
  };
  table.querySelectorAll<HTMLTableCellElement>("th[data-sort-key]").forEach((th) => {
    const active = th.dataset.sortKey === key;
    th.setAttribute("aria-sort", active ? (direction === "asc" ? "ascending" : "descending") : "none");
    const indicator = th.querySelector<HTMLElement>(".sort-indicator");
    if (indicator) indicator.textContent = active ? (direction === "asc" ? "▲" : "▼") : "";
  });
}

function setAllPagesSort(next: AllPagesSort, persist = true): void {
  allPagesSort = next;
  if (persist) {
    try {
      localStorage.setItem(ALL_PAGES_SORT_STORAGE_KEY, allPagesSort);
    } catch {
      // La ordenación sigue activa aunque no se pueda persistir.
    }
  }
  allPagesCurrentPage = 1;
  renderAllPagesView();
}

/* Delegación: la tabla no se reconstruye entera salvo las filas, pero las
   cabeceras viven en el HTML estático; se enlazan una sola vez. */
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLElement>(".all-pages-sort-button");
  if (!button) return;
  const key = button.dataset.sortKey;
  if (key !== "title" && key !== "created" && key !== "updated") return;
  setAllPagesSort(nextAllPagesSort(allPagesSort, key));
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains("col-resizer")) return;
  const id = target.dataset.col;
  if (!isAllPagesColumnId(id)) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const delta = event.key === "ArrowRight" ? 20 : -20;
  allPagesHasCustomWidths = true;
  allPagesColumnWidths[id] = Math.max(
    ALL_PAGES_MIN_WIDTHS[id],
    Math.min(1200, allPagesRenderedWidths[id] + delta)
  );
  applyAllPagesColumnWidths();
  persistAllPagesColumnWidths();
});

/* Arrastre de los asas de columna. Se usa captura de puntero para que el
   gesto siga funcionando aunque el cursor salga de la cabecera. */
document.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains("col-resizer")) return;
  const id = target.dataset.col;
  if (!isAllPagesColumnId(id)) return;
  event.preventDefault();
  const startX = event.clientX;
  const startWidth = allPagesRenderedWidths[id];
  allPagesHasCustomWidths = true;
  target.setPointerCapture(event.pointerId);
  target.classList.add("is-resizing");

  const onMove = (moveEvent: PointerEvent): void => {
    const delta = moveEvent.clientX - startX;
    allPagesColumnWidths[id] = Math.max(
      ALL_PAGES_MIN_WIDTHS[id],
      Math.min(1200, startWidth + delta)
    );
    applyAllPagesColumnWidths();
  };

  const finish = (): void => {
    target.classList.remove("is-resizing");
    target.removeEventListener("pointermove", onMove);
    target.removeEventListener("pointerup", finish);
    target.removeEventListener("pointercancel", finish);
    persistAllPagesColumnWidths();
  };

  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerup", finish);
  target.addEventListener("pointercancel", finish);
});

/* Sin anchos personalizados, la tabla se reajusta al cambiar el tamaño de la
   ventana para seguir ocupando el ancho visible. */
window.addEventListener("resize", () => {
  if (allPagesHasCustomWidths || currentView !== "all-pages") return;
  applyAllPagesColumnWidths();
});

function renderAllPagesView() {
  const tbody = document.getElementById("all-pages-tbody") as HTMLTableSectionElement;
  const countEl = document.getElementById("all-pages-count") as HTMLSpanElement;
  const paginationEl = document.getElementById("all-pages-pagination") as HTMLElement;
  const prevBtn = document.getElementById("all-pages-prev") as HTMLButtonElement;
  const nextBtn = document.getElementById("all-pages-next") as HTMLButtonElement;
  const pageInfoEl = document.getElementById("all-pages-page-info") as HTMLSpanElement;
  const sortSelect = document.getElementById("all-pages-sort") as HTMLSelectElement | null;
  if (sortSelect && sortSelect.value !== allPagesSort) sortSelect.value = allPagesSort;
  tbody.innerHTML = "";
  applyAllPagesColumnWidths();
  syncAllPagesSortHeaders();

  const allPages = vault.getPages();
  const visiblePages = filterAllPages(allPages, allPagesSearchQuery, pageDisplayTitle);
  allPagesFiltered = sortAllPages(
    visiblePages,
    allPagesSort,
    pageDisplayTitle,
    flashcardPageCreatedMs
  );

  // Compatibilidad con bóvedas/cachés antiguas sin `createdAtMs`: se pide la
  // fecha de creación al backend una sola vez y se repinta. Con el snapshot
  // nuevo de Rust esta llamada no se hace.
  const missingCreatedTimes = allPages.some(
    (page) => !page.journalDate && typeof page.createdAtMs !== "number"
  );
  if (missingCreatedTimes && currentView === "all-pages") {
    void fillFlashcardPagesCreatedTimes(allPages.map((page) => page.title)).then((changed) => {
      if (changed && currentView === "all-pages") renderAllPagesView();
    });
  }

  countEl.innerText = `${allPagesFiltered.length} páginas`;

  const totalPages = Math.max(1, Math.ceil(allPagesFiltered.length / ALL_PAGES_PER_PAGE));
  if (allPagesCurrentPage > totalPages) allPagesCurrentPage = totalPages;

  const start = (allPagesCurrentPage - 1) * ALL_PAGES_PER_PAGE;
  const end = start + ALL_PAGES_PER_PAGE;
  const pageSlice = allPagesFiltered.slice(start, end);

  // Show/hide pagination
  if (totalPages > 1) {
    paginationEl.hidden = false;
    prevBtn.disabled = allPagesCurrentPage === 1;
    nextBtn.disabled = allPagesCurrentPage === totalPages;
    pageInfoEl.textContent = `Página ${allPagesCurrentPage} de ${totalPages}`;
  } else {
    paginationEl.hidden = true;
  }

  if (pageSlice.length === 0) {
    const row = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 6;
    emptyCell.className = "all-pages-empty";
    emptyCell.textContent = allPages.length === 0
      ? translate("Todavía no hay páginas en esta bóveda.")
      : translate("No hay notas cuyo título coincida con la búsqueda.");
    row.appendChild(emptyCell);
    tbody.appendChild(row);
  }

  pageSlice.forEach((p) => {
    const row = document.createElement("tr");
    const blockCount = getAllBlocksFlat(p.blocks).length;

    const nameCell = document.createElement("td");
    const linkCell = document.createElement("div");
    linkCell.className = "page-link-cell";
    linkCell.dataset.title = p.title;

    // Icono SVG según tipo de nota, en color accent.
    const iconWrap = document.createElement("span");
    iconWrap.className = "page-icon";
    iconWrap.innerHTML = p.isJournal
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M16 2v4M8 2v4M3 9h18"></path><path d="M8 13h3M8 17h6"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M8 13h8M8 17h8"></path></svg>';

    const title = document.createElement("span");
    const displayTitle = pageDisplayTitle(p);
    title.textContent = displayTitle;
    title.title = displayTitle;
    linkCell.append(iconWrap, title);
    nameCell.appendChild(linkCell);

    const blocksCell = document.createElement("td");
    const blocksCount = document.createElement("span");
    blocksCount.className = "blocks-count";
    blocksCount.textContent = String(blockCount);
    blocksCell.appendChild(blocksCount);

    const kindCell = document.createElement("td");
    const kindBadge = document.createElement("span");
    kindBadge.className = "badge-kind";
    const kindDot = document.createElement("span");
    kindDot.className = "badge-dot";
    kindBadge.append(kindDot, document.createTextNode(p.isJournal ? "Diario" : "Página"));
    kindCell.appendChild(kindBadge);

    const createdCell = document.createElement("td");
    createdCell.style.color = "var(--ls-text-muted)";
    createdCell.style.fontSize = scaledFontSize(13);
    createdCell.textContent = formatPageDate(
      pageCreatedMs(p, flashcardPageCreatedMs),
      currentLanguage()
    );

    const updatedCell = document.createElement("td");
    updatedCell.style.color = "var(--ls-text-muted)";
    updatedCell.style.fontSize = scaledFontSize(13);
    updatedCell.textContent = formatPageDate(pageUpdatedMs(p), currentLanguage());

    const actionsCell = document.createElement("td");
    actionsCell.style.textAlign = "right";

    const deleteButton = document.createElement("button");
    deleteButton.className = "btn-table-delete";
    deleteButton.dataset.id = p.id;
    deleteButton.title = "Eliminar página";
    deleteButton.textContent = "🗑️";
    actionsCell.appendChild(deleteButton);

    row.append(nameCell, blocksCell, kindCell, createdCell, updatedCell, actionsCell);

    row.querySelector(".page-link-cell")?.addEventListener("click", () => {
      loadPage(p.title);
    });

    row.addEventListener("contextmenu", (e: MouseEvent) => {
      e.preventDefault();
      showSidebarContextMenu(e.clientX, e.clientY, p.id, p.title);
    });

    row.querySelector(".btn-table-delete")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const confirmed = await confirmAction(`¿Eliminar la página "${p.title}" permanentemente?`, "Eliminar");
      if (confirmed) {
        vault.deletePage(p.id);
        // Mantener sincronizado el selector de notas de Flashcards.
        renderFlashcardPagesFilter(true);
        renderAllPagesView();
        renderSidebar();
        if (p.id === currentPage.id) {
          const remaining = vault.getPages();
          loadPage(remaining[0]?.title || "Bienvenido");
        }
        showToast(`Página "${p.title}" eliminada`);
      }
    });

    tbody.appendChild(row);
  });
}

/* ==================== JOURNALS VIEW ==================== */
function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Título visible de una nota. Los diarios se identifican por su fecha (el
 * archivo es `journals/YYYY_MM_DD.md`), así que la lista muestra siempre
 * "Diario <fecha>" aunque el stem interno use guiones bajos.
 */
function pageDisplayTitle(page: PageData): string {
  if (!page.isJournal || !page.journalDate) return page.title;
  const date = new Date(`${page.journalDate}T00:00:00`);
  const label = Number.isNaN(date.getTime())
    ? page.journalDate
    : date.toLocaleDateString(currentLanguage(), { dateStyle: "medium" });
  return `${translate("Diario")} ${label}`;
}

function renderJournalCalendar(container: HTMLElement, journalPages: PageData[]): void {
  const calendar = document.createElement("section");
  calendar.className = "journal-calendar";

  const header = document.createElement("header");
  header.className = "journal-calendar-header";
  const monthTitle = document.createElement("h2");
  const monthLabel = journalCalendarMonth.toLocaleDateString(currentLanguage(), {
    month: "long",
    year: "numeric",
  });
  if (currentLanguage() === "es") {
    monthTitle.textContent = monthLabel.charAt(0).toLowerCase() + monthLabel.slice(1);
  } else {
    monthTitle.textContent = monthLabel;
  }

  const navigation = document.createElement("div");
  navigation.className = "journal-calendar-navigation";
  const previousMonth = document.createElement("button");
  previousMonth.type = "button";
  previousMonth.className = "btn-icon";
  previousMonth.setAttribute("aria-label", translate("Mes anterior"));
  previousMonth.textContent = "‹";
  previousMonth.addEventListener("click", () => {
    journalCalendarMonth = new Date(
      journalCalendarMonth.getFullYear(),
      journalCalendarMonth.getMonth() - 1,
      1
    );
    renderJournalsView();
  });
  const nextMonth = document.createElement("button");
  nextMonth.type = "button";
  nextMonth.className = "btn-icon";
  nextMonth.setAttribute("aria-label", translate("Mes siguiente"));
  nextMonth.textContent = "›";
  nextMonth.addEventListener("click", () => {
    journalCalendarMonth = new Date(
      journalCalendarMonth.getFullYear(),
      journalCalendarMonth.getMonth() + 1,
      1
    );
    renderJournalsView();
  });
  navigation.append(previousMonth, nextMonth);
  header.append(monthTitle, navigation);

  const grid = document.createElement("div");
  grid.className = "journal-calendar-grid";
  ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].forEach((name) => {
    const weekday = document.createElement("span");
    weekday.className = "journal-calendar-weekday";
    weekday.textContent = name;
    grid.appendChild(weekday);
  });

  const existingDates = new Set(
    journalPages.map((page) => page.journalDate).filter((date): date is string => Boolean(date))
  );
  const firstOfMonth = new Date(
    journalCalendarMonth.getFullYear(),
    journalCalendarMonth.getMonth(),
    1
  );
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const firstCalendarDay = new Date(
    firstOfMonth.getFullYear(),
    firstOfMonth.getMonth(),
    1 - mondayOffset
  );
  const today = localDateKey(new Date());

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(
      firstCalendarDay.getFullYear(),
      firstCalendarDay.getMonth(),
      firstCalendarDay.getDate() + index
    );
    const dateKey = localDateKey(date);
    const isCurrentMonth = date.getMonth() === journalCalendarMonth.getMonth();
    const hasJournal = existingDates.has(dateKey);
    const day = document.createElement("button");
    day.type = "button";
    day.className = "journal-calendar-day";
    day.classList.toggle("outside-month", !isCurrentMonth);
    day.classList.toggle("is-today", dateKey === today);
    day.classList.toggle("has-journal", hasJournal);
    day.disabled = !isCurrentMonth;
    day.setAttribute(
      "aria-label",
      `${date.toLocaleDateString(currentLanguage(), { dateStyle: "full" })}${hasJournal ? `, ${translate("diario existente")}` : `, ${translate("crear diario")}`}`
    );
    const dayNumber = document.createElement("span");
    dayNumber.textContent = String(date.getDate());
    day.appendChild(dayNumber);
    if (hasJournal) {
      const marker = document.createElement("span");
      marker.className = "journal-calendar-marker";
      marker.setAttribute("aria-hidden", "true");
      day.appendChild(marker);
    }
    day.addEventListener("click", () => {
      const page = vault.createJournal(dateKey);
      loadPage(page.title);
    });
    grid.appendChild(day);
  }

  calendar.append(header, grid);
  container.appendChild(calendar);
}

function renderJournalsView() {
  const container = document.getElementById("journals-container") as HTMLDivElement;
  const scrollRoot = container.closest<HTMLElement>(".content-scroll");
  const previousScrollTop = scrollRoot?.scrollTop ?? 0;
  container.innerHTML = "";

  const journalPages = vault.getPages()
    .filter((page) => page.isJournal)
    .sort((left, right) => (right.journalDate || "").localeCompare(left.journalDate || ""));

  const layoutWrapper = document.createElement("div");
  layoutWrapper.className = "journals-layout-wrapper";
  container.appendChild(layoutWrapper);

  const entriesContainer = document.createElement("div");
  entriesContainer.className = "journals-entries-container";
  layoutWrapper.appendChild(entriesContainer);

  renderJournalCalendar(layoutWrapper, journalPages);

  if (journalPages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-backlinks";
    empty.textContent = "Selecciona una fecha para crear tu primer diario.";
    entriesContainer.appendChild(empty);
    if (scrollRoot) scrollRoot.scrollTop = previousScrollTop;
    return;
  }

  // Solo se listan los diarios existentes; su contenido se abre al pulsarlos.
  const listHeader = document.createElement("div");
  listHeader.className = "journals-list-header";
  const listTitle = document.createElement("h2");
  listTitle.textContent = translate("Diarios existentes");
  const listCount = document.createElement("span");
  listCount.className = "journals-list-count";
  listCount.textContent = `${journalPages.length} ${journalPages.length === 1 ? "diario" : "diarios"}`;
  listHeader.append(listTitle, listCount);
  entriesContainer.appendChild(listHeader);

  const totalPages = Math.max(1, Math.ceil(journalPages.length / JOURNALS_PAGE_SIZE));
  journalsPage = Math.min(Math.max(1, journalsPage), totalPages);
  const start = (journalsPage - 1) * JOURNALS_PAGE_SIZE;

  const list = document.createElement("ul");
  list.className = "journals-list";
  journalPages.slice(start, start + JOURNALS_PAGE_SIZE).forEach((journal) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "journals-list-item";
    button.title = `Abrir ${journal.title}`;
    const label = document.createElement("span");
    label.className = "journals-list-label";
    label.textContent = pageDisplayTitle(journal);
    const meta = document.createElement("span");
    meta.className = "journals-list-meta";
    meta.textContent = `${journal.blocks.length} ${journal.blocks.length === 1 ? "bullet" : "bullets"}`;
    button.append(label, meta);
    button.addEventListener("click", () => {
      loadPage(journal.title);
    });
    item.appendChild(button);
    list.appendChild(item);
  });
  entriesContainer.appendChild(list);

  if (totalPages > 1) {
    const pagination = document.createElement("div");
    pagination.className = "journals-pagination";
    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "font-option-btn";
    previous.textContent = translate("Anterior");
    previous.disabled = journalsPage === 1;
    previous.addEventListener("click", () => {
      journalsPage = Math.max(1, journalsPage - 1);
      renderJournalsView();
    });
    const info = document.createElement("span");
    info.className = "journals-pagination-info";
    info.textContent = `${translate("Página")} ${journalsPage} / ${totalPages}`;
    const next = document.createElement("button");
    next.type = "button";
    next.className = "font-option-btn";
    next.textContent = translate("Siguiente");
    next.disabled = journalsPage === totalPages;
    next.addEventListener("click", () => {
      journalsPage = Math.min(totalPages, journalsPage + 1);
      renderJournalsView();
    });
    pagination.append(previous, info, next);
    entriesContainer.appendChild(pagination);
  }

  if (scrollRoot) scrollRoot.scrollTop = previousScrollTop;
}

/* ==================== SIDEBAR & OMNIBAR (SMART SEARCH) ==================== */
/* ==================== BARRA LATERAL: FIJADAS Y RECIENTES ==================== */

/** Iconos de módulo: solo los usados por la lista lateral (los del omnibar son suyos). */
const SIDEBAR_JOURNAL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M16 2v4M8 2v4M3 9h18"></path><path d="M8 13h3M8 17h6"></path></svg>';
const SIDEBAR_PAGE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M8 13h8M8 17h8"></path></svg>';

/** Máximo de notas en Recientes: las 5 aperturas más recientes. */
const RECENT_PAGES_LIMIT = 5;

/**
 * Rutas de las últimas notas abiertas (la más reciente primero). Se guardar
 * por vault (clave `sinnotas-recent-pages:<vaultPathKey>`) y se resuelven
 * por ruta, así que sobreviven al reinicio y no dependen de ids efímeros.
 */
let recentPagePaths: string[] = [];

function recentPagesStorageKey(): string {
  return `sinnotas-recent-pages:${vaultPathKey(vault.getActiveRootPath() ?? "local")}`;
}

/** Lee la lista de recientes del vault activo; JSON dañado → lista vacía. */
function loadRecentPages(): void {
  try {
    const raw = localStorage.getItem(recentPagesStorageKey());
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) {
      recentPagePaths = [];
      return;
    }
    recentPagePaths = parsed
      .filter((path): path is string => typeof path === "string")
      .slice(0, RECENT_PAGES_LIMIT);
  } catch {
    recentPagePaths = [];
  }
}

function saveRecentPages(): void {
  try {
    localStorage.setItem(
      recentPagesStorageKey(),
      JSON.stringify(recentPagePaths.slice(0, RECENT_PAGES_LIMIT))
    );
  } catch {
    // Almacenamiento lleno o bloqueado: la lista sigue activa en memoria.
  }
}

/**
 * Registra la apertura de una nota (la más reciente va primero). Ignora las
 * páginas ajenas al vault activo (por id) para que un toque durante una
 * transición de bóveda no contamine la lista de la bóveda nueva.
 */
function touchRecentPage(page: PageData): void {
  if (!page.path) return;
  if (!vault.getPages().some((candidate) => candidate.id === page.id)) return;
  recentPagePaths = [
    page.path,
    ...recentPagePaths.filter((path) => path !== page.path),
  ].slice(0, RECENT_PAGES_LIMIT);
  saveRecentPages();
}

/** Mantiene Recientes al renombrar una nota, conservando su posición. */
function replaceRecentPath(oldPath: string, newPath: string): void {
  const index = recentPagePaths.indexOf(oldPath);
  if (index < 0 || !newPath) return;
  recentPagePaths[index] = newPath;
  // Evita duplicados si el nuevo título coincide con otro ya en la lista.
  recentPagePaths = recentPagePaths.filter(
    (path, position) => position === index || path !== newPath
  );
  saveRecentPages();
}

/** Construye el elemento de la lista lateral sin engancharlo a ningún padre. */
function buildSidebarItem(page: PageData): HTMLElement {
  const item = document.createElement("div");
  item.className = `nav-item vault-tree-page ${currentView === "editor" && page.id === currentPage.id ? "active" : ""
    }${page.pinned ? " sidebar-pinned" : ""}`;
  const pageLabel = pageDisplayTitle(page);
  const icon = document.createElement("span");
  icon.className = "vault-tree-page-icon";
  icon.innerHTML = page.isJournal ? SIDEBAR_JOURNAL_ICON : SIDEBAR_PAGE_ICON;
  const label = document.createElement("span");
  label.className = "vault-tree-page-label";
  label.title = pageLabel;
  label.textContent = pageLabel;
  item.append(icon, label);

  item.addEventListener("click", () => {
    openPage(page);
  });

  // Right Click Context Menu on Sidebar Page
  item.addEventListener("contextmenu", (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showSidebarContextMenu(e.clientX, e.clientY, page.id, page.title);
  });

  return item;
}

function renderSidebar() {
  sidebarPagesList.innerHTML = "";
  activeVaultName.innerText = vault.getActiveVaultName();

  const { pinned, recent } = selectSidebarPages(vault.getPages(), recentPagePaths);

  if (pinned.length > 0) {
    const pinnedHeader = document.createElement("div");
    pinnedHeader.className = "sidebar-section-title";
    pinnedHeader.style.fontSize = scaledFontSize(11);
    pinnedHeader.style.opacity = "0.7";
    pinnedHeader.textContent = translate("📌 Fijadas");
    sidebarPagesList.appendChild(pinnedHeader);
    pinned.forEach((page) => sidebarPagesList.appendChild(buildSidebarItem(page)));
  }

  if (recent.length > 0) {
    const recentHeader = document.createElement("div");
    recentHeader.className = "sidebar-section-title";
    recentHeader.style.fontSize = scaledFontSize(11);
    recentHeader.style.opacity = "0.7";
    recentHeader.textContent = translate("Recientes");
    sidebarPagesList.appendChild(recentHeader);
    recent.forEach((page) => sidebarPagesList.appendChild(buildSidebarItem(page)));
  }

  // El botón lleva a la vista completa: la sidebar no crea un nodo por cada
  // nota del vault.
  const totalPages = vault.getPages().length;
  if (totalPages > 0) {
    const loadMore = document.createElement("button");
    loadMore.className = "sidebar-load-more";
    loadMore.type = "button";
    loadMore.textContent = `${translate("Ver todas las notas")} (${totalPages})`;
    loadMore.addEventListener("click", () => {
      allPagesCurrentPage = 1;
      switchView("all-pages");
    });
    sidebarPagesList.appendChild(loadMore);
  }
}

/* ==================== VAULT MANAGER ==================== */
function vaultPathKey(rootPath: string): string {
  const normalized = rootPath.replace(/\\/g, "/").replace(/\/+$/, "");
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}

function loadVaultRegistry(): RegisteredVault[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(VAULT_REGISTRY_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Partial<RegisteredVault>;
      if (typeof candidate.rootPath !== "string" || !candidate.rootPath.trim()) return [];
      const rootPath = candidate.rootPath.replace(/[\\/]+$/, "");
      const key = vaultPathKey(rootPath);
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        rootPath,
        name: typeof candidate.name === "string" && candidate.name.trim()
          ? candidate.name.trim()
          : "Vault",
        lastOpenedAt: typeof candidate.lastOpenedAt === "number" ? candidate.lastOpenedAt : 0,
      }];
    });
  } catch (error) {
    console.warn("No se pudo leer la lista de bóvedas:", error);
    return [];
  }
}

function persistVaultRegistry(): void {
  try {
    localStorage.setItem(VAULT_REGISTRY_KEY, JSON.stringify(registeredVaults));
  } catch (error) {
    console.warn("No se pudo guardar la lista de bóvedas:", error);
  }
}

function registerKnownVault(rootPath: string, name: string): void {
  const cleanRoot = rootPath.replace(/[\\/]+$/, "");
  if (!cleanRoot) return;
  const key = vaultPathKey(cleanRoot);
  const existing = registeredVaults.find((entry) => vaultPathKey(entry.rootPath) === key);
  const entry: RegisteredVault = {
    rootPath: existing?.rootPath || cleanRoot,
    name: name.trim() || existing?.name || "Vault",
    lastOpenedAt: Date.now(),
  };
  if (existing) Object.assign(existing, entry);
  else registeredVaults.push(entry);
  registeredVaults.sort((left, right) => right.lastOpenedAt - left.lastOpenedAt);
  persistVaultRegistry();
  renderVaultManager();
}

function renderVaultManager(): void {
  const activeRootPath = vault.getActiveRootPath();
  const activeKey = activeRootPath ? vaultPathKey(activeRootPath) : null;
  vaultManagerList.replaceChildren();

  if (registeredVaults.length === 0) {
    const empty = document.createElement("div");
    empty.className = "vault-manager-empty";
    empty.textContent = isTauri()
      ? "Todavía no hay bóvedas registradas. Añade una carpeta para empezar."
      : "La gestión de varias bóvedas está disponible en la aplicación de escritorio.";
    vaultManagerList.appendChild(empty);
  }

  registeredVaults.forEach((entry) => {
    const entryKey = vaultPathKey(entry.rootPath);
    const isActive = activeKey === entryKey;
    const row = document.createElement("div");
    row.className = `vault-manager-item${isActive ? " is-active" : ""}`;

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "vault-manager-open";
    openButton.title = isActive ? `${entry.name} (bóveda activa)` : `Abrir ${entry.name}`;
    openButton.addEventListener("click", () => {
      if (isActive) {
        closeVaultManager();
        return;
      }
      void openVaultAtPath(entry.rootPath);
    });

    const icon = document.createElement("span");
    icon.className = "vault-manager-icon";
    icon.textContent = isActive ? "📂" : "📁";

    const details = document.createElement("span");
    details.className = "vault-manager-details";
    const name = document.createElement("span");
    name.className = "vault-manager-name";
    name.textContent = entry.name;
    const path = document.createElement("span");
    path.className = "vault-manager-path";
    path.textContent = entry.rootPath;
    details.append(name, path);
    openButton.append(icon, details);

    if (isActive) {
      const badge = document.createElement("span");
      badge.className = "vault-manager-badge";
      badge.textContent = "Activa";
      openButton.appendChild(badge);
    }

    row.appendChild(openButton);

    if (!isActive) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "vault-manager-remove";
      removeButton.title = `Quitar ${entry.name} de la lista`;
      removeButton.setAttribute("aria-label", `Quitar ${entry.name} de la lista`);
      removeButton.textContent = "×";
      removeButton.addEventListener("click", () => {
        void removeVaultFromManager(entry);
      });
      row.appendChild(removeButton);
    }

    vaultManagerList.appendChild(row);
  });

  btnAddVault.disabled = !isTauri();
  if (!isTauri()) {
    vaultManagerStatus.textContent = "La gestión de varias bóvedas requiere la aplicación de escritorio.";
  } else if (registeredVaults.length === 0) {
    vaultManagerStatus.textContent = "Añade una carpeta existente como bóveda.";
  } else {
    vaultManagerStatus.textContent = "Haz clic en una bóveda para abrirla.";
  }
}

async function removeVaultFromManager(entry: RegisteredVault): Promise<void> {
  if (!isTauri()) return;
  const activeRootPath = vault.getActiveRootPath();
  if (activeRootPath && vaultPathKey(activeRootPath) === vaultPathKey(entry.rootPath)) {
    showToast("No puedes quitar la bóveda que está activa.");
    return;
  }
  const confirmed = await confirmAction(
    `¿Quitar "${entry.name}" de la lista de bóvedas? La carpeta y sus notas no se eliminarán.`,
    "Quitar"
  );
  if (!confirmed) return;
  registeredVaults = registeredVaults.filter(
    (candidate) => vaultPathKey(candidate.rootPath) !== vaultPathKey(entry.rootPath)
  );
  persistVaultRegistry();
  renderVaultManager();
  showToast(`"${entry.name}" se quitó de la lista de bóvedas.`);
}

async function openVaultAtPath(rootPath: string): Promise<void> {
  if (!isTauri()) {
    showToast("La gestión de varias bóvedas requiere la aplicación de escritorio.");
    return;
  }
  if (isVaultSwitching) return;

  const activeRootPath = vault.getActiveRootPath();
  if (activeRootPath && vaultPathKey(activeRootPath) === vaultPathKey(rootPath)) {
    closeVaultManager();
    return;
  }

  isVaultSwitching = true;
  btnAddVault.disabled = true;
  vaultManagerStatus.textContent = "Abriendo bóveda…";
  try {
    await vault.flushPendingFileOperations();
    const snapshot = await invoke<VaultSnapshot>("load_vault", { rootPath });
    clearResolvedImages();
    vault.replaceVault(snapshot.pages, snapshot.rootPath, snapshot.vaultName);
    flashcardLoader.invalidate();
    await reviewProgress.load(true);
    updateReviewHistoryButtons();
    await vault.migrateLegacyRevisions();
    await migrateLegacySnapshotFiles();
    currentPage = snapshot.pages[0] || vault.createPage("Nueva nota");
    loadRecentPages();
    switchView("editor");
    renderFlashcardPagesFilter();
    resetNavigationHistory();
    registerKnownVault(snapshot.rootPath, snapshot.vaultName);
    closeVaultManager();
    await initializeSnapshotSubsystem();
    showToast(`Bóveda activa: ${snapshot.vaultName}`);
    if (snapshot.skipped && snapshot.skipped.length > 0) {
      showToast(`Se omitieron ${snapshot.skipped.length} notas (errores de lectura/permisos/tamaño).`);
    }
  } catch (error) {
    console.error("No se pudo abrir la bóveda seleccionada:", error);
    vaultManagerStatus.textContent = "No se pudo abrir la bóveda. Revisa que la carpeta siga existiendo.";
    showToast("No se pudo abrir la bóveda. Revisa los permisos de la carpeta e inténtalo de nuevo.");
  } finally {
    isVaultSwitching = false;
    btnAddVault.disabled = !isTauri();
  }
}

function openVaultManager(): void {
  const activeRootPath = vault.getActiveRootPath();
  if (activeRootPath && isTauri()) {
    registerKnownVault(activeRootPath, vault.getActiveVaultName());
  } else {
    renderVaultManager();
  }
  mountOverlay(vaultManagerOverlay);
  btnCloseVaultManager.focus();
}

function closeVaultManager(): void {
  unmountOverlay(vaultManagerOverlay);
}

async function selectVaultFolder(): Promise<void> {
  if (!isTauri()) {
    showToast("La selección de bóvedas requiere la aplicación de escritorio.");
    return;
  }

  try {
    const selectedPath = await invoke<string | null>("pick_vault_root");
    if (!selectedPath) return;
    await openVaultAtPath(selectedPath);
  } catch (error) {
    console.error("No se pudo seleccionar la carpeta de la bóveda:", error);
    showToast("No se pudo abrir la carpeta seleccionada. Revisa los permisos e inténtalo de nuevo.");
  }
}

btnSelectVault.addEventListener("click", () => {
  openVaultManager();
});
btnCloseVaultManager.addEventListener("click", closeVaultManager);
btnAddVault.addEventListener("click", () => {
  void selectVaultFolder();
});
vaultManagerOverlay.addEventListener("click", (event) => {
  if (event.target === vaultManagerOverlay) closeVaultManager();
});

/* Omnibar Search & Quick Creator Dropdown */
let selectedDropdownIndex = 0;
let searchResultsCloseTimer: number | null = null;
let searchResultsPendingClear = false;

function openSearchResults(): void {
  if (searchResultsCloseTimer !== null) {
    window.clearTimeout(searchResultsCloseTimer);
    searchResultsCloseTimer = null;
  }
  const wasVisible = searchResultsDropdown.classList.contains("visible");
  const wasClosing = searchResultsDropdown.classList.contains("is-menu-closing");
  searchResultsPendingClear = false;
  searchResultsDropdown.classList.remove("is-menu-closing");
  searchResultsDropdown.classList.add("visible");
  if (!wasVisible || wasClosing) {
    replayAnimation(searchResultsDropdown, "is-menu-opening");
  }
}

function closeSearchResults(clear = false): void {
  searchResultsPendingClear = searchResultsPendingClear || clear;
  if (!searchResultsDropdown.classList.contains("visible")) {
    if (searchResultsPendingClear) {
      searchResultsDropdown.innerHTML = "";
      searchResultsPendingClear = false;
    }
    return;
  }
  if (searchResultsCloseTimer !== null) return;

  searchResultsDropdown.classList.remove("is-menu-opening");
  searchResultsDropdown.classList.add("is-menu-closing");

  const finish = () => {
    searchResultsCloseTimer = null;
    searchResultsDropdown.classList.remove("visible");
    searchResultsDropdown.classList.remove("is-menu-closing");
    if (searchResultsPendingClear) {
      searchResultsDropdown.innerHTML = "";
      searchResultsPendingClear = false;
    }
  };
  const delay = motionDuration(MENU_CLOSE_MS);
  if (delay === 0) {
    finish();
    return;
  }
  searchResultsCloseTimer = window.setTimeout(finish, delay);
}

function updateOmnibarDropdown() {
  const query = sidebarSearchInput.value.trim();

  if (!query) {
    closeSearchResults(true);
    // Consulta vacía: solo cancela la búsqueda de contenido pendiente.
    scheduleContentSearch("");
    return;
  }

  const pages = vault.getPages();
  const lowerQuery = query.toLowerCase();
  const matches = pages.filter((p) => p.title.toLowerCase().includes(lowerQuery));
  const exactMatch = pages.some((p) => p.title.toLowerCase() === lowerQuery);

  searchResultsDropdown.innerHTML = "";
  openSearchResults();
  selectedDropdownIndex = 0;

  // 1. Option to create note if no exact match
  if (!exactMatch) {
    const createItem = document.createElement("div");
    createItem.className = "search-dropdown-item create-new";
    const createLabel = document.createElement("span");
    createLabel.append(document.createTextNode("✨ Crear nota "));
    const createTitle = document.createElement("strong");
    createTitle.textContent = `"${query}"`;
    createLabel.appendChild(createTitle);
    const createBadge = document.createElement("span");
    createBadge.className = "badge-tag";
    createBadge.textContent = "Nueva";
    createItem.append(createLabel, createBadge);
    createItem.addEventListener("click", () => {
      const newPage = vault.createPage(query);
      sidebarSearchInput.value = "";
      closeSearchResults(true);
      showToast(`Nota "${query}" creada`);
      loadPage(newPage.title);
    });
    searchResultsDropdown.appendChild(createItem);
  }

  // 2. Matching existing pages
  matches.forEach((m) => {
    const item = document.createElement("div");
    item.className = "search-dropdown-item";
    const pageLabel = pageDisplayTitle(m);
    const pageIcon = m.isJournal
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M16 2v4M8 2v4M3 9h18"></path><path d="M8 13h3M8 17h6"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M8 13h8M8 17h8"></path></svg>';
    const result = document.createElement("span");
    result.className = "search-dropdown-page";
    const icon = document.createElement("span");
    icon.className = "vault-tree-page-icon";
    icon.innerHTML = pageIcon;
    const label = document.createElement("span");
    label.className = "vault-tree-page-label";
    label.title = pageLabel;
    label.textContent = pageLabel;
    result.append(icon, label);
    item.appendChild(result);
    item.addEventListener("click", () => {
      sidebarSearchInput.value = "";
      closeSearchResults(true);
      loadPage(m.title);
    });
    searchResultsDropdown.appendChild(item);
  });

  highlightDropdownItem(0);
  // Resultados "En el contenido": con debonce para no competir con los
  // resultados por título (que pintan al instante).
  scheduleContentSearch(query);
}

/* ==================== BÚSQUEDA DE CONTENIDO (OMNIBAR) ==================== */

/** Índice en memoria del contenido del vault; se reconstruye solo al cambiar la versión. */
const contentSearchIndex = new ContentSearchIndex();
let contentSearchTimer: number | null = null;

function cancelScheduledContentSearch(): void {
  if (contentSearchTimer !== null) {
    clearTimeout(contentSearchTimer);
    contentSearchTimer = null;
  }
}

/**
 * Lanza la búsqueda de contenido con debonce de 150 ms y un mínimo de 2
 * caracteres. Con la consulta vacía solo cancela lo pendiente.
 */
function scheduleContentSearch(query: string): void {
  cancelScheduledContentSearch();
  if (query.trim().length < 2) return;
  contentSearchTimer = window.setTimeout(() => {
    contentSearchTimer = null;
    // Antes de cada búsqueda se refresca el índice con la versión del vault.
    contentSearchIndex.update(vault.getPages(), vault.getMutationVersion());
    renderContentResults(query, contentSearchIndex.search(query));
  }, 150);
}

/**
 * Añade la sección "En el contenido (N)" al desplegable. Se descarta si la
 * consulta del input ya no es la buscada (el debonce puede quedar obsoleto)
 * o si no hay coincidencias. El título va sin el prefijo diario/journal y los
 * fragmentos se pintan con textContent y mark: nunca con HTML del contenido
 * de una nota.
 */
function renderContentResults(query: string, hits: ContentHit[]): void {
  if (hits.length === 0) return;
  if (sidebarSearchInput.value.trim() !== query) return;
  if (searchResultsCloseTimer !== null) return;
  if (!searchResultsDropdown.classList.contains("visible")) return;

  const header = document.createElement("div");
  header.className = "sidebar-section-title search-dropdown-content-title";
  header.textContent = `${translate("En el contenido")} (${hits.length})`;
  searchResultsDropdown.appendChild(header);

  hits.forEach((hit) => {
    const item = document.createElement("div");
    item.className = "search-dropdown-item search-dropdown-content";

    const title = document.createElement("strong");
    title.textContent = hit.page.title.replace(/^(?:diario|journal)\s+/i, "");

    // El índice del hit apunta al texto plegado: el fragmento solo se resalta
    // si el plegado no cambió la longitud; si la cambió, se muestra el inicio
    // del bloque sin resaltado.
    const text = visibleBlockText(hit.block.content);
    const snippet =
      fold(text).length === text.length
        ? buildSnippet(text, hit.index, hit.matchLength)
        : buildSnippet(text, 0, 0);

    const excerpt = document.createElement("span");
    excerpt.className = "search-dropdown-snippet";
    excerpt.append(snippet.before);
    if (snippet.match) {
      const mark = document.createElement("mark");
      mark.textContent = snippet.match;
      excerpt.append(mark);
    }
    excerpt.append(snippet.after);

    item.append(title, excerpt);
    item.addEventListener("click", () => openContentHit(hit, query));
    searchResultsDropdown.appendChild(item);
  });

  // Reaplica la selección vigente para que flechas y Enter funcionen también
  // sobre los resultados de contenido.
  highlightDropdownItem(selectedDropdownIndex);
}

/**
 * Abre la nota del resultado y deja el cursor en el bloque coincidente. El
 * ajuste de scroll va en un requestAnimationFrame para que el DOM del editor
 * ya esté pintado cuando se busque el `.block-item`.
 */
function openContentHit(hit: ContentHit, query = ""): void {
  sidebarSearchInput.value = "";
  closeSearchResults(true);
  openPage(hit.page);
  cursorState = { blockId: hit.block.id, offset: 0 };
  requestAnimationFrame(() => {
    // CSS.escape: los ids de bloque pueden contener caracteres del selector.
    let item = document.querySelector<HTMLElement>(
      `.block-item[data-id="${CSS.escape(hit.block.id)}"]`
    );
    if (!item) return;

    // Si el bloque vive dentro de un padre colapsado, el editor no lo pinta.
    if (expandAncestorsToBlock(currentPage.blocks, hit.block.id)) {
      renderBlocksTree();
      const refreshed = document.querySelector<HTMLElement>(
        `.block-item[data-id="${CSS.escape(hit.block.id)}"]`
      );
      if (!refreshed) return;
      item = refreshed;
    }

    item.scrollIntoView({ behavior: "smooth", block: "center" });
    item.classList.remove("search-hit-pulse");
    // Reinicia la animación si se pulsea dos veces el mismo bloque.
    void item.offsetWidth;
    item.classList.add("search-hit-pulse");
    item.addEventListener("animationend", () => item.classList.remove("search-hit-pulse"), {
      once: true,
    });

    const editor = item.querySelector<HTMLElement>(".block-editor");
    if (!editor) return;
    const range = locateMatch(
      editor.textContent || "",
      query,
      hit.index,
      hit.matchLength
    );
    if (range) selectEditorRange(editor, range.start, range.end);
  });
}

/**
 * Expande los ancestros colapsados de un bloque. Devuelve true si cambió el
 * estado de algún nodo, para que el llamador vuelva a pintar el árbol.
 */
function expandAncestorsToBlock(blocks: BlockNode[], targetId: string): boolean {
  const walk = (nodes: BlockNode[], ancestors: BlockNode[]): boolean => {
    for (const node of nodes) {
      if (node.id === targetId) {
        let changed = false;
        ancestors.forEach((ancestor) => {
          if (ancestor.collapsed) {
            ancestor.collapsed = false;
            changed = true;
          }
        });
        return changed;
      }
      if (node.children.length > 0 && walk(node.children, [...ancestors, node])) {
        return true;
      }
    }
    return false;
  };
  return walk(blocks, []);
}

/** Selecciona un rango de texto plano dentro de un `contenteditable`. */
function createTextRange(editor: HTMLElement, start: number, end: number): Range | null {
  const range = document.createRange();
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let current = 0;
  let started = false;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length || 0;
    if (!started && start <= current + length) {
      range.setStart(node, Math.max(0, start - current));
      started = true;
    }
    if (started && end <= current + length) {
      range.setEnd(node, Math.max(0, end - current));
      break;
    }
    current += length;
    node = walker.nextNode();
  }
  return started ? range : null;
}

function selectEditorRange(editor: HTMLElement, start: number, end: number): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = createTextRange(editor, start, end);
  if (!range) return;
  selection.removeAllRanges();
  selection.addRange(range);
}

/* ==================== BUSCAR DENTRO DE LA NOTA (T20) ==================== */
let noteFindMatches: NoteMatch[] = [];
let noteFindIndex = -1;
let noteFindQuery = "";
let noteFindDebounce: number | null = null;
let noteFindPreviousFocus: HTMLElement | null = null;
let noteFindUsedNativeSelection = false;

function updateNoteFindCount(): void {
  if (!noteFindCount) return;
  noteFindCount.textContent =
    noteFindMatches.length === 0 ? "0/0" : `${noteFindIndex + 1}/${noteFindMatches.length}`;
}

/** Borra el resaltado nativo o de la Highlight API sin tocar el contenido. */
function clearNoteFindHighlight(): void {
  const highlights = (CSS as unknown as { highlights?: Map<string, unknown> } | undefined)
    ?.highlights;
  highlights?.delete("note-find-active");
  if (noteFindUsedNativeSelection) {
    window.getSelection()?.removeAllRanges();
    noteFindUsedNativeSelection = false;
  }
  blocksContainer
    .querySelectorAll<HTMLElement>(".note-find-current")
    .forEach((item) => item.classList.remove("note-find-current"));
}

/**
 * La Highlight API pinta el rango sin mover el foco (el usuario sigue
 * escribiendo en la barra). Si el WebView no la soporta se usa una selección
 * nativa como respaldo.
 */
function setNoteFindHighlight(range: Range): void {
  const HighlightCtor = (window as unknown as { Highlight?: new (range: Range) => unknown })
    .Highlight;
  const highlights = (CSS as unknown as { highlights?: Map<string, unknown> } | undefined)
    ?.highlights;
  if (typeof HighlightCtor === "function" && highlights) {
    highlights.set("note-find-active", new HighlightCtor(range));
    return;
  }
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
  noteFindUsedNativeSelection = true;
}

function runNoteFind(resetIndex = true): void {
  if (!noteFindBar || noteFindBar.hidden || !noteFindInput) return;
  noteFindQuery = noteFindInput.value;
  noteFindMatches = noteFindQuery
    ? findMatchesInBlocks(currentPage.blocks, noteFindQuery)
    : [];
  clearNoteFindHighlight();

  if (noteFindMatches.length === 0) {
    noteFindIndex = -1;
    updateNoteFindCount();
    return;
  }
  noteFindIndex =
    resetIndex || noteFindIndex < 0
      ? 0
      : Math.min(noteFindIndex, noteFindMatches.length - 1);
  showNoteFindMatch(noteFindIndex);
}

function showNoteFindMatch(index: number): void {
  const match = noteFindMatches[index];
  if (!match) return;
  noteFindIndex = index;
  clearNoteFindHighlight();

  // Un bullet dentro de un padre colapsado no existe en el DOM: se expande y
  // se repinta antes de buscar su editor.
  if (expandAncestorsToBlock(currentPage.blocks, match.blockId)) {
    renderBlocksTree();
  }

  const item = blocksContainer.querySelector<HTMLElement>(
    `.block-item[data-id="${CSS.escape(match.blockId)}"]`
  );
  if (!item) {
    updateNoteFindCount();
    return;
  }

  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  item.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  item.classList.add("note-find-current");

  const editor = item.querySelector<HTMLElement>(".block-editor");
  const range = editor
    ? locateMatch(
        editor.textContent || "",
        noteFindQuery,
        match.start,
        match.end - match.start
      )
    : null;

  // Mantener el foco en la barra permite pulsar Enter para seguir saltando.
  noteFindInput?.focus({ preventScroll: true });
  if (editor && range) {
    const domRange = createTextRange(editor, range.start, range.end);
    if (domRange) setNoteFindHighlight(domRange);
  }
  updateNoteFindCount();
}

function moveNoteFind(delta: number): void {
  if (noteFindMatches.length === 0) return;
  const next =
    (noteFindIndex + delta + noteFindMatches.length) % noteFindMatches.length;
  showNoteFindMatch(next);
}

/** Abre Ctrl/Cmd+F solo dentro del editor y sin robar el buscar del navegador. */
function openNoteFind(): void {
  if (!noteFindBar || !noteFindInput || currentView !== "editor") return;
  if (!noteFindBar.hidden) {
    // Ya estaba abierta: no sustituir el foco previo por el propio input.
    noteFindInput.focus();
    noteFindInput.select();
    runNoteFind(true);
    return;
  }
  noteFindPreviousFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
    const anchor = selection.anchorNode;
    const selected = selection.toString();
    if (
      anchor &&
      blocksContainer.contains(anchor) &&
      selected.length > 0 &&
      selected.length <= 120 &&
      !selected.includes("\n")
    ) {
      noteFindInput.value = selected;
    }
  }

  noteFindBar.hidden = false;
  noteFindInput.focus();
  noteFindInput.select();
  runNoteFind(true);
}

function closeNoteFind(restoreFocus = true): void {
  if (!noteFindBar || noteFindBar.hidden) return;
  if (noteFindDebounce !== null) {
    window.clearTimeout(noteFindDebounce);
    noteFindDebounce = null;
  }
  noteFindBar.hidden = true;
  clearNoteFindHighlight();
  noteFindMatches = [];
  noteFindIndex = -1;
  noteFindQuery = "";

  if (restoreFocus) {
    const previous =
      noteFindPreviousFocus &&
      noteFindPreviousFocus !== noteFindInput &&
      noteFindPreviousFocus.isConnected
        ? noteFindPreviousFocus
        : blocksContainer.querySelector<HTMLElement>(".block-editor");
    previous?.focus({ preventScroll: true });
  }
  noteFindPreviousFocus = null;
}

noteFindInput?.addEventListener("input", () => {
  if (noteFindDebounce !== null) window.clearTimeout(noteFindDebounce);
  noteFindDebounce = window.setTimeout(() => {
    noteFindDebounce = null;
    runNoteFind(true);
  }, 120);
});

noteFindInput?.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    moveNoteFind(event.shiftKey ? -1 : 1);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    event.stopPropagation();
    moveNoteFind(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    event.stopPropagation();
    moveNoteFind(-1);
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeNoteFind();
  }
});

noteFindBar?.addEventListener("keydown", (event: KeyboardEvent) => {
  // Evita que Enter/Escape lleguen a los atajos globales del editor.
  if (event.key === "Enter" || event.key === "Escape") event.stopPropagation();
});

btnNoteFindPrev?.addEventListener("click", () => moveNoteFind(-1));
btnNoteFindNext?.addEventListener("click", () => moveNoteFind(1));
btnNoteFindClose?.addEventListener("click", () => closeNoteFind());


/* ==================== VISTA DIVIDIDA: PANEL DE REFERENCIA (T7, fase 1) ==================== */
const SPLIT_VIEW_FLAG_KEY = "sinnotas-split-view";
const SPLIT_REFERENCE_KEY = "sinnotas-split-reference-page";
const SPLIT_REFERENCE_LIST_KEY = "sinnotas-split-reference-pages";
const SPLIT_OPEN_KEY = "sinnotas-split-open";
const MAX_REFERENCE_NOTES = 2;

/** Flag de emergencia: `localStorage["sinnotas-split-view"] = "false"` lo oculta. */
function splitViewEnabled(): boolean {
  return localStorage.getItem(SPLIT_VIEW_FLAG_KEY) !== "false";
}

function readReferenceNoteTitles(): string[] {
  const normalize = (values: unknown[]): string[] => {
    const seen = new Set<string>();
    const titles: string[] = [];
    for (const value of values) {
      if (typeof value !== "string") continue;
      const title = value.trim();
      if (!title || seen.has(title) || titles.length >= MAX_REFERENCE_NOTES) continue;
      seen.add(title);
      titles.push(title);
    }
    return titles;
  };

  try {
    const raw = localStorage.getItem(SPLIT_REFERENCE_LIST_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const titles = normalize(parsed);
        return titles.length > 0 ? titles : [""];
      }
    }
    // Migración desde la clave antigua de una sola nota de referencia.
    const legacy = localStorage.getItem(SPLIT_REFERENCE_KEY)?.trim();
    if (legacy) return [legacy];
  } catch {
    // Un localStorage corrupto no debe impedir abrir el panel.
  }
  return [""];
}

let referenceNoteTitles: string[] = readReferenceNoteTitles();

function persistReferenceNoteTitles(): void {
  const titles = referenceNoteTitles
    .map((title) => title.trim())
    .filter((title, index, all) => Boolean(title) && all.indexOf(title) === index)
    .slice(0, MAX_REFERENCE_NOTES);
  try {
    localStorage.setItem(SPLIT_REFERENCE_LIST_KEY, JSON.stringify(titles));
    localStorage.removeItem(SPLIT_REFERENCE_KEY);
  } catch {
    // La selección sigue funcionando durante la sesión.
  }
}

/** Pinta una nota como texto enriquecido de solo lectura, sin contenteditable. */
function renderReferenceBlocks(nodes: BlockNode[], container: HTMLElement, depth = 0): void {
  nodes.forEach((node) => {
    const wrapper = document.createElement("div");
    wrapper.className = "reference-block";
    wrapper.style.setProperty("--reference-depth", String(Math.min(depth, 12)));

    if (node.type === "image") {
      const image = document.createElement("div");
      image.className = "reference-block-image";
      image.textContent = `🖼 ${node.imageAlt?.trim() || "Imagen"}`;
      wrapper.appendChild(image);
    } else {
      const text = stripSystemProperties(node.content).trim();
      if (text) {
        const content = document.createElement("div");
        content.className = "reference-block-content markdown-rendered";
        content.innerHTML = sanitizeHtml(renderMarkdownToHtml(text));
        wrapper.appendChild(content);
      }
    }

    if (node.children.length > 0) {
      const children = document.createElement("div");
      children.className = "reference-children";
      renderReferenceBlocks(node.children, children, depth + 1);
      if (children.childElementCount > 0) wrapper.appendChild(children);
    }

    if (wrapper.childElementCount > 0) container.appendChild(wrapper);
  });
}

function referencePageChoices(): PageData[] {
  return vault
    .getPages()
    .filter((page) => page.title !== currentPage.title)
    .slice()
    .sort((a, b) =>
      pageDisplayTitle(a).localeCompare(pageDisplayTitle(b), currentLanguage(), {
        numeric: true,
        sensitivity: "base",
      })
    );
}

function referencePageMatches(query: string): PageData[] {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  const pages = referencePageChoices();
  if (tokens.length === 0) return pages;
  return pages.filter((page) => {
    const haystack = fold(`${pageDisplayTitle(page)}\u0000${page.title}\u0000${page.path}`);
    return tokens.every((token) => haystack.includes(token));
  });
}

function updateReferencePaneChrome(): void {
  if (referencePaneCount) {
    const count = referenceNoteTitles.filter(Boolean).length;
    referencePaneCount.textContent = `${count}/${MAX_REFERENCE_NOTES}`;
  }
  if (btnAddReferencePane) {
    btnAddReferencePane.hidden = referenceNoteTitles.length >= MAX_REFERENCE_NOTES;
    btnAddReferencePane.disabled = referenceNoteTitles.length >= MAX_REFERENCE_NOTES;
  }
}

function selectReferenceNote(index: number, title: string): void {
  if (index < 0 || index >= referenceNoteTitles.length) return;
  referenceNoteTitles[index] = title;
  persistReferenceNoteTitles();
  renderReferenceSlots();
}

/** Crea el buscador de una ranura de referencia con resultados filtrados. */
function createReferenceNotePicker(
  index: number,
  selectedTitle: string
): HTMLElement {
  const picker = document.createElement("div");
  picker.className = "reference-note-picker";

  // El valor guardado es el título interno; en el buscador mostramos el mismo
  // título legible que aparece en la lista (p. ej. la fecha de un diario).
  const selectedPage = selectedTitle ? vault.getPageByTitle(selectedTitle) : null;
  const selectedDisplayTitle = selectedPage
    ? pageDisplayTitle(selectedPage)
    : selectedTitle;

  const search = document.createElement("div");
  search.className = "reference-note-search";

  const icon = document.createElement("span");
  icon.className = "reference-note-search-icon";
  icon.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';

  const input = document.createElement("input");
  input.type = "search";
  input.className = "reference-note-search-input";
  input.placeholder = translate("Buscar nota de referencia…");
  input.setAttribute("aria-label", translate("Buscar nota de referencia"));
  input.autocomplete = "off";
  input.spellcheck = false;
  input.value = selectedDisplayTitle;
  if (selectedDisplayTitle) input.title = selectedDisplayTitle;

  const results = document.createElement("div");
  results.className = "reference-note-results";
  results.setAttribute("role", "listbox");
  results.hidden = true;

  // La ranura recorta su contenido: limitar la altura de la lista al espacio
  // real evita que las últimas opciones queden fuera de la vista.
  const fitResultsToSlot = (): void => {
    const slot = picker.closest(".reference-slot");
    const top = results.getBoundingClientRect().top;
    const bottom = slot ? slot.getBoundingClientRect().bottom : window.innerHeight;
    const available = bottom - top - 8;
    results.style.maxHeight = `${Math.max(72, Math.min(230, available))}px`;
  };

  let activeChoices: PageData[] = [];

  const hideResults = (): void => {
    results.hidden = true;
    results.replaceChildren();
  };

  const choose = (title: string): void => {
    hideResults();
    const page = vault.getPageByTitle(title);
    const displayTitle = page ? pageDisplayTitle(page) : title;
    input.value = displayTitle;
    input.title = displayTitle;
    selectReferenceNote(index, title);
  };

  const renderResults = (query: string): void => {
    activeChoices = referencePageMatches(query);
    results.replaceChildren();
    if (activeChoices.length === 0) {
      const empty = document.createElement("div");
      empty.className = "reference-note-results-empty";
      empty.textContent = translate("No hay notas coincidentes.");
      results.appendChild(empty);
    } else {
      activeChoices.forEach((page) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "reference-note-option";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(page.title === selectedTitle));
        const label = document.createElement("span");
        label.className = "reference-note-option-title";
        label.textContent = pageDisplayTitle(page);
        const meta = document.createElement("span");
        meta.className = "reference-note-option-meta";
        meta.textContent = page.isJournal ? translate("Diario") : translate("Página");
        option.append(label, meta);
        // `pointerdown` evita que el blur del input cierre la lista antes del clic.
        option.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          choose(page.title);
        });
        results.appendChild(option);
      });
    }
    results.hidden = false;
    fitResultsToSlot();
  };

  input.addEventListener("focus", () => {
    if (selectedDisplayTitle && input.value === selectedDisplayTitle) input.select();
    renderResults("");
  });
  input.addEventListener("input", () => renderResults(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const first = activeChoices[0];
      if (first && !results.hidden) choose(first.title);
    } else if (event.key === "Escape") {
      hideResults();
      input.value = selectedDisplayTitle;
      input.title = selectedDisplayTitle;
      input.blur();
    }
  });
  input.addEventListener("blur", () => {
    window.setTimeout(hideResults, 120);
  });

  search.append(icon, input);
  picker.append(search, results);
  return picker;
}

function createReferenceSlot(index: number, selectedTitle: string): HTMLElement {
  const slot = document.createElement("section");
  slot.className = "reference-slot";
  slot.dataset.referenceIndex = String(index);
  slot.setAttribute("aria-label", `${translate("Nota de referencia")} ${index + 1}`);

  const header = document.createElement("header");
  header.className = "reference-slot-header";

  const label = document.createElement("span");
  label.className = "reference-slot-label";
  label.textContent = `${translate("Referencia")} ${index + 1}`;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn-icon reference-slot-remove";
  remove.title = translate("Quitar nota de referencia");
  remove.setAttribute("aria-label", translate("Quitar nota de referencia"));
  remove.textContent = "×";
  remove.addEventListener("click", () => {
    referenceNoteTitles.splice(index, 1);
    if (referenceNoteTitles.length === 0) referenceNoteTitles = [""];
    persistReferenceNoteTitles();
    renderReferenceSlots();
  });

  header.append(label, remove);

  const picker = createReferenceNotePicker(index, selectedTitle);

  const body = document.createElement("div");
  body.className = "reference-slot-body";

  const page = selectedTitle ? vault.getPageByTitle(selectedTitle) : null;
  if (!selectedTitle) {
    const empty = document.createElement("div");
    empty.className = "reference-pane-empty";
    empty.textContent = translate("Busca y elige una nota para verla aquí.");
    body.appendChild(empty);
  } else if (!page) {
    const missing = document.createElement("div");
    missing.className = "reference-pane-empty";
    missing.textContent = translate("Esta nota ya no existe en la bóveda.");
    body.appendChild(missing);
  } else {
    const pageBody = document.createElement("div");
    pageBody.className = "reference-page";
    renderReferenceBlocks(page.blocks, pageBody);
    if (pageBody.childElementCount === 0) {
      const empty = document.createElement("div");
      empty.className = "reference-pane-empty";
      empty.textContent = translate("Esta nota no tiene contenido.");
      body.appendChild(empty);
    } else {
      body.appendChild(pageBody);
    }
  }

  slot.append(header, picker, body);
  return slot;
}

function renderReferenceSlots(): void {
  if (!referenceSlots) return;
  referenceSlots.replaceChildren();
  referenceNoteTitles.forEach((title, index) => {
    referenceSlots.appendChild(createReferenceSlot(index, title));
  });
  updateReferencePaneChrome();
}

/** Carga las notas de referencia elegidas en el panel derecho. */
function renderReferencePane(title?: string): void {
  if (!referencePane) return;
  if (title) {
    const clean = title.trim();
    if (clean && clean !== currentPage.title && !referenceNoteTitles.includes(clean)) {
      if (referenceNoteTitles.length === 0) {
        referenceNoteTitles = [clean];
      } else if (!referenceNoteTitles[0]) {
        referenceNoteTitles[0] = clean;
      } else if (referenceNoteTitles.length < MAX_REFERENCE_NOTES) {
        referenceNoteTitles.push(clean);
      } else {
        referenceNoteTitles[0] = clean;
      }
    }
  }
  if (referenceNoteTitles.length === 0) referenceNoteTitles = [""];
  if (referenceNoteTitles.length > MAX_REFERENCE_NOTES) {
    referenceNoteTitles = referenceNoteTitles.slice(0, MAX_REFERENCE_NOTES);
  }
  persistReferenceNoteTitles();
  renderReferenceSlots();
}

function openReferencePane(title?: string): void {
  if (!splitViewEnabled() || !referencePane) return;
  document.body.classList.add("editor-split-active");
  referencePane.hidden = false;
  btnSplitView?.classList.add("active");
  btnSplitView?.setAttribute("aria-pressed", "true");
  localStorage.setItem(SPLIT_OPEN_KEY, "true");
  renderReferencePane(title);
}

function closeReferencePane(): void {
  if (!referencePane) return;
  document.body.classList.remove("editor-split-active");
  referencePane.hidden = true;
  btnSplitView?.classList.remove("active");
  btnSplitView?.setAttribute("aria-pressed", "false");
  localStorage.setItem(SPLIT_OPEN_KEY, "false");
}

/** Restaura el panel tras recargar; solo si el flag sigue activo. */
function restoreEditorSplitView(): void {
  if (!btnSplitView) return;
  if (!splitViewEnabled()) {
    btnSplitView.hidden = true;
    return;
  }
  if (localStorage.getItem(SPLIT_OPEN_KEY) !== "true") return;
  requestAnimationFrame(() => openReferencePane());
}

btnSplitView?.addEventListener("click", () => {
  if (!referencePane) return;
  if (referencePane.hidden) openReferencePane();
  else closeReferencePane();
});
btnCloseReferencePane?.addEventListener("click", closeReferencePane);
btnAddReferencePane?.addEventListener("click", () => {
  if (referenceNoteTitles.length >= MAX_REFERENCE_NOTES) return;
  referenceNoteTitles.push("");
  renderReferenceSlots();
});

if (!splitViewEnabled() && btnSplitView) btnSplitView.hidden = true;
btnSplitView?.setAttribute("aria-pressed", String(!referencePane?.hidden));

function highlightDropdownItem(index: number) {

  const items = searchResultsDropdown.querySelectorAll<HTMLDivElement>(".search-dropdown-item");
  if (items.length === 0) return;

  items.forEach((it, idx) => {
    it.classList.toggle("selected", idx === index);
  });
  selectedDropdownIndex = index;
}

sidebarSearchInput.addEventListener("input", updateOmnibarDropdown);

sidebarSearchInput.addEventListener("keydown", (e: KeyboardEvent) => {
  const items = searchResultsDropdown.querySelectorAll<HTMLDivElement>(".search-dropdown-item");

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (items.length > 0) {
      const next = (selectedDropdownIndex + 1) % items.length;
      highlightDropdownItem(next);
      items[next].scrollIntoView({ block: "nearest" });
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (items.length > 0) {
      const prev = (selectedDropdownIndex - 1 + items.length) % items.length;
      highlightDropdownItem(prev);
      items[prev].scrollIntoView({ block: "nearest" });
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (items.length > 0 && selectedDropdownIndex < items.length) {
      items[selectedDropdownIndex].click();
    } else {
      const title = sidebarSearchInput.value.trim();
      if (title) {
        const newPage = vault.createPage(title);
        sidebarSearchInput.value = "";
        closeSearchResults(true);
        loadPage(newPage.title);
      }
    }
  } else if (e.key === "Escape") {
    closeSearchResults();
  }
});

window.addEventListener("click", (e) => {
  if (!sidebarSearchInput.contains(e.target as Node) && !searchResultsDropdown.contains(e.target as Node)) {
    closeSearchResults();
  }
});

/* ==================== GLOBAL KEYBOARD SHORTCUTS ==================== */
window.addEventListener("keydown", (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
    const target = e.target instanceof HTMLElement ? e.target : null;
    const inAnotherField =
      target !== null &&
      target !== noteFindInput &&
      (target.matches("input, textarea, select") ||
        (target.isContentEditable && !target.closest("#view-editor")));
    if (currentView === "editor" && !hasMountedModal() && !inAnotherField) {
      e.preventDefault();
      openNoteFind();
      return;
    }
  }

  if (e.key === "Escape" && noteFindBar && !noteFindBar.hidden) {
    e.preventDefault();
    closeNoteFind();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "/") {
    // No abrir atajos encima de otro diálogo (ajustes, historial, etc.).
    if (hasMountedModalExcept(shortcutsModalOverlay)) return;
    e.preventDefault();
    toggleShortcutsModal();
    return;
  }

  if (e.key === "Escape" && wikilinkAutocompleteMenu && !wikilinkAutocompleteMenu.hidden) {
    hideWikilinkAutocomplete();
  }
  if (e.key === "Escape" && slashMenu && !slashMenu.hidden) {
    hideSlashMenu();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
    e.preventDefault();
    toggleSidebar();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
    e.preventDefault();
    if (sidebarLeft.classList.contains("is-collapsed")) {
      toggleSidebar();
    }
    sidebarSearchInput.focus();
    sidebarSearchInput.select();
    updateOmnibarDropdown();
    return;
  }

  if (e.key === "Escape") {
    closeAllModalOverlays();
    hideAllContextMenus();
    closeSearchResults();
  }

  // No interceptar atajos de flashcards mientras se escribe en un campo editable
  // (evita que una tecla tecleada en un input/ editor salte o califique tarjetas).
  const flashcardKeyboardTarget = e.target;
  const isTypingInField =
    flashcardKeyboardTarget instanceof HTMLElement &&
    (flashcardKeyboardTarget.matches("input, textarea, select") ||
      flashcardKeyboardTarget.isContentEditable);

  if (currentView === "flashcards" && !flashcardExplorerActive && !isTypingInField) {
    if (e.key === " " && !flashcardsManager.isRevealed()) {
      e.preventDefault();
      handleRevealAnswer();
      return;
    }
    if (flashcardsManager.isRevealed()) {
      const keyAgain = flashcardKeyAgain.value;
      const keyHard = flashcardKeyHard.value;
      const keyGood = flashcardKeyGood.value;
      const keyEasy = flashcardKeyEasy.value;

      if (e.key === keyAgain) applyFSRSRating(1);
      else if (e.key === keyHard) applyFSRSRating(2);
      else if (e.key === keyGood) applyFSRSRating(3);
      else if (e.key === keyEasy) applyFSRSRating(4);
    }
  }
}, true);

/* ==================== SINCRONIZACIÓN ENTRE DISPOSITIVOS ==================== */
let vaultSyncInFlight = false;
let lastVaultSyncAt = 0;
let vaultFocusSyncTimer: number | null = null;

/**
 * Una vuelta desde otra ventana puede disparar `focus` y `visibilitychange` a
 * la vez. Se unifican en una sola sincronización diferida: así no se lanza un
 * `load_vault` doble ni se reescribe la tarjeta activa dos veces (T18).
 */
function scheduleVaultFocusSync(): void {
  if (currentView !== "flashcards" || document.hidden) return;
  if (vaultFocusSyncTimer !== null) window.clearTimeout(vaultFocusSyncTimer);
  vaultFocusSyncTimer = window.setTimeout(() => {
    vaultFocusSyncTimer = null;
    if (currentView !== "flashcards" || document.hidden) return;
    void synchronizeVaultFromDisk({ notify: false }).then((changed) => {
      if (changed || currentView !== "flashcards" || flashcardLoading) return;
      // Al volver puede haber vencido una tarjeta mientras la ventana estaba
      // en segundo plano; reconstruir la cola sin salir de la sesión (T23).
      if (!flashcardsManager.getCurrentCard() && !flashcardExplorerActive) {
        refreshDueFlashcardQueue();
      }
    });
  }, 300);
}


function blocksContentSignature(blocks: BlockNode[]): unknown[] {
  return blocks.map((block) => [
    block.id,
    block.type,
    block.content,
    block.imageAlt || "",
    blocksContentSignature(block.children || []),
  ]);
}

function vaultContentSignature(pages: PageData[]): string {
  return JSON.stringify(
    pages
      .map((page) => [page.path, page.title, page.frontmatter || [], blocksContentSignature(page.blocks)])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0])))
  );
}

/**
 * Vuelve a leer la bóveda desde disco y aplica cambios externos (por ejemplo,
 * repasos hechos en el móvil). Antes de leer se vacían las escrituras
 * pendientes para no pisar una edición local. Solo se usa estando en
 * Flashcards, de modo que nunca interrumpe la escritura en el editor.
 */
async function synchronizeVaultFromDisk(options: { notify?: boolean; force?: boolean } = {}): Promise<boolean> {
  if (!isTauri() || isVaultSwitching || vaultSyncInFlight) return false;
  if (!options.force && Date.now() - lastVaultSyncAt < 1500) return false;
  if (currentView !== "flashcards") return false;

  vaultSyncInFlight = true;
  updateReviewHistoryButtons();
  try {
    const beforeSignature = vaultContentSignature(vault.getPages());
    await vault.flushPendingFileOperations();
    const snapshot = await invoke<VaultSnapshot>("load_vault", {
      rootPath: vault.getActiveRootPath(),
    });
    lastVaultSyncAt = Date.now();
    if (vaultContentSignature(snapshot.pages) === beforeSignature) {
      if (options.notify) showToast(translate("La bóveda ya está sincronizada."));
      return false;
    }

    const activeCard = flashcardsManager.getCurrentCard();
    const activeCardId = activeCard?.id || null;
    const wasRevealed = flashcardsManager.isRevealed();
    const activePagePath = currentPage.path;
    clearResolvedImages();
    vault.replaceVault(snapshot.pages, snapshot.rootPath, snapshot.vaultName);
    flashcardLoader.invalidate();
    // El vault se recargó: releeer recientes para descartar rutas que dejaron
    // de existir en disco.
    loadRecentPages();
    await reviewProgress.load(true);
    updateReviewHistoryButtons();
    const nextPage =
      vault.getPages().find((page) => page.path === activePagePath) ||
      vault.getPageByTitle(currentPage.title) ||
      vault.getPages()[0];
    if (nextPage) {
      currentPage = nextPage;
      lastValidPageTitle = currentPage.title;
    }
    documentHistory.clearAll();
    if (nextPage) {
      documentHistory.seed(currentPage.id, currentPage.blocks, currentPage.title);
    }
    renderSidebar();
    renderFlashcardPagesFilter(false);
    // Un solo escaneo: antes se hacía `startFlashcardsSession()` y después
    // `refreshCard()`, recorriendo las 1.500 notas dos veces seguidas.
    startFlashcardsSession(
      activeCardId ? { cardId: activeCardId, revealed: wasRevealed } : undefined
    );
    if (snapshot.skipped && snapshot.skipped.length > 0) {
      showToast(`Se omitieron ${snapshot.skipped.length} notas (errores de lectura/permisos/tamaño).`);
    } else if (options.notify) {
      showToast(translate("Bóveda sincronizada con los últimos cambios."));
    }
    return true;
  } catch (error) {
    console.error("No se pudo sincronizar la bóveda desde disco:", error);
    if (options.notify) showToast(translate("No se pudo sincronizar la bóveda."));
    return false;
  } finally {
    vaultSyncInFlight = false;
    updateReviewHistoryButtons();
  }
}


function normalizeDeltaPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

let vaultCacheDeltaListenerReady = false;

/**
 * Escucha los cambios que el watcher nativo de Rust detecta fuera de la app
 * (por ejemplo, al editar el vault con otro editor). El delta llega ya
 * parseado y solo se aplica al vault en memoria.
 */
async function installVaultCacheDeltaListener(): Promise<void> {
  if (!isTauri() || vaultCacheDeltaListenerReady) return;
  try {
    await listen<VaultCacheDelta>("vault-cache-delta", ({ payload }) => {
      if (!payload || isVaultSwitching) return;
      const activeRoot = vault.getActiveRootPath();
      if (!activeRoot || normalizeDeltaPath(activeRoot) !== normalizeDeltaPath(payload.rootPath)) return;

      // Mientras se escribe en el editor, la nota abierta no se reemplaza:
      // el DOM y el cursor siguen mandando hasta el próximo guardado/recarga.
      const editingOpenPage = currentView === "editor" || currentView === "journals";
      const result = vault.applyExternalDelta(payload, {
        skipPaths: editingOpenPage ? [currentPage.path] : [],
      });
      if (!result.changed.length && !result.added.length && !result.removed.length) return;

      flashcardLoader.invalidate();

      if (!editingOpenPage) {
        const previousPath = currentPage.path;
        const updated = vault.getPages().find((page) => page.path === previousPath);
        if (updated) {
          currentPage = updated;
          lastValidPageTitle = currentPage.title;
        } else if (result.removed.includes(previousPath)) {
          currentPage = vault.getPages()[0] || currentPage;
          lastValidPageTitle = currentPage.title;
        }
      }

      renderSidebar();
      if (currentView === "flashcards") {
        renderFlashcardPagesFilter(false);
      } else if (currentView === "kanban") {
        renderKanbanBoard();
      } else if (currentView === "all-pages") {
        renderAllPagesView();
      }

      // La evaluación de datos del grafo se agenda en el siguiente frame para
      // no competir con la física ni con la escritura del usuario.
      if (currentView === "graph" && typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => graphView?.updateData(vault.getPages()));
      }
    });
    vaultCacheDeltaListenerReady = true;
  } catch (error) {
    console.error("No se pudo escuchar los cambios externos del vault:", error);
  }
}

function isAndroidDesktopRuntime(): boolean {
  const platform = (import.meta.env.TAURI_ENV_PLATFORM || "").toLowerCase();
  return isTauri() && (platform === "android" || /android/i.test(navigator.userAgent));
}

async function initializeNativeVault(): Promise<void> {
  if (!isTauri()) return;

  clearResolvedImages();
  let savedRootPath = vault.getActiveRootPath();
  if (isAndroidDesktopRuntime() && !savedRootPath) {
    try {
      savedRootPath = await invoke<string | null>("pick_vault_root");
    } catch (error) {
      console.error("No se pudo abrir el selector de bóvedas de Android:", error);
      showToast("No se pudo abrir el selector de carpetas. Se usará la bóveda interna.");
    }
  }
  try {
    const snapshot = await invoke<VaultSnapshot>("load_vault", { rootPath: savedRootPath });
    if (snapshot.pages.length > 0 || savedRootPath) {
      vault.replaceVault(snapshot.pages, snapshot.rootPath, snapshot.vaultName);
      flashcardLoader.invalidate();
      // La migración de revisiones se hace después del primer pintado.
      if (snapshot.pages.length === 0) currentPage = vault.createPage("Nueva nota");
      else currentPage = vault.getPageByTitle(currentPage.title) || snapshot.pages[0];
      registerKnownVault(snapshot.rootPath, snapshot.vaultName);
      if (snapshot.skipped && snapshot.skipped.length > 0) {
        showToast(`Se omitieron ${snapshot.skipped.length} notas (errores de lectura/permisos/tamaño).`);
      }
      return;
    }

    vault.setActiveVault(snapshot.rootPath, snapshot.vaultName);
    registerKnownVault(snapshot.rootPath, snapshot.vaultName);
    const initialSaves = vault.getPages().map((page) => {
      if (!page.path.startsWith(snapshot.rootPath)) {
        page.path = `${snapshot.rootPath.replace(/[\\/]+$/, "")}/${page.path.replace(/^[\\/]+/, "")}`;
      }
      return vault.savePage(page);
    });
    await Promise.all(initialSaves);
    currentPage = vault.getPageByTitle(currentPage.title) || vault.getPages()[0];
    if (snapshot.skipped && snapshot.skipped.length > 0) {
      showToast(`Se omitieron ${snapshot.skipped.length} notas (errores de lectura/permisos/tamaño).`);
    }
  } catch (error) {
    console.error("No se pudo inicializar el almacenamiento del vault:", error);
    showToast("No se pudo acceder al vault local de la aplicación.");
  }
}

/** Ejecuta trabajo pesado después del primer pintado real. */
function scheduleAfterFirstPaint(task: () => void, delay = 0): void {
  const run = () => window.setTimeout(task, delay);
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(run));
  } else {
    window.setTimeout(task, delay);
  }
}

/**
 * Pinta una vez las vistas que aún no se han abierto, en tiempo ocioso. Así el
 * primer cambio de vista no paga a la vez el escaneo de datos y la creación
 * del DOM. No cambia la vista activa ni el historial de navegación.
 */
function schedulePrewarmHiddenViews(): void {
  if (!desktopReady) return;

  const tasks: Array<{ view: ViewType; run: () => void }> = [
    { view: "journals", run: renderJournalsView },
    { view: "all-pages", run: renderAllPagesView },
    { view: "kanban", run: renderKanbanBoard },
  ];
  const pending = tasks.filter((task) => task.view !== currentView);

  const scheduleNext = (): void => {
    if (pending.length === 0) return;
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(runNext, { timeout: 3000 });
    } else {
      window.setTimeout(runNext, 120);
    }
  };

  const runNext = (): void => {
    const task = pending.shift();
    if (!task) return;
    if (task.view !== currentView) {
      try {
        task.run();
      } catch (error) {
        console.error(`No se pudo precalentar la vista ${task.view}:`, error);
      }
    }
    scheduleNext();
  };

  scheduleNext();
}

async function initializeDesktopApp(): Promise<void> {
  initThemeAndTypography();
  initUpdateSettings();
  loadFlashcardProgressStats();
  scheduleFlashcardDailyReset();
  installFlashcardDailyResetWatchers();
  renderPomodoro();
  initSidebarState();
  await installVaultCacheDeltaListener();
  await initializeNativeVault();
  // La bóveda (web o nativa) ya está activa: cargar el registro de recientes
  // de este vault antes del primer renderSidebar().
  loadRecentPages();
  desktopReady = true;
  updateReviewHistoryButtons();

  // No bloquear el primer pintado esperando el diario de repasos. Los botones
  // de deshacer/rehacer se habilitan solos cuando termina la lectura.
  const reviewProgressReady = reviewProgress
    .load(true)
    .then(() => updateReviewHistoryButtons())
    .catch((error) => {
      console.error("No se pudo cargar el historial de repasos:", error);
    });

  window.addEventListener("focus", scheduleVaultFocusSync);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleVaultFocusSync();
  });
  // Los diarios se crean únicamente cuando el usuario pulsa una fecha en el
  // calendario. Antes se creaba el diario de hoy en cada arranque, lo que
  // ensuciaba el vault y la lista de páginas sin intervención del usuario.
  renderSidebar();

  // Tras recargar la app, volver a la última nota y vista abierta en lugar de
  // abrir siempre la primera página (o un diario que no estaba en uso).
  const lastNavigation = readLastNavigation();
  let restored = false;
  if (lastNavigation) {
    const page = vault.getPages().find((candidate) => candidate.id === lastNavigation.pageId);
    if (page) {
      currentPage = page;
      restored = true;
      if (lastNavigation.view === "editor") renderEditor();
      else switchView(lastNavigation.view);
    }
  }
  if (!restored) renderEditor();
  recordNavigationHistory();
  restoreEditorSplitView();

  const first = blocksContainer.querySelector<HTMLElement>(".block-editor");
  if (currentView === "editor") first?.focus();

  scheduleAfterFirstPaint(() => {
    // Precarga de flashcards en segundo plano. Si el usuario entra antes en la
    // vista, `startFlashcardsSession` adelanta el escaneo y este temporizador
    // se convierte en un no-op.
    window.setTimeout(() => {
      if (!desktopReady) return;
      const pages = vault.getPages();
      const version = vault.getMutationVersion();
      if (flashcardLoader.isFresh(pages, version) || flashcardLoader.isLoading()) return;
      ensureFlashcardScan({
        order: flashcardReviewOrder,
        onDone: () => {
          renderFlashcardPagesFilter(false);
          if (flashcardExplorerActive) renderFlashcardExplorer();
        },
      });
    }, 1200);

    // Snapshots y migración no son necesarios para pintar ni editar.
    void vault
      .migrateLegacyRevisions()
      .then(() => migrateLegacySnapshotFiles())
      .then(() => initializeSnapshotSubsystem())
      .catch((error) => {
        console.error("No se pudo inicializar el subsistema de snapshots:", error);
      });

    // Precalienta las vistas ocultas una vez que la app ya responde.
    window.setTimeout(() => schedulePrewarmHiddenViews(), 2500);

    // El arrastre de imágenes solo se necesita cuando el usuario interactúa.
    if (isTauri()) {
      void (async () => {
        try {
          await getCurrentWebview().onDragDropEvent(({ payload }) => {
            if (payload.type !== "drop") return;
            void handleNativeImageDrop(payload);
          });
        } catch (error) {
          console.error("No se pudo escuchar el evento de archivos arrastrados:", error);
          showToast("No se pudo activar la importación de imágenes por arrastre.");
        }
      })();
    }
    void reviewProgressReady;
  });
}

// El módulo se importa dinámicamente desde `main.ts`; si el documento ya
// terminó de cargarse, arrancamos de inmediato en lugar de esperar un evento
// que ya ocurrió.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initializeDesktopApp().finally(hideAppSplash);
  }, { once: true });
} else {
  void initializeDesktopApp().finally(hideAppSplash);
}
