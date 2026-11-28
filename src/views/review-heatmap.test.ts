import { describe, expect, it } from "vitest";
import {
  buildReviewHeatmap,
  buildReviewHeatmapYear,
  buildReviewHeatmapQuipu,
  defaultHeatmapStart,
} from "./review-heatmap";

function entry(date: string, state: "applied" | "undone" = "applied") {
  return { date, state } as const;
}

describe("review heatmap", () => {
  it("counts applied reviews by local date and maps activity to five levels", () => {
    const weeks = buildReviewHeatmap(
      [
        entry("2026-11-04"),
        entry("2026-11-04"),
        entry("2026-11-04"),
        entry("2026-11-03", "undone"),
      ],
      "2026-11-04",
      "2026-11-04"
    );
    const today = weeks.flatMap((week) => week.days).find((day) => day.date === "2026-11-04");
    expect(today).toMatchObject({ count: 3, level: 2 });
    expect(weeks.flatMap((week) => week.days).filter((day) => day.date)).toHaveLength(1);
  });

  it("maps daily review counts to the four activity intensities", () => {
    const weeks = buildReviewHeatmap(
      [
        entry("2026-11-01"),
        entry("2026-11-02"), entry("2026-11-02"),
        entry("2026-11-03"), entry("2026-11-03"), entry("2026-11-03"), entry("2026-11-03"),
        ...Array.from({ length: 7 }, () => entry("2026-11-04")),
      ],
      "2026-11-01",
      "2026-11-04"
    );
    const days = new Map(weeks.flatMap((week) => week.days).filter((day) => day.date).map((day) => [day.date, day.level]));
    expect(days.get("2026-11-01")).toBe(1);
    expect(days.get("2026-11-02")).toBe(2);
    expect(days.get("2026-11-03")).toBe(3);
    expect(days.get("2026-11-04")).toBe(4);
  });

  it("returns up to 365 days and pads calendar weeks", () => {
    const weeks = buildReviewHeatmap([], "2024-01-01", "2026-11-04");
    const days = weeks.flatMap((week) => week.days);
    expect(weeks.length).toBeLessThanOrEqual(53);
    expect(days.filter((day) => day.date)).toHaveLength(365);
    expect(days[0].date).toBeNull();
  });

  it("handles invalid dates and clamps future starts to the end date", () => {
    expect(buildReviewHeatmap([], "invalid", "2026-11-04").flatMap((week) => week.days).filter((day) => day.date)).toHaveLength(1);
    expect(buildReviewHeatmap([], "2026-11-30", "2026-11-04").flatMap((week) => week.days).filter((day) => day.date)).toHaveLength(1);
  });

  it("defaults to a 90-day inclusive range", () => {
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

  it("tiene doce cuerdas, una por mes", () => {
    const quipu = buildReviewHeatmapQuipu(months, []);
    expect(quipu.branches).toHaveLength(12);
    expect(new Set(quipu.branches.map((branch) => branch.y)).size).toBe(12);
  });

  it("incluye todas las semanas del año", () => {
    const quipu = buildReviewHeatmapQuipu(months, []);
    const total = quipu.branches.reduce((sum, branch) => sum + branch.knots.length, 0);
    expect(total).toBeGreaterThanOrEqual(52);
  });

  it("cuenta días distintos con repasos por semana y calcula la intensidad", () => {
    const quipu = buildReviewHeatmapQuipu(months, [
      entry("2026-06-15"),
      entry("2026-06-16"),
      entry("2026-06-16"),
      entry("2026-06-20", "undone"),
    ]);
    const june = quipu.branches[5].knots;
    const target = june.find((knot) => knot.weekStart === "2026-06-15");
    expect(target).toMatchObject({ daysStudied: 2 });
    expect(target?.intensity).toBeCloseTo(2 / 7);
  });

  it("deja intensidad cero en semanas sin estudio", () => {
    const quipu = buildReviewHeatmapQuipu(months, []);
    expect(quipu.branches.every((branch) => branch.knots.every((knot) => knot.intensity === 0))).toBe(true);
  });
});
