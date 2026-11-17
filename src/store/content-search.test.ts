import { describe, expect, it } from "vitest";
import { BlockNode, PageData } from "../types";
import {
  ContentSearchIndex,
  buildSnippet,
  collectTextBlocks,
  fold,
  locateMatch,
  visibleBlockText,
} from "./content-search";

function makePage(id: string, title: string, blocks: BlockNode[]): PageData {
  return { id, title, path: `notes/${title}.md`, blocks };
}

function textBlock(id: string, content: string, children: BlockNode[] = []): BlockNode {
  return { id, type: "text", content, children };
}

describe("content-search - recopilación y plegado", () => {
  it("collectTextBlocks devuelve solo bloques de texto con contenido y recorre hijos", () => {
    const inner = textBlock("b3", "hijo anidado");
    const imageBlock: BlockNode = { id: "img", type: "image", content: "assets/foto.png", children: [] };
    const blocks = [textBlock("b1", "texto visible", [inner]), imageBlock, textBlock("b2", "   ")];
    const collected = collectTextBlocks(blocks);
    expect(collected.map((block) => block.id)).toEqual(["b1", "b3"]);
  });

  it("visibleBlockText quita solo las líneas de propiedades clave:: valor", () => {
    const content = "- Tarea pendiente\npriority:: alta\notra:: 1";
    expect(visibleBlockText(content)).toBe("- Tarea pendiente");
    expect(fold("AccIÓN")).toBe("accion");
  });
});

describe("content-search - búsqueda", () => {
  const pages: PageData[] = [
    makePage("p1", "Proyecto", [
      textBlock("b1", "La acción se ejecuta con la acción previa."),
      textBlock("b2", "Pulse accion para activar."),
    ]),
    makePage("p2", "Receta", [textBlock("r1", "Acción de cocina con accion de sal.")]),
    makePage("p3", "Vacía", [textBlock("v1", "Nada relevante aquí.")]),
  ];

  it("exige todas las palabras en el mismo bloque (AND)", () => {
    const index = new ContentSearchIndex();
    index.update(pages, 1);
    const hits = index.search("accion activar");
    expect(hits).toHaveLength(1);
    // El bloque b2 contiene ambas palabras; b1 y r1 solo una.
    expect(hits[0].block.id).toBe("b2");
    expect(hits[0].page.title).toBe("Proyecto");
  });

  it("encuentra 'accion' en 'acción' (sin acentos ni mayúsculas)", () => {
    const index = new ContentSearchIndex();
    index.update(pages, 1);
    const hits = index.search("accion");
    // b1 (2), b2 (1), r1 (2) → 3 notas, todas con 'acción' colapsada.
    expect(hits.map((hit) => hit.page.title)).toEqual(["Proyecto", "Receta"]);
  });

  it("una coincidencia por nota: el bloque con más apariciones gana", () => {
    const index = new ContentSearchIndex();
    index.update(pages, 1);
    const hits = index.search("accion");
    const proyecto = hits.find((hit) => hit.page.title === "Proyecto");
    expect(proyecto?.block.id).toBe("b1");
    expect(proyecto?.count).toBe(2);
  });

  it("ordena por apariciones descendente y aplica el límite", () => {
    const index = new ContentSearchIndex();
    index.update(pages, 1);
    const hits = index.search("accion", 1);
    expect(hits).toHaveLength(1);
    // "Proyecto" gana por apariciones... empate con "Receta": orden estable.
    expect(hits[0].page.title).toBe("Proyecto");
  });

  it("cuenta las apariciones con tope de 20 por token", () => {
    const bloated = makePage("pb", "Peor", [
      textBlock("pb1", `${"cion ".repeat(30).trim()}`),
    ]);
    const index = new ContentSearchIndex();
    index.update([bloated, ...pages], 1);
    const hits = index.search("cion");
    const worst = hits.find((hit) => hit.page.title === "Peor");
    // 30 apariciones se cuentan como 20, no como 30.
    expect(worst?.count).toBe(20);
    // Y no desbancan por ranking artificial a un bloque con 2: el tope ordena
    // por el valor trunco, por lo que "cion" repetida sigue arriba, pero el
    // límite impide que una sola palabra anegue el orden.
    expect(hits[0].count).toBeGreaterThanOrEqual(20);
  });

  it("consulta vacía o solo espacios no devuelve nada", () => {
    const index = new ContentSearchIndex();
    index.update(pages, 1);
    expect(index.search("")).toEqual([]);
    expect(index.search("   \t ")).toEqual([]);
  });

  it("excluye bloques de imagen y líneas de propiedades del texto buscable", () => {
    const mixed = makePage("pm", "Mixta", [
      { id: "img", type: "image", content: "imagen-unica.png", children: [] } as BlockNode,
      textBlock("pm1", "cuerpo real\netiqueta:: valor-unico"),
    ]);
    const index = new ContentSearchIndex();
    index.update([mixed], 1);
    expect(index.search("imagen-unica")).toEqual([]);
    expect(index.search("valor-unico")).toEqual([]);
    expect(index.search("cuerpo real")).toHaveLength(1);
  });

  it("bloques anidados: los hijos del bloque padre se indexan", () => {
    const nested = makePage("pn", "Anidada", [
      textBlock("pn1", "lista padre", [textBlock("pn1-hijo", "palabraclavesiguiente")]),
    ]);
    const index = new ContentSearchIndex();
    index.update([nested], 1);
    expect(index.search("palabraclavesiguiente")).toHaveLength(1);
  });

  it("la caché no reconstruye con la misma versión", () => {
    const otras = makePage("px", "Nueva", [textBlock("px1", "contenido-nuevo")]);
    const index = new ContentSearchIndex();
    index.update(pages, 7);
    // Misma versión: la segunda llamada se ignora, así que el contenido nuevo
    // sigue sin poder encontrarse.
    index.update([otras], 7);
    expect(index.search("contenido-nuevo")).toEqual([]);
    expect(index.search("accion")).not.toEqual([]);

    // Al cambiar la versión sí se reconstruye y ve las páginas nuevas.
    index.update([otras], 8);
    expect(index.search("contenido-nuevo")).toHaveLength(1);
  });
});

