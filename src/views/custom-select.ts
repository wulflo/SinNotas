/**
 * Selectores desplegables con el estilo de la app: reemplaza los `<select>`
 * nativos, cuyos menús salen con el estilo del sistema operativo, por un
 * botón y un menú construidos con la app, que siguen el tema actual
 * (claro/oscuro y estilos visuales).
 *
 * El select nativo se guarda oculto en el DOM y sigue siendo la fuente de
 * verdad: `customSelect.value` devuelve `select.value`, la escritura
 * programática (`select.value = x`) sigue funcionando y el evento "change"
 * se sigue enviando por los elementos migrateados.
 */

export interface CustomSelectItem {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface CustomSelectConfig {
  onChange?: (value: string | null) => void;
}

const APPLIED_MARKER = "data-custom-select-applied";

export class CustomSelect {
  public readonly select: HTMLSelectElement;
  public readonly root: HTMLButtonElement;
  private menu: HTMLDivElement | null = null;
  private isOpen = false;
  private onChange?: (value: string | null) => void;

  private constructor(select: HTMLSelectElement) {
    this.select = select;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "custom-select";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    select.parentElement?.insertBefore(button, select);
    this.root = button;
  }

  public static fromSelect(
    select: HTMLSelectElement,
    config?: CustomSelectConfig
  ): CustomSelect {
    const custom = new CustomSelect(select);
    custom.onChange = config?.onChange;
    const label =
      select.getAttribute("aria-label") ||
      select.labels?.[0]?.textContent?.trim() ||
      "";
    if (label) custom.root.setAttribute("aria-label", label);
    select.style.display = "none";
    select.setAttribute(APPLIED_MARKER, "applied");
    custom.sync();
    custom.root.addEventListener("click", () => custom.toggle());
    custom.root.addEventListener("keydown", (event) => custom.onRootKeydown(event));
    return custom;
  }

  /** Valor del select nativo (`null` cuando no hay ninguno seleccionado). */
  public get value(): string | null {
    return this.select.value || null;
  }

  /** Cambia el valor como si el usuario lo hubiera escogido en el menú. */
  public setValue(value: string | null): void {
    this.select.value = value ?? "";
    this.sync();
  }

  /** Recalcula el texto del botón a partir de las opciones actuales del select. */
  public sync(): void {
    const value = this.select.value;
    const selected = Array.from(this.select.options).find((option) => option.value === value);
    this.root.textContent = selected ? selected.textContent || selected.value : "";
    this.root.setAttribute("aria-expanded", String(this.isOpen));
  }

  public setDisabled(disabled: boolean): void {
    this.root.disabled = disabled;
  }

  public open(): void {
    if (this.isOpen) return;
    this.sync();

    const rootRect = this.root.getBoundingClientRect();
    const menu = document.createElement("div");
    menu.className = "custom-select-menu";
    menu.setAttribute("role", "listbox");
    menu.style.visibility = "hidden";
    const items = Array.from(this.select.options).map((option) => this.buildItem(option));
    if (items.length > 0) menu.append(...items);
    document.body.appendChild(menu);
    this.menu = menu;

    const gap = 6;
    const height = menu.offsetHeight;
    const width = menu.offsetWidth;
    const spaceBelow = window.innerHeight - rootRect.bottom;
    let top = rootRect.bottom + gap;
    if (spaceBelow < height + gap && rootRect.top >= height + gap) {
      top = rootRect.top - height - gap;
    }
    let left = rootRect.left;
    if (left + width > window.innerWidth) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = "visible";
    this.isOpen = true;
    this.root.setAttribute("aria-expanded", "true");
    if (items.length > 0) {
      this.setActiveItem(0, true);
    }
    document.addEventListener("mousedown", this.onDocumentMouseDown);
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.menu?.remove();
    this.menu = null;
    this.root.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", this.onDocumentMouseDown);
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private setActiveItem(index: number, focus = false): void {
    if (!this.menu) return;
    const items = Array.from(this.menu.querySelectorAll<HTMLDivElement>(".custom-select-item"));
    items.forEach((item) => item.classList.remove("is-active"));
    const item = items[index];
    if (!item) return;
    item.classList.add("is-active");
    if (focus) item.focus();
  }

  private buildItem(option: HTMLOptionElement): HTMLDivElement {
    const item = document.createElement("div");
    item.className = "custom-select-item";
    if (option.disabled) item.classList.add("is-disabled");
    item.dataset.value = option.value;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(this.select.value === option.value));
    item.textContent = option.textContent || option.value;
    item.tabIndex = -1;
    item.addEventListener("mouseenter", () => item.classList.add("is-active"));
    item.addEventListener("mouseleave", () => item.classList.remove("is-active"));
    if (option.disabled) return item;
    item.addEventListener("click", () => this.selectItem(item));
    item.addEventListener("keydown", (event) => this.onItemKeydown(event, item));
    return item;
  }

  private onRootKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case "Enter":
      case " ":
      case "ArrowDown":
        event.preventDefault();
        this.open();
        break;
      case "ArrowUp":
        event.preventDefault();
        this.open();
        if (this.menu) this.setActiveItem(this.menu.querySelectorAll<HTMLDivElement>(".custom-select-item").length - 1, true);
        break;
      case "Escape":
        this.close();
        break;
    }
  }

  private onItemKeydown(event: KeyboardEvent, item: HTMLDivElement): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.selectItem(item);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      this.root.focus();
      return;
    }
    if (!this.menu) return;
    const items = Array.from(this.menu.querySelectorAll<HTMLDivElement>(".custom-select-item"));
    const index = items.indexOf(item);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.setActiveItem((index + 1) % items.length, true);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this.setActiveItem((index - 1 + items.length) % items.length, true);
    }
  }

  private onDocumentMouseDown = (event: MouseEvent): void => {
    if (!this.isOpen) return;
    if (this.root.contains(event.target as Node)) return;
    if (this.menu && this.menu.contains(event.target as Node)) return;
    this.close();
  };

  private selectItem(item: HTMLDivElement): void {
    const value = item.dataset.value ?? "";
    const matches = Array.from(this.select.options).some((option) => option.value === value);
    if (!matches || this.select.value === value) {
      this.close();
      return;
    }
    this.select.value = value;
    // Mantener compatibilidad con listeners "change" del select nativo.
    this.select.dispatchEvent(new Event("change", { bubbles: true }));
    this.onChange?.(this.value);
    this.sync();
    this.close();
    this.root.focus();
  }
}

const migratedSelects = new Map<HTMLSelectElement, CustomSelect>();

/**
 * Convierte un `<select>` nativo en el selector desplegado de la app. Es
 * idempotente: los selects ya convertidos se ignoran.
 */
export function migrateSelect(
  select: HTMLSelectElement | null | undefined
): CustomSelect | null {
  if (!select) return null;
  const existing = migratedSelects.get(select);
  if (existing) return existing;
  if (select.getAttribute(APPLIED_MARKER)) return null;
  const custom = CustomSelect.fromSelect(select);
  migratedSelects.set(select, custom);
  return custom;
}

/** Actualiza el botón de un select ya convertido tras cambios del select. */
export function syncCustomSelect(select: HTMLSelectElement | null | undefined): void {
  if (!select) return;
  migratedSelects.get(select)?.sync();
}
