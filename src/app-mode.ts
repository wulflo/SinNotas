/**
 * Selección de la experiencia de arranque.
 *
 * La misma base de código se usa para la aplicación completa de escritorio y
 * para la APK Android de repaso. `VITE_APP_MODE=flashcards` fuerza el modo
 * móvil; en compilaciones de Tauri para Android/iOS se detecta también de
 * forma automática mediante `TAURI_ENV_PLATFORM`.
 */
export type AppMode = "desktop" | "flashcards";

export interface AppModeEnvironment {
  configured?: string;
  platform?: string;
  tauri?: boolean;
  userAgent?: string;
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
