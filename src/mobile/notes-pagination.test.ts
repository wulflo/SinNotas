import { describe, expect, it } from "vitest";
import { NOTES_PER_PAGE, paginateNotes } from "./notes-pagination";

describe("paginateNotes", () => {
  it("devuelve una única página vacía para una lista vacía", () => {
    expect(paginateNotes([], 1)).toEqual({
      items: [],
      currentPage: 1,
      totalPages: 1,
      start: 0,
      end: 0,
    });
  });

  it("pagina con el mismo tamaño que escritorio", () => {
    const items = Array.from({ length: 45 }, (_, index) => index);
    const second = paginateNotes(items, 2);

    expect(NOTES_PER_PAGE).toBe(20);
    expect(second.items).toHaveLength(20);
    expect(second.items[0]).toBe(20);
    expect(second.items[19]).toBe(39);
    expect(second.currentPage).toBe(2);
    expect(second.totalPages).toBe(3);
    expect(second.start).toBe(20);
    expect(second.end).toBe(40);
  });

  it("recorta la última página al resto de elementos", () => {
    const items = Array.from({ length: 45 }, (_, index) => index);
    const last = paginateNotes(items, 3);

    expect(last.items).toEqual([40, 41, 42, 43, 44]);
    expect(last.start).toBe(40);
    expect(last.end).toBe(45);
  });

  it("ajusta páginas fuera de rango a la primera o a la última", () => {
    const items = Array.from({ length: 45 }, (_, index) => index);

    expect(paginateNotes(items, 0).currentPage).toBe(1);
    expect(paginateNotes(items, -8).currentPage).toBe(1);
    expect(paginateNotes(items, 99).currentPage).toBe(3);
    expect(paginateNotes(items, 99).items).toHaveLength(5);
  });

  it("normaliza un tamaño de página inválido", () => {
    const items = [1, 2, 3];
    expect(paginateNotes(items, 1, 0).items).toEqual(items);
    expect(paginateNotes(items, 1, Number.NaN).items).toEqual(items);
  });
});
