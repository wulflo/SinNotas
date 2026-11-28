// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  tauri: true,
  onRead: null as null | (() => void),
  staleBlocks: [] as Array<{ id: string; type: string; content: string; children: unknown[] }>,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: () => h.tauri,
}));

vi.mock("../tauri/commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tauri/commands")>();
  return {
    ...actual,
    readPagesCachedCmd: vi.fn(async () => {
      h.onRead?.();
      return [
        {
          id: "p-1",
          title: "A",
          path: "pages/A.md",
          blocks: h.staleBlocks as unknown as BlockNode[],
          blocksLoaded: true,
        },
      ];
    }),
  };
});

import { VaultStore } from "./vault";
import type { BlockNode, PageData } from "../types";

function block(id: string, content: string): BlockNode {
  return { id, type: "text", content, children: [], collapsed: false };
}

function page(title: string, content: string, blocksLoaded: boolean): PageData {
  return {
    id: "p-1",
    title,
    path: "pages/A.md",
    blocks: [block("b-1", content)],
    blocksLoaded,
    blockCount: 1,
  };
}

describe("guard de epoch en hidratación", () => {
  beforeEach(() => {
    h.tauri = true;
    h.onRead = null;
    h.staleBlocks = [block("b-stale", "viejo")];
    localStorage.clear();
  });

  it("descarta bloques hidratados si la bóveda cambió mientras esperaba", async () => {
    const vault = new VaultStore();
    vault.replaceVault([page("A", "inicial", false)], "/vault", "A");

    h.onRead = () => {
      vault.replaceVault([page("B", "nuevo", true)], "/otra", "B");
    };

    await vault.loadPagesCached([vault.getPages()[0]]);

    expect(vault.getPages()[0].title).toBe("B");
    expect(vault.getPages()[0].blocks[0].content).toBe("nuevo");
  });

  it("aplica la hidratación si no hubo cambio de bóveda", async () => {
    const vault = new VaultStore();
    vault.replaceVault([page("A", "inicial", false)], "/vault", "A");

    await vault.loadPagesCached([vault.getPages()[0]]);

    expect(vault.getPages()[0].blocks[0].content).toBe("viejo");
    expect(vault.getPages()[0].blocksLoaded).toBe(true);
  });
});
