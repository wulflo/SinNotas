import type { PageData } from "../types";
import { collectOutgoingLinks } from "../store/wikilinks";

/**
 * Títulos conectados a `origin` a una profundidad dada, contando enlaces
 * entrantes y salientes. Solo se devuelven notas que existen en `pages`; el
 * origen se incluye siempre para poder centrar el grafo aunque no haya aristas.
 * FASE 4-C: `links` permite pasar la adyacencia servida por Rust
 * (`graph_links`, title => wikilinks salientes sin alias); sin ella se extrae
 * de los bloques con `collectOutgoingLinks` como siempre.
 */
export function connectedPageTitles(
  pages: readonly PageData[],
  origin: string,
  depth = 1,
  links?: ReadonlyMap<string, readonly string[]>
): Set<string> {
  const byLower = new Map<string, string>();
  pages.forEach((page) => byLower.set(page.title.toLowerCase(), page.title));
  const originTitle = byLower.get(origin.toLowerCase()) || origin;
  const connected = new Set<string>([originTitle]);
  if (depth <= 0) return connected;

  const adjacency = new Map<string, Set<string>>();
  const connect = (a: string, b: string): void => {
    if (a === b) return;
    let from = adjacency.get(a);
    if (!from) {
      from = new Set();
      adjacency.set(a, from);
    }
    from.add(b);
    let back = adjacency.get(b);
    if (!back) {
      back = new Set();
      adjacency.set(b, back);
    }
    back.add(a);
  };

  pages.forEach((page) => {
    const targets = links
      ? links.get(page.title) ?? []
      : collectOutgoingLinks(page).map((link) => link.targetTitle);
    targets.forEach((targetTitle) => {
      const target = byLower.get(targetTitle.toLowerCase());
      if (target) connect(page.title, target);
    });
  });

  let frontier = [originTitle];
  for (let step = 0; step < depth; step += 1) {
    const next: string[] = [];
    frontier.forEach((title) => {
      adjacency.get(title)?.forEach((neighbor) => {
        if (connected.has(neighbor)) return;
        connected.add(neighbor);
        next.push(neighbor);
      });
    });
    if (next.length === 0) break;
    frontier = next;
  }

  return connected;
}
