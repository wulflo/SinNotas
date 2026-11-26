import { renderMarkdownToHtml } from "../editor/markdown";

/**
 * Renderiza un snippet del panel de referencias con la misma ruta que el
 * editor (KaTeX, negrita, resaltado, wikilinks sin corchetes...). La única
 * diferencia es que los wikilinks llevan `data-page` para poder navegar.
 */
export function renderBacklinkSnippetHtml(snippet: string): string {
  return renderMarkdownToHtml(snippet, { wikilinkTarget: true });
}

/** Conecta los wikilinks renderizados con la acción de abrir la nota destino. */
export function wireBacklinkWikilinks(
  root: ParentNode,
  onNavigate: (title: string) => void
): void {
  root.querySelectorAll<HTMLElement>(".markdown-wikilink[data-page]").forEach((pill) => {
    pill.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = pill.dataset.page;
      if (target) onNavigate(target);
    });
  });
}
