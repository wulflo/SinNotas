import type { PageData } from "../types";
import type { VaultStore } from "../store/vault";
import { currentLanguage, translate } from "../i18n";
import { getAllBlocksFlat } from "../editor/tree-engine";
import { paginateNotes } from "../mobile/notes-pagination";
import { createPageIcon } from "./page-icon";

/** Dependencias que el módulo toma prestadas del arranque de desktop.ts. */
export interface JournalsHost {
  vault: VaultStore;
  loadPage: (title: string) => Promise<void>;
}

let vault!: VaultStore;
let loadPage!: (title: string) => Promise<void>;

export function configureJournalsView(host: JournalsHost): void {
  vault = host.vault;
  loadPage = host.loadPage;
}

/** Página actual del listado de diarios existentes (persistida entre sesiones). */
const JOURNALS_PAGE_STORAGE_KEY = "sinnotas-journals-page";
const JOURNALS_PAGE_SIZES = [10, 20, 50] as const;
const JOURNALS_PAGE_SIZE_KEY = "sinnotas-journals-page-size";

function readJournalsPageSize(): number {
  try {
    const stored = Number(localStorage.getItem(JOURNALS_PAGE_SIZE_KEY));
    return JOURNALS_PAGE_SIZES.includes(stored as (typeof JOURNALS_PAGE_SIZES)[number])
      ? stored
      : 20;
  } catch {
    return 20;
  }
}

function saveJournalsPageSize(size: number): void {
  try {
    localStorage.setItem(JOURNALS_PAGE_SIZE_KEY, String(size));
  } catch {
    // El límite sigue activo en memoria.
  }
}

let journalsPageSize = readJournalsPageSize();

