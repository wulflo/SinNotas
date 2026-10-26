import katex from "katex";
import { escapeHtml } from "./html";

/**
 * Renderiza LaTeX con KaTeX. `trust: false` desactiva comandos peligrosos
 * (\href, \url, \includegraphics, etc.) y `throwOnError: false` convierte una
 * fórmula inválida en un mensaje seguro en vez de romper el renderizado.
 */
export function renderMathToHtml(source: string, displayMode: boolean): string {
  try {
    return katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      trust: false,
      strict: "error",
      output: "htmlAndMathml",
      maxSize: 500,
      maxExpand: 1000,
    });
  } catch {
    return `<code class="math-error">${escapeHtml(source)}</code>`;
  }
}
