import { describe, it, expect } from "vitest";
import { FSRSEngine, FACTOR, DECAY, defaultFSRSParams } from "./fsrs";

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
