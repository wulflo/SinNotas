import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mergeReviewProgress,
  parseReviewProgress,
  ReviewProgressStore,
  type ReviewProgressEvent,
  type ReviewProgressFile,
} from "./review-progress";

function isoDaysAgo(days: number, extraMinutes = 0): string {
  return new Date(Date.now() - days * 86_400_000 + extraMinutes * 60_000).toISOString();
}

function isoDateDaysAgo(days: number): string {
  return isoDaysAgo(days).slice(0, 10);
}

function makeEvent(overrides: Partial<ReviewProgressEvent> = {}): ReviewProgressEvent {
  return {
    id: "event-1",
    at: isoDaysAgo(1),
    date: isoDateDaysAgo(1),
    deviceId: "device-a",
    updatedAt: isoDaysAgo(1),
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
      lastReviewDate: isoDaysAgo(1),
      intervalDays: 1,
      easeFactor: 2.5,
      dueDate: isoDaysAgo(0),
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
      entries: [makeEvent({ id: "a", at: isoDaysAgo(1, 0) })],
    };
    const right: ReviewProgressFile = {
      version: 1,
      entries: [
        makeEvent({ id: "b", at: isoDaysAgo(1, 60) }),
        makeEvent({ id: "a", at: isoDaysAgo(1, 0) }),
      ],
    };
    const merged = mergeReviewProgress(left, right);
    expect(merged.entries.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("para el mismo repaso gana la actualización de estado más reciente", () => {
    const applied = makeEvent({
      id: "same",
      state: "applied",
      updatedAt: isoDaysAgo(1),
    });
    const undone = makeEvent({
      id: "same",
      state: "undone",
      updatedAt: isoDaysAgo(0),
    });
    const merged = mergeReviewProgress(
      { version: 1, entries: [applied] },
      { version: 1, entries: [undone] }
    );
    expect(merged.entries).toHaveLength(1);
    expect(merged.entries[0].state).toBe("undone");
  });

  it("descarta los repasos de más de un año para acotar el diario", () => {
    const parsed = parseReviewProgress(
      JSON.stringify({
        version: 1,
        entries: [
          makeEvent({ id: "recent", at: isoDaysAgo(10), date: isoDateDaysAgo(10) }),
          makeEvent({ id: "old", at: isoDaysAgo(400), date: isoDateDaysAgo(400) }),
        ],
      })
    );
    expect(parsed.entries.map((entry) => entry.id)).toEqual(["recent"]);
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
