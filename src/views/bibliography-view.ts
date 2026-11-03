import { translate } from "../i18n";
import type { PageData } from "../types";
import {
  BIBLIOGRAPHY_STATUSES,
  BIBLIOGRAPHY_STATUS_LABELS,
  BIBLIOGRAPHY_TYPE_ICONS,
  BIBLIOGRAPHY_TYPE_LABELS,
  BIBLIOGRAPHY_TYPES,
  bibliographyItemFromPage,
  bibliographyPages,
  bibliographyProgress,
  bibliographyUnitLabel,
  filterBibliographyItems,
  linkedBibliographyNotes,
  type BibliographyItem,
  type BibliographyPatch,
  type BibliographyStatus,
  type BibliographyType,
  type CreateBibliographyInput,
} from "./bibliography";
import {
  lookupErrorCode,
  lookupErrorMessage,
  lookupResultToInput,
  type BibliographyLookupMode,
  type BibliographyLookupResult,
} from "./bibliography-lookup";

export interface BibliographyHost {
  getPages(): PageData[];
  createItem(input: CreateBibliographyInput): Promise<BibliographyItem>;
  updateItem(item: BibliographyItem, patch: BibliographyPatch): Promise<BibliographyItem>;
  deleteItem(item: BibliographyItem): Promise<void>;
  createLinkedNote(item: BibliographyItem, title: string): Promise<PageData>;
  openPage(page: PageData): void;
  uploadCover(file: File): Promise<string | null>;
  resolveImage(source: string): Promise<string | null>;
  lookup(query: string, mode: BibliographyLookupMode): Promise<BibliographyLookupResult[]>;
  confirmDelete(item: BibliographyItem): Promise<boolean>;
  notify(message: string): void;
}

type TypeFilter = BibliographyType | "all";
type StatusFilter = BibliographyStatus | "all";

/** Crea un elemento con clase y texto opcional. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function iconSvg(paths: string, size = 18): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = paths;
  return svg;
}

function typeLabel(type: BibliographyType): string {
  return translate(BIBLIOGRAPHY_TYPE_LABELS[type]);
}

function statusLabel(status: BibliographyStatus): string {
  return translate(BIBLIOGRAPHY_STATUS_LABELS[status]);
}

function progressText(item: BibliographyItem): string {
  if (item.total <= 0) return translate("Sin progreso definido");
  return `${item.current} / ${item.total} ${translate(bibliographyUnitLabel(item.type))}`;
}

function metaText(item: BibliographyItem): string {
  return [item.author, item.year].filter(Boolean).join(" · ");
}

/**
 * Vista de bibliografía: un tablero de recursos guardados como notas Markdown.
 * La vista no toca el vault directamente; recibe un host con las operaciones
 * para que la lógica de persistencia (incluida la rehidratación de notas en
 * el arranque metadata-only) siga viviendo en `desktop.ts`.
 */
export class BibliographyView {
  private readonly root: HTMLElement;
  private readonly host: BibliographyHost;
  private readonly grid: HTMLDivElement;
  private readonly empty: HTMLDivElement;
  private readonly countBadge: HTMLSpanElement;
  private readonly statTotal: HTMLSpanElement;
  private readonly statReading: HTMLSpanElement;
  private readonly statCompleted: HTMLSpanElement;
  private readonly filterTabs: HTMLDivElement;
  private readonly statusSelect: HTMLSelectElement;
  private readonly searchInput: HTMLInputElement;
  private query = "";
  private typeFilter: TypeFilter = "all";
  private statusFilter: StatusFilter = "all";
  private items: BibliographyItem[] = [];
  private detail: {
    item: BibliographyItem;
    overlay: HTMLDivElement;
    progressBar: HTMLSpanElement;
    progressPercent: HTMLSpanElement;
    progressText: HTMLSpanElement;
    meta: HTMLParagraphElement;
    currentInput: HTMLInputElement;
    totalInput: HTMLInputElement;
    statusChip: HTMLSpanElement;
    statusSelect: HTMLSelectElement;
    ratingRow: HTMLDivElement;
    cover: HTMLDivElement;
    notesList: HTMLDivElement;
    keyHandler: (event: KeyboardEvent) => void;
  } | null = null;
  private addOverlay: HTMLDivElement | null = null;
  private noteOverlay: HTMLDivElement | null = null;
  private addKeyHandler: ((event: KeyboardEvent) => void) | null = null;
  private noteKeyHandler: ((event: KeyboardEvent) => void) | null = null;
  private commitQueue: Promise<void> = Promise.resolve();

