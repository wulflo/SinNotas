// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ tauri: false }));
const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: () => runtime.tauri,
}));

import {
  FLASHCARD_DECKS_LEGACY_DECK_ID,
  addFlashcardDeck,
  emptyFlashcardDeckFile,
  findFlashcardDeck,
  serializeFlashcardDeckFile,
} from "./flashcard-decks";
import { FlashcardDeckRepository } from "./flashcard-deck-storage";

describe("FlashcardDeckRepository", () => {
  beforeEach(() => {
    runtime.tauri = false;
    invokeMock.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("guarda y lee por bóveda en el fallback web", async () => {
    const repository = new FlashcardDeckRepository();
    const created = addFlashcardDeck(emptyFlashcardDeckFile(), "Mazo A", ["Nota"], 1000);
    await repository.save("/vault/uno", created.file);

    const loaded = await repository.load("/vault/uno");
    expect(loaded.decks.map((deck) => deck.name)).toEqual(["Mazo A"]);
    expect((await repository.load("/vault/dos")).decks).toHaveLength(0);
  });

  it("fusiona con la copia actual antes de escribir", async () => {
    const repository = new FlashcardDeckRepository();
    const first = addFlashcardDeck(emptyFlashcardDeckFile(), "Mazo A", ["A"], 1000);
    await repository.save("/vault", first.file);
    const second = addFlashcardDeck(first.file, "Mazo B", ["B"], 2000);
    await repository.save("/vault", second.file);

    const loaded = await repository.load("/vault");
    expect(loaded.decks.map((deck) => deck.name).sort()).toEqual([
      "Mazo A",
      "Mazo B",
    ]);
  });

  it("guarda el mazo activo por bóveda y lo invalida si ya no existe", async () => {
    const repository = new FlashcardDeckRepository();
    const file = addFlashcardDeck(emptyFlashcardDeckFile(), "Mazo", ["A"], 1000).file;
    const deck = file.decks[0];

    repository.setActiveDeckId("/vault/uno", deck.id);
    expect(repository.getActiveDeckId("/vault/uno")).toBe(deck.id);
    expect(repository.getActiveDeckId("/vault/dos")).toBeNull();
    expect(repository.resolveActiveDeckId("/vault/uno", file)).toBe(deck.id);
    expect(repository.resolveActiveDeckId("/vault/uno", emptyFlashcardDeckFile())).toBeNull();
    expect(repository.getActiveDeckId("/vault/uno")).toBeNull();
  });

  it("migra la selección antigua una sola vez y la deja activa", async () => {
    const repository = new FlashcardDeckRepository();
    const migrated = await repository.loadWithMigration("/vault", ["Nota 1", "Nota 2"]);

    expect(migrated.activeDeckId).toBe(FLASHCARD_DECKS_LEGACY_DECK_ID);
    expect(migrated.file.decks[0].pageTitles).toEqual(["Nota 1", "Nota 2"]);

    // Si ya hay mazos, no se vuelve a migrar ni se duplica.
    const again = await repository.loadWithMigration("/vault", ["Otra"]);
    expect(again.file.decks).toHaveLength(1);
    expect(again.file.decks[0].name).toBe("Selección anterior");
  });

  it("usa los comandos Tauri cuando la app corre en escritorio/Android", async () => {
    runtime.tauri = true;
    const repository = new FlashcardDeckRepository();
    const file = addFlashcardDeck(emptyFlashcardDeckFile(), "Mazo", ["A"], 1000).file;
    invokeMock.mockResolvedValueOnce(null);
    invokeMock.mockResolvedValueOnce(undefined);

    await repository.load("/vault");
    await repository.save("/vault", file);

    expect(invokeMock).toHaveBeenNthCalledWith(1, "read_flashcard_decks");
    // `save` relee el archivo actual antes de fusionar.
    expect(invokeMock).toHaveBeenNthCalledWith(2, "read_flashcard_decks");
    expect(invokeMock).toHaveBeenNthCalledWith(3, "write_flashcard_decks", {
      contents: serializeFlashcardDeckFile(file),
    });
  });

  it("rechaza archivos que superan el límite antes de escribir", async () => {
    const repository = new FlashcardDeckRepository();
    const huge = {
      ...emptyFlashcardDeckFile(),
      decks: [
        {
          id: "deck",
          name: "Mazo",
          // 10 000 títulos largos superan el límite de 1 MB del serializador.
          pageTitles: Array.from(
            { length: 10_000 },
            (_, index) => `${index}-${"x".repeat(300)}`
          ),
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    };
    await expect(repository.save("/vault", huge)).rejects.toThrow("límite");
  });

  it("mantiene un mazo migrado encontrado por id", () => {
    const file = addFlashcardDeck(
      emptyFlashcardDeckFile(),
      "Mazo",
      ["A"],
      1000
    ).file;
    expect(findFlashcardDeck(file, file.decks[0].id)?.name).toBe("Mazo");
  });
});
