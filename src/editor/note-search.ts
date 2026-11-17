import type { BlockNode } from "../types";
import { getAllBlocksFlat } from "./tree-engine";
import { fold, visibleBlockText } from "../store/content-search";

/** Coincidencia dentro de una nota, con offsets sobre el texto visible. */
export interface NoteMatch {
  blockId: string;
  start: number;
  end: number;
}

/** Tope defensivo: una nota con miles de repeticiones no debe congelar la UI. */
const MAX_NOTE_MATCHES = 5000;

/**
 * Todas las apariciones de `query` en `text`, sin distinguir mayúsculas ni
 * acentos. `fold` puede cambiar longitudes, así que se mantiene un mapa de cada
 * carácter plegado a su índice original.
 */
export function findFoldedRanges(
  text: string,
  query: string
): Array<{ start: number; end: number }> {
  const needle = fold(query);
  if (!needle || !text) return [];

  let folded = "";
  const positions: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const piece = fold(text[index]);
    for (const char of piece) {
      folded += char;
      positions.push(index);
    }
  }

  const ranges: Array<{ start: number; end: number }> = [];
  let at = folded.indexOf(needle);
  while (at !== -1 && ranges.length < MAX_NOTE_MATCHES) {
    const start = positions[at];
    const end = positions[at + needle.length - 1] + 1;
    if (start !== undefined && end > start) ranges.push({ start, end });
    at = folded.indexOf(needle, at + Math.max(1, needle.length));
  }
  return ranges;
}

/**
 * Recorre la nota en orden de lectura, incluyendo bullets colapsados (la
 * navegación se encarga de expandir sus ancestros). Las propiedades `clave::`
 * no son texto visible y las imágenes no contienen texto buscable.
 */
export function findMatchesInBlocks(
  blocks: readonly BlockNode[],
  query: string
): NoteMatch[] {
  if (!fold(query)) return [];
  const matches: NoteMatch[] = [];

  for (const block of getAllBlocksFlat([...blocks])) {
    if (matches.length >= MAX_NOTE_MATCHES) break;
    if (block.type !== "text") continue;
    const text = visibleBlockText(block.content);
    if (!text) continue;
    findFoldedRanges(text, query).forEach((range) => {
      matches.push({ blockId: block.id, ...range });
    });
  }

  return matches;
}
