/**
 * Sanitización del pegado rico: HTML del portapapeles → Markdown plano.
 *
 * El portapapeles es dato no confiable. Reglas:
 * 1. Whitelist de formato: negrita (**), cursiva (*), subrayado (<u>),
 *    tachado (~~), código inline (`) y listas con indentación (dos espacios
 *    por nivel). Todo lo demás se pierde a propósito.
 * 2. Los atributos pegados se ignoran por completo: no hay `style`, colores,
 *    tamaños de fuente, `href`, `src` ni atributos de evento. Así nunca se
 *    heredan estilos del app de origen (p. ej. un título de YouTube con su
 *    tamaño y sus líneas vacías) ni se rompen los temas claro/oscuro.
 * 3. La salida es texto Markdown: nunca se inyecta HTML del portapapeles
 *    directamente al DOM; después del renderizado el propio pipeline aplica
 *    `sanitizeHtml` sobre este Markdown.
 * 4. Límites: el HTML de entrada se cap en `MAX_PASTED_HTML_LENGTH` (se
 *    devuelve "" y el llamador usa `text/plain`) y el resultado en
 *    `MAX_PASTED_MARKDOWN_LENGTH` (recorte con aviso del llamador).
 * 5. Limpieza de líneas: espaciados excesivos (3+ vacías) se colapsan a una
 *    sola línea separadora y se recortan vacías en los extremos.
 *
 * La estructura se recibe como interfaz mínima (`MinimalDomNode`) para que
 * este módulo sea puro y testeable sin DOM (vitest corre en node).
 */

export const MAX_PASTED_HTML_LENGTH = 300_000;
export const MAX_PASTED_MARKDOWN_LENGTH = 50_000;

export interface MinimalDomNode {
  /** 1 = elemento, 3 = texto (constantes de Node). */
  nodeType: number;
  /** Nombre de etiqueta en MAYÚSCULAS, o "#text" para nodos de texto. */
  nodeName: string;
  textContent: string | null;
  childNodes: readonly MinimalDomNode[];
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/**
 * Etiquetas descartadas: peligrosas (script, iframe, form…), no deseadas
 * (media, head, meta) o con flujo propio aparte (img/picture se manejan por
 * el código de imágenes del portapapeles, auditado por fases).
 */
const DROP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "TITLE", "META", "LINK", "BASE",
  "IFRAME", "OBJECT", "EMBED", "SVG", "CANVAS", "FRAME", "FRAMESET",
  "VIDEO", "AUDIO", "SOURCE", "TRACK",
  "IMG", "PICTURE",
  "FORM", "INPUT", "BUTTON", "SELECT", "TEXTAREA", "OPTION", "DATALIST", "LABEL",
]);

/** Etiquetas de bloque: sus hijos van en líneas separadas. */
const BLOCK_TAGS = new Set([
  "P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6",
  "BLOCKQUOTE", "FIGURE", "FIGCAPTION", "ADDRESS", "CENTER",
  "SECTION", "ARTICLE", "ASIDE", "HEADER", "FOOTER", "NAV", "MAIN",
  "DL", "DT", "DD", "PRE",
]);

const INLINE_WRAPS: Record<string, (source: string) => string> = {
  B: (source) => `**${source}**`,
  STRONG: (source) => `**${source}**`,
  I: (source) => `*${source}*`,
  EM: (source) => `*${source}*`,
  U: (source) => `<u>${source}</u>`,
  S: (source) => `~~${source}~~`,
  DEL: (source) => `~~${source}~~`,
  STRIKE: (source) => `~~${source}~~`,
  CODE: (source) => `\`${source}\``,
};

interface MinimalDomElement extends MinimalDomNode {
  nodeType: 1;
}

function isElement(node: MinimalDomNode, tagName: string): boolean {
  return node.nodeType === ELEMENT_NODE && node.nodeName === tagName;
}

/** Normaliza texto crudo: CRLF → LF, tab y espacios dobles → uno. */
function collapsePlainText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ");
}

/**
 * Une los hijos de un elemento recorriéndolos inline. Los saltos de bloque
 * internos (un `<div>` dentro de un `<span>`, por ejemplo) se convierten en
 * `\n` literal para no perder separación.
 */
function childrenToInline(nodes: readonly MinimalDomNode[]): string {
  let result = "";
  for (const child of nodes) {
    result += nodeToInline(child);
  }
  return result;
}

function nodeToInline(node: MinimalDomNode): string {
  if (node.nodeType === TEXT_NODE) return collapsePlainText(node.textContent ?? "");
  if (node.nodeType !== ELEMENT_NODE) return "";
  if (DROP_TAGS.has(node.nodeName)) return "";
  if (node.nodeName === "BR") return "\n";

  const wrap = INLINE_WRAPS[node.nodeName];
  if (wrap) {
    const inner = childrenToInline(node.childNodes).trim();
    return inner ? wrap(inner) : "";
  }

  // Etiqueta transparente (span, font, a, abbr…): solo sus hijos, sin atributos.
  if (!BLOCK_TAGS.has(node.nodeName) && node.nodeName !== "BODY") {
    return childrenToInline(node.childNodes);
  }

  // Bloque dentro de contexto inline: una separación por línea vacía.
  const blockLines = elementToLines(node as MinimalDomElement, 0);
  return blockLines.length ? `\n${blockLines.join("\n")}\n` : "";
}

/** Etiqueta de lista con prefijo e indentación de Markdown. */
function listTagToLines(indentDepth: number): string {
  return `${"  ".repeat(indentDepth)}- `;
}

