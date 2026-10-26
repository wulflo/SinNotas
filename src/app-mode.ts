/**
 * Selección de la experiencia de arranque.
 *
 * La misma base de código se usa para la aplicación completa de escritorio y
 * para la APK Android de repaso. `VITE_APP_MODE=flashcards` establece el modo
 * móvil (salvo que se solicite el editor completo); en compilaciones de Tauri
 * para Android/iOS se detecta también mediante `TAURI_ENV_PLATFORM`.
 */
export type AppMode = "desktop" | "flashcards";

export interface AppModeEnvironment {
  configured?: string;
  platform?: string;
  tauri?: boolean;
  userAgent?: string;
}

/**
 * Preferencias de superficie compartidas por escritorio y la APK.
 *
 * `review` fuerza el modo repaso incluso en una compilación de escritorio.
 * `fullEditor` fuerza el editor completo en la APK. Las dos se escriben de
 * forma atómica para que el cambio sea reversible en cualquier dirección.
 */
export const REVIEW_MODE_STORAGE_KEY = "sinnotas-review-mode";
export const FULL_EDITOR_STORAGE_KEY = "sinnotas-mobile-full-mode";

export interface SurfaceRequest {
  review: boolean;
  fullEditor: boolean;
}

export interface SurfaceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultSurfaceStorage(): SurfaceStorage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function readSurfaceRequest(
  storage: SurfaceStorage | null = defaultSurfaceStorage()
): SurfaceRequest {
  if (!storage) return { review: false, fullEditor: false };
  try {
    return {
      review: storage.getItem(REVIEW_MODE_STORAGE_KEY) === "true",
      fullEditor: storage.getItem(FULL_EDITOR_STORAGE_KEY) === "true",
    };
  } catch {
    return { review: false, fullEditor: false };
  }
}

function writeSurfaceRequest(request: SurfaceRequest, storage: SurfaceStorage | null): void {
  if (!storage) return;
  try {
    if (request.review) storage.setItem(REVIEW_MODE_STORAGE_KEY, "true");
    else storage.removeItem(REVIEW_MODE_STORAGE_KEY);
    if (request.fullEditor) storage.setItem(FULL_EDITOR_STORAGE_KEY, "true");
    else storage.removeItem(FULL_EDITOR_STORAGE_KEY);
  } catch {
    // La navegación entre superficies no debe bloquearse por el almacenamiento.
  }
}

/** Solicita el modo repaso (también desde una build de escritorio). */
export function requestReviewMode(
  storage: SurfaceStorage | null = defaultSurfaceStorage()
): void {
  writeSurfaceRequest({ review: true, fullEditor: false }, storage);
}

/** Solicita el editor completo (también desde la APK de repaso). */
export function requestDesktopEditor(
  storage: SurfaceStorage | null = defaultSurfaceStorage()
): void {
  writeSurfaceRequest({ review: false, fullEditor: true }, storage);
}

/**
 * Resuelve la superficie final combinando el modo de compilación/plataforma
 * con las preferencias guardadas. El editor completo gana para que una APK
 * pueda abrir la experiencia de escritorio; en su ausencia, una build de
 * repaso o una petición explícita abren la vista móvil.
 */
export function resolveSurfaceMode(compileMode: AppMode, request: SurfaceRequest): AppMode {
  if (request.fullEditor) return "desktop";
  if (compileMode === "flashcards" || request.review) return "flashcards";
  return "desktop";
}

/** El estilo de editor móvil solo corresponde a builds/plataformas de repaso. */
export function shouldUseMobileFullEditor(
  compileMode: AppMode,
  request: SurfaceRequest
): boolean {
  return request.fullEditor && compileMode === "flashcards";
}

const FLASHCARDS_ALIASES = new Set(["flashcards", "flashcard", "review", "repaso", "mobile", "movil", "móvil"]);
const DESKTOP_ALIASES = new Set(["desktop", "escritorio", "editor", "full", "completo"]);

function readEnvironment(): AppModeEnvironment {
  const globals = globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown };
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const meta = import.meta.env as ImportMetaEnv | undefined;
  return {
    configured: meta?.VITE_APP_MODE,
    platform: meta?.TAURI_ENV_PLATFORM,
    tauri: typeof globals.__TAURI_INTERNALS__ !== "undefined",
    userAgent: nav?.userAgent,
  };
}

/**
 * Decide qué interfaz montar. La variable explícita tiene prioridad para
 * permitir demos web y compilaciones de escritorio en modo repaso.
 */
export function resolveAppMode(environment: AppModeEnvironment = readEnvironment()): AppMode {
  const configured = (environment.configured || "").trim().toLowerCase();
  if (FLASHCARDS_ALIASES.has(configured)) return "flashcards";
  if (DESKTOP_ALIASES.has(configured)) return "desktop";

  const platform = (environment.platform || "").trim().toLowerCase();
  if (platform === "android" || platform === "ios") return "flashcards";

  const userAgent = environment.userAgent || "";
  if (environment.tauri && /android|iphone|ipad|ipod|mobile/i.test(userAgent)) {
    return "flashcards";
  }

  return "desktop";
}

export function isFlashcardsMode(mode: AppMode): boolean {
  return mode === "flashcards";
}
