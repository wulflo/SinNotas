import type { KanbanTask } from "../types";

const DAY_MS = 86_400_000;

/**
 * Tareas DONE cuya fecha de finalización está dentro de los últimos `days`
 * días. Las tareas sin `done-at::` (las marcadas desde el editor) no se
 * tocan: no hay forma segura de saber cuándo se completaron.
 */
export function completedTasksToRemove(
  tasks: readonly KanbanTask[],
  days: 7 | 30,
  now: number
): KanbanTask[] {
  const cutoff = now - days * DAY_MS;
  return tasks.filter((task) => {
    if (task.status !== "done" || !task.completedAt) return false;
    const completed = Date.parse(task.completedAt);
    return Number.isFinite(completed) && completed >= cutoff && completed <= now;
  });
}

/**
 * Id de nota embebido en `k-<page.id>-<block.id>`. Se resuelve primero contra
 * los ids reales de la bóveda para no depender de que el bloque se llame `b-N`.
 */
export function taskPageId(task: KanbanTask, knownPageIds: readonly string[] = []): string {
  const known = knownPageIds.find((id) => task.id.startsWith(`k-${id}-`));
  if (known) return known;
  const match = task.id.match(/^k-(.+)-b-[^-]+$/);
  return match ? match[1] : task.pageTitle;
}

/** Agrupa por nota para guardar una sola vez por página y no duplicar bloques. */
export function groupTasksByPage(
  tasks: readonly KanbanTask[],
  knownPageIds: readonly string[] = []
): Map<string, KanbanTask[]> {
  const grouped = new Map<string, KanbanTask[]>();
  tasks.forEach((task) => {
    const pageId = taskPageId(task, knownPageIds);
    const existing = grouped.get(pageId);
    if (existing) {
      if (!existing.some((candidate) => candidate.blockId === task.blockId)) {
        existing.push(task);
      }
    } else {
      grouped.set(pageId, [task]);
    }
  });
  return grouped;
}
