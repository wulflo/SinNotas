import { describe, expect, it } from "vitest";
import { needsEditorHydration, shouldRenderEditorOnBoot } from "./boot-invariants";

const last = (view: "editor" | "flashcards" | "pdf") => ({ view, pageId: "p-1" }) as const;

describe("shouldRenderEditorOnBoot", () => {
  it("sin sesión restaurada pinta siempre el editor", () => {
    expect(shouldRenderEditorOnBoot(false, null, false)).toBe(true);
  });

  it("con última vista editor pinta el editor", () => {
    expect(shouldRenderEditorOnBoot(true, last("editor"), false)).toBe(true);
  });

  it("con otra vista no pinta el editor", () => {
    expect(shouldRenderEditorOnBoot(true, last("flashcards"), false)).toBe(false);
  });

  it("solo pinta el editor en PDF si el modo paralelo está activo", () => {
    expect(shouldRenderEditorOnBoot(true, last("pdf"), true)).toBe(true);
    expect(shouldRenderEditorOnBoot(true, last("pdf"), false)).toBe(false);
  });
});

describe("needsEditorHydration", () => {
  it("hidrata solo si va a pintarse el editor, faltan bloques y es Tauri", () => {
    expect(needsEditorHydration(true, false, true)).toBe(true);
    expect(needsEditorHydration(true, false, false)).toBe(false);
    expect(needsEditorHydration(true, true, true)).toBe(false);
    expect(needsEditorHydration(false, false, true)).toBe(false);
  });
});
