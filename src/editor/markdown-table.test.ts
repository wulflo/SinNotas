import { describe, expect, it } from "vitest";
import {
  applyTableEdit,
  editMarkdownTable,
  findMarkdownTableRanges,
  serializeMarkdownTable,
  splitTableRow,
  type MarkdownTableModel,
} from "./markdown-table";

const TABLE = [
  "| Nombre | Edad | Notas |",
  "| :--- | ---: | :---: |",
  "| Ana | 30 | **Amiga** |",
  "| Luis | 25 | Hermano |",
].join("\n");

function parsedTable(): MarkdownTableModel {
  return findMarkdownTableRanges(TABLE)[0].model;
}

describe("markdown-table", () => {
  it("divide filas y respeta pipes escapados", () => {
    expect(splitTableRow("| a | b\\|c | d |")).toEqual(["a", "b|c", "d"]);
  });

  it("detecta encabezado, alineaciones y filas", () => {
    const model = parsedTable();
    expect(model.header).toEqual(["Nombre", "Edad", "Notas"]);
    expect(model.alignments).toEqual(["left", "right", "center"]);
    expect(model.rows).toEqual([
      ["Ana", "30", "**Amiga**"],
      ["Luis", "25", "Hermano"],
    ]);
  });

  it("serializa de nuevo el Markdown conservando alineaciones", () => {
    expect(serializeMarkdownTable(parsedTable())).toBe(TABLE);
  });

  it("no confunde tablas dentro de bloques de código", () => {
    const content = "```\n| A | B |\n| --- | --- |\n| 1 | 2 |\n```";
    expect(findMarkdownTableRanges(content)).toHaveLength(0);
  });

  it("añade y elimina filas de datos", () => {
    const withRow = applyTableEdit(parsedTable(), "add-row-below", 1, 0);
    expect(withRow.rows).toHaveLength(3);
    expect(withRow.rows[1]).toEqual(["", "", ""]);

    const withoutRow = applyTableEdit(withRow, "delete-row", 2, 0);
    expect(withoutRow.rows).toEqual(parsedTable().rows);
  });

  it("no elimina el encabezado al borrar su fila", () => {
    const model = applyTableEdit(parsedTable(), "delete-row", 0, 0);
    expect(model.header).toEqual(["Nombre", "Edad", "Notas"]);
    expect(model.rows).toHaveLength(2);
  });

  it("añade y elimina columnas en todas las filas", () => {
    const withColumn = applyTableEdit(parsedTable(), "add-col-right", 1, 0);
    expect(withColumn.header).toHaveLength(4);
    expect(withColumn.rows.every((row) => row.length === 4)).toBe(true);

    const withoutColumn = applyTableEdit(withColumn, "delete-col", 1, 1);
    expect(withoutColumn).toEqual(parsedTable());
  });

  it("no elimina la última columna", () => {
    const single: MarkdownTableModel = {
      header: ["Única"],
      alignments: [null],
      rows: [["valor"]],
    };
    expect(applyTableEdit(single, "delete-col", 1, 0)).toEqual(single);
  });

  it("mueve filas y columnas", () => {
    const movedRow = applyTableEdit(parsedTable(), "move-row-up", 2, 0);
    expect(movedRow.rows[0]).toEqual(["Luis", "25", "Hermano"]);

    const movedColumn = applyTableEdit(parsedTable(), "move-col-left", 1, 2);
    expect(movedColumn.header).toEqual(["Nombre", "Notas", "Edad"]);
    expect(movedColumn.alignments).toEqual(["left", "center", "right"]);
    expect(movedColumn.rows[0]).toEqual(["Ana", "**Amiga**", "30"]);
  });

  it("edita solo la tabla indicada y conserva el texto alrededor", () => {
    const content = `Antes\n\n${TABLE}\n\nEn medio\n\n${TABLE}\n\nDespués`;
    const updated = editMarkdownTable(content, 1, "add-row-below", 1, 0);
    const ranges = findMarkdownTableRanges(updated);
    expect(ranges).toHaveLength(2);
    expect(ranges[0].model.rows).toHaveLength(2);
    expect(ranges[1].model.rows).toHaveLength(3);
    expect(updated.startsWith("Antes")).toBe(true);
    expect(updated.endsWith("Después")).toBe(true);
  });
});