  constructor(root: HTMLElement, host: BibliographyHost) {
    this.root = root;
    this.host = host;

    const shell = el("div", "bibliography-view-shell");
    const header = el("header", "bib-header");
    const heading = el("div", "bib-heading");
    const kicker = el("span", "bib-kicker", translate("Biblioteca"));
    const titleRow = el("div", "bib-title-row");
    const title = el("h2", "bib-title", translate("Bibliografía"));
    this.countBadge = el("span", "bib-count-badge", "0");
    titleRow.append(title, this.countBadge);
    heading.append(kicker, titleRow);

    this.statTotal = el("span", "bib-stat-value", "0");
    this.statReading = el("span", "bib-stat-value", "0");
    this.statCompleted = el("span", "bib-stat-value", "0");
    const stats = el("div", "bib-stats");
    stats.append(
      this.buildStat(this.statTotal, translate("Recursos")),
      this.buildStat(this.statReading, translate("Leyendo")),
      this.buildStat(this.statCompleted, translate("Completados"))
    );

    const addButton = el("button", "bib-add-button");
    addButton.type = "button";
    addButton.append(
      iconSvg('<path d="M12 5v14M5 12h14"></path>', 16),
      document.createTextNode(translate("Añadir recurso"))
    );
    addButton.addEventListener("click", () => this.openAddDialog());

    header.append(heading, stats, addButton);

    const toolbar = el("div", "bib-toolbar");
    const search = el("label", "bib-search");
    search.append(iconSvg('<circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.35-4.35"></path>', 16));
    this.searchInput = el("input", "bib-search-input");
    this.searchInput.type = "search";
    this.searchInput.autocomplete = "off";
    this.searchInput.placeholder = translate("Buscar en la biblioteca...");
    this.searchInput.setAttribute("aria-label", translate("Buscar en la biblioteca"));
    this.searchInput.addEventListener("input", () => {
      this.query = this.searchInput.value;
      this.renderGrid();
    });
    search.append(this.searchInput);

    this.filterTabs = el("div", "bib-filter-tabs");
    this.filterTabs.setAttribute("role", "tablist");
    this.filterTabs.setAttribute("aria-label", translate("Tipos de recurso"));
    this.buildFilterTabs();

    this.statusSelect = el("select", "bib-status-filter");
    this.statusSelect.setAttribute("aria-label", translate("Filtrar por estado"));
    const allOption = el("option", undefined, translate("Todos los estados"));
    allOption.value = "all";
    this.statusSelect.append(allOption);
    for (const status of BIBLIOGRAPHY_STATUSES) {
      const option = el("option", undefined, statusLabel(status));
      option.value = status;
      this.statusSelect.append(option);
    }
    this.statusSelect.addEventListener("change", () => {
      this.statusFilter = this.statusSelect.value as StatusFilter;
      this.renderGrid();
    });

    toolbar.append(search, this.filterTabs, this.statusSelect);

    const scroll = el("div", "bib-scroll");
    this.grid = el("div", "bib-grid");
    this.empty = el("div", "bib-empty");
    scroll.append(this.grid, this.empty);
    shell.append(header, toolbar, scroll);
    this.root.replaceChildren(shell);
    this.render();
  }

  private buildStat(value: HTMLSpanElement, label: string): HTMLElement {
    const block = el("div", "bib-stat");
    const caption = el("span", "bib-stat-label", label);
    block.append(value, caption);
    return block;
  }

