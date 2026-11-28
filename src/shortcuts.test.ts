// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
  assignBinding,
  formatShortcut,
  getBinding,
  loadCustomBindings,
  matchesShortcut,
  normalizeShortcutEvent,
  resetBinding,
  validateShortcut,
} from "./shortcuts";

function key(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

describe("normalización de atajos", () => {
  it("usa code y trata Ctrl y Cmd como Mod", () => {
    expect(normalizeShortcutEvent(key({ key: "c", code: "KeyC", ctrlKey: true, shiftKey: true })))
      .toBe("Mod+Shift+C");
    expect(normalizeShortcutEvent(key({ key: "c", code: "KeyC", metaKey: true, shiftKey: true })))
      .toBe("Mod+Shift+C");
  });

  it("normaliza dígitos, barra y espacio", () => {
    expect(normalizeShortcutEvent(key({ key: "1", code: "Digit1", altKey: true }))).toBe("Alt+1");
    expect(normalizeShortcutEvent(key({ key: "/", code: "Slash", ctrlKey: true }))).toBe("Mod+/");
    expect(normalizeShortcutEvent(key({ key: " ", code: "Space", ctrlKey: true }))).toBe("Mod+Space");
  });

  it("rechaza teclas sueltas y modificadores", () => {
    expect(normalizeShortcutEvent(key({ key: "a", code: "KeyA" }))).toBeNull();
    expect(normalizeShortcutEvent(key({ key: "Shift", code: "ShiftLeft", shiftKey: true }))).toBeNull();
  });

  it("acepta teclas sueltas cuando se piden explícitamente", () => {
    expect(normalizeShortcutEvent(key({ key: "Enter", code: "Enter" }), true)).toBe("Enter");
    expect(normalizeShortcutEvent(key({ key: "Tab", code: "Tab", shiftKey: true }), true))
      .toBe("Shift+Tab");
  });

  it("formatea Mod como Ctrl/Cmd y las flechas como símbolos", () => {
    expect(formatShortcut("Mod+Shift+C")).toBe("Ctrl/Cmd+Shift+C");
    expect(formatShortcut("Shift+ArrowUp")).toBe("Shift+↑");
  });
});

describe("asignación de atajos", () => {
  beforeEach(() => localStorage.clear());

  it("devuelve los valores por defecto sin personalizaciones", () => {
    expect(getBinding("createCard")).toBe("Alt+R");
    expect(getBinding("removeCards")).toBe("Alt+T");
    expect(loadCustomBindings()).toEqual({});
  });

  it("detecta un atajo ya usado por otra acción", () => {
    const result = validateShortcut("removeCards", "Alt+R");
    expect(result).toEqual({
      ok: false,
      reason: "duplicate",
      conflictLabel: "Crear tarjeta básica desde la selección",
    });
  });

  it("detecta combinaciones reservadas por otros handlers", () => {
    expect(validateShortcut("createCard", "Mod+V")).toMatchObject({ ok: false, reason: "reserved" });
  });

  it("rechaza combinaciones sin modificador salvo en atajos de una tecla", () => {
    expect(validateShortcut("createCard", null)).toMatchObject({ ok: false, reason: "invalid" });
    expect(validateShortcut("createCard", "Enter")).toMatchObject({ ok: false, reason: "invalid" });
    expect(validateShortcut("newBullet", "Enter")).toEqual({ ok: true });
  });

  it("guarda, aplica y restablece una combinación válida", () => {
    expect(assignBinding("createCard", "Alt+K")).toEqual({ ok: true });
    expect(getBinding("createCard")).toBe("Alt+K");
    expect(matchesShortcut(key({ key: "k", code: "KeyK", altKey: true }), "createCard"))
      .toBe(true);
    expect(matchesShortcut(key({ key: "r", code: "KeyR", altKey: true }), "createCard"))
      .toBe(false);

    resetBinding("createCard");
    expect(getBinding("createCard")).toBe("Alt+R");
    expect(loadCustomBindings()).toEqual({});
  });

  it("no guarda una combinación en conflicto", () => {
    expect(assignBinding("findInNote", "Mod+K")).toMatchObject({ ok: false, reason: "duplicate" });
    expect(getBinding("findInNote")).toBe("Mod+F");
  });
});
