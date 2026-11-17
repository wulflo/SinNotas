import type { BlockNode, PageData } from "../types";
import { getAllBlocksFlat } from "../editor/tree-engine";

/** Enlace saliente de una nota, con el bloque donde aparece. */
export interface WikiLinkRef {
  /** Título real del destino (el alias no se usa para resolver). */
  targetTitle: string;
  /** Texto visible tras la barra, si el enlace usa `[[Destino|Alias]]`. */
  alias?: string;
  blockId: string;
  /** Número de línea aproximado dentro del árbol aplanado. */
  lineNumber: number;
  snippet: string;
}

const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/** Quita código en línea y bloques cercados: ahí un wikilink es texto literal. */
function stripCode(content: string): string {
  return content.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

/**
 * Enlaces salientes de una nota. Se deduplican por destino (el primero manda)
 * y se omite el enlace a la propia nota. Los destinos inexistentes se
 * conservan para que la interfaz pueda marcarlos como rotos.
 */
export function collectOutgoingLinks(page: PageData): WikiLinkRef[] {
  const links: WikiLinkRef[] = [];
  const seen = new Set<string>();
  const self = page.title.toLowerCase();

  getAllBlocksFlat(page.blocks).forEach((block: BlockNode, index: number) => {
    const content = stripCode(block.content);
    if (!content.includes("[[")) return;
    for (const match of content.matchAll(WIKILINK_PATTERN)) {
      const targetTitle = match[1].trim();
      if (!targetTitle) continue;
      const key = targetTitle.toLowerCase();
      if (key === self || seen.has(key)) continue;
      seen.add(key);
      links.push({
        targetTitle,
        alias: match[2]?.trim() || undefined,
        blockId: block.id,
        lineNumber: index + 1,
        snippet: block.content,
      });
    }
  });

  return links;
}
