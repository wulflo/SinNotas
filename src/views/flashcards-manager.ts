import { Flashcard, PageData, BlockNode, FlashcardType, ImageOcclusionRegion } from "../types";
import { CardState, FSRSEngine, FSRSItem, FSRSRating } from "../editor/fsrs";
import {
  isSystemPropertyLine,
  renderMarkdownToHtml,
  stripCardTag,
  stripSystemProperties,
  stripTaskStatus,
} from "../editor/markdown";
import { parseImageOcclusions } from "../editor/image-occlusion";

export type FlashcardReviewOrder = "new-first" | "reviews-first" | "mixed";

/** Texto plano normalizado para buscar dentro de una tarjeta. */
function normalizeCardSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Campos editables de una tarjeta, separados de sus propiedades y prefijo. */
export interface EditableCardFields {
  question: string;
  answer: string;
  /** Para cloze: el texto completo (pregunta y respuesta comparten fuente). */
  text: string;
}

/**
 * Programación FSRS de un bloque, sin el texto de la tarjeta.
 *
 * El diario de repasos de `progress/` guarda estos valores para poder
 * deshacer/rehacer un repaso sin almacenar el contenido de las notas.
 */
export interface CardScheduleSnapshot {
  stability?: number;
  difficulty?: number;
  reps?: number;
  lapses?: number;
  lastReviewDate?: string;
  intervalDays?: number;
  easeFactor?: number;
  dueDate?: string;
  state?: CardState;
  learningStep?: number;
}

/**
 * Reconstruye el estado de una instantánea antigua que aún no guardaba
 * `card-state`. Las tarjetas con paso de aprendizaje son Learning, las que ya
 * tienen repasos son Review y el resto New.
 */
function inferSnapshotState(snapshot: CardScheduleSnapshot): CardState | undefined {
  if (snapshot.state !== undefined) return snapshot.state;
  if (!snapshot.lastReviewDate) return undefined;
  if (snapshot.learningStep !== undefined) return 1;
  if (snapshot.reps !== undefined) return snapshot.reps > 0 ? 2 : 0;
  return 2;
}

/**
 * Separa un bloque de tarjeta en prefijo de tarea, cuerpo visible y
 * propiedades. Las propiedades (`card-s::`, `image-occlusions::`, etc.) se
 * conservan como líneas literales para no perder datos de FSRS ni de otras
 * vistas al editar una tarjeta.
 */
export function splitCardSource(content: string): {
  prefix: string;
  body: string;
  properties: string[];
  hadCardTag: boolean;
} {
  const textLines: string[] = [];
  const properties: string[] = [];
  let sawBody = false;
  content.replace(/\r\n?/g, "\n").split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    // Las propiedades conocidas (`card-s::`, `last-reviewed::`…) se reconocen
    // siempre. Cualquier otra línea `clave:: valor` solo se considera propiedad
    // después del cuerpo, para no confundir una tarjeta escrita como
    // `Pregunta::Respuesta` (sin espacios) con una propiedad.
    const looksLikeProperty = /^[\w-]+::/i.test(line);
    if (line && (isSystemPropertyLine(line) || (sawBody && looksLikeProperty))) {
      properties.push(line);
      return;
    }
    textLines.push(rawLine);
    if (line) sawBody = true;
  });

  const text = textLines.join("\n").trimEnd();
  const taskPrefix = text.match(/^(TODO|LATER|DOING|NOW|DONE)\s+/i)?.[0] ?? "";
  const body = taskPrefix ? text.slice(taskPrefix.length) : text;
  return {
    prefix: taskPrefix,
    body,
    properties,
    hadCardTag: /#card\b/i.test(body),
  };
}

function joinCardSource(prefix: string, body: string, properties: string[]): string {
  const visible = `${prefix}${body}`.trimEnd();
  return `${visible}${properties.length > 0 ? `\n${properties.join("\n")}` : ""}`;
}

export class FlashcardsManager {
  /** Todas las tarjetas detectadas en la bóveda, sin aplicar el filtro de notas. */
  private allCards: Flashcard[] = [];
  /** Subconjunto de `allCards` limitado a las notas permitidas por el filtro. */
  private cards: Flashcard[] = [];
  private reviewCards: Flashcard[] = [];
  private currentIndex = 0;
  private isAnswerRevealed = false;
  private fsrs = new FSRSEngine();
  private allowedPages: Set<string> | null = null;
  /**
   * Cuando está activo, la cola incluye también las tarjetas que todavía no
   * vencen. Lo usa el modo Aprendizaje para poder repasar toda la bóveda sin
   * tocar el calendario FSRS.
   */
  private includeAllCards = false;

  constructor() {}

