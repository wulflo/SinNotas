/**
 * Separador canónico entre mazos en el título de una nota.
 *
 * El título de una nota es también su nombre de archivo, así que el separador
 * debe ser válido en Windows, macOS y Linux. Los dos puntos (`::`) no lo son
 * en Windows; la flecha `→` sí lo es y representa claramente la jerarquía.
 */
export const DECK_SEPARATOR = " → ";

/**
 * Alias aceptados al escribir o al leer títulos antiguos:
 * - `::` y `›`/`»` para conservar títulos creados con la convención anterior.
 * - `->`, `=>` y `>` como formas fáciles de escribir una flecha.
 */
const DECK_SEPARATOR_PATTERN = /\s*(?:->|=>|::|›|»|→|>)\s*/;

/** Divide un título en sus segmentos de mazo, descartando vacíos. */
export function splitDeckTitle(title: string): string[] {
  const trimmed = title.trim();
  if (!trimmed) return [];
  return trimmed
    .split(DECK_SEPARATOR_PATTERN)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Convierte cualquier alias de separador al canónico `→`.
 *
 * Si el título no tiene separadores se conserva tal cual (salvo espacios en
 * los extremos). Así los títulos normales no cambian al renombrarlos.
 */
export function normalizeDeckTitle(title: string): string {
  return splitDeckTitle(title).join(DECK_SEPARATOR);
}

/**
 * Devuelve un título seguro para usarlo como nombre de archivo.
 *
 * A diferencia de `normalizeDeckTitle`, sustituye los caracteres prohibidos
 * por `-` en lugar de rechazar el título. Se usa al crear notas desde la
 * búsqueda o desde un wikilink, donde no hay un formulario que pueda mostrar
 * un error antes de escribir el archivo.
 */
export function sanitizeDeckTitle(title: string): string {
  return splitDeckTitle(title)
    .map((segment) => segment.replace(/[\\/:*?"<>|]/g, "-").trim())
    .filter((segment) => segment.length > 0)
    .join(DECK_SEPARATOR);
}

/** Comprueba si algún segmento conserva caracteres no válidos para un archivo. */
export function hasInvalidDeckTitleCharacters(segments: readonly string[]): boolean {
  return segments.some((segment) => /[\\/:*?"<>|]/.test(segment));
}
