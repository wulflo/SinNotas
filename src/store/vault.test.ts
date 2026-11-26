// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ tauri: false }));
const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: () => runtime.tauri,
}));

import type { BlockNode, PageData, VaultCacheDelta } from "../types";
import { VaultStore } from "./vault";

function block(id: string, content: string, children: BlockNode[] = []): BlockNode {
  return { id, type: "text", content, children };
}

function page(id: string, overrides: Partial<PageData> = {}): PageData {
  return {
    id,
    title: `Nota ${id}`,
    path: `notas/${id}.md`,
    updatedAt: "2026-11-26 10:00",
    blocks: [block(`b-${id}`, "contenido inicial")],
    ...overrides,
  };
}

function saveCalls(): Array<{ filePath: string; blocks: BlockNode[] }> {
  return invokeMock.mock.calls
    .filter((call) => call[0] === "save_page")
    .map((call) => call[1] as { filePath: string; blocks: BlockNode[] });
}

describe("VaultStore.scheduleSavePage — debounce por nota", () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    runtime.tauri = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    runtime.tauri = false;
    vi.clearAllMocks();
  });

  it("colapsa varios guardados en una sola escritura con el contenido final", async () => {
    const vault = new VaultStore();
    const original = page("a");
    vault.replaceVault([original], "/vault", "Demo");

    vault.scheduleSavePage(original);
    const latest = { ...original, blocks: [block("b-a", "texto final")] };
    vault.scheduleSavePage(latest);
    expect(invokeMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    await vault.flushPendingFileOperations();

    const saves = saveCalls();
    expect(saves).toHaveLength(1);
    expect(saves[0].filePath).toBe("notas/a.md");
    expect(saves[0].blocks[0].content).toBe("texto final");
    expect(vault.getPageVersion(latest)).toBe(2);
    expect(vault.getOwnWriteEpoch()).toBe(1);
  });

  it("flushPendingSaves escribe de inmediato y el timer cancelado no vuelve a escribir", async () => {
    const vault = new VaultStore();
    const target = page("a");
    vault.replaceVault([target], "/vault", "Demo");

    vault.scheduleSavePage(target);
    await vault.flushPendingSaves();
    await vault.flushPendingFileOperations();
    expect(saveCalls()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(600);
    expect(saveCalls()).toHaveLength(1);
  });

  it("savePage inmediato reemplaza al guardado diferido sin duplicar escritura", async () => {
    const vault = new VaultStore();
    const target = page("a");
    vault.replaceVault([target], "/vault", "Demo");

    vault.scheduleSavePage(target);
    const edited = { ...target, blocks: [block("b-a", "guardado DIRECTO")] };
    await vault.savePage(edited);
    await vault.flushPendingFileOperations();
    await vi.advanceTimersByTimeAsync(600);

    const saves = saveCalls();
    expect(saves).toHaveLength(1);
    expect(saves[0].blocks[0].content).toBe("guardado DIRECTO");
  });
});

describe("VaultStore LRU de bloques", () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    runtime.tauri = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    runtime.tauri = false;
    vi.clearAllMocks();
  });

  it("descarga el más viejo, pero conserva el pinned y el que tiene guardado pendiente", async () => {
    const pages = Array.from({ length: 122 }, (_, index) =>
      page(`p${index}`, {
        path: `notas/p${index}.md`,
        blocksLoaded: false,
        blocks: [],
      })
    );
    const byPath = new Map(pages.map((candidate) => [candidate.path, candidate]));
    invokeMock.mockImplementation(async (command: string, args: { paths: string[] }) => {
      if (command !== "read_pages_cached") return undefined;
      return args.paths.map((path) => {
        const source = byPath.get(path)!;
        return { ...source, blocks: [block(`b-${source.id}`, "hidratado")], blocksLoaded: true };
      });
    });

    const vault = new VaultStore();
    vault.replaceVault(pages, "/vault", "Demo");

    // Lote 1 (tick 1): 121 notas; solo la primera se fija con pin (la opción
    // `pin:true` fijaría TODAS las del lote y no habría candidato a expulsar).
    // El barrido corre al cargar: p0 y p1 se fijan antes del primer lote.
    vault.pinPage(pages[0].path);
    vault.pinPage(pages[1].path);
    await vault.loadPagesCached(pages.slice(0, 121));
    expect(pages[0].blocksLoaded).toBe(true);
    expect(pages[120].blocksLoaded).toBe(true);

    // p1 deja de estar fijado pero tiene escritura diferida: no debe aplanarse.
    vault.unpinPage(pages[1].path);
    vault.scheduleSavePage(pages[1]);

    // Lote 2 (tick 2): una nota nueva provoca un exceso de 1.
    await vault.loadPagesCached([pages[121]]);

    expect(pages[0].blocksLoaded).toBe(true); // pinned sobrevive aunque sea la más vieja
    expect(pages[1].blocksLoaded).toBe(true); // pending save sobrevive
    expect(pages[2].blocksLoaded).toBe(false); // la más vieja sin protección se descarga
    expect(pages[2].blocks).toEqual([]);
    expect(pages[121].blocksLoaded).toBe(true);
    expect(invokeMock.mock.calls.filter((call) => call[0] === "read_pages_cached")).toHaveLength(2);

    await vault.flushPendingSaves();
  });

  it("en modo web no hidrata nada del LRU", async () => {
    runtime.tauri = false;
    const vault = new VaultStore();
    const target = page("a", { blocksLoaded: false, blocks: [] });
    vault.replaceVault([target], "/vault", "Demo");

    const loaded = await vault.ensurePageLoaded(target);
    expect(loaded).toBe(target);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe("VaultStore.renamePage — reescritura de wikilinks", () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    runtime.tauri = false; // modo web: rewrite sobre todas las páginas en memoria
  });

  afterEach(() => {
    runtime.tauri = false;
    vi.clearAllMocks();
  });

  it("reescribe solo [[Título]] exacto, incluidos bloques anidados, y canonicaliza el nombre", async () => {
    const target = page("old", {
      title: "Old Vieja",
      path: "notas/Old Vieja.md",
      blocks: [block("b-old", "[[Old Vieja]] | [[Old Vieja|alias]] | [[Old Vieja Extra]]")],
    });
    const other = page("other", {
      title: "Otra",
      path: "notas/Otra.md",
      blocks: [block("b-other", "padre [[Old Vieja]]", [block("b-child", "hijo [[Old Vieja]]")])],
    });
    const vault = new VaultStore();
    vault.replaceVault([target, other], "/vault", "Demo");
    const mutationBefore = vault.getMutationVersion();

    expect(await vault.renamePage("old", "old::vieja")).toBe(true);
    expect(target.title).toBe("old → vieja");
    expect(target.path).toBe("notas/old → vieja.md");
    expect(target.blocks[0].content).toContain("[[old → vieja]]");
    expect(target.blocks[0].content).toContain("[[Old Vieja|alias]]");
    expect(target.blocks[0].content).toContain("[[Old Vieja Extra]]");
    expect(other.blocks[0].content).toContain("[[old → vieja]]");
    expect(other.blocks[0].children[0].content).toContain("[[old → vieja]]");
    expect(vault.getMutationVersion()).toBe(mutationBefore + 1);
  });

  it("rechaza títulos duplicados e inválidos sin mutar la bóveda", async () => {
    const first = page("a", { title: "Primera", path: "notas/Primera.md" });
    const second = page("b", { title: "Segunda", path: "notas/Segunda.md" });
    const vault = new VaultStore();
    vault.replaceVault([first, second], "/vault", "Demo");
    const mutationBefore = vault.getMutationVersion();

    expect(await vault.renamePage("a", "Segunda")).toBe(false);
    expect(await vault.renamePage("a", "con/barra")).toBe(false);
    expect(first.title).toBe("Primera");
    expect(vault.getMutationVersion()).toBe(mutationBefore);
  });
});