  /**
   * Define qué notas (páginas) pueden aportar tarjetas a la sesión de repaso.
   * `null` = todas las notas; un array de títulos (aunque esté vacío) = solo esas
   * páginas, y un array vacío significa "ninguna nota".
   * Cada nota actúa como un "pseudo mazo" que contiene sus flashcards.
   */
  public setPageFilter(pageTitles: string[] | null): void {
    this.allowedPages = pageTitles === null ? null : new Set(pageTitles);
  }

  /** Devuelve el filtro de notas activo, o null cuando se repasan todas las notas. */
  public getPageFilter(): string[] | null {
    return this.allowedPages ? Array.from(this.allowedPages).sort() : null;
  }

  /**
   * Incluye en la cola todas las tarjetas del filtro actual, aunque no estén
   * vencidas. Es la base del modo Aprendizaje y también permite repasar de
   * verdad, en la misma sesión, las tarjetas que se acaban de practicar.
   */
  public setIncludeAllCards(include: boolean, order: FlashcardReviewOrder = "new-first"): void {
    this.includeAllCards = include;
    this.applyPageFilter(order);
  }

  /**
   * Reconstruye la cola con todas las tarjetas del filtro actual, ignorando
   * temporalmente su fecha de vencimiento. No cambia `includeAllCards`: los
   * escaneos posteriores vuelven al comportamiento normal si se desactivó el
   * modo Aprendizaje.
   */
  public restartWithAllCards(order: FlashcardReviewOrder = "new-first"): void {
    this.reviewCards = this.orderReviewCards(this.cards, order);
    this.currentIndex = 0;
    this.isAnswerRevealed = false;
  }

  /** Devuelve los títulos de las notas que contienen al menos una flashcard
   * (ignora el filtro de revisión para que el selector nunca se encoge). */
  public getPagesWithCards(): string[] {
    return Array.from(new Set(this.allCards.map((card) => card.pageTitle))).sort();
  }

  /** Devuelve la cantidad de flashcards detectadas en una nota dada (sin filtrar). */
  public getCardCountForPage(pageTitle: string): number {
    return this.allCards.filter((card) => card.pageTitle === pageTitle).length;
  }

  /** Extract FSRS metadata stored in block properties (e.g. card-s:: 2.5) */
  private parseBlockFSRS(content: string): FSRSItem {
    const sMatch = content.match(/card-s::\s*([\d.]+)/i);
    const dMatch = content.match(/card-d::\s*([\d.]+)/i);
    const repsMatch = content.match(/card-reps::\s*(\d+)/i);
    const lapsesMatch = content.match(/card-lapses::\s*(\d+)/i);
    const lastReviewedMatch = content.match(/last-reviewed::\s*(\S+)/i);
    const stateMatch = content.match(/card-state::\s*([0-3])/i);
    const learningStepMatch = content.match(/card-learn-step::\s*(\d+)/i);

    const stability = sMatch ? parseFloat(sMatch[1]) : 0;
    const difficulty = dMatch ? parseFloat(dMatch[1]) : 5.0;
    const reps = repsMatch ? parseInt(repsMatch[1], 10) : 0;
    const lapses = lapsesMatch ? parseInt(lapsesMatch[1], 10) : 0;
    const learningStep = learningStepMatch ? parseInt(learningStepMatch[1], 10) : undefined;

    // Las tarjetas antiguas no guardaban `card-state`. Si tienen un paso de
    // aprendizaje, hay que reconstruir el estado Learning; antes se infería
    // Review en cuanto reps > 0 y la tarjeta saltaba de fase al recargar.
    const state: CardState = stateMatch
      ? (Number(stateMatch[1]) as CardState)
      : learningStep !== undefined && (reps > 0 || lastReviewedMatch)
        ? 1
        : reps === 0
          ? 0
          : 2;

    return {
      stability: stability || 0.4,
      difficulty: difficulty || 5.0,
      reps,
      lapses,
      state,
      ...(lastReviewedMatch ? { lastReviewDate: lastReviewedMatch[1] } : {}),
      ...(learningStep !== undefined ? { learningStep } : {}),
    };
  }

  private parseIntervalDays(content: string): number {
    const match = content.match(/interval-days::\s*([\d.]+)|card-last-interval::\s*([\d.]+)\s*d?/i);
    if (!match) return 0;
    const days = Number(match[1] || match[2]);
    return Number.isFinite(days) && days >= 0 ? days : 0;
  }

  private parseEaseFactor(content: string): number {
    const match = content.match(/ease-factor::\s*([\d.]+)/i);
    if (!match) return 2.5;
    const easeFactor = Number(match[1]);
    return Number.isFinite(easeFactor) && easeFactor >= 1.3 ? easeFactor : 2.5;
  }

  private parseDueDate(content: string): string | undefined {
    const match = content.match(/due-date::\s*(\S+)/i);
    return match?.[1];
  }

