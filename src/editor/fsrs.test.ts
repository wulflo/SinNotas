import { describe, it, expect } from "vitest";
import {
  computeDueDate,
  FSRSEngine,
  defaultFSRSParams,
  FSRS7_WEIGHT_COUNT,
  type FSRSItem,
} from "./fsrs";
import { FSRS7_DEFAULT_WEIGHTS, FSRS7Algorithm, FSRS7_MODEL_BOUNDS } from "ts-fsrs/models/fsrs-7";

describe("FSRS-7 - parámetros", () => {
  it("usa los 34 pesos publicados para FSRS-7", () => {
    expect(defaultFSRSParams.w).toHaveLength(FSRS7_WEIGHT_COUNT);
    expect(defaultFSRSParams.w).toEqual(FSRS7_DEFAULT_WEIGHTS);
  });
});

describe("FSRS - fase de aprendizaje", () => {
  const newItem: FSRSItem = { stability: 0, difficulty: 5, reps: 0, lapses: 0, state: 0 };

  it("una tarjeta nueva usa pasos cortos y no intervalos de revisión", () => {
    const engine = new FSRSEngine();
    const previews = engine.previewRatings(newItem);

    expect(previews[1]).toMatchObject({
      intervalText: "1m",
      item: { state: 1, learningStep: 0 },
    });
    expect(previews[2]).toMatchObject({
      intervalText: "6m",
      item: { state: 1, learningStep: 0 },
    });
    expect(previews[3]).toMatchObject({
      intervalText: "10m",
      item: { state: 1, learningStep: 1 },
    });
    // Easy gradúa directamente; su intervalo es S0(4), no un paso.
    expect(previews[4].item.state).toBe(2);
    expect(previews[4].item.learningStep).toBeUndefined();
    expect(previews[4].intervalText).toBe("54d");
  });

  it("Good desde el último paso gradúa con el intervalo FSRS", () => {
    const engine = new FSRSEngine();
    const good = engine.previewRatings(newItem)[3].item;
    const previews = engine.previewRatings(good, 10 / 1440);

    expect(previews[1].item).toMatchObject({ state: 1, learningStep: 0 });
    expect(previews[1].intervalText).toBe("1m");
    expect(previews[2].item).toMatchObject({ state: 1, learningStep: 1 });
    expect(previews[2].intervalText).toBe("10m");
    expect(previews[3].item.state).toBe(2);
    expect(previews[3].item.learningStep).toBeUndefined();
    expect(previews[3].intervalText).toBe("10d");
    // Easy conserva la estabilidad acumulada y aplica el bonus de FSRS; ya no
    // reinicia la tarjeta a S0(4) = 14 días.
    expect(previews[4].item.state).toBe(2);
    expect(previews[4].item.stability).toBeGreaterThanOrEqual(previews[3].item.stability);
    expect(previews[4].intervalText).toBe("22d");
  });

  it("Easy en Learning aplica la fórmula de recuerdo y no reinicia a S0(4)", () => {
    const engine = new FSRSEngine();
    const learning: FSRSItem = {
      stability: 2.31,
      difficulty: 4.4,
      reps: 1,
      lapses: 0,
      state: 1,
      learningStep: 1,
    };
    const previews = engine.previewRatings(learning, 10 / 1440);

    expect(previews[4].item.state).toBe(2);
    expect(previews[4].item.stability).toBeGreaterThan(learning.stability);
    expect(previews[4].item.stability).toBeLessThan(defaultFSRSParams.w[3]);
    expect(previews[4].item.stability).toBeGreaterThanOrEqual(previews[3].item.stability);
  });

  it("Easy en Relearning también conserva la estabilidad acumulada", () => {
    const engine = new FSRSEngine();
    const relearning: FSRSItem = {
      stability: 2.31,
      difficulty: 4.4,
      reps: 2,
      lapses: 1,
      state: 3,
      learningStep: 0,
    };
    const previews = engine.previewRatings(relearning, 10 / 1440);

    expect(previews[4].item.state).toBe(2);
    expect(previews[4].item.stability).toBeGreaterThan(relearning.stability);
    expect(previews[4].item.stability).toBeLessThan(defaultFSRSParams.w[3]);
  });

  it("Again durante el aprendizaje reinicia al primer paso sin contar lapse", () => {
    const engine = new FSRSEngine();
    const learning: FSRSItem = {
      stability: 2.31,
      difficulty: 4.4,
      reps: 1,
      lapses: 0,
      state: 1,
      learningStep: 1,
    };
    const previews = engine.previewRatings(learning, 10 / 1440);

    expect(previews[1].item).toMatchObject({
      state: 1,
      learningStep: 0,
      lapses: 0,
    });
    expect(previews[1].intervalText).toBe("1m");
    expect(previews[1].item.stability).toBeLessThan(learning.stability);
  });

  it("un lapse pasa a Relearning con paso corto y luego vuelve a Review", () => {
    const engine = new FSRSEngine();
    const review: FSRSItem = {
      stability: 10,
      difficulty: 5,
      reps: 6,
      lapses: 1,
      state: 2,
    };

    const lapse = engine.previewRatings(review, 10)[1];
    expect(lapse.item.state).toBe(3);
    expect(lapse.item.lapses).toBe(2);
    expect(lapse.item.learningStep).toBe(0);
    expect(lapse.intervalText).toBe("10m");

    const relearning = engine.previewRatings(lapse.item, 10 / 1440)[3];
    expect(relearning.item.state).toBe(2);
    expect(relearning.item.learningStep).toBeUndefined();
    // FSRS-7 puede graduar con un intervalo fraccionario; ya no se fuerza 1 día.
    expect(relearning.intervalDays).toBeGreaterThan(0);
    expect(relearning.intervalDays).toBeLessThan(1);
    expect(relearning.intervalText).toBe("9h");
  });
});

