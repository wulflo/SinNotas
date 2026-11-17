/**
 * Utilidades puras para tablas Markdown (GitHub Flavored Markdown).
 *
 * Se usan tanto al renderizar tablas (flashcards, kanban, etc.) como al
 * editarlas en el outliner. Mantener la lógica aquí permite probar la
 * edición de filas/columnas sin depender del DOM.
 */

export type TableAlignment = "left" | "center" | "right" | null;

export interface MarkdownTableModel {
  header: string[];
  alignments: TableAlignment[];
  rows: string[][];
}

export interface MarkdownTableRange {
  /** Offset inicial dentro del texto original. */
  index: number;
  /** Longitud del bloque de tabla (sin el salto de línea final). */
  length: number;
  model: MarkdownTableModel;
}

export type TableEditAction =
  | "add-row-above"
  | "add-row-below"
  | "delete-row"
  | "add-col-left"
  | "add-col-right"
  | "delete-col"
  | "move-row-up"
  | "move-row-down"
  | "move-col-left"
  | "move-col-right";

const TABLE_SEPARATOR_PATTERN =
  /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** Indica si la línea es el separador (`| --- | :---: |`) de una tabla. */
export function isTableSeparatorLine(line: string): boolean {
  return TABLE_SEPARATOR_PATTERN.test(line);
}

/** Indica si la línea puede formar parte de una tabla. */
export function isTableRowLine(line: string): boolean {
  return line.includes("|") && line.trim().length > 0;
}

/** Divide una fila Markdown en celdas, respetando los pipes escapados (`\|`). */
export function splitTableRow(line: string): string[] {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|") && !value.endsWith("\\|")) value = value.slice(0, -1);

  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "\\" && value[i + 1] === "|") {
      current += "|";
      i += 1;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

/** Escapa los pipes para que una celda no rompa la estructura de la tabla. */
export function escapeTableCell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function parseAlignment(cell: string): TableAlignment {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(":");
  const right = trimmed.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return null;
}

function alignmentToken(alignment: TableAlignment): string {
  if (alignment === "center") return ":---:";
  if (alignment === "right") return "---:";
  if (alignment === "left") return ":---";
  return "---";
}

/** Normaliza todas las filas al ancho del encabezado. */
function normalizeModel(model: MarkdownTableModel): MarkdownTableModel {
  const width = Math.max(model.header.length, 1);
  const header = Array.from({ length: width }, (_, index) => model.header[index] ?? "");
  const alignments = Array.from({ length: width }, (_, index) => model.alignments[index] ?? null);
  const rows = model.rows.map((row) =>
    Array.from({ length: width }, (_, index) => row[index] ?? "")
  );
  return { header, alignments, rows };
}

/** Convierte la tabla de nuevo a Markdown. */
export function serializeMarkdownTable(model: MarkdownTableModel): string {
  const normalized = normalizeModel(model);
  const header = `| ${normalized.header.map(escapeTableCell).join(" | ")} |`;
  const separator = `| ${normalized.alignments.map(alignmentToken).join(" | ")} |`;
  const rows = normalized.rows.map(
    (row) => `| ${row.map(escapeTableCell).join(" | ")} |`
  );
  return [header, separator, ...rows].join("\n");
}

/**
 * Localiza todas las tablas Markdown del texto y devuelve su rango y modelo.
 * Las tablas dentro de bloques de código se ignoran (el renderizador procesa
 * los cercados antes y descarta las coincidencias solapadas).
 */
export function findMarkdownTableRanges(text: string): MarkdownTableRange[] {
  const lines = text.split("\n");
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }

  // Marcar las líneas que están dentro de un bloque de código cercado para no
  // interpretar como tabla su contenido.
  const insideFence: boolean[] = [];
  let openFence: string | null = null;
  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!openFence) {
        openFence = marker;
        insideFence.push(true);
        continue;
      }
      if (marker[0] === openFence[0] && marker.length >= openFence.length) {
        insideFence.push(true);
        openFence = null;
        continue;
      }
    }
    insideFence.push(openFence !== null);
  }

  const ranges: MarkdownTableRange[] = [];
  let index = 0;
  while (index < lines.length - 1) {
    const headerLine = lines[index];
    const separatorLine = lines[index + 1];
    if (
      insideFence[index] ||
      insideFence[index + 1] ||
      !isTableRowLine(headerLine) ||
      isTableSeparatorLine(headerLine) ||
      !isTableSeparatorLine(separatorLine)
    ) {
      index += 1;
      continue;
    }

    let end = index + 2;
    while (
      end < lines.length &&
      isTableRowLine(lines[end]) &&
      !isTableSeparatorLine(lines[end])
    ) {
      end += 1;
    }

    const header = splitTableRow(headerLine);
    const alignments = splitTableRow(separatorLine).map(parseAlignment);
    const rows = lines.slice(index + 2, end).map(splitTableRow);
    const rangeStart = starts[index];
    const rangeEnd = end < lines.length ? starts[end] - 1 : text.length;
    ranges.push({
      index: rangeStart,
      length: Math.max(rangeEnd - rangeStart, 0),
      model: normalizeModel({ header, alignments, rows }),
    });
    index = end;
  }
  return ranges;
}