function readJournalsPage(): number {
  try {
    const stored = Number(localStorage.getItem(JOURNALS_PAGE_STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? Math.trunc(stored) : 1;
  } catch {
    return 1;
  }
}

function saveJournalsPage(page: number): void {
  try {
    localStorage.setItem(JOURNALS_PAGE_STORAGE_KEY, String(page));
  } catch {
    // La paginación sigue funcionando en memoria si no se puede persistir.
  }
}

let journalsPage = readJournalsPage();
/** Generación de precarga: evita encolar tareas de páginas ya abandonadas. */
let journalsPrewarmGeneration = 0;
let journalCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

/* ==================== JOURNALS VIEW ==================== */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Fecha legible de un diario (sin el prefijo "Diario"). */
function journalDateLabel(page: PageData): string {
  if (!page.journalDate) return page.title;
  const date = new Date(`${page.journalDate}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? page.journalDate
    : date.toLocaleDateString(currentLanguage(), { dateStyle: "medium" });
}

/**
 * Título visible de una nota. Los diarios se identifican por su fecha (el
 * archivo es `journals/YYYY_MM_DD.md`), así que la lista muestra siempre
 * "Diario <fecha>" aunque el stem interno use guiones bajos.
 */
export function pageDisplayTitle(page: PageData): string {
  if (!page.isJournal || !page.journalDate) return page.title;
  return `${translate("Diario")} ${journalDateLabel(page)}`;
}

function renderJournalCalendar(container: HTMLElement, journalPages: PageData[]): void {
  const calendar = document.createElement("section");
  calendar.className = "journal-calendar";

  const header = document.createElement("header");
  header.className = "journal-calendar-header";
  const monthTitle = document.createElement("h2");
  let monthLabel = journalCalendarMonth.toLocaleDateString(currentLanguage(), {
    month: "long",
    year: "numeric",
  });
  if (currentLanguage() === "es") {
    // es devuelve "noviembre de 2026"; el calendario solo necesita "noviembre 2026".
    monthLabel = monthLabel.replace(/\s+de\s+/i, " ");
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

  // Separador entre la cabecera de días de la semana y los números del mes.
  const separator = document.createElement("div");
  separator.className = "journal-calendar-separator";
  separator.setAttribute("aria-hidden", "true");
  grid.appendChild(separator);

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
      // El diario nuevo es el más reciente: debe aparecer en la primera página.
      journalsPage = 1;
      saveJournalsPage(1);
      loadPage(page.title);
    });
    grid.appendChild(day);
  }

  calendar.append(header, grid);
  container.appendChild(calendar);
}

/**
 * Precarga en tiempo muerto los diarios de la página siguiente: con el arranque
 * metadata-only, `ensurePageLoaded` hidrata sus bloques antes de que el usuario
 * pulse «Siguiente», para que la paginación no espere a disco.
 */
function scheduleJournalsNextPagePrewarm(
  pages: PageData[],
  currentPage: number,
  totalPages: number
): void {
  const nextPage = currentPage + 1;
  if (totalPages <= 1 || nextPage > totalPages) return;
  const generation = ++journalsPrewarmGeneration;
  const run = () => {
    if (generation !== journalsPrewarmGeneration) return;
    for (const page of paginateNotes(pages, nextPage, journalsPageSize).items) {
      if (page.blocksLoaded === false) void vault.ensurePageLoaded(page);
    }
  };
  const idle = (window as any).requestIdleCallback as
    | ((callback: () => void, options?: { timeout: number }) => number)
    | undefined;
  if (typeof idle === "function") idle(run, { timeout: 1500 });
  else window.setTimeout(run, 400);
}

export function renderJournalsView(): void {
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

  const paged = paginateNotes(journalPages, journalsPage, journalsPageSize);
  const totalPages = paged.totalPages;
  journalsPage = paged.currentPage;
  saveJournalsPage(journalsPage);

  // Controles visibles justo debajo del título: tamaño de página y paginador,
  // para que el límite de carga sea evidente aunque haya cientos de diarios.
  const controls = document.createElement("div");
  controls.className = "journals-list-controls";
  controls.id = "journals-controls";

  const sizeGroup = document.createElement("div");
  sizeGroup.className = "journals-size-group";
  const sizeCaption = document.createElement("span");
  sizeCaption.className = "journals-controls-caption";
  sizeCaption.textContent = translate("Por página");
  sizeGroup.appendChild(sizeCaption);
  JOURNALS_PAGE_SIZES.forEach((size) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `journals-size-chip${size === journalsPageSize ? " active" : ""}`;
    chip.textContent = String(size);
    chip.title = `${size}`;
    chip.addEventListener("click", () => {
      journalsPageSize = size;
      saveJournalsPageSize(size);
      journalsPage = 1;
      saveJournalsPage(1);
      renderJournalsView();
    });
    sizeGroup.appendChild(chip);
  });
  controls.appendChild(sizeGroup);

  const pagination = document.createElement("div");
  pagination.className = "journals-pagination";
  pagination.id = "journals-pagination";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "btn-pagination";
  previous.id = "journals-prev";
  previous.textContent = "<";
  previous.title = translate("Página anterior");
  previous.setAttribute("aria-label", previous.title);
  previous.disabled = journalsPage === 1;
  previous.addEventListener("click", () => {
    journalsPage = Math.max(1, journalsPage - 1);
    renderJournalsView();
  });
  const info = document.createElement("span");
  info.className = "journals-pagination-info";
  info.id = "journals-page-info";
  info.textContent = `${translate("Página")} ${journalsPage}/${totalPages} · ${paged.start + 1}–${paged.end} / ${journalPages.length}`;
  const next = document.createElement("button");
  next.type = "button";
  next.className = "btn-pagination";
  next.id = "journals-next";
  next.textContent = ">";
  next.title = translate("Página siguiente");
  next.setAttribute("aria-label", next.title);
  next.disabled = journalsPage === totalPages;
  next.addEventListener("click", () => {
    journalsPage = Math.min(totalPages, journalsPage + 1);
    renderJournalsView();
  });
  pagination.append(previous, info, next);
  controls.appendChild(pagination);
  entriesContainer.appendChild(controls);

  const list = document.createElement("ul");
  list.className = "journals-list";
  list.id = "journals-list";
  paged.items.forEach((journal) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "journals-list-item";
    button.title = `Abrir ${journal.title}`;
    const icon = createPageIcon(true);
    icon.classList.add("journals-list-icon");
    const label = document.createElement("span");
    label.className = "journals-list-label";
    label.textContent = journalDateLabel(journal);
    const meta = document.createElement("span");
    meta.className = "journals-list-meta";
    // FASE 4-D: bajo el boot de metadatos vale el resumen (conteo plano).
    const bulletCount =
      journal.blocksLoaded === false
        ? journal.blockCount ?? 0
        : getAllBlocksFlat(journal.blocks).length;
    meta.textContent = `${bulletCount} ${bulletCount === 1 ? "bullet" : "bullets"}`;
    button.append(icon, label, meta);
    button.addEventListener("click", () => {
      loadPage(journal.title);
    });
    item.appendChild(button);
    list.appendChild(item);
  });
  entriesContainer.appendChild(list);

  scheduleJournalsNextPagePrewarm(journalPages, journalsPage, totalPages);
  if (scrollRoot) scrollRoot.scrollTop = previousScrollTop;
}
