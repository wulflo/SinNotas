import { describe, expect, it } from "vitest";
import {
  applyPinnedFrontmatter,
  readPinnedFromFrontmatter,
  writePinnedToFrontmatter,
} from "./pinned-frontmatter";
import { PageData } from "../types";

function page(frontmatter?: string[], pinned?: boolean, pinnedAt?: string): PageData {
  return {
    id: "p-test",
    title: "Prueba",
    path: "pages/Prueba.md",
    frontmatter,
    blocks: [],
    pinned,
    pinnedAt,
  };
}

describe("pinned-frontmatter", () => {
  it("escribe las claves canónicas conservando el resto del frontmatter", () => {
    const result = writePinnedToFrontmatter(
      ["title: Prueba", "tags:", "  - estudio"],
      true,
      "2026-11-28T10:00:00.000Z"
    );
    expect(result).toEqual([
      "title: Prueba",
      "tags:",
      "  - estudio",
      "pinned:: true",
      "pinned-at:: 2026-11-28T10:00:00.000Z",
    ]);
  });

  it("es idempotente: repetir la escritura no duplica claves", () => {
    const first = writePinnedToFrontmatter(["title: Prueba"], true, "2026-11-28T10:00:00.000Z");
    expect(writePinnedToFrontmatter(first, true, "2026-11-28T10:00:00.000Z")).toEqual(first);
  });

  it("quita las claves al desfijar sin borrar otras líneas", () => {
    const result = writePinnedToFrontmatter(
      ["title: Prueba", "pinned:: true", "pinned-at:: 2026-11-28T10:00:00.000Z"],
      false,
      undefined
    );
    expect(result).toEqual(["title: Prueba"]);
  });

  it("lee el estado escrito y lo aplica a la nota al cargar", () => {
    const frontmatter = writePinnedToFrontmatter([], true, "2026-11-28T10:00:00.000Z");
    const loaded = page(frontmatter);
    applyPinnedFrontmatter(loaded);
    expect(loaded.pinned).toBe(true);
    expect(loaded.pinnedAt).toBe("2026-11-28T10:00:00.000Z");
  });

  it("no sobrescribe una nota sin las claves (bóveda antigua)", () => {
    const loaded = page(["title: Prueba"], true, "2026-11-20T09:00:00.000Z");
    applyPinnedFrontmatter(loaded);
    expect(loaded.pinned).toBe(true);
    expect(loaded.pinnedAt).toBe("2026-11-20T09:00:00.000Z");
  });

  it("respeta un pinned:: false escrito por otra aplicación", () => {
    const loaded = page(["pinned:: false", "pinned-at:: 2026-11-28T10:00:00.000Z"], true);
    applyPinnedFrontmatter(loaded);
    expect(loaded.pinned).toBe(false);
  });

  it("ignora fechas no válidas y líneas con CRLF", () => {
    expect(
      readPinnedFromFrontmatter(["pinned:: true", "pinned-at:: no-es-una-fecha\r"])
    ).toEqual({ pinned: true });
    expect(readPinnedFromFrontmatter(["pinned:: TRUE\r", "pinned-at:: 2026-11-28T10:00:00.000Z\r"])).toEqual({
      pinned: true,
      pinnedAt: "2026-11-28T10:00:00.000Z",
    });
  });
});