describe("FSRS-7 - validación de pasos", () => {
  const newItem: FSRSItem = { stability: 0, difficulty: 5, reps: 0, lapses: 0, state: 0 };

  it("los pasos desordenados o duplicados caen a los valores por defecto", () => {
    const unordered = new FSRSEngine({
      ...defaultFSRSParams,
      learningSteps: [10 / 1440, 1 / 1440],
    });
    const duplicate = new FSRSEngine({
      ...defaultFSRSParams,
      learningSteps: [1 / 1440, 1 / 1440],
    });

    for (const engine of [unordered, duplicate]) {
      const previews = engine.previewRatings(newItem);
      expect(previews[1].intervalText).toBe("1m");
      expect(previews[3].intervalText).toBe("10m");
    }
  });

  it("conserva los pasos válidos y no comparte los arrays por defecto", () => {
    const custom = new FSRSEngine({
      ...defaultFSRSParams,
      learningSteps: [2 / 1440, 20 / 1440],
    });
    const previews = custom.previewRatings(newItem);
    expect(previews[1].intervalText).toBe("2m");
    expect(previews[3].intervalText).toBe("20m");
  });
});

describe("FSRS-7 - Hard con 3 o más pasos", () => {
  const newItem: FSRSItem = { stability: 0, difficulty: 5, reps: 0, lapses: 0, state: 0 };

  it("promedia solo en el primer paso y repite el paso actual después", () => {
    const engine = new FSRSEngine({
      ...defaultFSRSParams,
      learningSteps: [1 / 1440, 10 / 1440, 1 / 24],
    });

    const first = engine.previewRatings(newItem)[2];
    expect(first.intervalText).toBe("6m");
    expect(first.item.learningStep).toBe(0);

    const middle: FSRSItem = {
      stability: 2.31,
      difficulty: 4.4,
      reps: 1,
      lapses: 0,
      state: 1,
      learningStep: 1,
    };
    const second = engine.previewRatings(middle, 10 / 1440)[2];
    expect(second.intervalText).toBe("10m");
    expect(second.item.learningStep).toBe(1);

    const last = engine.previewRatings({ ...middle, learningStep: 2 }, 10 / 1440)[2];
    expect(last.intervalText).toBe("1h");
    expect(last.item.learningStep).toBe(2);
  });
});

