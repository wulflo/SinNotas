import { describe, expect, it, vi } from "vitest";
import {
  applyAndroidSafeArea,
  installAndroidSafeArea,
  type AndroidSafeAreaWindow,
} from "./android-safe-area";

interface FakeWindow {
  win: AndroidSafeAreaWindow;
  apply: ReturnType<typeof vi.fn>;
  listeners: Map<string, () => void>;
}

function createWindow(insets: string): FakeWindow {
  const apply = vi.fn();
  const listeners = new Map<string, () => void>();
  const win: AndroidSafeAreaWindow = {
    SinNotasSafeArea: { getInsets: () => insets },
    __sinNotasApplySafeArea: apply,
    addEventListener: (type, listener) => {
      listeners.set(type, listener);
    },
    removeEventListener: (type, listener) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  return { win, apply, listeners };
}

describe("applyAndroidSafeArea", () => {
  it("aplica las insets del puente nativo", () => {
    const { win, apply } = createWindow('{"top":24,"right":0,"bottom":48,"left":0}');

    applyAndroidSafeArea(win);

    expect(apply).toHaveBeenCalledWith('{"top":24,"right":0,"bottom":48,"left":0}');
  });

  it("no hace nada si el puente no existe (escritorio o WebView moderno)", () => {
    const apply = vi.fn();

    applyAndroidSafeArea({ __sinNotasApplySafeArea: apply });

    expect(apply).not.toHaveBeenCalled();
  });

  it("no propaga errores si el puente todavía no está listo", () => {
    const apply = vi.fn();
    const win: AndroidSafeAreaWindow = {
      SinNotasSafeArea: {
        getInsets: () => {
          throw new Error("puente no disponible");
        },
      },
      __sinNotasApplySafeArea: apply,
    };

    expect(() => applyAndroidSafeArea(win)).not.toThrow();
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("installAndroidSafeArea", () => {
  it("aplica al instalar y al redimensionar u orientar", () => {
    const { win, apply, listeners } = createWindow('{"top":24,"bottom":48}');

    installAndroidSafeArea(win);
    expect(apply).toHaveBeenCalledTimes(1);

    listeners.get("resize")?.();
    listeners.get("orientationchange")?.();
    expect(apply).toHaveBeenCalledTimes(3);
  });

  it("retira los listeners al limpiar", () => {
    const { win, listeners } = createWindow('{"top":24,"bottom":48}');

    const cleanup = installAndroidSafeArea(win);
    expect(listeners.size).toBe(2);

    cleanup();
    expect(listeners.size).toBe(0);
  });

  it("tolera ventanas sin addEventListener", () => {
    const win: AndroidSafeAreaWindow = {
      SinNotasSafeArea: { getInsets: () => '{"top":24}' },
      __sinNotasApplySafeArea: vi.fn(),
    };

    expect(() => installAndroidSafeArea(win)()).not.toThrow();
  });
});
