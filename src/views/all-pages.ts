import type { PageData } from "../types";
import { fold } from "../store/content-search";

/**
 * Claves de ordenación de la vista "Todas las páginas". Se guardan como
 * `clave-dirección` para que el valor pueda venir directamente del `<select>`.
 */
export type AllPagesSortKey = "updated" | "created" | "title";
export type AllPagesSortDirection = "asc" | "desc";
export type AllPagesSort = `${AllPagesSortKey}-${AllPagesSortDirection}`;

export const ALL_PAGES_SORT_VALUES: readonly AllPagesSort[] = [
  "updated-desc",
  "updated-asc",
  "title-asc",
  "title-desc",
  "created-desc",
  "created-asc",
];

export function isAllPagesSort(value: unknown): value is AllPagesSort {
  return typeof value === "string" && (ALL_PAGES_SORT_VALUES as readonly string[]).includes(value);
}

export function parseAllPagesSort(value: unknown): {
  key: AllPagesSortKey;
  direction: AllPagesSortDirection;
} {
  const sort = isAllPagesSort(value) ? value : "updated-desc";
  const separator = sort.lastIndexOf("-");
  return {
    key: sort.slice(0, separator) as AllPagesSortKey,
    direction: sort.slice(separator + 1) as AllPagesSortDirection,
  };
}

/** Título visible de la página (los diarios muestran su fecha formateada). */
export type AllPagesTitleResolver = (page: PageData) => string;

/**
 * Ciclo de ordenación al pulsar una cabecera: la misma columna alterna
 * asc/desc; una columna nueva empieza en ascendente. Así el clic es
 * predecible y no depende del `<select>`.
 */
export function nextAllPagesSort(
  current: AllPagesSort,
  key: AllPagesSortKey
): AllPagesSort {
  const { key: currentKey, direction } = parseAllPagesSort(current);
  const nextDirection: AllPagesSortDirection =
    currentKey === key && direction === "asc" ? "desc" : "asc";
  return `${key}-${nextDirection}` as AllPagesSort;
}

/**
 * Formatea una marca Unix en ms con el idioma activo. `—` cuando no hay dato
 * (nunca se inventa una fecha: antes se mostraba "Reciente" para todo).
 */
export function formatPageDate(
  ms: number | null | undefined,
  locale?: string
): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return "—";
  }
}

/**
 * Filtra por título visible. El plegado ignora mayúsculas y acentos, así que
 * "pagina" encuentra "Página". Cada palabra de la consulta debe aparecer en el
 * título visible, el título interno o la ruta (útil para diarios). El orden de
 * las palabras no importa: "algebra pagina" también encuentra la nota.
 */
export function filterAllPages(
  pages: readonly PageData[],
  query: string,
  displayTitle: AllPagesTitleResolver
): PageData[] {
  const tokens = fold(query.trim()).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [...pages];
  return pages.filter((page) => {
    const searchable = `${displayTitle(page)}\u0000${page.title}\u0000${page.path}`;
    const haystack = fold(searchable);
    return tokens.every((token) => haystack.includes(token));
  });
}

/** Convierte las fechas ISO-like del vault (`YYYY-MM-DD HH:mm`) en ms. */
function timestampOf(value: string | undefined): number | null {
  if (!value) return null;
  const withTimeSeparator = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = Date.parse(withTimeSeparator);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Fecha de última modificación en ms. Prefiere la marca que envía Rust
 * (`updatedAtMs`, con resolución de milisegundos) y cae al string ISO del modo
 * web/demo. Devuelve `null` cuando no hay dato.
 */
export function pageUpdatedMs(page: PageData): number | null {
  if (typeof page.updatedAtMs === "number" && Number.isFinite(page.updatedAtMs)) {
    return page.updatedAtMs;
  }
  return timestampOf(page.updatedAt);
}

/**
 * Fecha de creación en ms. Prefiere `createdAtMs` del backend; si falta usa el
 * resolutor inyectado (que conoce los diarios y la caché de `read_note_created_times`).
 */
export function pageCreatedMs(
  page: PageData,
  createdAtOf: (page: PageData) => number | null
): number | null {
  if (typeof page.createdAtMs === "number" && Number.isFinite(page.createdAtMs)) {
    return page.createdAtMs;
  }
  return createdAtOf(page);
}

/** Compara dos valores donde `null` significa "dato desconocido" y va al final. */
function compareOptionalNumbers(
  left: number | null,
  right: number | null,
  direction: AllPagesSortDirection
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === "asc" ? left - right : right - left;
}

/**
 * Ordena una copia de la lista. Las páginas fijadas siguen agrupadas arriba
 * (comportamiento previo de la vista) y dentro de cada grupo se aplica la
 * clave elegida. Las fechas desconocidas quedan al final en ambos sentidos.
 */
export function sortAllPages(
  pages: readonly PageData[],
  sort: AllPagesSort,
  displayTitle: AllPagesTitleResolver,
  createdAtOf: (page: PageData) => number | null
): PageData[] {
  const { key, direction } = parseAllPagesSort(sort);
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  return [...pages].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;

    let result = 0;
    if (key === "title") {
      result = collator.compare(displayTitle(left), displayTitle(right));
      if (direction === "desc") result = -result;
    } else if (key === "created") {
      result = compareOptionalNumbers(
        pageCreatedMs(left, createdAtOf),
        pageCreatedMs(right, createdAtOf),
        direction
      );
    } else {
      result = compareOptionalNumbers(
        pageUpdatedMs(left),
        pageUpdatedMs(right),
        direction
      );
    }

    if (result !== 0) return result;
    // Desempate estable: nombre y luego id, sin importar la dirección.
    return (
      collator.compare(displayTitle(left), displayTitle(right)) ||
      left.id.localeCompare(right.id)
    );
  });
}
