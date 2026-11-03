import { normalizeDeckTitle } from "../deck-title";

/**
 * Mazos personalizados de flashcards.
 *
 * Un mazo es una selección de notas guardada con un nombre. Las notas siguen
 * siendo la fuente de verdad: el mazo solo guarda títulos y se resuelve contra
 * las notas que existan en la bóveda en cada momento.
 *
 * El archivo vive en `.sinnotas/flashcards/decks.json` y se sincroniza con el
 * vault. El mazo activo NO vive aquí: es una preferencia local del dispositivo.
 */

export const FLASHCARD_DECKS_VERSION = 1;
export const FLASHCARD_DECKS_FILE = ".sinnotas/flashcards/decks.json";
export const FLASHCARD_DECKS_MAX_BYTES = 1024 * 1024;
export const FLASHCARD_DECKS_MAX_COUNT = 200;
export const FLASHCARD_DECK_NAME_MAX_LENGTH = 80;
export const FLASHCARD_DECK_PAGES_MAX = 10_000;
export const FLASHCARD_DECKS_TOMBSTONES_MAX = 500;
export const FLASHCARD_DECKS_LEGACY_DECK_ID = "legacy-selection";

export interface FlashcardDeck {
  id: string;
  name: string;
  /** Títulos exactos de las notas que forman el mazo. */
  pageTitles: string[];
  createdAt: number;
  updatedAt: number;
}

export interface FlashcardDeckTombstone {
  id: string;
  deletedAt: number;
}

export interface FlashcardDeckFile {
  version: typeof FLASHCARD_DECKS_VERSION;
  decks: FlashcardDeck[];
  /** Lápidas para que un borrado no reaparezca al fusionar con otro equipo. */
  tombstones: FlashcardDeckTombstone[];
}

export interface FlashcardDeckValidation {
  name: string;
  error: string | null;
}

