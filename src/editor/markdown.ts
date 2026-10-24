import DOMPurify from "dompurify";
import { escapeHtml } from "./html";
import { renderMathToHtml } from "./math";
import {
  findMarkdownTableRanges,
  type MarkdownTableModel,
  type TableAlignment,
} from "./markdown-table";

export interface MarkdownRenderOptions {
  cloze?: "gap" | "reveal";
}

const MARKDOWN_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "del",
    "s",
    "mark",
    "code",
    "pre",
    "span",
    "div",
    "a",
    "img",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "hr",
    "annotation",
    "semantics",
    "math",
    "mrow",
    "mi",
    "mo",
    "mn",
    "msup",
    "msub",
    "mfrac",
    "msqrt",
    "mroot",
    "mtable",
    "mtr",
    "mtd",
    "mtext",
  ],
  ALLOWED_ATTR: [
    "class",
    "href",
    "title",
    "alt",
    "src",
    "data-language",
    "data-math-source",
    "data-code-source",
    "xmlns",
    "encoding",
    "mathvariant",
    "stretchy",
    "fence",
    "separator",
    "lspace",
    "rspace",
  ],
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "link", "meta", "svg", "foreignobject", "path", "use"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
  ALLOW_DATA_ATTR: true,
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

const systemPropertyPattern =
  /^(?:card-[a-z-]+|last-reviewed|interval-days|ease-factor|due-date|created-at|image-occlusions|task-due|completion-rewarded|doing-started-at|done-at|doing-duration-seconds|heading|color|background-color)::/i;

export function stripTaskStatus(text: string): string {
  return text.replace(/^(?:TODO|LATER|DOING|NOW|DONE)\s+/i, "");
}

export function stripCardTag(text: string): string {
  return text.replace(/#card\b/gi, "");
}

/** Indica si una línea es una propiedad de sistema (por ejemplo `card-s:: 2.5`). */
export function isSystemPropertyLine(line: string): boolean {
  return systemPropertyPattern.test(line.trim());
}

export function stripSystemProperties(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !systemPropertyPattern.test(line.trim()))
    .join("\n");
}

