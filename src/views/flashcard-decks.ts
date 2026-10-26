import { DECK_SEPARATOR, splitDeckTitle } from "../deck-title";

/**
 * Nodo del árbol de mazos.
 *
 * Un nodo puede representar:
 * - solo una agrupación (por ejemplo `Salud mental`),
 * - una nota con tarjetas (por ejemplo una nota llamada `Repaso`),
 * - o ambas cosas a la vez (una nota `Salud mental` con hijas
 *   `Salud mental → 01`, etc.).
 */
export interface DeckNode {
  id: string;
  /** Nombre visible del nivel actual, sin el resto de la ruta. */
  name: string;
  /** Ruta completa de segmentos desde la raíz. */
  path: string[];
  /** Títulos exactos de las notas que terminan en este nodo. */
  pageTitles: string[];
  /** Tarjetas de las notas de este nodo, sin contar las de sus hijos. */
  cardCount: number;
  /** Tarjetas de este nodo y de todos sus descendientes. */
  totalCardCount: number;
  /** Notas de este nodo y de todos sus descendientes. */
  totalPageCount: number;
  children: DeckNode[];
}

export interface DeckTree {
  roots: DeckNode[];
  nodes: Map<string, DeckNode>;
  /** Permite recuperar el nodo que contiene una nota concreta. */
  pageNodes: Map<string, DeckNode>;
}

export interface BuildDeckTreeOptions {
  /** Número de tarjetas de una nota (normalmente sin aplicar el filtro). */
  cardCount: (pageTitle: string) => number;
}

export type DeckSelectionState = "checked" | "unchecked" | "indeterminate";

export interface DeckSearchResult {
  /** Nodos que deben mostrarse (incluye ancestros de las coincidencias). */
  visible: Set<string>;
  /** Nodos que deben mostrarse expandidos aunque el usuario los contrajera. */
  forceExpanded: Set<string>;
  /** Nodos que coinciden directamente con la búsqueda. */
  matched: Set<string>;
}

export interface DeckRow {
  node: DeckNode;
  depth: number;
}

function nodeId(path: readonly string[]): string {
  return path.join("\u0000");
}