describe("content-search - fragmentos", () => {
  it("buildSnippet recorta con elipsis en ambos extremos y colapsa espacios", () => {
    const filler = "A".repeat(60) + " y    espacios   raros ";
    const tail = "B".repeat(90);
    const textY = `${filler}palabraobjetivo ${tail}`;
    const index = textY.indexOf("palabraobjetivo");
    const snippet = buildSnippet(textY, index, "palabraobjetivo".length);
    expect(snippet.before.startsWith("…")).toBe(true);
    expect(snippet.after.endsWith("…")).toBe(true);
    // Espacios colapsados en el contexto.
    expect(snippet.before).toContain("y espacios raros");
    expect(snippet.match).toBe("palabraobjetivo");
  });

  it("el fragmento sin resaltado llega cuando el plegado cambia la longitud", () => {
    // Composición NFD de ejemplo con marcas: fold cambia la longitud del texto,
    // así que el integrador pide el inicio del bloque sin coincidencia.
    const text = "Comienzo del bloque sin marcado   y con espacios.";
    const snippet = buildSnippet(text, 0, 0);
    expect(snippet.match).toBe("");
    expect(snippet.before).toBe("");
    expect(snippet.after.startsWith("Comienzo del bloque")).toBe(true);
  });

  it("coincidencia al principio no añade elipsis de antes", () => {
    const text = "palabraobjetivo y más texto";
    const snippet = buildSnippet(text, 0, "palabraobjetivo".length);
    expect(snippet.before).toBe("");
    expect(snippet.match).toBe("palabraobjetivo");
  });
});

describe("content-search - rendimiento (sin umbral, solo registro)", () => {
  it("update y search sobre 2000 páginas sintéticas de 30 bloques", () => {
    const pages: PageData[] = [];
    for (let i = 0; i < 2000; i++) {
      const blocks: BlockNode[] = [];
      for (let j = 0; j < 30; j++) {
        blocks.push(
          textBlock(
            `p${i}-b${j}`,
            `Este es el bloque ${j} de la nota ${i} con texto de relleno para la búsqueda de contenido.`
          )
        );
      }
      pages.push(makePage(`sin-${i}`, `Nota ${i}`, blocks));
    }

    const index = new ContentSearchIndex();
    const updateStart = performance.now();
    index.update(pages, pages.length);
    const buildMs = performance.now() - updateStart;

    const searchStart = performance.now();
    const hits = index.search("bloque 3", 25);
    const searchMs = performance.now() - searchStart;

    expect(hits.length).toBeGreaterThan(0);
    // Registrado en docs/SinNotas.md#rendimiento; sin umbral estricto para no hacerlo frágil.
    console.info(
      `[content-search] 2000 páginas × 30 bloques (60000 bloques): update ${buildMs.toFixed(0)}ms, search ${searchMs.toFixed(1)}ms`
    );
  });
});


describe("content-search - rango de la coincidencia (T15)", () => {
  it("devuelve el índice directo cuando el plegado conserva la longitud", () => {
    const text = "La estabilidad del algoritmo";
    const folded = fold(text);
    const index = folded.indexOf("estabilidad");
    expect(locateMatch(text, "estabilidad", index, "estabilidad".length)).toEqual({
      start: index,
      end: index + "estabilidad".length,
    });
  });

  it("mapea acentos aunque NFD cambie la longitud", () => {
    const text = "Una página con acentos";
    const folded = fold(text);
    const index = folded.indexOf("pagina");
    const range = locateMatch(text, "pagina", index, "pagina".length);
    expect(range).not.toBeNull();
    expect(text.slice(range!.start, range!.end)).toBe("página");
  });

  it("elige la aparición más cercana al índice original", () => {
    const text = "gato perro gato";
    const folded = fold(text);
    const second = folded.lastIndexOf("gato");
    const range = locateMatch(text, "gato", second, 4);
    expect(range).toEqual({ start: second, end: second + 4 });
  });

  it("devuelve null si no puede mapear sin consulta", () => {
    expect(locateMatch("a\u0301bc", "", 1, 2)).toBeNull();
  });
});
