import { describe, expect, it } from "vitest";
import {
  DECK_SEPARATOR,
  hasInvalidDeckTitleCharacters,
  normalizeDeckTitle,
  sanitizeDeckTitle,
  splitDeckTitle,
} from "./deck-title";

describe("splitDeckTitle", () => {
  it("mantiene un título sin separador como un único mazo", () => {
    expect(splitDeckTitle("Salud mental")).toEqual(["Salud mental"]);
  });

  it("reconoce el separador anterior :: y varios niveles", () => {
    expect(splitDeckTitle("Salud mental::01::Tema")).toEqual([
      "Salud mental",
      "01",
      "Tema",
    ]);
  });

  it("reconoce la flecha canónica y sus alias de escritura", () => {
    expect(splitDeckTitle("A → B")).toEqual(["A", "B"]);
    expect(splitDeckTitle("A -> B")).toEqual(["A", "B"]);
    expect(splitDeckTitle("A=>B")).toEqual(["A", "B"]);
    expect(splitDeckTitle("A›B»C")).toEqual(["A", "B", "C"]);
  });

  it("ignora separadores repetidos o sin contenido", () => {
    expect(splitDeckTitle("A::::B")).toEqual(["A", "B"]);
    expect(splitDeckTitle(" :: A :: ")).toEqual(["A"]);
  });

  it("no trata un solo dos puntos como separador", () => {
    expect(splitDeckTitle("12:30")).toEqual(["12:30"]);
  });
});

describe("normalizeDeckTitle", () => {
  it("convierte :: en la flecha canónica", () => {
    expect(normalizeDeckTitle("Salud mental::01")).toBe(`Salud mental${DECK_SEPARATOR}01`);
  });

  it("convierte todos los niveles y elimina espacios sobrantes", () => {
    expect(normalizeDeckTitle("  A :: B  ->  C  ")).toBe(
      `A${DECK_SEPARATOR}B${DECK_SEPARATOR}C`
    );
  });

  it("conserva los títulos sin separador", () => {
    expect(normalizeDeckTitle("Una nota normal")).toBe("Una nota normal");
    expect(normalizeDeckTitle("  Una nota  ")).toBe("Una nota");
  });
});

describe("sanitizeDeckTitle", () => {
  it("convierte los separadores y sustituye caracteres prohibidos", () => {
    expect(sanitizeDeckTitle("Salud::01: mañana")).toBe(
      `Salud${DECK_SEPARATOR}01- mañana`
    );
    expect(sanitizeDeckTitle("A/B\\C")).toBe("A-B-C");
  });

  it("elimina segmentos vacíos", () => {
    expect(sanitizeDeckTitle("A::::B")).toBe(`A${DECK_SEPARATOR}B`);
  });
});

describe("hasInvalidDeckTitleCharacters", () => {
  it("detecta caracteres prohibidos en un segmento", () => {
    expect(hasInvalidDeckTitleCharacters(["A", "B"])).toBe(false);
    expect(hasInvalidDeckTitleCharacters(["A", "B:C"])).toBe(true);
    expect(hasInvalidDeckTitleCharacters(["A", "B<C"])).toBe(true);
  });
});
