import type { BlockNode, FlashcardType } from "../types";
import { cloneTree, indentBlock, outdentBlock } from "../editor/tree-engine";
import { FlashcardsManager } from "./flashcards-manager";

/** Una fila del minieditor del bullet que contiene la tarjeta y sus hijos. */
export interface CardMiniEditorRow {
  id: string;
  depth: number;
  text: string;
  isImage: boolean;
}

/**
 * Aplana el subtree de la tarjeta en filas editables. La raíz es el bullet que
 * tiene `#card`; el resto son sus hijos, con la profundidad que marca la
 * indentación visual del minieditor. Las imágenes se muestran como filas de
 * solo lectura para no perder su alt ni su tipo al guardar.
 */
export function cardMiniEditorRows(
  block: BlockNode,
  includeRoot: boolean
): CardMiniEditorRow[] {
  const rows: CardMiniEditorRow[] = [];
  if (includeRoot) {
    const fields = FlashcardsManager.readEditableFields(block.content, "cloze");
    rows.push({ id: block.id, depth: 0, text: fields.text, isImage: false });
  }
  const walk = (nodes: readonly BlockNode[], depth: number): void => {
    nodes.forEach((node) => {
      if (node.type === "image") {
        rows.push({
          id: node.id,
          depth,
          text: `🖼 ${node.imageAlt?.trim() || "Imagen"}`,
          isImage: true,
        });
      } else {
        const fields = FlashcardsManager.readEditableFields(node.content, "cloze");
        rows.push({ id: node.id, depth, text: fields.text, isImage: false });
      }
      walk(node.children, depth + 1);
    });
  };
  walk(block.children, 1);
  return rows;
}

/**
 * Devuelve una copia del bullet con el texto editado. Solo toca el contenido:
 * conserva ids, tipo de bloque, propiedades FSRS y la etiqueta `#card` tanto en
 * la raíz como en los hijos (que también pueden tener propiedades).
 */
export function applyCardMiniEditor(
  block: BlockNode,
  cardType: FlashcardType,
  fields: { question: string; answer: string; text: string },
  rows: readonly Pick<CardMiniEditorRow, "id" | "text" | "isImage">[]
): BlockNode {
  const clone = cloneTree([block])[0];
  const rootRow = rows.find((row) => row.id === block.id && !row.isImage);
  const effectiveFields =
    cardType !== "basic" && rootRow
      ? { ...fields, text: rootRow.text }
      : fields;
  clone.content = FlashcardsManager.applyCardEdit(clone.content, cardType, effectiveFields);
  const edits = new Map(
    rows.filter((row) => !row.isImage && row.id !== block.id).map((row) => [row.id, row.text])
  );
  const walk = (nodes: BlockNode[]): void => {
    nodes.forEach((node) => {
      const text = edits.get(node.id);
      if (text !== undefined && node.type === "text") {
        node.content = FlashcardsManager.applyCardEdit(node.content, "cloze", {
          question: "",
          answer: "",
          text,
        });
      }
      walk(node.children);
    });
  };
  walk(clone.children);
  return clone;
}

/** Textarea de una fila del minieditor, con el mismo cableado en ambas superficies. */
export function createCardMiniEditorTextarea(
  row: CardMiniEditorRow,
  ariaLabel: string
): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.rows = 2;
  textarea.value = row.text;
  textarea.readOnly = row.isImage;
  textarea.setAttribute("aria-label", ariaLabel);
  textarea.addEventListener("input", () => {
    row.text = textarea.value;
  });
  return textarea;
}

/** Cambia la indentación de una fila dentro del subtree de la tarjeta. */
export function changeCardMiniEditorIndent(
  block: BlockNode,
  rowId: string,
  direction: "in" | "out"
): BlockNode {
  const tree = [cloneTree([block])[0]];
  const next = direction === "in" ? indentBlock(tree, rowId) : outdentBlock(tree, rowId);
  return next?.[0] ?? block;
}
