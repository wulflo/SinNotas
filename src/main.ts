declare const __APP_MODE__: "desktop" | "flashcards";

import { hideAppSplash } from "./splash";

/**
 * Punto de entrada único de Sin Notas.
 *
 * La constante `__APP_MODE__` se sustituye en tiempo de compilación. En una
 * compilación `flashcards` (APK Android/iOS) Rollup elimina por completo la
 * rama de escritorio, de modo que el binario no incluye ni inicializa el
 * editor, diarios, kanban, mapa conceptual o vista de grafo.
 *
 * En una compilación de escritorio se conserva la detección en tiempo de
 * ejecución (`VITE_APP_MODE`, plataforma Tauri o user agent móvil) para poder
 * abrir la misma build en un dispositivo móvil.
 */
async function bootstrap(): Promise<void> {
  document.documentElement.dataset.appMode = __APP_MODE__;

  try {
    if (__APP_MODE__ === "flashcards") {
      const { mountMobileReviewApp } = await import("./mobile/review-app");
      mountMobileReviewApp();
    } else {
      const { isFlashcardsMode, resolveAppMode } = await import("./app-mode");
      const mode = resolveAppMode();
      document.documentElement.dataset.appMode = mode;
      if (isFlashcardsMode(mode)) {
        const { mountMobileReviewApp } = await import("./mobile/review-app");
        mountMobileReviewApp();
        return;
      }

      await import("./desktop");
    }
  } catch (error) {
    console.error("No se pudo iniciar Sin Notas:", error);
    const message = document.createElement("p");
    message.className = "app-boot-error";
    message.textContent =
      "No se pudo iniciar la aplicación. Reinicia Sin Notas o revisa el registro de errores.";
    document.body.replaceChildren(message);
    hideAppSplash();
  }
}

void bootstrap();
