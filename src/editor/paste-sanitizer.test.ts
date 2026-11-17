import { describe, expect, it } from "vitest";
import {
  MAX_PASTED_HTML_LENGTH,
  MAX_PASTED_MARKDOWN_LENGTH,
  sanitizeDomNodeTree,
  type MinimalDomNode,
} from "./paste-sanitizer";

function el(nodeName: string, childNodes: MinimalDomNode[] = []): MinimalDomNode {
  return { nodeType: 1, nodeName, textContent: "", childNodes };
}

function t(textContent: string): MinimalDomNode {
  return { nodeType: 3, nodeName: "#text", textContent, childNodes: [] };
}

/** Simula el resultado de pegar el título de un video de YouTube. */
describe("sanitizeDomNodeTree", () => {
  it("descarta spans con estilos, colores y tamaños del app de origen", () => {
    const body = el("BODY", [
      el("SPAN", [t("Título del video")]),
    ]);
    expect(sanitizeDomNodeTree(body)).toBe("Título del video");
  });

  it("conserva negrita y cursiva como marcado Markdown", () => {
    const body = el("BODY", [
      el("B", [t("negrita")]), t(" y "), el("I", [t("cursiva")]),
    ]);
    expect(sanitizeDomNodeTree(body)).toBe("**negrita** y *cursiva*");
  });

  it("conserva subrayado y tachado según la sintaxis del editor", () => {
    const body = el("BODY", [
      el("U", [t("sub")]), t(" "), el("S", [t("tachado")]),
    ]);
    expect(sanitizeDomNodeTree(body)).toBe("<u>sub</u> ~~tachado~~");
  });

  it("convierte listas anidadas con indentación de dos espacios por nivel", () => {
    const body = el("BODY", [el("UL", [
      el("LI", [t("uno")]),
      el("LI", [t("dos"), el("UL", [el("LI", [t("dos punto uno")])])]),
    ])]);
    expect(sanitizeDomNodeTree(body)).toBe("- uno\n- dos\n  - dos punto uno");
  });

  it("colapsa líneas vacías excesivas y recorta los extremos", () => {
    const body = el("BODY", [
      t("\n\n\n Esto  es   un   texto "), el("BR"), t("\n"), el("DIV", []), t("\n\n"),
    ]);
    // El <br> inicial y los saltos finales de línea se recortan.
    expect(sanitizeDomNodeTree(body)).toBe("Esto es un texto");
  });

  it("no emite atributos: sin href, sin src, sin style ni manejadores", () => {
    const body = el("BODY", [
      el("B", [t("grande")]), t(" texto"),
    ]);
    const result = sanitizeDomNodeTree(body);
    expect(result).not.toMatch(/href=|src=|style=|on[a-z]+=/i);
    expect(result).toBe("**grande** texto");
  });

  it("descarta etiquetas peligrosas y multimedia", () => {
    const body = el("BODY", [
      el("SCRIPT", [t("alert(1)")]),
      el("STYLE", [t("body { color: red}")]),
      t("seguro"),
      el("IMG"),
      el("IFRAME"),
      el("FORM"),
    ]);
    expect(sanitizeDomNodeTree(body)).toBe("seguro");
  });

  it("conserva el código inline del portapapeles con backticks", () => {
    const body = el("BODY", [t("usa "), el("CODE", [t("apt")]), t(" para instalar")]);
    expect(sanitizeDomNodeTree(body)).toBe("usa `apt` para instalar");
  });

  it("trunca en el límite de longitud el markdown generado", () => {
    const filler = "x".repeat(60_000);
    const body = el("BODY", [t(filler)]);
    expect(sanitizeDomNodeTree(body)).toHaveLength(MAX_PASTED_MARKDOWN_LENGTH);
    expect(filler).toHaveLength(60_000);
  });

  it("ignora etiquetas desconocidas de forma transparente", () => {
    expect(() => sanitizeDomNodeTree(el("BODY", [el("CUSTOM-TAG", [t("ok")])]))).not.toThrow();
    expect(sanitizeDomNodeTree(el("BODY", [el("CUSTOM-TAG", [t("ok")])]))).toBe("ok");
  });

  it("convierte tablas del portapapeles a líneas de pipes", () => {
    const body = el("BODY", [el("TABLE", [
      el("TR", [el("TD", [t("a")]), el("TD", [t("b")])]),
      el("TR", [el("TD", [t("c")]), el("TD", [t("d")])]),
    ])]);
    expect(sanitizeDomNodeTree(body)).toBe("| a | b |\n| c | d |");
  });
});

describe("paste sanitizer límites", () => {
  it("exporta límites coherentes entre sí", () => {
    expect(MAX_PASTED_HTML_LENGTH).toBeGreaterThan(0);
    expect(MAX_PASTED_HTML_LENGTH).toBeGreaterThan(MAX_PASTED_MARKDOWN_LENGTH);
  });
});
