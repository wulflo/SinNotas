import type { PageData, ViewType } from "../types";
import { currentLanguage, translate } from "../i18n";
import { getAllBlocksFlat } from "../editor/tree-engine";
import { createPageIcon } from "./page-icon";
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
} from "./all-pages";

/** Funciones de desktop.ts que la tabla «Todas las páginas» necesita. */
export interface AllPagesHost {
  getPages(): PageData[];
  deletePage(id: string): boolean;
  getView(): ViewType;
  getPage(): PageData;
  loadPage(title: string): Promise<void>;
  pageDisplayTitle(page: PageData): string;
  flashcardPageCreatedMs(page: PageData | undefined): number | null;
  fillFlashcardPagesCreatedTimes(titles: string[]): Promise<boolean>;
  renderFlashcardPagesFilter(scanVault?: boolean): void;
  renderSidebar(): void;
  showSidebarContextMenu(x: number, y: number, pageId: string, pageTitle: string): void;
  confirmAction(message: string, acceptLabel: string): Promise<boolean>;
  notify(message: string): void;
  scaledFontSize(px: number): string;
}

let host!: AllPagesHost;

export function configureAllPagesView(nextHost: AllPagesHost): void {
  host = nextHost;
}

export function resetAllPagesPage(): void {
  allPagesCurrentPage = 1;
}

export function getAllPagesSortSelect(): HTMLSelectElement | null {
  return document.getElementById("all-pages-sort") as HTMLSelectElement | null;
}

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
    const extra = available - total;
    // Reparte el sobrante: una parte al título y el resto proporcional a las
    // demas columnas, para no desaprovechar el espacio a la derecha en
    // ventanas anchas.
    widths.title += Math.floor(extra * 0.5);
    const otherIds = ids.filter((id) => id !== "title");
    const otherTotal = otherIds.reduce((sum, id) => sum + widths[id], 0);
    if (otherTotal > 0) {
      const otherExtra = Math.floor(extra * 0.5);
      otherIds.forEach((id) => {
        widths[id] += Math.floor((otherExtra * widths[id]) / otherTotal);
      });
    }
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

export function applyAllPagesColumnWidths(): void {
  const table = document.getElementById("all-pages-table") as HTMLTableElement | null;
  if (!table) return;
  const available = allPagesTableAvailableWidth(table);
  // Siempre se ajustan al ancho visible, también cuando el usuario ha
  // redimensionado columnas: así la tabta nunca se queda corta a la derecha
  // ni deja un hueco a la derecha en ventanas anchas.
  allPagesRenderedWidths = fittedAllPagesWidths(available);
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

/* La tabla se reajusta al cambiar el tamaño de la ventana para seguir
  ocupando todo el ancho visible, incluso con columnas redimensionadas. */
window.addEventListener("resize", () => {
  if (host.getView() !== "all-pages") return;
  applyAllPagesColumnWidths();
});

export function renderAllPagesView() {
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

  const allPages = host.getPages();
  const visiblePages = filterAllPages(allPages, allPagesSearchQuery, host.pageDisplayTitle);
  allPagesFiltered = sortAllPages(
    visiblePages,
    allPagesSort,
    host.pageDisplayTitle,
    host.flashcardPageCreatedMs
  );

  // Compatibilidad con bóvedas/cachés antiguas sin `createdAtMs`: se pide la
  // fecha de creación al backend una sola vez y se repinta. Con el snapshot
  // nuevo de Rust esta llamada no se hace.
  const missingCreatedTimes = allPages.some(
    (page) => !page.journalDate && typeof page.createdAtMs !== "number"
  );
  if (missingCreatedTimes && host.getView() === "all-pages") {
    void host.fillFlashcardPagesCreatedTimes(allPages.map((page) => page.title)).then((changed) => {
      if (changed && host.getView() === "all-pages") renderAllPagesView();
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
    // FASE 4-D: con el boot de metadatos (4-E) la nota puede estar
    // descargada; el resumen de Rust ya trae el conteo plano de bloques.
    const blockCount =
      p.blocksLoaded === false ? p.blockCount ?? 0 : getAllBlocksFlat(p.blocks).length;

    const nameCell = document.createElement("td");
    const linkCell = document.createElement("div");
    linkCell.className = "page-link-cell";
    linkCell.dataset.title = p.title;

    // Icono SVG según tipo de nota, en color accent (mismo helper que el
    // panel de referencias y el tablero Kanban).
    const iconWrap = createPageIcon(Boolean(p.isJournal));

    const title = document.createElement("span");
    const displayTitle = host.pageDisplayTitle(p);
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
    kindBadge.append(kindDot, document.createTextNode(translate(p.isJournal ? "Diario" : "Página")));
    kindCell.appendChild(kindBadge);

    const createdCell = document.createElement("td");
    createdCell.style.color = "var(--ls-text-muted)";
    createdCell.style.fontSize = host.scaledFontSize(13);
    createdCell.textContent = formatPageDate(
      pageCreatedMs(p, host.flashcardPageCreatedMs),
      currentLanguage()
    );

    const updatedCell = document.createElement("td");
    updatedCell.style.color = "var(--ls-text-muted)";
    updatedCell.style.fontSize = host.scaledFontSize(13);
    updatedCell.textContent = formatPageDate(pageUpdatedMs(p), currentLanguage());

    const actionsCell = document.createElement("td");
    actionsCell.style.textAlign = "right";

    const deleteButton = document.createElement("button");
    deleteButton.className = "btn-table-delete";
    deleteButton.dataset.id = p.id;
    deleteButton.title = translate("Eliminar página");
    deleteButton.textContent = "🗑️";
    actionsCell.appendChild(deleteButton);

    row.append(nameCell, blocksCell, kindCell, createdCell, updatedCell, actionsCell);

    row.querySelector(".page-link-cell")?.addEventListener("click", () => {
      host.loadPage(p.title);
    });

    row.addEventListener("contextmenu", (e: MouseEvent) => {
      e.preventDefault();
      // El listener global de `contextmenu` en document cierra todos los
      // menús; sin stopPropagation se cerraría el menú recién abierto aquí.
      // El resto de vistas (sidebar, bullets, tablas) ya lo hacen así.
      e.stopPropagation();
      host.showSidebarContextMenu(e.clientX, e.clientY, p.id, p.title);
    });

    row.querySelector(".btn-table-delete")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const confirmed = await host.confirmAction(`¿Eliminar la página "${p.title}" permanentemente?`, "Eliminar");
      if (confirmed) {
        host.deletePage(p.id);
        // Mantener sincronizado el selector de notas de Flashcards.
        host.renderFlashcardPagesFilter(true);
        renderAllPagesView();
        host.renderSidebar();
        if (p.id === host.getPage().id) {
          const remaining = host.getPages();
          host.loadPage(remaining[0]?.title || "Bienvenido");
        }
        host.notify(`Página "${p.title}" eliminada`);
      }
    });

    tbody.appendChild(row);
  });
}
