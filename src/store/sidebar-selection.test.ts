import { describe, expect, it } from "vitest";
import { PageData } from "../types";
import { selectSidebarPages } from "./sidebar-selection";

function makePage(
  id: string,
  title: string,
  extra: Partial<PageData> = {}
): PageData {
  return {
    id,
    title,
    path: extra.path ?? `notes/${title}.md`,
    blocks: [],
    ...extra,
  };
}

describe("selectSidebarPages", () => {
  it("orden de fijadas: pinnedAt ascendente, sin pinnedAt al final", () => {
    const pages = [
      makePage("p1", "Sin fecha", { pinned: true }),
      makePage("p2", "Segunda", { pinned: true, pinnedAt: "2026-10-24T10:00:00.000Z" }),
      makePage("p3", "Primera", { pinned: true, pinnedAt: "2026-10-24T09:00:00.000Z" }),
      makePage("p4", "Suelta"),
    ];
    const { pinned, recent } = selectSidebarPages(pages, []);
    expect(pinned.map((p) => p.id)).toEqual(["p3", "p2", "p1"]);
    expect(recent).toEqual([]);
  });

  it("recientes excluye las fijadas, rutas huérfanas y duplicados", () => {
    const pages = [
      makePage("p1", "Fijada", { pinned: true, path: "notes/Fijada.md" }),
      makePage("p2", "Abierta", { path: "notes/Abierta.md" }),
      makePage("p3", "Otra", { path: "notes/Otra.md" }),
    ];
    const recentPaths = [
      "notes/Abierta.md",
      "notes/Borrada.md", // huérfana
      "notes/Abierta.md", // duplicada
      "notes/Fijada.md", // fijada
    ];
    const { pinned, recent } = selectSidebarPages(pages, recentPaths);
    expect(pinned.map((p) => p.id)).toEqual(["p1"]);
    // La primera aparición decide la posición y los duplicados no se repiten.
    expect(recent.map((p) => p.id)).toEqual(["p2"]);
  });

  it("respetar el orden de recentPaths (la más reciente primero)", () => {
    const pages = [
      makePage("p1", "A", { path: "notes/A.md" }),
      makePage("p2", "B", { path: "notes/B.md" }),
      makePage("p3", "C", { path: "notes/C.md" }),
    ];
    const { recent } = selectSidebarPages(pages, [
      "notes/C.md",
      "notes/A.md",
      "notes/B.md",
    ]);
    expect(recent.map((p) => p.id)).toEqual(["p3", "p1", "p2"]);
  });

  it("listas vacías no fallan", () => {
    const { pinned, recent } = selectSidebarPages([], []);
    expect(pinned).toEqual([]);
    expect(recent).toEqual([]);
  });

  it("sin fijadas, recientes muestra todas las rutas existentes", () => {
    const pages = [
      makePage("p1", "A", { path: "notes/A.md" }),
      makePage("p2", "B", { path: "notes/B.md" }),
    ];
    const { pinned, recent } = selectSidebarPages(pages, [
      "notes/B.md",
      "notes/A.md",
    ]);
    expect(pinned).toEqual([]);
    expect(recent.map((p) => p.id)).toEqual(["p2", "p1"]);
  });
});