/** Compara dos nodos por su nombre, respetando números (`Tema 2` < `Tema 10`). */
export function compareDeckNodesByName(left: DeckNode, right: DeckNode): number {
  return left.name.localeCompare(right.name, "es", {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Construye el árbol agrupando los títulos por sus segmentos.
 *
 * Los hermanos se ordenan alfabéticamente; el llamador puede reordenarlos con
 * `sortDeckTree` si necesita otro criterio.
 */
export function buildDeckTree(
  pageTitles: readonly string[],
  options: BuildDeckTreeOptions
): DeckTree {
  const nodes = new Map<string, DeckNode>();
  const pageNodes = new Map<string, DeckNode>();
  const roots: DeckNode[] = [];
  const seen = new Set<string>();

  for (const pageTitle of pageTitles) {
    if (seen.has(pageTitle)) continue;
    seen.add(pageTitle);

    const segments = splitDeckTitle(pageTitle);
    if (segments.length === 0) continue;

    let siblings = roots;
    let path: string[] = [];

    for (let index = 0; index < segments.length; index++) {
      path = [...path, segments[index]];
      const id = nodeId(path);
      let node = nodes.get(id);
      if (!node) {
        node = {
          id,
          name: segments[index],
          path,
          pageTitles: [],
          cardCount: 0,
          totalCardCount: 0,
          totalPageCount: 0,
          children: [],
        };
        nodes.set(id, node);
        siblings.push(node);
      }

      if (index === segments.length - 1) {
        node.pageTitles.push(pageTitle);
        pageNodes.set(pageTitle, node);
        node.cardCount += options.cardCount(pageTitle);
      }
      siblings = node.children;
    }
  }

  const aggregate = (node: DeckNode): void => {
    node.totalCardCount = node.cardCount;
    node.totalPageCount = node.pageTitles.length;
    for (const child of node.children) {
      aggregate(child);
      node.totalCardCount += child.totalCardCount;
      node.totalPageCount += child.totalPageCount;
    }
  };

  const sortByName = (list: DeckNode[]): void => {
    list.sort(compareDeckNodesByName);
    list.forEach((node) => sortByName(node.children));
  };

  roots.forEach(aggregate);
  sortByName(roots);

  return { roots, nodes, pageNodes };
}

/** Reordena todos los niveles del árbol con un comparador propio. */
export function sortDeckTree(
  tree: DeckTree,
  compare: (left: DeckNode, right: DeckNode) => number
): void {
  const visit = (list: DeckNode[]): void => {
    list.sort(compare);
    list.forEach((node) => visit(node.children));
  };
  visit(tree.roots);
}

/** Devuelve los títulos exactos de todas las notas del nodo y sus descendientes. */
export function collectDeckPageTitles(node: DeckNode): string[] {
  const titles: string[] = [...node.pageTitles];
  for (const child of node.children) {
    titles.push(...collectDeckPageTitles(child));
  }
  return titles;
}

/**
 * Calcula el estado de la casilla de un mazo:
 * marcada, desmarcada o parcial (algunas notas descendientes seleccionadas).
 */
export function getDeckSelectionState(
  node: DeckNode,
  isSelected: (pageTitle: string) => boolean
): DeckSelectionState {
  let selected = 0;
  let total = 0;

  const visit = (current: DeckNode): void => {
    for (const title of current.pageTitles) {
      total++;
      if (isSelected(title)) selected++;
    }
    current.children.forEach(visit);
  };
  visit(node);

  if (total === 0 || selected === 0) return "unchecked";
  return selected === total ? "checked" : "indeterminate";
}

/** Normaliza texto para buscar sin distinguir mayúsculas ni acentos. */
export function normalizeDeckSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Filtra el árbol por una búsqueda.
 *
 * Si coincide el nombre de un mazo se conserva todo su subárbol. Si coincide
 * una nota o un mazo inferior, se conservan también sus ancestros y se fuerzan
 * expandidos para que el resultado sea visible.
 */
export function searchDeckTree(tree: DeckTree, query: string): DeckSearchResult {
  const token = normalizeDeckSearchText(query.trim());
  const visible = new Set<string>();
  const forceExpanded = new Set<string>();
  const matched = new Set<string>();

  if (!token) {
    tree.nodes.forEach((node) => visible.add(node.id));
    return { visible, forceExpanded, matched };
  }

  const markSubtree = (node: DeckNode): void => {
    visible.add(node.id);
    node.children.forEach(markSubtree);
  };

  const visit = (node: DeckNode, ancestors: DeckNode[]): boolean => {
    const selfMatch = normalizeDeckSearchText(node.path.join(DECK_SEPARATOR)).includes(token);
    const pageMatch = node.pageTitles.some((title) =>
      normalizeDeckSearchText(title).includes(token)
    );

    let childMatch = false;
    for (const child of node.children) {
      if (visit(child, [...ancestors, node])) childMatch = true;
    }

    const match = selfMatch || pageMatch || childMatch;
    if (!match) return false;

    visible.add(node.id);
    if (selfMatch || pageMatch) {
      matched.add(node.id);
      markSubtree(node);
      // Si se busca un mazo, se despliega para que se vean sus notas hijas.
      if (node.children.length > 0) forceExpanded.add(node.id);
    }
    ancestors.forEach((ancestor) => forceExpanded.add(ancestor.id));
    if (childMatch) forceExpanded.add(node.id);
    return true;
  };

  tree.roots.forEach((root) => visit(root, []));
  return { visible, forceExpanded, matched };
}

/** Raíces visibles tras aplicar la búsqueda (es lo que se pagina). */
export function visibleDeckRoots(
  tree: DeckTree,
  result: DeckSearchResult
): DeckNode[] {
  return tree.roots.filter((root) => result.visible.has(root.id));
}

/**
 * Convierte las raíces indicadas en filas visibles, respetando qué mazos están
 * contraídos. Cada página del selector contiene raíces completas para que un
 * mazo y sus hijos no queden separados entre páginas.
 */
export function flattenDeckRows(
  roots: readonly DeckNode[],
  result: DeckSearchResult,
  isCollapsed: (nodeId: string) => boolean
): DeckRow[] {
  const rows: DeckRow[] = [];

  const visit = (node: DeckNode, depth: number): void => {
    rows.push({ node, depth });
    if (node.children.length === 0) return;
    const expanded = result.forceExpanded.has(node.id) || !isCollapsed(node.id);
    if (!expanded) return;
    for (const child of node.children) {
      if (result.visible.has(child.id)) visit(child, depth + 1);
    }
  };

  roots.forEach((root) => visit(root, 0));
  return rows;
}
