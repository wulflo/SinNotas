import { invoke, isTauri } from "@tauri-apps/api/core";
import type { FSRSRating } from "../editor/fsrs";
import type { FlashcardType } from "../types";
import type { CardScheduleSnapshot } from "../views/flashcards-manager";

/**
 * Diario de repasos compartido por escritorio y Android.
 *
 * Vive en `.sinnotas/progress/reviews.json` dentro de la bóveda (nunca en
 * localStorage, salvo el modo web de demostración). Así el historial de repasos
 * viaja con las notas cuando el usuario cambia de equipo. El archivo no
 * contiene el texto de las tarjetas: solo identidad estable, valoración y las
 * propiedades FSRS anteriores/posteriores necesarias para deshacer o rehacer.
 */

export type ReviewProgressState = "applied" | "undone";

export interface ReviewProgressEvent {
  /** Identificador único e inmutable del repaso. */
  id: string;
  /** Instante ISO del repaso. */
  at: string;
  /** Fecha local YYYY-MM-DD usada para el reinicio diario. */
  date: string;
  /** Dispositivo que originó el repaso (solo diagnóstico). */
  deviceId: string;
  /** Última modificación (para resolver ediciones concurrentes del mismo id). */
  updatedAt: string;
  state: ReviewProgressState;
  pagePath: string;
  pageTitle: string;
  blockId: string;
  cardId: string;
  cardType: FlashcardType;
  /** Huella del texto de la tarjeta sin FSRS; permite localizarla aunque
   *  cambie el id de bloque (`b-N`) al recargar la nota. */
  cardFingerprint?: string;
  rating: FSRSRating;
  before: CardScheduleSnapshot;
  after: CardScheduleSnapshot;
}

export interface ReviewProgressFile {
  version: 1;
  entries: ReviewProgressEvent[];
}

interface ReviewProgressInput {
  pagePath: string;
  pageTitle: string;
  blockId: string;
  cardId: string;
  cardType: FlashcardType;
  cardFingerprint?: string;
  rating: FSRSRating;
  before: CardScheduleSnapshot;
  after: CardScheduleSnapshot;
  at?: string;
}

const PROGRESS_STORAGE_KEY = "sinnotas-review-progress-v1";
const DEVICE_ID_STORAGE_KEY = "sinnotas-review-device-id";
const MAX_ENTRIES = 4000;
/** Deja margen frente al límite de 5 MB del backend. */
const MAX_FILE_BYTES = 4_500_000;
/** El diario compartido no conserva repasos de hace más de un año. */
const MAX_AGE_DAYS = 365;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const MAX_TEXT_LENGTH = 4096;

function emptyFile(): ReviewProgressFile {
  return { version: 1, entries: [] };
}

function utf8Size(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return value.length * 3;
}

/** Descarta repasos que ya no aportan al historial de deshacer/rehacer. */
function pruneExpiredEntries(
  entries: ReviewProgressEvent[],
  now = Date.now()
): ReviewProgressEvent[] {
  const cutoff = now - MAX_AGE_MS;
  return entries.filter((entry) => {
    const at = Date.parse(entry.at);
    return Number.isFinite(at) && at >= cutoff;
  });
}

/**
 * Ordena, limita el número de repasos y recorta los más antiguos si el JSON
 * supera el tamaño que acepta el backend. Así una bóveda con títulos o rutas
 * enormes no puede dejar el diario en un estado que nunca se pueda guardar.
 */
function limitProgressFile(
  entries: ReviewProgressEvent[],
  now = Date.now()
): ReviewProgressFile {
  let limited = pruneExpiredEntries(entries, now)
    .sort((left, right) => left.at.localeCompare(right.at))
    .slice(-MAX_ENTRIES);
  let serialized = JSON.stringify({ version: 1, entries: limited });
  while (limited.length > 1 && utf8Size(serialized) > MAX_FILE_BYTES) {
    limited = limited.slice(Math.max(1, Math.ceil(limited.length * 0.05)));
    serialized = JSON.stringify({ version: 1, entries: limited });
  }
  if (utf8Size(serialized) > MAX_FILE_BYTES) return emptyFile();
  return { version: 1, entries: limited };
}

function localDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`;
}

function safeString(value: unknown, maxLength = MAX_TEXT_LENGTH): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) return null;
  return value;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sanitizeSnapshot(value: unknown): CardScheduleSnapshot {
  if (!value || typeof value !== "object") return {};
  const candidate = value as Record<string, unknown>;
  const snapshot: CardScheduleSnapshot = {};
  const stability = safeNumber(candidate.stability);
  const difficulty = safeNumber(candidate.difficulty);
  const stabilityFast = safeNumber(candidate.stabilityFast);
  const reps = safeNumber(candidate.reps);
  const lapses = safeNumber(candidate.lapses);
  const intervalDays = safeNumber(candidate.intervalDays);
  const easeFactor = safeNumber(candidate.easeFactor);
  const state = safeNumber(candidate.state);
  const learningStep = safeNumber(candidate.learningStep);
  const lastReviewDate = safeString(candidate.lastReviewDate, 128);
  const dueDate = safeString(candidate.dueDate, 128);

  if (stability !== undefined && stability > 0) snapshot.stability = stability;
  if (difficulty !== undefined && difficulty >= 1 && difficulty <= 10) {
    snapshot.difficulty = difficulty;
  }
  // FSRS-7 puede producir un rastro rápido negativo. El motor ya lo trata como
  // ausente al calcular, pero conservarlo evita que una instantánea leída del
  // diario deje de coincidir con la tarjeta y bloquee el deshacer.
  if (stabilityFast !== undefined) {
    snapshot.stabilityFast = stabilityFast;
  }
  if (reps !== undefined) snapshot.reps = Math.max(0, Math.floor(reps));
  if (lapses !== undefined) snapshot.lapses = Math.max(0, Math.floor(lapses));
  if (intervalDays !== undefined) snapshot.intervalDays = Math.max(0, intervalDays);
  if (easeFactor !== undefined) snapshot.easeFactor = Math.max(1, easeFactor);
  if (state !== undefined && Number.isInteger(state) && state >= 0 && state <= 3) {
    snapshot.state = state as 0 | 1 | 2 | 3;
  }
  if (learningStep !== undefined) snapshot.learningStep = Math.max(0, Math.floor(learningStep));
  if (lastReviewDate) snapshot.lastReviewDate = lastReviewDate;
  if (dueDate) snapshot.dueDate = dueDate;
  return snapshot;
}

/**
 * Copia fiel de una instantánea recién leída de una nota.
 *
 * `sanitizeSnapshot` valida datos que vienen de un archivo compartido y por eso
 * descarta valores fuera de rango. Aquí, en cambio, los valores acaban de
 * leerlos `readScheduleSnapshot` del Markdown; si se descarta uno, `event.after`
 * deja de coincidir con la tarjeta y deshacer muestra un falso conflicto.
 */
function copySnapshot(value: CardScheduleSnapshot): CardScheduleSnapshot {
  const copy: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (typeof fieldValue === "number" && Number.isFinite(fieldValue)) {
      copy[key] = fieldValue;
    } else if (typeof fieldValue === "string" && fieldValue.length > 0) {
      copy[key] = fieldValue;
    }
  }
  return copy as CardScheduleSnapshot;
}

function sanitizeEvent(value: unknown): ReviewProgressEvent | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const id = safeString(candidate.id, 128);
  const at = safeString(candidate.at, 64);
  const date = safeString(candidate.date, 16);
  const deviceId = safeString(candidate.deviceId, 128);
  const updatedAt = safeString(candidate.updatedAt, 64);
  const pagePath = safeString(candidate.pagePath);
  const pageTitle = safeString(candidate.pageTitle, 512);
  const blockId = safeString(candidate.blockId, 512);
  const cardId = safeString(candidate.cardId, 512);
  const cardFingerprint = safeString(candidate.cardFingerprint, 64) ?? undefined;
  const cardType = candidate.cardType;
  const rating = candidate.rating;
  const state = candidate.state;
  if (
    !id ||
    !at ||
    !date ||
    !deviceId ||
    !updatedAt ||
    !pagePath ||
    !pageTitle ||
    !blockId ||
    !cardId ||
    (cardType !== "basic" && cardType !== "cloze" && cardType !== "image-occlusion") ||
    (rating !== 1 && rating !== 2 && rating !== 3 && rating !== 4) ||
    (state !== "applied" && state !== "undone") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(at)) ||
    Number.isNaN(Date.parse(updatedAt)) ||
    pagePath.includes("\0") ||
    pagePath.split(/[\\/]/).includes("..")
  ) {
    return null;
  }

  return {
    id,
    at,
    date,
    deviceId,
    updatedAt,
    state,
    pagePath,
    pageTitle,
    blockId,
    cardId,
    cardType,
    ...(cardFingerprint ? { cardFingerprint } : {}),
    rating,
    before: sanitizeSnapshot(candidate.before),
    after: sanitizeSnapshot(candidate.after),
  };
}

/**
 * Lee y valida el archivo. Un JSON corrupto o manipulad se trata como vacío;
 * nunca se lanza una excepción durante el arranque.
 */
export function parseReviewProgress(raw: string | null | undefined): ReviewProgressFile {
  if (!raw) return emptyFile();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyFile();
    const entriesValue = (parsed as { entries?: unknown }).entries;
    if (!Array.isArray(entriesValue)) return emptyFile();
    const byId = new Map<string, ReviewProgressEvent>();
    entriesValue.forEach((value) => {
      const event = sanitizeEvent(value);
      if (!event) return;
      const existing = byId.get(event.id);
      if (!existing || event.updatedAt > existing.updatedAt) byId.set(event.id, event);
    });
    return limitProgressFile([...byId.values()]);
  } catch {
    return emptyFile();
  }
}

/**
 * Une dos copias del diario. Los ids son inmutables y, para el mismo repaso,
 * gana la actualización más reciente; así deshacer en un equipo no se pierde
 * cuando otro guarda su propia copia.
 */
export function mergeReviewProgress(
  current: ReviewProgressFile,
  incoming: ReviewProgressFile
): ReviewProgressFile {
  const byId = new Map<string, ReviewProgressEvent>();
  for (const event of [...current.entries, ...incoming.entries]) {
    const existing = byId.get(event.id);
    if (!existing || event.updatedAt >= existing.updatedAt) byId.set(event.id, event);
  }
  return limitProgressFile([...byId.values()]);
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function readDeviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (stored && stored.length <= 128) return stored;
    const generated = randomId();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return "device-local";
  }
}

export class ReviewProgressStore {
  private file: ReviewProgressFile = emptyFile();
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private undoStack: ReviewProgressEvent[] = [];
  private redoStack: ReviewProgressEvent[] = [];
  private readonly deviceId = readDeviceId();

  public async load(force = false): Promise<void> {
    if (this.loadPromise) {
      await this.loadPromise;
      if (!force) return;
    }
    if (this.loaded && !force) return;

    const task = (async () => {
      let raw: string | null = null;
      let readOk = false;
      try {
        if (isTauri()) {
          raw = await invoke<string | null>("read_review_progress");
        } else {
          raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
        }
        readOk = true;
      } catch (error) {
        console.warn("No se pudo leer el diario de repasos; se conservará el historial de la sesión.", error);
      }

      if (readOk) {
        const parsed = parseReviewProgress(raw);
        if (force) {
          this.file = parsed;
        } else {
          this.file = mergeReviewProgress(this.file, parsed);
        }
      }
      this.rebuildStacks();
      this.loaded = true;
    })();

    this.loadPromise = task;
    try {
      await task;
    } finally {
      if (this.loadPromise === task) this.loadPromise = null;
    }
  }

  /**
   * Reconstruye las pilas de esta sesión a partir del diario. Se limita a los
   * repasos hechos por este mismo dispositivo para no deshacer por accidente
   * el trabajo de otro equipo que comparte la bóveda.
   */
  private rebuildStacks(): void {
    const mine = this.file.entries
      .filter((event) => event.deviceId === this.deviceId)
      .sort((left, right) => left.at.localeCompare(right.at));
    this.undoStack = mine.filter((event) => event.state === "applied").slice(-100);
    const latestAppliedAt = this.undoStack.length > 0
      ? this.undoStack[this.undoStack.length - 1].at
      : "";
    this.redoStack = mine
      .filter((event) => event.state === "undone" && event.at > latestAppliedAt)
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
      .slice(-100);
  }

  /**
   * Borra todo el diario de repasos, incluidas las copias de otros dispositivos.
   * Es una acción destructiva explícita: no se puede deshacer.
   */
  public async clear(): Promise<void> {
    if (isTauri()) {
      await invoke("clear_review_progress");
    } else {
      localStorage.removeItem(PROGRESS_STORAGE_KEY);
    }
    this.file = emptyFile();
    this.undoStack = [];
    this.redoStack = [];
    this.loaded = true;
  }

  public async record(input: ReviewProgressInput): Promise<ReviewProgressEvent> {
    await this.load();
    const now = new Date();
    const at = input.at && !Number.isNaN(Date.parse(input.at))
      ? new Date(input.at).toISOString()
      : now.toISOString();
    const event: ReviewProgressEvent = {
      id: randomId(),
      at,
      date: localDate(input.at ? new Date(input.at) : now),
      deviceId: this.deviceId,
      updatedAt: at,
      state: "applied",
      pagePath: input.pagePath,
      pageTitle: input.pageTitle,
      blockId: input.blockId,
      cardId: input.cardId,
      cardType: input.cardType,
      ...(input.cardFingerprint ? { cardFingerprint: input.cardFingerprint } : {}),
      rating: input.rating,
      before: copySnapshot(input.before),
      after: copySnapshot(input.after),
    };
    this.file = mergeReviewProgress(this.file, { version: 1, entries: [event] });
    this.undoStack.push(event);
    this.redoStack = [];
    try {
      await this.persist();
    } catch (error) {
      // Si falla la escritura (Tauri o localStorage), deshacemos también el
      // evento en memoria: los llamadores de desktop/review ya revierten la
      // tarjeta al recibir el error y no debe quedar un repaso "fantasma".
      this.file = { ...this.file, entries: this.file.entries.filter((item) => item.id !== event.id) };
      this.undoStack = this.undoStack.filter((item) => item.id !== event.id);
      throw error;
    }
    return event;
  }

  /** Saca el repaso más reciente aplicado. Si la escritura falla, el llamador
   * debe devolverlo con `restoreUndo`. */
  public takeUndo(): ReviewProgressEvent | null {
    while (this.undoStack.length > 0) {
      // `record()` es asíncrono: con varias calificaciones seguidas los
      // eventos pueden entrar en la pila en orden de finalización de guardado,
      // no de repaso. Deshacer debe seguir el orden real de las tarjetas.
      let latestIndex = 0;
      for (let index = 1; index < this.undoStack.length; index += 1) {
        if (this.undoStack[index].at > this.undoStack[latestIndex].at) latestIndex = index;
      }
      const [event] = this.undoStack.splice(latestIndex, 1);
      const current = this.currentEvent(event.id);
      if (current?.state === "applied") return current;
    }
    return null;
  }

  public restoreUndo(event: ReviewProgressEvent): void {
    this.undoStack.push(event);
  }

  public async commitUndo(event: ReviewProgressEvent): Promise<void> {
    const current = this.currentEvent(event.id) ?? event;
    const previousState = current.state;
    const previousUpdatedAt = current.updatedAt;
    const previousRedoLength = this.redoStack.length;
    current.state = "undone";
    current.updatedAt = new Date().toISOString();
    this.redoStack.push(current);
    try {
      await this.persist();
    } catch (error) {
      current.state = previousState;
      current.updatedAt = previousUpdatedAt;
      this.redoStack.length = previousRedoLength;
      throw error;
    }
  }

  public takeRedo(): ReviewProgressEvent | null {
    while (this.redoStack.length > 0) {
      let latestIndex = 0;
      for (let index = 1; index < this.redoStack.length; index += 1) {
        if (this.redoStack[index].updatedAt > this.redoStack[latestIndex].updatedAt) {
          latestIndex = index;
        }
      }
      const [event] = this.redoStack.splice(latestIndex, 1);
      const current = this.currentEvent(event.id);
      if (current?.state === "undone") return current;
    }
    return null;
  }

  public restoreRedo(event: ReviewProgressEvent): void {
    this.redoStack.push(event);
  }

  public async commitRedo(event: ReviewProgressEvent): Promise<void> {
    const current = this.currentEvent(event.id) ?? event;
    const previousState = current.state;
    const previousUpdatedAt = current.updatedAt;
    const previousUndoLength = this.undoStack.length;
    current.state = "applied";
    current.updatedAt = new Date().toISOString();
    this.undoStack.push(current);
    try {
      await this.persist();
    } catch (error) {
      current.state = previousState;
      current.updatedAt = previousUpdatedAt;
      this.undoStack.length = previousUndoLength;
      throw error;
    }
  }

  public canUndo(): boolean {
    return this.undoStack.some((event) => this.currentEvent(event.id)?.state === "applied");
  }

  public canRedo(): boolean {
    return this.redoStack.some((event) => this.currentEvent(event.id)?.state === "undone");
  }

  private currentEvent(id: string): ReviewProgressEvent | undefined {
    return this.file.entries.find((event) => event.id === id);
  }

  /** Estadísticas derivadas del diario compartido. */
  public getStats(today: string): { totalReviews: number; reviewsToday: number } {
    let totalReviews = 0;
    let reviewsToday = 0;
    for (const event of this.file.entries) {
      if (event.state !== "applied") continue;
      totalReviews += 1;
      if (event.date === today) reviewsToday += 1;
    }
    return { totalReviews, reviewsToday };
  }

  public getEntries(): readonly ReviewProgressEvent[] {
    return this.file.entries;
  }

  private async persist(): Promise<void> {
    const payload = limitProgressFile(this.file.entries);
    this.file = payload;

    try {
      if (isTauri()) {
        const merged = await invoke<string>("write_review_progress", {
          contents: JSON.stringify(payload),
        });
        this.file = mergeReviewProgress(this.file, parseReviewProgress(merged));
      } else {
        const existing = parseReviewProgress(localStorage.getItem(PROGRESS_STORAGE_KEY));
        this.file = mergeReviewProgress(existing, payload);
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(this.file));
      }
    } catch (error) {
      console.error("No se pudo guardar el diario de repasos en .sinnotas/progress/reviews.json:", error);
      // Propagar: los catch() de desktop.ts y review-app.ts revierten la
      // tarjeta y avisan al usuario. Tragar el error hacía que la UI aparentara
      // guardar el repaso aunque reviews.json no se hubiera escrito.
      throw error;
    }
  }
}