function elementToLines(element: MinimalDomElement, depth: number): string[] {
  const tag = element.nodeName;
  if (tag === "BODY") {
    return mergeLinesBetween(element.childNodes ?? [], depth);
  }
  if (DROP_TAGS.has(tag)) return [];
  if (tag === "BR") return [""];

  const children = element.childNodes ?? [];
  const inlineResult = INLINE_WRAPS[tag];
  if (inlineResult) {
    const inlineContent = childrenToInline(children).trim();
    return inlineContent ? [inlineResult(inlineContent)] : [];
  }

  // Listas: cada <li> es "  - texto", anidadas con sangría incremental.
  if (tag === "UL" || tag === "OL") {
    const lines: string[] = [];
    for (const child of children) {
      if (!isElement(child, "LI")) continue;
      const itemInline: MinimalDomNode[] = [];
      const nestedLists: MinimalDomNode[] = [];
      for (const itemChild of child.childNodes ?? []) {
        if (isElement(itemChild, "UL") || isElement(itemChild, "OL")) {
          nestedLists.push(itemChild);
        } else {
          itemInline.push(itemChild);
        }
      }
      const itemText = childrenToInline(itemInline).trim();
      const prefix = listTagToLines(depth).trimEnd();
      if (itemText) lines.push(`${prefix} ${itemText}`);
      for (const nested of nestedLists) {
        lines.push(...elementToLines(nested as MinimalDomElement, depth + 1));
      }
    }
    return lines;
  }

  // Tablas del portapapeles: filas como líneas de pipes simples.
  if (tag === "TABLE") {
    const lines: string[] = [];
    for (const row of children.flatMap((part) =>
      part.nodeType === ELEMENT_NODE
        ? (part.nodeName === "TR"
          ? [part as MinimalDomElement]
          : Array.from(part.childNodes ?? []).filter((cell) => isElement(cell, "TR")))
        : []
    )) {
      const cells = (row as MinimalDomElement).childNodes
        .filter((cell) => cell.nodeType === ELEMENT_NODE)
        .map((cell) => childrenToInline(cell.childNodes).replace(/\|/g, "\\|").trim() || " ");
      if (cells.length) lines.push(`| ${cells.join(" | ")} |`);
    }
    return lines;
  }

  // Bloques con estructura propia de línea.
  if (tag === "BLOCKQUOTE") {
    return childrenToLines(children, depth).map((line) => (line.trim() ? `> ${line.trim()}` : ""));
  }
  if (tag === "LI") {
    return [`${listTagToLines(depth)}${childrenToInline(children).trim()}`];
  }
  if (tag === "TR") {
    const cells = children
      .filter((cell) => cell.nodeType === ELEMENT_NODE)
      .map((cell) => childrenToInline(cell.childNodes).replace(/\|/g, "\\|").trim() || " ");
    return cells.length ? [`| ${cells.join(" | ")} |`] : [];
  }

  // P, DIV, H1-6, SECTION…: cada hijo en su línea si es un bloque.
  return childrenToLines(children, depth);
}

function childrenToLines(children: readonly MinimalDomNode[], depth: number): string[] {
  return mergeLinesBetween(children, depth);
}

/** Puntos clave: para cada hijo inline concateno, para cada bloque salto línea. */
function mergeLinesBetween(nodes: readonly MinimalDomNode[], depth: number): string[] {
  const lines: string[] = [];
  let pendingInline = "";

  const flush = (): void => {
    const trimmed = pendingInline.trim();
    if (trimmed) lines.push(trimmed);
    pendingInline = "";
  };

  for (const node of nodes) {
    const isBlockish = node.nodeType === ELEMENT_NODE &&
      (BLOCK_TAGS.has(node.nodeName) || node.nodeName === "UL" || node.nodeName === "OL" ||
       node.nodeName === "TABLE" || node.nodeName === "P" || node.nodeName === "DIV" ||
       node.nodeName === "H1" || node.nodeName === "H2" || node.nodeName === "H3" ||
       node.nodeName === "H4" || node.nodeName === "H5" || node.nodeName === "H6" ||
       node.nodeName === "BLOCKQUOTE" || node.nodeName === "PRE" ||
       node.nodeName === "LI" || node.nodeName === "TR" || node.nodeName === "BODY");
    if (!isBlockish) {
      pendingInline += nodeToInline(node);
      continue;
    }
    flush();
    lines.push(...elementToLines(node as MinimalDomElement, depth));
    lines.push("");
  }
  flush();
  // Separadores finales tras el último bloque: se eliminan.
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Ensambla el resultado final: compacta líneas y aplica el límite de tamaño. */
function finalize(lines: string[]): string {
  const joined = lines.join("\n");
  const compacted = joined
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
  if (compacted.length > MAX_PASTED_MARKDOWN_LENGTH) {
    return compacted.slice(0, MAX_PASTED_MARKDOWN_LENGTH);
  }
  return compacted;
}

/**
 * Punto de entrada puro: recibe el nodo raíz (`BODY` de `DOMParser` en el
 * llamador) y devuelve Markdown plano sanitizado.
 */
export function sanitizeDomNodeTree(root: MinimalDomNode): string {
  return finalize(elementToLines(root as MinimalDomElement, 0));
}

/**
 * Punto de entrada del navegador: dado el string `text/html` del portapapeles,
 * devuelve Markdown plano sanitizado o "" si el HTML es inválido o demasiado
 * grande. El llamador recurre a `text/plain` cuando el resultado es "".
 */
export function sanitizePastedHtmlToMarkdown(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  if (!html) return "";
  if (html.length > MAX_PASTED_HTML_LENGTH) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc?.body) return "";
  // El cuerpo real es un HTMLElement del DOM; por diseño este módulo solo
  // accede a nodeType/nodeName/textContent/childNodes de la interfaz mínima.
  return sanitizeDomNodeTree(doc.body as unknown as MinimalDomNode);
}
