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
        createdAtOf(left),
        createdAtOf(right),
        direction
      );
    } else {
      result = compareOptionalNumbers(
        timestampOf(left.updatedAt),
        timestampOf(right.updatedAt),
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
