import { clipFSRS7Parameters } from "ts-fsrs/models/fsrs-7";
import { defaultFSRSParams, FSRS7_WEIGHT_COUNT, type FSRSParameters } from "./fsrs";

export const FSRS_SETTINGS_KEY = "sinnotas-fsrs-settings";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validSteps(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((step) => finiteNumber(step) && step > 0 && step < 1) &&
    value.every((step, index) => index === 0 || step > (value as number[])[index - 1])
  );
}

/** Copia profunda de los valores por defecto: ningún array se comparte. */
function defaultParameters(): FSRSParameters {
  return {
    w: [...defaultFSRSParams.w],
    requestRetention: defaultFSRSParams.requestRetention,
    maximumInterval: defaultFSRSParams.maximumInterval,
    learningSteps: [...defaultFSRSParams.learningSteps],
    relearningSteps: [...defaultFSRSParams.relearningSteps],
  };
}

export function normalizeFSRSParameters(value: unknown): FSRSParameters {
  if (!value || typeof value !== "object") return defaultParameters();
  const candidate = value as Partial<FSRSParameters>;
  const weights = Array.isArray(candidate.w) && candidate.w.length === FSRS7_WEIGHT_COUNT &&
      candidate.w.every((weight) => finiteNumber(weight) && weight >= 0)
    ? clipFSRS7Parameters(candidate.w)
    : [...defaultFSRSParams.w];
  return {
    w: weights,
    requestRetention: finiteNumber(candidate.requestRetention)
      ? Math.min(0.97, Math.max(0.7, candidate.requestRetention))
      : defaultFSRSParams.requestRetention,
    maximumInterval: finiteNumber(candidate.maximumInterval)
      ? Math.round(Math.min(36500, Math.max(1, candidate.maximumInterval)))
      : defaultFSRSParams.maximumInterval,
    learningSteps: validSteps(candidate.learningSteps)
      ? [...candidate.learningSteps]
      : [...defaultFSRSParams.learningSteps],
    relearningSteps: validSteps(candidate.relearningSteps)
      ? [...candidate.relearningSteps]
      : [...defaultFSRSParams.relearningSteps],
  };
}

export function parseLearningSteps(value: string): number[] | null {
  const input = value.trim();
  if (!input) return [];
  const tokens = input.split(/[\s,]+/);
  const steps: number[] = [];
  for (const token of tokens) {
    const match = token.match(/^(\d+(?:\.\d+)?)(s|m|h|d)$/i);
    if (!match) return null;
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const days = unit === "s" ? amount / 86400 : unit === "m" ? amount / 1440 : unit === "h" ? amount / 24 : amount;
    // FSRS recomienda pasos de aprendizaje por debajo de un día. Un paso de
    // 1d o más dejaría la tarjeta "aprendiendo" durante días sin actualizar
    // el estado de memoria de FSRS.
    if (!Number.isFinite(days) || days <= 0 || days >= 1) return null;
    if (steps.length > 0 && days <= steps[steps.length - 1]) return null;
    steps.push(days);
  }
  return steps;
}

/**
 * Lee el intervalo máximo del formulario. Un campo vacío usa el valor por
 * defecto (antes `Number("")` producía `0` y el motor lo convertía en 1 día).
 * Devuelve `null` si el texto no es un número.
 */
export function parseMaximumInterval(value: string): number | null {
  const input = value.trim();
  if (!input) return defaultFSRSParams.maximumInterval;
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(Math.min(36500, Math.max(1, parsed)));
}

export function formatLearningSteps(steps: number[]): string {
  return steps.map((days) => {
    const minutes = days * 1440;
    if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))}s`;
    if (minutes < 60) return `${Number(minutes.toFixed(2))}m`;
    if (days < 1) return `${Number((days * 24).toFixed(2))}h`;
    return `${Number(days.toFixed(2))}d`;
  }).join(" ");
}

export function loadFSRSParameters(storage: StorageLike): FSRSParameters {
  try {
    const stored = storage.getItem(FSRS_SETTINGS_KEY);
    return stored ? normalizeFSRSParameters(JSON.parse(stored)) : normalizeFSRSParameters(null);
  } catch {
    return normalizeFSRSParameters(null);
  }
}

export function saveFSRSParameters(storage: StorageLike, value: unknown): FSRSParameters {
  const normalized = normalizeFSRSParameters(value);
  storage.setItem(FSRS_SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}