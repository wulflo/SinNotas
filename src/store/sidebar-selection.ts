import { PageData } from "../types";

/**
 * Selección de páginas para la barra lateral: "Fijadas" y "Recientes".
 *
 * - `pinned`: páginas con `pinned`, ordenadas por `pinnedAt` ascendente
 *   (las que no tienen `pinnedAt` van al final, orden de aparición).
 * - `recent`: en el orden de `recentPaths` (la apertura más reciente primero),
 *   solo páginas que existan, sin las fijadas y sin duplicados. Si una ruta
 *   quedó huérfana (nota borrada/renombrada) se descarta.
 */
export function selectSidebarPages(
  pages: readonly PageData[],
  recentPaths: readonly string[]
): { pinned: PageData[]; recent: PageData[] } {
  const pinned = pages
    .filter((page) => page.pinned)
    .sort((left, right) => {
      if (!left.pinnedAt && !right.pinnedAt) return 0;
      if (!left.pinnedAt) return 1;
      if (!right.pinnedAt) return -1;
      return left.pinnedAt.localeCompare(right.pinnedAt);
    });

  const pinnedPaths = new Set(pinned.map((page) => page.path));
  const pagesByPath = new Map(pages.map((page) => [page.path, page]));

  const recent: PageData[] = [];
  const seenPaths = new Set<string>();
  for (const path of recentPaths) {
    if (seenPaths.has(path)) continue;
    seenPaths.add(path);
    const page = pagesByPath.get(path);
    // Rutas huérfanas y fijadas (que ya aparecen en su propia sección) fuera.
    if (!page || pinnedPaths.has(page.path)) continue;
    recent.push(page);
  }

  return { pinned, recent };
}
