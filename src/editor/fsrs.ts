/**
 * Free Spaced Repetition Scheduler (FSRS-4.5) implementation for SinNotas.
 * Based on the official algorithm specification:
 * https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
 *
 * FSRS schedules the review phase. New and lapsed cards first go through
 * short learning/relearning steps (under one day), as recommended by the
 * official Anki/FSRS documentation. Those steps are separate from the FSRS
 * memory formulas and avoid treating a brand-new card as a multi-day review.
 */

export type FSRSRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy
export type CardState = 0 | 1 | 2 | 3; // 0: New, 1: Learning, 2: Review, 3: Relearning

export interface FSRSItem {
  stability: number; // S (days)
  difficulty: number; // D (1..10)
  reps: number;
  lapses: number;
  state: CardState;
  lastReviewDate?: string; // ISO date
  learningStep?: number; // index of the last scheduled learning step
}

export interface FSRSParameters {
  w: number[];
  requestRetention: number; // default: 0.9 (90% target retention)
  maximumInterval: number; // default: 36500 (100 years)
  /** Learning steps in days. Must stay below one day (official FSRS recommendation). */
  learningSteps: number[];
  /** Relearning steps in days after a lapse. Must also stay below one day. */
  relearningSteps: number[];
}

/**
 * Default parameters published for FSRS-4.5. They use 17 weights:
 * w0..w3 initial stability, w4..w7 difficulty, w8..w10 recall stability,
 * w11..w14 post-lapse stability and w15..w16 hard/easy modifiers.
 */
export const defaultFSRSParams: FSRSParameters = {
  w: [
    0.4872, 1.4003, 3.7145, 13.8206,
    5.1618, 1.2298, 0.8975, 0.031,
    1.6474, 0.1367, 1.0461,
    2.1072, 0.0793, 0.3246, 1.587,
    0.2272, 2.8755,
  ],
  requestRetention: 0.9,
  maximumInterval: 36500,
  // Anki/FSRS default learning steps. Both are shorter than one day so the
  // card can finish learning in the same session.
  learningSteps: [1 / 1440, 10 / 1440],
  relearningSteps: [10 / 1440],
};

/** Factor de olvido de FSRS-4.5 en la curva de potencia. */
export const FACTOR = 19 / 81;
/** Decaimiento de la curva de potencia de FSRS-4.5. */
export const DECAY = -0.5;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

interface LearningTransition {
  state: CardState;
  learningStep?: number;
  graduated: boolean;
  intervalDays: number;
}

export class FSRSEngine {
  private params: FSRSParameters;

  constructor(params: Partial<FSRSParameters> = {}) {
    this.params = { ...defaultFSRSParams, ...params };
  }

  /** S0(G) = w[G-1]. */
  private initStability(rating: FSRSRating): number {
    return Math.max(0.01, this.params.w[rating - 1]);
  }

  /** D0(G) = w4 - (G - 3) * w5, clamped to [1, 10]. */
  private initDifficulty(rating: FSRSRating): number {
    const d0 = this.params.w[4] - (rating - 3) * this.params.w[5];
    return clamp(d0, 1, 10);
  }

  /**
   * D' = w7 * D0(3) + (1 - w7) * (D - w6 * (G - 3)).
   * This is the FSRS-4.5 mean-reversion formula.
   */
  private nextDifficulty(difficulty: number, rating: FSRSRating): number {
    const meanReversion = this.params.w[7] * this.initDifficulty(3);
    const adjusted = meanReversion + (1 - this.params.w[7]) * (difficulty - this.params.w[6] * (rating - 3));
    return clamp(adjusted, 1, 10);
  }

  /** Retrievability given elapsed days t and stability S. */
  public retrievability(elapsedDays: number, stability: number): number {
    if (stability <= 0) return 0;
    return Math.pow(1 + FACTOR * (Math.max(0, elapsedDays) / stability), DECAY);
  }

  /** S'r after a successful review (ratings 2, 3 and 4). */
  private nextRecallStability(
    difficulty: number,
    stability: number,
    retrievability: number,
    rating: FSRSRating
  ): number {
    const hardPenalty = rating === 2 ? this.params.w[15] : 1;
    const easyBonus = rating === 4 ? this.params.w[16] : 1;
    const factor =
      1 +
      Math.exp(this.params.w[8]) *
        (11 - difficulty) *
        Math.pow(stability, -this.params.w[9]) *
        (Math.exp(this.params.w[10] * (1 - retrievability)) - 1) *
        hardPenalty *
        easyBonus;
    return Math.max(0.01, stability * factor);
  }

  /** S'f after forgetting (rating 1). */
  private nextLapseStability(difficulty: number, stability: number, retrievability: number): number {
    const lapse =
      this.params.w[11] *
      Math.pow(difficulty, -this.params.w[12]) *
      (Math.pow(stability + 1, this.params.w[13]) - 1) *
      Math.exp(this.params.w[14] * (1 - retrievability));
    return Math.max(0.01, lapse);
  }

