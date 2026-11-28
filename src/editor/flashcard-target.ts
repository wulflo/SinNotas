/**
 * Resolución del bullet al que afectan los atajos de crear/quitar tarjetas.
 *
 * Vivía implícita en `desktop.ts`: los dos handlers miraban solo
 * `selectedBulletIds`, de modo que con el cursor dentro de un bullet (sin
 * selección) no hacían nada y no avisaban. Extraer la decisión aquí permite
 * probar la prioridad sin DOM: selección → cursor → bullet enfocado.
 */
import { PageData } from "../types";
import { findNodeLocation } from "./tree-engine";

export interface CardTargetContext {
  selectedIds: readonly string[];
  cursorId?: string | null;
  focusedId?: string | null;
}

/** Idades que existen realmente en la página, en el orden recibido. */
function existingIds(page: PageData, ids: readonly (string | null | undefined)[]): string[] {
  const result: string[] = [];
  for (const id of ids) {
    if (!id || result.includes(id)) continue;
    if (findNodeLocation(page.blocks, id)) result.push(id);
  }
  return result;
}

/**
 * Devuelve los bullets objetivo: la selección si la hay; si no, el bullet con
 * el cursor; si no, el bullet enfocado. Los ids que ya no están en la página
 * (selección obsoleta tras un render) se descartan.
 */
export function resolveCardTargetIds(page: PageData, context: CardTargetContext): Set<string> {
  const selected = existingIds(page, context.selectedIds);
  if (selected.length > 0) return new Set(selected);
  const cursor = existingIds(page, [context.cursorId]);
  if (cursor.length > 0) return new Set(cursor);
  const focused = existingIds(page, [context.focusedId]);
  if (focused.length > 0) return new Set(focused);
  return new Set<string>();
}
