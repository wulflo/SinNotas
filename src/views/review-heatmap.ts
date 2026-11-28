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

/** Celda de la serpiente: un día, colocado en su columna y fila mensual. */
export interface HeatmapSnakeCell {
  x: number;
  y: number;
  date: string | null;
  count: number;
  level: ReviewHeatmapDay["level"];
  isLeapDay: boolean;
  monthIndex: number;
}

export interface HeatmapSnakeLabel {
  text: string;
  x: number;
  y: number;
}

export interface HeatmapSnakeResult {
  cells: HeatmapSnakeCell[];
  connectors: string[];
  labels: HeatmapSnakeLabel[];
}

const SNAKE_X = 38;
const SNAKE_Y = 8;
const SNAKE_COLS = 31;
const SNAKE_STEP_X = 6.8;
const SNAKE_STEP_Y = 13;
const SNAKE_CELL = 5;

function leapDayInYear(year: number): string | null {
  return new Date(year, 1, 29).getDate() === 29
    ? `${year}-02-29`
    : null;
}

/**
 * Serpiente anual: 12 filas (una por mes) recorridas en direcciones alternas,
 * unidas por curvas en los extremos. Un cuadrito por día y el 29 de febrero
 * señalado en años bisiestos.
 */
export function buildReviewHeatmapSnake(
  months: readonly ReviewHeatmapMonth[],
  year: number
): HeatmapSnakeResult {
  const cells: HeatmapSnakeCell[] = [];
  const connectors: string[] = [];
  const labels: HeatmapSnakeLabel[] = [];
  const leapDay = leapDayInYear(year);

  months.forEach((month, monthIndex) => {
    const rowY = SNAKE_Y + monthIndex * SNAKE_STEP_Y;
    const columnFor = (dayIndex: number): number =>
      monthIndex % 2 === 0 ? dayIndex : SNAKE_COLS - 1 - dayIndex;
    month.days.forEach((day, dayIndex) => {
      if (!day.date) return;
      cells.push({
        x: Number((SNAKE_X + columnFor(dayIndex) * SNAKE_STEP_X).toFixed(2)),
        y: Number(rowY.toFixed(2)),
        date: day.date,
        count: day.count,
        level: day.level,
        isLeapDay: day.date === leapDay,
        monthIndex,
      });
    });
    labels.push({
      text: month.label.replace(".", "").slice(0, 3).toUpperCase(),
      x: 4,
      y: Number((rowY + SNAKE_CELL / 2).toFixed(2)),
    });

    const next = months[monthIndex + 1];
    if (!next) return;
    const lastCol = columnFor(month.days.length - 1);
    const firstNextCol = (monthIndex + 1) % 2 === 0 ? 0 : SNAKE_COLS - 1;
    const x1 = SNAKE_X + lastCol * SNAKE_STEP_X + SNAKE_CELL / 2;
    const x2 = SNAKE_X + firstNextCol * SNAKE_STEP_X + SNAKE_CELL / 2;
    const y1 = rowY + SNAKE_CELL / 2;
    const y2 = rowY + SNAKE_STEP_Y + SNAKE_CELL / 2;
    const bend = monthIndex % 2 === 0 ? 8 : -8;
    connectors.push(
      `M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${(x1 + bend).toFixed(2)} ${((y1 + y2) / 2).toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`
    );
  });

  return { cells, connectors, labels };
}

export function defaultHeatmapStart(endDate: string, days = 90): string {
  const end = parseLocalDate(endDate);
  return end ? dateKey(addDays(end, -(Math.max(1, Math.min(365, days)) - 1))) : endDate;
}
