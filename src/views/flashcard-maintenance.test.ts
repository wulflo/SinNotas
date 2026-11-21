import { describe, expect, it } from "vitest";
import { runFlashcardMaintenance } from "./flashcard-maintenance";
import { FlashcardsManager } from "./flashcards-manager";
import type { BlockNode, Flashcard, PageData } from "../types";
import { computeDueDate, defaultFSRSParams, FSRSEngine } from "../editor/fsrs";

function makePage(id: string, title: string, contents: string[]): PageData {
  const blocks: BlockNode[] = contents.map((content, index) => ({
    id: `${id}-b${index + 1}`,
    type: "text",
    content,
    children: [],
  }));
  return { id, title, path: `notes/${title}.md`, blocks };
}

const parameters = {
  ...defaultFSRSParams,
  w: [...defaultFSRSParams.w],
  learningSteps: [...defaultFSRSParams.learningSteps],
  relearningSteps: [...defaultFSRSParams.relearningSteps],
};

function dueContent(lastReviewed: string, intervalDays: number): string {
  return [
    "Pregunta :: Respuesta",
    `last-reviewed:: ${lastReviewed}`,
    `interval-days:: ${intervalDays}`,
    "due-date:: 2000-01-01T00:00:00.000Z",
  ].join("\n");
}

describe("runFlashcardMaintenance - lotes y progreso", () => {
  it("procesa todos los bloques, guarda por lote y cede el hilo entre lotes", async () => {
    const pages = [
      makePage("p1", "Nota A", [dueContent("2026-01-01T00:00:00.000Z", 10), dueContent("2026-02-01T00:00:00.000Z", 5)]),
      makePage("p2", "Nota B", [dueContent("2026-03-01T00:00:00.000Z", 20)]),
    ];
    const manager = new FlashcardsManager();
    const saved: string[] = [];
    const progress: Array<{ processed: number; savedPages: number }> = [];
    let yields = 0;

    const result = await runFlashcardMaintenance({
      action: "due-dates",
      parameters,
      pages,
      manager,
      batchSize: 1,
      savePage: async (page) => {
        saved.push(page.title);
      },
      yieldControl: () => {
        yields += 1;
      },
      onProgress: (value) => progress.push(value),
    });

    expect(result).toMatchObject({
      processed: 3,
      total: 3,
      updatedCards: 3,
      savedPages: 2,
      cancelled: false,
      done: true,
    });
    // Dos bloques en la misma página se guardan en lotes distintos.
    expect(saved.sort()).toEqual(["Nota A", "Nota A", "Nota B"]);
    expect(progress.length).toBeGreaterThanOrEqual(3);
    expect(progress[progress.length - 1].processed).toBe(3);
    expect(yields).toBe(2);
  });

  it("no guarda páginas cuyas tarjetas ya están correctas", async () => {
    const reviewedAt = "2026-01-01T00:00:00.000Z";
    const correct = [
      "Pregunta :: Respuesta",
      `last-reviewed:: ${reviewedAt}`,
      "interval-days:: 10",
      `due-date:: ${computeDueDate(reviewedAt, 10)}`,
    ].join("\n");
    const pages = [
      makePage("p1", "Correcta", [correct]),
      makePage("p2", "Pendiente", [dueContent(reviewedAt, 10)]),
    ];
    const saved: string[] = [];

    const result = await runFlashcardMaintenance({
      action: "due-dates",
      parameters,
      pages,
      manager: new FlashcardsManager(),
      savePage: async (page) => {
        saved.push(page.title);
      },
    });

    expect(result.updatedCards).toBe(1);
    expect(saved).toEqual(["Pendiente"]);
  });

  it("cuenta un bloque una sola vez aunque contenga varias tarjetas", async () => {
    const page = makePage("p1", "Oclusiones", [dueContent("2026-01-01T00:00:00.000Z", 10)]);
    const cards = [
      { id: "a", pageTitle: "Oclusiones", blockId: "p1-b1" },
      { id: "b", pageTitle: "Oclusiones", blockId: "p1-b1" },
    ] as Flashcard[];

    const result = await runFlashcardMaintenance({
      action: "due-dates",
      parameters,
      pages: [page],
      manager: { scanPages: () => cards },
      savePage: async () => {},
    });

    expect(result.total).toBe(1);
    expect(result.processed).toBe(1);
    expect(result.updatedCards).toBe(2);
    // Solo se escribe una vez la línea FSRS del bloque compartido.
    expect(page.blocks[0].content.match(/due-date::/g)).toHaveLength(1);
  });
});

describe("runFlashcardMaintenance - cancelación", () => {
  it("cancela a mitad sin guardar el lote incompleto", async () => {
    const pages = ["A", "B", "C"].map((title, index) =>
      makePage(`p${index}`, title, [dueContent("2026-01-01T00:00:00.000Z", 10)])
    );
    const controller = new AbortController();
    const saved: string[] = [];
    const progress: Array<{ cancelled: boolean; processed: number }> = [];

    const result = await runFlashcardMaintenance({
      action: "due-dates",
      parameters,
      pages,
      manager: new FlashcardsManager(),
      batchSize: 1,
      signal: controller.signal,
      savePage: async (page) => {
        saved.push(page.title);
      },
      yieldControl: () => {
        // Aborta tras guardar el primer lote; el segundo ni se toca.
        controller.abort();
      },
      onProgress: (value) => progress.push(value),
    });

    expect(result.cancelled).toBe(true);
    expect(result.done).toBe(false);
    expect(result.processed).toBe(1);
    expect(saved).toEqual(["A"]);
    expect(progress[progress.length - 1].cancelled).toBe(true);
  });
});

