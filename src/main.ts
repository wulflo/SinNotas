declare const __APP_MODE__: "desktop" | "flashcards";

import { hideAppSplash } from "./splash";
import {
  installAndroidSafeArea,
  type AndroidSafeAreaWindow,
} from "./mobile/android-safe-area";

/**
 * Punto de entrada único de Sin Notas.
 *
 * La constante `__APP_MODE__` se sustituye en tiempo de compilación. La
 * superficie inicial se combina con las preferencias guardadas para que el
 * usuario pueda alternar en ambos sentidos: escritorio → repaso y repaso →
 * editor completo (incluida la APK Android/iOS).
 *
 * En una compilación de escritorio se conserva la detección en tiempo de
 * ejecución (`VITE_APP_MODE`, plataforma Tauri o user agent móvil) para poder
 * abrir la misma build en un dispositivo móvil.
 */
async function bootstrap(): Promise<void> {
  document.documentElement.dataset.appMode = __APP_MODE__;

  try {
    const {
      readSurfaceRequest,
      resolveAppMode,
      resolveSurfaceMode,
      shouldUseMobileFullEditor,
    } = await import("./app-mode");
    // En la build de escritorio se conserva la detección por plataforma/UA;
    // en la APK el modo de compilación ya es definitivo.
    const platformMode = __APP_MODE__ === "flashcards" ? "flashcards" : resolveAppMode();
    const request = readSurfaceRequest();
    const surfaceMode = resolveSurfaceMode(platformMode, request);
    document.documentElement.dataset.appMode = surfaceMode;

    if (surfaceMode === "desktop") {
      if (shouldUseMobileFullEditor(platformMode, request)) {
        document.body.classList.add("mobile-full-editor");
        // La APK dibuja bajo la barra de estado también en el editor completo.
        // Reaplica las insets nativas al montar esta superficie.
        installAndroidSafeArea(window as unknown as AndroidSafeAreaWindow);
      }
      await import("./desktop");
      return;
    }

    const { mountMobileReviewApp } = await import("./mobile/review-app");
    mountMobileReviewApp();
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
