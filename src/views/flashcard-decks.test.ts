import { describe, expect, it } from "vitest";
import { DECK_SEPARATOR } from "../deck-title";
import {
  buildDeckTree,
  collectDeckPageTitles,
  compareDeckNodesByName,
  flattenDeckRows,
  getDeckSelectionState,
  searchDeckTree,
  sortDeckTree,
  visibleDeckRoots,
} from "./flashcard-decks";

const counts: Record<string, number> = {
  "Salud mental": 2,
  "Salud mental::01": 3,
  "Salud mental::01::Tema": 1,
  "Salud mental::02": 4,
  Otra: 5,
};

function cardCount(title: string): number {
  return counts[title] ?? 0;
}

function buildTree() {
  return buildDeckTree(Object.keys(counts), { cardCount });
}

describe("buildDeckTree", () => {
  it("agrupa títulos antiguos con :: y calcula totales", () => {
    const tree = buildTree();
    const salud = tree.nodes.get(["Salud mental"].join("\u0000"));

    expect(tree.roots.map((node) => node.name)).toEqual(["Otra", "Salud mental"]);
    expect(salud?.cardCount).toBe(2);
    expect(salud?.totalCardCount).toBe(10);
    expect(salud?.totalPageCount).toBe(4);
    expect(salud?.children.map((node) => node.name)).toEqual(["01", "02"]);
    expect(salud?.children[0].children[0].name).toBe("Tema");
    expect(collectDeckPageTitles(salud!).sort()).toEqual(
      ["Salud mental", "Salud mental::01", "Salud mental::01::Tema", "Salud mental::02"].sort()
    );
  });

  it("trata un título sin separador como un único mazo", () => {
    const tree = buildDeckTree(["Una nota"], { cardCount: () => 3 });
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].name).toBe("Una nota");
    expect(tree.roots[0].totalCardCount).toBe(3);
    expect(tree.roots[0].children).toHaveLength(0);
  });

  it("agrupa alias distintos en el mismo nodo", () => {
    const tree = buildDeckTree(["A::B", `A${DECK_SEPARATOR}B`], { cardCount: () => 1 });
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].name).toBe("A");
    expect(tree.roots[0].children).toHaveLength(1);
    expect(tree.roots[0].children[0].pageTitles).toHaveLength(2);
    expect(tree.roots[0].totalCardCount).toBe(2);
  });
});

describe("getDeckSelectionState", () => {
  it("distingue marcado, desmarcado y parcial", () => {
    const tree = buildTree();
    const salud = tree.nodes.get(["Salud mental"].join("\u0000"))!;

    expect(getDeckSelectionState(salud, () => false)).toBe("unchecked");
    expect(getDeckSelectionState(salud, () => true)).toBe("checked");
    expect(
      getDeckSelectionState(salud, (title) => title === "Salud mental::02")
    ).toBe("indeterminate");
  });
});

describe("searchDeckTree", () => {
  it("conserva ancestros y fuerza su expansión al encontrar una nota inferior", () => {
    const tree = buildTree();
    const result = searchDeckTree(tree, "tema");

    expect(result.visible.has(tree.nodes.get("Salud mental")!.id)).toBe(true);
    expect(result.visible.has(tree.nodes.get(["Salud mental", "01"].join("\u0000"))!.id)).toBe(
      true
    );
    expect(result.matched.has(tree.nodes.get(["Salud mental", "01", "Tema"].join("\u0000"))!.id)).toBe(
      true
    );
    expect(
      result.forceExpanded.has(tree.nodes.get(["Salud mental", "01"].join("\u0000"))!.id)
    ).toBe(true);
    expect(result.visible.has(tree.nodes.get("Otra")!.id)).toBe(false);
  });

  it("si coincide un mazo conserva todo su subárbol", () => {
    const tree = buildTree();
    const result = searchDeckTree(tree, "salud");

    expect(result.visible.has(tree.nodes.get("Salud mental")!.id)).toBe(true);
    expect(result.visible.has(tree.nodes.get(["Salud mental", "02"].join("\u0000"))!.id)).toBe(
      true
    );
    expect(result.forceExpanded.has(tree.nodes.get("Salud mental")!.id)).toBe(true);
    expect(result.visible.has(tree.nodes.get("Otra")!.id)).toBe(false);
  });

  it("sin búsqueda todos los nodos están visibles", () => {
    const tree = buildTree();
    const result = searchDeckTree(tree, "   ");
    expect(result.visible.size).toBe(tree.nodes.size);
  });
});

describe("flattenDeckRows", () => {
  it("muestra solo las raíces contraídas y expande según el estado", () => {
    const tree = buildTree();
    const result = searchDeckTree(tree, "");
    const collapsed = new Set([["Salud mental"].join("\u0000")]);

    const rows = flattenDeckRows(visibleDeckRoots(tree, result), result, (id) =>
      collapsed.has(id)
    );
    expect(rows.map((row) => row.node.name)).toEqual(["Otra", "Salud mental"]);

    const expanded = flattenDeckRows(visibleDeckRoots(tree, result), result, () => false);
    expect(expanded.map((row) => `${row.depth}:${row.node.name}`)).toEqual([
      "0:Otra",
      "0:Salud mental",
      "1:01",
      "2:Tema",
      "1:02",
    ]);
  });

  it("la búsqueda fuerza la expansión de los ancestros", () => {
    const tree = buildTree();
    const result = searchDeckTree(tree, "tema");
    const rows = flattenDeckRows(visibleDeckRoots(tree, result), result, () => true);

    expect(rows.map((row) => row.node.name)).toEqual(["Salud mental", "01", "Tema"]);
  });
});

describe("sortDeckTree", () => {
  it("reordena todos los niveles con el comparador indicado", () => {
    const tree = buildTree();
    sortDeckTree(tree, (left, right) => -compareDeckNodesByName(left, right));

    expect(tree.roots.map((node) => node.name)).toEqual(["Salud mental", "Otra"]);
    expect(tree.roots[0].children.map((node) => node.name)).toEqual(["02", "01"]);
  });
});
