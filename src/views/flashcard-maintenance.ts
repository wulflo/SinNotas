import type { BlockNode, Flashcard, PageData } from "../types";
import type { FSRSParameters } from "../editor/fsrs";
import { findNodeLocation, getAllBlocksFlat } from "../editor/tree-engine";
import { FlashcardsManager, type RescheduleFSRSOptions } from "./flashcards-manager";

/**
 * Acciones de mantenimiento masivo de tarjetas.
 *
 * - `due-dates`: recalcula `due-date::` desde el último repaso y el intervalo.
 * - `reschedule`: reprograma las tarjetas en Review con la retención actual.
 * - `convert`: convierte tarjetas FSRS-4.5 al formato FSRS-7.
 * - `reset`: elimina la programación y deja las tarjetas como nuevas.
 */
export type FlashcardMaintenanceAction = "due-dates" | "reschedule" | "convert" | "reset";

/** Progreso que se puede pintar en la interfaz sin bloquear el hilo. */
export interface FlashcardMaintenanceProgress {
  /** Bloques de tarjeta examinados. */
  processed: number;
  /** Bloques de tarjeta totales (un bloque puede contener varias tarjetas). */
  total: number;
  /** Tarjetas modificadas (una tarjeta cloze/oclusión cuenta por separado). */
  updatedCards: number;
  /** Páginas distintas guardadas hasta ahora. */
  savedPages: number;
  /** Tarjetas cuyo vencimiento resultante queda en el pasado. */
  pastDueCards: number;
  cancelled: boolean;
}

export interface FlashcardMaintenanceResult extends FlashcardMaintenanceProgress {
  done: boolean;
}

export interface FlashcardMaintenanceOptions {
  action: FlashcardMaintenanceAction;
  /** Parámetros de FSRS usados para notas que no pertenecen a ningún mazo. */
  parameters: FSRSParameters;
  /**
   * Parámetros de FSRS de la nota: devuelve los ajustes del mazo que la
   * contiene o `undefined` si no pertenece a ninguno (entones se usa
   * `parameters`). Se aplica nota a nota, así que las tarjetas de cada mazo
   * recálculan con la configuración de ese mazo.
   */
  resolveDeckParameters?: (page: PageData) => FSRSParameters | undefined;
  /** Páginas del vault que se van a procesar. */
  pages: readonly PageData[];
  /** Solo se usa su `scanPages`, que no muta el estado del manager. */
  manager: Pick<FlashcardsManager, "scanPages">;
  /** Si se indica, se procesan estas tarjetas en vez de escanear el vault. */
  cards?: readonly Flashcard[];
  anchor?: RescheduleFSRSOptions["anchor"];
  /** Reloj inyectable para tests y para comparar vencimientos pasados. */
  now?: Date;
  /** Bloques por lote. 40 por defecto. */
  batchSize?: number;
  signal?: AbortSignal;
  /** Cede el hilo entre lotes. */
  yieldControl?: () => Promise<void> | void;
  /** Guarda una página modificada. Se llama una vez por página y lote. */
  savePage: (page: PageData) => Promise<void>;
  onProgress?: (progress: FlashcardMaintenanceProgress) => void;
}

const DEFAULT_BATCH_SIZE = 40;

interface CardBlock {
  page: PageData;
  block: BlockNode;
  /** Tarjetas detectadas en el bloque (cloze, oclusiones…). */
  cards: Flashcard[];
}

/** Cede el hilo con rAF y recurre a setTimeout cuando no está disponible. */
function defaultYieldControl(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function normalizeBatchSize(value: number | undefined): number {
  if (!Number.isFinite(value) || (value as number) <= 0) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.floor(value as number));
}

function readDueDate(content: string): number {
  const match = content.match(/(?:^|\n)due-date::\s*(\S+)/i);
  return match ? Date.parse(match[1]) : Number.NaN;
}

/**
 * Agrupa las tarjetas por nota + bloque. Un mismo bloque puede producir varias
 * tarjetas (cloze con varios huecos, oclusiones de imagen), pero sus
 * propiedades FSRS son una sola línea de Markdown: hay que escribirla una vez.
 */
