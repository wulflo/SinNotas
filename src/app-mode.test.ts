import { describe, expect, it } from "vitest";
import { isFlashcardsMode, resolveAppMode } from "./app-mode";

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