function renderInline(text: string, options: MarkdownRenderOptions): string {
  // Dividir en patrones separados para evitar backtracking catastrófico en el regex único gigante.
  // Cada patrón es simple y no tiene cuantificadores anidados problemáticos.
  // Límites para evitar ReDoS: max 500 chars por elemento inline
  const MAX_INLINE_CAPTURE = 500;

  // Usar concatenación de strings para evitar problemas con backticks en template literals
  const M = MAX_INLINE_CAPTURE;
  const patterns = [
    // Código inline: `...` (max 500 chars)
    { regex: new RegExp("`([^`\n]{1," + M + "})`", "g"), type: "code" },
    // Wikilink: [[target|label]] o [[target]] (max 500 chars cada parte)
    { regex: new RegExp("\\[\\[([^\\]\\n]{1," + M + "})(?:\\|([^\\]\\n]{1," + M + "}))?\\]\\]", "g"), type: "wikilink" },
    // Cloze Anki: {{c1::...}} o {{cloze ...}} o {{...}} (max 500 chars contenido)
    { regex: new RegExp("\\{\\{(?:c\\d+::|cloze\\s+)?([^}\\n]{1," + M + "})\\}\\}", "g"), type: "cloze" },
    // Negrita: **...** o __...__ (max 500 chars)
    { regex: new RegExp("\\*\\*([^*\n]{1," + M + "})\\*\\*|__([^_\n]{1," + M + "})__", "g"), type: "bold" },
    // Cursiva: *...* o _..._ (max 500 chars)
    { regex: new RegExp("\\*([^*\n]{1," + M + "})\\*|_([^_\n]{1," + M + "})_", "g"), type: "italic" },
    // Tachado: ~~...~~ (max 500 chars)
    { regex: new RegExp("~~([^~\n]{1," + M + "})~~", "g"), type: "strike" },
    // Resaltado: ==...== (max 500 chars)
    { regex: new RegExp("==([^=\n]{1," + M + "})==", "g"), type: "highlight" },
    // Subrayado HTML: <u>...</u> (max 500 chars)
    { regex: new RegExp("<u>([^<\n]{1," + M + "})<\\/u>", "g"), type: "underline" },
    // Matemática inline: $...$ (no precedido por \ o $, no seguido por $) - max 500 chars
    // El límite {1,500} ya previene ReDoS acotando el backtracking
    { regex: /(?<![\\$])\$(?!\$)([^$\n]{1,500}?)\$(?!\$)/g, type: "math" },
  ];

  // Encontrar todas las coincidencias de todos los patrones, ordenadas por posición
  interface Match {
    index: number;
    length: number;
    type: string;
    groups: string[];
  }
  const allMatches: Match[] = [];

  for (const { regex, type } of patterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        type,
        groups: match.slice(1),
      });
      if (match[0].length === 0) break;
    }
  }

  // Ordenar por índice de aparición
  allMatches.sort((a, b) => a.index - b.index);

  // Procesar coincidencias en orden, saltando las que se solapan
  let html = "";
  let currentPos = 0;
  for (const match of allMatches) {
    if (match.index < currentPos) continue; // Solapada con coincidencia anterior

    // Texto plano antes de esta coincidencia
    if (match.index > currentPos) {
      html += escapeHtml(text.slice(currentPos, match.index));
    }

    const [g1, g2] = match.groups;

    switch (match.type) {
      case "code":
        html += `<code class="code-inline">${escapeHtml(g1!)}</code>`;
        break;
      case "wikilink": {
        const label = (g2 || g1!).trim();
        html += `<span class="markdown-wikilink">${escapeHtml(label)}</span>`;
        break;
      }
      case "cloze": {
        if (options.cloze === "gap") {
          html += '<span class="cloze-gap">[ ... ]</span>';
        } else if (options.cloze === "reveal") {
          html += `<mark class="cloze-revealed">${renderInline(g1!, {})}</mark>`;
        } else {
          html += renderInline(g1!, options);
        }
        break;
      }
      case "bold":
        html += `<strong>${renderInline(g1 || g2!, options)}</strong>`;
        break;
      case "italic":
        html += `<em>${renderInline(g1 || g2!, options)}</em>`;
        break;
      case "strike":
        html += `<del>${renderInline(g1!, options)}</del>`;
        break;
      case "highlight": {
        if (options.cloze === "gap") {
          html += '<span class="cloze-gap">[ ... ]</span>';
        } else if (options.cloze === "reveal") {
          html += `<mark class="cloze-revealed">${renderInline(g1!, {})}</mark>`;
        } else {
          html += `<mark>${renderInline(g1!, options)}</mark>`;
        }
        break;
      }
      case "underline":
        html += `<u>${renderInline(g1!, options)}</u>`;
        break;
      case "math":
        html += `<span class="math-inline">${renderMathToHtml(g1!, false)}</span>`;
        break;
    }

    currentPos = match.index + match.length;
  }

  // Texto restante
  if (currentPos < text.length) {
    html += escapeHtml(text.slice(currentPos));
  }
  return html;
}

function alignmentClass(alignment: TableAlignment): string {
  return alignment ? ` class="markdown-align-${alignment}"` : "";
}

function renderTableHtml(model: MarkdownTableModel, options: MarkdownRenderOptions): string {
  const header = model.header
    .map(
      (cell, index) =>
        `<th${alignmentClass(model.alignments[index] ?? null)}>${renderInline(cell, options)}</th>`
    )
    .join("");
  const body = model.rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell, index) =>
              `<td${alignmentClass(model.alignments[index] ?? null)}>${renderInline(cell, options)}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  return `<table class="markdown-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Bloques de código cercados, matemáticas en bloque (`$$...$$`) y tablas. */
