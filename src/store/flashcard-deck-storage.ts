import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  FLASHCARD_DECKS_FILE,
  FLASHCARD_DECKS_LEGACY_DECK_ID,
  FLASHCARD_DECKS_MAX_BYTES,
  findFlashcardDeck,
  mergeFlashcardDeckFiles,
  migrateLegacyFlashcardSelection,
  parseFlashcardDeckFile,
  serializeFlashcardDeckFile,
  type FlashcardDeckFile,
} from "./flashcard-decks";

const WEB_DECKS_STORAGE_PREFIX = "sinnotas-flashcard-decks-v1";
const ACTIVE_DECK_STORAGE_PREFIX = "sinnotas-flashcard-active-deck-v1";

function normalizedVaultKey(rootPath: string | null | undefined): string {
  const value = (rootPath ?? "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return value || "local";
}

function webDecksStorageKey(rootPath: string | null | undefined): string {
  return `${WEB_DECKS_STORAGE_PREFIX}:${normalizedVaultKey(rootPath)}`;
}

function activeDeckStorageKey(rootPath: string | null | undefined): string {
  return `${ACTIVE_DECK_STORAGE_PREFIX}:${normalizedVaultKey(rootPath)}`;
}

function safeGetItem(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // El mazo activo es una preferencia local: si el WebView no permite
    // persistirla, la sesión sigue funcionando hasta cerrar la app.
  }
}

function safeRemoveItem(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Igual que en `safeSetItem`: no debe romper la sesión.
  }
}

function utf8Size(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return value.length * 3;
}

export interface LoadedFlashcardDecks {
  file: FlashcardDeckFile;
  activeDeckId: string | null;
}

/**
 * Acceso al archivo de mazos del vault.
 *
 * En Tauri se usa el backend (ruta interna fija, escritura atómica y soporte
 * SAF de Android). En modo web se simula con `localStorage` para que la demo
 * y las pruebas sigan funcionando.
 */
export class FlashcardDeckRepository {
  public async load(rootPath: string | null): Promise<FlashcardDeckFile> {
    let raw: string | null = null;
    if (isTauri()) {
      raw = await invoke<string | null>("read_flashcard_decks");
    } else {
      raw = safeGetItem(webDecksStorageKey(rootPath));
    }
    return parseFlashcardDeckFile(raw);
  }

  /**
   * Guarda fusionando con la copia que hay ahora en el vault. Se relee siempre
   * para no pisar cambios que otro dispositivo haya sincronizado mientras esta
   * sesión tenía una copia antigua en memoria.
   */
  public async save(
    rootPath: string | null,
    file: FlashcardDeckFile
  ): Promise<FlashcardDeckFile> {
    const current = await this.load(rootPath);
    const merged = mergeFlashcardDeckFiles(current, file);
    const serialized = serializeFlashcardDeckFile(merged);
    if (utf8Size(serialized) > FLASHCARD_DECKS_MAX_BYTES) {
      throw new Error("El archivo de mazos supera el límite permitido.");
    }

    if (isTauri()) {
      await invoke("write_flashcard_decks", { contents: serialized });
    } else {
      const key = webDecksStorageKey(rootPath);
      try {
        globalThis.localStorage?.setItem(key, serialized);
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? `No se pudieron guardar los mazos: ${error.message}`
            : "No se pudieron guardar los mazos."
        );
      }
    }

    return merged;
  }

  public getActiveDeckId(rootPath: string | null): string | null {
    const value = safeGetItem(activeDeckStorageKey(rootPath));
    return value && value.trim() ? value.trim() : null;
  }

  public setActiveDeckId(rootPath: string | null, deckId: string | null): void {
    const key = activeDeckStorageKey(rootPath);
    if (deckId) safeSetItem(key, deckId);
    else safeRemoveItem(key);
  }

  /** Devuelve el id activo solo si el mazo sigue existiendo. */
  public resolveActiveDeckId(
    rootPath: string | null,
    file: FlashcardDeckFile
  ): string | null {
    const stored = this.getActiveDeckId(rootPath);
    if (!stored) return null;
    if (findFlashcardDeck(file, stored)) return stored;
    this.setActiveDeckId(rootPath, null);
    return null;
  }

  /**
   * Carga el archivo y, si está vacío, migra la selección antigua del
   * dispositivo. La migración usa un id fijo para que dos equipos que la
   * hagan a la vez acaben en el mismo mazo al fusionar.
   */
  public async loadWithMigration(
    rootPath: string | null,
    legacyFilter: readonly string[] | null
  ): Promise<LoadedFlashcardDecks> {
    let file = await this.load(rootPath);
    const shouldMigrate =
      legacyFilter !== null &&
      file.decks.length === 0 &&
      file.tombstones.length === 0;
    if (shouldMigrate) {
      file = await this.save(
        rootPath,
        migrateLegacyFlashcardSelection(legacyFilter)
      );
      if (findFlashcardDeck(file, FLASHCARD_DECKS_LEGACY_DECK_ID)) {
        this.setActiveDeckId(rootPath, FLASHCARD_DECKS_LEGACY_DECK_ID);
      }
    }
    return {
      file,
      activeDeckId: this.resolveActiveDeckId(rootPath, file),
    };
  }
}

/** Ruta interna usada por el backend; se exporta solo para diagnóstico/tests. */
export const FLASHCARD_DECKS_INTERNAL_PATH = FLASHCARD_DECKS_FILE;
