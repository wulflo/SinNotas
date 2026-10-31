import { describe, expect, it } from "vitest";
import { KanbanManager } from "./kanban-view";
import { BlockNode, PageData } from "../types";

function page(id: string, contents: string[]): PageData {
  const blocks: BlockNode[] = contents.map((content, index) => ({
    id: `${id}-b${index}`,
    type: "text",
    content,
    children: [],
  }));
  return { id, title: `Nota ${id}`, path: `notas/${id}.md`, blocks };
}

describe("KanbanManager", () => {
  it("detecta tareas y separa metadatos sin parsear bloques que no lo son", () => {
    const manager = new KanbanManager();
    const tasks = manager.scanTasks([
      page("a", [
        "TODO Comprar pan\ntask-due:: 2026-10-30",
        "DOING Escribir informe",
        "DONE Revisar PR",
        "Una nota normal con TODO dentro del texto",
      ]),
    ]);

    expect(tasks).toHaveLength(3);
    expect(tasks.map((task) => task.status)).toEqual(["todo", "doing", "done"]);
    expect(tasks[0].dueDate).toBe("2026-10-30");
    expect(tasks[0].text).toBe("Comprar pan");
  });

  it("reutiliza el escaneo mientras la versión del vault no cambie", () => {
    const manager = new KanbanManager();
    const pages = [page("a", ["TODO Uno"])];

    const first = manager.scanTasks(pages, 1);
    const second = manager.scanTasks(pages, 1);
    expect(second).toBe(first);

    const third = manager.scanTasks(pages, 2);
    expect(third).not.toBe(first);
    expect(third).toHaveLength(1);
  });

  it("sin versión siempre reescanea (compatibilidad con llamadas sueltas)", () => {
    const manager = new KanbanManager();
    const pages = [page("a", ["TODO Uno"])];

    expect(manager.scanTasks(pages)).not.toBe(manager.scanTasks(pages));
  });

  it("rescata las notas hidratadas tras un escaneo sin bloques (FASE 4-D)", () => {
    const manager = new KanbanManager();
    const versions = {
      getStructural: () => 1,
      getPageVersion: (_page: PageData) => 7,
    };
    const dry: PageData = { ...page("a", ["TODO Uno"]), blocksLoaded: false, blocks: [] };

    // Boot de metadatos: el primer scan ve las notas descargadas y captura
    // el epoch centinela; no hay tareas y el tablero queda vacío.
    expect(manager.scanTasks([dry], versions)).toHaveLength(0);

    // Hidratación: misma página, mismos epochs del vault, ahora con bloques.
    const hydrated = page("a", ["TODO Uno"]);
    const tasks = manager.scanTasks([hydrated], versions);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("todo");

    // Fresca: segundo parseo conserva el mismo estado sin reescaneo.
    expect(manager.scanTasks([hydrated], versions)).toBe(tasks);
  });
});