function renderBlockContent(text: string, options: MarkdownRenderOptions): string {
  // Límite para bloques (código y math display): 50,000 chars
  const MAX_BLOCK_CONTENT = 50_000;

  let html = "";

  // PASO 1: Procesar bloques de código cercados (``` o ~~~) - no tienen problema ReDoS
  // Patrón: ```lang\ncode\n``` o ~~~\ncode\n~~~
  const fencePattern = new RegExp(
    "(```+|~~~+)([^\\n]*)\\n([\\s\\S]{0," + MAX_BLOCK_CONTENT + "}?)\\n\\1",
    "g"
  );
  let match: RegExpExecArray | null;
  const fenceMatches: Array<{index: number; length: number; html: string}> = [];

  while ((match = fencePattern.exec(text)) !== null) {
    const code = match[3];
    const language = (match[2] || "").trim();
    const rendered = `<pre class="code-block"${language ? ` data-language="${escapeHtml(language)}"` : ""}><code>${escapeHtml(code)}</code></pre>`;
    fenceMatches.push({ index: match.index, length: match[0].length, html: rendered });
  }

  // PASO 2: Procesar matemáticas en bloque ($$...$$) - con patrón más restrictivo
  // Requiere que $$ de apertura esté al inicio de línea o después de \n
  // y $$ de cierre esté al final de línea o antes de \n
  const mathPattern = new RegExp(
    "(^|\\n)\\$\\$([\\s\\S]{1," + MAX_BLOCK_CONTENT + "}?)\\$\\$(?=\\n|$)",
    "g"
  );
  const mathMatches: Array<{index: number; length: number; html: string}> = [];

  while ((match = mathPattern.exec(text)) !== null) {
    const displayMath = match[2];
    const rendered = `<div class="math-display">${renderMathToHtml(displayMath.trim(), true)}</div>`;
    // match.index apunta al inicio del match completo (incluye \n inicial si existe)
    // El contenido real empieza después del \n inicial
    const contentStart = match.index + (match[0].startsWith("\n") ? 1 : 0);
    mathMatches.push({ index: contentStart, length: match[0].length - (match[0].startsWith("\n") ? 1 : 0), html: rendered });
  }

  // PASO 3: tablas Markdown (GFM). Se renderizan como HTML semántico para que
  // también se vean bien en las flashcards y en cualquier vista que use
  // `renderMarkdownToHtml`.
  const tableMatches = findMarkdownTableRanges(text).map((range) => ({
    index: range.index,
    length: range.length,
    html: renderTableHtml(range.model, options),
  }));

  // Combinar y ordenar todas las coincidencias por posición
  const allMatches = [...fenceMatches, ...mathMatches, ...tableMatches].sort(
    (a, b) => a.index - b.index
  );

  // Renderizar en orden, saltando coincidencias que se solapan
  let currentPos = 0;
  for (const m of allMatches) {
    if (m.index < currentPos) continue; // Solapada
    if (m.index > currentPos) {
      html += renderInline(text.slice(currentPos, m.index), options);
    }
    html += m.html;
    currentPos = m.index + m.length;
  }

  // Texto restante
  if (currentPos < text.length) {
    html += renderInline(text.slice(currentPos), options);
  }
  return html;
}

/**
 * Sanitiza cualquier HTML que vaya a inyectarse con `innerHTML`.
 *
 * `renderMarkdownToHtml` ya escapa el Markdown y aplica DOMPurify, pero esta
 * función se exporta para blindar también HTML ya renderizado (por ejemplo,
 * tarjetas guardadas en memoria o HTML de una versión anterior) antes de
 * insertarlo en el DOM.
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, MARKDOWN_SANITIZE_CONFIG);
}

export function renderMarkdownToHtml(
  text: string,
  options: MarkdownRenderOptions = {}
): string {
  const rendered = renderBlockContent(text.replace(/\r\n?/g, "\n"), options);
  return sanitizeHtml(rendered);
}
