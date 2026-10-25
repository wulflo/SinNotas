/**
 * Lista virtualizada con alturas variables.
 *
 * El explorador de flashcards (15.000 tarjetas) y las columnas del Kanban
 * (12.000 tareas) no pueden crear un nodo DOM por elemento: el renderer se
 * queda bloqueado decenas de segundos y la memoria se dispara. Esta clase
 * mantiene en el DOM solo las filas visibles (más un margen de seguridad) y
 * usa un espaciador con la altura total para conservar la barra de scroll.
 *
 * Cada fila se mide tras pintarse. Las alturas se cachean por clave, de modo
 * que cambiar el orden o volver a entrar en la vista no obliga a medir de
 * nuevo todas las tarjetas.
 */

export interface VirtualRange {
  /** Índice inicial (incluido). */
  start: number;
  /** Índice final (excluido). */
  end: number;
}

/** Suma acumulada de alturas: `offsets[i]` es el borde superior de la fila i. */
export function buildOffsets(heights: readonly number[]): Float64Array {
  const offsets = new Float64Array(heights.length + 1);
  for (let i = 0; i < heights.length; i += 1) {
    offsets[i + 1] = offsets[i] + Math.max(0, heights[i]);
  }
  return offsets;
}

/** Índice de la fila que contiene la coordenada `y` (búsqueda binaria). */
export function findIndexAtOffset(offsets: Float64Array, y: number): number {
  const count = offsets.length - 1;
  if (count <= 0) return 0;
  if (y <= 0) return 0;
  if (y >= offsets[count]) return count;

  let low = 0;
  let high = count;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (offsets[mid] <= y) low = mid;
    else high = mid - 1;
  }
  return low;
}

/**
 * Filas que cubren el viewport. `end` es exclusivo.
 *
 * `scrollTop` y `viewportHeight` están en coordenadas del contenedor que
 * scrollea; el llamador resta el desplazamiento del espaciador si la lista no
 * es el primer hijo del scroller.
 */
export function computeVisibleRange(
  offsets: Float64Array,
  scrollTop: number,
  viewportHeight: number,
  overscan = 300
): VirtualRange {
  const total = offsets.length > 0 ? offsets[offsets.length - 1] : 0;
  if (total <= 0) return { start: 0, end: 0 };

  const top = Math.max(0, scrollTop - overscan);
  const bottom = Math.min(total, Math.max(top, scrollTop + Math.max(0, viewportHeight) + overscan));

  const start = findIndexAtOffset(offsets, top);
  let end = findIndexAtOffset(offsets, bottom);
  // La fila que cruza el borde inferior también debe pintarse.
  if (end < offsets.length - 1 && offsets[end] < bottom) end += 1;
  return { start, end };
}

export interface VirtualListOptions<T> {
  /** Elemento que scrollea (puede contener cabecera y otras filas). */
  scroller: HTMLElement;
  /** Elemento donde se inserta el espaciador de la lista. */
  host: HTMLElement;
  renderItem: (item: T, index: number) => HTMLElement;
  /** Altura estimada de una fila aún no medida. */
  estimateHeight?: number;
  /** Separación entre filas, incluida en la altura medida. */
  gap?: number;
  /** Margen extra arriba/abajo del viewport, en píxeles. */
  overscan?: number;
  /** Clave estable para reutilizar la altura medida entre renders. */
  keyFor?: (item: T, index: number) => string;
  /** Texto mostrado cuando no hay elementos. */
  emptyText?: string;
}

export class VirtualList<T> {
  private readonly scroller: HTMLElement;
  private readonly host: HTMLElement;
  private readonly renderItem: (item: T, index: number) => HTMLElement;
  private readonly estimateHeight: number;
  private readonly gap: number;
  private readonly overscan: number;
  private readonly keyFor: (item: T, index: number) => string;

  private items: T[] = [];
  private keys: string[] = [];
  private heights: number[] = [];
  private offsets: Float64Array = new Float64Array(1);
  private readonly heightCache = new Map<string, number>();
  private readonly rows = new Map<string, HTMLElement>();
  private readonly rowIndexes = new Map<string, number>();
  private readonly spacer: HTMLDivElement;
  private emptyEl: HTMLDivElement | null = null;
  private emptyText: string | undefined;

