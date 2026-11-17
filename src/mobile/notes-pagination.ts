/**
 * Paginado puro para el selector de notas del modo repaso.
 *
 * El selector móvil puede recibir cientos de notas con tarjetas. Renderizar
 * todas de golpe bloquea el WebView y hace que el modal parezca colapsar, así
 * que se muestran en páginas de 20 (el mismo tamaño que usa escritorio) y cada
 * página se añade al DOM en pequeños lotes.
 */

/** Notas por página; coincide con `FLASHCARD_PAGES_PER_PAGE` de escritorio. */
export const NOTES_PER_PAGE = 20;

/** Filas que se añaden por fotograma dentro de una página. */
export const NOTES_RENDER_CHUNK = 8;

export interface NotesPage<T> {
  /** Elementos de la página solicitada, ya recortados. */
  items: T[];
  /** Página efectiva tras aplicar los límites. */
  currentPage: number;
  /** Total de páginas; como mínimo 1 incluso con la lista vacía. */
  totalPages: number;
  /** Índice global del primer elemento de la página. */
  start: number;
  /** Índice global exclusivo del final de la página. */
  end: number;
}

/**
 * Recorta una lista a la página pedida.
 *
 * - Una lista vacía siempre devuelve una única página vacía.
 * - Una página fuera de rango se ajusta a la primera o a la última.
 * - `perPage` se normaliza para evitar divisiones por cero.
 */
export function paginateNotes<T>(
  items: readonly T[],
  requestedPage: number,
  perPage: number = NOTES_PER_PAGE
): NotesPage<T> {
  const pageSize = Math.max(1, Math.trunc(perPage) || NOTES_PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.trunc(requestedPage) || 1;
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, items.length);

  return {
    items: items.slice(start, end),
    currentPage,
    totalPages,
    start,
    end,
  };
}