  private parseCreatedAt(content: string): string | undefined {
    const match = content.match(/created-at::\s*(\S+)/i);
    return match?.[1];
  }

  private isDue(card: Flashcard, now: Date): boolean {
    const lastReviewed = card.fsrs.lastReviewDate;
    if (!lastReviewed) return true;

    const reviewedAt = Date.parse(lastReviewed);
    if (!Number.isFinite(reviewedAt)) return true;

    const dueDate = card.dueDate ? Date.parse(card.dueDate) : Number.NaN;
    if (Number.isFinite(dueDate) && dueDate <= now.getTime()) return true;

    const elapsedDays = (now.getTime() - reviewedAt) / 86_400_000;
    return elapsedDays >= card.lastIntervalDays;
  }

  private parseImageOcclusions(content: string): ImageOcclusionRegion[] {
    return parseImageOcclusions(content);
  }

  private getCardText(block: BlockNode): string {
    return stripCardTag(stripTaskStatus(stripSystemProperties(block.content))).trim();
  }

  /**
   * Rebuild `due-date` from the last review and the scheduled interval.
   * Returns null when the block doesn't have enough valid FSRS metadata.
   */
  public static recalculateDueDate(content: string): string | null {
    const lastReviewedMatch = content.match(/last-reviewed::\s*(\S+)/i);
    const intervalMatch = content.match(/(?:interval-days|card-last-interval)::\s*([\d.]+)/i);
    if (!lastReviewedMatch || !intervalMatch) return null;

    const reviewedAt = Date.parse(lastReviewedMatch[1]);
    const intervalDays = Number(intervalMatch[1]);
    if (!Number.isFinite(reviewedAt) || !Number.isFinite(intervalDays) || intervalDays < 0) {
      return null;
    }

    const dueDate = new Date(reviewedAt + intervalDays * 86_400_000).toISOString();
    const existingDueDate = content.match(/(?:^|\n)due-date::\s*(\S+)/i)?.[1];
    if (existingDueDate && Date.parse(existingDueDate) === Date.parse(dueDate)) return null;

    const withoutDueDate = content.replace(/\n?due-date::[^\n]*/gi, "").trimEnd();
    return `${withoutDueDate}\ndue-date:: ${dueDate}`;
  }

  /** Remove scheduling metadata so the block becomes a new card again. */
  public static clearFSRSProgress(content: string): string {
    return content
      .split(/\r?\n/)
      .filter((line) =>
        !/^(?:card-s|card-d|card-reps|card-lapses|card-last-interval|last-reviewed|interval-days|ease-factor|due-date|card-state|card-learn-step)::/i.test(
          line.trim()
        )
      )
      .join("\n")
      .trimEnd();
  }

  private orderReviewCards(cards: Flashcard[], order: FlashcardReviewOrder): Flashcard[] {
    if (order === "mixed") {
      const shuffled = [...cards];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
      }
      return shuffled;
    }

    const isNew = (card: Flashcard) => !card.fsrs.lastReviewDate || card.fsrs.reps === 0;
    const byDueDate = (left: Flashcard, right: Flashcard) => {
      const leftTime = left.dueDate ? Date.parse(left.dueDate) : Number.POSITIVE_INFINITY;
      const rightTime = right.dueDate ? Date.parse(right.dueDate) : Number.POSITIVE_INFINITY;
      const safeLeft = Number.isFinite(leftTime) ? leftTime : Number.POSITIVE_INFINITY;
      const safeRight = Number.isFinite(rightTime) ? rightTime : Number.POSITIVE_INFINITY;
      return safeLeft - safeRight || left.pageTitle.localeCompare(right.pageTitle);
    };

