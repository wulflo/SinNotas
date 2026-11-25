import { describe, expect, it } from "vitest";
import { FlashcardsManager } from "./flashcards-manager";
import { BlockNode, PageData } from "../types";
import { FSRS7_DEFAULT_WEIGHTS } from "ts-fsrs/models/fsrs-7";

function makePage(id: string, title: string, cardContent: string): PageData {
  const block: BlockNode = { id: `${id}-b1`, type: "text", content: cardContent, children: [] };
  return { id, title, path: `notes/${title}.md`, blocks: [block] };
}

/** Medianoche local del día `addDays` después de una revisión ISO. */
function localMidnightAfter(reviewedIso: string, addDays: number): string {
  const due = new Date(reviewedIso);
  due.setDate(due.getDate() + addDays);
  due.setHours(0, 0, 0, 0);
  return due.toISOString();
}

/**
 * Programación repasada ayer que vence dentro de `intervalDays` días.
 * Es relativa a hoy para que la tarjeta no se vuelva "vencida" con el paso
 * del tiempo (una fecha fija acaba cayendo en el pasado y rompe el test).
 */
function futureSchedule(intervalDays = 30): { lastReviewed: string; dueDate: string } {
  const reviewed = new Date();
  reviewed.setDate(reviewed.getDate() - 1);
  reviewed.setHours(12, 0, 0, 0);
  const lastReviewed = reviewed.toISOString();
  return { lastReviewed, dueDate: localMidnightAfter(lastReviewed, intervalDays) };
}

const pages: PageData[] = [
  makePage("p1", "Nota A", "Pregunta A :: Respuesta A"),
  makePage("p2", "Nota B", "Pregunta B :: Respuesta B"),
];

describe("detección de cloze", () => {
  it("detecta {{texto}} sin prefijo de tipo", () => {
    const manager = new FlashcardsManager();
    manager.scanVault([makePage("p-cloze", "Cloze", "{{Respuesta}}")], "new-first");

    expect(manager.getAllCards()).toHaveLength(1);
    expect(manager.getAllCards()[0].cardType).toBe("cloze");
  });

  it("no hace backtracking catastrófico con llaves sin cerrar", () => {
    const manager = new FlashcardsManager();
    const malicious = makePage("p-redos", "ReDoS", "{{ ".repeat(10_000));
    const start = performance.now();

    manager.scanVault([malicious], "new-first");

    expect(performance.now() - start).toBeLessThan(500);
    expect(manager.getAllCards()).toHaveLength(0);
  });
});

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

    const schedule = futureSchedule();
    const content = `Pregunta A :: Respuesta A
last-reviewed:: ${schedule.lastReviewed}
interval-days:: 30
due-date:: ${schedule.dueDate}`;

    const refreshed = manager.refreshCardSchedule(
      first.id,
      content,
      "new-first",
      second.id,
      false
    );

    expect(refreshed?.fsrs.lastReviewDate).toBe(schedule.lastReviewed);
    expect(refreshed?.dueDate).toBe(schedule.dueDate);
    // La tarjeta actual no se pierde aunque la deshecha salga de la cola.
    expect(manager.getCurrentCard()?.id).toBe(second.id);
    // La primera ya no está vencida y no vuelve a la cola de repaso.
    expect(manager.getCardsCount()).toBe(1);
  });
});

