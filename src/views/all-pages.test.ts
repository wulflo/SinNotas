import { describe, expect, it } from "vitest";
import type { PageData } from "../types";
import {
  filterAllPages,
  isAllPagesSort,
  parseAllPagesSort,
  sortAllPages,
} from "./all-pages";

function page(
  id: string,
  title: string,
  updatedAt?: string,
  overrides: Partial<PageData> = {}
): PageData {
  return {
    id,
    title,
    path: `notas/${id}.md`,
    blocks: [],
    updatedAt,
    ...overrides,
  };
}

const displayTitle = (entry: PageData): string => entry.title;
const createdAtOf = (entry: PageData): number | null => {
  const values: Record<string, number> = {
    a: 100,
    b: 300,
    c: 200,
  };
  return values[entry.id] ?? null;
};

describe("filterAllPages", () => {
  const pages = [
    page("a", "Página de Álgebra"),
    page("b", "Biología"),
    page("c", "Programación"),
  ];

  it("devuelve todas las páginas si la búsqueda está vacía", () => {
    expect(filterAllPages(pages, "   ", displayTitle)).toEqual(pages);
  });

  it("ignora mayúsculas y acentos", () => {
    expect(filterAllPages(pages, "pagina algebra", displayTitle).map((p) => p.id)).toEqual(["a"]);
    expect(filterAllPages(pages, "BIOLOGIA", displayTitle).map((p) => p.id)).toEqual(["b"]);
  });

  it("encuentra coincidencias parciales", () => {
    expect(filterAllPages(pages, "gram", displayTitle).map((p) => p.id)).toEqual(["c"]);
  });

  it("busca también en el título interno de los diarios", () => {
    const journal = page("j", "Diarios", "2026-10-17 10:00", {
      isJournal: true,
      journalDate: "2026-10-17",
      path: "journals/2026_10_17.md",
    });
    const label = (entry: PageData) => (entry.isJournal ? "Diario 17 oct 2026" : entry.title);

    expect(filterAllPages([journal], "2026_10_17", label)).toHaveLength(1);
    expect(filterAllPages([journal], "17 oct", label)).toHaveLength(1);
  });
});

describe("parseAllPagesSort", () => {
  it("valida los valores admitidos", () => {
    expect(isAllPagesSort("created-desc")).toBe(true);
    expect(isAllPagesSort("created-sideways")).toBe(false);
    expect(isAllPagesSort(null)).toBe(false);
  });

  it("usa la última modificación descendente por defecto", () => {
    expect(parseAllPagesSort("desconocido")).toEqual({ key: "updated", direction: "desc" });
    expect(parseAllPagesSort("created-asc")).toEqual({ key: "created", direction: "asc" });
  });
});

describe("sortAllPages", () => {
  const pages = [
    page("a", "Alfa", "2026-10-17 10:00"),
    page("b", "beta", "2026-10-18 10:00"),
    page("c", "Gamma", "2026-10-16 10:00"),
  ];

  it("ordena por última modificación en ambos sentidos", () => {
    expect(sortAllPages(pages, "updated-desc", displayTitle, createdAtOf).map((p) => p.id))
      .toEqual(["b", "a", "c"]);
    expect(sortAllPages(pages, "updated-asc", displayTitle, createdAtOf).map((p) => p.id))
      .toEqual(["c", "a", "b"]);
  });

  it("ordena por nombre con collation numérica y sin distinguir mayúsculas", () => {
    expect(sortAllPages(pages, "title-asc", displayTitle, createdAtOf).map((p) => p.id))
      .toEqual(["a", "b", "c"]);
    expect(sortAllPages(pages, "title-desc", displayTitle, createdAtOf).map((p) => p.id))
      .toEqual(["c", "b", "a"]);
  });

  it("ordena por fecha de creación y deja las desconocidas al final", () => {
    const withUnknown = [...pages, page("z", "Zeta")];
    expect(sortAllPages(withUnknown, "created-asc", displayTitle, createdAtOf).map((p) => p.id))
      .toEqual(["a", "c", "b", "z"]);
    expect(sortAllPages(withUnknown, "created-desc", displayTitle, createdAtOf).map((p) => p.id))
      .toEqual(["b", "c", "a", "z"]);
  });

  it("deja las fechas de modificación desconocidas al final en ambos sentidos", () => {
    const withUnknown = [...pages, page("z", "Zeta")];
    expect(sortAllPages(withUnknown, "updated-desc", displayTitle, createdAtOf).map((p) => p.id))
      .toEqual(["b", "a", "c", "z"]);
    expect(sortAllPages(withUnknown, "updated-asc", displayTitle, createdAtOf).map((p) => p.id))
      .toEqual(["c", "a", "b", "z"]);
  });

  it("mantiene las páginas fijadas arriba dentro de la clave elegida", () => {
    const pinnedLast = pages.map((entry) =>
      entry.id === "c" ? { ...entry, pinned: true } : entry
    );
    expect(sortAllPages(pinnedLast, "updated-desc", displayTitle, createdAtOf).map((p) => p.id))
      .toEqual(["c", "b", "a"]);
    expect(sortAllPages(pinnedLast, "title-asc", displayTitle, createdAtOf).map((p) => p.id))
      .toEqual(["c", "a", "b"]);
  });

  it("no muta el arreglo original", () => {
    const original = [...pages];
    sortAllPages(pages, "title-desc", displayTitle, createdAtOf);
    expect(pages).toEqual(original);
  });
});
