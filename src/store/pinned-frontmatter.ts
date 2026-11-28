/**
 * Persistencia de las notas fijadas en el frontmatter del `.md`.
 *
 * El backend Rust solo serializa `frontmatter` y `blocks` (`save_page`), así
 * que `page.pinned`/`page.pinnedAt` vivían solo en memoria: al cerrar Tauri la
 * fijada se perdía. Guardamos dos líneas canónicas (`pinned:: true` y
 * `pinned-at:: <ISO>`) junto al resto del frontmatter y las leemos al cargar.
 * Es compatible con bóvedas antiguas: si las claves no existen, se conserva el
 * estado que ya tuviera la nota en memoria/localStorage.
 */
import { PageData } from "../types";

const PINNED_LINE = /^\s*pinned\s*::\s*(true|false)\s*$/i;
const PINNED_AT_LINE = /^\s*pinned-at\s*::\s*(\S.*?)\s*$/i;
const ANY_PINNED_LINE = /^\s*pinned(?:-at)?\s*::\s*.*$/i;

/** Lee las claves de fijado sin tocar ninguna otra línea del frontmatter. */
export function readPinnedFromFrontmatter(
  frontmatter: readonly string[] | undefined
): { pinned?: boolean; pinnedAt?: string } {
  const result: { pinned?: boolean; pinnedAt?: string } = {};
  if (!Array.isArray(frontmatter)) return result;
  for (const line of frontmatter) {
    const pinned = line.match(PINNED_LINE);
    if (pinned) {
      result.pinned = pinned[1].toLowerCase() === "true";
      continue;
    }
    const at = line.match(PINNED_AT_LINE);
    if (at && !Number.isNaN(Date.parse(at[1]))) result.pinnedAt = at[1];
  }
  return result;
}

/** Devuelve un frontmatter nuevo con las claves de fijado sincronizadas. */
export function writePinnedToFrontmatter(
  frontmatter: readonly string[] | undefined,
  pinned: boolean | undefined,
  pinnedAt: string | undefined
): string[] {
  const kept = (frontmatter || []).filter((line) => !ANY_PINNED_LINE.test(line));
  if (!pinned) return kept;
  const stamp = pinnedAt && !Number.isNaN(Date.parse(pinnedAt))
    ? pinnedAt
    : new Date().toISOString();
  return [...kept, "pinned:: true", `pinned-at:: ${stamp}`];
}

/** Aplica el frontmatter leído a una nota; las claves ausentes no sobrescriben. */
export function applyPinnedFrontmatter(page: PageData): void {
  const { pinned, pinnedAt } = readPinnedFromFrontmatter(page.frontmatter);
  if (pinned !== undefined) page.pinned = pinned;
  if (pinnedAt !== undefined) page.pinnedAt = pinnedAt;
}
