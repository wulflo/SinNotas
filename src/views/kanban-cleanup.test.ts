import { describe, expect, it } from "vitest";
import type { KanbanTask } from "../types";
import { completedTasksToRemove, groupTasksByPage } from "./kanban-cleanup";

const NOW = Date.parse("2026-11-26T12:00:00.000Z");
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function task(
  id: string,
  status: KanbanTask["status"],
  completedAt?: string
): KanbanTask {
  return {
    id,
    pageTitle: "Diarios",
    blockId: id,
    text: "tarea",
    content: `${status.toUpperCase()} tarea`,
    status,
    completedAt,
  };
}

describe("completedTasksToRemove", () => {
  it("selecciona solo DONE con fecha dentro del rango pedido", () => {
    const tasks = [
      task("k-p-a-b-1", "done", day(3)),
      task("k-p-a-b-2", "done", day(8)),
      task("k-p-a-b-3", "done", day(40)),
      task("k-p-a-b-4", "todo", day(3)),
    ];

    expect(completedTasksToRemove(tasks, 7, NOW).map((t) => t.blockId)).toEqual(["k-p-a-b-1"]);
    expect(completedTasksToRemove(tasks, 30, NOW).map((t) => t.blockId)).toEqual([
      "k-p-a-b-1",
      "k-p-a-b-2",
    ]);
  });

  it("no borra DONE sin fecha, con fecha inválida ni del futuro", () => {
    const tasks = [
      task("k-p-a-b-1", "done"),
      task("k-p-a-b-2", "done", "no es fecha"),
      task("k-p-a-b-3", "done", day(-1)),
      task("k-p-a-b-4", "done", day(0)),
    ];
    expect(completedTasksToRemove(tasks, 30, NOW).map((t) => t.blockId)).toEqual(["k-p-a-b-4"]);
  });

  it("incluye el límite exacto del periodo", () => {
    expect(completedTasksToRemove([task("k-p-a-b-1", "done", day(7))], 7, NOW)).toHaveLength(1);
    expect(completedTasksToRemove([task("k-p-a-b-1", "done", day(30))], 30, NOW)).toHaveLength(1);
  });
});

describe("groupTasksByPage", () => {
  it("agrupa por id de nota y evita duplicar un mismo bloque", () => {
    const tasks = [
      task("k-p-a-b-1", "done", day(1)),
      task("k-p-a-b-2", "done", day(2)),
      task("k-p-a-b-2", "done", day(2)),
      task("k-p-b-b-9", "done", day(3)),
    ];
    const grouped = groupTasksByPage(tasks);
    expect([...grouped.keys()]).toEqual(["p-a", "p-b"]);
    expect(grouped.get("p-a")).toHaveLength(2);
    expect(grouped.get("p-b")).toHaveLength(1);
  });

  it("resuelve la nota con ids de bloque no canónicos si conoce los ids de la bóveda", () => {
    const custom = task("k-p-welcome-bt-done-3", "done", day(1));
    expect(groupTasksByPage([custom], ["p-welcome"]).has("p-welcome")).toBe(true);
  });
});
