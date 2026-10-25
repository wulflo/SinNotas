import { describe, it, expect } from "vitest";
import {
  FSRSEngine,
  FACTOR,
  DECAY,
  defaultFSRSParams,
  type FSRSItem,
} from "./fsrs";

describe("FSRS nextInterval (curva de potencia)", () => {
  it("FACTOR y DECAY son los valores de FSRS-4.5", () => {
    expect(FACTOR).toBeCloseTo(19 / 81, 12);
    expect(DECAY).toBe(-0.5);
  });

  it("(a) con requestRetention=0.9 es idéntico al cálculo anterior (I = S) para S en 0.1..3650", () => {
    const engine = new FSRSEngine();
    for (let s = 0.1; s <= 3650; s += 0.1) {
      const interval = engine.nextInterval(s);
      expect(interval).toBe(Math.max(1, Math.min(36500, Math.round(s))));
    }
    for (let s = 1; s <= 3650; s++) {
      expect(engine.nextInterval(s)).toBe(Math.min(36500, s));
    }
  });

  it("(b) retrievability(intervalo, S) ≈ requestRetention para 0.8, 0.85 y 0.95", () => {
    for (const r of [0.8, 0.85, 0.95]) {
      const engine = new FSRSEngine({ ...defaultFSRSParams, requestRetention: r });
      for (const s of [5, 7, 14, 30, 100, 1000, 3650]) {
        const interval = engine.nextInterval(s);
        const actualR = engine.retrievability(interval, s);
        expect(Math.abs(actualR - r)).toBeLessThan(0.05);
      }
    }
  });

  it("(c) límites: mínimo 1 día y máximo maximumInterval", () => {
    const engine = new FSRSEngine();
    expect(engine.nextInterval(0)).toBe(1);
    expect(engine.nextInterval(0.01)).toBe(1);
    expect(engine.nextInterval(1000000)).toBe(36500);
  });

  it("la fórmula general coincide: I = (S/FACTOR)·(R^(1/DECAY) − 1)", () => {
    const r = 0.92;
    const engine = new FSRSEngine({ ...defaultFSRSParams, requestRetention: r, maximumInterval: 100000 });
    const s = 42;
    const expected = (s / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
    expect(engine.nextInterval(s)).toBe(Math.min(100000, Math.max(1, Math.round(expected))));
  });
});

describe("FSRS-4.5 - parámetros y fórmulas oficiales", () => {
  it("usa los 17 pesos publicados para FSRS-4.5", () => {
    expect(defaultFSRSParams.w).toHaveLength(17);
    expect(defaultFSRSParams.w).toEqual([
      0.4872, 1.4003, 3.7145, 13.8206,
      5.1618, 1.2298, 0.8975, 0.031,
      1.6474, 0.1367, 1.0461,
      2.1072, 0.0793, 0.3246, 1.587,
      0.2272, 2.8755,
    ]);
  });

  it("calcula D0(G) con la fórmula lineal de FSRS-4.5", () => {
    const engine = new FSRSEngine();
    const item: FSRSItem = { stability: 0, difficulty: 5, reps: 0, lapses: 0, state: 0 };
    const previews = engine.previewRatings(item);

    expect(previews[1].item.difficulty).toBe(7.62); // w4 + 2·w5
    expect(previews[2].item.difficulty).toBe(6.39); // w4 + w5
    expect(previews[3].item.difficulty).toBe(5.16); // w4
    expect(previews[4].item.difficulty).toBe(3.93); // w4 - w5
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
    // Easy gradúa directamente; su intervalo es el de FSRS, no un paso.
    expect(previews[4].item.state).toBe(2);
    expect(previews[4].item.learningStep).toBeUndefined();
    expect(previews[4].intervalText).toBe("14d");
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
    expect(previews[3].intervalText).toBe("4d");
    expect(previews[4].intervalText).toBe("14d");
  });

  it("Again durante el aprendizaje reinicia al primer paso sin contar lapse", () => {
    const engine = new FSRSEngine();
    const learning: FSRSItem = {
      stability: 3.71,
      difficulty: 5.16,
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
    expect(relearning.intervalDays).toBeGreaterThanOrEqual(1);
  });
});
