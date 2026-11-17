import { describe, expect, it } from "vitest";
import type { BlockNode, PageData } from "../types";
import {
  BIBLIOGRAPHY_AUTHOR_KEY,
  BIBLIOGRAPHY_CURRENT_KEY,
  applyBibliographyPatch,
  bibliographyItemFromPage,
  bibliographyProgress,
  bibliographyWikilink,
  createBibliographyFrontmatter,
  createBibliographyNoteFrontmatter,
  filterBibliographyItems,
  isBibliographyPage,
  linkedBibliographyNotes,
  pageLinksToTitle,
  quoteYamlScalar,
  readFrontmatterValue,
  sanitizeWikilinkTitle,
  setBibliographyNoteParent,
  setFrontmatterValues,
} from "./bibliography";

function page(overrides: Partial<PageData> = {}): PageData {
  return {
    id: overrides.id || "p-1",
    title: overrides.title || "El nombre del viento",
    path: overrides.path || "bibliografia/El nombre del viento.md",
    blocks: overrides.blocks || [],
    frontmatter: overrides.frontmatter || [],
    updatedAtMs: overrides.updatedAtMs || 0,
    ...overrides,
  };
}

function textBlock(content: string): BlockNode {
  return { id: `b-${content.length}`, type: "text", content, children: [] };
}

describe("frontmatter de bibliografía", () => {
  it("lee valores simples, citados y con dos puntos", () => {
    const frontmatter = [
      "biblioteca: true",
      'bib-autor: "Ursula K. Le Guin"',
      "bib-enlace: https://example.com/libro",
    ];
    expect(readFrontmatterValue(frontmatter, "biblioteca")).toBe("true");
    expect(readFrontmatterValue(frontmatter, "bib-autor")).toBe("Ursula K. Le Guin");
    expect(readFrontmatterValue(frontmatter, "bib-enlace")).toBe("https://example.com/libro");
  });

  it("conserva claves ajenas al aplicar un parche", () => {
    const updated = applyBibliographyPatch(["tags:", "  - estudio", "bib-total: 10"], {
      current: 4,
      author: "Ursula K. Le Guin",
      cover: "assets/portada.webp",
    });
    expect(updated).toContain("tags:");
    expect(updated).toContain("  - estudio");
    expect(readFrontmatterValue(updated, BIBLIOGRAPHY_CURRENT_KEY)).toBe("4");
    expect(readFrontmatterValue(updated, BIBLIOGRAPHY_AUTHOR_KEY)).toBe("Ursula K. Le Guin");
    expect(readFrontmatterValue(updated, "bib-portada")).toBe("assets/portada.webp");
  });

  it("elimina una clave cuando el valor es null", () => {
    const updated = setFrontmatterValues(["bib-portada: assets/a.png", "bib-total: 10"], {
      "bib-portada": null,
    });
    expect(readFrontmatterValue(updated, "bib-portada")).toBeNull();
    expect(readFrontmatterValue(updated, "bib-total")).toBe("10");
  });

  it("cita escalares que YAML interpretaría mal", () => {
    expect(quoteYamlScalar("https://example.com")).toBe('"https://example.com"');
    expect(quoteYamlScalar("Un libro normal")).toBe("Un libro normal");
    expect(quoteYamlScalar("dato # comentario")).toBe('"dato # comentario"');
  });

  it("crea un frontmatter completo para un recurso nuevo", () => {
    const frontmatter = createBibliographyFrontmatter({
      title: "La mano izquierda de la oscuridad",
      type: "book",
      total: 320,
      author: "Ursula K. Le Guin",
    });
    const item = bibliographyItemFromPage(page({ frontmatter }));
    expect(item.type).toBe("book");
    expect(item.status).toBe("reading");
    expect(item.total).toBe(320);
    expect(item.current).toBe(0);
    expect(item.author).toBe("Ursula K. Le Guin");
    expect(isBibliographyPage(page({ frontmatter }))).toBe(true);
  });
});

