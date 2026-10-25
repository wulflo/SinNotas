import type { Flashcard, PageData } from "../types";
import type { FlashcardsManager, FlashcardReviewOrder } from "./flashcards-manager";

export interface FlashcardLoadProgress {
  scannedPages: number;
  totalPages: number;
  cards: number;
  done: boolean;
  fromCache: boolean;
}

export interface FlashcardLoadOptions {
  order: FlashcardReviewOrder;
  preserve?: { cardId: string; revealed: boolean };
  onProgress?: (progress: FlashcardLoadProgress) => void;
  onDone?: (cards: readonly Flashcard[]) => void;
}

interface LoadTask {
  pages: PageData[];
  version: number;
  cards: Flashcard[];
  nextPage: number;
  order: FlashcardReviewOrder;
  preserve?: { cardId: string; revealed: boolean };
  progressListeners: Set<(progress: FlashcardLoadProgress) => void>;
  doneListeners: Set<(cards: readonly Flashcard[]) => void>;
  timer: number | null;
  generation: number;
  chunkSize: number;
}

interface ScanCache {
  pages: PageData[];
  version: number;
  cards: Flashcard[];
}

const INITIAL_CHUNK_SIZE = 16;
const MAX_CHUNK_SIZE = 64;
const MIN_CHUNK_SIZE = 4;
const TARGET_CHUNK_MS = 14;

/**
 * Intermediario entre el almacén de notas y `FlashcardsManager`.
 *
 * Antes, entrar en Flashcards ejecutaba un `scanVault()` síncrono sobre todas
 * las notas (1000 notas × ~150 bloques): la interfaz se congelaba y no había
 * forma de mostrar progreso. Ahora el escaneo se reparte en lotes pequeños que
 * ceden el hilo entre uno y otro, se cachea por versión del vault y solo se
 * aplica al manager cuando está completo (así el orden/mezcla no cambia a
 * mitad de carga y la tarjeta activa se conserva).
 */
export class FlashcardLoader {
  private manager: FlashcardsManager;
  private cache: ScanCache | null = null;
  private task: LoadTask | null = null;
  private generation = 0;

  constructor(manager: FlashcardsManager) {
    this.manager = manager;
  }

  /** Tarjetas completas si la caché corresponde a estas páginas y versión. */
  public getCachedCards(pages: PageData[], version: number): Flashcard[] | null {
    if (!this.cache) return null;
    return this.cache.pages === pages && this.cache.version === version
      ? this.cache.cards
      : null;
  }

  public isFresh(pages: PageData[], version: number): boolean {
    return this.getCachedCards(pages, version) !== null;
  }

  public isLoading(): boolean {
    return this.task !== null;
  }

  /** Tarjetas disponibles para el explorador (parciales mientras se escanea). */
  public getCardsForDisplay(): readonly Flashcard[] {
    if (this.task) return this.task.cards;
    return this.cache?.cards ?? [];
  }

  public getProgress(): FlashcardLoadProgress {
    if (this.task) {
      return {
        scannedPages: this.task.nextPage,
        totalPages: this.task.pages.length,
        cards: this.task.cards.length,
        done: false,
        fromCache: false,
      };
    }
    if (this.cache) {
      return {
        scannedPages: this.cache.pages.length,
        totalPages: this.cache.pages.length,
        cards: this.cache.cards.length,
        done: true,
        fromCache: true,
      };
    }
    return { scannedPages: 0, totalPages: 0, cards: 0, done: false, fromCache: false };
  }

  /** Invalida la caché (cambio de bóveda, importación masiva, etc.). */
  public invalidate(): void {
    this.cancel();
    this.cache = null;
  }

  public cancel(): void {
    this.generation += 1;
    if (this.task?.timer !== null && this.task?.timer !== undefined) {
      globalThis.clearTimeout(this.task.timer);
    }
    this.task = null;
  }

