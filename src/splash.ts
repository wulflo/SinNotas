/**
 * Oculta la pantalla de carga una sola vez y con una duración mínima para
 * evitar parpadeos: la app puede terminar de inicializarse antes de que el
 * splash llegue a verse, sobre todo en escritorio.
 */
const MIN_SPLASH_DURATION_MS = 900;
const FADE_OUT_MS = 450;
const splashShownAt = typeof performance !== "undefined" ? performance.now() : Date.now();
let hideRequested = false;

export function hideAppSplash(): void {
  if (hideRequested) return;
  hideRequested = true;

  const splash = document.getElementById("app-splash");
  if (!splash) return;

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const remaining = Math.max(0, MIN_SPLASH_DURATION_MS - (now - splashShownAt));

  window.setTimeout(() => {
    splash.classList.add("is-hidden");
    window.setTimeout(() => splash.remove(), FADE_OUT_MS);
  }, remaining);
}
