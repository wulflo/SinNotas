import { describe, expect, it } from "vitest";
import { FlashcardsManager } from "./flashcards-manager";
import { BlockNode, PageData } from "../types";

function makePage(id: string, title: string, cardContent: string): PageData {
  const block: BlockNode = { id: `${id}-b1`, type: "text", content: cardContent, children: [] };
  return { id, title, path: `notes/${title}.md`, blocks: [block] };
}

const pages: PageData[] = [
  makePage("p1", "Nota A", "Pregunta A :: Respuesta A"),
  makePage("p2", "Nota B", "Pregunta B :: Respuesta B"),
];

describe("FlashcardsManager - refresco incremental tras deshacer", () => {
  const pages: PageData[] = [
    makePage("p1", "Nota A", "Pregunta A :: Respuesta A"),
    makePage("p2", "Nota B", "Pregunta B :: Respuesta B"),
  ];

  it("actualiza solo la tarjeta indicada y conserva la tarjeta activa", () => {
    const manager = new FlashcardsManager();
    manager.scanVault(pages, "new-first");
    const [first, second] = manager.getAllCards();

    // Simula un repaso: la tarjeta activa pasa a ser la segunda.
    manager.rate(3);
    expect(manager.getCurrentCard()?.id).toBe(second.id);

    const content = `Pregunta A :: Respuesta A
last-reviewed:: 2026-10-24T00:00:00.000Z
interval-days:: 30
due-date:: 2026-11-23T00:00:00.000Z`;

    const refreshed = manager.refreshCardSchedule(
      first.id,
      content,
      "new-first",
      second.id,
      false
    );

    expect(refreshed?.fsrs.lastReviewDate).toBe("2026-10-24T00:00:00.000Z");
    expect(refreshed?.dueDate).toBe("2026-11-23T00:00:00.000Z");
    // La tarjeta actual no se pierde aunque la deshecha salga de la cola.
    expect(manager.getCurrentCard()?.id).toBe(second.id);
    // La primera ya no está vencida y no vuelve a la cola de repaso.
    expect(manager.getCardsCount()).toBe(1);
  });
});

describe("FlashcardsManager - siguiente tarjeta e ida a la deshecha", () => {
  const pages: PageData[] = [
    makePage("p1", "Nota A", "Pregunta A :: Respuesta A"),
    makePage("p2", "Nota B", "Pregunta B :: Respuesta B"),
    makePage("p3", "Nota C", "Pregunta C :: Respuesta C"),
  ];

  it("getNextCardId devuelve la siguiente de la cola", () => {
    const manager = new FlashcardsManager();
    manager.scanVault(pages, "new-first");
    const ids = manager.scanVault(pages, "new-first").map((card) => card.id);

    expect(manager.getNextCardId(ids[0])).toBe(ids[1]);
  });

  it("getNextCardId devuelve null en la última y para un id inexistente", () => {
    const manager = new FlashcardsManager();
    const queue = manager.scanVault(pages, "new-first");
    const last = queue[queue.length - 1];

    expect(manager.getNextCardId(last.id)).toBeNull();
    expect(manager.getNextCardId("id-que-no-existe")).toBeNull();
  });

  it("refreshCardSchedule con activeCardId = la deshecha la deja como actual sin revelar", () => {
    const manager = new FlashcardsManager();
    const queue = manager.scanVault(pages, "new-first");
    const [first, second] = queue;

    // Puntúa A; la sesión avanza a B.
    manager.rate(3);
    expect(manager.getCurrentCard()?.id).toBe(second.id);
    manager.reveal();

    // Deshacer: el contenido vuelve al estado previo al repaso, así que A vuelve
    // a estar vencida; el refresco recibe la tarjeta deshecha como activa.
    const undoneContent = "Pregunta A :: Respuesta A";
    manager.refreshCardSchedule(first.id, undoneContent, "new-first", first.id, false);

    expect(manager.getCurrentCard()?.id).toBe(first.id);
    expect(manager.isRevealed()).toBe(false);
  });
});

