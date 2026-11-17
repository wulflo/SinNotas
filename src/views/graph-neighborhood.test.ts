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

  it("usa la adyacencia servida por Rust cuando llega (FASE 4-C)", () => {
    // Bloques vacíos: sin la adyacencia no habría aristas; con ella sí.
    const noti = [page("A", ""), page("B", ""), page("C", ""), page("D", "")];
    const links = new Map<string, string[]>([
      ["A", ["B"]],
      ["B", ["C"]],
      ["D", ["C"]],
    ]);
    expect([...connectedPageTitles(noti, "A", 1, links)].sort()).toEqual(["A", "B"]);
    // Profundidad 2: hasta C; D queda a 3 saltos (vecina del vecino, no del origen).
    expect([...connectedPageTitles(noti, "A", 2, links)].sort()).toEqual(["A", "B", "C"]);
    // Los destinos que no corresponden a ninguna nota se siguen descartando.
    const conFantasma = new Map<string, string[]>([["A", ["Fantasma", "B"]]]);
    expect([...connectedPageTitles(noti, "A", 1, conFantasma)]).toEqual(["A", "B"]);
  });
});
