import type { Flashcard, PageData } from "../types";
import type { FlashcardsManager, FlashcardReviewOrder } from "./flashcards-manager";
import type { VaultVersionView } from "../store/vault";

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

/**
 * FASE 4-D: proveedor de bloques para el scan en streaming. Con el boot de
 * metadatos las notas llegan sin árboles; el lote del scan los pide viajando
 * por la caché de Rust (`read_pages_cached`) justo antes de escanearlas.
 */
export type FlashcardPageHydrator = (pages: PageData[]) => void | Promise<void>;

/** Número o bien la vista de epochs de `VaultStore` (modo incremental). */
export type FlashcardVersion = number | VaultVersionView;

interface LoadTask {
  /** Páginas del request (definen el orden final de las tarjetas). */
  requestPages: PageData[];
  /** Páginas que este task reescanea (todas, o solo las modificadas). */
  scanPagesList: PageData[];
  /** Buckets previos de notas que NO se reescanean (null en escaneo completo). */
  baseBuckets: Map<string, Flashcard[]> | null;
  /** Buckets producidos por este task, por ruta de nota. */
  scannedBuckets: Map<string, Flashcard[]>;
  /** Epoch de cada nota reescaneada, capturado EN el momento del escaneo. */
  scanEpochs: Map<string, number>;
  version: FlashcardVersion;
  /** Tarjetas acumuladas (semilla + escaneo) para progreso y vista parcial. */
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
  /** Versión numérica (modo legacy) o la vista usada (modo incremental). */
  version: FlashcardVersion | null;
  /** null cuando la caché se construyó con versión numérica (modo legacy). */
  view: VaultVersionView | null;
  structural: number;
  /** Ruta de nota -> epoch capturado al terminar el escaneo. */
  epochs: Map<string, number>;
  /** Ruta de nota -> tarjetas de esa nota. */
  cardsByPage: Map<string, Flashcard[]>;
  cards: Flashcard[];
}

const INITIAL_CHUNK_SIZE = 16;
const MAX_CHUNK_SIZE = 64;
const MIN_CHUNK_SIZE = 4;
const TARGET_CHUNK_MS = 14;

function isVersionView(version: FlashcardVersion): version is VaultVersionView {
  return typeof version === "object" && version !== null;
}

/**
 * Intermediario entre el almacén de notas y `FlashcardsManager`.
 *
 * El escaneo se reparte en lotes pequeños que ceden el hilo entre uno y otro.
 * Con la vista de epochs del vault, además, la carga es incremental: si desde
 * el último escaneo solo cambiaron dos notas, se reescanean únicamente esas
 * dos y el resto de tarjetas se conserva (con 14k notas, reescanear todo por
 * cada tecla era lo que congelaba la aplicación).
 */
export class FlashcardLoader {
  private manager: FlashcardsManager;
  private cache: ScanCache | null = null;
  private task: LoadTask | null = null;
  private generation = 0;
  private hydrate: FlashcardPageHydrator | null;

  constructor(manager: FlashcardsManager, hydrate?: FlashcardPageHydrator) {
    this.manager = manager;
    this.hydrate = hydrate ?? null;
  }

  /**
   * Evalúa la caché contra la versión dada:
   * - `fresh`: la caché sirve todas las tarjetas tal cual.
   * - `partial` (solo modo view): devuelve las notas que deben reescanearse.
   * - `full`: hay que escanear todas las páginas.
   */
  private evaluateCache(pages: PageData[], version: FlashcardVersion) {
    const cache = this.cache;
    if (!cache) return { state: "full" as const, changed: [] as PageData[], cards: null };

    if (!isVersionView(version)) {
      if (cache.version === version && cache.view === null) {
        return { state: "fresh" as const, changed: [] as PageData[], cards: cache.cards };
      }
      return { state: "full" as const, changed: [] as PageData[], cards: null };
    }

    if (cache.view !== version || cache.structural !== version.getStructural()) {
      return { state: "full" as const, changed: [] as PageData[], cards: null };
    }

    const changed: PageData[] = [];
    for (const page of pages) {
      if (cache.epochs.get(page.path) !== version.getPageVersion(page)) changed.push(page);
    }
    // Las notas borradas no invalidan por sí solas: sus buckets se descartan
    // al aplanar (el aplanado solo recorre las páginas actuales).
    if (changed.length === 0) {
      return { state: "fresh" as const, changed, cards: cache.cards };
    }
    return { state: "partial" as const, changed, cards: cache.cards };
  }

