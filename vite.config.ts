import { defineConfig } from "vite";

/**
 * Modo de compilación del frontend.
 *
 * - `VITE_APP_MODE=flashcards` genera la experiencia de repaso móvil.
 * - En `tauri android build`/`tauri ios build`, la CLI de Tauri define
 *   `TAURI_ENV_PLATFORM`, así que la APK usa el modo repaso automáticamente.
 * - Cualquier otro valor (o ninguno) conserva la aplicación de escritorio.
 */
function resolveBuildMode(): "desktop" | "flashcards" {
  const configured = (process.env.VITE_APP_MODE || "").trim().toLowerCase();
  if (["flashcards", "flashcard", "review", "repaso", "mobile", "movil", "móvil"].includes(configured)) {
    return "flashcards";
  }
  if (["desktop", "escritorio", "editor", "full", "completo"].includes(configured)) {
    return "desktop";
  }

  const platform = (process.env.TAURI_ENV_PLATFORM || "").trim().toLowerCase();
  if (platform === "android" || platform === "ios") return "flashcards";
  return "desktop";
}

const appMode = resolveBuildMode();

export default defineConfig({
  clearScreen: false,
  // Tauri expone sus variables con este prefijo además de las VITE_*.
  envPrefix: ["VITE_", "TAURI_ENV_"],
  define: {
    __APP_MODE__: JSON.stringify(appMode),
  },
  // El optimizador de dependencias usa por defecto el target legacy de Vite
  // (Safari 14). Los plugins `http` y `fs` incluyen destructuring que esbuild
  // no puede rebajar a ese target y el servidor de desarrollo falla al
  // prebundlearlos. Igualamos el target al de producción (WebView moderno).
  optimizeDeps: {
    esbuildOptions: {
      target: "es2021",
    },
  },
  build: {
    // Android 13+ usa WebView Chromium 108+; ES2021 es seguro y reduce el
    // tamaño del bundle frente a transformaciones legacy.
    target: "es2021",
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/katex")) return "katex";
          if (id.includes("node_modules/dompurify")) return "sanitizer";
          if (id.includes("node_modules/@tauri-apps")) return "tauri-api";
          return undefined;
        },
      },
    },
  },
  css: {
    postcss: {},
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
