// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { BlockNode } from "../types";
import {
  applyCardMiniEditor,
  cardMiniEditorRows,
  changeCardMiniEditorIndent,
  createCardMiniEditorTextarea,
  resizeCardMiniEditorTextarea,
} from "./card-mini-editor";

function block(id: string, content: string, children: BlockNode[] = []): BlockNode {
  return { id, type: "text", content, children };
}

describe("cardMiniEditorRows", () => {
  const card = block(
    "b-card",
    "El ==algoritmo== usa {{c1::estabilidad}}. #card\ncard-s:: 1.2",
    [
      block("b-hijo", "Hijo directo"),
      block("b-nieto", "Nieto", [block("b-bisnieto", "Bisnieto")]),
      { id: "b-img", type: "image", content: "", imageAlt: "Mapa", children: [] },
    ]
  );

  it("respeta la indentación del subtree y marca las imágenes como solo lectura", () => {
    const rows = cardMiniEditorRows(card, true);
    expect(rows.map((row) => [row.id, row.depth])).toEqual([
      ["b-card", 0],
      ["b-hijo", 1],
      ["b-nieto", 1],
      ["b-bisnieto", 2],
      ["b-img", 1],
    ]);
    expect(rows[0].text).not.toContain("card-s::");
    expect(rows[4]).toMatchObject({ isImage: true, text: "🖼 Mapa" });
  });

  it("puede excluir la raíz cuando los campos se editan por separado", () => {
    expect(cardMiniEditorRows(card, false).map((row) => row.id)).toEqual([
      "b-hijo",
      "b-nieto",
      "b-bisnieto",
      "b-img",
    ]);
  });
});

describe("applyCardMiniEditor", () => {
  const card = block(
    "b-card",
    "Texto viejo ==cloze==. #card\ncard-s:: 1.2\ncard-reps:: 3",
    [block("b-hijo", "Hijo viejo\npropia:: valor")]
  );

  it("edita raíz e hijos conservando propiedades y ids", () => {
    const rows = cardMiniEditorRows(card, true).map((row) => ({
      id: row.id,
      text: row.id === "b-card" ? "Texto nuevo ==cloze==. #card" : "Hijo nuevo",
      isImage: row.isImage,
    }));
    const updated = applyCardMiniEditor(
      card,
      "cloze",
      { question: "", answer: "", text: "" },
      rows
    );

    expect(updated.id).toBe("b-card");
    expect(updated.content).toContain("Texto nuevo ==cloze==");
    expect(updated.content).toContain("card-s:: 1.2");
    expect(updated.content).toContain("#card");
    expect(updated.children[0].id).toBe("b-hijo");
    expect(updated.children[0].content).toContain("Hijo nuevo");
    expect(updated.children[0].content).toContain("propia:: valor");
    // El original no se muta: el llamador puede revertir si falla el guardado.
    expect(card.content).toContain("Texto viejo");
  });

  it("conserva la pregunta y respuesta de una tarjeta básica", () => {
    const basic = block("b-basic", "Vieja :: Respuesta #card\ncard-s:: 4");
    const updated = applyCardMiniEditor(
      basic,
      "basic",
      { question: "Nueva", answer: "Otra", text: "" },
      []
    );
    expect(updated.content.split("\n")[0]).toBe("Nueva :: Otra #card");
    expect(updated.content).toContain("card-s:: 4");
  });

  it("no escribe un `::` vacío cuando la respuesta son los bullets hijos", () => {
    const basic = block("b-basic", "¿Qué es FSRS? #card", [
      block("b-hijo", "Un algoritmo de repaso"),
    ]);
    const updated = applyCardMiniEditor(
      basic,
      "basic",
      { question: "¿Qué es FSRS?", answer: "", text: "" },
      cardMiniEditorRows(basic, false)
    );
    expect(updated.content.split("\n")[0]).not.toContain("::");
    expect(updated.content).toContain("#card");
    expect(updated.children[0].content).toContain("Un algoritmo de repaso");
  });
});

describe("createCardMiniEditorTextarea", () => {
  it("cablea valor, solo lectura y escritura de vuelta en la fila", () => {
    const row = { id: "b-1", depth: 1, text: "Hijo", isImage: false };
    const textarea = createCardMiniEditorTextarea(row, "Bullet 2");
    expect(Number(textarea.rows)).toBe(1);
    expect(textarea.value).toBe("Hijo");
    expect(textarea.readOnly).toBe(false);
    expect(textarea.getAttribute("aria-label")).toBe("Bullet 2");

    textarea.value = "Hijo editado";
    textarea.dispatchEvent(new Event("input"));
    expect(row.text).toBe("Hijo editado");
  });

  it("marca las filas de imagen como solo lectura", () => {
    const row = { id: "b-img", depth: 1, text: "🖼 Mapa", isImage: true };
    expect(createCardMiniEditorTextarea(row, "Bullet 2").readOnly).toBe(true);
  });

  it("crece con el contenido y vuelve al mínimo al borrar el texto", () => {
    const row = { id: "b-1", depth: 1, text: "Hijo", isImage: false };
    const textarea = createCardMiniEditorTextarea(row, "Bullet 2");
    document.body.appendChild(textarea);
    Object.defineProperty(textarea, "scrollHeight", { value: 180, configurable: true });
    resizeCardMiniEditorTextarea(textarea);
    expect(textarea.style.height).toBe("182px");

    textarea.value = "Corto";
    Object.defineProperty(textarea, "scrollHeight", { value: 20, configurable: true });
    textarea.dispatchEvent(new Event("input"));
    expect(textarea.style.height).toBe("44px");
    textarea.remove();
  });
});

describe("changeCardMiniEditorIndent", () => {
  it("indenta y desindenta un hijo sin tocar la raíz", () => {
    const card = block("b-card", "Pregunta :: Respuesta #card", [
      block("b-a", "A"),
      block("b-b", "B"),
    ]);
    const indented = changeCardMiniEditorIndent(card, "b-b", "in");
    expect(indented.children[0].children.map((node) => node.id)).toEqual(["b-b"]);

    const outdented = changeCardMiniEditorIndent(indented, "b-b", "out");
    expect(outdented.children.map((node) => node.id)).toEqual(["b-a", "b-b"]);
    expect(changeCardMiniEditorIndent(card, "b-card", "out")).toBe(card);
  });
});