describe("FlashcardsManager - filtro de notas", () => {
  it("escanea todas las notas y las lista aunque haya filtro activo", () => {
    const manager = new FlashcardsManager();
    manager.setPageFilter(["Nota A"]);
    const cards = manager.scanVault(pages, "new-first");

    // La sesión de repaso solo incluye la nota filtrada...
    expect(cards).toHaveLength(1);
    expect(cards[0].pageTitle).toBe("Nota A");
    expect(manager.getCards()).toHaveLength(1);

    // ...pero el selector sigue mostrando todas las notas con tarjetas.
    expect(manager.getPagesWithCards()).toEqual(["Nota A", "Nota B"]);
    expect(manager.getCardCountForPage("Nota B")).toBe(1);
    expect(manager.getAllCardsCount()).toBe(2);
  });

  it("cambiar el filtro y rescanear actualiza la sesión sin perder páginas", () => {
    const manager = new FlashcardsManager();
    manager.scanVault(pages, "new-first");
    expect(manager.getCardsCount()).toBe(2);

    manager.setPageFilter(["Nota B"]);
    const cards = manager.scanVault(pages, "new-first");
    expect(cards).toHaveLength(1);
    expect(cards[0].pageTitle).toBe("Nota B");
    expect(manager.getPagesWithCards()).toEqual(["Nota A", "Nota B"]);

    manager.setPageFilter(null);
    expect(manager.scanVault(pages, "new-first")).toHaveLength(2);
  });

  it("una selección vacía significa 'ninguna nota', no 'todas'", () => {
    const manager = new FlashcardsManager();
    manager.setPageFilter([]);
    const cards = manager.scanVault(pages, "new-first");
    expect(cards).toHaveLength(0);
    expect(manager.getAllCardsCount()).toBe(2);
  });

  it("getPageFilter refleja el filtro activo", () => {
    const manager = new FlashcardsManager();
    manager.setPageFilter(["Nota B"]);
    manager.scanVault(pages, "new-first");
    expect(manager.getPageFilter()).toEqual(["Nota B"]);

    manager.setPageFilter(null);
    manager.scanVault(pages, "new-first");
    expect(manager.getPageFilter()).toBeNull();
  });
});