  private buildFilterTabs(): void {
    this.filterTabs.replaceChildren();
    const filters: Array<{ value: TypeFilter; label: string }> = [
      { value: "all", label: translate("Todos") },
      ...BIBLIOGRAPHY_TYPES.map((type) => ({ value: type, label: typeLabel(type) })),
    ];
    for (const filter of filters) {
      const button = el("button", "bib-filter-tab", filter.label);
      button.type = "button";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(this.typeFilter === filter.value));
      button.classList.toggle("active", this.typeFilter === filter.value);
      button.addEventListener("click", () => {
        this.typeFilter = filter.value;
        this.filterTabs.querySelectorAll<HTMLButtonElement>(".bib-filter-tab").forEach((tab) => {
          const active = tab === button;
          tab.classList.toggle("active", active);
          tab.setAttribute("aria-selected", String(active));
        });
        this.renderGrid();
      });
      this.filterTabs.append(button);
    }
  }

  /** Llamar al entrar en la vista para reflejar cambios hechos en el editor. */
  onActivate(): void {
    this.buildFilterTabs();
    this.render();
  }

  /** Refresca la vista si el vault cambió mientras está abierta. */
  onPagesChanged(): void {
    if (this.root.classList.contains("active-view")) this.render();
  }

  render(): void {
    const allItems = bibliographyPages(this.host.getPages())
      .map(bibliographyItemFromPage)
      .sort((left, right) => (right.page.updatedAtMs || 0) - (left.page.updatedAtMs || 0));
    this.items = allItems;
    this.countBadge.textContent = String(allItems.length);
    this.statTotal.textContent = String(allItems.length);
    this.statReading.textContent = String(
      allItems.filter((item) => item.status === "reading").length
    );
    this.statCompleted.textContent = String(
      allItems.filter((item) => item.status === "completed").length
    );
    this.renderGrid();
  }

  private renderGrid(): void {
    const filtered = filterBibliographyItems(
      this.items,
      this.query,
      this.typeFilter,
      this.statusFilter
    );
    this.grid.replaceChildren(...filtered.map((item) => this.buildCard(item)));
    this.grid.hidden = filtered.length === 0;
    this.empty.hidden = filtered.length > 0;
    this.empty.replaceChildren();
    if (filtered.length === 0) {
      const emptyIcon = el("div", "bib-empty-icon");
      emptyIcon.append(iconSvg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>', 30));
      const hasItems = this.items.length > 0;
      const emptyTitle = el(
        "h3",
        "bib-empty-title",
        hasItems
          ? translate("No hay recursos que coincidan con los filtros.")
          : translate("Todavía no hay recursos en tu bibliografía.")
      );
      const emptyBody = el(
        "p",
        "bib-empty-body",
        hasItems
          ? translate("Prueba con otra búsqueda o cambia los filtros.")
          : translate("Añade tu primer libro, vídeo, artículo o página web.")
      );
      this.empty.append(emptyIcon, emptyTitle, emptyBody);
      if (!hasItems) {
        const action = el("button", "bib-empty-action", translate("Añadir recurso"));
        action.type = "button";
        action.addEventListener("click", () => this.openAddDialog());
        this.empty.append(action);
      }
    }
  }

  private buildCard(item: BibliographyItem): HTMLElement {
    const card = el("article", "bib-card");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", item.page.title);

    const cover = el("div", "bib-card-cover");
    const typeBadge = el("span", "bib-type-badge");
    typeBadge.append(
      document.createTextNode(BIBLIOGRAPHY_TYPE_ICONS[item.type]),
      document.createTextNode(typeLabel(item.type))
    );
    const statusBadge = el(
      "span",
      `bib-status-pill bib-status--${item.status}`,
      statusLabel(item.status)
    );
    cover.append(typeBadge, statusBadge);
    if (item.cover) {
      const image = el("img", "bib-cover-image");
      image.alt = "";
      image.loading = "lazy";
      cover.append(image);
      void this.host.resolveImage(item.cover).then((url) => {
        if (url) image.src = url;
        else image.remove();
      });
    } else {
      cover.append(this.buildCoverPlaceholder(item));
    }

    const body = el("div", "bib-card-body");
    const cardTitle = el("h3", "bib-card-title bib-user-data", item.page.title);
    const cardMeta = el(
      "p",
      "bib-card-meta bib-user-data",
      metaText(item) || " "
    );
    const progress = bibliographyProgress(item);
    const progressRow = el("div", "bib-card-progress");
    const bar = el("div", "bib-progress-track");
    const fill = el("span", "bib-progress-fill");
    fill.style.width = `${progress}%`;
    bar.append(fill);
    const percent = el("span", "bib-progress-percent", `${progress}%`);
    progressRow.append(bar, percent);
    const progressLabel = el("p", "bib-card-progress-text", progressText(item));
    body.append(cardTitle, cardMeta, progressRow, progressLabel);
    card.append(cover, body);

    card.addEventListener("click", () => this.openDetail(item));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.openDetail(item);
      }
    });
    return card;
  }

  private buildCoverPlaceholder(item: BibliographyItem): HTMLElement {
    const placeholder = el("div", "bib-cover-placeholder");
    placeholder.append(
      el("span", "bib-cover-icon", BIBLIOGRAPHY_TYPE_ICONS[item.type]),
      el("span", "bib-cover-initial", item.page.title.slice(0, 1).toUpperCase())
    );
    return placeholder;
  }

  private openDetail(item: BibliographyItem): void {
    this.closeDetail();
    const overlay = el("div", "bib-modal-backdrop");
    const dialog = el("div", "bib-modal bib-detail-modal");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", item.page.title);

    const header = el("div", "bib-modal-header");
    const headingBlock = el("div", "bib-detail-heading");
    headingBlock.append(
      el("span", "bib-kicker", typeLabel(item.type)),
      el("h2", "bib-detail-title bib-user-data", item.page.title)
    );
    const closeButton = el("button", "bib-icon-button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", translate("Cerrar"));
    closeButton.append(iconSvg('<path d="M18 6 6 18M6 6l12 12"></path>', 18));
    closeButton.addEventListener("click", () => this.closeDetail());
    header.append(headingBlock, closeButton);

    const layout = el("div", "bib-detail-layout");
    const coverColumn = el("div", "bib-detail-cover-column");
    const cover = el("div", "bib-detail-cover");
    if (item.cover) {
      const image = el("img", "bib-cover-image");
      image.alt = translate("Portada");
      cover.append(image);
      void this.host.resolveImage(item.cover).then((url) => {
        if (url) image.src = url;
      });
    } else {
      cover.append(this.buildCoverPlaceholder(item));
    }

    const coverInput = el("input", "bib-hidden-input");
    coverInput.type = "file";
    coverInput.accept = "image/*";
    coverInput.addEventListener("change", () => {
      const file = coverInput.files?.[0];
      coverInput.value = "";
      if (!file) return;
      void this.host.uploadCover(file).then((source) => {
        if (!source) return;
        this.queuePatch({ cover: source });
        this.replaceDetailCover(source);
      });
    });
    const coverActions = el("div", "bib-cover-actions");
    const changeCover = el("button", "bib-secondary-button", translate("Cambiar portada"));
    changeCover.type = "button";
    changeCover.addEventListener("click", () => coverInput.click());
    const removeCover = el("button", "bib-ghost-button", translate("Quitar portada"));
    removeCover.type = "button";
    removeCover.addEventListener("click", () => {
      this.queuePatch({ cover: "" });
      this.replaceDetailCover("");
    });
    coverActions.append(changeCover, removeCover);
    coverColumn.append(cover, coverActions, coverInput);

    const content = el("div", "bib-detail-content");
    const meta = el("p", "bib-detail-meta bib-user-data", metaText(item) || " ");
    const progressSection = el("section", "bib-detail-progress");
    const progressHeader = el("div", "bib-detail-progress-header");
    const unit = el("span", "bib-detail-progress-label", translate("Progreso"));
    const percent = el("span", "bib-progress-percent", `${bibliographyProgress(item)}%`);
    progressHeader.append(unit, percent);
    const track = el("div", "bib-progress-track bib-progress-track--large");
    const fill = el("span", "bib-progress-fill");
    fill.style.width = `${bibliographyProgress(item)}%`;
    track.append(fill);
    const progressValues = el("div", "bib-progress-values");
    const currentInput = el("input", "bib-number-input");
    currentInput.type = "number";
    currentInput.min = "0";
    currentInput.step = "1";
    currentInput.value = String(item.current);
    currentInput.setAttribute("aria-label", translate("Progreso actual"));
    const totalInput = el("input", "bib-number-input");
    totalInput.type = "number";
    totalInput.min = "0";
    totalInput.step = "1";
    totalInput.value = String(item.total);
    totalInput.setAttribute("aria-label", translate("Progreso total"));
    const progressTextEl = el("span", "bib-progress-text", progressText(item));
    progressValues.append(
      currentInput,
      el("span", "bib-progress-separator", "/"),
      totalInput,
      el("span", "bib-progress-unit", translate(bibliographyUnitLabel(item.type))),
      progressTextEl
    );

    const commitProgress = (source: "current" | "total"): void => {
      const total = Math.max(0, Number(totalInput.value) || 0);
      const current = Math.max(0, Math.min(total, Number(currentInput.value) || 0));
      currentInput.value = String(current);
      totalInput.value = String(total);
      const patch: BibliographyPatch = {};
      if (source === "total") patch.total = total;
      patch.current = current;
      if (total > 0 && current >= total) patch.status = "completed";
      this.queuePatch(patch);
    };
    currentInput.addEventListener("change", () => commitProgress("current"));
    totalInput.addEventListener("change", () => commitProgress("total"));

    const statusRow = el("div", "bib-detail-row");
    const statusWrap = el("label", "bib-field bib-field-inline");
    const statusSelect = el("select", "bib-input");
    for (const status of BIBLIOGRAPHY_STATUSES) {
      const option = el("option", undefined, statusLabel(status));
      option.value = status;
      if (status === item.status) option.selected = true;
      statusSelect.append(option);
    }
    statusWrap.append(el("span", "bib-field-label", translate("Estado")), statusSelect);
    statusSelect.addEventListener("change", () => {
      const status = statusSelect.value as BibliographyStatus;
      this.queuePatch({ status });
    });
    const statusChip = el(
      "span",
      `bib-status-pill bib-status--${item.status}`,
      statusLabel(item.status)
    );
    statusRow.append(statusWrap, statusChip);

    const ratingWrap = el("div", "bib-detail-row bib-rating-row");
    ratingWrap.append(el("span", "bib-field-label", translate("Valoración")));
    const ratingRow = el("div", "bib-rating");
    const renderStars = (rating: number): void => {
      ratingRow.replaceChildren();
      for (let value = 1; value <= 5; value += 1) {
        const star = el("button", "bib-star", value <= rating ? "★" : "☆");
        star.type = "button";
        star.setAttribute("aria-label", `${translate("Valoración")} ${value}`);
        star.classList.toggle("active", value <= rating);
        star.addEventListener("click", () => {
          const next = value === item.rating ? 0 : value;
          item.rating = next;
          renderStars(next);
          this.queuePatch({ rating: next });
        });
        ratingRow.append(star);
      }
    };
    renderStars(item.rating);
    ratingWrap.append(ratingRow);

    const fields = el("div", "bib-detail-fields");
    const authorInput = el("input", "bib-input");
    authorInput.type = "text";
    authorInput.value = item.author;
    authorInput.placeholder = translate("Autor");
    authorInput.setAttribute("aria-label", translate("Autor"));
    authorInput.addEventListener("change", () => this.queuePatch({ author: authorInput.value }));
    const yearInput = el("input", "bib-input");
    yearInput.type = "text";
    yearInput.value = item.year;
    yearInput.placeholder = translate("Año");
    yearInput.setAttribute("aria-label", translate("Año"));
    yearInput.addEventListener("change", () => this.queuePatch({ year: yearInput.value }));
    const linkInput = el("input", "bib-input bib-link-input");
    linkInput.type = "url";
    linkInput.value = item.link;
    linkInput.placeholder = translate("Enlace");
    linkInput.setAttribute("aria-label", translate("Enlace"));
    linkInput.addEventListener("change", () => this.queuePatch({ link: linkInput.value }));
    fields.append(authorInput, yearInput, linkInput);

    const actions = el("div", "bib-detail-actions");
    const openMain = el("button", "bib-primary-button");
    openMain.type = "button";
    openMain.append(
      iconSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>', 15),
      document.createTextNode(translate("Abrir nota principal"))
    );
    openMain.addEventListener("click", () => {
      this.closeDetail();
      this.host.openPage(item.page);
    });
    const deleteButton = el("button", "bib-danger-button", translate("Eliminar recurso"));
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => {
      void this.deleteItem(item);
    });
    actions.append(openMain, deleteButton);

    content.append(meta, progressSection, statusRow, ratingWrap, fields, actions);
    progressSection.append(progressHeader, track, progressValues);
    layout.append(coverColumn, content);

    const notesSection = el("section", "bib-notes-section");
    const notesHeader = el("div", "bib-notes-header");
    notesHeader.append(el("h3", "bib-notes-title", translate("Notas vinculadas")));
    const newNoteButton = el("button", "bib-secondary-button");
    newNoteButton.type = "button";
    newNoteButton.append(
      iconSvg('<path d="M12 5v14M5 12h14"></path>', 14),
      document.createTextNode(translate("Nueva nota"))
    );
    newNoteButton.addEventListener("click", () => this.openNoteDialog(item));
    notesHeader.append(newNoteButton);
    const notesList = el("div", "bib-notes-list");
    notesSection.append(notesHeader, notesList);

    dialog.append(header, layout, notesSection);
    overlay.append(dialog);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.closeDetail();
    });
    const keyHandler = (event: KeyboardEvent): void => {
      if (event.key === "Escape") this.closeDetail();
    };
    document.addEventListener("keydown", keyHandler);
    this.root.append(overlay);

    this.detail = {
      item,
      overlay,
      progressBar: fill,
      progressPercent: percent,
      progressText: progressTextEl,
      meta,
      currentInput,
      totalInput,
      statusChip,
      statusSelect,
      ratingRow,
      cover,
      notesList,
      keyHandler,
    };
    this.renderNotes(item, notesList);
    closeButton.focus();
  }

  private replaceDetailCover(source: string): void {
    if (!this.detail) return;
    const { cover, item } = this.detail;
    cover.replaceChildren();
    item.cover = source;
    if (source) {
      const image = el("img", "bib-cover-image");
      image.alt = translate("Portada");
      cover.append(image);
      void this.host.resolveImage(source).then((url) => {
        if (url) image.src = url;
        else cover.replaceChildren(this.buildCoverPlaceholder(item));
      });
    } else {
      cover.append(this.buildCoverPlaceholder(item));
    }
  }

  private queuePatch(patch: BibliographyPatch): void {
    if (!this.detail) return;
    const item = this.detail.item;
    this.commitQueue = this.commitQueue
      .then(async () => {
        const updated = await this.host.updateItem(item, patch);
        this.applyDetailItem(updated);
      })
      .catch((error: unknown) => {
        console.error("No se pudo actualizar el recurso de bibliografía:", error);
        this.host.notify(translate("No se pudo guardar el cambio."));
      });
  }

  private applyDetailItem(updated: BibliographyItem): void {
    if (!this.detail) return;
    this.detail.item = updated;
    this.detail.progressBar.style.width = `${bibliographyProgress(updated)}%`;
    this.detail.progressPercent.textContent = `${bibliographyProgress(updated)}%`;
    this.detail.progressText.textContent = progressText(updated);
    this.detail.currentInput.value = String(updated.current);
    this.detail.totalInput.value = String(updated.total);
    this.detail.statusChip.className = `bib-status-pill bib-status--${updated.status}`;
    this.detail.statusChip.textContent = statusLabel(updated.status);
    this.detail.statusSelect.value = updated.status;
    this.detail.meta.textContent = metaText(updated) || " ";
    this.detail.ratingRow.querySelectorAll<HTMLButtonElement>(".bib-star").forEach((star, index) => {
      const active = index < updated.rating;
      star.textContent = active ? "★" : "☆";
      star.classList.toggle("active", active);
    });
    this.renderNotes(updated, this.detail.notesList);
    this.render();
  }

  private renderNotes(item: BibliographyItem, container: HTMLDivElement): void {
    const notes = linkedBibliographyNotes(item, this.host.getPages());
    container.replaceChildren();
    if (notes.length === 0) {
      container.append(
        el(
          "p",
          "bib-notes-empty",
          translate("Sin notas todavía. Crea una nota vinculada para desarrollar este recurso.")
        )
      );
      return;
    }
    for (const note of notes) {
      const row = el("button", "bib-note-row");
      row.type = "button";
      row.append(iconSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>', 15));
      const textWrap = el("span", "bib-note-text");
      textWrap.append(
        el("span", "bib-note-title bib-user-data", note.title),
        el("span", "bib-note-meta", note.updatedAt || "")
      );
      row.append(textWrap);
      row.addEventListener("click", () => {
        this.closeDetail();
        this.host.openPage(note);
      });
      container.append(row);
    }
  }

  private closeDetail(): void {
    if (!this.detail) return;
    this.closeNoteDialog();
    const { overlay, keyHandler } = this.detail;
    document.removeEventListener("keydown", keyHandler);
    overlay.remove();
    this.detail = null;
    this.render();
  }

  private async deleteItem(item: BibliographyItem): Promise<void> {
    if (!(await this.host.confirmDelete(item))) return;
    try {
      await this.host.deleteItem(item);
      this.closeDetail();
      this.render();
      this.host.notify(translate("Recurso eliminado."));
    } catch (error) {
      console.error("No se pudo eliminar el recurso de bibliografía:", error);
      this.host.notify(translate("No se pudo eliminar el recurso."));
    }
  }

  private openAddDialog(): void {
    this.addOverlay?.remove();
    const overlay = el("div", "bib-modal-backdrop");
    const dialog = el("div", "bib-modal bib-add-modal");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", translate("Añadir recurso"));

    const header = el("div", "bib-modal-header");
    const heading = el("div", "bib-detail-heading");
    heading.append(
      el("span", "bib-kicker", translate("Nueva entrada")),
      el("h2", "bib-detail-title", translate("Añadir recurso"))
    );
    const closeButton = el("button", "bib-icon-button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", translate("Cerrar"));
    closeButton.append(iconSvg('<path d="M18 6 6 18M6 6l12 12"></path>', 18));
    closeButton.addEventListener("click", () => this.closeAddDialog());
    header.append(heading, closeButton);

    const form = el("form", "bib-form");
    const titleInput = el("input", "bib-input");
    titleInput.type = "text";
    titleInput.required = true;
    titleInput.placeholder = translate("Título");
    titleInput.setAttribute("aria-label", translate("Título"));

    const typeSelect = el("select", "bib-input");
    for (const type of BIBLIOGRAPHY_TYPES) {
      const option = el("option", undefined, typeLabel(type));
      option.value = type;
      typeSelect.append(option);
    }

    const authorInput = el("input", "bib-input");
    authorInput.type = "text";
    authorInput.placeholder = translate("Autor");
    authorInput.setAttribute("aria-label", translate("Autor"));

    const yearInput = el("input", "bib-input");
    yearInput.type = "text";
    yearInput.placeholder = translate("Año");
    yearInput.setAttribute("aria-label", translate("Año"));

    const totalInput = el("input", "bib-input");
    totalInput.type = "number";
    totalInput.min = "0";
    totalInput.step = "1";
    totalInput.placeholder = translate("Páginas totales");
    totalInput.setAttribute("aria-label", translate("Páginas totales"));

    const linkInput = el("input", "bib-input");
    linkInput.type = "url";
    linkInput.placeholder = translate("Enlace");
    linkInput.setAttribute("aria-label", translate("Enlace"));

    const coverInput = el("input", "bib-input");
    coverInput.type = "url";
    coverInput.placeholder = translate("URL de portada (opcional)");
    coverInput.setAttribute("aria-label", translate("URL de portada"));

    const fileInput = el("input", "bib-hidden-input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    let coverSource = "";
    const coverPreview = el("div", "bib-form-cover-preview");
    const renderCoverPreview = (): void => {
      coverPreview.replaceChildren();
      if (coverSource) {
        const image = el("img", "bib-cover-image");
        image.alt = translate("Portada");
        coverPreview.append(image);
        void this.host.resolveImage(coverSource).then((url) => {
          if (url) image.src = url;
        });
      } else {
        coverPreview.append(iconSvg('<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path>', 24));
      }
    };
    renderCoverPreview();
    const coverRow = el("div", "bib-form-cover-row");
    const pickCover = el("button", "bib-secondary-button", translate("Elegir portada"));
    pickCover.type = "button";
    pickCover.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file) return;
      void this.host.uploadCover(file).then((source) => {
        if (!source) return;
        coverSource = source;
        coverInput.value = "";
        renderCoverPreview();
      });
    });
    coverRow.append(coverPreview, pickCover, fileInput);
    coverInput.addEventListener("input", () => {
      if (!coverInput.value.trim()) return;
      coverSource = coverInput.value.trim();
      renderCoverPreview();
    });

    const lookupSection = el("div", "bib-lookup");
    const lookupHeading = el("div", "bib-lookup-heading");
    lookupHeading.append(
      el("span", "bib-kicker", translate("Metadatos en línea")),
      el(
        "p",
        "bib-lookup-help",
        translate(
          "Busca por DOI, ISBN o palabras clave en Crossref y Open Library. Solo se envía el texto que escribes."
        )
      ),
      el(
        "p",
        "bib-lookup-help bib-lookup-privacy",
        translate(
          "Si no hay conexión, completa los campos a mano: la búsqueda nunca bloquea el formulario."
        )
      )
    );

    const lookupRow = el("div", "bib-lookup-row");
    const lookupInput = el("input", "bib-input bib-lookup-input");
    lookupInput.type = "text";
    lookupInput.placeholder = translate("DOI, ISBN o palabras clave");
    lookupInput.setAttribute(
      "aria-label",
      translate("Buscar metadatos por DOI, ISBN o palabras clave")
    );

    const lookupMode = el("select", "bib-input bib-lookup-mode");
    for (const [value, label] of [
      ["auto", "Automático"],
      ["doi", "DOI"],
      ["isbn", "ISBN"],
      ["keywords", "Palabras clave"],
    ] as const) {
      const option = el("option", undefined, translate(label));
      option.value = value;
      lookupMode.append(option);
    }
    lookupMode.setAttribute("aria-label", translate("Modo de búsqueda"));

    const lookupButton = el(
      "button",
      "bib-secondary-button bib-lookup-button",
      translate("Buscar en línea")
    );
    lookupButton.type = "button";
    const lookupStatus = el("p", "bib-lookup-status");
    lookupStatus.setAttribute("aria-live", "polite");
    lookupStatus.hidden = true;
    const lookupResults = el("div", "bib-lookup-results");
    lookupRow.append(lookupInput, lookupMode, lookupButton);

    let lookupInFlight = false;
    const runLookup = (): void => {
      if (lookupInFlight) return;
      const query = lookupInput.value.trim();
      if (!query) {
        lookupStatus.textContent = translate("Escribe un DOI, un ISBN o palabras clave.");
        lookupStatus.hidden = false;
        lookupInput.focus();
        return;
      }
      lookupInFlight = true;
      lookupButton.disabled = true;
      lookupButton.textContent = translate("Buscando metadatos…");
      lookupStatus.textContent = translate("Buscando en Crossref y Open Library…");
      lookupStatus.hidden = false;
      lookupResults.replaceChildren();

      void this.host
        .lookup(query, lookupMode.value as BibliographyLookupMode)
        .then((results) => {
          if (results.length === 0) {
            lookupStatus.textContent = translate(
              "Sin resultados. Prueba otras palabras clave o revisa el identificador."
            );
            return;
          }
          lookupStatus.textContent = `${results.length} ${translate(
            "resultados encontrados"
          )}`;
          this.renderLookupResults(lookupResults, results, (result) => {
            const input = lookupResultToInput(result);
            titleInput.value = input.title;
            typeSelect.value = input.type;
            authorInput.value = input.author || "";
            yearInput.value = input.year || "";
            totalInput.value =
              input.total && input.total > 0 ? String(input.total) : "";
            linkInput.value = input.link || "";
            coverSource = input.cover || "";
            coverInput.value = coverSource;
            renderCoverPreview();
            lookupStatus.textContent = translate(
              "Datos importados. Revisa los campos y pulsa Crear recurso."
            );
            titleInput.focus();
            titleInput.select();
          });
        })
        .catch((lookupFailure: unknown) => {
          lookupStatus.textContent = translate(
            lookupErrorMessage(lookupErrorCode(lookupFailure))
          );
        })
        .finally(() => {
          lookupInFlight = false;
          lookupButton.disabled = false;
          lookupButton.textContent = translate("Buscar en línea");
        });
    };

    lookupButton.addEventListener("click", runLookup);
    lookupInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      runLookup();
    });

    lookupSection.append(lookupHeading, lookupRow, lookupStatus, lookupResults);

    const fieldsGrid = el("div", "bib-form-grid");
    fieldsGrid.append(
      this.buildFormField(translate("Título"), titleInput, true),
      this.buildFormField(translate("Tipo"), typeSelect),
      this.buildFormField(translate("Autor"), authorInput),
      this.buildFormField(translate("Año"), yearInput),
      this.buildFormField(translate("Páginas totales"), totalInput),
      this.buildFormField(translate("Enlace"), linkInput)
    );

    const error = el("p", "bib-form-error");
    error.hidden = true;
    const submit = el("button", "bib-primary-button", translate("Crear recurso"));
    submit.type = "submit";
    const cancel = el("button", "bib-ghost-button", translate("Cancelar"));
    cancel.type = "button";
    cancel.addEventListener("click", () => this.closeAddDialog());
    const formActions = el("div", "bib-form-actions");
    formActions.append(submit, cancel);

    form.append(
      fieldsGrid,
      this.buildFormField(translate("Portada"), coverRow),
      this.buildFormField(translate("URL de portada (opcional)"), coverInput),
      error,
      formActions
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const title = titleInput.value.trim();
      if (!title) {
        error.textContent = translate("El título es obligatorio.");
        error.hidden = false;
        titleInput.focus();
        return;
      }
      error.hidden = true;
      submit.disabled = true;
      submit.textContent = translate("Creando…");
      const input: CreateBibliographyInput = {
        title,
        type: typeSelect.value as BibliographyType,
        author: authorInput.value,
        year: yearInput.value,
        total: Math.max(0, Number(totalInput.value) || 0),
        cover: coverSource,
        link: linkInput.value,
      };
      void this.host
        .createItem(input)
        .then((item) => {
          this.closeAddDialog();
          this.render();
          this.openDetail(item);
        })
        .catch((createError: unknown) => {
          console.error("No se pudo crear el recurso de bibliografía:", createError);
          error.textContent = translate("No se pudo crear el recurso. Prueba con otro título.");
          error.hidden = false;
          submit.disabled = false;
          submit.textContent = translate("Crear recurso");
        });
    });

    dialog.append(header, lookupSection, form);
    overlay.append(dialog);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.closeAddDialog();
    });
    this.root.append(overlay);
    this.addOverlay = overlay;
    this.addKeyHandler = (event: KeyboardEvent): void => {
      if (event.key === "Escape") this.closeAddDialog();
    };
    document.addEventListener("keydown", this.addKeyHandler);
    titleInput.focus();
  }

  private renderLookupResults(
    container: HTMLElement,
    results: BibliographyLookupResult[],
    onPick: (result: BibliographyLookupResult) => void
  ): void {
    container.replaceChildren();
    for (const result of results) {
      const button = el("button", "bib-lookup-result");
      button.type = "button";
      const main = el("span", "bib-lookup-result-main");
      main.append(el("span", "bib-lookup-result-title", result.title));
      const details = [
        result.authors,
        result.year,
        result.container || result.publisher,
      ].filter(Boolean);
      if (result.subtitle) details.unshift(result.subtitle);
      if (details.length > 0) {
        main.append(el("span", "bib-lookup-result-meta", details.join(" · ")));
      }
      const side = el("span", "bib-lookup-result-side");
      side.append(
        el(
          "span",
          "bib-lookup-provider",
          result.provider === "openlibrary" ? "Open Library" : "Crossref"
        ),
        el("span", "bib-lookup-kind", typeLabel(result.kind))
      );
      button.append(main, side);
      button.addEventListener("click", () => onPick(result));
      container.append(button);
    }
  }

  private buildFormField(label: string, control: HTMLElement, required = false): HTMLElement {
    const field = el("div", `bib-field${required ? " bib-field-required" : ""}`);
    field.append(el("span", "bib-field-label", label), control);
    return field;
  }

  private closeAddDialog(): void {
    this.addOverlay?.remove();
    this.addOverlay = null;
    if (this.addKeyHandler) {
      document.removeEventListener("keydown", this.addKeyHandler);
      this.addKeyHandler = null;
    }
  }

  private openNoteDialog(item: BibliographyItem): void {
    this.noteOverlay?.remove();
    const overlay = el("div", "bib-modal-backdrop bib-modal-nested");
    const dialog = el("div", "bib-modal bib-note-modal");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", translate("Nueva nota"));

    const header = el("div", "bib-modal-header");
    const heading = el("div", "bib-detail-heading");
    heading.append(
      el("span", "bib-kicker bib-user-data", item.page.title),
      el("h2", "bib-detail-title", translate("Nueva nota"))
    );
    const closeButton = el("button", "bib-icon-button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", translate("Cerrar"));
    closeButton.append(iconSvg('<path d="M18 6 6 18M6 6l12 12"></path>', 18));
    closeButton.addEventListener("click", () => this.closeNoteDialog());
    header.append(heading, closeButton);

    const form = el("form", "bib-form");
    const input = el("input", "bib-input");
    input.type = "text";
    input.required = true;
    input.placeholder = translate("Nombre de la nota");
    input.setAttribute("aria-label", translate("Nombre de la nota"));
    const help = el(
      "p",
      "bib-form-help",
      translate("La nota se creará como página independiente y enlazará de vuelta a este recurso.")
    );
    const error = el("p", "bib-form-error");
    error.hidden = true;
    const submit = el("button", "bib-primary-button", translate("Crear nota"));
    submit.type = "submit";
    const cancel = el("button", "bib-ghost-button", translate("Cancelar"));
    cancel.type = "button";
    cancel.addEventListener("click", () => this.closeNoteDialog());
    const actions = el("div", "bib-form-actions");
    actions.append(submit, cancel);
    form.append(this.buildFormField(translate("Nombre de la nota"), input, true), help, error, actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const title = input.value.trim();
      if (!title) {
        error.textContent = translate("El título es obligatorio.");
        error.hidden = false;
        return;
      }
      submit.disabled = true;
      void this.host
        .createLinkedNote(item, title)
        .then((page) => {
          this.closeNoteDialog();
          this.closeDetail();
          this.host.openPage(page);
        })
        .catch((createError: unknown) => {
          console.error("No se pudo crear la nota vinculada:", createError);
          error.textContent = translate("No se pudo crear la nota. Prueba con otro título.");
          error.hidden = false;
          submit.disabled = false;
        });
    });

    dialog.append(header, form);
    overlay.append(dialog);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.closeNoteDialog();
    });
    this.root.append(overlay);
    this.noteOverlay = overlay;
    this.noteKeyHandler = (event: KeyboardEvent): void => {
      if (event.key === "Escape") this.closeNoteDialog();
    };
    document.addEventListener("keydown", this.noteKeyHandler);
    input.focus();
  }

  private closeNoteDialog(): void {
    this.noteOverlay?.remove();
    this.noteOverlay = null;
    if (this.noteKeyHandler) {
      document.removeEventListener("keydown", this.noteKeyHandler);
      this.noteKeyHandler = null;
    }
  }
}
