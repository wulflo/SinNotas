import { KanbanTask, KanbanStatus, PageData } from "../types";
import { getAllBlocksFlat } from "../editor/tree-engine";
import { stripCardTag } from "../editor/markdown";

export class KanbanManager {
  private tasks: KanbanTask[] = [];
  private scanPages: PageData[] | null = null;
  private scanVersion: unknown = undefined;

  constructor() {}

  private static splitTaskMetadata(content: string): { visible: string; metadata: string[] } {
    const visible: string[] = [];
    const metadata: string[] = [];
    let inFrontmatter = false;
    content.split(/\r?\n/).forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed === "---" && (inFrontmatter || index === 1)) {
        inFrontmatter = !inFrontmatter;
        metadata.push(line);
      } else if (inFrontmatter || /^[\w-]+::\s*.*$/i.test(trimmed)) {
        metadata.push(line);
      } else {
        visible.push(line);
      }
    });
    return { visible: visible.join("\n").trim(), metadata };
  }

  public scanTasks(pages: PageData[], version?: unknown): KanbanTask[] {
    // Reutiliza el escaneo mientras el vault no haya mutado. Entrar y salir
    // del Kanban con 12.000 tareas ya no reparsea 225.000 bloques cada vez.
    if (version !== undefined && version === this.scanVersion && pages === this.scanPages) {
      return this.tasks;
    }

    const list: KanbanTask[] = [];

    pages.forEach((page) => {
      const flat = getAllBlocksFlat(page.blocks);

      flat.forEach((b) => {
        const content = b.content.trim();
        // Descarte temprano: la mayoría de los 225.000 bullets no son tareas
        // y no necesitan separar metadatos ni construir objetos.
        if (!/(TODO|LATER|DOING|NOW|DONE)\s/i.test(content)) return;
        const { visible: text, metadata } = KanbanManager.splitTaskMetadata(content);
        let status: KanbanStatus | null = null;
        let cleanText = text;

        if (/^(TODO|LATER)\s+/i.test(text)) {
          status = "todo";
          cleanText = text.replace(/^(TODO|LATER)\s+/i, "");
        } else if (/^(DOING|NOW)\s+/i.test(text)) {
          status = "doing";
          cleanText = text.replace(/^(DOING|NOW)\s+/i, "");
        } else if (/^DONE\s+/i.test(text)) {
          status = "done";
          cleanText = text.replace(/^DONE\s+/i, "");
        }

        if (status) {
          const timing = KanbanManager.parseTimingFromMetadata(metadata);
          list.push({
            id: `k-${page.id}-${b.id}`,
            pageTitle: page.title,
            blockId: b.id,
            text: stripCardTag(cleanText).trim(),
            content,
            status,
            dueDate: KanbanManager.parseDueDateFromMetadata(metadata),
            doingStartedAt: timing.doingStartedAt,
            completedAt: timing.completedAt,
            doingDurationSeconds: timing.doingDurationSeconds,
          });
        }
      });
    });

    this.tasks = list;
    this.scanPages = pages;
    this.scanVersion = version;
    return this.tasks;
  }

  public getTasksByStatus(status: KanbanStatus): KanbanTask[] {
    return this.tasks.filter((t) => t.status === status);
  }

  private static parseDueDateFromMetadata(metadata: string[]): string | undefined {
    return metadata
      .find((line) => /^task-due::\s*.+$/i.test(line.trim()))
      ?.replace(/^task-due::\s*/i, "")
      .trim();
  }

  public static parseTaskDueDate(content: string): string | undefined {
    const { metadata } = KanbanManager.splitTaskMetadata(content);
    return KanbanManager.parseDueDateFromMetadata(metadata);
  }

  private static parseTimingFromMetadata(metadata: string[]): {
    doingStartedAt?: string;
    completedAt?: string;
    doingDurationSeconds?: number;
  } {
    const value = (name: string) =>
      metadata.find((line) => new RegExp(`^${name}::\\s*.+$`, "i").test(line))
        ?.replace(new RegExp(`^${name}::\\s*`, "i"), "")
        .trim();
    const doingStartedAt = value("doing-started-at");
    const completedAt = value("done-at");
    const storedDuration = Number(value("doing-duration-seconds"));
    const computed =
      doingStartedAt && completedAt
        ? Math.max(0, Math.round((Date.parse(completedAt) - Date.parse(doingStartedAt)) / 1000))
        : Number.NaN;
    const doingDurationSeconds = Number.isFinite(storedDuration)
      ? storedDuration
      : Number.isFinite(computed)
        ? computed
        : undefined;
    return { doingStartedAt, completedAt, doingDurationSeconds };
  }

  public static parseTiming(content: string): {
    doingStartedAt?: string;
    completedAt?: string;
    doingDurationSeconds?: number;
  } {
    const { metadata } = KanbanManager.splitTaskMetadata(content);
    return KanbanManager.parseTimingFromMetadata(metadata);
  }

  public static formatBlockWithStatus(currentText: string, newStatus: KanbanStatus): string {
    const { visible, metadata } = KanbanManager.splitTaskMetadata(currentText);
    const clean = visible
      .replace(/^(TODO|LATER|DOING|NOW|DONE)\s+/i, "")
      .trim();
    const prefix = newStatus === "todo" ? "TODO" : newStatus === "doing" ? "DOING" : "DONE";
    const now = new Date().toISOString();
    const previous = KanbanManager.parseTiming(currentText);
    const kept = metadata.filter((line) =>
      !/^(doing-started-at|done-at|doing-duration-seconds)::/i.test(line.trim())
    );
    if (newStatus === "doing") {
      kept.push(`doing-started-at:: ${previous.doingStartedAt || now}`);
    } else if (newStatus === "done") {
      const started = previous.doingStartedAt || now;
      const duration = Math.max(0, Math.round((Date.parse(now) - Date.parse(started)) / 1000));
      kept.push(`doing-started-at:: ${started}`);
      kept.push(`done-at:: ${now}`);
      kept.push(`doing-duration-seconds:: ${duration}`);
    }
    const updated = `${prefix} ${clean}`.trimEnd();
    return kept.length ? `${updated}\n${kept.join("\n")}` : updated;
  }

  public static clearTaskStatus(currentText: string): string {
    const { visible, metadata } = KanbanManager.splitTaskMetadata(currentText);
    const clean = visible.replace(/^(TODO|LATER|DOING|NOW|DONE)\s+/i, "").trim();
    const kept = metadata.filter((line) =>
      !/^(doing-started-at|done-at|doing-duration-seconds)::/i.test(line.trim())
    );
    return kept.length ? `${clean}\n${kept.join("\n")}` : clean;
  }

  public static hasCompletionReward(currentText: string): boolean {
    const { metadata } = KanbanManager.splitTaskMetadata(currentText);
    return metadata.some((line) => /^completion-rewarded::\s*true$/i.test(line.trim()));
  }

  public static markCompletionReward(currentText: string): string {
    if (KanbanManager.hasCompletionReward(currentText)) return currentText;
    const { visible, metadata } = KanbanManager.splitTaskMetadata(currentText);
    const marker = "completion-rewarded:: true";
    return metadata.length
      ? `${visible}\n${metadata.join("\n")}\n${marker}`
      : `${visible}\n${marker}`;
  }

  public static cycleTaskStatus(currentText: string): string {
    const { visible } = KanbanManager.splitTaskMetadata(currentText);
    if (/^(TODO|LATER)\s+/i.test(visible)) return KanbanManager.formatBlockWithStatus(currentText, "doing");
    if (/^(DOING|NOW)\s+/i.test(visible)) return KanbanManager.formatBlockWithStatus(currentText, "done");
    if (/^DONE\s+/i.test(visible)) return KanbanManager.clearTaskStatus(currentText);
    return KanbanManager.formatBlockWithStatus(currentText, "todo");
  }
}
