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

/** Un mes de la cinta anual: una fila con un cuadrito por día del mes. */
export interface ReviewHeatmapMonth {
  /** `YYYY-MM`, estable para claves y tests. */
  key: string;
  label: string;
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

/**
 * Cinta anual: agrupa los repasos por mes natural en lugar de por semanas.
 * Mantiene el detalle diario pero cabe entero en el panel de productividad
 * (12 filas cortas) y no necesita scroll ni otra vista.
 */
export function buildReviewHeatmapYear(
  entries: readonly Pick<ReviewProgressEvent, "date" | "state">[],
  requestedStart: string,
  requestedEnd: string
): ReviewHeatmapMonth[] {
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

  const months: ReviewHeatmapMonth[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12);
  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: ReviewHeatmapDay[] = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day, 12);
      const key = dateKey(date);
      if (key < startKey || key > endKey) {
        days.push({ date: null, count: 0, level: 0 });
        continue;
      }
      const count = counts.get(key) || 0;
      days.push({ date: key, count, level: levelFor(count) });
    }
    months.push({
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat(undefined, { month: "short" }).format(cursor),
      days,
    });
    cursor.setMonth(month + 1);
  }
  return months;
}

/** Nudo de un quipu: una semana, teñido según los días que se estudió. */
export interface HeatmapQuipuKnot {
  x: number;
  y: number;
  weekStart: string;
  daysStudied: number;
  /** 0–1: proporción de días de la semana con repasos. */
  intensity: number;
}

export interface HeatmapQuipuThread {
  x: number;
  knots: HeatmapQuipuKnot[];
}

export interface HeatmapQuipuKnotSize {
  width: number;
  height: number;
  radius: number;
}

export interface HeatmapQuipuResult {
  threads: HeatmapQuipuThread[];
  knotSize: HeatmapQuipuKnotSize;
}

const QUIPU_THREAD_START_X = 32;
const QUIPU_STEP_X = 16;
const QUIPU_KNOT_START_Y = 34;
const QUIPU_KNOT_END_Y = 158;
const QUIPU_KNOT_WIDTH = 12.5;
const QUIPU_KNOT_HEIGHT = 9.6;
const QUIPU_KNOT_RADIUS = 2;

function mondayKey(date: Date): string {
  const offset = (date.getDay() + 6) % 7;
  return dateKey(addDays(date, -offset));
}

/**
 * Quipu colgante: cordel horizontal arriba y doce hilos verticales (uno por
 * mes) cayendo hacia abajo, con un nudo por semana. Todos los nudos son
 * opacos; su color vira al acento según los días estudiados esa semana.
 */
export function buildReviewHeatmapQuipu(
  months: readonly ReviewHeatmapMonth[],
  entries: readonly Pick<ReviewProgressEvent, "date" | "state">[]
): HeatmapQuipuResult {
  const studied = new Set<string>();
  for (const entry of entries) {
    if (entry.state === "applied") studied.add(entry.date);
  }

  const threads: HeatmapQuipuThread[] = months.map((month, monthIndex) => {
    const weeks = new Map<string, number>();
    for (const day of month.days) {
      if (!day.date) continue;
      const parsed = parseLocalDate(day.date);
      if (!parsed) continue;
      const key = mondayKey(parsed);
      weeks.set(key, (weeks.get(key) || 0) + (studied.has(day.date) ? 1 : 0));
    }

    const ordered = [...weeks.entries()];
    const step = ordered.length > 1
      ? (QUIPU_KNOT_END_Y - QUIPU_KNOT_START_Y) / (ordered.length - 1)
      : 0;
    const x = QUIPU_THREAD_START_X + monthIndex * QUIPU_STEP_X;
    return {
      x: Number(x.toFixed(2)),
      knots: ordered.map(([weekStart, daysStudied], index) => ({
        x: Number(x.toFixed(2)),
        y: Number((QUIPU_KNOT_START_Y + index * step).toFixed(2)),
        weekStart,
        daysStudied,
        intensity: Math.min(1, daysStudied / 7),
      })),
    };
  });

  return {
    threads,
    knotSize: {
      width: QUIPU_KNOT_WIDTH,
      height: QUIPU_KNOT_HEIGHT,
      radius: QUIPU_KNOT_RADIUS,
    },
  };
}

export function defaultHeatmapStart(endDate: string, days = 90): string {
  const end = parseLocalDate(endDate);
  return end ? dateKey(addDays(end, -(Math.max(1, Math.min(365, days)) - 1))) : endDate;
}
