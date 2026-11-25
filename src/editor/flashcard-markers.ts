/**
 * Utilidades puras para detectar y quitar los marcadores que convierten un
 * bullet en flashcard. Viven fuera de `desktop.ts` para poder probarlas sin
 * DOM y para que todas las rutas de borrado (menú contextual, explorador,
 * mantenimiento y ajustes avanzados) usen exactamente la misma primitiva.
 */
import { isSystemPropertyLine, stripCardTag } from "./markdown";

/** Separa las líneas `clave:: valor` del texto visible de un bloque. */
export function splitBlockProperties(content: string): { text: string; properties: string[] } {
  const textLines: string[] = [];
  const properties: string[] = [];
  content.split(/\r?\n/).forEach((line) => {
    if (/^[\w-]+::\s*.*$/i.test(line.trim())) properties.push(line.trim());
    else textLines.push(line);
  });
  return { text: textLines.join("\n"), properties };
}

const cardPropertyPattern =
  /^(?:card-[a-z-]+|last-reviewed|interval-days|ease-factor|due-date|image-occlusions)::/i;

/** Indica si el contenido de un bloque genera algún tipo de tarjeta. */
export function isFlashcardBlockContent(content: string): boolean {
  const { text, properties } = splitBlockProperties(content);
  return (
    /#card\b/i.test(text) ||
    text.includes("::") ||
    // El recolector acepta cualquier cloze `{{texto}}`, con o sin prefijo, y
    // con la misma cota de 500 caracteres que el renderer (markdown.ts).
    /\{\{(?:c\d+::|cloze\s+)?[^}\n]{1,500}\}\}/i.test(text) ||
    /==.*?==/.test(text) ||
    properties.some((property) => /^image-occlusions::/i.test(property)) ||
    // `Pregunta::Respuesta` y `clave:: valor` se clasifican como propiedades
    // por splitBlockProperties, pero el recolector (stripSystemProperties +
    // includes("::")) sí los considera tarjetas básicas. Sin esta comprobación
    // esa tarjeta no se podía quitar desde Ajustes ni desde el explorador.
    properties.some((property) => !isSystemPropertyLine(property) && property.includes("::"))
  );
}

/**
 * Quita los marcadores de flashcard conservando el texto y, sobre todo, la
 * indentación de cada línea. El anterior implementation aplicaba `trim()` al
 * bloque completo, que eliminaba los espacios iniciales de la última línea y
 * desplazaba hacia la izquierda los bullets anidados al guardar la nota.
 */
export function removeFlashcardMarkers(content: string): string {
  const keptLines = content
    .split(/\r?\n/)
    .filter((line) => !cardPropertyPattern.test(line.trim()));
  const { properties } = splitBlockProperties(keptLines.join("\n"));
  // Solo las propiedades de sistema se conservan como propiedades. Una línea
  // `clave:: valor` que no sea de sistema es texto visible con un separador de
  // tarjeta: hay que convertirlo en puntuación, igual que en las líneas de texto.
  const systemProperties = properties.filter((property) => isSystemPropertyLine(property));
  const visibleSource = keptLines.filter((line) => !systemProperties.includes(line.trim()));

  const visibleLines = visibleSource.map((line) => {
    // La indentación es estructural en el outliner: se preserva tal cual.
    const indentation = line.match(/^[ \t]*/)?.[0] ?? "";
    let body = line.slice(indentation.length);
    // Cloze estilo Anki: {{c1::texto}}, {{cloze texto}} o {{texto}} → texto.
    body = body.replace(/\{\{(?:c\d+::|cloze\s+)?([^}\n]*)\}\}/gi, "$1");
    // Resaltado usado como cloze: ==texto== → texto.
    body = body.replace(/==([^=\n]+)==/g, "$1");
    // Etiquetas de tarjeta.
    body = stripCardTag(body).replace(/#flashcards?\b/gi, "");
    // El separador `::` también genera una tarjeta básica; se conserva como
    // puntuación normal para que el bullet siga siendo legible.
    body = body.replace(/\s*::\s*/g, " : ");
    return `${indentation}${body.replace(/[ \t]+$/g, "")}`;
  });

  // Solo se recortan las líneas vacías sobrantes al final; nunca se toca la
  // indentación inicial ni se colapsan líneas en blanco intermedias.
  while (visibleLines.length > 0 && visibleLines[visibleLines.length - 1].trim() === "") {
    visibleLines.pop();
  }

  return [visibleLines.join("\n"), ...systemProperties].filter((part) => part.length > 0).join("\n");
}
