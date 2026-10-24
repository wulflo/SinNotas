/**
 * Free Spaced Repetition Scheduler (FSRS-4.5) implementation for SinNotas.
 * Based on the open-source FSRS algorithm specification.
 *
 * Includes a learning phase for new cards: small fixed steps (1m, 10m, 1d)
 * before graduating to FSRS review, avoiding the wide initial intervals that
 * act as false positives on brand-new cards.
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
  learningStep?: number; // index into learningSteps while in learning state (1)
}

export interface FSRSParameters {
  w: number[];
  requestRetention: number; // default: 0.9 (90% target retention)
  maximumInterval: number; // default: 36500 (100 years)
  /** Fixed learning steps in days before a new card graduates to review. */
  learningSteps: number[];
}

export const defaultFSRSParams: FSRSParameters = {
  w: [
    0.40255, 1.18385, 3.173, 15.69105, // w0..w3: initial stability for ratings 1..4
    7.1949, 0.5345, 1.4604, 0.0046,     // w4..w7: initial difficulty and mean reversion
    1.54575, 0.1192, 1.01925,           // w8..w10: recall stability
    1.9395, 0.11, 0.29605, 0.22695,     // w11..w14: lapse stability
    0.2315, 2.9898                      // w15..w16: hard penalty & easy bonus / retrievability
  ],
  requestRetention: 0.9,
  maximumInterval: 36500,
  // Learning steps: 1 minute, 10 minutes, 1 day.
  learningSteps: [1 / 1440, 10 / 1440, 1],
};

/** Factor de olvido de FSRS-4.5 en la curva de potencia. */
export const FACTOR = 19 / 81;
/** Decaimiento de la curva de potencia de FSRS-4.5. */
export const DECAY = -0.5;

export class FSRSEngine {
  private params: FSRSParameters;

  constructor(params = defaultFSRSParams) {
    this.params = params;
  }

  /** Calculate initial stability for grade 1..4 */
  private initStability(rating: FSRSRating): number {
    return Math.max(0.1, this.params.w[rating - 1]);
  }

  /** Calculate initial difficulty for grade 1..4 clamped to [1, 10] */
  private initDifficulty(rating: FSRSRating): number {
    const d0 = this.params.w[4] - Math.exp(this.params.w[5] * (rating - 1)) + 1;
    return Math.min(10, Math.max(1, d0));
  }

  /** Next difficulty after review */
  private nextDifficulty(d: number, rating: FSRSRating): number {
    const d0_good = this.initDifficulty(3);
    const meanReversion = this.params.w[7] * d0_good + (1 - this.params.w[7]) * (d - this.params.w[6] * (rating - 3));
    return Math.min(10, Math.max(1, meanReversion));
  }

  /** Retrievability given elapsed days t and stability S */
  public retrievability(elapsedDays: number, stability: number): number {
    if (stability <= 0) return 0;
    return Math.pow(1 + FACTOR * (elapsedDays / stability), DECAY);
  }

  /** Next stability on recall (ratings 2, 3, 4) */
  private nextRecallStability(d: number, s: number, r: number, rating: FSRSRating): number {
    const hardPenalty = rating === 2 ? this.params.w[15] : 1.0;
    const easyBonus = rating === 4 ? this.params.w[16] : 1.0;
    const factor =
      1 +
      Math.exp(this.params.w[8]) *
        (11 - d) *
        Math.pow(s, -this.params.w[9]) *
        (Math.exp(this.params.w[10] * (1 - r)) - 1) *
        hardPenalty *
        easyBonus;
    return Math.max(0.1, s * factor);
  }

  /** Next stability on lapse (rating 1: Again) */
  private nextLapseStability(d: number, s: number, r: number): number {
    const lapse =
      this.params.w[11] *
      Math.pow(d, -this.params.w[12]) *
      (Math.pow(s + 1, this.params.w[13]) - 1) *
      Math.exp(this.params.w[14] * (1 - r));
    return Math.max(0.1, Math.min(s, lapse));
  }