  private resizeObserver: ResizeObserver | null = null;
  private frame: number | null = null;
  private destroyed = false;

  constructor(options: VirtualListOptions<T>) {
    this.scroller = options.scroller;
    this.host = options.host;
    this.renderItem = options.renderItem;
    this.estimateHeight = Math.max(1, options.estimateHeight ?? 120);
    this.gap = Math.max(0, options.gap ?? 0);
    this.overscan = Math.max(0, options.overscan ?? 300);
    this.keyFor = options.keyFor ?? ((_item, index) => String(index));
    this.emptyText = options.emptyText;

    this.spacer = document.createElement("div");
    this.spacer.className = "virtual-list-spacer";
    this.host.appendChild(this.spacer);

    this.scroller.addEventListener("scroll", this.onScroll, { passive: true });
    window.addEventListener("resize", this.onScroll);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver((entries) => this.onRowsResized(entries));
    }

    if (this.emptyText) this.showEmpty();
  }

  /** Reemplaza los elementos y repinta la ventana visible. */
  public setItems(items: readonly T[]): void {
    if (this.destroyed) return;

    const nextKeys = items.map((item, index) => this.keyFor(item, index));
    this.items = [...items];
    this.keys = nextKeys;
    this.heights = nextKeys.map((key) => {
      const cached = this.heightCache.get(key);
      return cached !== undefined ? cached : this.estimateHeight + this.gap;
    });
    this.offsets = buildOffsets(this.heights);
    this.spacer.style.height = `${this.offsets[this.offsets.length - 1]}px`;

    this.clearRows();
    if (this.items.length === 0) {
      this.showEmpty();
    } else {
      this.hideEmpty();
    }

    this.renderWindow();
    // El scroll puede quedar más allá del nuevo total (p. ej. al filtrar).
    const maxScroll = Math.max(0, this.offsets[this.offsets.length - 1] - this.scroller.clientHeight);
    if (this.scroller.scrollTop > maxScroll) this.scroller.scrollTop = maxScroll;
  }

  /** Cambia el mensaje de lista vacía (carga, búsqueda sin resultados, etc.). */
  public setEmptyText(text: string | undefined): void {
    this.emptyText = text;
    if (text && this.emptyEl) this.emptyEl.textContent = text;
    if (this.items.length === 0) {
      if (text) this.showEmpty();
      else this.hideEmpty();
    }
  }

  /** Vuelve a medir las filas visibles (fuentes, imágenes, zoom del sistema). */
  public refresh(): void {
    this.scheduleRender();
  }

  /** Desplaza la lista al inicio y repinta. */
  public scrollToTop(): void {
    if (this.scroller.scrollTop !== 0) this.scroller.scrollTop = 0;
    this.scheduleRender();
  }

  public destroy(): void {
    this.destroyed = true;
    this.scroller.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.onScroll);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    this.clearRows();
    this.spacer.remove();
  }

  private readonly onScroll = (): void => {
    this.scheduleRender();
  };

  private readonly onRowsResized = (entries: ResizeObserverEntry[]): void => {
    let changed = false;
    for (const entry of entries) {
      const row = entry.target as HTMLElement;
      const key = row.dataset.virtualKey;
      if (key === undefined) continue;
      const index = this.rowIndexes.get(key);
      if (index === undefined) continue;
      const measured = entry.borderBoxSize?.[0]?.blockSize ?? row.getBoundingClientRect().height;
      if (this.updateHeight(index, key, measured)) changed = true;
    }
    if (changed) this.scheduleRender();
  };

  private scheduleRender(): void {
    if (this.destroyed || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.renderWindow();
    });
  }

  private updateHeight(index: number, key: string, measured: number): boolean {
    if (!Number.isFinite(measured) || measured <= 0) return false;
    const next = Math.ceil(measured);
    if (Math.abs((this.heights[index] ?? 0) - next) < 1) return false;
    this.heights[index] = next;
    this.heightCache.set(key, next);
    return true;
  }

  private renderWindow(): void {
    if (this.destroyed || this.items.length === 0) return;

    const scrollerRect = this.scroller.getBoundingClientRect();
    const spacerRect = this.spacer.getBoundingClientRect();
    // Coordenada del borde superior visible dentro del espaciador. No se usa
    // `scrollTop - (spacerTop - scrollerTop)`: esa diferencia ya incluye el
    // scroll y restaba la posición dos veces (el deep scroll quedaba vacío).
    const visibleTop = scrollerRect.top - spacerRect.top;
    const { start, end } = computeVisibleRange(
      this.offsets,
      visibleTop,
      this.scroller.clientHeight,
      this.overscan
    );

    for (const [key, row] of this.rows) {
      const index = this.rowIndexes.get(key);
      if (index === undefined || index < start || index >= end) {
        this.resizeObserver?.unobserve(row);
        row.remove();
        this.rows.delete(key);
        this.rowIndexes.delete(key);
      }
    }

    const created: HTMLElement[] = [];
    for (let index = start; index < end; index += 1) {
      const key = this.keys[index];
      if (key === undefined) continue;
      let row = this.rows.get(key);
      if (!row) {
        row = document.createElement("div");
        row.className = "virtual-list-row";
        row.dataset.virtualKey = key;
        row.style.paddingBottom = `${this.gap}px`;
        row.appendChild(this.renderItem(this.items[index], index));
        this.spacer.appendChild(row);
        this.rows.set(key, row);
        this.rowIndexes.set(key, index);
        created.push(row);
      } else if (this.rowIndexes.get(key) !== index) {
        this.rowIndexes.set(key, index);
      }
    }
    this.positionRows();

    const anchorIndex = findIndexAtOffset(this.offsets, Math.max(0, visibleTop));
    const oldAnchorOffset = this.offsets[anchorIndex] ?? 0;

    let changed = false;
    for (const [key, row] of this.rows) {
      const index = this.rowIndexes.get(key);
      if (index === undefined) continue;
      const measured = row.getBoundingClientRect().height;
      if (this.updateHeight(index, key, measured)) changed = true;
    }

    if (created.length > 0) {
      for (const row of created) this.resizeObserver?.observe(row);
    }

    if (changed) {
      this.offsets = buildOffsets(this.heights);
      this.spacer.style.height = `${this.offsets[this.offsets.length - 1]}px`;
      // Recoloca antes del siguiente frame: si cambia la altura de una fila,
      // las de abajo deben moverse en el mismo pintado y no solaparse.
      this.positionRows();
      // Evita el salto visual cuando cambia la altura de filas ya visibles.
      const nextAnchorOffset = this.offsets[anchorIndex] ?? oldAnchorOffset;
      if (nextAnchorOffset !== oldAnchorOffset) {
        this.scroller.scrollTop += nextAnchorOffset - oldAnchorOffset;
      }
      // Los límites pueden haberse movido al cambiar alturas.
      const nextRange = computeVisibleRange(
        this.offsets,
        this.scroller.getBoundingClientRect().top - this.spacer.getBoundingClientRect().top,
        this.scroller.clientHeight,
        this.overscan
      );
      if (nextRange.start !== start || nextRange.end !== end) this.scheduleRender();
    }
  }

  /** Aplica la posición actual a todas las filas montadas. */
  private positionRows(): void {
    for (const [key, row] of this.rows) {
      const index = this.rowIndexes.get(key);
      if (index === undefined) continue;
      row.style.top = `${this.offsets[index]}px`;
    }
  }

  private clearRows(): void {
    for (const [key, row] of this.rows) {
      this.resizeObserver?.unobserve(row);
      row.remove();
      this.rows.delete(key);
      this.rowIndexes.delete(key);
    }
  }

  private showEmpty(): void {
    if (!this.emptyText) return;
    if (!this.emptyEl) {
      this.emptyEl = document.createElement("div");
      this.emptyEl.className = "virtual-list-empty";
      this.emptyEl.textContent = this.emptyText;
      this.host.insertBefore(this.emptyEl, this.spacer);
    }
    this.emptyEl.hidden = false;
  }

  private hideEmpty(): void {
    if (this.emptyEl) this.emptyEl.hidden = true;
  }
}
