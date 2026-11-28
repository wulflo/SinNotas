import { describe, expect, it } from "vitest";
import { resolveCardTargetIds } from "./flashcard-target";
import { BlockNode, PageData } from "../types";

function block(id: string, children: BlockNode[] = []): BlockNode {
  return { id, type: "text", content: id, collapsed: false, children };
}

function page(): PageData {
  return {
    id: "p-test",
    title: "Prueba",
    path: "pages/Prueba.md",
    frontmatter: [],
    blocks: [block("b-parent", [block("b-child")]), block("b-other")],
  };
}

describe("resolveCardTargetIds", () => {
  it("prefiere los bullets seleccionados, incluido un hijo", () => {
    expect([...resolveCardTargetIds(page(), { selectedIds: ["b-child", "b-parent"] })]).toEqual([
      "b-child",
      "b-parent",
    ]);
  });

  it("usa el cursor cuando no hay selección", () => {
    expect([...resolveCardTargetIds(page(), { selectedIds: [], cursorId: "b-child" })]).toEqual([
      "b-child",
    ]);
  });

  it("usa el bullet enfocado cuando no hay selección ni cursor", () => {
    expect([...resolveCardTargetIds(page(), { selectedIds: [], focusedId: "b-other" })]).toEqual([
      "b-other",
    ]);
  });

  it("da prioridad a la selección sobre el cursor y el foco", () => {
    expect(
      [...resolveCardTargetIds(page(), {
        selectedIds: ["b-parent"],
        cursorId: "b-child",
        focusedId: "b-other",
      })]
    ).toEqual(["b-parent"]);
  });

  it("descarta ids obsoletos de una selección anterior", () => {
    const result = resolveCardTargetIds(page(), {
      selectedIds: ["b-deleted"],
      cursorId: null,
      focusedId: "b-other",
    });
    expect([...result]).toEqual(["b-other"]);
  });

  it("devuelve un conjunto vacío si no hay ningún objetivo", () => {
    expect(resolveCardTargetIds(page(), { selectedIds: [] }).size).toBe(0);
  });
});