describe("FSRS-7 - pasos de reaprendizaje vacíos", () => {
  it("Review + Again con relearningSteps vacíos gradúa a Review con intervalo FSRS", () => {
    const engine = new FSRSEngine({ ...defaultFSRSParams, relearningSteps: [] });
    const review: FSRSItem = {
      stability: 10,
      difficulty: 5,
      stabilityFast: 8,
      reps: 6,
      lapses: 1,
      state: 2,
    };

    const lapse = engine.previewRatings(review, 10)[1];
    expect(lapse.item.state).toBe(2);
    expect(lapse.item.learningStep).toBeUndefined();
    expect(lapse.intervalDays).toBeGreaterThan(0);
    expect(lapse.item.lapses).toBe(2);
  });

  it("una tarjeta en Relearning con pasos vacíos también gradúa", () => {
    const engine = new FSRSEngine({ ...defaultFSRSParams, relearningSteps: [] });
    const relearning: FSRSItem = {
      stability: 2.31,
      difficulty: 4.4,
      reps: 2,
      lapses: 1,
      state: 3,
      learningStep: 0,
    };

    const good = engine.previewRatings(relearning, 10 / 1440)[3];
    expect(good.item.state).toBe(2);
    expect(good.item.learningStep).toBeUndefined();
    expect(good.intervalDays).toBeGreaterThan(0);
  });
});

describe("FSRS-7 - intervalos fraccionarios y vectores", () => {
  it("conserva intervalos menores de un día en vez de forzar 1 día", () => {
    const engine = new FSRSEngine();
    const interval = engine.nextInterval({
      stability: 2,
      difficulty: 9,
      stabilityFast: 1.6,
    });

    expect(interval).toBeCloseTo(0.0246052, 5);
    expect(engine.formatInterval(interval)).toBe("35m");
  });

  it("respeta la retención 0.97 con intervalos de horas", () => {
    const engine = new FSRSEngine({ ...defaultFSRSParams, requestRetention: 0.97 });
    const interval = engine.nextInterval({
      stability: 10,
      difficulty: 5,
      stabilityFast: 8,
    });

    expect(interval).toBeCloseTo(0.1732268, 5);
    expect(engine.formatInterval(interval)).toBe("4h");
  });

  it("formatea segundos, minutos y horas sin confundirlos con días", () => {
    const engine = new FSRSEngine();
    expect(engine.formatInterval(0.00003828)).toBe("3s");
    expect(engine.formatInterval(0.5)).toBe("12h");
    expect(engine.formatInterval(0.99)).toBe("1d");
  });

  it("muestra días exactos hasta 59 y meses con un decimal desde 60", () => {
    const engine = new FSRSEngine();
    expect(engine.formatInterval(44)).toBe("44d");
    expect(engine.formatInterval(45)).toBe("45d");
    expect(engine.formatInterval(59)).toBe("59d");
    expect(engine.formatInterval(60)).toBe("2mo");
    expect(engine.formatInterval(76)).toBe("2.5mo");
    expect(engine.formatInterval(365)).toBe("1y");
    // Casos fraccionarios ya cubiertos por los vectores oficiales.
    expect(engine.formatInterval(0.0246052)).toBe("35m");
    expect(engine.formatInterval(0.1732268)).toBe("4h");
    expect(engine.formatInterval(0.5)).toBe("12h");
  });

  it("reproduce el vector oficial de Review Good", () => {
    const engine = new FSRSEngine();
    const review: FSRSItem = {
      stability: 10,
      difficulty: 5,
      stabilityFast: 8,
      reps: 6,
      lapses: 0,
      state: 2,
    };

    const good = engine.previewRatings(review, 10)[3];
    expect(good.item.stability).toBeCloseTo(22.8989, 3);
    expect(good.item.stabilityFast).toBeCloseTo(190.6022, 3);
    expect(good.item.difficulty).toBeCloseTo(4.9523, 3);
    expect(good.intervalDays).toBe(43);
    expect(good.intervalText).toBe("43d");
  });

  it("la retención más alta produce un intervalo más corto", () => {
    const state = { stability: 10, difficulty: 5, stabilityFast: 8 };
    const normal = new FSRSEngine({
      ...defaultFSRSParams,
      requestRetention: 0.9,
    }).nextInterval(state);
    const high = new FSRSEngine({
      ...defaultFSRSParams,
      requestRetention: 0.97,
    }).nextInterval(state);

    expect(high).toBeLessThan(normal);
    expect(high).toBeCloseTo(0.1732268, 5);
  });

  it("acota retención, pesos y pasos en el constructor", () => {
    const engine = new FSRSEngine({
      ...defaultFSRSParams,
      requestRetention: 1.2,
      learningSteps: [1],
      relearningSteps: [2],
      w: defaultFSRSParams.w.map(() => 1e9),
    });

    expect(
      engine.nextInterval({ stability: 10, difficulty: 5, stabilityFast: 8 })
    ).toBeGreaterThan(0);

    const previews = engine.previewRatings({
      stability: 0,
      difficulty: 5,
      reps: 0,
      lapses: 0,
      state: 0,
    });
    // Los pasos inválidos (>= 1 día) caen a los valores por defecto.
    expect(previews[1].intervalText).toBe("1m");
    expect(previews[3].intervalText).toBe("10m");
  });
});

