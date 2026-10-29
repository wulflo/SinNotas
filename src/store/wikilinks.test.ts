import { describe, expect, it } from "vitest";
import type { BlockNode, PageData } from "../types";
import { collectOutgoingLinks } from "./wikilinks";

function text(id: string, content: string, children: BlockNode[] = []): BlockNode {
  return { id, type: "text", content, children };
}

function page(blocks: BlockNode[]): PageData {
  return { id: "p1", title: "Origen", path: "notes/Origen.md", blocks };
}

describe("collectOutgoingLinks", () => {
  it("resuelve alias y conserva el bloque de origen", () => {
    const links = collectOutgoingLinks(page([text("b1", "Ir a [[Destino|allí]]")]));
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      targetTitle: "Destino",
      alias: "allí",
      blockId: "b1",
      lineNumber: 1,
    });
  });

  it("recorre hijos, deduplica destinos y omite la propia nota", () => {
    const links = collectOutgoingLinks(
      page([
        text("b1", "[[A]] y [[A|otra vez]] y [[Origen]]", [
          text("b2", "[[B]] y [[A]]"),
        ]),
      ])
    );
    expect(links.map((link) => link.targetTitle)).toEqual(["A", "B"]);
    expect(links[1].lineNumber).toBe(2);
  });

  it("ignora wikilinks dentro de código", () => {
    const links = collectOutgoingLinks(
      page([text("b1", "`[[Falso]]`\n```\n[[TambienFalso]]\n```\n[[Real]]")])
    );
    expect(links.map((link) => link.targetTitle)).toEqual(["Real"]);
  });

  it("conserva destinos inexistentes para que la UI los marque como rotos", () => {
    const links = collectOutgoingLinks(page([text("b1", "[[No existe]]")]));
    expect(links[0].targetTitle).toBe("No existe");
  });
});
