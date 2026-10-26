/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `flashcards` monta únicamente la vista de repaso (APK Android). */
  readonly VITE_APP_MODE?: string;
  /** Plataforma de destino expuesta por la CLI de Tauri durante la compilación. */
  readonly TAURI_ENV_PLATFORM?: string;
  readonly TAURI_ENV_ARCH?: string;
  readonly TAURI_ENV_TARGET_TRIPLE?: string;
  readonly TAURI_ENV_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
