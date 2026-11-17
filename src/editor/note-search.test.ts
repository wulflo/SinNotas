import { describe, expect, it } from "vitest";
import type { BlockNode } from "../types";
import { findFoldedRanges, findMatchesInBlocks } from "./note-search";

function text(id: string, content: string, children: BlockNode[] = []): BlockNode {
  return { id, type: "text", content, children };
}

describe("note-search - rangos plegados", () => {
  it("encuentra mayúsculas y acentos conservando los offsets originales", () => {
    const textValue = "La Página tiene una página más";
    const ranges = findFoldedRanges(textValue, "pagina");
    expect(ranges).toHaveLength(2);
    expect(textValue.slice(ranges[0].start, ranges[0].end)).toBe("Página");
    expect(textValue.slice(ranges[1].start, ranges[1].end)).toBe("página");
  });

  it("devuelve todas las apariciones de una consulta vacía como ninguna", () => {
    expect(findFoldedRanges("texto", "  ")).toEqual([]);
  });
});

describe("note-search - coincidencias por bloque", () => {
  it("recorre hijos en orden y conserva el bloque de cada coincidencia", () => {
    const blocks = [
      text("b1", "Hola mundo", [text("b2", "otro mundo")]),
      text("b3", "sin coincidencia"),
    ];
    const matches = findMatchesInBlocks(blocks, "MUNDO");
    expect(matches.map((match) => match.blockId)).toEqual(["b1", "b2"]);
  });

  it("ignora propiedades y no busca dentro de imágenes", () => {
    const blocks: BlockNode[] = [
      text("b1", "Texto visible\npriority:: buscar"),
      { id: "img", type: "image", content: "buscar.png", children: [] },
    ];
    const matches = findMatchesInBlocks(blocks, "buscar");
    expect(matches).toEqual([]);
  });

  it("encuentra en bullets colapsados para poder expandirlos al navegar", () => {
    const parent = text("parent", "Padre", [text("child", "aguja escondida")]);
    parent.collapsed = true;
    expect(findMatchesInBlocks([parent], "aguja")).toEqual([
      { blockId: "child", start: 0, end: 5 },
    ]);
  });
});