function groupCardsByBlock(pages: readonly PageData[], cards: readonly Flashcard[]): CardBlock[] {
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const pageByTitle = new Map<string, PageData>();
  pages.forEach((page) => pageByTitle.set(page.title.toLowerCase(), page));

  const grouped = new Map<string, CardBlock>();
  for (const card of cards) {
    // El `page.id` viaja en el cardId y es estable; el título puede repetirse.
    const pageMatch = card.id.match(/^fc-(?:image|cloze|basic)-(p-[^-]+)-/);
    const page =
      (pageMatch && pageById.get(pageMatch[1])) ||
      pageByTitle.get(card.pageTitle.toLowerCase());
    if (!page) continue;

    let block: BlockNode | undefined;
    const location = findNodeLocation(page.blocks, card.blockId);
    if (location) {
      const candidate = location.parentList[location.index];
      if (
        !card.fingerprint ||
        FlashcardsManager.cardFingerprint(candidate.content, card.cardType) === card.fingerprint
      ) {
        block = candidate;
      }
    }
    if (!block && card.fingerprint) {
      block = getAllBlocksFlat(page.blocks).find(
        (candidate) =>
          FlashcardsManager.cardFingerprint(candidate.content, card.cardType) === card.fingerprint
      );
    }
    if (!block) continue;

    const key = `${page.id}\u0000${block.id}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.cards.push(card);
      continue;
    }
    grouped.set(key, { page, block, cards: [card] });
  }
  return Array.from(grouped.values());
}

function applyAction(
  action: FlashcardMaintenanceAction,
  content: string,
  options: FlashcardMaintenanceOptions,
  page: PageData
): string | null {
  // Parámetros del mazo de la nota cuando existe; en otro caso el valor
  // global pasado en `options.parameters`.
  const parameters = options.resolveDeckParameters?.(page) ?? options.parameters;
  switch (action) {
    case "reset":
      return FlashcardsManager.clearFSRSProgress(content);
    case "reschedule":
      return FlashcardsManager.rescheduleFSRS(content, parameters, {
        anchor: options.anchor,
        now: options.now,
      });
    case "convert":
      return FlashcardsManager.migrateLegacyFSRS(content, parameters);
    case "due-dates":
    default:
      return FlashcardsManager.recalculateDueDate(content);
  }
}

/**
 * Recálculo masivo de propiedades FSRS por lotes.
 *
 * El trabajo se reparte por bloques y se guarda página a página al cerrar cada
 * lote. Así el usuario ve progreso, la interfaz puede repintarse entre lotes y
 * una cancelación no deja medio lote escrito en disco.
 */
export async function runFlashcardMaintenance(
  options: FlashcardMaintenanceOptions
): Promise<FlashcardMaintenanceResult> {
  const nowMs = (options.now ?? new Date()).getTime();
  const batchSize = normalizeBatchSize(options.batchSize);
  const yieldControl = options.yieldControl ?? defaultYieldControl;
  const cards = options.cards ?? options.manager.scanPages([...options.pages]);
  const blocks = groupCardsByBlock(options.pages, cards);

  const total = blocks.length;
  const savedPageKeys = new Set<string>();
  let processed = 0;
  let updatedCards = 0;
  let pastDueCards = 0;

  const buildProgress = (cancelled: boolean): FlashcardMaintenanceProgress => ({
    processed,
    total,
    updatedCards,
    savedPages: savedPageKeys.size,
    pastDueCards,
    cancelled,
  });

  for (let start = 0; start < total; start += batchSize) {
    if (options.signal?.aborted) {
      const progress = buildProgress(true);
      options.onProgress?.(progress);
      return { ...progress, done: false };
    }

    const batch = blocks.slice(start, start + batchSize);
    const updates: Array<{ block: BlockNode; content: string; page: PageData; cards: Flashcard[] }> = [];
    let aborted = false;

    for (const entry of batch) {
      // La señal también se comprueba dentro del lote: si llega a mitad, el
      // lote incompleto se descarta y no se escribe en disco.
      if (options.signal?.aborted) {
        aborted = true;
        break;
      }
      const content = applyAction(options.action, entry.block.content, options, entry.page);
      processed += 1;
      if (content === null || content === entry.block.content) continue;
      updates.push({ block: entry.block, content, page: entry.page, cards: entry.cards });
    }

    if (aborted) {
      const progress = buildProgress(true);
      options.onProgress?.(progress);
      return { ...progress, done: false };
    }

    const pagesToSave = new Map<string, PageData>();
    for (const update of updates) {
      update.block.content = update.content;
      pagesToSave.set(update.page.path, update.page);
      updatedCards += update.cards.length;
      const dueDate = readDueDate(update.content);
      if (Number.isFinite(dueDate) && dueDate < nowMs) pastDueCards += update.cards.length;
    }

    if (pagesToSave.size > 0) {
      await Promise.all(
        Array.from(pagesToSave.values()).map((page) => options.savePage(page))
      );
      pagesToSave.forEach((_page, key) => savedPageKeys.add(key));
    }

    options.onProgress?.(buildProgress(false));

    if (start + batchSize < total) await yieldControl();
  }

  const progress = buildProgress(false);
  return { ...progress, done: true };
}