  /** Tarjetas completas si la caché corresponde a estas páginas y versión. */
  public getCachedCards(pages: PageData[], version: FlashcardVersion): Flashcard[] | null {
    return this.evaluateCache(pages, version).cards;
  }

  public isFresh(pages: PageData[], version: FlashcardVersion): boolean {
    return this.evaluateCache(pages, version).state === "fresh";
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
        totalPages: this.task.scanPagesList.length,
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
   * Con vista de epochs, si la caché es fresca no se escanea nada y si solo
   * cambiaron algunas notas se reescanean únicamente esas (rescate parcial).
   */
  public load(pages: PageData[], version: FlashcardVersion, options: FlashcardLoadOptions): void {
    const evaluation = this.evaluateCache(pages, version);
    if (evaluation.state === "fresh" && evaluation.cards) {
      this.manager.setDetectedCards(evaluation.cards, options.order, options.preserve);
      const progress = this.getProgress();
      options.onProgress?.(progress);
      options.onDone?.(evaluation.cards);
      return;
    }

    const current = this.task;
    if (current && current.requestPages === pages && current.version === version) {
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

    const fullScan = evaluation.state !== "partial";

    const cache = this.cache;
    // Buckets previos que se conservan: en escaneo completo ninguno; en
    // rescate parcial, todos menos los de las notas a reescanear.
    const baseBuckets = new Map<string, Flashcard[]>();
    const rescanPaths = new Set<string>();
    if (!fullScan) {
      for (const page of evaluation.changed) rescanPaths.add(page.path);
    }
    const currentPaths = new Set(pages.map((page) => page.path));
    if (cache && !fullScan) {
      cache.cardsByPage.forEach((cards, key) => {
        if (currentPaths.has(key) && !rescanPaths.has(key)) baseBuckets.set(key, cards);
      });
    }

    // Semilla (rescate parcial): tarjetas de las notas conservadas, en orden
    // de páginas actual; el manager reordena después con `applyPageFilter`.
    const cards: Flashcard[] = [];
    if (!fullScan) {
      for (const page of pages) {
        if (rescanPaths.has(page.path)) continue;
        for (const card of baseBuckets.get(page.path) ?? []) cards.push(card);
      }
    }

    const progressListeners = new Set<(progress: FlashcardLoadProgress) => void>();
    const doneListeners = new Set<(cards: readonly Flashcard[]) => void>();
    if (options.onProgress) progressListeners.add(options.onProgress);
    if (options.onDone) doneListeners.add(options.onDone);

    const task: LoadTask = {
      requestPages: pages,
      scanPagesList: fullScan ? pages : evaluation.changed,
      baseBuckets: fullScan ? null : baseBuckets,
      scannedBuckets: new Map(),
      version,
      cards,
      scanEpochs: new Map(),
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

    if (task.scanPagesList.length === 0) {
      this.finish(task);
      return;
    }

    this.emitProgress(task);
    this.schedule(task);
  }

  private schedule(task: LoadTask): void {
    // globalThis también funciona en tests y entornos sin `window`.
    task.timer = globalThis.setTimeout(() => void this.processChunk(task.generation), 0);
  }

  private async processChunk(generation: number): Promise<void> {
    const task = this.task;
    if (!task || task.generation !== generation || this.generation !== generation) return;
    task.timer = null;

    const end = Math.min(task.scanPagesList.length, task.nextPage + task.chunkSize);
    let chunk: PageData[] = [];
    if (end > task.nextPage) {
      // Escaneo nota a nota: permite asociar cada tarjeta a su página y por
      // tanto conservar las demás tras un rescate parcial.
      chunk = task.scanPagesList.slice(task.nextPage, end);
    }

    // FASE 4-D: con el boot de metadatos el lote llega sin árboles; los
    // trae el hidratador (streaming: el barrido del LRU descarta notas que
    // este lote ya no necesita) justo antes del scan. La medida del lote
    // (chunkSize) separa el coste de la hidratación del del scan.
    if (chunk.length && chunk.some((page) => page.blocksLoaded === false) && this.hydrate) {
      try {
        await this.hydrate(chunk);
      } catch (error) {
        console.debug("No se pudo hidratar el lote del repaso:", error);
      }
      // La hidratación abre una ventana async: si el task o el generation
      // ya no son los vigentes, este resultado está obsoleto.
      const still = this.task;
      if (!still || still !== task || still.generation !== generation || this.generation !== generation) {
        return;
      }
    }

    const startedAt = performance.now();
    if (chunk.length) {
      for (const page of chunk) {
        const detected = this.manager.scanPages([page]);
        task.scannedBuckets.set(page.path, detected);
        if (isVersionView(task.version)) {
          task.scanEpochs.set(page.path, task.version.getPageVersion(page));
        }
        for (const card of detected) task.cards.push(card);
      }
      task.nextPage = chunk.length ? task.nextPage + chunk.length : task.nextPage;
    }

    const elapsed = performance.now() - startedAt;
    if (elapsed > TARGET_CHUNK_MS * 2) {
      task.chunkSize = Math.max(MIN_CHUNK_SIZE, Math.floor(task.chunkSize / 2));
    } else if (elapsed < TARGET_CHUNK_MS / 2) {
      task.chunkSize = Math.min(MAX_CHUNK_SIZE, task.chunkSize + 4);
    }

    if (task.nextPage >= task.scanPagesList.length) {
      this.finish(task);
      return;
    }

    this.emitProgress(task);
    this.schedule(task);
  }

  private finish(task: LoadTask): void {
    if (this.task !== task) return;
    this.task = null;

    const view = isVersionView(task.version) ? task.version : null;

    // Buckets finales: base (conservados) + recién escaneados (pisan).
    const buckets = new Map(task.baseBuckets ?? []);
    task.scannedBuckets.forEach((cards, key) => buckets.set(key, cards));

    // Aplanar en el orden de las páginas del request: las notas borradas
    // desaparecen solas (sus buckets nadie los consulta), las nuevas entran
    // con su bucket escaneado.
    const cards: Flashcard[] = [];
    for (const page of task.requestPages) {
      for (const card of buckets.get(page.path) ?? []) cards.push(card);
    }

    // Epochs: hereda los capturados por el escaneo anterior (las notas que no
    // se reescanearon conservan su verdad histórica) y los sobreescribe con
    // los capturados en el momento del escaneo de este task. Así, si el
    // usuario edita otra nota mientras corre el rescate, esa nota se detectará
    // como cambiada en la próxima evaluación en lugar de fingir frescura.
    const epochs = new Map(this.cache && task.baseBuckets !== null ? this.cache.epochs : []);
    task.scanEpochs.forEach((value, key) => epochs.set(key, value));

    this.cache = {
      pages: task.requestPages,
      version: view ? null : task.version,
      view,
      structural: view ? view.getStructural() : 0,
      epochs,
      cardsByPage: buckets,
      cards,
    };

    this.manager.setDetectedCards(cards, task.order, task.preserve);

    const progress: FlashcardLoadProgress = {
      scannedPages: task.scanPagesList.length,
      totalPages: task.scanPagesList.length,
      cards: cards.length,
      done: true,
      fromCache: false,
    };
    task.progressListeners.forEach((listener) => listener(progress));
    task.doneListeners.forEach((listener) => listener(cards));
  }

  private emitProgress(task: LoadTask): void {
    const progress: FlashcardLoadProgress = {
      scannedPages: task.nextPage,
      totalPages: task.scanPagesList.length,
      cards: task.cards.length,
      done: false,
      fromCache: false,
    };
    task.progressListeners.forEach((listener) => listener(progress));
  }
}
