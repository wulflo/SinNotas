/**
 * Free Spaced Repetition Scheduler (FSRS-7) implementation for SinNotas.
 *
 * The memory formulas come from the official `ts-fsrs` port of
 * `fsrs-rs/src/model_v7.rs` (34 weights, dual-trace `stability` +
 * `stabilityFast`). See `docs/CHECKLIST-CONSOLIDADO.md` (section B1) and
 * `THIRD_PARTY_LICENSES.md`.
 *
 * FSRS schedules the review phase. New and lapsed cards first go through
 * short learning/relearning steps (under one day), as recommended by the
 * official Anki/FSRS documentation. Those steps are separate from the FSRS
 * memory formulas and avoid treating a brand-new card as a multi-day review.
 */

import {
  FSRS7_DEFAULT_WEIGHTS,
  FSRS7_MODEL_BOUNDS,
  FSRS7Algorithm,
  clipFSRS7Parameters,
  type FSRS7State,
} from "ts-fsrs/models/fsrs-7";

export type FSRSRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy
export type CardState = 0 | 1 | 2 | 3; // 0: New, 1: Learning, 2: Review, 3: Relearning
/** Milisegundos de un día; se usa para programar vencimientos. */
export const DAY_MS = 86_400_000;

export interface FSRSItem {
  stability: number; // S (days)
  difficulty: number; // D (1..10)
  /** Fast trace used by FSRS-7. Absent on cards created before FSRS-7. */
  stabilityFast?: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReviewDate?: string; // ISO date
  learningStep?: number; // index of the last scheduled learning step
}

export interface FSRSParameters {
  /** FSRS-7 uses 34 weights. */
  w: number[];
  requestRetention: number; // default: 0.9 (90% target retention)
  maximumInterval: number; // default: 36500 (100 years)
  /** Learning steps in days. Must stay below one day (official FSRS recommendation). */
  learningSteps: number[];
  /** Relearning steps in days after a lapse. Must also stay below one day. */
  relearningSteps: number[];
}

/** Longitud oficial del vector de pesos de FSRS-7. */
export const FSRS7_WEIGHT_COUNT = 34;

/**
 * Default FSRS-7 parameters published by the official implementation.
 * `w0..w3` initial stability, `w4..w6` difficulty, `w7..w14` slow stability,
 * `w15..w22` fast stability, `w23..w26` forgetting-curve decays and
 * `w27..w33` mixture weights / difficulty timescale.
 */