describe("FlashcardsManager - identidad estable y cola de sesión", () => {
  it("la huella no cambia al reasignar el b-N ni al actualizar propiedades FSRS", () => {
    const before = "Pregunta :: Respuesta #card\ncard-s:: 2.4\nlast-reviewed:: 2026-11-01T00:00:00.000Z";
    const after = "Pregunta :: Respuesta #card\ncard-s:: 9.1\nlast-reviewed:: 2026-11-24T00:00:00.000Z";
    const other = "Otra pregunta :: Otra respuesta #card\ncard-s:: 2.4";

    expect(FlashcardsManager.cardFingerprint(before, "basic")).toBe(
      FlashcardsManager.cardFingerprint(after, "basic")
    );
    expect(FlashcardsManager.cardFingerprint(before, "basic")).not.toBe(
      FlashcardsManager.cardFingerprint(other, "basic")
    );
    expect(FlashcardsManager.cardFingerprint(before, "basic")).not.toBe(
      FlashcardsManager.cardFingerprint(before, "cloze")
    );
  });

  it("deshacer no reconstruye la cola: el contador de la sesión queda fijo", () => {
    const manager = new FlashcardsManager();
    manager.scanVault(pages, "new-first");
    expect(manager.getCardsCount()).toBe(2);

    const first = manager.getAllCards()[0];
    const totalBefore = manager.getCardsCount();
    const orderBefore = manager.getCards().map((card) => card.id);

    // Programación "futura" que sacaría la tarjeta de la cola de vencidas.
    const content = `${first.question ? "Pregunta A :: Respuesta A" : ""}
last-reviewed:: ${new Date().toISOString()}
interval-days:: 30
due-date:: 2099-01-01T00:00:00.000Z`;
    const updated = manager.updateCardInSession(first.id, content, first.id, false);

    expect(updated).not.toBeNull();
    expect(manager.getCardsCount()).toBe(totalBefore);
    expect(manager.getCards().map((card) => card.id)).toEqual(orderBefore);
    expect(manager.getCurrentCard()?.id).toBe(first.id);
  });
});

describe("FlashcardsManager - reprogramación FSRS", () => {
  it("recalcula intervalo y vencimiento de tarjetas en Review", () => {
    const content = `Pregunta :: Respuesta
card-s:: 30
card-d:: 5
card-state:: 2
last-reviewed:: 2026-10-01T00:00:00.000Z
interval-days:: 30
due-date:: 2026-10-31T00:00:00.000Z`;

    const updated = FlashcardsManager.rescheduleFSRS(content, {
      w: [...FSRS7_DEFAULT_WEIGHTS],
      requestRetention: 0.8,
      maximumInterval: 36500,
      learningSteps: [1 / 1440, 10 / 1440],
      relearningSteps: [10 / 1440],
    });

    expect(updated).toContain("interval-days:: 338");
    expect(updated).toContain(`due-date:: ${localMidnightAfter("2026-10-01T00:00:00.000Z", 338)}`);
  });

  it("no modifica tarjetas Learning o Relearning", () => {
    const content = "Pregunta :: Respuesta\ncard-s:: 5\ncard-state:: 1\nlast-reviewed:: 2026-10-01T00:00:00.000Z";
    expect(FlashcardsManager.rescheduleFSRS(content, {
      w: [], requestRetention: 0.9, maximumInterval: 36500, learningSteps: [], relearningSteps: [],
    })).toBeNull();
  });

  it("no reprograma una tarjeta legacy de aprendizaje sin card-state", () => {
    const content = [
      "Pregunta :: Respuesta",
      "card-s:: 5",
      "card-learn-step:: 1",
      "last-reviewed:: 2026-10-01T00:00:00.000Z",
    ].join("\n");

    expect(
      FlashcardsManager.rescheduleFSRS(content, {
        w: [...FSRS7_DEFAULT_WEIGHTS],
        requestRetention: 0.9,
        maximumInterval: 36500,
        learningSteps: [1 / 1440, 10 / 1440],
        relearningSteps: [10 / 1440],
      })
    ).toBeNull();
  });

  it("usa stabilityFast al reprogramar una tarjeta en Review", () => {
    const content = (stabilityFast: number) => [
      "Pregunta :: Respuesta",
      "card-s:: 10",
      `card-s-fast:: ${stabilityFast}`,
      "card-d:: 5",
      "card-state:: 2",
      "last-reviewed:: 2026-10-01T00:00:00.000Z",
      "interval-days:: 10",
      "due-date:: 2026-10-11T00:00:00.000Z",
    ].join("\n");
    const parameters = {
      w: [...FSRS7_DEFAULT_WEIGHTS],
      requestRetention: 0.9,
      maximumInterval: 36500,
      learningSteps: [1 / 1440, 10 / 1440],
      relearningSteps: [10 / 1440],
    };

    const slow = FlashcardsManager.rescheduleFSRS(content(8), parameters);
    const fast = FlashcardsManager.rescheduleFSRS(content(100), parameters);

    expect(slow).toContain("interval-days:: 13");
    expect(fast).toContain("interval-days:: 15");
  });

  it("añade el rastro rápido 0.8 × estabilidad si la tarjeta no lo tiene", () => {
    const content = [
      "Pregunta :: Respuesta",
      "card-s:: 30",
      "card-d:: 5",
      "card-state:: 2",
      "last-reviewed:: 2026-10-01T00:00:00.000Z",
      "interval-days:: 30",
      "due-date:: 2026-10-31T00:00:00.000Z",
    ].join("\n");
    const parameters = {
      w: [...FSRS7_DEFAULT_WEIGHTS],
      requestRetention: 0.9,
      maximumInterval: 36500,
      learningSteps: [1 / 1440, 10 / 1440],
      relearningSteps: [10 / 1440],
    };

    const updated = FlashcardsManager.rescheduleFSRS(content, parameters);
    expect(updated).toContain("card-s-fast:: 24");
    expect(updated!.match(/card-s-fast::/g)).toHaveLength(1);
  });

  it("reprograma desde hoy cuando el ancla es today", () => {
    const content = [
      "Pregunta :: Respuesta",
      "card-s:: 30",
      "card-d:: 5",
      "card-state:: 2",
      "last-reviewed:: 2020-01-01T00:00:00.000Z",
      "interval-days:: 30",
      "due-date:: 2020-01-31T00:00:00.000Z",
    ].join("\n");
    const parameters = {
      w: [...FSRS7_DEFAULT_WEIGHTS],
      requestRetention: 0.9,
      maximumInterval: 36500,
      learningSteps: [1 / 1440, 10 / 1440],
      relearningSteps: [10 / 1440],
    };
    const now = new Date(2026, 10, 21, 14, 10, 0, 0);

    const updated = FlashcardsManager.rescheduleFSRS(content, parameters, {
      anchor: "today",
      now,
    });
    const expected = new Date(now);
    expected.setDate(expected.getDate() + Number(updated!.match(/interval-days:: (\d+)/)![1]));
    expected.setHours(0, 0, 0, 0);
    expect(updated).toContain(`due-date:: ${expected.toISOString()}`);
  });

  it("mantiene el ancla last-reviewed por defecto y puede dar vencimiento pasado", () => {
    const content = [
      "Pregunta :: Respuesta",
      "card-s:: 30",
      "card-d:: 5",
      "card-state:: 2",
      "last-reviewed:: 2020-01-01T00:00:00.000Z",
      "interval-days:: 30",
      "due-date:: 2020-01-31T00:00:00.000Z",
    ].join("\n");
    const parameters = {
      w: [...FSRS7_DEFAULT_WEIGHTS],
      requestRetention: 0.9,
      maximumInterval: 36500,
      learningSteps: [1 / 1440, 10 / 1440],
      relearningSteps: [10 / 1440],
    };

    const updated = FlashcardsManager.rescheduleFSRS(content, parameters);
    const due = new Date(updated!.match(/due-date:: (\S+)/)![1]);
    expect(due.getTime()).toBeLessThan(Date.now());
    expect(updated).toContain(
      `due-date:: ${localMidnightAfter("2020-01-01T00:00:00.000Z", 55)}`
    );
  });
});

