import { fold } from "../store/content-search";
import { renderInlineToSafeHtml } from "../editor/markdown";

/**
 * Ventana del fragmento: poco texto antes y más después para que la
 * coincidencia caiga siempre en las primeras líneas visibles (tope de 4).
 */
const SNIPPET_BEFORE = 16;
const SNIPPET_AFTER = 80;

interface TextAnchor {
  node: Text;
  /** Índice del carácter dentro del nodo de texto. */
  index: number;
  /** Índice del carácter dentro del texto plegado del contenedor. */
  foldedIndex: number;
}

/**
 * Envuelve la primera coincidencia de `needle` en un `<mark>` dentro de `root`.
 *
 * Se resalta *después* de renderizar el Markdown para que un `**` partido por
 * la coincidencia (p. ej. `**SinNotas**` buscando `notas`) no quede como texto
 * literal. El mapeo carácter a carácter sobre el texto plegado permite que la
 * coincidencia siga funcionando con mayúsculas y acentos.
 */
function collectTextAnchors(root: Node): { anchors: TextAnchor[]; foldedText: string } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const anchors: TextAnchor[] = [];
  let foldedText = "";
  let node: Node | null = walker.nextNode();
  while (node) {
    const text = node.nodeValue ?? "";
    for (let i = 0; i < text.length; i++) {
      const foldedChar = fold(text[i]);
      for (let j = 0; j < foldedChar.length; j++) {
        anchors.push({ node: node as Text, index: i, foldedIndex: foldedText.length });
        foldedText += foldedChar[j];
      }
    }
    node = walker.nextNode();
  }
  return { anchors, foldedText };
}

export function highlightSnippetMatch(root: HTMLElement, needle: string): boolean {
  if (!needle) return false;

  const { anchors, foldedText } = collectTextAnchors(root);
  const foldedNeedle = fold(needle);
  if (!foldedNeedle) return false;
  const at = foldedText.indexOf(foldedNeedle);
  if (at < 0) return false;
  const start = anchors[at];
  const end = anchors[at + foldedNeedle.length - 1];
  if (!start || !end) return false;

  const range = document.createRange();
  range.setStart(start.node, start.index);
  range.setEnd(end.node, end.index + 1);
  const mark = document.createElement("mark");
  mark.appendChild(range.extractContents());
  range.insertNode(mark);
  return true;
}

/**
 * Crea el fragmento del omnibar a partir del bloque COMPLETO ya renderizado.
 *
 * Recortar el Markdown antes de renderizar deja pares `**` sin cerrar (p. ej.
 * buscar «shift» en `**Enter** … **Tab** y **Shift+Tab** …` producía negritas
 * cruzadas y un `**` suelto). Aquí se renderiza primero y se recorta después
 * con un Range sobre los nodos de texto, así que el HTML siempre es válido.
 */
export function createRenderedSnippet(text: string, query: string): HTMLElement {
  const excerpt = document.createElement("span");
  excerpt.className = "search-dropdown-snippet";

  const host = document.createElement("span");
  host.innerHTML = renderInlineToSafeHtml(text);
  const { anchors, foldedText } = collectTextAnchors(host);
  const at = foldedText.indexOf(fold(query));
  if (at < 0) {
    excerpt.textContent = text.slice(0, SNIPPET_BEFORE + SNIPPET_AFTER);
    return excerpt;
  }

  const from = Math.max(0, at - SNIPPET_BEFORE);
  const to = Math.min(foldedText.length, at + fold(query).length + SNIPPET_AFTER);
  const start = anchors[from];
  const end = anchors[to - 1];

  if (from > 0) excerpt.appendChild(document.createTextNode("…"));
  if (start && end) {
    const range = document.createRange();
    range.setStart(start.node, start.index);
    range.setEnd(end.node, end.index + 1);
    excerpt.appendChild(range.extractContents());
  }
  if (to < foldedText.length) excerpt.appendChild(document.createTextNode("…"));

  highlightSnippetMatch(excerpt, query);
  return excerpt;
}
