import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import {
  deletePageCmd,
  findBacklinksCmd,
  readFlashcardDecksCmd,
  readNoteSnapshotsCmd,
  readPagesCachedCmd,
  readReviewProgressCmd,
  renamePageCmd,
  restoreSnapshotCmd,
  savePageCmd,
  clearReviewProgressCmd,
  writeFlashcardDecksCmd,
  writePageRevisionsCmd,
  writeReviewProgressCmd,
} from "./commands";

describe("adaptador tipado de comandos Tauri", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue([]);
  });

  it("savePageCmd envía filePath, blocks y frontmatter", async () => {
    const blocks = [{ id: "b-1", type: "text" as const, content: "hola", children: [] }];
    await savePageCmd({ filePath: "pages/A.md", blocks });
    expect(invokeMock).toHaveBeenCalledWith("save_page", {
      filePath: "pages/A.md",
      blocks,
      frontmatter: [],
    });
  });

  it("rechaza en dev un argumento ausente antes de invocar", () => {
    expect(() => savePageCmd({ blocks: [], filePath: undefined as unknown as string })).toThrow(
      'falta el argumento "filePath"'
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("readPagesCachedCmd pasa la lista de rutas", async () => {
    await readPagesCachedCmd(["pages/A.md"]);
    expect(invokeMock).toHaveBeenCalledWith("read_pages_cached", { paths: ["pages/A.md"] });
  });

  it("writePageRevisionsCmd y deletePageCmd usan filePath", async () => {
    await writePageRevisionsCmd("pages/A.md", []);
    await deletePageCmd("pages/A.md");
    expect(invokeMock).toHaveBeenNthCalledWith(1, "write_page_revisions", {
      filePath: "pages/A.md",
      revisions: [],
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "delete_page", { filePath: "pages/A.md" });
  });

  it("renamePageCmd usa oldPath y newPath", async () => {
    await renamePageCmd("pages/A.md", "pages/B.md");
    expect(invokeMock).toHaveBeenCalledWith("rename_page", {
      oldPath: "pages/A.md",
      newPath: "pages/B.md",
    });
  });

  it("readNoteSnapshotsCmd y restoreSnapshotCmd respetan snapshotId", async () => {
    await readNoteSnapshotsCmd("pages/A.md");
    await restoreSnapshotCmd("pages/A.md", "rev-1");
    expect(invokeMock).toHaveBeenNthCalledWith(2, "restore_snapshot", {
      filePath: "pages/A.md",
      snapshotId: "rev-1",
    });
  });

  it("findBacklinksCmd normaliza snake_case y camelCase al tipo único", async () => {
    invokeMock.mockResolvedValueOnce([
      { source_page: "A", source_path: "pages/A.md", line_number: 3, snippet: "x" },
      { sourcePage: "B", sourcePath: "pages/B.md", lineNumber: 4, snippet: "y" },
    ]);
    const result = await findBacklinksCmd("C");
    expect(invokeMock).toHaveBeenCalledWith("find_backlinks", { pageTitle: "C" });
    expect(result).toEqual([
      { source_page: "A", source_path: "pages/A.md", line_number: 3, snippet: "x" },
      { source_page: "B", source_path: "pages/B.md", line_number: 4, snippet: "y" },
    ]);
  });

  it("progreso y mazos usan el argumento contents", async () => {
    await writeReviewProgressCmd("{}");
    await writeFlashcardDecksCmd("{}");
    expect(invokeMock).toHaveBeenNthCalledWith(1, "write_review_progress", { contents: "{}" });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "write_flashcard_decks", { contents: "{}" });
  });

  it("lecturas y borrado de progreso/mazos no envían argumentos", async () => {
    await readReviewProgressCmd();
    await readFlashcardDecksCmd();
    await clearReviewProgressCmd();
    expect(invokeMock).toHaveBeenNthCalledWith(1, "read_review_progress");
    expect(invokeMock).toHaveBeenNthCalledWith(2, "read_flashcard_decks");
    expect(invokeMock).toHaveBeenNthCalledWith(3, "clear_review_progress");
  });
});