describe("VaultStore.applyExternalDelta — la edición local gana", () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    runtime.tauri = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    runtime.tauri = false;
    vi.clearAllMocks();
  });

  it("aplica cambios y borrados, conserva metadatos locales y no toca ownWriteEpoch", () => {
    const local = page("a", {
      title: "A",
      path: "pages/A.md",
      pinned: true,
      pinnedAt: "2026-11-26T10:00:00.000Z",
      revisions: [{ id: "r1", timestamp: "t", blocks: [], summary: "s" }],
    });
    const removed = page("b", { title: "B", path: "pages/B.md" });
    const pending = page("c", { title: "C", path: "pages/C.md" });
    const vault = new VaultStore();
    vault.replaceVault([local, removed, pending], "/vault", "Demo");

    vault.scheduleSavePage(pending); // escritura local pendiente: gana sobre el delta
    const versionBefore = vault.getPageVersion(local);
    const mutationBefore = vault.getMutationVersion();

    const delta: VaultCacheDelta = {
      rootPath: "/vault",
      changed: [
        { ...local, title: "A externa", blocks: [block("b-ext", "del watcher")], pinned: false },
        { ...pending, title: "C externa", blocks: [block("b-ext-c", "no debe entrar")] },
      ],
      removed: ["/vault/pages/B.md"],
      revision: 7,
    };
    const result = vault.applyExternalDelta(delta, { skipPaths: [] });

    expect(result.changed).toEqual(["pages/A.md"]);
    expect(result.removed).toEqual(["pages/B.md"]);
    expect(result.added).toEqual([]);
    const updated = vault.getPages().find((candidate) => candidate.id === "a")!;
    expect(updated.title).toBe("A externa");
    expect(updated.pinned).toBe(true);
    expect(updated.pinnedAt).toBe("2026-11-26T10:00:00.000Z");
    expect(updated.revisions).toEqual(local.revisions);
    expect(vault.getPages().some((candidate) => candidate.id === "b")).toBe(false);
    expect(vault.getPages().find((candidate) => candidate.id === "c")!.title).toBe("C");
    expect(vault.getPageVersion(updated)).toBeGreaterThan(versionBefore);
    expect(vault.getMutationVersion()).toBe(mutationBefore + 1);
    expect(vault.getOwnWriteEpoch()).toBe(0);

    void vault.flushPendingSaves();
  });

  it("ignora deltas de otra bóveda", () => {
    const local = page("a", { path: "pages/A.md" });
    const vault = new VaultStore();
    vault.replaceVault([local], "/vault", "Demo");
    const mutationBefore = vault.getMutationVersion();

    const result = vault.applyExternalDelta({
      rootPath: "/otra-boveda",
      changed: [{ ...local, title: "Externa" }],
      removed: [],
      revision: 1,
    });

    expect(result).toEqual({ changed: [], added: [], removed: [] });
    expect(vault.getPages()[0].title).toBe("Nota a");
    expect(vault.getMutationVersion()).toBe(mutationBefore);
  });
});