describe("progreso", () => {
  it("calcula el porcentaje y lo limita entre 0 y 100", () => {
    const base = bibliographyItemFromPage(
      page({
        frontmatter: [
          "biblioteca: true",
          "bib-total: 200",
          "bib-actual: 50",
        ],
      })
    );
    expect(bibliographyProgress(base)).toBe(25);
    expect(
      bibliographyProgress(
        bibliographyItemFromPage(
          page({
            frontmatter: ["biblioteca: true", "bib-total: 10", "bib-actual: 50"],
          })
        )
      )
    ).toBe(100);
  });

  it("marca como completado al alcanzar el total aunque el estado diga otra cosa", () => {
    const item = bibliographyItemFromPage(
      page({
        frontmatter: [
          "biblioteca: true",
          "bib-total: 10",
          "bib-actual: 10",
          "bib-estado: leyendo",
        ],
      })
    );
    expect(item.status).toBe("completed");
  });

  it("limita el progreso actual al total", () => {
    const item = bibliographyItemFromPage(
      page({
        frontmatter: [
          "biblioteca: true",
          "bib-total: 10",
          "bib-actual: 25",
        ],
      })
    );
    expect(item.current).toBe(10);
  });
});

describe("filtros y notas vinculadas", () => {
  const book = bibliographyItemFromPage(
    page({
      id: "p-book",
      title: "Dune",
      frontmatter: [
        "biblioteca: true",
        "bib-tipo: libro",
        "bib-estado: leyendo",
        "bib-autor: Frank Herbert",
        "bib-total: 600",
        "bib-actual: 120",
      ],
    })
  );
  const video = bibliographyItemFromPage(
    page({
      id: "p-video",
      title: "Cómo funciona la memoria",
      frontmatter: [
        "biblioteca: true",
        "bib-tipo: video",
        "bib-estado: pendiente",
        "bib-autor: Veritasium",
        "bib-total: 45",
      ],
    })
  );

  it("filtra por texto, tipo y estado", () => {
    expect(filterBibliographyItems([book, video], "frank", "all", "all")).toEqual([book]);
    expect(filterBibliographyItems([book, video], "", "video", "all")).toEqual([video]);
    expect(filterBibliographyItems([book, video], "", "all", "reading")).toEqual([book]);
    expect(filterBibliographyItems([book, video], "memoria", "all", "pending")).toEqual([video]);
  });

  it("actualiza el padre de una nota hija al renombrar el recurso", () => {
    const frontmatter = createBibliographyNoteFrontmatter("Dune");
    const updated = setBibliographyNoteParent(frontmatter, "Dune Messiah");
    expect(readFrontmatterValue(updated, "bib-padre")).toBe("Dune Messiah");
  });

  it("sanea títulos para que no cierren el wikilink ni inyecten líneas", () => {
    const title = "Dune]]\n# Inyectado";
    expect(sanitizeWikilinkTitle(title)).toBe("Dune)) # Inyectado");
    const body = bibliographyWikilink(title);
    expect(body).toBe("[[Dune)) # Inyectado]]");
    expect(body).not.toContain("\n");
    expect((body.match(/\]\]/g) || []).length).toBe(1);
  });

  it("reconoce notas antiguas y nuevas al comprobar el enlace", () => {
    const oldNote = page({
      id: "p-old",
      title: "Nota antigua",
      blocks: [textBlock("Referencia a [[Dune]]")],
    });
    expect(pageLinksToTitle(oldNote, "Dune")).toBe(true);

    const rawTitle = "Dune]]\n# Inyectado";
    const newNote = page({
      id: "p-new",
      title: "Nota nueva",
      blocks: [textBlock(`Referencia a ${bibliographyWikilink(rawTitle)}`)],
    });
    expect(pageLinksToTitle(newNote, rawTitle)).toBe(true);
  });

  it("conserva el título original en el frontmatter de la nota hija", () => {
    const title = 'Dune]]\n# Inyectado: "x"';
    const frontmatter = createBibliographyNoteFrontmatter(title);
    expect(readFrontmatterValue(frontmatter, "bib-padre")).toBe(title);
    expect(frontmatter.every((line) => !line.includes("\n"))).toBe(true);
  });

  it("encuentra las notas hijas por frontmatter o por wikilink", () => {
    const byFrontmatter = page({
      id: "p-note-1",
      title: "Dune → Ideas",
      path: "pages/Dune → Ideas.md",
      frontmatter: createBibliographyNoteFrontmatter("Dune"),
      updatedAtMs: 1,
    });
    const byLink = page({
      id: "p-note-2",
      title: "Nota antigua",
      path: "pages/Nota antigua.md",
      frontmatter: createBibliographyNoteFrontmatter("Otro título"),
      blocks: [textBlock("Referencia a [[Dune]]")],
      updatedAtMs: 2,
    });
    const plain = page({ id: "p-4", title: "Dune", frontmatter: [] });

    const notes = linkedBibliographyNotes(book, [byFrontmatter, byLink, plain]);
    expect(notes.map((note) => note.id)).toEqual(["p-note-2", "p-note-1"]);
  });
});
