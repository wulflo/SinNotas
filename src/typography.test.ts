import { describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_SIZES,
  FONT_SIZE_DEFINITIONS,
  applyFontSizes,
  clampFontSize,
  fontSizeDefinition,
  mobileFontScale,
  readFontSize,
  readFontSizes,
  resetFontSizes,
  writeFontSize,
  type FontSizeStorage,
} from "./typography";

function memoryStorage(initial: Record<string, string> = {}): FontSizeStorage & {
  values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

describe("typography", () => {
  it("defines distinct defaults for interfaces, editor, titles and flashcards", () => {
    expect(DEFAULT_FONT_SIZES.ui).toBe(15);
    expect(DEFAULT_FONT_SIZES.editor).toBe(15);
    expect(DEFAULT_FONT_SIZES.pageTitle).toBe(32);
    expect(DEFAULT_FONT_SIZES.h1).toBeGreaterThan(DEFAULT_FONT_SIZES.editor);
    // Las tarjetas se expresan como múltiplos de la interfaz (2.4em / 2em).
    expect(DEFAULT_FONT_SIZES.flashcardQuestion).toBe(2.4);
    expect(DEFAULT_FONT_SIZES.flashcardAnswer).toBe(2);
    expect(fontSizeDefinition("flashcardQuestion").unit).toBe("em");
    expect(fontSizeDefinition("ui").unit).toBeUndefined();
    expect(new Set(FONT_SIZE_DEFINITIONS.map((definition) => definition.cssVariable)).size).toBe(
      FONT_SIZE_DEFINITIONS.length
    );
  });

  it("clamps values to each type limits and keeps rounding stable", () => {
    expect(clampFontSize("ui", 99)).toBe(40);
    expect(clampFontSize("ui", 1)).toBe(11);
    expect(clampFontSize("h1", 30.4)).toBe(30);
    expect(clampFontSize("pageTitle", Number.NaN)).toBe(32);
  });

  it("reads defaults when storage is empty, invalid or unavailable", () => {
    const storage = memoryStorage({ "sinnotas-font-size-editor": "no-es-un-numero" });
    expect(readFontSize("editor", storage)).toBe(15);
    expect(readFontSize("ui", null)).toBe(15);
    expect(readFontSizes(storage).h2).toBe(24);
  });

  it("persists clamped values", () => {
    const storage = memoryStorage();
    expect(writeFontSize("flashcardQuestion", 100, storage)).toBe(3);
    expect(storage.values.get("sinnotas-font-size-flashcard-question")).toBe("3");
    expect(readFontSize("flashcardQuestion", storage)).toBe(3);
  });

  it("migrates legacy pixel card sizes to interface multiples", () => {
    const storage = memoryStorage({
      "sinnotas-font-size-flashcard-question": "20",
      "sinnotas-font-size-flashcard-answer": "18",
    });
    expect(readFontSize("flashcardQuestion", storage)).toBe(2.7);
    expect(readFontSize("flashcardAnswer", storage)).toBe(2.4);
  });

  it("migrates legacy interface defaults only once", () => {
    const storage = memoryStorage({
      "sinnotas-font-size-ui": "24",
      "sinnotas-font-size-editor": "18",
    });
    const sizes = readFontSizes(storage);
    expect(sizes.ui).toBe(15);
    expect(sizes.editor).toBe(18);
    expect(storage.values.get("sinnotas-font-defaults-version")).toBe("2");

    // Un valor elegido después de la migración se respeta.
    storage.setItem("sinnotas-font-size-ui", "24");
    expect(readFontSize("ui", storage)).toBe(24);
  });

  it("resets every stored size", () => {
    const storage = memoryStorage({
      "sinnotas-font-size-ui": "17",
      "sinnotas-font-size-h3": "30",
    });
    resetFontSizes(storage);
    expect(storage.values.size).toBe(0);
    expect(readFontSize("ui", storage)).toBe(15);
  });

  it("writes all CSS variables, including defaults for missing keys", () => {
    const properties = new Map<string, string>();
    const target = {
      style: {
        setProperty: (property: string, value: string) => {
          properties.set(property, value);
        },
      },
    };
    applyFontSizes({ ui: 16, h1: 34, flashcardAnswer: 2.2 }, target);
    expect(properties.get("--ls-font-size-ui")).toBe("16px");
    expect(properties.get("--ls-font-size-h1")).toBe("34px");
    expect(properties.get("--ls-flashcard-answer-em")).toBe("2.2");
    expect(properties.get("--ls-font-size-flashcard-answer")).toBeUndefined();
    expect(properties.get("--ls-font-size-editor")).toBe("15px");
    expect(properties.get("--ls-font-size-h6")).toBe("14px");
    expect(Number(properties.get("--ls-font-scale"))).toBeCloseTo(16 / 13);
    expect(properties.get("--mobile-font-scale")).toBe(properties.get("--ls-font-scale"));
  });

  it("maps storage keys to the documented CSS variable names", () => {
    expect(fontSizeDefinition("pageTitle").cssVariable).toBe("--ls-font-size-page-title");
    expect(fontSizeDefinition("flashcardQuestion").storageKey).toBe(
      "sinnotas-font-size-flashcard-question"
    );
    expect(fontSizeDefinition("flashcardQuestion").cssVariable).toBe(
      "--ls-flashcard-question-em"
    );
  });

  it("derives a bounded mobile scale from the interface size", () => {
    expect(mobileFontScale(13)).toBe(1);
    expect(mobileFontScale(15)).toBeCloseTo(15 / 13);
    expect(mobileFontScale(26)).toBe(2);
    expect(mobileFontScale(18)).toBeCloseTo(18 / 13);
    expect(mobileFontScale(100)).toBe(3);
    expect(mobileFontScale(1)).toBe(0.85);
  });
});