describe("FlashcardsManager - edición de tarjetas", () => {
  it("edita pregunta y respuesta conservando propiedades FSRS y la etiqueta #card", () => {
    const content = [
      "TODO Pregunta original :: Respuesta original #card",
      "card-s:: 2.5",
      "card-d:: 4.1",
      "card-reps:: 7",
      "last-reviewed:: 2026-10-20T10:00:00.000Z",
      "due-date:: 2026-10-30T10:00:00.000Z",
      "created-at:: 2026-01-01T00:00:00.000Z",
    ].join("\n");

    const updated = FlashcardsManager.applyCardEdit(content, "basic", {
      question: "  Pregunta nueva  ",
      answer: "  Respuesta nueva  ",
      text: "",
    });

    expect(updated.split("\n")[0]).toBe("TODO Pregunta nueva :: Respuesta nueva #card");
    expect(updated).toContain("card-s:: 2.5");
    expect(updated).toContain("card-d:: 4.1");
    expect(updated).toContain("card-reps:: 7");
    expect(updated).toContain("last-reviewed:: 2026-10-20T10:00:00.000Z");
    expect(updated).toContain("due-date:: 2026-10-30T10:00:00.000Z");
    expect(updated).toContain("created-at:: 2026-01-01T00:00:00.000Z");
    expect(updated).toContain("#card");
  });

  it("conserva oclusiones y propiedades desconocidas al editar una tarjeta básica", () => {
    const content = [
      "Pregunta :: Respuesta",
      "image-occlusions:: [{\"source\":\"img.png\",\"x\":0.1,\"y\":0.2,\"width\":0.3,\"height\":0.4}]",
      "propiedad-personalizada:: valor",
    ].join("\n");

    const updated = FlashcardsManager.applyCardEdit(content, "basic", {
      question: "Nueva pregunta",
      answer: "",
      text: "",
    });

    expect(updated).toContain("Nueva pregunta");
    expect(updated).not.toContain("Respuesta");
    expect(updated).toContain("image-occlusions::");
    expect(updated).toContain("propiedad-personalizada:: valor");
  });

  it("edita texto cloze sin perder marcadores ni propiedades", () => {
    const content = [
      "El algoritmo usa ==estabilidad== y {{c1::dificultad}}. #card",
      "card-s:: 1.2",
      "card-learn-step:: 0",
    ].join("\n");

    const fields = FlashcardsManager.readEditableFields(content, "cloze");
    expect(fields.text).toContain("==estabilidad==");
    expect(fields.question).toBe(fields.text);

    const updated = FlashcardsManager.applyCardEdit(content, "cloze", {
      question: fields.text,
      answer: "",
      text: "El algoritmo usa ==estabilidad==, ==dificultad== y ==lapsos==. #card",
    });

    expect(updated.split("\n")[0]).toBe(
      "El algoritmo usa ==estabilidad==, ==dificultad== y ==lapsos==. #card"
    );
    expect(updated).toContain("card-s:: 1.2");
    expect(updated).toContain("card-learn-step:: 0");
  });

  it("readEditableFields separa la primera aparición de :: y respeta #card", () => {
    const fields = FlashcardsManager.readEditableFields(
      "¿Qué es A? :: B :: C #card\ncard-s:: 1",
      "basic"
    );
    expect(fields.question).toBe("¿Qué es A?");
    expect(fields.answer).toBe("B :: C");
  });

  it("no confunde una tarjeta sin espacios con una propiedad", () => {
    const content = "Pregunta::Respuesta #card\ncard-s:: 1.5";
    const fields = FlashcardsManager.readEditableFields(content, "basic");
    expect(fields.question).toBe("Pregunta");
    expect(fields.answer).toBe("Respuesta");

    const updated = FlashcardsManager.applyCardEdit(content, "basic", {
      question: "Pregunta editada",
      answer: "Respuesta editada",
      text: "",
    });
    expect(updated.split("\n")[0]).toBe("Pregunta editada :: Respuesta editada #card");
    expect(updated).toContain("card-s:: 1.5");
  });

  it("refreshCard conserva la tarjeta activa tras una edición", () => {
    const editablePages: PageData[] = [
      makePage("p1", "Nota A", "Pregunta A :: Respuesta A"),
      makePage("p2", "Nota B", "Pregunta B :: Respuesta B"),
    ];
    const manager = new FlashcardsManager();
    manager.scanVault(editablePages, "new-first");
    manager.reveal();
    manager.rate(3);
    const active = manager.getCurrentCard();
    expect(active?.blockId).toBe("p2-b1");

    editablePages[1].blocks[0].content = "Pregunta B editada :: Respuesta B";
    manager.refreshCard(editablePages, active!.id, "new-first", true);

    expect(manager.getCurrentCard()?.blockId).toBe("p2-b1");
    expect(manager.getCurrentCard()?.question).toContain("Pregunta B editada");
    expect(manager.isRevealed()).toBe(true);
  });
});

