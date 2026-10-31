import katex from "katex";
import { escapeHtml } from "./html";

/**
 * Caché de resultados de KaTeX por fórmula y modo. Repintar el editor (al
 * abrir la nota, tras un Enter, al recuperar el foco…) re-renderiza todos los
 * bloques y cada fórmula pasaba otra vez por katex.renderToString, una de las
 * operaciones más caras del render. Con la caché una misma fórmula solo
 * compila una vez.
 */
const MATH_CACHE_MAX = 300;
const mathCache = new Map<string, string>();

function renderMathUncached(source: string, displayMode: boolean): string {
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

/**
 * Renderiza LaTeX con KaTeX. `trust: false` desactiva comandos peligrosos
 * (\href, \url, \includegraphics, etc.) y `throwOnError: false` convierte una
 * fórmula inválida en un mensaje seguro en vez de romper el renderizado.
 */
export function renderMathToHtml(source: string, displayMode: boolean): string {
  const key = `${displayMode ? "d" : "i"}\u0000${source}`;
  const cached = mathCache.get(key);
  if (cached !== undefined) return cached;

  const rendered = renderMathUncached(source, displayMode);
  // Tope simple: al alcanzar el máximo se vacía la tabla y se vuelve a llenar
  // poco a poco, evitando el coste de una política LRU completa.
  if (mathCache.size >= MATH_CACHE_MAX) mathCache.clear();
  mathCache.set(key, rendered);
  return rendered;
}
