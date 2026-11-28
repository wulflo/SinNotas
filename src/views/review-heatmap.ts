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

/** Segmento de la rueda: un día del año representado como un arco. */
export interface HeatmapWheelSegment {
  d: string;
  level: ReviewHeatmapDay["level"];
  date: string | null;
  count: number;
  monthIndex: number;
}

export interface HeatmapWheelLabel {
  text: string;
  x: number;
  y: number;
  isCurrent: boolean;
}

/* Óvalo ancho y bajo para acompañar la forma del temporizador Pomodoro. */
const WHEEL_CENTER_X = 130;
const WHEEL_CENTER_Y = 90;
const WHEEL_MIN_RX = 34;
const WHEEL_MAX_RX = 104;
const WHEEL_MIN_RY = 22;
const WHEEL_MAX_RY = 66;
const WHEEL_LABEL_RX = 124;
const WHEEL_LABEL_RY = 80;

function wheelPoint(rx: number, ry: number, angle: number): [number, number] {
  return [
    WHEEL_CENTER_X + rx * Math.cos(angle),
    WHEEL_CENTER_Y + ry * Math.sin(angle),
  ];
}

/**
 * Rueda anual: un anillo por mes, un arco por día. Sustituye la cuadrícula de
 * cuadritos por una figura radial sin cambiar colores ni añadir vistas.
 */
export function buildReviewHeatmapWheel(
  months: readonly ReviewHeatmapMonth[],
  currentMonthKey?: string
): { segments: HeatmapWheelSegment[]; labels: HeatmapWheelLabel[] } {
  const segments: HeatmapWheelSegment[] = [];
  const labels: HeatmapWheelLabel[] = [];
  const step = months.length > 1 ? 1 / (months.length - 1) : 0;

  months.forEach((month, monthIndex) => {
    const rx = WHEEL_MIN_RX + monthIndex * step * (WHEEL_MAX_RX - WHEEL_MIN_RX);
    const ry = WHEEL_MIN_RY + monthIndex * step * (WHEEL_MAX_RY - WHEEL_MIN_RY);
    const angleStart = -Math.PI / 2 - (2 * Math.PI) / (months.length || 1) / 2;
    month.days.forEach((day, dayIndex) => {
      if (!day.date) return;
      const dayAngle = (2 * Math.PI) / month.days.length;
      const from = angleStart + dayIndex * dayAngle + 0.02;
      const to = angleStart + (dayIndex + 1) * dayAngle - 0.02;
      const [x1, y1] = wheelPoint(rx, ry, from);
      const [x2, y2] = wheelPoint(rx, ry, to);
      segments.push({
        d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
        level: day.level,
        date: day.date,
        count: day.count,
        monthIndex,
      });
    });

    const labelAngle = angleStart + (monthIndex * 2 * Math.PI) / months.length;
    const [lx, ly] = wheelPoint(WHEEL_LABEL_RX, WHEEL_LABEL_RY, labelAngle);
    labels.push({
      text: month.label.replace(".", "").slice(0, 3).toUpperCase(),
      x: Number(lx.toFixed(2)),
      y: Number(ly.toFixed(2)),
      isCurrent: month.key === currentMonthKey,
    });
  });

  return { segments, labels };
}

export function defaultHeatmapStart(endDate: string, days = 90): string {
  const end = parseLocalDate(endDate);
  return end ? dateKey(addDays(end, -(Math.max(1, Math.min(365, days)) - 1))) : endDate;
}
