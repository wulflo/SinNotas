import { describe, expect, it } from "vitest";
import {
  buildReviewHeatmapYear,
  buildReviewHeatmapQuipu,
  defaultHeatmapStart,
} from "./review-heatmap";

function entry(date: string, state: "applied" | "undone" = "applied") {
  return { date, state } as const;
}

describe("review heatmap", () => {
  it("defaultHeatmapStart devuelve un rango inclusivo de 90 días", () => {
    expect(defaultHeatmapStart("2026-11-04")).toBe("2026-08-07");
  });
});

describe("review heatmap — cinta anual", () => {
  it("devuelve los 12 meses del año con un cuadrito por día", () => {
    const months = buildReviewHeatmapYear([], "2026-01-01", "2026-12-31");
    expect(months).toHaveLength(12);
    expect(months.map((month) => month.key)).toEqual([
      "2026-01", "2026-02", "2026-03", "2026-04",
      "2026-05", "2026-06", "2026-07", "2026-08",
      "2026-09", "2026-10", "2026-11", "2026-12",
    ]);
    expect(months.map((month) => month.days.length)).toEqual([
      31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ]);
  });

  it("cuenta solo repasos applied y aplica los cinco niveles", () => {
    const months = buildReviewHeatmapYear(
      [
        entry("2026-01-01"),
        entry("2026-01-02"), entry("2026-01-02"),
        entry("2026-01-03"), entry("2026-01-03"), entry("2026-01-03"), entry("2026-01-03"),
        entry("2026-01-04", "undone"),
      ],
      "2026-01-01",
      "2026-01-31"
    );
    const january = months[0].days;
    expect(january.slice(0, 4).map((day) => day.level)).toEqual([1, 2, 3, 0]);
    expect(january.find((day) => day.date === "2026-01-04")?.count).toBe(0);
  });

  it("deja huecos en los días fuera del rango (meses parciales)", () => {
    const months = buildReviewHeatmapYear([], "2026-11-20", "2026-12-10");
    expect(months).toHaveLength(2);
    expect(months[0].days.slice(0, 19).every((day) => day.date === null)).toBe(true);
    expect(months[0].days[19].date).toBe("2026-11-20");
    expect(months[1].days.slice(10).every((day) => day.date === null)).toBe(true);
  });

  it("limita la ventana a 365 días aunque pidan más", () => {
    const months = buildReviewHeatmapYear([], "2024-01-01", "2026-11-04");
    const days = months.flatMap((month) => month.days).filter((day) => day.date);
    expect(days).toHaveLength(365);
    expect(months.length).toBeLessThanOrEqual(13);
  });

  it("devuelve nada si la fecha final no es válida", () => {
    expect(buildReviewHeatmapYear([], "2026-01-01", "no-es-fecha")).toEqual([]);
  });
});

describe("review heatmap — quipu semanal", () => {
  const months = buildReviewHeatmapYear([], "2026-01-01", "2026-12-31");

  it("tiene doce hilos colgantes, uno por mes", () => {
    const quipu = buildReviewHeatmapQuipu(months, []);
    expect(quipu.threads).toHaveLength(12);
    expect(new Set(quipu.threads.map((thread) => thread.x)).size).toBe(12);
  });

  it("nudos rectangulares más grandes y menos separados", () => {
    const quipu = buildReviewHeatmapQuipu(months, []);
    expect(quipu.knotSize).toEqual({ width: 15, height: 9.6, radius: 2 });
    const xs = quipu.threads.map((thread) => thread.x).sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBe(20);
    expect(xs[0] + xs[xs.length - 1]).toBeCloseTo(260, 0);
  });

  it("incluye todas las semanas del año", () => {
    const quipu = buildReviewHeatmapQuipu(months, []);
    const total = quipu.threads.reduce((sum, thread) => sum + thread.knots.length, 0);
    expect(total).toBeGreaterThanOrEqual(52);
  });

  it("cuenta días distintos con repasos por semana y calcula la intensidad", () => {
    const quipu = buildReviewHeatmapQuipu(months, [
      entry("2026-06-15"),
      entry("2026-06-16"),
      entry("2026-06-16"),
      entry("2026-06-20", "undone"),
    ]);
    const june = quipu.threads[5].knots;
    const target = june.find((knot) => knot.weekStart === "2026-06-15");
    expect(target).toMatchObject({ daysStudied: 2 });
    expect(target?.intensity).toBeCloseTo(2 / 7);
  });

  it("deja intensidad cero en semanas sin estudio", () => {
    const quipu = buildReviewHeatmapQuipu(months, []);
    expect(quipu.threads.every((thread) => thread.knots.every((knot) => knot.intensity === 0))).toBe(true);
  });
});
