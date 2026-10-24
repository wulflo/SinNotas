import { describe, expect, it } from "vitest";
import { renderMarkdownToHtml } from "./markdown";

describe("renderMarkdownToHtml math", () => {
  it("renders inline math with KaTeX without turning it into a block", () => {
    const html = renderMarkdownToHtml("La fórmula $a^2 + b^2 = c^2$ es conocida.");
    expect(html).toContain('class="math-inline"');
    expect(html).toContain("katex");
    expect(html).not.toContain('class="math-display"');
  });

  it("renders display math separately and centered", () => {
    const html = renderMarkdownToHtml("Antes\n$$\n\\int_0^1 x^2 dx\n$$\nDespués");
    expect(html).toContain('class="math-display"');
    expect(html).toContain("katex-display");
    // El texto de los alrededores sigue presente.
    expect(html).toContain("Antes");
    expect(html).toContain("Después");
  });

  it("does not treat escaped dollars or double dollars as inline math", () => {
    const escaped = renderMarkdownToHtml("Precio: \\$5 y \\$10");
    expect(escaped).not.toContain('class="math-inline"');
    expect(escaped).toContain("$5");
  });
});

describe("renderMarkdownToHtml code", () => {
  it("renders inline code escaped", () => {
    const html = renderMarkdownToHtml("Usa `<div>` con cuidado.");
    expect(html).toContain('<code class="code-inline">&lt;div&gt;</code>');
  });

  it("renders fenced code as a block and escapes its content", () => {
    const html = renderMarkdownToHtml("```js\nconst x = '<script>';\n```");
    expect(html).toContain('<pre class="code-block" data-language="js">');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("renderMarkdownToHtml tables", () => {
  const table = [
    "| Nombre | Edad | Notas |",
    "| :--- | ---: | :---: |",
    "| Ana | 30 | **Amiga** |",
    "| Luis | 25 | Hermano |",
  ].join("\n");

  it("renderiza tablas GFM con encabezado, filas y alineaciones", () => {
    const html = renderMarkdownToHtml(table);
    expect(html).toContain('<table class="markdown-table">');
    expect(html).toContain("<thead>");
    expect(html).toContain("<th");
    expect(html).toContain(">Nombre</th>");
    expect(html).toContain('<td class="markdown-align-right">30</td>');
    expect(html).toContain('<td class="markdown-align-center"><strong>Amiga</strong></td>');
    expect(html).toContain(">Luis</td>");
  });

  it("renderiza tablas dentro de contenido de flashcards sin romper el texto", () => {
    const html = renderMarkdownToHtml(`Pregunta:\n\n${table}\n\nRespuesta`);
    expect(html).toContain("Pregunta:");
    expect(html).toContain("Respuesta");
    expect(html).toContain("<table");
  });

  it("no convierte en tabla el contenido de un bloque de código", () => {
    const html = renderMarkdownToHtml("```\n| A | B |\n| --- | --- |\n| 1 | 2 |\n```");
    expect(html).not.toContain("<table");
    expect(html).toContain("| A | B |");
  });
});

describe("renderMarkdownToHtml safety", () => {
  it("escapes untrusted HTML", () => {
    const html = renderMarkdownToHtml('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("does not allow dangerous commands to become links via math", () => {
    const html = renderMarkdownToHtml("$\\href{javascript:alert(1)}{x}$");
    // KaTeX con trust:false muestra el comando como texto: no hay enlace real.
    expect(html).not.toContain("<a ");
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("onclick=");
  });
});

describe("renderMarkdownToHtml ReDoS resistance", () => {
  // Umbral 500ms: el backtracking catastrófico tarda segundos o minutos en
  // 10k repeticiones; el tiempo lineal queda en decenas de ms. Un umbral de
  // 100ms era inestable en runners de CI cargados (medición de reloj).
  const REDOS_THRESHOLD_MS = 500;

  it("cloze pattern does not catastrophically backtrack on repeated {{", () => {
    // Patrón cloze: \{\{(?:c\d+::|cloze\s+)?([^}\n]+)\}\}
    // Input malicioso: "{{ " repetido muchas veces sin cierre }}
    const malicious = "{{ ".repeat(10_000);
    const start = performance.now();
    const html = renderMarkdownToHtml(malicious);
    const elapsed = performance.now() - start;
    // Debe completarse en < 500ms (no segundos/minutos)
    expect(elapsed).toBeLessThan(REDOS_THRESHOLD_MS);
    // No debe colapsar ni lanzar error
    expect(typeof html).toBe("string");
  });

  it("wikilink pattern does not catastrophically backtrack on repeated [[", () => {
    const malicious = "[[".repeat(10_000);
    const start = performance.now();
    const html = renderMarkdownToHtml(malicious);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(REDOS_THRESHOLD_MS);
    expect(typeof html).toBe("string");
  });

  it("fenced code pattern does not catastrophically backtrack on repeated ```", () => {
    const malicious = "```\n".repeat(10_000);
    const start = performance.now();
    const html = renderMarkdownToHtml(malicious);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(REDOS_THRESHOLD_MS);
    expect(typeof html).toBe("string");
  });

  it("display math pattern does not catastrophically backtrack on repeated $$", () => {
    const malicious = "$$ ".repeat(10_000);
    const start = performance.now();
    const html = renderMarkdownToHtml(malicious);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(REDOS_THRESHOLD_MS);
    expect(typeof html).toBe("string");
  });

  it("inline math pattern does not catastrophically backtrack on repeated $", () => {
    const malicious = "$ ".repeat(10_000);
    const start = performance.now();
    const html = renderMarkdownToHtml(malicious);
    const elapsed = performance.now() - start;
    // Input patológico de 10k '$ ' (sin pares válidos).
    // El límite {1,500} evita backtracking exponencial; el tiempo es lineal O(n), no catastrófico O(2^n).
    expect(elapsed).toBeLessThan(REDOS_THRESHOLD_MS);
    expect(typeof html).toBe("string");
  });
});
