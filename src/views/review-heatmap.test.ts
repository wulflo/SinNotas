import { describe, expect, it } from "vitest";
import { buildReviewHeatmap, defaultHeatmapStart } from "./review-heatmap";

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