describe("FlashcardsManager - instantáneas FSRS para deshacer repasos", () => {
  const reviewedContent = [
    "Pregunta :: Respuesta #card",
    "card-s:: 3.17",
    "card-d:: 5.28",
    "card-reps:: 1",
    "card-lapses:: 0",
    "last-reviewed:: 2026-10-24T14:00:00.000Z",
    "interval-days:: 0.006944444444444444",
    "ease-factor:: 2.5",
    "due-date:: 2026-10-24T14:10:00.000Z",
    "card-learn-step:: 1",
    "image-occlusions:: 0.1,0.1,0.2,0.2,#ff0000",
  ].join("\n");

  it("extrae y restaura solo la programación sin tocar texto ni oclusiones", () => {
    const snapshot = FlashcardsManager.readScheduleSnapshot(reviewedContent);
    expect(snapshot.reps).toBe(1);
    expect(snapshot.lastReviewDate).toBe("2026-10-24T14:00:00.000Z");
    expect(snapshot.intervalDays).toBeCloseTo(0.006944444444444444);

    const cleared = FlashcardsManager.applyScheduleSnapshot(reviewedContent, {});
    expect(cleared).toContain("Pregunta :: Respuesta #card");
    expect(cleared).toContain("image-occlusions:: 0.1,0.1,0.2,0.2,#ff0000");
    expect(cleared).not.toContain("card-s::");
    expect(cleared).not.toContain("last-reviewed::");
    expect(FlashcardsManager.readScheduleSnapshot(cleared)).toEqual({});

    const restored = FlashcardsManager.applyScheduleSnapshot(cleared, snapshot);
    expect(FlashcardsManager.scheduleSnapshotsEqual(
      FlashcardsManager.readScheduleSnapshot(restored),
      snapshot
    )).toBe(true);
    expect(restored).toContain("image-occlusions:: 0.1,0.1,0.2,0.2,#ff0000");
    // Las instantáneas antiguas sin `state` se restauran como Learning porque
    // conservan el paso de aprendizaje.
    expect(restored).toContain("card-state:: 1");
  });

  it("detecta programaciones distintas para no pisar cambios de otro dispositivo", () => {
    const first = FlashcardsManager.readScheduleSnapshot(reviewedContent);
    const second = { ...first, reps: 2, lastReviewDate: "2026-10-25T10:00:00.000Z" };
    expect(FlashcardsManager.scheduleSnapshotsEqual(first, second)).toBe(false);
  });
});

describe("FlashcardsManager - persistencia del estado FSRS", () => {
  const learningContent = [
    "Pregunta :: Respuesta #card",
    "card-s:: 3.71",
    "card-d:: 5.16",
    "card-reps:: 1",
    "card-lapses:: 0",
    "last-reviewed:: 2020-01-01T00:00:00.000Z",
    "interval-days:: 0.006944444444444444",
    "ease-factor:: 2.5",
    "due-date:: 2020-01-01T00:10:00.000Z",
    "card-state:: 1",
    "card-learn-step:: 1",
  ].join("\n");

  it("conserva Learning y el paso al recargar la bóveda", () => {
    const manager = new FlashcardsManager();
    manager.scanVault([makePage("learning", "Aprendizaje", learningContent)], "new-first");

    const card = manager.getCurrentCard();
    expect(card?.fsrs).toMatchObject({ state: 1, learningStep: 1 });
  });

  it("migra tarjetas antiguas con card-learn-step a Learning", () => {
    const legacy = learningContent
      .split("\n")
      .filter((line) => !line.startsWith("card-state::"))
      .join("\n");
    const manager = new FlashcardsManager();
    manager.scanVault([makePage("legacy", "Antigua", legacy)], "new-first");

    const card = manager.getCurrentCard();
    expect(card?.fsrs).toMatchObject({ state: 1, learningStep: 1 });
  });

  it("escribe card-state al programar y lo elimina al borrar el progreso", () => {
    const updated = FlashcardsManager.updateBlockFSRS(
      "Pregunta :: Respuesta #card",
      {
        stability: 3.71,
        difficulty: 5.16,
        reps: 1,
        lapses: 0,
        state: 1,
        learningStep: 1,
        lastReviewDate: "2026-10-25T10:00:00.000Z",
      },
      0.006944444444444444,
      2.5
    );

    expect(updated).toContain("card-state:: 1");
    expect(updated).toContain("card-learn-step:: 1");
    expect(FlashcardsManager.readScheduleSnapshot(updated).state).toBe(1);

    const cleared = FlashcardsManager.clearFSRSProgress(updated);
    expect(cleared).not.toContain("card-state::");
    expect(cleared).not.toContain("card-learn-step::");
    expect(cleared).toBe("Pregunta :: Respuesta #card");
  });
});
