import type { BlockNode, PageData } from "../types";

/**
 * Modelo de datos de la bibliografía.
 *
 * Cada recurso (libro, vídeo, artículo o página web) es una nota Markdown del
 * vault. Los metadatos viven en el frontmatter YAML y el cuerpo de la nota
 * queda libre para que el usuario escriba lo que quiera. Las notas hijas se
 * marcan con `bib-nota` y apuntan al recurso con `bib-padre`, de modo que el
 * recurso principal no necesita contener una base de datos aparte.
 */
export const BIBLIOGRAPHY_FLAG_KEY = "biblioteca";
export const BIBLIOGRAPHY_TYPE_KEY = "bib-tipo";
export const BIBLIOGRAPHY_STATUS_KEY = "bib-estado";
export const BIBLIOGRAPHY_AUTHOR_KEY = "bib-autor";
export const BIBLIOGRAPHY_YEAR_KEY = "bib-anio";
export const BIBLIOGRAPHY_TOTAL_KEY = "bib-total";
export const BIBLIOGRAPHY_CURRENT_KEY = "bib-actual";
export const BIBLIOGRAPHY_COVER_KEY = "bib-portada";
export const BIBLIOGRAPHY_LINK_KEY = "bib-enlace";
export const BIBLIOGRAPHY_RATING_KEY = "bib-valoracion";
export const BIBLIOGRAPHY_NOTE_FLAG_KEY = "bib-nota";
export const BIBLIOGRAPHY_PARENT_KEY = "bib-padre";

export type BibliographyType = "book" | "video" | "article" | "webpage";
export type BibliographyStatus = "pending" | "reading" | "paused" | "completed";

export const BIBLIOGRAPHY_TYPES: readonly BibliographyType[] = [
  "book",
  "video",
  "article",
  "webpage",
];

export const BIBLIOGRAPHY_STATUSES: readonly BibliographyStatus[] = [
  "pending",
  "reading",
  "paused",
  "completed",
];

/** Etiquetas canónicas (en español) que el sistema de i18n traduce. */
export const BIBLIOGRAPHY_TYPE_LABELS: Record<BibliographyType, string> = {
  book: "Libro",
  video: "Vídeo",
  article: "Artículo",
  webpage: "Página web",
};

export const BIBLIOGRAPHY_STATUS_LABELS: Record<BibliographyStatus, string> = {
  pending: "Pendiente",
  reading: "Leyendo",
  paused: "Pausado",
  completed: "Completado",
};

export const BIBLIOGRAPHY_TYPE_ICONS: Record<BibliographyType, string> = {
  book: "📖",
  video: "🎬",
  article: "📄",
  webpage: "🌐",
};

export interface BibliographyItem {
  page: PageData;
  type: BibliographyType;
  status: BibliographyStatus;
  author: string;
  year: string;
  total: number;
  current: number;
  cover: string;
  link: string;
  rating: number;
}

export interface BibliographyPatch {
  type?: BibliographyType;
  status?: BibliographyStatus;
  author?: string;
  year?: string;
  total?: number;
  current?: number;
  cover?: string;
  link?: string;
  rating?: number;
}

export interface CreateBibliographyInput {
  title: string;
  type: BibliographyType;
  author?: string;
  year?: string;
  total?: number;
  cover?: string;
  link?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Devuelve el valor de una clave simple del frontmatter (sin comentarios YAML). */
export function readFrontmatterValue(
  frontmatter: string[] | undefined,
  key: string
): string | null {
  if (!frontmatter) return null;
  const pattern = new RegExp(`^${escapeRegExp(key)}\\s*:\\s*(.*)$`);
  for (const line of frontmatter) {
    const match = pattern.exec(line.trim());
    if (!match) continue;
    return unquoteYamlValue(match[1].trim());
  }
  return null;
}

function unquoteYamlValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    const inner = value.slice(1, -1);
    if (value.startsWith('"')) {
      try {
        return JSON.parse(value) as string;
      } catch {
        return inner;
      }
    }
    return inner.replace(/''/g, "'");
  }
  const commentIndex = value.search(/\s#/);
  return commentIndex >= 0 ? value.slice(0, commentIndex).trim() : value;
}

/** Serializa un escalar YAML mínimo, citando solo cuando hace falta. */
export function quoteYamlScalar(value: string): string {
  if (value === "") return '""';
  if (/^[A-Za-z0-9À-ÿ _.,/()\-áéíóúüñÁÉÍÓÚÜÑ+]+$/.test(value) && !value.includes("#")) {
    return value;
  }
  return JSON.stringify(value);
}

/**
 * Aplica cambios a las líneas del frontmatter conservando el resto de claves
 * (tags, propiedades de FSRS, etc.). Un valor `null` elimina la clave.
 */
