/**
 * Guarda de generación para operaciones asíncronas que mutan la bóveda.
 * Si el vault cambió mientras esperábamos (cambio de bóveda, delta externo,
 * renombre), el resultado ya no pertenece al estado actual y debe descartarse.
 */
export function isStaleMutation(capturedEpoch: number, currentEpoch: number): boolean {
  return capturedEpoch !== currentEpoch;
}
