import { describe, expect, it } from "vitest";
import {
  FULL_EDITOR_STORAGE_KEY,
  REVIEW_MODE_STORAGE_KEY,
  isFlashcardsMode,
  readSurfaceRequest,
  requestDesktopEditor,
  requestReviewMode,
  resolveAppMode,
  resolveSurfaceMode,
  shouldUseMobileFullEditor,
  type SurfaceStorage,
} from "./app-mode";

function memoryStorage(initial: Record<string, string> = {}): SurfaceStorage & {
  values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

describe("resolveAppMode", () => {
  it("VITE_APP_MODE=flashcards fuerza el modo repaso", () => {
    expect(resolveAppMode({ configured: "flashcards" })).toBe("flashcards");
    expect(resolveAppMode({ configured: " REVIEW " })).toBe("flashcards");
  });

  it("VITE_APP_MODE=desktop conserva la aplicación completa", () => {
    expect(resolveAppMode({ configured: "desktop", platform: "android" })).toBe("desktop");
  });

  it("detecta Android/iOS mediante TAURI_ENV_PLATFORM", () => {
    expect(resolveAppMode({ platform: "android" })).toBe("flashcards");
    expect(resolveAppMode({ platform: "ios" })).toBe("flashcards");
    expect(resolveAppMode({ platform: "linux" })).toBe("desktop");
  });

  it("detecta Tauri móvil por user agent cuando no hay plataforma", () => {
    expect(
      resolveAppMode({ tauri: true, userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7)" })
    ).toBe("flashcards");
    expect(
      resolveAppMode({ tauri: true, userAgent: "Mozilla/5.0 (X11; Linux x86_64)" })
    ).toBe("desktop");
  });

  it("un valor desconocido no rompe el arranque de escritorio", () => {
    expect(resolveAppMode({ configured: "otro", platform: "windows" })).toBe("desktop");
    expect(isFlashcardsMode("flashcards")).toBe(true);
    expect(isFlashcardsMode("desktop")).toBe(false);
  });
});

describe("surface requests", () => {
  it("permite entrar al repaso desde escritorio y volver al editor", () => {
    const storage = memoryStorage();
    requestReviewMode(storage);
    expect(readSurfaceRequest(storage)).toEqual({ review: true, fullEditor: false });
    expect(resolveSurfaceMode("desktop", readSurfaceRequest(storage))).toBe("flashcards");

    requestDesktopEditor(storage);
    expect(readSurfaceRequest(storage)).toEqual({ review: false, fullEditor: true });
    expect(resolveSurfaceMode("flashcards", readSurfaceRequest(storage))).toBe("desktop");
    expect(shouldUseMobileFullEditor("flashcards", readSurfaceRequest(storage))).toBe(true);
    expect(shouldUseMobileFullEditor("desktop", readSurfaceRequest(storage))).toBe(false);
  });

  it("la APK arranca en repaso salvo que se pida el editor completo", () => {
    const storage = memoryStorage();
    expect(resolveSurfaceMode("flashcards", readSurfaceRequest(storage))).toBe("flashcards");
    storage.setItem(FULL_EDITOR_STORAGE_KEY, "true");
    expect(resolveSurfaceMode("flashcards", readSurfaceRequest(storage))).toBe("desktop");
  });

  it("el editor completo tiene prioridad y las peticiones se escriben de forma atómica", () => {
    const storage = memoryStorage({
      [REVIEW_MODE_STORAGE_KEY]: "true",
      [FULL_EDITOR_STORAGE_KEY]: "true",
    });
    expect(resolveSurfaceMode("desktop", readSurfaceRequest(storage))).toBe("desktop");

    requestReviewMode(storage);
    expect(storage.values.get(REVIEW_MODE_STORAGE_KEY)).toBe("true");
    expect(storage.values.has(FULL_EDITOR_STORAGE_KEY)).toBe(false);
  });
});