    const newCards = cards.filter(isNew);
    const reviewedCards = cards.filter((card) => !isNew(card)).sort(byDueDate);
    return order === "new-first"
      ? [...newCards, ...reviewedCards]
      : [...reviewedCards, ...newCards];
  }

  /**
   * Convierte los bullets hijos en una lista HTML anidada. Es importante
   * devolver HTML real (`ul`/`li`) y no líneas con `•`: el renderizador de
   * Markdown de SinNotas conserva los saltos de línea como texto plano, así
   * que las viñetas literales se veían concatenadas y sin jerarquía.
   */
  private formatChildAnswerList(blocks: BlockNode[]): string {
    const items: string[] = [];
    for (const block of blocks) {
      const text = this.getCardText(block);
      const content = text ? renderMarkdownToHtml(text) : "";
      const children = this.formatChildAnswerList(block.children || []);
      if (!content && !children) continue;
      items.push(`<li>${content}${children}</li>`);
    }
    return items.length > 0
      ? `<ul class="flashcard-answer-list">${items.join("")}</ul>`
      : "";
  }

  /**
   * Extrae únicamente las propiedades de programación FSRS del bloque.
   * Devuelve `undefined` para una tarjeta nueva sin metadatos, de modo que al
   * deshacer un repaso se puedan eliminar todas las propiedades añadidas.
   */
  public static readScheduleSnapshot(content: string): CardScheduleSnapshot {
    const readNumber = (pattern: RegExp): number | undefined => {
      const match = content.match(pattern);
      if (!match) return undefined;
      const value = Number(match[1]);
      return Number.isFinite(value) ? value : undefined;
    };
    const readText = (pattern: RegExp): string | undefined => {
      const match = content.match(pattern);
      return match?.[1] || undefined;
    };

    const snapshot: CardScheduleSnapshot = {
      stability: readNumber(/card-s::\s*([\d.]+)/i),
      difficulty: readNumber(/card-d::\s*([\d.]+)/i),
      reps: readNumber(/card-reps::\s*(\d+)/i),
      lapses: readNumber(/card-lapses::\s*(\d+)/i),
      lastReviewDate: readText(/last-reviewed::\s*(\S+)/i),
      intervalDays: readNumber(/(?:interval-days|card-last-interval)::\s*([\d.]+)/i),
      easeFactor: readNumber(/ease-factor::\s*([\d.]+)/i),
      dueDate: readText(/due-date::\s*(\S+)/i),
      state: readNumber(/card-state::\s*([0-3])/i) as CardState | undefined,
      learningStep: readNumber(/card-learn-step::\s*(\d+)/i),
    };

    return Object.fromEntries(
      Object.entries(snapshot).filter(([, value]) => value !== undefined)
    ) as CardScheduleSnapshot;
  }

  /**
   * Reemplaza solo las propiedades FSRS de un bloque. Se usa para restaurar
   * el estado anterior/posterior de un repaso conservando el texto, la tarea,
   * la etiqueta #card, las oclusiones y cualquier otra propiedad.
   */
  public static applyScheduleSnapshot(content: string, snapshot: CardScheduleSnapshot): string {
    const cleaned = content
      .replace(/\n?card-s::[^\n]*/gi, "")
      .replace(/\n?card-d::[^\n]*/gi, "")
      .replace(/\n?card-reps::[^\n]*/gi, "")
      .replace(/\n?card-lapses::[^\n]*/gi, "")
      .replace(/\n?card-last-interval::[^\n]*/gi, "")
      .replace(/\n?last-reviewed::[^\n]*/gi, "")
      .replace(/\n?interval-days::[^\n]*/gi, "")
      .replace(/\n?ease-factor::[^\n]*/gi, "")
      .replace(/\n?due-date::[^\n]*/gi, "")
      .replace(/\n?card-state::[^\n]*/gi, "")
      .replace(/\n?card-learn-step::[^\n]*/gi, "")
      .trim();

    // Una tarjeta nueva no tiene last-reviewed: se queda sin programación.
    if (!snapshot.lastReviewDate) return cleaned;

    // Los diarios antiguos no guardaban `state`; se reconstruye para que
    // deshacer un repaso no pierda la fase Learning/Relearning.
    const state = inferSnapshotState(snapshot) ?? 0;
    const lines = [
      `card-s:: ${snapshot.stability ?? 0.4}`,
      `card-d:: ${snapshot.difficulty ?? 5}`,
      `card-reps:: ${snapshot.reps ?? 0}`,
      `card-lapses:: ${snapshot.lapses ?? 0}`,
      `last-reviewed:: ${snapshot.lastReviewDate}`,
      `interval-days:: ${snapshot.intervalDays ?? 0}`,
      `ease-factor:: ${snapshot.easeFactor ?? 2.5}`,
      `due-date:: ${snapshot.dueDate ?? snapshot.lastReviewDate}`,
      `card-state:: ${state}`,
    ];
    if (snapshot.learningStep !== undefined) {
      lines.push(`card-learn-step:: ${snapshot.learningStep}`);
    }
    return `${cleaned}\n${lines.join("\n")}`;
  }

  /** Compara dos programaciones normalizando números y fechas. */
  public static scheduleSnapshotsEqual(
    left: CardScheduleSnapshot,
    right: CardScheduleSnapshot
  ): boolean {
    const normalize = (snapshot: CardScheduleSnapshot) => ({
      stability: snapshot.stability ?? null,
      difficulty: snapshot.difficulty ?? null,
      reps: snapshot.reps ?? null,
      lapses: snapshot.lapses ?? null,
      lastReviewDate: snapshot.lastReviewDate ?? null,
      intervalDays: snapshot.intervalDays ?? null,
      easeFactor: snapshot.easeFactor ?? null,
      dueDate: snapshot.dueDate ?? null,
      state: inferSnapshotState(snapshot) ?? null,
      learningStep: snapshot.learningStep ?? null,
    });
    return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
  }

  /** Format block content with FSRS properties appended or updated */
  public static updateBlockFSRS(
    content: string,
    fsrs: FSRSItem,
    intervalDays: number,
    easeFactor: number
  ): string {
    // Strip existing FSRS properties
    let cleaned = content
      .replace(/\n?card-s::[^\n]*/gi, "")
      .replace(/\n?card-d::[^\n]*/gi, "")
      .replace(/\n?card-reps::[^\n]*/gi, "")
      .replace(/\n?card-lapses::[^\n]*/gi, "")
      .replace(/\n?card-last-interval::[^\n]*/gi, "")
      .replace(/\n?last-reviewed::[^\n]*/gi, "")
      .replace(/\n?interval-days::[^\n]*/gi, "")
      .replace(/\n?ease-factor::[^\n]*/gi, "")
      .replace(/\n?due-date::[^\n]*/gi, "")
      .replace(/\n?card-state::[^\n]*/gi, "")
      .replace(/\n?card-learn-step::[^\n]*/gi, "")
      .trim();

    const lastReviewed = fsrs.lastReviewDate || new Date().toISOString();
    const dueDate = new Date(Date.parse(lastReviewed) + intervalDays * 86_400_000).toISOString();
    const props = `\ncard-s:: ${fsrs.stability}\ncard-d:: ${fsrs.difficulty}\ncard-reps:: ${fsrs.reps}\ncard-lapses:: ${fsrs.lapses}\nlast-reviewed:: ${lastReviewed}\ninterval-days:: ${intervalDays}\nease-factor:: ${easeFactor}\ndue-date:: ${dueDate}\ncard-state:: ${fsrs.state}${fsrs.learningStep !== undefined ? `\ncard-learn-step:: ${fsrs.learningStep}` : ""}`;
    return cleaned + props;
  }

  /**
   * Devuelve los campos editables de la tarjeta sin tocar el contenido original.
   * En tarjetas cloze no existe una separación pregunta/respuesta en el `.md`:
   * ambas se generan desde los marcadores `==...==` o `{{c1::...}}`, por lo que
   * se expone un único texto editable.
   */
  public static readEditableFields(content: string, cardType: FlashcardType): EditableCardFields {
    const { body } = splitCardSource(content);
    const clean = stripCardTag(body).trim();
    if (cardType !== "basic") {
      return { question: clean, answer: "", text: clean };
    }

    const delimiter = clean.indexOf("::");
    if (delimiter < 0) {
      return { question: clean, answer: "", text: clean };
    }
    return {
      question: clean.slice(0, delimiter).trim(),
      answer: clean.slice(delimiter + 2).trim(),
      text: clean,
    };
  }

  /**
   * Reconstruye el contenido de un bloque editando solo la pregunta/respuesta.
   *
   * Mantiene intactos el prefijo de tarea, la etiqueta `#card`, las propiedades
   * del bloque (FSRS, oclusiones, fechas…) y su orden. El llamador solo debe
   * asignar el resultado al bloque activo y guardar la página completa, de modo
   * que `save_page` reciba también el frontmatter y el resto de bloques sin
   * cambios.
   */
  public static applyCardEdit(
    content: string,
    cardType: FlashcardType,
    fields: Pick<EditableCardFields, "question" | "answer" | "text">
  ): string {
    const { prefix, body, properties, hadCardTag } = splitCardSource(content);
    const cardTag = hadCardTag ? " #card" : "";
    const cleanText = stripCardTag(body).trim();

    if (cardType !== "basic") {
      const text = stripCardTag(fields.text || fields.question || cleanText).trim();
      return joinCardSource(prefix, `${text}${cardTag}`, properties);
    }

    const existingDelimiter = cleanText.indexOf("::");
    const existingAnswer = existingDelimiter >= 0
      ? cleanText.slice(existingDelimiter + 2).trim()
      : "";
    const question = stripCardTag(fields.question || "").trim();
    const answer = fields.answer === undefined ? existingAnswer : stripCardTag(fields.answer).trim();
    const visible = answer ? `${question} :: ${answer}${cardTag}` : `${question}${cardTag}`;
    return joinCardSource(prefix, visible, properties);
  }

  /**
   * Reescanea la bóveda conservando la tarjeta activa (por id) y su estado de
   * revelado. Se usa después de editar una tarjeta para refrescar su HTML sin
   * reiniciar la sesión de repaso.
   */
  public refreshCard(
    pages: PageData[],
    cardId: string,
    order: FlashcardReviewOrder = "new-first",
    revealed = false
  ): Flashcard | null {
    this.scanVault(pages, order);
    const index = this.reviewCards.findIndex((card) => card.id === cardId);
    if (index < 0) return null;
    this.currentIndex = index;
    this.isAnswerRevealed = revealed;
    return this.reviewCards[index];
  }

  /**
   * Refresca una sola tarjeta tras cambiar la programación de su bloque
   * (deshacer/rehacer un repaso). Evita reescanear las 1.500 notas completas:
   * solo actualiza los metadatos FSRS de la tarjeta en memoria y reconstruye
   * la cola, conservando la tarjeta activa si sigue existiendo.
   */
  public refreshCardSchedule(
    cardId: string,
    blockContent: string,
    order: FlashcardReviewOrder = "new-first",
    activeCardId: string | null = null,
    revealed = false
  ): Flashcard | null {
    const card = this.allCards.find((candidate) => candidate.id === cardId);
    if (!card) return null;

    card.fsrs = this.parseBlockFSRS(blockContent);
    card.lastIntervalDays = this.parseIntervalDays(blockContent);
    card.easeFactor = this.parseEaseFactor(blockContent);
    card.createdAt = this.parseCreatedAt(blockContent);
    card.dueDate = this.parseDueDate(blockContent);

    this.applyPageFilter(order);
    const keepId = activeCardId ?? cardId;
    const index = this.reviewCards.findIndex((candidate) => candidate.id === keepId);
    if (index >= 0) {
      this.currentIndex = index;
      this.isAnswerRevealed = revealed;
    }
    return card;
  }

  /**
   * Scan entire vault for both Basic cards and Cloze deletions.
   * El escaneo siempre recorre todas las notas; el filtro de páginas se aplica
   * después, sobre el resultado, para que `allCards` siga reflejando la bóveda completa.
   */
  /**
   * Detecta tarjetas en un subconjunto de notas sin tocar el estado del
   * manager. Es la pieza que usa `FlashcardLoader` para escanear por lotes y
   * para cachear el resultado por versión del vault.
   */
  public scanPages(pages: PageData[]): Flashcard[] {
    const detected: Flashcard[] = [];

    pages.forEach((page) => {
      // Se recorre el árbol con el padre inmediato a mano para poder mostrar
      // el bullet que da contexto a la tarjeta (T16). `getAllBlocksFlat` no
      // conserva esa relación y por eso no sirve aquí.
      const allBlocks: Array<{ block: BlockNode; parent: BlockNode | null }> = [];
      const walk = (nodes: BlockNode[], parent: BlockNode | null): void => {
        nodes.forEach((node) => {
          allBlocks.push({ block: node, parent });
          if (node.children.length > 0) walk(node.children, node);
        });
      };
      walk(page.blocks, null);

      allBlocks.forEach(({ block, parent }) => {
        const rawContent = stripSystemProperties(block.content).trim();

        const imageOcclusions = this.parseImageOcclusions(block.content);
        const hasCardTag = /#card\b/i.test(rawContent);
        const hasDoubleColon = rawContent.includes("::");
        const hasAnkiCloze = /\{\{(?:c\d+::|cloze\s+)?(.*?)\}\}/i.test(rawContent);
        const hasMdCloze = /==(.*?)==/.test(rawContent);
        const createdAt = this.parseCreatedAt(block.content);
        const parentContent = this.describeParentBlock(parent);

        imageOcclusions.forEach((region, index) => {
          detected.push({
            id: `fc-image-${page.id}-${block.id}-${index + 1}`,
            pageTitle: page.title,
            blockId: block.id,
            cardType: "image-occlusion",
            question: "",
            answer: "",
            fsrs: this.parseBlockFSRS(block.content),
            lastIntervalDays: this.parseIntervalDays(block.content),
            easeFactor: this.parseEaseFactor(block.content),
            createdAt,
            dueDate: this.parseDueDate(block.content),
            imageSource: region.source,
            imageOcclusion: region,
            imageOcclusions,
            parentContent,
          });
        });

        if (!rawContent) return;

        const cardContent = stripCardTag(stripTaskStatus(rawContent)).trim();

        // A. CLOZE DELETION CARD
        if (hasAnkiCloze || hasMdCloze || (hasCardTag && (hasAnkiCloze || hasMdCloze))) {
          let questionHtml = renderMarkdownToHtml(cardContent, { cloze: "gap" });
          let answerHtml = renderMarkdownToHtml(cardContent, { cloze: "reveal" });

          if (block.children && block.children.length > 0) {
            const childNotes = this.formatChildAnswerList(block.children);
            if (childNotes) {
              answerHtml += `\n\n<div class="cloze-children-notes">${childNotes}</div>`;
            }
          }

          detected.push({
            id: `fc-cloze-${page.id}-${block.id}`,
            pageTitle: page.title,
            blockId: block.id,
            cardType: "cloze",
            question: questionHtml,
            answer: answerHtml,
            fsrs: this.parseBlockFSRS(block.content),
            lastIntervalDays: this.parseIntervalDays(block.content),
            easeFactor: this.parseEaseFactor(block.content),
            createdAt,
            dueDate: this.parseDueDate(block.content),
            parentContent,
          });
        }
        // B. BASIC CARD (:: or #card)
        else if (hasDoubleColon || hasCardTag) {
          let question = "";
          let answer = "";

          if (hasCardTag) {
            question = cardContent.split("::", 1)[0].trim();
            const childAnswers = this.formatChildAnswerList(block.children || []);
            if (childAnswers) {
              // `answer` ya es HTML (lista anidada); no debe volver a renderizarse.
              answer = childAnswers;
            } else if (hasDoubleColon) {
              answer = renderMarkdownToHtml(
                cardContent.split("::").slice(1).join("::").trim()
              );
            } else {
              answer = renderMarkdownToHtml(`Consulta los detalles en la página [[${page.title}]].`);
            }
          } else if (hasDoubleColon) {
            const parts = cardContent.split("::");
            question = parts[0].trim();
            answer = renderMarkdownToHtml(parts.slice(1).join("::").trim());
          }

          if (question) {
            detected.push({
              id: `fc-basic-${page.id}-${block.id}`,
              pageTitle: page.title,
              blockId: block.id,
              cardType: "basic",
              question: renderMarkdownToHtml(question),
              answer: answer || renderMarkdownToHtml("Sin respuesta explícita."),
              fsrs: this.parseBlockFSRS(block.content),
              lastIntervalDays: this.parseIntervalDays(block.content),
              easeFactor: this.parseEaseFactor(block.content),
              createdAt,
              dueDate: this.parseDueDate(block.content),
              parentContent,
            });
          }
        }
      });
    });

    // Índice de búsqueda listo para el explorador: evita crear un nodo DOM por
    // tarjeta en cada pulsación. Se calcula una vez por tarjeta detectada.
    detected.forEach((card) => {
      const plain = `${card.pageTitle} ${card.question} ${card.answer}`.replace(/<[^>]*>/g, " ");
      card.searchText = normalizeCardSearchText(plain);
    });

    return detected;
  }

  /**
   * Sustituye todas las tarjetas detectadas y reconstruye la cola de repaso.
   * Se llama una sola vez al terminar un escaneo completo (o al usar la caché),
   * nunca por cada lote: así el orden "mixed" no se rebaraja a mitad de carga.
   */
  public setDetectedCards(
    detected: Flashcard[],
    order: FlashcardReviewOrder = "new-first",
    preserve?: { cardId: string; revealed: boolean }
  ): void {
    this.allCards = detected;
    this.applyPageFilter(order);
    if (preserve) {
      const index = this.reviewCards.findIndex((card) => card.id === preserve.cardId);
      if (index >= 0) {
        this.currentIndex = index;
        this.isAnswerRevealed = preserve.revealed;
      }
    }
  }

  /**
   * Texto breve del bullet padre para dar contexto a una tarjeta. Se ignoran
   * imágenes (no aportan texto legible), las propiedades del sistema y la
   * respuesta de una tarjeta padre (`::`). Devuelve undefined si no queda nada
   * útil, para que la interfaz no muestre una línea vacía.
   */
  private describeParentBlock(parent: BlockNode | null): string | undefined {
    if (!parent || parent.type === "image") return undefined;
    const raw = stripSystemProperties(parent.content).trim();
    if (!raw) return undefined;
    const prompt = stripCardTag(stripTaskStatus(raw)).split("::", 1)[0].trim();
    if (!prompt) return undefined;
    // Markdown básico a texto plano: la interfaz lo pinta con textContent.
    const plain = prompt
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[`*_~>#]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!plain) return undefined;
    return plain.length > 180 ? `${plain.slice(0, 177).trimEnd()}…` : plain;
  }

  /**
   * Reconstruye la cola con las tarjetas que vencen ahora mismo, respetando el
   * filtro de notas y el modo Aprendizaje. La usa la vista al terminar una
   * sesión: si alguna tarjeta programada ya venció (por ejemplo, un "Otra vez"
   * con paso corto), se continúa sin reiniciar a mano (T23).
   */
  public refreshDueQueue(order: FlashcardReviewOrder = "new-first"): number {
    this.applyPageFilter(order);
    return this.reviewCards.length;
  }

  /** Número de tarjetas que entrarían en la cola si se reconstruyera ahora. */
  public countDueCards(): number {
    const filtered = this.allowedPages
      ? this.allCards.filter((card) => this.allowedPages!.has(card.pageTitle))
      : this.allCards;
    const sessionCards = this.includeAllCards
      ? filtered
      : filtered.filter((card) => this.isDue(card, new Date()));
    return sessionCards.length;
  }

  public scanVault(
    pages: PageData[],
    order: FlashcardReviewOrder = "new-first",
    preserve?: { cardId: string; revealed: boolean }
  ): Flashcard[] {
    this.setDetectedCards(this.scanPages(pages), order, preserve);
    return this.reviewCards;
  }

  /** Aplica el filtro de notas sobre `allCards` y reconstruye la cola de repaso. */
  private applyPageFilter(order: FlashcardReviewOrder): void {
    this.cards = this.allowedPages
      ? this.allCards.filter((card) => this.allowedPages!.has(card.pageTitle))
      : this.allCards;
    const sessionCards = this.includeAllCards
      ? this.cards
      : this.cards.filter((card) => this.isDue(card, new Date()));
    this.reviewCards = this.orderReviewCards(sessionCards, order);
    this.currentIndex = 0;
    this.isAnswerRevealed = false;
  }

  public getCardsCount(): number {
    return this.reviewCards.length;
  }

  /** Total de tarjetas detectadas en la bóveda, sin aplicar el filtro de notas. */
  public getAllCardsCount(): number {
    return this.allCards.length;
  }

  /** Tarjetas incluidas en el filtro de revisión activo. */
  public getCards(): readonly Flashcard[] {
    return this.cards;
  }

  /** Todas las tarjetas de la bóveda, ignorando el filtro de revisión. */
  public getAllCards(): readonly Flashcard[] {
    return this.allCards;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCurrentCard(): Flashcard | null {
    if (this.currentIndex >= this.reviewCards.length) return null;
    return this.reviewCards[this.currentIndex];
  }

  /**
   * Devuelve el id de la tarjeta que sigue a `cardId` en la cola de repaso
   * actual (`reviewCards`), o null si no está en la cola o es la última.
   *
   * Se usa al rehacer un repaso: hay que calcular el "next" ANTES de refrescar,
   * porque `refreshCardSchedule` reconstruye la cola y muda los índices.
   */
  public getNextCardId(cardId: string): string | null {
    const index = this.reviewCards.findIndex((card) => card.id === cardId);
    if (index < 0 || index >= this.reviewCards.length - 1) return null;
    return this.reviewCards[index + 1].id;
  }

  public reveal(): void {
    this.isAnswerRevealed = true;
  }

  public isRevealed(): boolean {
    return this.isAnswerRevealed;
  }

  /**
   * Preview future FSRS outcomes for all 4 ratings (Again, Hard, Good, Easy)
   */
  public getRatingPreviews(): Record<FSRSRating, { intervalDays: number; intervalText: string }> | null {
    const card = this.getCurrentCard();
    if (!card) return null;

    const previews = this.fsrs.previewRatings(card.fsrs, this.elapsedDays(card));
    return {
      1: { intervalDays: previews[1].intervalDays, intervalText: previews[1].intervalText },
      2: { intervalDays: previews[2].intervalDays, intervalText: previews[2].intervalText },
      3: { intervalDays: previews[3].intervalDays, intervalText: previews[3].intervalText },
      4: { intervalDays: previews[4].intervalDays, intervalText: previews[4].intervalText },
    };
  }

  /**
   * Apply FSRS rating (1: Again, 2: Hard, 3: Good, 4: Easy).
   *
   * `persist = false` avanza la sesión pero no modifica la programación de la
   * tarjeta. Es lo que usa el modo Aprendizaje: así, al desactivarlo, las
   * tarjetas conservan su estado FSRS y vuelven a estar disponibles para un
   * repaso real.
   */
  public rate(
    rating: FSRSRating,
    persist = true
  ): {
    card: Flashcard;
    fsrs: FSRSItem;
    intervalDays: number;
    easeFactor: number;
  } | null {
    const card = this.getCurrentCard();
    if (!card) return null;

    const previews = this.fsrs.previewRatings(card.fsrs, this.elapsedDays(card));
    const chosen = previews[rating];

    if (persist) {
      card.fsrs = chosen.item;
      card.lastIntervalDays = chosen.intervalDays;
      card.easeFactor = Math.max(
        1.3,
        card.easeFactor + (rating === 1 ? -0.2 : rating === 2 ? -0.15 : rating === 4 ? 0.15 : 0)
      );
      card.dueDate = new Date(
        Date.parse(chosen.item.lastReviewDate || new Date().toISOString()) +
          chosen.intervalDays * 86_400_000
      ).toISOString();
    }

    this.currentIndex += 1;
    this.isAnswerRevealed = false;

    return {
      card,
      fsrs: chosen.item,
      intervalDays: chosen.intervalDays,
      easeFactor: card.easeFactor,
    };
  }

  private elapsedDays(card: Flashcard): number {
    if (!card.fsrs.lastReviewDate) return 0;
    const reviewedAt = Date.parse(card.fsrs.lastReviewDate);
    if (!Number.isFinite(reviewedAt)) return 0;
    return Math.max(0, (Date.now() - reviewedAt) / 86_400_000);
  }

  public restart(): void {
    this.currentIndex = 0;
    this.isAnswerRevealed = false;
  }
}
