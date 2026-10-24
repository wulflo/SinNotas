import { describe, expect, it, vi } from "vitest";
import { FlashcardLoader, type FlashcardLoadProgress } from "./flashcard-loader";
import { FlashcardsManager } from "./flashcards-manager";
import { BlockNode, PageData } from "../types";

function makePage(id: string, title: string, cardContent: string): PageData {
  const block: BlockNode = { id: `${id}-b1`, type: "text", content: cardContent, children: [] };
  return { id, title, path: `notes/${title}.md`, blocks: [block] };
}

function makePages(count: number): PageData[] {
  return Array.from({ length: count }, (_value, index) =>
    makePage(`p${index}`, `Nota ${index}`, `Pregunta ${index} :: Respuesta ${index}`)
  );
}

function load(
  loader: FlashcardLoader,
  pages: PageData[],
  version: number,
  onProgress?: (progress: FlashcardLoadProgress) => void
): Promise<void> {
  return new Promise((resolve) => {
    loader.load(pages, version, { order: "new-first", onProgress, onDone: () => resolve() });
  });
}

describe("FlashcardLoader", () => {
  it("aplica las tarjetas al manager solo cuando termina el escaneo", async () => {
    const manager = new FlashcardsManager();
    const loader = new FlashcardLoader(manager);
    const pages = makePages(20);
    const progress: FlashcardLoadProgress[] = [];

    const done = load(loader, pages, 1, (value) => progress.push(value));
    expect(manager.getAllCardsCount()).toBe(0);
    expect(loader.isLoading()).toBe(true);

    await done;

    expect(loader.isLoading()).toBe(false);
    expect(manager.getAllCardsCount()).toBe(20);
    expect(progress.some((value) => value.done)).toBe(true);
    expect(progress[progress.length - 1]).toMatchObject({
      scannedPages: 20,
      totalPages: 20,
      cards: 20,
      done: true,
      fromCache: false,
    });
    expect(loader.getCachedCards(pages, 1)).toBe(manager.getAllCards());
  });

  it("reutiliza la caché sin volver a escanear páginas", async () => {
    const manager = new FlashcardsManager();
    const loader = new FlashcardLoader(manager);
    const pages = makePages(5);

    await load(loader, pages, 4);
    const cached = loader.getCachedCards(pages, 4);
    expect(cached).not.toBeNull();

    const scanSpy = vi.spyOn(manager, "scanPages");
    let cachedProgress: FlashcardLoadProgress | null = null;
    await load(loader, pages, 4, (value) => {
      cachedProgress = value;
    });

    expect(scanSpy).not.toHaveBeenCalled();
    expect(cachedProgress).toMatchObject({ done: true, fromCache: true, cards: 5 });
    expect(loader.getCachedCards(pages, 4)).toBe(cached);
  });

  it("rescanear tras invalidar la caché o cambiar la versión del vault", async () => {
    const manager = new FlashcardsManager();
    const loader = new FlashcardLoader(manager);
    const pages = makePages(3);

    await load(loader, pages, 1);
    const firstCards = loader.getCachedCards(pages, 1);
    expect(firstCards).not.toBeNull();

    loader.invalidate();
    expect(loader.getCachedCards(pages, 1)).toBeNull();

    const scanSpy = vi.spyOn(manager, "scanPages");
    await load(loader, pages, 2);

    expect(scanSpy).toHaveBeenCalled();
    expect(loader.getCachedCards(pages, 2)).not.toBe(firstCards);
  });

  it("completa de inmediato un vault vacío", () => {
    const manager = new FlashcardsManager();
    const loader = new FlashcardLoader(manager);
    const emptyPages: PageData[] = [];
    let done = false;

    loader.load(emptyPages, 1, {
      order: "new-first",
      onDone: () => {
        done = true;
      },
    });

    expect(done).toBe(true);
    expect(loader.isLoading()).toBe(false);
    expect(loader.getCachedCards(emptyPages, 1)).toEqual([]);
  });

  it("indexa texto plano normalizado para la búsqueda", async () => {
    const manager = new FlashcardsManager();
    const loader = new FlashcardLoader(manager);
    const pages = [
      makePage("p1", "Biología", "Pregunta <b>Ágil</b> :: Respuesta con <i>acentos</i>"),
    ];

    await load(loader, pages, 1);

    const [card] = manager.getAllCards();
    expect(card.searchText).toContain("biologia");
    expect(card.searchText).toContain("agil");
    expect(card.searchText).toContain("acentos");
    expect(card.searchText).not.toContain("<b>");
  });
});