export function emptyFlashcardDeckFile(): FlashcardDeckFile {
  return {
    version: FLASHCARD_DECKS_VERSION,
    decks: [],
    tombstones: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeTimestamp(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function safeIdentifier(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return "";
  return trimmed;
}

/** Normaliza el nombre visible: sin espacios sobrantes al principio o final. */
export function normalizeFlashcardDeckName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Recorta el nombre al límite que acepta el archivo. */
function clampFlashcardDeckName(value: string): string {
  return normalizeFlashcardDeckName(value)
    .slice(0, FLASHCARD_DECK_NAME_MAX_LENGTH)
    .trim();
}

/**
 * Clave de comparación de nombres. No distingue mayúsculas, acentos ni
 * espacios repetidos, para que "Examen" y "exámen" no puedan coexistir.
 */
export function flashcardDeckNameKey(value: string): string {
  return normalizeFlashcardDeckName(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

export function generateFlashcardDeckId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Deduplica y limpia la lista de notas de un mazo. */
export function sanitizeFlashcardDeckPageTitles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const title = item.trim();
    if (!title) continue;
    const key = normalizeDeckTitle(title).toLocaleLowerCase("es");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(title);
    if (result.length >= FLASHCARD_DECK_PAGES_MAX) break;
  }
  return result;
}

/**
 * Devuelve un nombre libre. Si ya existe, añade `(2)`, `(3)`…
 * Se usa al importar/fusionar y al crear mazos sin pasar por el formulario.
 */
export function uniqueFlashcardDeckName(
  desired: string,
  decks: readonly FlashcardDeck[],
  ignoreId?: string
): string {
  const base = clampFlashcardDeckName(desired) || "Mazo";
  const used = new Set(
    decks
      .filter((deck) => deck.id !== ignoreId)
      .map((deck) => flashcardDeckNameKey(deck.name))
  );
  if (!used.has(flashcardDeckNameKey(base))) return base;
  let index = 2;
  for (;;) {
    const suffix = ` (${index})`;
    const prefix = base
      .slice(0, Math.max(1, FLASHCARD_DECK_NAME_MAX_LENGTH - suffix.length))
      .trim();
    const candidate = `${prefix}${suffix}`;
    if (!used.has(flashcardDeckNameKey(candidate))) return candidate;
    index += 1;
  }
}

/** Valida el nombre antes de guardarlo. Devuelve `null` si es correcto. */
export function validateFlashcardDeckName(
  name: string,
  decks: readonly FlashcardDeck[],
  ignoreId?: string
): string | null {
  const normalized = normalizeFlashcardDeckName(name);
  if (!normalized) return "El nombre del mazo no puede estar vacío.";
  if (normalized.length > FLASHCARD_DECK_NAME_MAX_LENGTH) {
    return `El nombre no puede superar los ${FLASHCARD_DECK_NAME_MAX_LENGTH} caracteres.`;
  }
  const key = flashcardDeckNameKey(normalized);
  const duplicate = decks.some(
    (deck) => deck.id !== ignoreId && flashcardDeckNameKey(deck.name) === key
  );
  if (duplicate) return "Ya existe un mazo con ese nombre.";
  return null;
}

export function findFlashcardDeck(
  file: FlashcardDeckFile,
  id: string | null | undefined
): FlashcardDeck | null {
  if (!id) return null;
  return file.decks.find((deck) => deck.id === id) ?? null;
}

/** Crea un mazo y lo añade al archivo. Garantiza nombre e id únicos. */
export function addFlashcardDeck(
  file: FlashcardDeckFile,
  name: string,
  pageTitles: readonly string[],
  now = Date.now()
): { file: FlashcardDeckFile; deck: FlashcardDeck } {
  const timestamp = safeTimestamp(now, Date.now());
  const deck: FlashcardDeck = {
    id: uniqueDeckId(file.decks),
    name: uniqueFlashcardDeckName(name, file.decks),
    pageTitles: sanitizeFlashcardDeckPageTitles(pageTitles),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    file: {
      ...file,
      decks: [...file.decks, deck],
    },
    deck,
  };
}

function uniqueDeckId(decks: readonly FlashcardDeck[]): string {
  const used = new Set(decks.map((deck) => deck.id));
  let id = generateFlashcardDeckId();
  while (used.has(id)) id = generateFlashcardDeckId();
  return id;
}

/** Actualiza nombre y/o notas de un mazo existente. */
export function updateFlashcardDeck(
  file: FlashcardDeckFile,
  id: string,
  changes: { name?: string; pageTitles?: readonly string[] },
  now = Date.now()
): FlashcardDeckFile {
  const timestamp = safeTimestamp(now, Date.now());
  let changed = false;
  const decks = file.decks.map((deck) => {
    if (deck.id !== id) return deck;
    changed = true;
    return {
      ...deck,
      name:
        changes.name === undefined
          ? deck.name
          : uniqueFlashcardDeckName(changes.name, file.decks, id),
      pageTitles:
        changes.pageTitles === undefined
          ? deck.pageTitles
          : sanitizeFlashcardDeckPageTitles(changes.pageTitles),
      updatedAt: timestamp,
    };
  });
  return changed ? { ...file, decks } : file;
}

/**
 * Elimina un mazo y deja una lápida. Las notas no se tocan.
 */
export function deleteFlashcardDeck(
  file: FlashcardDeckFile,
  id: string,
  now = Date.now()
): FlashcardDeckFile {
  if (!file.decks.some((deck) => deck.id === id)) return file;
  const timestamp = safeTimestamp(now, Date.now());
  const tombstones = [
    ...file.tombstones.filter((tombstone) => tombstone.id !== id),
    { id, deletedAt: timestamp },
  ]
    .sort((left, right) => right.deletedAt - left.deletedAt)
    .slice(0, FLASHCARD_DECKS_TOMBSTONES_MAX);
  return {
    ...file,
    decks: file.decks.filter((deck) => deck.id !== id),
    tombstones,
  };
}

/**
 * Resuelve las notas de un mazo contra las notas que existen actualmente.
 *
 * Si no se pasa la lista de notas disponibles, devuelve la selección guardada
 * tal cual (útil antes del primer escaneo). Si se pasa, descarta títulos
 * inexistentes y resuelve alias antiguos de separador (`::` → `→`).
 */
export function resolveFlashcardDeckPageTitles(
  deck: FlashcardDeck,
  availableTitles?: readonly string[]
): string[] {
  if (!availableTitles) return sanitizeFlashcardDeckPageTitles(deck.pageTitles);
  const byNormalizedTitle = new Map(
    availableTitles.map((title) => [
      normalizeDeckTitle(title).toLocaleLowerCase("es"),
      title,
    ])
  );
  const result: string[] = [];
  const seen = new Set<string>();
  for (const title of deck.pageTitles) {
    const actual = byNormalizedTitle.get(
      normalizeDeckTitle(title).toLocaleLowerCase("es")
    );
    if (!actual || seen.has(actual)) continue;
    seen.add(actual);
    result.push(actual);
  }
  return result;
}

export function flashcardDeckPageTitlesEqual(
  left: readonly string[],
  right: readonly string[]
): boolean {
  if (left.length !== right.length) return false;
  const leftKeys = left
    .map((title) => normalizeDeckTitle(title).toLocaleLowerCase("es"))
    .sort();
  const rightKeys = right
    .map((title) => normalizeDeckTitle(title).toLocaleLowerCase("es"))
    .sort();
  return leftKeys.every((key, index) => key === rightKeys[index]);
}

/**
 * Conserva en el mazo las notas que siguen existiendo pero ahora mismo no
 * aparecen en el editor (por ejemplo, porque se quedaron sin tarjetas).
 *
 * El editor solo puede mostrar notas con tarjetas; sin esto, guardar el mazo
 * olvidaría esas notas para siempre. Las notas borradas del vault sí se
 * descartan para no acumular fantasmas.
 */
export function mergeFlashcardDeckSelection(
  selected: readonly string[],
  previous: readonly string[],
  existingTitles: readonly string[],
  editableTitles: readonly string[]
): string[] {
  const existingKeys = new Set(
    existingTitles.map((title) => normalizeDeckTitle(title).toLowerCase())
  );
  const editableKeys = new Set(
    editableTitles.map((title) => normalizeDeckTitle(title).toLowerCase())
  );
  const selectedKeys = new Set(
    selected.map((title) => normalizeDeckTitle(title).toLowerCase())
  );
  const result = [...selected];
  for (const title of previous) {
    const key = normalizeDeckTitle(title).toLowerCase();
    if (selectedKeys.has(key) || !existingKeys.has(key)) continue;
    // Si la nota se podía marcar en el editor, su ausencia significa que el
    // usuario la desmarcó; solo se conservan las que no eran editables.
    if (editableKeys.has(key)) continue;
    selectedKeys.add(key);
    result.push(title);
  }
  return sanitizeFlashcardDeckPageTitles(result);
}

function parseTombstones(value: unknown): FlashcardDeckTombstone[] {
  if (!Array.isArray(value)) return [];
  const result: FlashcardDeckTombstone[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = safeIdentifier(item.id);
    if (!id || seen.has(id)) continue;
    const deletedAt = safeTimestamp(item.deletedAt);
    if (deletedAt === 0) continue;
    seen.add(id);
    result.push({ id, deletedAt });
    if (result.length >= FLASHCARD_DECKS_TOMBSTONES_MAX) break;
  }
  return result.sort((left, right) => right.deletedAt - left.deletedAt);
}

function parseDeck(value: unknown): FlashcardDeck | null {
  if (!isRecord(value)) return null;
  const id = safeIdentifier(value.id);
  const name =
    typeof value.name === "string" ? clampFlashcardDeckName(value.name) : "";
  if (!id || !name) return null;
  const createdAt = safeTimestamp(value.createdAt);
  const updatedAt = safeTimestamp(value.updatedAt, createdAt);
  return {
    id,
    name,
    pageTitles: sanitizeFlashcardDeckPageTitles(value.pageTitles),
    createdAt,
    updatedAt,
  };
}

/** Garantiza nombres únicos; el mazo más reciente conserva el nombre original. */
function ensureUniqueDeckNames(decks: readonly FlashcardDeck[]): FlashcardDeck[] {
  const order = [...decks].sort(
    (left, right) =>
      right.updatedAt - left.updatedAt ||
      right.createdAt - left.createdAt ||
      left.id.localeCompare(right.id)
  );
  const used = new Set<string>();
  const named = new Map<string, FlashcardDeck>();
  for (const deck of order) {
    const key = flashcardDeckNameKey(deck.name);
    if (!key) continue;
    let name = deck.name;
    if (used.has(key)) {
      name = uniqueFlashcardDeckName(
        deck.name,
        order.map((candidate) => named.get(candidate.id) ?? candidate).filter(Boolean)
      );
    }
    used.add(flashcardDeckNameKey(name));
    named.set(deck.id, { ...deck, name });
  }
  return order
    .map((deck) => named.get(deck.id))
    .filter((deck): deck is FlashcardDeck => Boolean(deck));
}

/** Quita mazos cuyo borrado es más reciente que su última edición. */
function applyTombstones(
  decks: readonly FlashcardDeck[],
  tombstones: readonly FlashcardDeckTombstone[]
): FlashcardDeck[] {
  if (tombstones.length === 0) return [...decks];
  const deletedAtById = new Map(
    tombstones.map((tombstone) => [tombstone.id, tombstone.deletedAt])
  );
  return decks.filter((deck) => {
    const deletedAt = deletedAtById.get(deck.id);
    return deletedAt === undefined || deck.updatedAt > deletedAt;
  });
}

/** Lee y valida un archivo. Cualquier dato inválido se descarta sin romper. */
export function parseFlashcardDeckFile(
  raw: string | null | undefined
): FlashcardDeckFile {
  if (!raw || raw.length > FLASHCARD_DECKS_MAX_BYTES) {
    return emptyFlashcardDeckFile();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyFlashcardDeckFile();
  }
  if (!isRecord(parsed) || parsed.version !== FLASHCARD_DECKS_VERSION) {
    return emptyFlashcardDeckFile();
  }

  const tombstones = parseTombstones(parsed.tombstones);
  const seenIds = new Set<string>();
  const decks: FlashcardDeck[] = [];
  if (Array.isArray(parsed.decks)) {
    for (const item of parsed.decks) {
      const deck = parseDeck(item);
      if (!deck || seenIds.has(deck.id)) continue;
      seenIds.add(deck.id);
      decks.push(deck);
      if (decks.length >= FLASHCARD_DECKS_MAX_COUNT) break;
    }
  }

  return {
    version: FLASHCARD_DECKS_VERSION,
    decks: ensureUniqueDeckNames(
      applyTombstones(decks, tombstones)
    ).slice(0, FLASHCARD_DECKS_MAX_COUNT),
    tombstones,
  };
}

export function serializeFlashcardDeckFile(file: FlashcardDeckFile): string {
  return JSON.stringify({
    version: FLASHCARD_DECKS_VERSION,
    decks: file.decks.map((deck) => ({
      id: deck.id,
      name: deck.name,
      pageTitles: deck.pageTitles,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
    })),
    tombstones: file.tombstones.map((tombstone) => ({
      id: tombstone.id,
      deletedAt: tombstone.deletedAt,
    })),
  });
}

/**
 * Fusiona dos copias del archivo (por ejemplo, otro dispositivo).
 *
 * - Gana la edición con `updatedAt` más reciente.
 * - Una lápida gana si es igual o posterior a la última edición.
 * - Los nombres duplicados se renombran con sufijo.
 */
export function mergeFlashcardDeckFiles(
  current: FlashcardDeckFile,
  incoming: FlashcardDeckFile
): FlashcardDeckFile {
  const tombstonesById = new Map<string, FlashcardDeckTombstone>();
  for (const tombstone of [...current.tombstones, ...incoming.tombstones]) {
    const existing = tombstonesById.get(tombstone.id);
    if (!existing || tombstone.deletedAt > existing.deletedAt) {
      tombstonesById.set(tombstone.id, tombstone);
    }
  }
  const tombstones = [...tombstonesById.values()]
    .sort((left, right) => right.deletedAt - left.deletedAt)
    .slice(0, FLASHCARD_DECKS_TOMBSTONES_MAX);

  const decksById = new Map<string, FlashcardDeck>();
  for (const deck of [...current.decks, ...incoming.decks]) {
    const existing = decksById.get(deck.id);
    if (!existing || deck.updatedAt >= existing.updatedAt) {
      decksById.set(deck.id, deck);
    }
  }

  return {
    version: FLASHCARD_DECKS_VERSION,
    decks: ensureUniqueDeckNames(
      applyTombstones([...decksById.values()], tombstones)
    ).slice(0, FLASHCARD_DECKS_MAX_COUNT),
    tombstones,
  };
}

/**
 * Migra la selección antigua (`sinnotas-flashcard-pages`) a un mazo.
 *
 * Usa un id fijo para que dos dispositivos que migren a la vez no creen dos
 * mazos distintos: la fusión los unifica.
 */
export function migrateLegacyFlashcardSelection(
  legacyFilter: readonly string[] | null,
  now = Date.now()
): FlashcardDeckFile {
  if (legacyFilter === null) return emptyFlashcardDeckFile();
  const timestamp = safeTimestamp(now, Date.now());
  return {
    version: FLASHCARD_DECKS_VERSION,
    decks: [
      {
        id: FLASHCARD_DECKS_LEGACY_DECK_ID,
        name: "Selección anterior",
        pageTitles: sanitizeFlashcardDeckPageTitles(legacyFilter),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    tombstones: [],
  };
}