describe("FlashcardsManager - conversión FSRS-4.5 → FSRS-7", () => {
  const parameters = {
    w: [...FSRS7_DEFAULT_WEIGHTS],
    requestRetention: 0.9,
    maximumInterval: 36500,
    learningSteps: [1 / 1440, 10 / 1440],
    relearningSteps: [10 / 1440],
  };

  it("convierte una tarjeta en Review y añade el rastro rápido", () => {
    const legacy = [
      "Pregunta :: Respuesta",
      "card-s:: 10",
      "card-d:: 5",
      "card-reps:: 6",
      "card-lapses:: 0",
      "last-reviewed:: 2026-10-01T00:00:00.000Z",
      "interval-days:: 10",
      "ease-factor:: 2.5",
      "due-date:: 2026-10-11T00:00:00.000Z",
      "card-state:: 2",
    ].join("\n");

    const migrated = FlashcardsManager.migrateLegacyFSRS(legacy, parameters);
    expect(migrated).not.toBeNull();

    const snapshot = FlashcardsManager.readScheduleSnapshot(migrated!);
    expect(snapshot.stability).toBe(10);
    expect(snapshot.stabilityFast).toBeCloseTo(8, 10);
    expect(snapshot.state).toBe(2);
    expect(snapshot.intervalDays).toBe(13);
    expect(snapshot.dueDate).toBe(localMidnightAfter("2026-10-01T00:00:00.000Z", 13));

    // La conversión es idempotente.
    expect(FlashcardsManager.migrateLegacyFSRS(migrated!, parameters)).toBeNull();
  });

  it("convierte una tarjeta legacy en Learning conservando su paso", () => {
    const legacy = [
      "Pregunta :: Respuesta",
      "card-s:: 3.71",
      "card-d:: 5.16",
      "card-reps:: 1",
      "card-lapses:: 0",
      "last-reviewed:: 2026-10-01T00:00:00.000Z",
      "interval-days:: 0.006944444444444444",
      "ease-factor:: 2.5",
      "due-date:: 2026-10-01T00:10:00.000Z",
      "card-learn-step:: 1",
    ].join("\n");

    const migrated = FlashcardsManager.migrateLegacyFSRS(legacy, parameters);
    expect(migrated).not.toBeNull();

    const snapshot = FlashcardsManager.readScheduleSnapshot(migrated!);
    expect(snapshot.stabilityFast).toBeCloseTo(2.968, 10);
    expect(snapshot.state).toBe(1);
    expect(snapshot.learningStep).toBe(1);
    expect(snapshot.intervalDays).toBeCloseTo(10 / 1440, 12);
    expect(snapshot.dueDate).toBe("2026-10-01T00:10:00.000Z");
  });

  it("convierte una tarjeta legacy en Relearning conservando su paso", () => {
    const legacy = [
      "Pregunta :: Respuesta",
      "card-s:: 2.4",
      "card-d:: 7.1",
      "card-reps:: 8",
      "card-lapses:: 2",
      "last-reviewed:: 2026-10-01T00:00:00.000Z",
      "interval-days:: 0.006944444444444444",
      "card-state:: 3",
      "card-learn-step:: 0",
    ].join("\n");

    const migrated = FlashcardsManager.migrateLegacyFSRS(legacy, parameters);
    expect(migrated).not.toBeNull();

    const snapshot = FlashcardsManager.readScheduleSnapshot(migrated!);
    expect(snapshot.stabilityFast).toBeCloseTo(1.92, 10);
    expect(snapshot.state).toBe(3);
    expect(snapshot.learningStep).toBe(0);
    expect(snapshot.intervalDays).toBeCloseTo(0.006944444444444444, 12);
  });

  it("infiere Relearning al convertir una tarjeta sin card-state pero con lapsos", () => {
    const legacy = [
      "Pregunta :: Respuesta",
      "card-s:: 2.4",
      "card-d:: 7.1",
      "card-reps:: 8",
      "card-lapses:: 2",
      "last-reviewed:: 2026-10-01T00:00:00.000Z",
      "interval-days:: 0.006944444444444444",
      "card-learn-step:: 0",
    ].join("\n");

    const migrated = FlashcardsManager.migrateLegacyFSRS(legacy, parameters);
    expect(migrated).not.toBeNull();
    expect(FlashcardsManager.readScheduleSnapshot(migrated!).state).toBe(3);
  });

  it("convierte una tarjeta con card-state sin rastro rápido y es idempotente", () => {
    const legacy = [
      "Pregunta :: Respuesta",
      "card-s:: 10",
      "card-d:: 5",
      "card-reps:: 6",
      "card-lapses:: 0",
      "last-reviewed:: 2026-10-01T00:00:00.000Z",
      "interval-days:: 10",
      "card-state:: 2",
    ].join("\n");

    const migrated = FlashcardsManager.migrateLegacyFSRS(legacy, parameters);
    expect(migrated).toContain("card-s-fast:: 8");
    expect(FlashcardsManager.migrateLegacyFSRS(migrated!, parameters)).toBeNull();
  });

  it("no toca tarjetas nuevas ni tarjetas sin datos FSRS", () => {
    expect(
      FlashcardsManager.migrateLegacyFSRS("Pregunta :: Respuesta #card", parameters)
    ).toBeNull();
    expect(
      FlashcardsManager.migrateLegacyFSRS(
        "Pregunta :: Respuesta\ncard-s:: 0\nlast-reviewed:: 2026-10-01T00:00:00.000Z",
        parameters
      )
    ).toBeNull();
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

  it("tolera diferencias de redondeo en los valores FSRS (fallo real al deshacer)", () => {
    // Caso observado en una bóveda real: el diario guardó
    // `interval-days:: 0.003819444444444444` y la nota contendía
    // `0.0038194444444444443` tras un recálculo propio. El deshacer mostraba
    // falsamente el aviso de «otro dispositivo».
    const journal = FlashcardsManager.readScheduleSnapshot(
      reviewedContent.replace(
        "interval-days:: 0.006944444444444444",
        "interval-days:: 0.003819444444444444"
      )
    );
    const note = FlashcardsManager.readScheduleSnapshot(
      reviewedContent.replace(
        "interval-days:: 0.006944444444444444",
        "interval-days:: 0.0038194444444444443"
      )
    );
    expect(journal.intervalDays).not.toBe(note.intervalDays);
    expect(FlashcardsManager.scheduleSnapshotsEqual(journal, note)).toBe(true);
  });

  it("tolera el mismo instante expresado con distinta representación ISO", () => {
    const first = FlashcardsManager.readScheduleSnapshot(reviewedContent);
    const second = {
      ...first,
      lastReviewDate: "2026-10-24T16:00:00.000+02:00",
      dueDate: "2026-10-24T16:10:00.000+02:00",
    };
    expect(FlashcardsManager.scheduleSnapshotsEqual(first, second)).toBe(true);
  });

  it("lee números en notación científica sin truncarlos", () => {
    const snapshot = FlashcardsManager.readScheduleSnapshot(
      [
        "Pregunta :: Respuesta #card",
        "card-s:: 1.2e-7",
        "card-d:: 5",
        "card-s-fast:: 9.6e-8",
        "last-reviewed:: 2026-10-24T14:00:00.000Z",
        "interval-days:: 6.944444444444444e-7",
      ].join("\n")
    );
    expect(snapshot.stability).toBe(1.2e-7);
    expect(snapshot.stabilityFast).toBe(9.6e-8);
    expect(snapshot.intervalDays).toBe(6.944444444444444e-7);
  });

  it("trata como iguales una instantánea antigua sin stabilityFast y la tarjeta normalizada", () => {
    const current = FlashcardsManager.readScheduleSnapshot(reviewedContent);
    const legacy = { ...current };
    delete legacy.stabilityFast;

    expect(FlashcardsManager.scheduleSnapshotsEqual(current, legacy)).toBe(true);
  });

  it("restaura como Relearning una instantánea sin state con paso y lapsos", () => {
    const restored = FlashcardsManager.applyScheduleSnapshot(
      "Pregunta :: Respuesta",
      {
        stability: 2.4,
        difficulty: 7.1,
        reps: 8,
        lapses: 2,
        lastReviewDate: "2026-10-01T00:00:00.000Z",
        intervalDays: 0.006944444444444444,
        learningStep: 0,
      }
    );

    expect(restored).toContain("card-state:: 3");
    expect(restored).toContain("card-learn-step:: 0");
  });

  it("persiste stabilityFast y lo elimina al restablecer la tarjeta", () => {
    const updated = FlashcardsManager.updateBlockFSRS(
      "Pregunta :: Respuesta #card",
      { stability: 10, difficulty: 5, stabilityFast: 8, reps: 3, lapses: 0, state: 2 },
      42.85,
      2.5
    );

    expect(updated).toContain("card-s-fast:: 8");
    expect(FlashcardsManager.readScheduleSnapshot(updated).stabilityFast).toBe(8);
    expect(FlashcardsManager.clearFSRSProgress(updated)).not.toContain("card-s-fast");
  });
});

describe("FlashcardsManager - modo Aprendizaje", () => {
  it("rate(..., false) avanza sin modificar FSRS ni la fecha de vencimiento", () => {
    const manager = new FlashcardsManager();
    manager.scanVault(pages, "new-first");
    const card = manager.getCurrentCard()!;
    const before = { ...card.fsrs };

    manager.rate(3, false);

    expect(card.fsrs).toEqual(before);
    expect(card.dueDate).toBeUndefined();
    expect(card.lastIntervalDays).toBe(0);
    expect(manager.getCurrentCard()?.pageTitle).toBe("Nota B");

    // La tarjeta sigue vencida: al volver a escanear aparece de nuevo.
    expect(manager.scanVault(pages, "new-first")).toHaveLength(2);
  });

  it("setIncludeAllCards incluye las tarjetas que aún no vencen", () => {
    const schedule = futureSchedule();
    const future = makePage(
      "future",
      "Futura",
      [
        "Pregunta futura :: Respuesta futura",
        "card-s:: 10",
        "card-d:: 5",
        "card-reps:: 3",
        "card-lapses:: 0",
        `last-reviewed:: ${schedule.lastReviewed}`,
        "interval-days:: 30",
        `due-date:: ${schedule.dueDate}`,
        "card-state:: 2",
      ].join("\n")
    );
    const manager = new FlashcardsManager();

    manager.scanVault([future], "new-first");
    expect(manager.getCardsCount()).toBe(0);

    manager.setIncludeAllCards(true);
    expect(manager.getCardsCount()).toBe(1);
    expect(manager.getCurrentCard()?.pageTitle).toBe("Futura");

    manager.setIncludeAllCards(false);
    expect(manager.getCardsCount()).toBe(0);
  });

  it("al desactivar el modo, restartWithAllCards vuelve a mostrar todas las tarjetas", () => {
    const manager = new FlashcardsManager();
    manager.setIncludeAllCards(true);
    manager.scanVault(pages, "new-first");
    expect(manager.getCardsCount()).toBe(2);

    // Practica las dos tarjetas sin guardar.
    manager.rate(3, false);
    manager.rate(3, false);
    expect(manager.getCurrentCard()).toBeNull();

    // Desactivar: se reconstruye la cola con todas para repasar de verdad.
    manager.setIncludeAllCards(false);
    manager.restartWithAllCards();
    expect(manager.getCardsCount()).toBe(2);
    expect(manager.getCurrentCard()?.pageTitle).toBe("Nota A");
  });
});

describe("FlashcardsManager - respuestas con jerarquía", () => {
  it("genera listas HTML anidadas para los bullets hijos de una tarjeta básica", () => {
    const page: PageData = {
      id: "p-nested",
      title: "Nested",
      path: "notes/Nested.md",
      blocks: [
        {
          id: "root",
          type: "text",
          content: "Particularidad Humana #card",
          children: [
            {
              id: "child-1",
              type: "text",
              content: "Concepto clave",
              children: [
                {
                  id: "grandchild-1",
                  type: "text",
                  content: "Detalle",
                  children: [],
                },
              ],
            },
            { id: "child-2", type: "text", content: "Otra idea", children: [] },
          ],
        },
      ],
    };

    const manager = new FlashcardsManager();
    const [card] = manager.scanVault([page], "new-first");

    expect(card.cardType).toBe("basic");
    expect(card.question).toBe("Particularidad Humana");
    expect(card.answer).toBe(
      '<ul class="flashcard-answer-list">' +
        "<li>Concepto clave" +
        '<ul class="flashcard-answer-list"><li>Detalle</li></ul>' +
        "</li>" +
        "<li>Otra idea</li>" +
        "</ul>"
    );
  });

  it("genera una lista anidada en las notas hijas de una tarjeta cloze", () => {
    const page: PageData = {
      id: "p-cloze-nested",
      title: "Cloze anidada",
      path: "notes/Cloze anidada.md",
      blocks: [
        {
          id: "root",
          type: "text",
          content: "El algoritmo usa ==estabilidad==. #card",
          children: [
            {
              id: "child-1",
              type: "text",
              content: "Nota hija",
              children: [
                {
                  id: "grandchild-1",
                  type: "text",
                  content: "Nota nieta",
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    };

    const manager = new FlashcardsManager();
    const [card] = manager.scanVault([page], "new-first");

    expect(card.cardType).toBe("cloze");
    expect(card.answer).toContain(
      '<div class="cloze-children-notes">' +
        '<ul class="flashcard-answer-list">' +
        "<li>Nota hija" +
        '<ul class="flashcard-answer-list"><li>Nota nieta</li></ul>' +
        "</li>" +
        "</ul>" +
        "</div>"
    );
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

  it("infiere Relearning cuando hay card-learn-step y lapsos sin card-state", () => {
    const legacy = learningContent
      .split("\n")
      .filter((line) => !line.startsWith("card-state::"))
      .map((line) => (line.startsWith("card-lapses::") ? "card-lapses:: 2" : line))
      .join("\n");
    const manager = new FlashcardsManager();
    manager.scanVault([makePage("legacy-relearning", "Antigua", legacy)], "new-first");

    const card = manager.getCurrentCard();
    expect(card?.fsrs).toMatchObject({ state: 3, learningStep: 1, lapses: 2 });
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

describe("FlashcardsManager - contexto del bullet padre (T16)", () => {
  it("usa el bullet padre inmediato y no la respuesta de una tarjeta padre", () => {
    const page: PageData = {
      id: "p-parent",
      title: "Contexto",
      path: "notes/Contexto.md",
      blocks: [
        {
          id: "parent",
          type: "text",
          content: "Tema principal :: respuesta que no debe filtrarse",
          children: [
            {
              id: "child",
              type: "text",
              content: "Pregunta hija :: Respuesta hija",
              children: [],
            },
          ],
        },
      ],
    };

    const manager = new FlashcardsManager();
    const cards = manager.scanVault([page], "new-first");
    const child = cards.find((card) => card.blockId === "child");

    expect(child?.parentContent).toBe("Tema principal");
  });

  it("omite imágenes y bullets sin texto visible", () => {
    const page: PageData = {
      id: "p-parent-image",
      title: "Imagen",
      path: "notes/Imagen.md",
      blocks: [
        {
          id: "image-parent",
          type: "image",
          content: "![[foto.png]]",
          children: [
            { id: "child", type: "text", content: "Pregunta :: Respuesta", children: [] },
          ],
        },
      ],
    };

    const manager = new FlashcardsManager();
    const [card] = manager.scanVault([page], "new-first");
    expect(card.parentContent).toBeUndefined();
  });
});

describe("FlashcardsManager - rechequeo de tarjetas vencidas (T23)", () => {
  it("no muta la cola si no hay vencidas y la reconstruye cuando las hay", () => {
    const page = makePage("p-due", "Vencidas", "Pregunta :: Respuesta");
    const manager = new FlashcardsManager();
    const detected = manager.scanPages([page]);
    manager.setDetectedCards(detected, "new-first");

    expect(manager.getCardsCount()).toBe(1);
    // Agota la cola sin programar nada nuevo.
    manager.reveal();
    manager.rate(3);
    expect(manager.getCurrentCard()).toBeNull();

    // Simula que el reloj avanza: la tarjeta vuelve a estar vencida.
    const card = manager.getAllCards()[0];
    card.dueDate = "2000-01-01T00:00:00.000Z";
    card.fsrs.lastReviewDate = "2000-01-01T00:00:00.000Z";
    card.lastIntervalDays = 0;

    expect(manager.countDueCards()).toBe(1);
    expect(manager.refreshDueQueue("new-first")).toBe(1);
    expect(manager.getCurrentCard()?.id).toBe(card.id);
    expect(manager.getCardsCount()).toBe(1);
  });

  it("deja la cola vacía cuando ninguna tarjeta está vencida", () => {
    const manager = new FlashcardsManager();
    manager.setDetectedCards(manager.scanPages([makePage("p-future", "Futura", "P :: R")]));
    manager.reveal();
    manager.rate(3);

    expect(manager.countDueCards()).toBe(0);
    expect(manager.refreshDueQueue("new-first")).toBe(0);
    expect(manager.getCurrentCard()).toBeNull();
  });
});

describe("FlashcardsManager - ajustes globales sin mazo activo", () => {
  const reviewContent = (): string => {
    const reviewed = new Date();
    reviewed.setDate(reviewed.getDate() - 20);
    reviewed.setHours(12, 0, 0, 0);
    return [
      "Pregunta :: Respuesta",
      "card-s:: 20",
      "card-d:: 5",
      "card-state:: 2",
      `last-reviewed:: ${reviewed.toISOString()}`,
      "interval-days:: 20",
      `due-date:: ${new Date().toISOString()}`,
    ].join("\n");
  };

  it("aplica los parámetros globales a los intervalos del siguiente repaso", () => {
    const manager = new FlashcardsManager();
    manager.setDetectedCards(
      manager.scanPages([makePage("p-global", "Global", reviewContent())])
    );
    const before = manager.getRatingPreviews();
    const base = manager.getFSRSParameters();
    manager.setFSRSParameters({ ...base, requestRetention: 0.7, maximumInterval: 5 });
    const after = manager.getRatingPreviews();

    expect(manager.getFSRSParameters().requestRetention).toBe(0.7);
    expect(after?.[3].intervalDays).toBeLessThanOrEqual(5);
    expect(after?.[3].intervalDays).not.toBe(before?.[3].intervalDays);
  });
});
