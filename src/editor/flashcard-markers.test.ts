import { describe, expect, it } from "vitest";
import {
  isFlashcardBlockContent,
  removeFlashcardMarkers,
  splitBlockProperties,
} from "./flashcard-markers";

describe("splitBlockProperties", () => {
  it("separa propiedades sin perder el orden ni las líneas de texto", () => {
    expect(splitBlockProperties("Pregunta #card\ncard-s:: 2.5\n  hijo")).toEqual({
      text: "Pregunta #card\n  hijo",
      properties: ["card-s:: 2.5"],
    });
  });
});

describe("isFlashcardBlockContent", () => {
  it("detecta #card, cloze, resaltado, separador y oclusiones", () => {
    expect(isFlashcardBlockContent("Texto #card")).toBe(true);
    expect(isFlashcardBlockContent("Pregunta :: Respuesta")).toBe(true);
    expect(isFlashcardBlockContent("{{c1::Respuesta}}")).toBe(true);
    expect(isFlashcardBlockContent("==Respuesta==")).toBe(true);
    expect(isFlashcardBlockContent("image-occlusions:: []")).toBe(true);
    expect(isFlashcardBlockContent("Texto normal")).toBe(false);
  });
});

describe("removeFlashcardMarkers", () => {
  it("conserva la indentación de los bullets anidados", () => {
    const input = "Pregunta #card\n  - Hijo 1\n  - Hijo 2\ncard-s:: 2.5";
    expect(removeFlashcardMarkers(input)).toBe("Pregunta\n  - Hijo 1\n  - Hijo 2");
  });

  it("no desplaza a la izquierda la última línea con sangría", () => {
    const input = "==Pregunta==\n    respuesta profunda";
    expect(removeFlashcardMarkers(input)).toBe("Pregunta\n    respuesta profunda");
  });

  it("mantiene las líneas en blanco intermedias", () => {
    const input = "{{c1::Pregunta}}\n\n  - Hijo";
    expect(removeFlashcardMarkers(input)).toBe("Pregunta\n\n  - Hijo");
  });

  it("conserva las propiedades que no son de programación", () => {
    const input = "Pregunta #card\ncreated-at:: 2026-01-01\ncard-d:: 5";
    expect(removeFlashcardMarkers(input)).toBe("Pregunta\ncreated-at:: 2026-01-01");
  });

  it("no modifica un bloque sin marcadores", () => {
    expect(removeFlashcardMarkers("Texto sin marcards")).toBe("Texto sin marcards");
  });
});
