import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mergeReviewProgress,
  parseReviewProgress,
  ReviewProgressStore,
  type ReviewProgressEvent,
  type ReviewProgressFile,
} from "./review-progress";

function makeEvent(overrides: Partial<ReviewProgressEvent> = {}): ReviewProgressEvent {
  return {
    id: "event-1",
    at: "2026-10-24T10:00:00.000Z",
    date: "2026-10-24",
    deviceId: "device-a",
    updatedAt: "2026-10-24T10:00:00.000Z",
    state: "applied",
    pagePath: "pages/Nota.md",
    pageTitle: "Nota",
    blockId: "b-1",
    cardId: "fc-basic-p1-b-1",
    cardType: "basic",
    rating: 3,
    before: {},
    after: {
      stability: 3.17,
      difficulty: 5.28,
      reps: 1,
      lastReviewDate: "2026-10-24T10:00:00.000Z",
      intervalDays: 1,
      easeFactor: 2.5,
      dueDate: "2026-10-25T10:00:00.000Z",
    },
    ...overrides,
  };
}

describe("diario de repasos compartido", () => {
  it("valida entradas y descarta rutas peligrosas o campos corruptos", () => {
    const parsed = parseReviewProgress(
      JSON.stringify({
        version: 1,
        entries: [
          makeEvent(),
          makeEvent({ id: "event-2", pagePath: "pages/../../etc/passwd" }),
          makeEvent({ id: "event-3", rating: 9 as never }),
          makeEvent({ id: "event-4", cardType: "unknown" as never }),
        ],
      })
    );
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].id).toBe("event-1");
  });

  it("trata un JSON corrupto como diario vacío", () => {
    expect(parseReviewProgress("{no es json").entries).toEqual([]);
    expect(parseReviewProgress(null).entries).toEqual([]);
  });

  it("conserva el estado FSRS válido y descarta valores fuera de rango", () => {
    const parsed = parseReviewProgress(
      JSON.stringify({
        version: 1,
        entries: [
          makeEvent({
            id: "learning",
            after: {
              stability: 3.71,
              difficulty: 5.16,
              reps: 1,
              lapses: 0,
              lastReviewDate: "2026-10-24T10:00:00.000Z",
              intervalDays: 10 / 1440,
              state: 1,
              learningStep: 1,
            },
          }),
          makeEvent({
            id: "invalid-state",
            after: { reps: 2, state: 9 as never },
          }),
        ],
      })
    );

    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0].after).toMatchObject({ state: 1, learningStep: 1 });
    expect(parsed.entries[1].after.state).toBeUndefined();
  });

  it("une historiales de dos equipos sin duplicar repasos", () => {
    const left: ReviewProgressFile = {
      version: 1,
      entries: [makeEvent({ id: "a", at: "2026-10-24T10:00:00.000Z" })],
    };
    const right: ReviewProgressFile = {
      version: 1,
      entries: [
        makeEvent({ id: "b", at: "2026-10-24T11:00:00.000Z" }),
        makeEvent({ id: "a", at: "2026-10-24T10:00:00.000Z" }),
      ],
    };
    const merged = mergeReviewProgress(left, right);
    expect(merged.entries.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("para el mismo repaso gana la actualización de estado más reciente", () => {
    const applied = makeEvent({
      id: "same",
      state: "applied",
      updatedAt: "2026-10-24T10:00:00.000Z",
    });
    const undone = makeEvent({
      id: "same",
      state: "undone",
      updatedAt: "2026-10-24T10:05:00.000Z",
    });
    const merged = mergeReviewProgress(
      { version: 1, entries: [applied] },
      { version: 1, entries: [undone] }
    );
    expect(merged.entries).toHaveLength(1);
    expect(merged.entries[0].state).toBe("undone");
  });
});

describe("ReviewProgressStore - deshacer tras una recarga", () => {
  const storage = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => storage.clear(),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size;
    },
  };

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, "localStorage", {
      value: fakeLocalStorage,
      configurable: true,
    });
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it("actualiza el evento del archivo aunque el objeto en memoria se haya clonado", async () => {
    const store = new ReviewProgressStore();
    await store.record({
      pagePath: "pages/Nota.md",
      pageTitle: "Nota",
      blockId: "b-1",
      cardId: "fc-basic-p1-b-1",
      cardType: "basic",
      rating: 3,
      before: {},
      after: { reps: 1, intervalDays: 1 },
    });

    // Simula lo que ocurre al leer la respuesta de Rust: los eventos se
    // reconstruyen como objetos nuevos y las pilas conservan los antiguos.
    const cloned = parseReviewProgress(
      JSON.stringify((store as unknown as { file: ReviewProgressFile }).file)
    );
    (store as unknown as { file: ReviewProgressFile }).file = cloned;

    const undo = store.takeUndo();
    expect(undo).not.toBeNull();
    await store.commitUndo(undo!);
    expect(parseReviewProgress(fakeLocalStorage.getItem("sinnotas-review-progress-v1")).entries[0].state).toBe(
      "undone"
    );
    expect(store.canRedo()).toBe(true);

    const redo = store.takeRedo();
    expect(redo?.id).toBe(undo?.id);
    await store.commitRedo(redo!);
    expect(parseReviewProgress(fakeLocalStorage.getItem("sinnotas-review-progress-v1")).entries[0].state).toBe(
      "applied"
    );
  });
});
