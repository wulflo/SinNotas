import { describe, expect, it } from "vitest";
import { normalizeRatingKeys } from "./rating-keys";

describe("normalizeRatingKeys", () => {
  it("conserva las teclas válidas por defecto", () => {
    expect(normalizeRatingKeys(["1", "2", "3", "4"])).toEqual(["1", "2", "3", "4"]);
  });

  it("rellena teclas vacías o reservadas sin repetir las demás", () => {
    expect(normalizeRatingKeys(["1", "", "3", " "])).toEqual(["1", "2", "3", "4"]);
  });

  it("deduplica y normaliza mayúsculas", () => {
    expect(normalizeRatingKeys(["a", "A", "b", "c"])).toEqual(["a", "1", "b", "c"]);
  });

  it("acepta menos o más valores devolviendo siempre cuatro teclas", () => {
    expect(normalizeRatingKeys([])).toEqual(["1", "2", "3", "4"]);
    expect(normalizeRatingKeys(["x"])).toEqual(["x", "1", "2", "3"]);
  });
});
