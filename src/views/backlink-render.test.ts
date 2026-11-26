// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { renderBacklinkSnippetHtml, wireBacklinkWikilinks } from "./backlink-render";

describe("renderBacklinkSnippetHtml", () => {
  it("renderiza el wikilink como texto sin corchetes y con su destino", () => {
    const html = renderBacklinkSnippetHtml("Usa [[Rust Core|el motor]] para persistir.");
    expect(html).toContain('data-page="Rust Core"');
    expect(html).toContain("el motor");
    expect(html).not.toContain("[[");
  });

  it("sanea HTML hostil aunque el snippet pida destinos de wikilink", () => {
    const html = renderBacklinkSnippetHtml('<img src="x" onerror="alert(1)"> [[Rust Core]]');
    expect(html).not.toContain("onerror");
    expect(html).toContain('data-page="Rust Core"');
  });
});

describe("wireBacklinkWikilinks", () => {
  it("abre el destino al pulsar el wikilink y no propaga al contenedor", () => {
    const root = document.createElement("div");
    root.innerHTML = renderBacklinkSnippetHtml("Ver [[Rust Core]].");
    const onNavigate = vi.fn();
    const card = document.createElement("div");
    card.appendChild(root);
    const onCardClick = vi.fn();
    card.addEventListener("click", onCardClick);
    wireBacklinkWikilinks(root, onNavigate);

    root.querySelector<HTMLElement>(".markdown-wikilink")!.click();

    expect(onNavigate).toHaveBeenCalledWith("Rust Core");
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
