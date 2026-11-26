import { describe, expect, it } from "vitest";
import type { ReviewProgressEvent } from "../store/review-progress";
import type { BlockNode, Flashcard, PageData } from "../types";
import { FlashcardsManager } from "./flashcards-manager";
import { findReviewCardTarget, locateReviewBlock, reviewCardIdForBlock } from "./review-target";

const CONTENT = "¿Pregunta? :: Respuesta #card";
const reviewed = "2026-11-26T10:00:00.000Z";

function block(id: string, content = CONTENT): BlockNode {
  return { id, type: "text", content, children: [] };
}

function page(id: string, title: string, blocks: BlockNode[]): PageData {
  return { id, title, path: `notes/${title}.md`, blocks };
}

function card(pageId: string, blockId: string, content = CONTENT): Flashcard {
  return {
    id: `fc-basic-${pageId}-${blockId}`,
    pageTitle: "Título duplicado",
    blockId,
    cardType: "basic",
    question: "",
    answer: "",
    fsrs: { stability: 1, difficulty: 5, reps: 0, lapses: 0, state: 0 },
    lastIntervalDays: 0,
    easeFactor: 2.5,
    fingerprint: FlashcardsManager.cardFingerprint(content, "basic"),
  };
}

const byTitle = (title: string) => pages.find((candidate) => candidate.title === title);
let pages: PageData[];

function event(blockId: string, pageId: string): ReviewProgressEvent {
  return {
    id: "ev-1",
    at: reviewed,
    date: "2026-11-26",
    deviceId: "test",
    updatedAt: reviewed,
    state: "applied",
    pagePath: `notes/${pageId}.md`,
    pageTitle: pageId,
    blockId,
    cardId: `fc-basic-${pageId}-${blockId}`,
    cardType: "basic",
    cardFingerprint: FlashcardsManager.cardFingerprint(CONTENT, "basic"),
    rating: 3,
    before: {},
    after: { lastReviewDate: reviewed },
  };
}

describe("findReviewCardTarget", () => {
  it("el id de página gana sobre un título repetido", () => {
    pages = [
      page("p-otra", "Título duplicado", [block("b-1", "otra tarjeta")]),
      page("p-correcta", "Título duplicado", [block("b-1")]),
    ];
    const target = findReviewCardTarget(card("p-correcta", "b-1"), pages, {
      findPageByTitle: byTitle,
    });
    expect(target?.page.id).toBe("p-correcta");
    expect(target?.block.content).toBe(CONTENT);
  });

  it("respeta la política de fallback de cada superficie", () => {
    pages = [page("p-correcta", "Nota", [block("b-otro")])];
    const desktop = findReviewCardTarget(card("p-correcta", "b-inexistente"), pages, {
      findPageByTitle: byTitle,
    });
    expect(desktop).toBeNull();

    const mobile = findReviewCardTarget(card("p-correcta", "b-inexistente"), pages, {
      findPageByTitle: byTitle,
      fallbackWhenBlockMissing: true,
    });
    expect(mobile?.block.id).toBe("b-otro");
  });

  it("si la huella no coincide busca dentro de la misma nota", () => {
    pages = [page("p-correcta", "Nota", [block("b-1", "otra cosa"), block("b-2")])];
    const target = findReviewCardTarget(card("p-correcta", "b-1"), pages, {
      findPageByTitle: byTitle,
    });
    expect(target?.block.id).toBe("b-2");
  });
});

describe("locateReviewBlock", () => {
  it("encuentra el bloque aunque cambiara el b-N y salta notas sin bloques", () => {
    pages = [
      { ...page("p-descargada", "Otra", [block("b-1")]), blocksLoaded: false },
      page("p-correcta", "Nota", [block("b-nuevo", `${CONTENT}\nlast-reviewed:: ${reviewed}`)]),
    ];
    const target = locateReviewBlock(event("b-viejo", "p-correcta"), pages, {
      findPageByTitle: byTitle,
      expected: { lastReviewDate: reviewed },
    });
    expect(target?.page.id).toBe("p-correcta");
    expect(target?.block.id).toBe("b-nuevo");
  });
});

describe("reviewCardIdForBlock", () => {
  it("sustituye solo el sufijo del bloque", () => {
    expect(reviewCardIdForBlock("fc-cloze-p-a-b-3", "b-3", "b-9")).toBe("fc-cloze-p-a-b-9");
    expect(reviewCardIdForBlock("fc-cloze-p-a-b-3", "b-4", "b-9")).toBe("fc-cloze-p-a-b-3");
  });
});