  /** Interval in days from stability at the configured target retention. */
  public nextInterval(stability: number): number {
    const requestRetention = this.params.requestRetention;
    // Inversa de la curva de potencia: I = (S / FACTOR) · (R^(1/DECAY) − 1).
    // Para R = 0.9 el cociente es 1 exactamente en matemáticas; la aritmética
    // en coma flotante lo deja en 0.9999999999999999, lo que desplazaría el
    // redondeo un día. Se corrige ese caso límite para mantener la identidad
    // histórica (I = S cuando requestRetention = 0.9).
    const ratio = (Math.pow(requestRetention, 1 / DECAY) - 1) / FACTOR;
    const effectiveRatio = Math.abs(ratio - 1) < 1e-12 ? 1 : ratio;
    const interval = stability * effectiveRatio;
    return Math.min(this.params.maximumInterval, Math.max(1, Math.round(interval)));
  }

  /**
   * Format interval into human-readable text (1m, 12h, 5d, 2mo, 1y).
   * `mo`/`y` evitan que un intervalo de 30 días se confunda con 30 minutos.
   */
  public formatInterval(days: number): string {
    const minutes = days * 1440;
    if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
    if (days < 1) return `${Math.max(1, Math.round(minutes / 60))}h`;
    if (days < 30) return `${Math.round(days)}d`;
    if (days < 365) {
      const months = Math.max(1, Math.round(days / 30));
      return `${months}mo`;
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
      const intervalDays =
        step + 1 < steps.length ? (steps[step] + steps[step + 1]) / 2 : steps[step];
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
   * short fixed steps decide the delay and the memory state is carried from the
   * first rating (plus any lapse on Again).
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
    const safeStability = item.stability > 0 ? item.stability : this.initStability(3);
    const safeDifficulty = item.difficulty > 0 ? item.difficulty : this.initDifficulty(3);
    const retrievability = this.retrievability(elapsedDays, safeStability);

    ratings.forEach((rating) => {
      let nextS: number;
      let nextD: number;
      let nextState: CardState;
      let nextLearningStep: number | undefined;
      let nextLapses = item.lapses;
      let intervalDays: number;

      if (item.state === 0) {
        // New card: the first rating initializes both memory components.
        nextS = this.initStability(rating);
        nextD = this.initDifficulty(rating);
        const transition = this.learningTransition(0, 0, rating);
        nextState = transition.state;
        nextLearningStep = transition.learningStep;
        intervalDays = transition.graduated ? 0 : transition.intervalDays;
      } else if (item.state === 1) {
        // Learning: the fixed steps rule the schedule; FSRS still carries the
        // memory state so graduation starts from a sensible interval.
        const currentStep = item.learningStep ?? 0;
        nextD = this.nextDifficulty(safeDifficulty, rating);
        // En Learning, Easy también es un repaso correcto: se aplica la
        // fórmula de estabilidad de recuerdo, no se reinicia a S0(4). Reiniciar
        // la estabilidad ignoraba la memoria acumulada durante los pasos.
        nextS =
          rating === 1
            ? this.nextLapseStability(safeDifficulty, safeStability, retrievability)
            : this.nextRecallStability(safeDifficulty, safeStability, retrievability, rating);
        const transition = this.learningTransition(1, currentStep, rating);
        nextState = transition.state;
        nextLearningStep = transition.learningStep;
        intervalDays = transition.graduated ? 0 : transition.intervalDays;
      } else if (item.state === 3) {
        // Relearning uses the same fixed-step mechanism as learning.
        const currentStep = item.learningStep ?? 0;
        nextD = this.nextDifficulty(safeDifficulty, rating);
        // Igual que en Learning: Easy usa la fórmula de recuerdo y conserva
        // la estabilidad acumulada; no se fuerza el mínimo de una tarjeta nueva.
        nextS =
          rating === 1
            ? this.nextLapseStability(safeDifficulty, safeStability, retrievability)
            : this.nextRecallStability(safeDifficulty, safeStability, retrievability, rating);
        const transition = this.learningTransition(3, currentStep, rating);
        nextState = transition.state;
        nextLearningStep = transition.learningStep;
        intervalDays = transition.graduated ? 0 : transition.intervalDays;
      } else {
        // Review: apply the full FSRS-4.5 memory formulas.
        nextD = this.nextDifficulty(safeDifficulty, rating);
        if (rating === 1) {
          nextS = this.nextLapseStability(safeDifficulty, safeStability, retrievability);
          nextState = 3; // Relearning
          nextLapses += 1;
          const transition = this.learningTransition(3, 0, rating);
          nextLearningStep = transition.learningStep;
          intervalDays = transition.intervalDays;
        } else {
          nextS = this.nextRecallStability(safeDifficulty, safeStability, retrievability, rating);
          nextState = 2; // Review
          intervalDays = this.nextInterval(nextS);
        }
      }

      if (nextState === 2 && intervalDays === 0) {
        intervalDays = this.nextInterval(nextS);
      }

      result[rating] = {
        item: {
          stability: Number(nextS.toFixed(2)),
          difficulty: Number(nextD.toFixed(2)),
          reps: item.reps + 1,
          lapses: nextLapses,
          state: nextState,
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
