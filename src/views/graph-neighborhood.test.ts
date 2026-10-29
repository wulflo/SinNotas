import { describe, expect, it } from "vitest";
import type { BlockNode, PageData } from "../types";
import { connectedPageTitles } from "./graph-neighborhood";

function block(id: string, content: string): BlockNode {
  return { id, type: "text", content, children: [] };
}

function page(title: string, content: string): PageData {
  return {
    id: `p-${title}`,
    title,
    path: `notes/${title}.md`,
    blocks: [block(`b-${title}`, content)],
  };
}

describe("connectedPageTitles", () => {
  const pages = [
    page("A", "[[B]] y [[C|alias]]"),
    page("B", "[[C]]"),
    page("C", ""),
    page("D", "[[C]]"),
  ];

  it("incluye salientes y entrantes de un salto", () => {
    const titles = connectedPageTitles(pages, "B");
    expect([...titles].sort()).toEqual(["A", "B", "C"]);
  });

  it("el origen siempre está presente aunque no tenga enlaces", () => {
    expect([...connectedPageTitles(pages, "D")].sort()).toEqual(["C", "D"]);
    expect([...connectedPageTitles([page("Sola", "")], "Sola")]).toEqual(["Sola"]);
  });

  it("amplía la vecindad con depth 2 y deduplica", () => {
    expect([...connectedPageTitles(pages, "A", 2)].sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("ignora enlaces a notas inexistentes", () => {
    const titles = connectedPageTitles([page("A", "[[Fantasma]]")], "A");
    expect([...titles]).toEqual(["A"]);
  });
});
