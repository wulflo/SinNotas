import { describe, expect, it } from "vitest";
import {
  detectLookupMode,
  isAllowedLookupCoverUrl,
  isAllowedLookupUrl,
  isbn10Valid,
  isbn13Valid,
  lookupErrorCode,
  lookupErrorMessage,
  lookupResultToInput,
  normalizeDoi,
  normalizeIsbn,
  sanitizeLookupQuery,
  sanitizeLookupText,
  type BibliographyLookupResult,
} from "./bibliography-lookup";

function result(overrides: Partial<BibliographyLookupResult> = {}): BibliographyLookupResult {
  return {
    provider: "openlibrary",
    kind: "book",
    title: "Deep Work",
    subtitle: "",
    authors: "Cal Newport",
    year: "2016",
    publisher: "Grand Central Publishing",
    container: "",
    doi: "",
    isbn: "9781455586677",
    url: "https://openlibrary.org/works/OL17713267W",
    pages: 303,
    coverUrl: "https://covers.openlibrary.org/b/id/7988607-M.jpg",
    abstractText: "",
    ...overrides,
  };
}

describe("detección de modo", () => {
  it("detecta DOI con y sin prefijo", () => {
    expect(detectLookupMode("10.1038/nphys1170")).toBe("doi");
    expect(detectLookupMode("https://doi.org/10.1038/nphys1170")).toBe("doi");
    expect(detectLookupMode("doi:10.1038/nphys1170")).toBe("doi");
  });

  it("detecta ISBN-10, ISBN-13 y guiones", () => {
    expect(detectLookupMode("0140328726")).toBe("isbn");
    expect(detectLookupMode("9780140328721")).toBe("isbn");
    expect(detectLookupMode("978-0-14-032872-1")).toBe("isbn");
  });

  it("usa palabras clave para el resto", () => {
    expect(detectLookupMode("deep work")).toBe("keywords");
    expect(detectLookupMode("  ")).toBe("keywords");
  });

  it("manda un ISBN con dígito inválido como isbn para que el backend lo rechace", () => {
    expect(detectLookupMode("9780140328722")).toBe("isbn");
  });
});

describe("normalización de identificadores", () => {
  it("normaliza DOIs", () => {
    expect(normalizeDoi("https://doi.org/10.1038/nphys1170")).toBe("10.1038/nphys1170");
    expect(normalizeDoi("doi:10.1038/nphys1170")).toBe("10.1038/nphys1170");
    expect(normalizeDoi("10.1000/xyz?query=1")).toBe("10.1000/xyz?query=1");
  });

  it("rechaza DOIs inválidos", () => {
    expect(normalizeDoi("10.1/x")).toBeNull();
    expect(normalizeDoi("10.1234/")).toBeNull();
    expect(normalizeDoi("10.1234/a b")).toBeNull();
    expect(normalizeDoi("https://evil.example/10.1234/x")).toBeNull();
    expect(normalizeDoi("10.1234/ñ")).toBeNull();
  });

  it("valida ISBN-10 e ISBN-13 y convierte a 13", () => {
    expect(isbn10Valid("0140328726")).toBe(true);
    expect(isbn10Valid("0140328727")).toBe(false);
    expect(isbn13Valid("9780140328721")).toBe(true);
    expect(isbn13Valid("9780140328722")).toBe(false);
    expect(normalizeIsbn("0140328726")).toBe("9780140328721");
    expect(normalizeIsbn("978-0-14-032872-1")).toBe("9780140328721");
    expect(normalizeIsbn("9780140328722")).toBeNull();
    expect(normalizeIsbn("978014032872X")).toBeNull();
  });
});

describe("saneado de texto", () => {
  it("elimina controles, bidi y zero-width", () => {
    expect(sanitizeLookupText("  hola\u0000\u202E  mundo \u200B", 100)).toBe("hola mundo");
  });

  it("recorta a la longitud pedida", () => {
    expect(sanitizeLookupText("abcdef", 3)).toBe("abc");
    expect(sanitizeLookupQuery("   ")).toBe("");
  });
});

describe("allowlists de URLs", () => {
  it("acepta solo portadas de Open Library con forma esperada", () => {
    expect(isAllowedLookupCoverUrl("https://covers.openlibrary.org/b/id/123-M.jpg")).toBe(true);
    expect(isAllowedLookupCoverUrl("https://covers.openlibrary.org/b/id/123-L.jpg")).toBe(true);
    expect(isAllowedLookupCoverUrl("http://covers.openlibrary.org/b/id/123-M.jpg")).toBe(false);
    expect(isAllowedLookupCoverUrl("https://evil.example/b/id/123-M.jpg")).toBe(false);
    expect(isAllowedLookupCoverUrl("https://covers.openlibrary.org/b/id/1x3-M.jpg")).toBe(false);
    expect(isAllowedLookupCoverUrl("https://covers.openlibrary.org/b/isbn/123-M.jpg")).toBe(false);
    expect(isAllowedLookupCoverUrl("https://covers.openlibrary.org/b/id/123-M.jpg?x=1")).toBe(false);
  });

  it("acepta solo enlaces HTTPS de los proveedores", () => {
    expect(isAllowedLookupUrl("https://doi.org/10.1000/x")).toBe(true);
    expect(isAllowedLookupUrl("https://openlibrary.org/works/OL1W")).toBe(true);
    expect(isAllowedLookupUrl("http://doi.org/10.1000/x")).toBe(false);
    expect(isAllowedLookupUrl("https://doi.org@evil.example/x")).toBe(false);
    expect(isAllowedLookupUrl("https://127.0.0.1/x")).toBe(false);
  });
});

describe("mapeo al formulario", () => {
  it("rellena los campos de creación", () => {
    const input = lookupResultToInput(result());
    expect(input).toMatchObject({
      title: "Deep Work",
      type: "book",
      author: "Cal Newport",
      year: "2016",
      total: 303,
      cover: "https://covers.openlibrary.org/b/id/7988607-M.jpg",
      link: "https://openlibrary.org/works/OL17713267W",
    });
  });

  it("traduce códigos de error estables", () => {
    expect(lookupErrorMessage("invalid_query")).toContain("no es válida");
    expect(lookupErrorMessage("desconocido")).toContain("No se pudo completar");
    expect(lookupErrorCode({ code: "rate_limited" })).toBe("rate_limited");
    expect(lookupErrorCode(new Error("x"))).toBe("network");
  });
});