function insertAt<T>(items: T[], index: number, value: T): T[] {
  const clamped = Math.max(0, Math.min(index, items.length));
  return [...items.slice(0, clamped), value, ...items.slice(clamped)];
}

function removeAt<T>(items: T[], index: number): T[] {
  if (index < 0 || index >= items.length) return [...items];
  return [...items.slice(0, index), ...items.slice(index + 1)];
}

function emptyRow(width: number): string[] {
  return Array.from({ length: width }, () => "");
}

/**
 * Aplica una acción de edición de tabla.
 *
 * `rowIndex` es el índice lógico de la fila: 0 es el encabezado y 1..N son las
 * filas de datos. `colIndex` es el índice de la columna (0..N-1).
 */
export function applyTableEdit(
  model: MarkdownTableModel,
  action: TableEditAction,
  rowIndex: number,
  colIndex: number
): MarkdownTableModel {
  const current = normalizeModel(model);
  const width = current.header.length;
  const bodyIndex = Math.max(0, rowIndex - 1);
  const columnIndex = Math.max(0, Math.min(colIndex, width - 1));

  switch (action) {
    case "add-row-above": {
      const insertIndex = rowIndex <= 0 ? 0 : bodyIndex;
      return { ...current, rows: insertAt(current.rows, insertIndex, emptyRow(width)) };
    }
    case "add-row-below": {
      const insertIndex = rowIndex <= 0 ? 0 : bodyIndex + 1;
      return { ...current, rows: insertAt(current.rows, insertIndex, emptyRow(width)) };
    }
    case "delete-row": {
      if (rowIndex <= 0) return current;
      return { ...current, rows: removeAt(current.rows, bodyIndex) };
    }
    case "add-col-left": {
      const insertIndex = columnIndex;
      return {
        header: insertAt(current.header, insertIndex, ""),
        alignments: insertAt(current.alignments, insertIndex, null),
        rows: current.rows.map((row) => insertAt(row, insertIndex, "")),
      };
    }
    case "add-col-right": {
      const insertIndex = columnIndex + 1;
      return {
        header: insertAt(current.header, insertIndex, ""),
        alignments: insertAt(current.alignments, insertIndex, null),
        rows: current.rows.map((row) => insertAt(row, insertIndex, "")),
      };
    }
    case "delete-col": {
      if (width <= 1) return current;
      return {
        header: removeAt(current.header, columnIndex),
        alignments: removeAt(current.alignments, columnIndex),
        rows: current.rows.map((row) => removeAt(row, columnIndex)),
      };
    }
    case "move-row-up": {
      if (rowIndex <= 1) return current;
      const rows = [...current.rows];
      [rows[bodyIndex - 1], rows[bodyIndex]] = [rows[bodyIndex], rows[bodyIndex - 1]];
      return { ...current, rows };
    }
    case "move-row-down": {
      if (rowIndex <= 0 || rowIndex >= current.rows.length) return current;
      const rows = [...current.rows];
      [rows[bodyIndex], rows[bodyIndex + 1]] = [rows[bodyIndex + 1], rows[bodyIndex]];
      return { ...current, rows };
    }
    case "move-col-left": {
      if (columnIndex <= 0) return current;
      const swap = <T,>(items: T[]): T[] => {
        const copy = [...items];
        [copy[columnIndex - 1], copy[columnIndex]] = [copy[columnIndex], copy[columnIndex - 1]];
        return copy;
      };
      return {
        header: swap(current.header),
        alignments: swap(current.alignments),
        rows: current.rows.map(swap),
      };
    }
    case "move-col-right": {
      if (columnIndex >= width - 1) return current;
      const swap = <T,>(items: T[]): T[] => {
        const copy = [...items];
        [copy[columnIndex], copy[columnIndex + 1]] = [copy[columnIndex + 1], copy[columnIndex]];
        return copy;
      };
      return {
        header: swap(current.header),
        alignments: swap(current.alignments),
        rows: current.rows.map(swap),
      };
    }
    default:
      return current;
  }
}

/**
 * Aplica una edición a la tabla número `tableIndex` del Markdown y devuelve el
 * texto completo. Si el índice no existe, devuelve el texto sin cambios.
 */
export function editMarkdownTable(
  text: string,
  tableIndex: number,
  action: TableEditAction,
  rowIndex: number,
  colIndex: number
): string {
  const ranges = findMarkdownTableRanges(text);
  const range = ranges[tableIndex];
  if (!range) return text;
  const updated = serializeMarkdownTable(
    applyTableEdit(range.model, action, rowIndex, colIndex)
  );
  return text.slice(0, range.index) + updated + text.slice(range.index + range.length);
}
