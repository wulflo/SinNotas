import { PageData, BlockNode } from "../types";

/** Resultado de la búsqueda de contenido: una coincidencia por nota. */
export interface ContentHit {
  /** Página que contiene el bloque (exige título y ruta para el omnibar). */
  page: PageData;
  /** Bloque que coincide (para saltar al cursor tras abrir la nota). */
  block: BlockNode;
  /** Apariciones acumuladas de todos los tokens (tope de 20 por token). */
  count: number;
  /** Índice (en el texto plegado) de la primera coincidencia. */
  index: number;
  /** Longitud del primer token coincidente (en el texto plegado). */
  matchLength: number;
}

/** Línea de propiedad `clave:: valor`: no forma parte del texto visible. */
const PROPERTY_LINE_PATTERN = /^[\w-]+::\s*.*$/i;

/** Caracteres de contexto alrededor de la coincidencia en el fragmento. */
const SNIPPET_BEFORE = 40;
const SNIPPET_AFTER = 80;

/** Tope de apariciones contadas por token y por bloque. */
const MAX_COUNT_PER_TOKEN = 20;

/**
 * Recoge recursivamente los bloques de texto con contenido de una lista de
 * nodos; los bloques de imagen se ignoran (sus hijos sí se recorren).
 */
export function collectTextBlocks(nodes: readonly BlockNode[]): BlockNode[] {
  const blocks: BlockNode[] = [];
  const walk = (list: readonly BlockNode[]): void => {
    list.forEach((block) => {
      if (block.type !== "image" && block.content.trim()) {
        blocks.push(block);
      }
      walk(block.children);
    });
  };
  walk(nodes);
  return blocks;
}

/**
 * Texto visible de un bloque: sin las líneas de propiedad `clave:: valor`.
 * La regla es la misma que usa `splitBlockProperties` del editor; va duplicada
 * a propósito para que este módulo no dependa de `desktop.ts`. Lo demás (cloze,
 * [[enlaces]], prefijos TODO) se busca tal cual.
 */
export function visibleBlockText(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => !PROPERTY_LINE_PATTERN.test(line.trim()))
    .join("\n");
}

/**
 * Plegado de texto para comparar sin mayúsculas ni acentos, la misma técnica
 * que `normalizeMatch` en graph-settings.ts. Ojo: puede cambiar la longitud
 * (NFD descompone), así que las posiciones solo mapean 1:1 al texto original
 * cuando `fold(text).length === text.length`.
 */
export function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

interface BlockEntry {
  page: PageData;
  block: BlockNode;
  /** Texto visible del bloque, con relaciones 1:1 solo si no ha plegado. */
  text: string;
  /** Texto del bloque plegado (minúsculas, sin acentos). */
  folded: string;
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let position = haystack.indexOf(needle);
  while (position !== -1 && count < MAX_COUNT_PER_TOKEN) {
    count += 1;
    position = haystack.indexOf(needle, position + needle.length);
  }
  return count;
}

/**
 * Índice de búsqueda de contenido en memoria. Se alimenta de las páginas que
 * ya devuelve load_vault y se reconstruye solo cuando cambia la versión del
 * vault (getMutationVersion), así que llamadas repetidas con la misma versión
 * son gratis. Sin comandos Rust ni índice persistente.
 */
export class ContentSearchIndex {
  private entries: BlockEntry[] = [];
  private version = -1;
  private hasIndex = false;

  /** Reconstruye el índice solo si cambia la versión del vault. */
  update(pages: readonly PageData[], version: number): void {
    if (this.hasIndex && version === this.version) return;
    this.version = version;
    this.hasIndex = true;
    const entries: BlockEntry[] = [];
    pages.forEach((page) => {
      collectTextBlocks(page.blocks).forEach((block) => {
        const text = visibleBlockText(block.content);
        if (!text.trim()) return;
        entries.push({ page, block, text, folded: fold(text) });
      });
    });
    this.entries = entries;
  }

  /**
   * Busca los bloques donde aparecen TODOS los tokens de la consulta (AND,
   * ignorando mayúsculas y acentos). Devuelve lo mejor por nota: el bloque con
   * más apariciones, ordenado por apariciones descendente. El índice del hit
   * apunta a la primera coincidencia (el token que empiece antes), y su
   * longitud es la del token en el texto plegado.
   */
  search(query: string, limit = 25): ContentHit[] {
    const tokens = normalizeQuery(query);
    if (tokens.length === 0) return [];

    const bestByPath = new Map<string, ContentHit>();
    for (const entry of this.entries) {
      let total = 0;
      let first: { index: number; length: number } | null = null;
      let allPresent = true;
      for (const token of tokens) {
        const count = countOccurrences(entry.folded, token);
        if (count === 0) {
          allPresent = false;
          break;
        }
        total += count;
        const index = entry.folded.indexOf(token);
        if (!first || index < first.index) first = { index, length: token.length };
      }
      if (!allPresent || !first) continue;

      const existing = bestByPath.get(entry.page.path);
      if (existing) {
        // Una coincidencia por nota: queda el bloque con más apariciones.
        if (total <= existing.count) continue;
        existing.count = total;
        existing.block = entry.block;
        existing.index = first.index;
        existing.matchLength = first.length;
        continue;
      }
      bestByPath.set(entry.page.path, {
        page: entry.page,
        block: entry.block,
        count: total,
        index: first.index,
        matchLength: first.length,
      });
    }

    return Array.from(bestByPath.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, limit);
  }
}

/** Tokeniza la consulta plegada por espacios y descarta los huecos. */
function normalizeQuery(query: string): string[] {
  return fold(query)
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/** Colapsa espacios en blanco repetidos en uno solo (y recorta extremos). */
function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Fragmento de contexto alrededor de una coincidencia: hasta 40 caracteres
 * antes y 80 después, con "…" donde se corte y espacios colapsados. Los tres
 * trozos se pintan con textContent y un elemento mark — nunca con HTML.
 * La coincidencia vacía (matchLength 0) produce el inicio del bloque sin
 * resaltado: es el recurso del integrador cuando el plegado cambió la
 * longitud y las posiciones plegadas ya no caen en el texto original.
 */
export function buildSnippet(
  text: string,
  index: number,
  matchLength: number
): { before: string; match: string; after: string } {
  const matchStart = Math.max(0, Math.min(index, text.length));
  const matchEnd = Math.max(matchStart, Math.min(index + matchLength, text.length));

  const match = collapseWhitespace(text.slice(matchStart, matchEnd));
  const rawBefore = text.slice(Math.max(0, matchStart - SNIPPET_BEFORE), matchStart);
  const rawAfter = text.slice(matchEnd, matchEnd + SNIPPET_AFTER);

  const before =
    (matchStart > SNIPPET_BEFORE ? "…" : "") + collapseWhitespace(rawBefore);
  const after =
    collapseWhitespace(rawAfter) + (text.length > matchEnd + SNIPPET_AFTER ? "…" : "");

  return { before, match, after };
}
