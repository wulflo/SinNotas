import { describe, expect, it } from "vitest";
import { getAllBlocksFlat } from "../editor/tree-engine";
import { initialVaultPages } from "./vault";

const contents = (): string[] =>
  initialVaultPages.flatMap((page) =>
    getAllBlocksFlat(page.blocks).map((block) => block.content)
  );

describe("notas Markdown que se instalan por defecto", () => {
  it("usa resaltado para los huecos cloze, sin sintaxis de llaves", () => {
    const blocks = contents();
    expect(blocks.some((content) => content.includes("{{"))).toBe(false);
    const clozeCards = blocks.filter(
      (content) => content.includes("#card") && /==[^=\n]+==/.test(content)
    );
    expect(clozeCards.length).toBeGreaterThan(0);
  });

  it("no conserva lenguaje de fases iniciales de desarrollo", () => {
    const all = contents().join("\n");
    expect(all).not.toContain("borrador inicial");
    expect(all).not.toContain("Datomic");
    expect(all).not.toContain("Versión inicial");
    expect(all).not.toContain("Integrar el algoritmo");
  });

  it("mantiene las cuatro notas, sus wikilinks y las tarjetas básicas", () => {
    const titles = new Set(initialVaultPages.map((page) => page.title));
    expect(titles.size).toBe(4);
    const links = contents().flatMap((content) =>
      [...content.matchAll(/\[\[([^\]|]+)/g)].map((match) => match[1].trim())
    );
    expect(links.length).toBeGreaterThan(0);
    links.forEach((target) => expect(titles.has(target)).toBe(true));
    const basicCards = contents().filter(
      (content) => content.includes("#card") && content.includes("::")
    );
    expect(basicCards.length).toBeGreaterThan(0);
  });
});
