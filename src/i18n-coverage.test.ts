import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guardia de traducciones: todo texto visible del HTML (incluidos title y
 * aria-label) debe tener entrada en los diccionarios inglés y chino.
 * Se excluyen únicamente valores técnicos (combinaciones de teclas, números,
 * unidades y marcadores de Markdown), que no son texto traducible.
 */
const root = fileURLToPath(new URL("..", import.meta.url));
const html = readFileSync(`${root}index.html`, "utf8")
  .replace(/<style[\s\S]*?<\/style>/g, "")
  .replace(/<script[\s\S]*?<\/script>/g, "");
const source = readFileSync(`${root}src/i18n.ts`, "utf8");

function keys(section: string): Set<string> {
  const found = new Set<string>();
  for (const match of section.matchAll(/^  ("(?:[^"\\]|\\.)*"):/gm)) {
    found.add(JSON.parse(match[1]) as string);
  }
  return found;
}

const english = keys(source.slice(source.indexOf("const englishBySpanish"), source.indexOf("const chineseBySpanish")));
const chinese = keys(source.slice(source.indexOf("const chineseBySpanish")));

const technical = (text: string): boolean =>
  /^[\d\s.,:+\-/°%()*]+$/.test(text) ||
  /Ctrl|Cmd|Alt|Shift|Tab|Del|Backspace|Enter|←|→|↑|↓/.test(text) ||
  /[{}[\]]|::|#card|==|<u>|\*\*|~~|\(\*\)/.test(text) ||
  /^\d+(\.\d+)?\s*(px|em|m|min|d)$/.test(text) ||
  ["Pomodoro", "FSRS-7", "SinNotas", "Sin Notas", "S: 0.4d • D: 5.0", "Sn", "English", "中文",
   "Aero", "Simple", "Dracula", "assets", "D", "L", "M", "X", "J", "V", "S", "&lt;", "&gt;",
   "&lt;&gt;", "Esc", "Space", "B", "I", "U", "H1", "H2", "H3", "H4", "H5", "H6", "1m 10m",
  ].includes(text);

function visibleStrings(): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(/>([^<>]+)</g)) {
    const text = match[1].replace(/\s+/g, " ").trim();
    if (text) found.push(text);
  }
  for (const attribute of ["title", "aria-label", "placeholder", "aria-description", "data-tooltip"]) {
    for (const match of html.matchAll(new RegExp(`${attribute}="([^"]+)"`, "g"))) {
      found.push(match[1].replace(/\s+/g, " ").trim());
    }
  }
  return [...new Set(found)].filter(
    (text) => !technical(text) && /[\p{L}]/u.test(text)
  );
}

describe("cobertura de traducciones", () => {
  it("todo texto visible del HTML tiene versión en inglés y china", () => {
    const missing = visibleStrings().filter((text) => !english.has(text) || !chinese.has(text));
    expect(missing).toEqual([]);
  });

  it("los textos dinámicos del panel de productividad están en los tres idiomas", () => {
    const dynamic = [
      "Focus", "Selección anterior", "punto", "puntos", "pt", "pts", "repaso", "repasos",
      "min de enfoque hoy", "Protón", "Pausar", "entre", "y",
    ];
    for (const text of dynamic) {
      expect(english.has(text), `falta en inglés: ${text}`).toBe(true);
      expect(chinese.has(text), `falta en chino: ${text}`).toBe(true);
    }
  });

  it("los avisos de flashcards y restauración están en los tres idiomas", () => {
    const toasts = [
      "El bloque principal ya es una tarjeta o está vacío.",
      "Flashcard eliminada; el contenido se conservó.",
      "Tarjeta eliminada; el contenido se conservó.",
      "No se encontró la nota de la tarjeta.",
      "No se encontró el bullet de la tarjeta.",
      "Abrir Repaso",
    ];
    for (const text of toasts) {
      expect(english.has(text), `falta en inglés: ${text}`).toBe(true);
      expect(chinese.has(text), `falta en chino: ${text}`).toBe(true);
    }
  });
});
