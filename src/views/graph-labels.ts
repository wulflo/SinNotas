/**
 * Fundido de las etiquetas del grafo según el zoom.
 *
 * Las etiquetas se ocultan por completo por debajo de 0,75 × el umbral de
 * zoom, se muestran con opacidad plena a partir del umbral y hacen una
 * transición lineal entre ambos puntos. Pintar todas las etiquetas de golpe
 * (un fillText por nodo y fotograma) dominaba el coste del render en grafos
 * grandes, así que alpha 0 nunca llega a llamar a fillText.
 */
export function labelAlphaForZoom(scale: number, threshold: number): number {
  // Un valor no finito no produce una opacidad fiable (NaN/Infinito) → 0.
  if (!Number.isFinite(scale) || !Number.isFinite(threshold)) return 0;
  const start = 0.75 * threshold;
  if (scale >= threshold) return 1;
  if (scale <= start) return 0;
  const alpha = (scale - start) / (threshold - start);
  // Acotado a [0, 1] por si el redondeo en coma flotante se pasa de rango.
  return Math.min(1, Math.max(0, alpha));
}
