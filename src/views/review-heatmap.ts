import type { ReviewProgressEvent } from "../store/review-progress";

export interface ReviewHeatmapDay {
  date: string | null;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface ReviewHeatmapWeek {
  monthLabel: string;
  days: ReviewHeatmapDay[];
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function parseLocalDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return dateKey(date) === value ? date : null;
}

function levelFor(count: number): ReviewHeatmapDay["level"] {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function buildReviewHeatmap(
  entries: readonly Pick<ReviewProgressEvent, "date" | "state">[],
  requestedStart: string,
  requestedEnd: string
): ReviewHeatmapWeek[] {
  const end = parseLocalDate(requestedEnd);
  if (!end) return [];
  const requested = parseLocalDate(requestedStart) ?? end;
  const earliest = addDays(end, -364);
  const start = requested < earliest ? earliest : requested > end ? end : requested;
  const startKey = dateKey(start);
  const endKey = dateKey(end);

  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.state !== "applied" || entry.date < startKey || entry.date > endKey) continue;
    counts.set(entry.date, (counts.get(entry.date) || 0) + 1);
  }

  const firstWeek = addDays(start, -start.getDay());
  const weeks: ReviewHeatmapWeek[] = [];
  let previousMonth = "";
  for (let weekOffset = 0; weekOffset < 54; weekOffset += 1) {
    const weekStart = addDays(firstWeek, weekOffset * 7);
    if (dateKey(weekStart) > endKey) break;
    const days: ReviewHeatmapDay[] = [];
    let monthLabel = "";
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const date = addDays(weekStart, dayOffset);
      const key = dateKey(date);
      if (key >= startKey && key <= endKey) {
        const count = counts.get(key) || 0;
        days.push({ date: key, count, level: levelFor(count) });
        if ((date.getDate() === 1 || weeks.length === 0) && !monthLabel) {
          monthLabel = new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
        }
      } else {
        days.push({ date: null, count: 0, level: 0 });
      }
    }
    if (!monthLabel && weeks.length === 0) {
      const firstVisible = days.find((day) => day.date)?.date;
      if (firstVisible) {
        const date = parseLocalDate(firstVisible);
        if (date) monthLabel = new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
      }
    }
    if (monthLabel === previousMonth) monthLabel = "";
    if (monthLabel) previousMonth = monthLabel;
    weeks.push({ monthLabel, days });
  }
  return weeks;
}

export function defaultHeatmapStart(endDate: string, days = 90): string {
  const end = parseLocalDate(endDate);
  return end ? dateKey(addDays(end, -(Math.max(1, Math.min(365, days)) - 1))) : endDate;
}