export function setFrontmatterValues(
  frontmatter: string[] | undefined,
  values: Record<string, string | null>
): string[] {
  const result = [...(frontmatter || [])];
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${escapeRegExp(key)}\\s*:`);
    const index = result.findIndex((line) => pattern.test(line.trim()));
    if (value === null) {
      if (index >= 0) result.splice(index, 1);
      continue;
    }
    const line = `${key}: ${quoteYamlScalar(value)}`;
    if (index >= 0) result[index] = line;
    else result.push(line);
  }
  return result;
}

function truthyFlag(value: string | null): boolean {
  if (value === null) return false;
  return !["false", "0", "no", "off", ""].includes(value.trim().toLowerCase());
}

export function isBibliographyPage(page: PageData): boolean {
  if (page.isJournal) return false;
  return truthyFlag(readFrontmatterValue(page.frontmatter, BIBLIOGRAPHY_FLAG_KEY));
}

export function isBibliographyNotePage(page: PageData): boolean {
  return truthyFlag(readFrontmatterValue(page.frontmatter, BIBLIOGRAPHY_NOTE_FLAG_KEY));
}

export function bibliographyNoteParent(page: PageData): string {
  return readFrontmatterValue(page.frontmatter, BIBLIOGRAPHY_PARENT_KEY)?.trim() || "";
}

function normalizeType(value: string | null): BibliographyType {
  const raw = (value || "").trim().toLowerCase();
  if (/(video|vídeo)/.test(raw)) return "video";
  if (/(articulo|artículo|article)/.test(raw)) return "article";
  if (/(web|pagina|página|page)/.test(raw)) return "webpage";
  return "book";
}

function normalizeStatus(value: string | null, current: number, total: number): BibliographyStatus {
  const raw = (value || "").trim().toLowerCase();
  if (/(complet|termin|finaliz|done)/.test(raw)) return "completed";
  if (/(paus|hold|deten)/.test(raw)) return "paused";
  if (total > 0 && current >= total) return "completed";
  if (/(leyendo|reading|en curso|activo)/.test(raw)) return "reading";
  if (/(pendiente|pending|por leer|sin empezar)/.test(raw)) return "pending";
  return current > 0 ? "reading" : "pending";
}

function parseNonNegativeNumber(value: string | null): number {
  if (value === null) return 0;
  const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
}

export function bibliographyItemFromPage(page: PageData): BibliographyItem {
  const current = parseNonNegativeNumber(
    readFrontmatterValue(page.frontmatter, BIBLIOGRAPHY_CURRENT_KEY)
  );
  const total = parseNonNegativeNumber(
    readFrontmatterValue(page.frontmatter, BIBLIOGRAPHY_TOTAL_KEY)
  );
  const rating = Math.min(
    5,
    Math.max(0, Math.round(parseNonNegativeNumber(
      readFrontmatterValue(page.frontmatter, BIBLIOGRAPHY_RATING_KEY)
    )))
  );
  return {
    page,
    type: normalizeType(readFrontmatterValue(page.frontmatter, BIBLIOGRAPHY_TYPE_KEY)),
    status: normalizeStatus(
      readFrontmatterValue(page.frontmatter, BIBLIOGRAPHY_STATUS_KEY),
      current,
      total
    ),
    author: readFrontmatterValue(page.frontmatter, BIBLIOGRAPHY_AUTHOR_KEY)?.trim() || "",
    year: readFrontmatterValue(page.frontmatter, BIBLIOGRAPHY_YEAR_KEY)?.trim() || "",
    total,
    current: total > 0 ? Math.min(current, total) : current,
    cover: readFrontmatterValue(page.frontmatter, BIBLIOGRAPHY_COVER_KEY)?.trim() || "",
    link: readFrontmatterValue(page.frontmatter, BIBLIOGRAPHY_LINK_KEY)?.trim() || "",
    rating,
  };
}

export function bibliographyProgress(item: BibliographyItem): number {
  if (item.total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((item.current / item.total) * 100)));
}

/** Etiqueta de la unidad usada por el progreso según el tipo de recurso. */
export function bibliographyUnitLabel(type: BibliographyType): string {
  return type === "video" ? "Minutos" : "Páginas";
}

export function createBibliographyFrontmatter(input: CreateBibliographyInput): string[] {
  const total = Math.max(0, Math.round(input.total || 0));
  return setFrontmatterValues([], {
    [BIBLIOGRAPHY_FLAG_KEY]: "true",
    [BIBLIOGRAPHY_TYPE_KEY]: input.type,
    [BIBLIOGRAPHY_STATUS_KEY]: total > 0 ? "reading" : "pending",
    [BIBLIOGRAPHY_AUTHOR_KEY]: input.author?.trim() || null,
    [BIBLIOGRAPHY_YEAR_KEY]: input.year?.trim() || null,
    [BIBLIOGRAPHY_TOTAL_KEY]: String(total),
    [BIBLIOGRAPHY_CURRENT_KEY]: "0",
    [BIBLIOGRAPHY_COVER_KEY]: input.cover?.trim() || null,
    [BIBLIOGRAPHY_LINK_KEY]: input.link?.trim() || null,
    [BIBLIOGRAPHY_RATING_KEY]: "0",
  });
}

export function applyBibliographyPatch(
  frontmatter: string[] | undefined,
  patch: BibliographyPatch
): string[] {
  const values: Record<string, string | null> = {};
  if (patch.type !== undefined) values[BIBLIOGRAPHY_TYPE_KEY] = patch.type;
  if (patch.status !== undefined) values[BIBLIOGRAPHY_STATUS_KEY] = patch.status;
  if (patch.author !== undefined) {
    values[BIBLIOGRAPHY_AUTHOR_KEY] = patch.author.trim() || null;
  }
  if (patch.year !== undefined) values[BIBLIOGRAPHY_YEAR_KEY] = patch.year.trim() || null;
  if (patch.total !== undefined) {
    values[BIBLIOGRAPHY_TOTAL_KEY] = String(Math.max(0, Math.round(patch.total)));
  }
  if (patch.current !== undefined) {
    values[BIBLIOGRAPHY_CURRENT_KEY] = String(Math.max(0, Math.round(patch.current)));
  }
  if (patch.cover !== undefined) values[BIBLIOGRAPHY_COVER_KEY] = patch.cover.trim() || null;
  if (patch.link !== undefined) values[BIBLIOGRAPHY_LINK_KEY] = patch.link.trim() || null;
  if (patch.rating !== undefined) {
    values[BIBLIOGRAPHY_RATING_KEY] = String(Math.max(0, Math.min(5, Math.round(patch.rating))));
  }
  return setFrontmatterValues(frontmatter, values);
}

export function createBibliographyNoteFrontmatter(itemTitle: string): string[] {
  return setFrontmatterValues([], {
    [BIBLIOGRAPHY_NOTE_FLAG_KEY]: "true",
    [BIBLIOGRAPHY_PARENT_KEY]: itemTitle,
  });
}

/** Actualiza el recurso padre de una nota hija cuando el recurso se renombra. */
export function setBibliographyNoteParent(
  frontmatter: string[] | undefined,
  itemTitle: string
): string[] {
  return setFrontmatterValues(frontmatter, {
    [BIBLIOGRAPHY_NOTE_FLAG_KEY]: "true",
    [BIBLIOGRAPHY_PARENT_KEY]: itemTitle,
  });
}

function collectBlockText(blocks: readonly BlockNode[]): string[] {
  const texts: string[] = [];
  const walk = (nodes: readonly BlockNode[]): void => {
    for (const node of nodes) {
      if (node.content) texts.push(node.content);
      walk(node.children || []);
    }
  };
  walk(blocks);
  return texts;
}

/**
 * Prepara un título para el cuerpo de un wikilink. Los saltos de línea se
 * convierten en espacios y los corchetes en paréntesis para que el título no
 * pueda cerrar el enlace ni inyectar Markdown en la nota.
 */
export function sanitizeWikilinkTitle(title: string): string {
  const cleaned = title
    .replace(/[\r\n]+/g, " ")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Sin título";
}

/** Construye un wikilink seguro a partir del título de un recurso. */
export function bibliographyWikilink(title: string): string {
  return `[[${sanitizeWikilinkTitle(title)}]]`;
}

export function pageLinksToTitle(page: PageData, title: string): boolean {
  const needles = [...new Set([`[[${title}]]`, bibliographyWikilink(title)])];
  return collectBlockText(page.blocks || []).some((text) =>
    needles.some((needle) => text.includes(needle))
  );
}

/**
 * Notas independientes ligadas a un recurso. Se apoya en el frontmatter y,
 * como respaldo, en el wikilink del cuerpo: así el vínculo sobrevive cuando
 * el recurso se renombra (el renombrado reescribe los `[[enlaces]]`).
 */
export function linkedBibliographyNotes(item: BibliographyItem, pages: PageData[]): PageData[] {
  return pages
    .filter((page) => {
      if (page.id === item.page.id || !isBibliographyNotePage(page)) return false;
      return (
        bibliographyNoteParent(page) === item.page.title ||
        pageLinksToTitle(page, item.page.title)
      );
    })
    .sort((left, right) => (right.updatedAtMs || 0) - (left.updatedAtMs || 0));
}

export function filterBibliographyItems(
  items: readonly BibliographyItem[],
  query: string,
  type: BibliographyType | "all",
  status: BibliographyStatus | "all"
): BibliographyItem[] {
  const tokens = query
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  return items.filter((item) => {
    if (type !== "all" && item.type !== type) return false;
    if (status !== "all" && item.status !== status) return false;
    if (tokens.length === 0) return true;
    const haystack = `${item.page.title}\u0000${item.author}\u0000${item.year}`
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return tokens.every((token) => haystack.includes(token));
  });
}

export function bibliographyPages(pages: PageData[]): PageData[] {
  return pages.filter(isBibliographyPage);
}