  /** Interval in days from stability at target retention */
  public nextInterval(stability: number): number {
    const requestRetention = this.params.requestRetention;
    // Inversa de la curva de potencia: I = (S / FACTOR) · (R^(1/DECAY) − 1)
    // = S · ((R^(1/DECAY) − 1) / FACTOR).
    // Para R = 0.9 el cociente es 1 exactamente en matemáticas; la aritmética
    // en coma flotante lo deja en 0.9999999999999999, lo que desplazaría el
    // redondeo un día. Se corrige ese caso límite para mantener la identidad
    // histórica (I = S cuando requestRetention = 0.9).
    const ratio = (Math.pow(requestRetention, 1 / DECAY) - 1) / FACTOR;
    const effectiveRatio = Math.abs(ratio - 1) < 1e-12 ? 1 : ratio;
    const interval = stability * effectiveRatio;
    return Math.min(this.params.maximumInterval, Math.max(1, Math.round(interval)));
  }

  /** Format interval into human-readable text (1m, 10m, 1d, 5d, 2m, 1y) */
  public formatInterval(days: number): string {
    const minutes = days * 1440;
    if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
    if (days < 2) return "1d";
    if (days < 30) return `${Math.round(days)}d`;
    if (days < 365) {
      const months = Math.round(days / 30);
      return `${months}m`;
    }
    const years = (days / 365).toFixed(1);
    return `${years}a`;
  }

  /**
   * Advance or reset the learning step for a given rating.
   * Returns { step, graduated, intervalDays }.
   */
  private learningStepResult(
    currentStep: number,
    rating: FSRSRating
  ): { step: number; graduated: boolean; intervalDays: number } {
    if (rating === 1) {
      // Again: restart at first learning step
      return { step: 0, graduated: false, intervalDays: this.params.learningSteps[0] };
    }

    if (rating === 4) {
      // Easy: graduate immediately
      return { step: currentStep, graduated: true, intervalDays: 0 };
    }

    // Hard or Good: advance one step
    const nextStep = currentStep + 1;
    if (nextStep >= this.params.learningSteps.length) {
      // Last step reached: graduate to review
      return { step: nextStep, graduated: true, intervalDays: 0 };
    }
    return { step: nextStep, graduated: false, intervalDays: this.params.learningSteps[nextStep] };
  }

  /**
   * Calculate future outcomes for all 4 ratings from current card state
   */
  public previewRatings(item: FSRSItem, elapsedDays = 0): Record<FSRSRating, { item: FSRSItem; intervalDays: number; intervalText: string }> {
    const result = {} as Record<FSRSRating, { item: FSRSItem; intervalDays: number; intervalText: string }>;
    const ratings: FSRSRating[] = [1, 2, 3, 4];

    ratings.forEach((rating) => {
      let nextS: number;
      let nextD: number;
      let nextState: CardState;
      let nextLearningStep: number | undefined;
      let nextLapses = item.lapses;
      let intervalDays: number;

      if (item.state === 0 || item.state === 1) {
        // New card (state 0) or in learning phase (state 1): use fixed learning steps.
        const currentStep = item.state === 1 ? (item.learningStep ?? 0) : 0;
        const lr = this.learningStepResult(currentStep, rating);

        nextS = this.initStability(rating);
        nextD = this.initDifficulty(rating);
        nextLapses = rating === 1 ? item.lapses + 1 : item.lapses;

        if (lr.graduated) {
          nextState = 2; // Review
          nextLearningStep = undefined;
          intervalDays = this.nextInterval(nextS);
        } else {
          nextState = 1; // Learning
          nextLearningStep = lr.step;
          intervalDays = lr.intervalDays;
        }
      } else {
        // Reviewing card (state 2) or relearning (state 3): full FSRS.
        const r = this.retrievability(elapsedDays, item.stability);
        nextD = this.nextDifficulty(item.difficulty, rating);

        if (rating === 1) {
          nextS = this.nextLapseStability(item.difficulty, item.stability, r);
          nextState = 3; // Relearning
          nextLapses += 1;
          intervalDays = 10 / 1440; // 10 minutes
        } else {
          nextS = this.nextRecallStability(item.difficulty, item.stability, r, rating);
          nextState = 2; // Review
          intervalDays = this.nextInterval(nextS);
        }
        nextLearningStep = undefined;
      }

      const intervalText = this.formatInterval(intervalDays);

      result[rating] = {
        item: {
          stability: Number(nextS.toFixed(2)),
          difficulty: Number(nextD.toFixed(2)),
          reps: item.reps + 1,
          lapses: nextLapses,
          state: nextState,
          lastReviewDate: new Date().toISOString(),
          ...(nextLearningStep !== undefined ? { learningStep: nextLearningStep } : {}),
        },
        intervalDays,
        intervalText,
      };
    });

    return result;
  }
}