describe("runFlashcardMaintenance - acciones", () => {
  it("reset elimina la programación", async () => {
    const page = makePage("p1", "Reset", [
      [
        "Pregunta :: Respuesta",
        "card-s:: 10",
        "card-d:: 5",
        "card-state:: 2",
        "last-reviewed:: 2026-01-01T00:00:00.000Z",
      ].join("\n"),
    ]);

    const result = await runFlashcardMaintenance({
      action: "reset",
      parameters,
      pages: [page],
      manager: new FlashcardsManager(),
      savePage: async () => {},
    });

    expect(result.updatedCards).toBe(1);
    expect(page.blocks[0].content).toBe("Pregunta :: Respuesta");
  });

  it("convert añade el rastro rápido de FSRS-7", async () => {
    const page = makePage("p1", "Convertir", [
      [
        "Pregunta :: Respuesta",
        "card-s:: 10",
        "card-d:: 5",
        "card-reps:: 6",
        "card-lapses:: 0",
        "last-reviewed:: 2026-01-01T00:00:00.000Z",
        "interval-days:: 10",
        "card-state:: 2",
      ].join("\n"),
    ]);

    await runFlashcardMaintenance({
      action: "convert",
      parameters,
      pages: [page],
      manager: new FlashcardsManager(),
      savePage: async () => {},
    });

    expect(page.blocks[0].content).toContain("card-s-fast:: 8");
  });

  it("reschedule reprograma desde el ancla y avisa de vencimientos pasados", async () => {
    const page = makePage("p1", "Reprogramar", [
      [
        "Pregunta :: Respuesta",
        "card-s:: 10",
        "card-d:: 5",
        "card-state:: 2",
        "last-reviewed:: 2020-01-01T00:00:00.000Z",
        "interval-days:: 10",
      ].join("\n"),
    ]);

    const result = await runFlashcardMaintenance({
      action: "reschedule",
      parameters,
      pages: [page],
      manager: new FlashcardsManager(),
      anchor: "last-reviewed",
      now: new Date(2026, 10, 21, 14, 10, 0, 0),
      savePage: async () => {},
    });

    expect(result.updatedCards).toBe(1);
    expect(result.pastDueCards).toBe(1);
    expect(page.blocks[0].content).toContain("interval-days:: 13");
  });

  it("due-dates usa el intervalo almacenado", async () => {
    const reviewedAt = "2026-01-01T00:00:00.000Z";
    const page = makePage("p1", "Vencimientos", [dueContent(reviewedAt, 10)]);

    await runFlashcardMaintenance({
      action: "due-dates",
      parameters,
      pages: [page],
      manager: new FlashcardsManager(),
      savePage: async () => {},
    });

    expect(page.blocks[0].content).toContain(`due-date:: ${computeDueDate(reviewedAt, 10)}`);
  });

  it("reschedule aplica los ajustes del mazo que contiene cada nota", async () => {
    const rescheduleContent = [
      "Pregunta :: Respuesta",
      "card-s:: 10",
      "card-d:: 5",
      "card-state:: 2",
      "last-reviewed:: 2020-01-01T00:00:00.000Z",
      "interval-days:: 10",
    ].join("\n");
    const pageA = makePage("pA", "Mazo A", [rescheduleContent]);
    const pageB = makePage("pB", "Mazo B", [rescheduleContent]);
    const paramsA = { ...parameters, requestRetention: 0.9 };
    const paramsB = { ...parameters, requestRetention: 0.7 };
    const seen: string[] = [];

    await runFlashcardMaintenance({
      action: "reschedule",
      parameters,
      resolveDeckParameters: (page) => {
        seen.push(page.title);
        return page.title === "Mazo A" ? paramsA : paramsB;
      },
      pages: [pageA, pageB],
      manager: new FlashcardsManager(),
      anchor: "today",
      now: new Date(2026, 10, 21, 12, 0, 0, 0),
      savePage: async () => {},
    });

    expect(seen).toEqual(["Mazo A", "Mazo B"]);
    // Cada nota se recálcula con la retención de su mazo, no con `parameters`.
    const expectedA = new FSRSEngine(paramsA).nextInterval({
      stability: 10,
      difficulty: 5,
      stabilityFast: 8,
    });
    const expectedB = new FSRSEngine(paramsB).nextInterval({
      stability: 10,
      difficulty: 5,
      stabilityFast: 8,
    });
    expect(expectedA).not.toBe(expectedB);
    expect(pageA.blocks[0].content).toContain(`interval-days:: ${expectedA}`);
    expect(pageB.blocks[0].content).toContain(`interval-days:: ${expectedB}`);
  });
});
