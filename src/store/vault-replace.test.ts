// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// FASE 6.2: el flag de Tauri decide si `replaceVault` renormaliza el vault
// completo en el hilo principal. Se simula `isTauri` del core porque el
// comportamiento cambia por runtime, no por test.
const runtime = vi.hoisted(() => ({ tauri: false }));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: () => runtime.tauri,
}));

import type { BlockNode, PageData } from "../types";
import { VaultStore } from "./vault";

function pageWithBlocks(id: string, blocks: BlockNode[]): PageData {
  return {
    id,
    title: `Nota ${id}`,
    path: `notas/${id}.md`,
    updatedAt: "2026-10-31 10:00",
    blocks,
  };
}

function textBlock(id: string, content: string): BlockNode {
  return { id, type: "text", content, children: [], collapsed: false };
}

function legacyWebPage(): PageData {
  return pageWithBlocks("legacy", [
    // Tipo heredado no canónico + contenido de imagen sin marcar: lo que
    // normalizeBlockTypes arregla en datos del modo web.
    { id: "b1", type: "todo" as BlockNode["type"], content: "debería volverse text", children: [] },
    textBlock("b2", "![corazon](archivos/corazon.png)\nnota con imagen"),
  ]);
}

function rustPayloadPage(): PageData {
  return pageWithBlocks("rust", [
    // Payload canónico de Rust: ya trae image detectada y text en el resto.
    { id: "b1", type: "image" as BlockNode["type"], content: "archivos/corazon.png", imageAlt: "corazon", children: [] },
    textBlock("b2", "Pregunta :: Respuesta"),
  ]);
}

describe("VaultStore.replaceVault — normalización por runtime (FASE 6.2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    runtime.tauri = false;
  });

  it("en web normaliza los tipos heredados del payload", () => {
    const vault = new VaultStore();
    vault.replaceVault([legacyWebPage()], "/vault", "Demo");

    const [b1, b2] = vault.getPages()[0].blocks;
    expect(b1.type).toBe("text");
    expect(b2.type).toBe("image");
    expect(b2.imageAlt).toBe("corazon");
  });

  it("en Tauri no renormaliza: el parse de Rust ya entrega canónicos", () => {
    runtime.tauri = true;
    const vault = new VaultStore();
    const page = rustPayloadPage();
    vault.replaceVault([page], "/vault", "Tauri");

    const [b1, b2] = vault.getPages()[0].blocks;
    // La imagen de Rust llega como llegó: sin re-escribir el content.
    expect(b1.type).toBe("image");
    expect(b1.content).toBe("archivos/corazon.png");
    expect(b2.type).toBe("text");
  });
});
