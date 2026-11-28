// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createRenderedSnippet, highlightSnippetMatch } from "./snippet-highlight";

function element(html: string): HTMLElement {
  const host = document.createElement("span");
  host.innerHTML = html;
  return host;
}

describe("highlightSnippetMatch", () => {
  it("resalta dentro de Markdown ya renderizado sin romper la negrita", () => {
    const host = element("Bienvenido a <strong>SinNotas</strong>: notas Markdown.");
    expect(highlightSnippetMatch(host, "SinNotas")).toBe(true);
    const strong = host.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong?.querySelector("mark")?.textContent).toBe("SinNotas");
  });

  it("encuentra la coincidencia aunque esté partida entre nodos de texto", () => {
    const host = element("<span>Sin</span><em>Notas</em><span> y más</span>");
    expect(highlightSnippetMatch(host, "sinnotas")).toBe(true);
    expect(host.textContent).toBe("SinNotas y más");
    expect(host.querySelectorAll("mark").length).toBeGreaterThan(0);
  });

  it("ignora mayúsculas y acentos al resaltar", () => {
    const host = element("El árbol está aquí");
    expect(highlightSnippetMatch(host, "arbol")).toBe(true);
    expect(host.querySelector("mark")?.textContent).toBe("árbol");
  });

  it("no hace nada si no hay coincidencia", () => {
    const host = element("Texto sin coincidencia");
    expect(highlightSnippetMatch(host, "xyz")).toBe(false);
    expect(host.querySelector("mark")).toBeNull();
  });

  it("recorta después de renderizar: sin Markdown roto al buscar 'shift'", () => {
    const text =
      "**Enter** crea o divide bullets; **Tab** y **Shift+Tab** cambian la indentación.";
    const snippet = createRenderedSnippet(text, "shift");
    expect(snippet.innerHTML).not.toContain("**");
    expect(snippet.querySelector("mark")?.textContent).toBe("Shift");
    expect(snippet.textContent).toContain("bullets;");
    expect(snippet.textContent).toContain("cambian la indentación.");
  });
});