  /**
   * Garantiza que las tarjetas estén escaneadas y aplicadas al manager.
   * Si ya hay una carga en curso para la misma bóveda se reutiliza y solo se
   * actualizan el orden, la tarjeta a preservar y los callbacks.
   */
  public load(pages: PageData[], version: number, options: FlashcardLoadOptions): void {
    const cached = this.getCachedCards(pages, version);
    if (cached) {
      this.manager.setDetectedCards(cached, options.order, options.preserve);
      const progress = this.getProgress();
      options.onProgress?.(progress);
      options.onDone?.(cached);
      return;
    }

    const current = this.task;
    if (current && current.pages === pages && current.version === version) {
      current.order = options.order;
      if (options.preserve) current.preserve = options.preserve;
      if (options.onProgress) {
        current.progressListeners.add(options.onProgress);
        options.onProgress(this.getProgress());
      }
      if (options.onDone) current.doneListeners.add(options.onDone);
      return;
    }

    this.cancel();
    const generation = this.generation + 1;
    this.generation = generation;

    const progressListeners = new Set<(progress: FlashcardLoadProgress) => void>();
    const doneListeners = new Set<(cards: readonly Flashcard[]) => void>();
    if (options.onProgress) progressListeners.add(options.onProgress);
    if (options.onDone) doneListeners.add(options.onDone);

    const task: LoadTask = {
      pages,
      version,
      cards: [],
      nextPage: 0,
      order: options.order,
      preserve: options.preserve,
      progressListeners,
      doneListeners,
      timer: null,
      generation,
      chunkSize: INITIAL_CHUNK_SIZE,
    };
    this.task = task;

    if (pages.length === 0) {
      this.finish(task);
      return;
    }

    this.emitProgress(task);
    this.schedule(task);
  }

  private schedule(task: LoadTask): void {
    // globalThis también funciona en tests y entornos sin `window`.
    task.timer = globalThis.setTimeout(() => this.run(task.generation), 0);
  }

  private run(generation: number): void {
    const task = this.task;
    if (!task || task.generation !== generation || this.generation !== generation) return;
    task.timer = null;

    const startedAt = performance.now();
    const end = Math.min(task.pages.length, task.nextPage + task.chunkSize);
    if (end > task.nextPage) {
      const chunk = task.pages.slice(task.nextPage, end);
      const detected = this.manager.scanPages(chunk);
      for (const card of detected) task.cards.push(card);
      task.nextPage = end;
    }

    const elapsed = performance.now() - startedAt;
    if (elapsed > TARGET_CHUNK_MS * 2) {
      task.chunkSize = Math.max(MIN_CHUNK_SIZE, Math.floor(task.chunkSize / 2));
    } else if (elapsed < TARGET_CHUNK_MS / 2) {
      task.chunkSize = Math.min(MAX_CHUNK_SIZE, task.chunkSize + 4);
    }

    if (task.nextPage >= task.pages.length) {
      this.finish(task);
      return;
    }

    this.emitProgress(task);
    this.schedule(task);
  }

  private finish(task: LoadTask): void {
    if (this.task !== task) return;
    this.task = null;
    this.cache = {
      pages: task.pages,
      version: task.version,
      cards: task.cards,
    };

    this.manager.setDetectedCards(task.cards, task.order, task.preserve);

    const progress: FlashcardLoadProgress = {
      scannedPages: task.pages.length,
      totalPages: task.pages.length,
      cards: task.cards.length,
      done: true,
      fromCache: false,
    };
    task.progressListeners.forEach((listener) => listener(progress));
    task.doneListeners.forEach((listener) => listener(task.cards));
  }

  private emitProgress(task: LoadTask): void {
    const progress: FlashcardLoadProgress = {
      scannedPages: task.nextPage,
      totalPages: task.pages.length,
      cards: task.cards.length,
      done: false,
      fromCache: false,
    };
    task.progressListeners.forEach((listener) => listener(progress));
  }
}
