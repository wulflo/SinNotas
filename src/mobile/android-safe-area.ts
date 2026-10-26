/**
 * Insets de Android para WebView anteriores a 140.
 *
 * Esas versiones devuelven `env(safe-area-inset-*)` en `0px` aunque la app se
 * dibuje debajo de las barras. El puente nativo publica los valores reales en
 * `--sinnotas-safe-area-*` y los reaplica cuando cambian, pero el script de
 * inicio de documento puede ejecutarse antes de que Android entregue las
 * primeras insets. Esta llamada vuelve a aplicar el valor guardado al montar la
 * vista de repaso y cuando cambia el viewport.
 */

export interface AndroidSafeAreaBridge {
  getInsets(): string;
}

export interface AndroidSafeAreaWindow {
  SinNotasSafeArea?: AndroidSafeAreaBridge;
  __sinNotasApplySafeArea?: (raw: string) => void;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

/** Aplica las insets actuales del puente nativo, si están disponibles. */
export function applyAndroidSafeArea(win: AndroidSafeAreaWindow): void {
  const bridge = win.SinNotasSafeArea;
  const apply = win.__sinNotasApplySafeArea;
  if (!bridge || typeof apply !== "function") return;

  try {
    apply(bridge.getInsets());
  } catch {
    // El puente todavía puede no estar listo; el listener nativo reintenta.
  }
}

/**
 * Aplica las insets al arrancar y las refresca al rotar o redimensionar.
 * Devuelve una función para retirar los listeners.
 */
export function installAndroidSafeArea(win: AndroidSafeAreaWindow): () => void {
  applyAndroidSafeArea(win);

  if (typeof win.addEventListener !== "function") return () => {};

  const handler = () => applyAndroidSafeArea(win);
  win.addEventListener("resize", handler);
  win.addEventListener("orientationchange", handler);

  return () => {
    win.removeEventListener?.("resize", handler);
    win.removeEventListener?.("orientationchange", handler);
  };
}