export const defaultFSRSParams: FSRSParameters = {
  w: [...FSRS7_DEFAULT_WEIGHTS],
  requestRetention: 0.9,
  maximumInterval: 36500,
  // Anki/FSRS default learning steps. Both are shorter than one day so the
  // card can finish learning in the same session.
  learningSteps: [1 / 1440, 10 / 1440],
  relearningSteps: [10 / 1440],
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isStrictlyIncreasing(steps: number[]): boolean {
  return steps.every((step, index) => index === 0 || step > steps[index - 1]);
}

/**
 * Calcula el vencimiento de una tarjeta.
 *
 * Los pasos de aprendizaje (`< 1 día`) conservan la hora exacta. Los
 * intervalos de un día o más se normalizan al inicio del día local: antes
 * heredaban la hora del repaso y dos tarjetas del mismo día podían vencer a
 * horas distintas (o quedar “vencidas” a las 23:50).
 */
export function computeDueDate(reviewedAt: number | string, intervalDays: number): string {
  const reviewed =
    typeof reviewedAt === "number" ? reviewedAt : Date.parse(reviewedAt);
  const safeReviewed = Number.isFinite(reviewed) ? reviewed : Date.now();
  const safeInterval =
    Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : 0;

  if (safeInterval < 1) {
    return new Date(safeReviewed + safeInterval * DAY_MS).toISOString();
  }

  const due = new Date(safeReviewed);
  due.setDate(due.getDate() + Math.round(safeInterval));
  due.setHours(0, 0, 0, 0);
  return due.toISOString();
}

interface LearningTransition {
  state: CardState;
  learningStep?: number;
  graduated: boolean;
  intervalDays: number;
}

export class FSRSEngine {
  private params: FSRSParameters;
  private algorithm: FSRS7Algorithm;

  constructor(params: Partial<FSRSParameters> = {}) {
    this.params = { ...defaultFSRSParams, ...params };

    const normalizeSteps = (steps: unknown, fallback: number[]): number[] =>
      Array.isArray(steps) &&
      steps.every(
        (step) => typeof step === "number" && Number.isFinite(step) && step > 0 && step < 1
      ) &&
      isStrictlyIncreasing(steps as number[])
        ? [...(steps as number[])]
        : [...fallback];

    const weights =
      Array.isArray(this.params.w) &&
      this.params.w.length === FSRS7_WEIGHT_COUNT &&
      this.params.w.every(Number.isFinite)
        ? clipFSRS7Parameters(this.params.w)
        : [...defaultFSRSParams.w];

    this.params = {
      ...this.params,
      w: weights,
      requestRetention: clamp(
        Number.isFinite(this.params.requestRetention)
          ? this.params.requestRetention
          : defaultFSRSParams.requestRetention,
        0.7,
        0.97
      ),
      maximumInterval: Math.max(
        1,
        Number.isFinite(this.params.maximumInterval)
          ? Math.round(this.params.maximumInterval)
          : defaultFSRSParams.maximumInterval
      ),
      learningSteps: normalizeSteps(
        this.params.learningSteps,
        defaultFSRSParams.learningSteps
      ),
      relearningSteps: normalizeSteps(
        this.params.relearningSteps,
        defaultFSRSParams.relearningSteps
      ),
    };

    this.algorithm = new FSRS7Algorithm(weights, FSRS7_MODEL_BOUNDS);
  }

  /** Versión del algoritmo usada por este motor. */
  public readonly version = "FSRS-7";

  /** Parámetros normalizados que el motor usa para calcular intervalos. */
  public getParameters(): FSRSParameters {
    return this.params;
  }

  /** Normaliza un `FSRSItem` a un estado de memoria válido para FSRS-7. */
  private memoryState(item: Pick<FSRSItem, "stability" | "difficulty" | "stabilityFast">): FSRS7State {
    const stability =
      Number.isFinite(item.stability) && item.stability > 0 ? item.stability : 0.01;
    const difficulty =
      Number.isFinite(item.difficulty) && item.difficulty > 0 ? item.difficulty : 5;
    const stabilityFast =
      Number.isFinite(item.stabilityFast) && (item.stabilityFast as number) > 0
        ? (item.stabilityFast as number)
        : stability * 0.8;
    return { stability, difficulty, stabilityFast };
  }

  /** S0(G) = w[G-1]. */
  public initStability(rating: FSRSRating): number {
    return this.algorithm.init_stability(rating);
  }

  /** D0(G) = w4 - exp(w5 · (G - 1)) + 1. */
  public initDifficulty(rating: FSRSRating): number {
    return this.algorithm.init_difficulty(rating);
  }

  /** Retrievability of a memory state after `elapsedDays`. */
  public retrievability(elapsedDays: number, stability: number): number;
  public retrievability(
    elapsedDays: number,
    item: Pick<FSRSItem, "stability" | "difficulty" | "stabilityFast">
  ): number;
  public retrievability(
    elapsedDays: number,
    itemOrStability: number | Pick<FSRSItem, "stability" | "difficulty" | "stabilityFast">
  ): number {
    const item =
      typeof itemOrStability === "number"
        ? { stability: itemOrStability, difficulty: 5, stabilityFast: itemOrStability * 0.8 }
        : itemOrStability;
    return this.algorithm.curve(Math.max(0, elapsedDays), this.memoryState(item)).retrievability;
  }

  /**
   * Interval in days from a complete memory state at the target retention.
   * Sub-day intervals stay fractional so FSRS-7 can honour retentions above
   * 90%; intervals of one day or more are rounded to whole days.
   */
  public nextInterval(stability: number): number;
  public nextInterval(state: Pick<FSRSItem, "stability" | "difficulty" | "stabilityFast">): number;
  public nextInterval(
    stateOrStability: number | Pick<FSRSItem, "stability" | "difficulty" | "stabilityFast">
  ): number {
    const state =
      typeof stateOrStability === "number"
        ? { stability: stateOrStability, difficulty: 5, stabilityFast: stateOrStability * 0.8 }
        : stateOrStability;
    const raw = this.algorithm.next_interval(
      this.memoryState(state),
      this.params.requestRetention
    );
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    // FSRS-7 returns fractional days. Keeping sub-day intervals (instead of
    // clamping them to one day) is what makes 0.91-0.97 retention meaningful.
    const interval = raw < 1 ? raw : Math.round(raw);
    return Math.min(this.params.maximumInterval, interval);
  }

  /**
   * Format interval into human-readable text (1m, 12h, 5d, 2mo, 1y).
   * `mo`/`y` evitan que un intervalo de 30 días se confunda con 30 minutos.
   */
  public formatInterval(days: number): string {
    const minutes = days * 1440;
    if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))}s`;
    if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
    const hours = minutes / 60;
    if (hours < 23.5) return `${Math.max(1, Math.round(hours))}h`;
    // Hasta dos meses se muestran días exactos: redondear 44d a "1mo" o 45d a
    // "2mo" introducía hasta un 33% de error visible.
    if (days < 60) return `${Math.max(1, Math.round(days))}d`;
    if (days < 365) {
      const months = Number((days / 30.4375).toFixed(1));
      return `${Math.max(1, months)}mo`;
    }
    const years = Number((days / 365).toFixed(1));
    return `${years}y`;
  }

  private stepsForState(state: CardState): number[] {
    return state === 3 ? this.params.relearningSteps : this.params.learningSteps;
  }

  /**
   * Short learning/relearning transitions.
   *
   * Again  -> first step.
   * Hard   -> first step: average of the first two steps; later: repeat step.
   * Good   -> next step, or graduate when there is none left.
   * Easy   -> graduate immediately.
   */
  private learningTransition(
    state: CardState,
    currentStep: number,
    rating: FSRSRating
  ): LearningTransition {
    const steps = this.stepsForState(state);
    const learningState: CardState = state === 3 ? 3 : 1;
    if (steps.length === 0) {
      return { state: 2, graduated: true, intervalDays: 0 };
    }

    const step = clamp(Math.floor(currentStep), 0, steps.length - 1);

    if (rating === 1) {
      return { state: learningState, learningStep: 0, graduated: false, intervalDays: steps[0] };
    }

    if (rating === 4) {
      return { state: 2, graduated: true, intervalDays: 0 };
    }

    if (rating === 2) {
      // Solo el primer paso promedia con el siguiente. En los demás pasos
      // "Difícil" repite el paso actual; antes, con 3+ pasos, un Hard en 10m
      // dentro de "1m 10m 1h" saltaba a 35m y alargaba el aprendizaje.
      const intervalDays =
        step === 0 && steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[step];
      return { state: learningState, learningStep: step, graduated: false, intervalDays };
    }

    const nextStep = step + 1;
    if (nextStep >= steps.length) {
      return { state: 2, graduated: true, intervalDays: 0 };
    }
    return { state: learningState, learningStep: nextStep, graduated: false, intervalDays: steps[nextStep] };
  }

  /**
   * Calculate future outcomes for all 4 ratings from the current card state.
   *
   * `elapsedDays` is only used by FSRS review states. During learning, the
   * short fixed steps decide the delay and the memory state is carried from
   * the first rating (plus any lapse on Again).
   */
  public previewRatings(
    item: FSRSItem,
    elapsedDays = 0
  ): Record<FSRSRating, { item: FSRSItem; intervalDays: number; intervalText: string }> {
    const result = {} as Record<
      FSRSRating,
      { item: FSRSItem; intervalDays: number; intervalText: string }
    >;
    const ratings: FSRSRating[] = [1, 2, 3, 4];
    const reviewedAt = new Date().toISOString();
    const state = this.memoryState(item);
    const retrievability = this.algorithm.curve(elapsedDays, state).retrievability;

    ratings.forEach((rating) => {
      let nextState: FSRS7State;
      let nextCardState: CardState;
      let nextLearningStep: number | undefined;
      let nextLapses = item.lapses;
      let intervalDays: number;

      if (item.state === 0) {
        // New card: the first rating initializes both memory traces.
        nextState = this.algorithm.next_state(null, 0, rating);
        const transition = this.learningTransition(0, 0, rating);
        nextCardState = transition.state;
        nextLearningStep = transition.learningStep;
        intervalDays = transition.graduated ? this.nextInterval(nextState) : transition.intervalDays;
      } else if (item.state === 1) {
        // Learning: the fixed steps rule the schedule; FSRS still carries the
        // memory state so graduation starts from a sensible interval.
        const currentStep = item.learningStep ?? 0;
        nextState = this.algorithm.next_state(state, elapsedDays, rating, retrievability);
        const transition = this.learningTransition(1, currentStep, rating);
        nextCardState = transition.state;
        nextLearningStep = transition.learningStep;
        intervalDays = transition.graduated ? this.nextInterval(nextState) : transition.intervalDays;
      } else if (item.state === 3) {
        // Relearning uses the same fixed-step mechanism as learning.
        const currentStep = item.learningStep ?? 0;
        nextState = this.algorithm.next_state(state, elapsedDays, rating, retrievability);
        const transition = this.learningTransition(3, currentStep, rating);
        nextCardState = transition.state;
        nextLearningStep = transition.learningStep;
        intervalDays = transition.graduated ? this.nextInterval(nextState) : transition.intervalDays;
      } else {
        // Review: apply the full FSRS-7 memory formulas.
        nextState = this.algorithm.next_state(state, elapsedDays, rating, retrievability);
        if (rating === 1) {
          nextLapses += 1;
          const transition = this.learningTransition(3, 0, rating);
          // Sin pasos de reaprendizaje la tarjeta no puede quedarse en
          // Relearning con intervalo 0: se gradúa a Review con el intervalo
          // que acaba de calcular FSRS.
          nextCardState = transition.state;
          nextLearningStep = transition.learningStep;
          intervalDays = transition.graduated
            ? this.nextInterval(nextState)
            : transition.intervalDays;
        } else {
          nextCardState = 2; // Review
          intervalDays = this.nextInterval(nextState);
        }
      }

      result[rating] = {
        item: {
          stability: nextState.stability,
          difficulty: nextState.difficulty,
          stabilityFast: nextState.stabilityFast,
          reps: item.reps + 1,
          lapses: nextLapses,
          state: nextCardState,
          lastReviewDate: reviewedAt,
          ...(nextLearningStep !== undefined ? { learningStep: nextLearningStep } : {}),
        },
        intervalDays,
        intervalText: this.formatInterval(intervalDays),
      };
    });

    return result;
  }
}
