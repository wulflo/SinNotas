import { describe, expect, it } from "vitest";
import { normalizePage } from "./normalize-page";
import { BlockNode, PageData } from "../types";

function legacyBlock(id: string, content: string): BlockNode {
  return { id, type: "todo" as BlockNode["type"], content, children: [] };
}

function page(overrides: Partial<PageData> = {}): PageData {
  return {
    id: "p-1",
    title: "Prueba",
    path: "pages/Prueba.md",
    blocks: [],
    ...overrides,
  };
}

describe("normalizePage", () => {
  it("detecta imágenes y normaliza tipos heredados cuando se pide", () => {
    const data = page({
      blocks: [
        legacyBlock("b-1", "texto plano"),
        legacyBlock("b-2", "![foto](assets/foto.png)"),
      ],
    });
    normalizePage(data, null, { blockTypes: true });
    expect(data.blocks.map((b) => b.type)).toEqual(["text", "image"]);
    expect(data.blocks[1].imageAlt).toBe("foto");
  });

  it("no reescribe tipos del payload de Rust si blockTypes es false", () => {
    const data = page({ blocks: [legacyBlock("b-1", "texto")] });
    normalizePage(data, null, { blockTypes: false });
    expect(data.blocks[0].type).toBe("todo");
  });

  it("convierte una ruta absoluta con la raíz activa en relativa", () => {
    const data = page({ path: "/vault/pages/Prueba.md" });
    normalizePage(data, "/vault");
    expect(data.path).toBe("pages/Prueba.md");
  });

  it("deriva pinned y pinnedAt del frontmatter", () => {
    const data = page({ frontmatter: ["pinned:: true", "pinned-at:: 2026-11-28T10:00:00.000Z"] });
    normalizePage(data, null);
    expect(data.pinned).toBe(true);
    expect(data.pinnedAt).toBe("2026-11-28T10:00:00.000Z");
  });

  it("conserva el estado previo si el frontmatter no tiene claves de fijado", () => {
    const data = page({ frontmatter: ["tags: demo"], pinned: true });
    normalizePage(data, null);
    expect(data.pinned).toBe(true);
  });
});
