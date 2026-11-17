import { BlockNode, PageData } from "../types";

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function serializeBlocks(blocks: BlockNode[], depth = 0): string {
  return blocks
    .map((block) => {
      const indent = "  ".repeat(depth);
      const content = block.type === "image"
        ? `![${block.imageAlt || "imagen"}](${block.content.split(/\r?\n/, 1)[0]})${
            block.content.includes("\n")
              ? `\n${block.content.split(/\r?\n/).slice(1).join("\n")}`
              : ""
          }`
        : block.content;
      const line = `${indent}- ${content}`;
      return block.children.length
        ? `${line}\n${serializeBlocks(block.children, depth + 1)}`
        : line;
    })
    .join("\n");
}

function serializePage(page: PageData): string {
  const frontmatter = page.frontmatter || [];
  const header = frontmatter.length ? `---\n${frontmatter.join("\n")}\n---\n` : "";
  return `${header}${serializeBlocks(page.blocks)}\n`;
}

function plainTextBlocks(blocks: BlockNode[], depth = 0): string[] {
  return blocks.flatMap((block) => {
    const content = block.type === "image"
      ? block.imageAlt || block.content.split(/\r?\n/, 1)[0]
      : block.content;
    const plainContent = content
      .replace(/(?:^|\n)[\w-]+::[^\n]*/g, "")
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, "$2$1")
      .replace(/\{\{(?:c\d+::|cloze\s+)?(.*?)\}\}/gi, "$1")
      .replace(/\*\*(.*?)\*\*|__(.*?)__/g, "$1$2")
      .replace(/\*(.*?)\*|_(.*?)_/g, "$1$2")
      .replace(/~~(.*?)~~|==(.*?)==/g, "$1$2")
      .trim();
    return [
      ...(plainContent ? [`${"  ".repeat(depth)}${plainContent}`] : []),
      ...plainTextBlocks(block.children, depth + 1),
    ];
  });
}

export function serializePageAsPlainText(page: PageData): string {
  return `${page.title}\n${"=".repeat(page.title.length)}\n\n${plainTextBlocks(page.blocks).join("\n")}\n`;
}

function relativeVaultPath(path: string, rootPath?: string | null): string {
  const normalizedPath = path.replace(/\\/g, "/");
  const normalizedRoot = rootPath?.replace(/\\/g, "/").replace(/\/+$/, "");
  if (normalizedRoot && normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1);
  }
  if (/^(?:\/|[a-z]:\/)/i.test(normalizedPath)) {
    return normalizedPath.split("/").pop() || path;
  }
  return normalizedPath;
}

function sanitizeArchivePath(path: string, fallbackTitle: string): string {
  const safeParts = path
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .map((part) => part.replace(/[<>:"|?*\u0000-\u001f]/g, "_"));
  if (safeParts.length === 0) safeParts.push(fallbackTitle.replace(/[<>:"|?*\\/\u0000-\u001f]/g, "_"));
  const filename = safeParts[safeParts.length - 1];
  safeParts[safeParts.length - 1] = filename.replace(/\.md$/i, "") + ".md";
  return safeParts.join("/");
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

function createZip(files: { name: string; content: string }[]): Blob {
  const encoder = new TextEncoder();
  const localRecords: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const filename = encoder.encode(file.name);
    const content = encoder.encode(file.content);
    const checksum = crc32(content);
    const localHeader = new Uint8Array(30 + filename.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, content.length);
    writeUint32(localView, 22, content.length);
    writeUint16(localView, 26, filename.length);
    localHeader.set(filename, 30);
    localRecords.push(localHeader, content);

    const centralHeader = new Uint8Array(46 + filename.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, content.length);
    writeUint32(centralView, 24, content.length);
    writeUint16(centralView, 28, filename.length);
    writeUint32(centralView, 42, localOffset);
    centralHeader.set(filename, 46);
    centralRecords.push(centralHeader);

    localOffset += localHeader.length + content.length;
  }

  const centralSize = centralRecords.reduce((total, record) => total + record.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 8, files.length);
  writeUint16(endView, 10, files.length);
  writeUint32(endView, 12, centralSize);
  writeUint32(endView, 16, localOffset);

  const blobParts = [...localRecords, ...centralRecords, endRecord].map(
    (record) => new Uint8Array(record).buffer
  );
  return new Blob(blobParts, { type: "application/zip" });
}

export function exportVaultAsMarkdownZip(pages: PageData[], rootPath?: string | null): void {
  const usedPaths = new Set<string>();
  const files = pages.map((page, index) => {
    let path = sanitizeArchivePath(relativeVaultPath(page.path, rootPath), page.title);
    if (usedPaths.has(path)) path = path.replace(/\.md$/i, `-${index + 1}.md`);
    usedPaths.add(path);
    return {
      name: path,
      content: serializePage(page),
    };
  });
  downloadBlob("sinnotas-markdown.zip", createZip(files));
}

export function exportVaultAsMarkdown(pages: PageData[], rootPath?: string | null): void {
  const markdown = pages.map((page) => {
    const path = relativeVaultPath(page.path, rootPath);
    const frontmatter = page.frontmatter?.length
      ? `---\n${page.frontmatter.join("\n")}\n---\n\n`
      : "";
    return `# ${page.title}\n\n<!-- ${path} -->\n\n${frontmatter}${serializeBlocks(page.blocks)}`;
  }).join("\n\n---\n\n");
  downloadBlob("sinnotas.md", new Blob([`${markdown}\n`], {
    type: "text/markdown;charset=utf-8",
  }));
}

export function exportVaultAsJson(pages: PageData[], rootPath?: string | null): void {
  downloadBlob(
    "sinnotas.json",
    new Blob([
      JSON.stringify(
        pages.map((page) => ({ ...page, path: relativeVaultPath(page.path, rootPath) })),
        null,
        2
      ),
    ], { type: "application/json;charset=utf-8" })
  );
}

export function exportVaultAsCsv(pages: PageData[], rootPath?: string | null): void {
  const rows = [["pagina", "ruta", "propiedades", "id_bloque", "nivel", "contenido"]];
  const appendBlocks = (page: PageData, blocks: BlockNode[], depth: number) => {
    blocks.forEach((block) => {
      rows.push([
        page.title,
        relativeVaultPath(page.path, rootPath),
        (page.frontmatter || []).join("\n"),
        block.id,
        String(depth),
        block.content,
      ]);
      appendBlocks(page, block.children, depth + 1);
    });
  };
  pages.forEach((page) => appendBlocks(page, page.blocks, 0));

  const csv = rows
    .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  downloadBlob("sinnotas.csv", new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function printVaultAsPdf(pages: PageData[]): boolean {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  const notes = pages
    .map((page) => {
      return `<section><h1>${escapeHtml(page.title)}</h1><pre>${escapeHtml(plainTextBlocks(page.blocks).join("\n"))}</pre></section>`;
    })
    .join("");
  printWindow.document.write(`<!doctype html>
    <html lang="es"><head><meta charset="utf-8"><title>Exportar SinNotas a PDF</title>
    <style>
      body { font: 12pt/1.5 sans-serif; color: #111; margin: 24mm; }
      section { break-after: page; }
      section:last-child { break-after: auto; }
      h1 { font-size: 20pt; border-bottom: 1px solid #bbb; padding-bottom: 8px; }
      pre { font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
    </style></head><body>${notes}</body></html>`);
  printWindow.document.close();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
  return true;
}
