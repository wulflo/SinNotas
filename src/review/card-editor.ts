import type { BlockNode, Flashcard, PageData } from "../types";
import type { FlashcardReviewOrder } from "../views/flashcards-manager";
import { FlashcardsManager } from "../views/flashcards-manager";
import { translate } from "../i18n";
import { showToast } from "../ui/toast";
import { findNodeLocation } from "../editor/tree-engine";
import { parseImageOcclusions } from "../editor/image-occlusion";
import {
  applyCardMiniEditor,
  cardMiniEditorRows,
  changeCardMiniEditorIndent,
  createCardMiniEditorTextarea,
  resizeCardMiniEditorTextarea,
  type CardMiniEditorRow,
} from "../views/card-mini-editor";

/**servicios de desktop.ts inyectados en el editor de tarjeta del repaso. */
export interface CardEditorHost {
  findReviewCardBlock(card: Flashcard): { page: PageData; block: BlockNode } | null;
  getPages(): PageData[];
  savePage(page: PageData, flush: boolean): Promise<void>;
  captureHistory(pageId: string, blocks: BlockNode[], title: string): void;
  getFlashcardsManager(): FlashcardsManager;
  getReviewOrder(): FlashcardReviewOrder;
  isFlashcardLoading(): boolean;
  setImageOcclusionFromReview(value: { cardId: string; revealed: boolean }): void;
  openImageOcclusionEditor(blockId: string, source: string): void;
  updateFlashcardUI(): void;
  mountOverlay(overlay: HTMLElement): void;
  unmountOverlay(overlay: HTMLElement): void;
}

let host!: CardEditorHost;

export function configureCardEditor(nextHost: CardEditorHost): void {
  host = nextHost;
}

const cardEditorOverlay = document.getElementById("card-editor-overlay") as HTMLDivElement | null;
const btnEditFlashcard = document.getElementById("btn-edit-flashcard") as HTMLButtonElement | null;
const cardEditorTitle = document.getElementById("card-editor-title") as HTMLHeadingElement | null;
const cardEditorQuestionField = document.getElementById("card-editor-question-field") as HTMLLabelElement | null;
const cardEditorAnswerField = document.getElementById("card-editor-answer-field") as HTMLLabelElement | null;
const cardEditorTextField = document.getElementById("card-editor-text-field") as HTMLLabelElement | null;
const cardEditorQuestion = document.getElementById("card-editor-question") as HTMLTextAreaElement | null;
const cardEditorAnswer = document.getElementById("card-editor-answer") as HTMLTextAreaElement | null;
const cardEditorText = document.getElementById("card-editor-text") as HTMLTextAreaElement | null;
const cardEditorChildren = document.getElementById("card-editor-children") as HTMLDivElement | null;
const cardEditorRows = document.getElementById("card-editor-rows") as HTMLDivElement | null;
const btnSaveCardEditor = document.getElementById("btn-save-card-editor") as HTMLButtonElement | null;
const btnCancelCardEditor = document.getElementById("btn-cancel-card-editor") as HTMLButtonElement | null;
const btnCloseCardEditor = document.getElementById("btn-close-card-editor") as HTMLButtonElement | null;


interface CardEditorTarget {
  cardId: string;
  pageId: string;
  blockId: string;
  cardType: Flashcard["cardType"];
  initialBlock: BlockNode;
  currentBlock: BlockNode;
}

let cardEditorTarget: CardEditorTarget | null = null;
let cardEditorRowsState: CardMiniEditorRow[] = [];

function cardEditorFields(): { question: string; answer: string; text: string } {
  return {
    question: cardEditorQuestion?.value ?? "",
    answer: cardEditorAnswer?.value ?? "",
    text: cardEditorText?.value ?? "",
  };
}

/** Vuelca los campos y las filas del minieditor en la copia de trabajo. */
function commitCardEditorFields(): void {
  if (!cardEditorTarget) return;
  cardEditorTarget.currentBlock = applyCardMiniEditor(
    cardEditorTarget.currentBlock,
    cardEditorTarget.cardType,
    cardEditorFields(),
    cardEditorRowsState
  );
}

function renderCardEditorRows(block: BlockNode, includeRoot: boolean): void {
  if (!cardEditorRows) return;
  cardEditorRowsState = cardMiniEditorRows(block, includeRoot);
  if (cardEditorChildren) cardEditorChildren.hidden = cardEditorRowsState.length === 0;
  cardEditorRows.replaceChildren();
  cardEditorRowsState.forEach((row) => {
    const line = document.createElement("div");
    line.className = "card-editor-row";
    line.style.setProperty("--card-edit-depth", String(row.depth));

    const bullet = document.createElement("span");
    bullet.className = "card-editor-row-bullet";
    bullet.setAttribute("aria-hidden", "true");
    bullet.textContent = "•";

    const textarea = createCardMiniEditorTextarea(
      row,
      `${translate("Bullet")} ${row.depth + 1}`
    );

    line.append(bullet, textarea);

    if (!row.isImage && row.depth > 0) {
      const actions = document.createElement("div");
      actions.className = "card-editor-row-actions";
      (["in", "out"] as const).forEach((direction) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn-icon";
        button.textContent = direction === "in" ? "↳" : "↰";
        button.title = translate(direction === "in" ? "Indentar" : "Desindentar");
        button.setAttribute("aria-label", button.title);
        button.addEventListener("click", () => {
          commitCardEditorFields();
          if (!cardEditorTarget) return;
          cardEditorTarget.currentBlock = changeCardMiniEditorIndent(
            cardEditorTarget.currentBlock,
            row.id,
            direction
          );
          renderCardEditorRows(
            cardEditorTarget.currentBlock,
            cardEditorTarget.cardType !== "basic"
          );
        });
        actions.appendChild(button);
      });
      line.appendChild(actions);
    }

    cardEditorRows.appendChild(line);
    resizeCardMiniEditorTextarea(textarea);
  });
}

