/**
 * Normalización única de `PageData` en todos los puntos de entrada.
 *
 * Antes cada ingress (constructor web, `replaceVault`, deltas, hidratación,
 * guardado) aplicaba a mano una combinación distinta de: tipos de bloque,
 * ruta relativa y fijadas desde frontmatter. Era la fuente de bugs del tipo
 * «se perdió al recargar» o «el bloque aparece como texto».
 */
import { BlockNode, PageData } from "../types";
import { applyPinnedFrontmatter } from "./pinned-frontmatter";

export function normalizeBlockTypes(blocks: BlockNode[]): void {
  for (const block of blocks) {
    const [firstLine, ...remainingLines] = block.content.split(/\r?\n/);
    const match = firstLine.match(/^!\[([^\]\r\n]*)\]\(([^()\r\n]+)\)$/);
    const source = match?.[2].trim() || firstLine.trim();
    if (source && /\.(?:png|jpe?g|webp|svg|gif|bmp)$/i.test(source)) {
      block.type = "image";
      const fileName = source.split(/[\\/]/).pop()?.split(/[?#]/, 1)[0] || "imagen";
      block.imageAlt = match?.[1] || fileName.replace(/\.[^.]+$/, "") || "imagen";
      block.content = [source, ...remainingLines].join("\n");
    } else if (block.type !== "image") {
      block.type = "text";
    }
    normalizeBlockTypes(block.children || []);
  }
}

/** Convierte rutas heredadas (absolutas o prefijadas por la raíz) a relativas. */
export function normalizeNotePath(path: string, rootPath?: string | null): string {
  let normalized = (path || "").replace(/\\/g, "/").trim();
  if (!normalized) return normalized;

  const normalizedRoot = rootPath?.replace(/\\/g, "/").replace(/\/+$/, "");
  if (normalizedRoot && normalized.startsWith(`${normalizedRoot}/`)) {
    normalized = normalized.slice(normalizedRoot.length + 1);
  }

  const pagesIndex = normalized.lastIndexOf("/pages/");
  const journalsIndex = normalized.lastIndexOf("/journals/");
  const knownIndex = Math.max(pagesIndex, journalsIndex);
  if (knownIndex >= 0) {
    normalized = normalized.slice(knownIndex + 1);
  } else if (/^(?:\/|[a-z]:\/)/i.test(normalized)) {
    normalized = normalized.split("/").pop() || normalized;
  }

  return normalized.replace(/^\/+/, "");
}

export interface NormalizePageOptions {
  /**
   * En Tauri el payload de Rust ya trae tipos canónicos; renormalizar el
   * vault entero en cada arranque era innecesario (FASE 6.2).
   */
  blockTypes?: boolean;
}

export function normalizePage(
  page: PageData,
  rootPath?: string | null,
  options: NormalizePageOptions = {}
): void {
  if (options.blockTypes) normalizeBlockTypes(page.blocks || []);
  page.path = normalizeNotePath(page.path || "", rootPath);
  applyPinnedFrontmatter(page);
}
