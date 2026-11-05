import { defaultFSRSParams, type FSRSParameters } from "./fsrs";

export const FSRS_SETTINGS_KEY = "sinnotas-fsrs-settings";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validSteps(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((step) => finiteNumber(step) && step > 0);
}

export function normalizeFSRSParameters(value: unknown): FSRSParameters {
  if (!value || typeof value !== "object") return { ...defaultFSRSParams };
  const candidate = value as Partial<FSRSParameters>;
  const weights = Array.isArray(candidate.w) && candidate.w.length === 17 &&
      candidate.w.every((weight) => finiteNumber(weight) && weight > 0)
    ? [...candidate.w]
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
    if (!Number.isFinite(days) || days <= 0) return null;
    steps.push(days);
  }
  return steps;
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