function openCardEditor(): void {
  if (host.isFlashcardLoading() || !cardEditorOverlay) return;
  const card = host.getFlashcardsManager().getCurrentCard();
  if (!card) return;
  if (card.cardType === "image-occlusion") {
    openReviewOcclusionEditor(card);
    return;
  }
  const target = host.findReviewCardBlock(card);
  if (!target) {
    showToast(translate("No se encontró el bloque de la tarjeta."));
    return;
  }
  const isBasic = card.cardType === "basic";
  const fields = FlashcardsManager.readEditableFields(target.block.content, card.cardType);
  // En una tarjeta básica con bullets hijos la respuesta ya son los hijos
  // (scanPages usa formatChildAnswerList); mostrar «Respuesta» es un cuadro
  // vacío que además invita a sobreescribirla. Solo se muestra si hay `::`.
  const answerFromChildren = isBasic && target.block.children.length > 0 && !fields.answer;
  if (cardEditorQuestionField) cardEditorQuestionField.hidden = !isBasic;
  if (cardEditorAnswerField) cardEditorAnswerField.hidden = !isBasic || answerFromChildren;
  // En cloze la raíz se edita dentro del minieditor, junto a sus bullets hijos.
  if (cardEditorTextField) cardEditorTextField.hidden = true;
  if (cardEditorQuestion) cardEditorQuestion.value = fields.question;
  if (cardEditorAnswer) cardEditorAnswer.value = fields.answer;
  if (cardEditorText) cardEditorText.value = fields.text;
  if (cardEditorTitle) cardEditorTitle.innerText = translate("Editar tarjeta");
  cardEditorTarget = {
    cardId: card.id,
    pageId: target.page.id,
    blockId: card.blockId,
    cardType: card.cardType,
    initialBlock: target.block,
    currentBlock: target.block,
  };
  renderCardEditorRows(target.block, !isBasic);
  host.mountOverlay(cardEditorOverlay);
  window.setTimeout(() => {
    if (isBasic && !cardEditorAnswerField?.hidden) cardEditorAnswer?.focus();
    else if (isBasic) cardEditorQuestion?.focus();
    else cardEditorRows?.querySelector<HTMLTextAreaElement>("textarea:not([readonly])")?.focus();
  }, 30);
}

export function closeCardEditor(): void {
  cardEditorTarget = null;
  if (cardEditorOverlay) host.unmountOverlay(cardEditorOverlay);
}

/** Abre el editor de oclusión de escritorio sin perder la tarjeta en repaso. */
function openReviewOcclusionEditor(card: Flashcard): void {
  const target = host.findReviewCardBlock(card);
  if (!target) {
    showToast(translate("No se encontró el bloque de la tarjeta."));
    return;
  }
  const source = card.imageSource
    || parseImageOcclusions(target.block.content).find((region) => region.source)?.source;
  if (!source) {
    showToast(translate("No se encontró el bloque de la tarjeta."));
    return;
  }
  host.setImageOcclusionFromReview({
    cardId: card.id,
    revealed: host.getFlashcardsManager().isRevealed(),
  });
  host.openImageOcclusionEditor(target.block.id, source);
}

async function saveCardEditor(): Promise<void> {
  if (!cardEditorTarget || !btnSaveCardEditor) return;
  commitCardEditorFields();
  const { cardId, pageId, blockId, cardType, currentBlock } = cardEditorTarget;
  const fields = cardEditorFields();
  const required = cardType === "basic"
    ? fields.question.trim()
    : FlashcardsManager.readEditableFields(currentBlock.content, "cloze").text.trim();
  if (!required) {
    showToast(translate(cardType === "basic"
      ? "La pregunta no puede estar vacía."
      : "El texto no puede estar vacío."));
    return;
  }
  const page = host.getPages().find((candidate) => candidate.id === pageId);
  if (!page) {
    showToast(translate("La nota ya no está disponible."));
    return;
  }
  const location = findNodeLocation(page.blocks, blockId);
  if (!location) {
    showToast(translate("No se encontró el bloque de la tarjeta."));
    return;
  }
  const previous = location.parentList[location.index];
  location.parentList[location.index] = currentBlock;
  btnSaveCardEditor.disabled = true;
  try {
    await host.savePage(page, true);
    host.captureHistory(page.id, page.blocks, page.title);
    const revealed = host.getFlashcardsManager().isRevealed();
    host.getFlashcardsManager().refreshCard(host.getPages(), cardId, host.getReviewOrder(), revealed);
    closeCardEditor();
    host.updateFlashcardUI();
    showToast(translate("Tarjeta guardada. Propiedades y nota intactas."));
  } catch (error) {
    location.parentList[location.index] = previous;
    console.error("No se pudo guardar la edición de la tarjeta:", error);
    showToast(translate("No se pudo guardar la tarjeta. Revisa los permisos de la bóveda."));
  } finally {
    btnSaveCardEditor.disabled = false;
  }
}

btnEditFlashcard?.addEventListener("click", openCardEditor);
btnCloseCardEditor?.addEventListener("click", closeCardEditor);
btnCancelCardEditor?.addEventListener("click", closeCardEditor);
btnSaveCardEditor?.addEventListener("click", () => {
  void saveCardEditor();
});
cardEditorOverlay?.addEventListener("click", (event) => {
  if (event.target === cardEditorOverlay) closeCardEditor();
});

