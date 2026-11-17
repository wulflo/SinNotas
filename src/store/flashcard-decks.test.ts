import { describe, expect, it } from "vitest";
import {
  FLASHCARD_DECKS_LEGACY_DECK_ID,
  addFlashcardDeck,
  deleteFlashcardDeck,
  emptyFlashcardDeckFile,
  flashcardDeckNameKey,
  mergeFlashcardDeckFiles,
  mergeFlashcardDeckSelection,
  migrateLegacyFlashcardSelection,
  parseFlashcardDeckFile,
  resolveFlashcardDeckPageTitles,
  serializeFlashcardDeckFile,
  uniqueFlashcardDeckName,
  updateFlashcardDeck,
  validateFlashcardDeckName,
  type FlashcardDeck,
} from "./flashcard-decks";

function deck(overrides: Partial<FlashcardDeck> = {}): FlashcardDeck {
  return {
    id: "deck-a",
    name: "Salud mental",
    pageTitles: ["Salud mental → Ansiedad"],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe("nombres de mazos", () => {
  it("compara sin mayúsculas, acentos ni espacios sobrantes", () => {
    expect(flashcardDeckNameKey("  Exámen   Final ")).toBe("examen final");
  });

  it("rechaza nombres vacíos, largos o duplicados", () => {
    const decks = [deck(), deck({ id: "deck-b", name: "Examen" })];
    expect(validateFlashcardDeckName("   ", decks)).toContain("vacío");
    expect(validateFlashcardDeckName("x".repeat(81), decks)).toContain("80");
    expect(validateFlashcardDeckName("exámen", decks)).toBe(
      "Ya existe un mazo con ese nombre."
    );
    expect(validateFlashcardDeckName("Otro", decks)).toBeNull();
    expect(validateFlashcardDeckName("Exámen", decks, "deck-b")).toBeNull();
  });

  it("genera sufijos para nombres repetidos", () => {
    const decks = [deck(), deck({ id: "deck-b", name: "Salud mental (2)" })];
    expect(uniqueFlashcardDeckName("Salud mental", decks)).toBe("Salud mental (3)");
  });

  it("mantiene el límite de longitud al añadir el sufijo", () => {
    const long = "x".repeat(80);
    const name = uniqueFlashcardDeckName(long, [deck({ id: "deck-b", name: long })]);
    expect(name.length).toBeLessThanOrEqual(80);
    expect(name.endsWith("(2)")).toBe(true);
  });
});

describe("CRUD de mazos", () => {
  it("crea, actualiza y elimina con lápida", () => {
    const created = addFlashcardDeck(
      emptyFlashcardDeckFile(),
      "Salud mental",
      ["A", "A", "B"],
      1000
    );
    expect(created.deck.pageTitles).toEqual(["A", "B"]);
    expect(created.file.decks).toHaveLength(1);

    const updated = updateFlashcardDeck(
      created.file,
      created.deck.id,
      { name: "Salud", pageTitles: ["C"] },
      2000
    );
    expect(updated.decks[0]).toMatchObject({
      name: "Salud",
      pageTitles: ["C"],
      updatedAt: 2000,
    });

    const deleted = deleteFlashcardDeck(updated, created.deck.id, 3000);
    expect(deleted.decks).toHaveLength(0);
    expect(deleted.tombstones).toEqual([
      { id: created.deck.id, deletedAt: 3000 },
    ]);
  });

  it("no actualiza un id inexistente", () => {
    const file = emptyFlashcardDeckFile();
    expect(updateFlashcardDeck(file, "missing", { name: "X" })).toBe(file);
    expect(deleteFlashcardDeck(file, "missing")).toBe(file);
  });
});

describe("parseo y serialización", () => {
  it("descarta datos inválidos y conserva los válidos", () => {
    const raw = JSON.stringify({
      version: 1,
      decks: [
        deck(),
        { id: "", name: "Sin id" },
        { id: "deck-b", name: "" },
        { id: "deck-a", name: "Duplicado por id" },
        { id: "deck-c", name: "Examen", pageTitles: ["N1", 3, "N1", "N2"] },
      ],
      tombstones: [{ id: "deck-d", deletedAt: 999 }],
    });
    const file = parseFlashcardDeckFile(raw);
    expect(file.decks.map((item) => item.id)).toEqual(["deck-a", "deck-c"]);
    expect(file.decks[1].pageTitles).toEqual(["N1", "N2"]);
    expect(file.tombstones).toEqual([{ id: "deck-d", deletedAt: 999 }]);
  });

  it("devuelve un archivo vacío si el JSON es inválido o la versión no existe", () => {
    expect(parseFlashcardDeckFile(null).decks).toEqual([]);
    expect(parseFlashcardDeckFile("no json").decks).toEqual([]);
    expect(parseFlashcardDeckFile('{"version":2,"decks":[]}').decks).toEqual([]);
  });

  it("serializa y vuelve a leer sin perder datos", () => {
    const file = addFlashcardDeck(
      emptyFlashcardDeckFile(),
      "Mazo",
      ["A", "B"],
      1000
    ).file;
    expect(parseFlashcardDeckFile(serializeFlashcardDeckFile(file))).toEqual(file);
  });

  it("resuelve alias de separador y descarta notas inexistentes", () => {
    const item = deck({
      pageTitles: ["Salud mental::01", "No existe", "Otra"],
    });
    expect(
      resolveFlashcardDeckPageTitles(item, [
        "Salud mental → 01",
        "Otra",
      ])
    ).toEqual(["Salud mental → 01", "Otra"]);
    expect(resolveFlashcardDeckPageTitles(item)).toEqual(item.pageTitles);
  });

  it("conserva notas existentes que no aparecen en el editor y descarta borradas", () => {
    expect(
      mergeFlashcardDeckSelection(
        ["Activa"],
        ["Activa", "Sin tarjetas", "Borrada"],
        ["Activa", "Sin tarjetas", "Otra"],
        ["Activa"]
      )
    ).toEqual(["Activa", "Sin tarjetas"]);
  });

  it("respeta las notas que el usuario desmarca aunque sigan existiendo", () => {
    expect(
      mergeFlashcardDeckSelection(
        ["Activa"],
        ["Activa", "Visible"],
        ["Activa", "Visible"],
        ["Activa", "Visible"]
      )
    ).toEqual(["Activa"]);
  });
});

describe("fusión entre dispositivos", () => {
  it("gana la edición más reciente por id", () => {
    const older = deck({ name: "Antiguo", updatedAt: 1000 });
    const newer = deck({ name: "Nuevo", updatedAt: 2000 });
    const merged = mergeFlashcardDeckFiles(
      { ...emptyFlashcardDeckFile(), decks: [older] },
      { ...emptyFlashcardDeckFile(), decks: [newer] }
    );
    expect(merged.decks[0].name).toBe("Nuevo");
  });

  it("una lápida posterior elimina el mazo aunque la otra copia sea más nueva", () => {
    const merged = mergeFlashcardDeckFiles(
      { ...emptyFlashcardDeckFile(), decks: [deck({ updatedAt: 1000 })] },
      {
        ...emptyFlashcardDeckFile(),
        tombstones: [{ id: "deck-a", deletedAt: 2000 }],
      }
    );
    expect(merged.decks).toHaveLength(0);
  });

  it("un mazo editado después del borrado se conserva", () => {
    const merged = mergeFlashcardDeckFiles(
      {
        ...emptyFlashcardDeckFile(),
        decks: [deck({ updatedAt: 3000, name: "Recuperado" })],
      },
      {
        ...emptyFlashcardDeckFile(),
        tombstones: [{ id: "deck-a", deletedAt: 2000 }],
      }
    );
    expect(merged.decks[0].name).toBe("Recuperado");
  });

  it("renombra nombres duplicados al fusionar mazos distintos", () => {
    const merged = mergeFlashcardDeckFiles(
      {
        ...emptyFlashcardDeckFile(),
        decks: [deck({ id: "a", name: "Examen", updatedAt: 1000 })],
      },
      {
        ...emptyFlashcardDeckFile(),
        decks: [deck({ id: "b", name: "Exámen", updatedAt: 2000 })],
      }
    );
    const names = merged.decks.map((item) => item.name);
    expect(names).toHaveLength(2);
    expect(new Set(names.map(flashcardDeckNameKey)).size).toBe(2);
    expect(names.some((name) => name.endsWith("(2)"))).toBe(true);
  });
});

describe("migración de la selección antigua", () => {
  it("crea el mazo con id estable", () => {
    const file = migrateLegacyFlashcardSelection(["A", "B"], 1234);
    expect(file.decks).toHaveLength(1);
    expect(file.decks[0]).toMatchObject({
      id: FLASHCARD_DECKS_LEGACY_DECK_ID,
      name: "Selección anterior",
      pageTitles: ["A", "B"],
      createdAt: 1234,
      updatedAt: 1234,
    });
  });

  it("no migra cuando el filtro es nulo", () => {
    expect(migrateLegacyFlashcardSelection(null).decks).toHaveLength(0);
  });
});