describe("FSRS-7 - vectores oficiales de fsrs-rs", () => {
  const algorithm = new FSRS7Algorithm(FSRS7_DEFAULT_WEIGHTS, FSRS7_MODEL_BOUNDS);
  const expectVector = (
    actual: { stability: number; stabilityFast: number; difficulty: number },
    expected: { s: number; sf: number; d: number },
    interval: number
  ) => {
    expect(Math.abs(actual.stability - expected.s)).toBeLessThan(1e-3);
    expect(Math.abs(actual.stabilityFast - expected.sf)).toBeLessThan(1e-3);
    expect(Math.abs(actual.difficulty - expected.d)).toBeLessThan(1e-3);
    expect(
      Math.abs(algorithm.next_interval(actual, 0.9) - interval)
    ).toBeLessThan(1e-3);
  };

  it("estado nuevo", () => {
    expectVector(
      algorithm.next_state(null, 0, 1),
      { s: 0.1104, sf: 0.08832, d: 6.1686 },
      0.00003828
    );
    expectVector(
      algorithm.next_state(null, 0, 2),
      { s: 2.2395, sf: 1.7916, d: 5.261278 },
      0.59745979
    );
    expectVector(
      algorithm.next_state(null, 0, 3),
      { s: 3.9221, sf: 3.13768, d: 3.530724 },
      4.77772474
    );
    expectVector(
      algorithm.next_state(null, 0, 4),
      { s: 11.7841, sf: 9.427279, d: 1 },
      53.8693924
    );
  });

  it("estado de repaso S=10, SF=8, D=5", () => {
    const base = { stability: 10, stabilityFast: 8, difficulty: 5 };
    const retrievability = algorithm.curve(10, base).retrievability;
    expectVector(
      algorithm.next_state(base, 10, 1, retrievability),
      { s: 2.43025088, sf: 0.41938692, d: 9.04004192 },
      0.01400643
    );
    expectVector(
      algorithm.next_state(base, 10, 2, retrievability),
      { s: 18.25272369, sf: 120.51950836, d: 6.97668457 },
      17.78954315
    );
    expectVector(
      algorithm.next_state(base, 10, 3, retrievability),
      { s: 22.89891052, sf: 190.6022644, d: 4.95229959 },
      42.85027695
    );
    expectVector(
      algorithm.next_state(base, 10, 4, retrievability),
      { s: 22.89891052, sf: 206.47039795, d: 2.9279151 },
      74.56172943
    );
  });
});

describe("FSRS-7 - vencimientos", () => {
  it("normaliza al inicio del día local para intervalos de un día o más", () => {
    // Repaso a las 14:10 del 21 de noviembre de 2026 (hora local).
    const reviewed = new Date(2026, 10, 21, 14, 10, 0, 0);
    const due = computeDueDate(reviewed.getTime(), 10);
    const parsed = new Date(due);

    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
    expect(parsed.getSeconds()).toBe(0);
    expect(parsed.getDate()).toBe(1);
    expect(parsed.getMonth()).toBe(11);
    expect(parsed.getFullYear()).toBe(2026);
  });

  it("conserva la hora para pasos cortos", () => {
    const reviewed = new Date(2026, 10, 21, 14, 10, 0, 0);
    expect(computeDueDate(reviewed.getTime(), 10 / 1440)).toBe(
      new Date(2026, 10, 21, 14, 20, 0, 0).toISOString()
    );
  });
});
