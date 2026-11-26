import { findNodeLocation, getAllBlocksFlat } from "../editor/tree-engine";
import type { ReviewProgressEvent } from "../store/review-progress";
import type { BlockNode, Flashcard, PageData } from "../types";
import { FlashcardsManager, type CardScheduleSnapshot } from "./flashcards-manager";

export interface ReviewCardTarget {
  page: PageData;
  block: BlockNode;
}

export interface ReviewTargetLookup {
  /** El escritorio usa `vault.getPageByTitle` (insensible a mayúsculas y con
   * alias); el móvil compara títulos de forma exacta. Se inyecta a propósito. */
  findPageByTitle: (title: string) => PageData | undefined;
  /** El móvil recupera tarjetas con el `b-N` reasignado; el escritorio no. */
  fallbackWhenBlockMissing?: boolean;
}

/**
 * Resuelve la nota y el bloque real de una tarjeta usando el `page.id`
 * incrustado en su id antes que el título, y validando la huella estable.
 * Devuelve una referencia viva al bloque: quien califica la muta en memoria.
 */
export function findReviewCardTarget(
  card: Flashcard,
  pages: PageData[],
  lookup: ReviewTargetLookup
): ReviewCardTarget | null {
  const pageIdMatch = card.id.match(/^fc-(?:image|cloze|basic)-(p-[^-]+)-/);
  const page =
    (pageIdMatch && pages.find((candidate) => candidate.id === pageIdMatch[1])) ||
    lookup.findPageByTitle(card.pageTitle);
  if (!page) return null;

  const location = findNodeLocation(page.blocks, card.blockId);
  const block = location?.parentList[location.index];
  if (
    block &&
    (!card.fingerprint ||
      FlashcardsManager.cardFingerprint(block.content, card.cardType) === card.fingerprint)
  ) {
    return { page, block };
  }
  if (!location && !lookup.fallbackWhenBlockMissing) return null;
  if (!card.fingerprint) return null;

  const fallback = getAllBlocksFlat(page.blocks).find(
    (candidate) =>
      FlashcardsManager.cardFingerprint(candidate.content, card.cardType) === card.fingerprint
  );
  return fallback ? { page, block: fallback } : null;
}

/** Localiza el bloque de un repaso del diario validando instantánea y huella. */
export function locateReviewBlock(
  event: ReviewProgressEvent,
  pages: PageData[],
  lookup: Pick<ReviewTargetLookup, "findPageByTitle"> & {
    expected?: CardScheduleSnapshot;
  }
): ReviewCardTarget | null {
  const matchesSnapshot = (block: BlockNode): boolean =>
    !!lookup.expected &&
    FlashcardsManager.scheduleSnapshotsEqual(
      FlashcardsManager.readScheduleSnapshot(block.content),
      lookup.expected
    );
  const matchesFingerprint = (block: BlockNode): boolean =>
    !!event.cardFingerprint &&
    FlashcardsManager.cardFingerprint(block.content, event.cardType) === event.cardFingerprint;

  const preferredPage =
    pages.find((candidate) => candidate.path === event.pagePath) ||
    lookup.findPageByTitle(event.pageTitle);
  if (preferredPage) {
    const location = findNodeLocation(preferredPage.blocks, event.blockId);
    if (location) {
      const block = location.parentList[location.index];
      if (matchesSnapshot(block) || matchesFingerprint(block)) {
        return { page: preferredPage, block };
      }
    }
  }

  // El `b-N` pudo cambiar: la huella es estable y, en diarios antiguos sin
  // huella, la instantánea esperada tiene `last-reviewed`, único por repaso.
  for (const page of pages) {
    if (page.blocksLoaded === false) continue;
    for (const block of getAllBlocksFlat(page.blocks)) {
      if (!matchesFingerprint(block) && !matchesSnapshot(block)) continue;
      if (!/card-s::|last-reviewed::|#card\b/i.test(block.content)) continue;
      return { page, block };
    }
  }
  return null;
}

/** Recalcula el id de la tarjeta cuando cambia el sufijo `b-N` del bloque. */
export function reviewCardIdForBlock(
  cardId: string,
  blockId: string,
  currentBlockId: string
): string {
  const oldSuffix = `-${blockId}`;
  return cardId.endsWith(oldSuffix)
    ? `${cardId.slice(0, -oldSuffix.length)}-${currentBlockId}`
    : cardId;
}
