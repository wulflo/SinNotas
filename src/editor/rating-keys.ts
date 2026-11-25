/** Teclas de calificación por defecto (Otra vez / Difícil / Bien / Fácil). */
export const DEFAULT_RATING_KEYS = ["1", "2", "3", "4"] as const;

const FORBIDDEN_KEYS = new Set(["", " ", "Space", "Escape", "Enter", "Tab"]);

/**
 * Garantiza cuatro teclas no vacías, distintas y comparables con `event.key`.
 * Una tecla inválida o duplicada se sustituye por el primer valor por defecto
 * que siga libre; las letras se normalizan a minúsculas.
 */
export function normalizeRatingKeys(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of Array.from({ length: DEFAULT_RATING_KEYS.length }, (_, index) => values[index])) {
    const candidate = (raw || "").trim().toLowerCase();
    const valid = candidate.length === 1 && !FORBIDDEN_KEYS.has(candidate) && !seen.has(candidate);
    const chosen = valid
      ? candidate
      : (DEFAULT_RATING_KEYS.find((key) => !seen.has(key)) as string);
    seen.add(chosen);
    result.push(chosen);
  }
  return result;
}
