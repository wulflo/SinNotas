import { BlockNode } from "../types";

const MAX_TREE_DEPTH = 64;

export function generateId(): string {
  return "b-" + Math.random().toString(36).substring(2, 9);
}

export function cloneTree(nodes: BlockNode[]): BlockNode[] {
  // Versión iterativa con límite de profundidad para evitar stack overflow
  const result: BlockNode[] = [];
  // Stack: { sourceNode, targetParent, targetParentChildrenArray, depth }
  interface StackItem {
    sourceNode: BlockNode;
    targetParentChildren: BlockNode[];
    depth: number;
  }
  const stack: StackItem[] = nodes
    .slice()
    .reverse()
    .map((n) => ({ sourceNode: n, targetParentChildren: result, depth: 0 }));

  while (stack.length > 0) {
    const item = stack.pop()!;
    if (item.depth >= MAX_TREE_DEPTH) continue;

    const cloned: BlockNode = {
      ...item.sourceNode,
      children: [],
    };
    item.targetParentChildren.push(cloned);

    // Empujar hijos en orden inverso para mantener el orden correcto
    const children = item.sourceNode.children || [];
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({
        sourceNode: children[i],
        targetParentChildren: cloned.children,
        depth: item.depth + 1,
      });
    }
  }
  return result;
}

export interface NodeLocation {
  parentList: BlockNode[];
  index: number;
  parentNode: BlockNode | null;
}

export function findNodeLocation(
  nodes: BlockNode[],
  targetId: string,
  parentNode: BlockNode | null = null
): NodeLocation | null {
  // Versión iterativa con límite de profundidad
  interface StackItem {
    nodes: BlockNode[];
    parentNode: BlockNode | null;
    depth: number;
  }
  const stack: StackItem[] = [{ nodes, parentNode, depth: 0 }];

  while (stack.length > 0) {
    const { nodes, parentNode, depth } = stack.pop()!;
    if (depth >= MAX_TREE_DEPTH) continue;

    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === targetId) {
        return { parentList: nodes, index: i, parentNode };
      }
      if (nodes[i].children && nodes[i].children.length > 0) {
        stack.push({
          nodes: nodes[i].children!,
          parentNode: nodes[i],
          depth: depth + 1,
        });
      }
    }
  }
  return null;
}

/** Flatten visible blocks in top-to-bottom visual order */
export function getFlatVisibleBlocks(nodes: BlockNode[]): BlockNode[] {
  const result: BlockNode[] = [];
  // Stack iterativo: { node, depth }
  interface StackItem {
    node: BlockNode;
    depth: number;
  }
  const stack: StackItem[] = nodes
    .slice()
    .reverse()
    .map((n) => ({ node: n, depth: 0 }));

  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (depth >= MAX_TREE_DEPTH) continue;

    result.push(node);
    if (!node.collapsed && node.children && node.children.length > 0) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ node: node.children[i], depth: depth + 1 });
      }
    }
  }
  return result;
}

/** Flatten all blocks recursively regardless of collapse state */
export function getAllBlocksFlat(nodes: BlockNode[]): BlockNode[] {
  const result: BlockNode[] = [];
  interface StackItem {
    node: BlockNode;
    depth: number;
  }
  const stack: StackItem[] = nodes
    .slice()
    .reverse()
    .map((n) => ({ node: n, depth: 0 }));

  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (depth >= MAX_TREE_DEPTH) continue;

    result.push(node);
    if (node.children && node.children.length > 0) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ node: node.children[i], depth: depth + 1 });
      }
    }
  }
  return result;
}

export function getSelectedBlockRoots(nodes: BlockNode[], selectedIds: ReadonlySet<string>): BlockNode[] {
  const selected: BlockNode[] = [];
  interface StackItem {
    node: BlockNode;
    depth: number;
    ancestorSelected: boolean;
  }
  const stack: StackItem[] = nodes
    .slice()
    .reverse()
    .map((n) => ({ node: n, depth: 0, ancestorSelected: false }));

  while (stack.length > 0) {
    const { node, depth, ancestorSelected } = stack.pop()!;
    if (depth >= MAX_TREE_DEPTH) continue;

    const isSelected = selectedIds.has(node.id);
    if (isSelected && !ancestorSelected) selected.push(node);
    if (node.children && node.children.length > 0) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({
          node: node.children[i],
          depth: depth + 1,
          ancestorSelected: ancestorSelected || isSelected,
        });
      }
    }
  }
  return selected;
}

export function removeBlocks(tree: BlockNode[], targetIds: ReadonlySet<string>): BlockNode[] {
  const newTree = cloneTree(tree);
  // Procesamos cada lista de hermanos de atrás hacia delante. Si se recorre en
  // orden ascendente, eliminar un elemento desplaza los índices siguientes y
  // los hermanos seleccionados que vienen después se quedan sin borrar.
  interface StackItem {
    parentList: BlockNode[];
    depth: number;
  }
  const stack: StackItem[] = [{ parentList: newTree, depth: 0 }];

  while (stack.length > 0) {
    const { parentList, depth } = stack.pop()!;
    if (depth >= MAX_TREE_DEPTH) continue;

    for (let i = parentList.length - 1; i >= 0; i--) {
      const node = parentList[i];
      if (targetIds.has(node.id)) {
        parentList.splice(i, 1);
      } else if (node.children && node.children.length > 0) {
        stack.push({ parentList: node.children, depth: depth + 1 });
      }
    }
  }

  if (newTree.length === 0) {
    newTree.push({
      id: generateId(),
      type: "text",
      content: "",
      children: [],
      collapsed: false,
    });
  }
  return newTree;
}

/** Insert a new block after targetId */
export function insertBlockAfter(
  tree: BlockNode[],
  targetId: string,
  newContent = ""
): { newTree: BlockNode[]; newBlockId: string } | null {
  const newTree = cloneTree(tree);
  const loc = findNodeLocation(newTree, targetId);
  if (!loc) return null;

  const currentBlock = loc.parentList[loc.index];
  const newBlock: BlockNode = {
    id: generateId(),
    type: "text",
    content: newContent,
    children: [],
    collapsed: false,
  };

  if (!currentBlock.collapsed && currentBlock.children && currentBlock.children.length > 0) {
    currentBlock.children.unshift(newBlock);
  } else {
    loc.parentList.splice(loc.index + 1, 0, newBlock);
  }

  return { newTree, newBlockId: newBlock.id };
}

export function insertBlocksAfter(
  tree: BlockNode[],
  targetId: string,
  blocks: BlockNode[]
): BlockNode[] | null {
  if (blocks.length === 0) return null;
  const newTree = cloneTree(tree);
  const location = findNodeLocation(newTree, targetId);
  if (!location) return null;
  location.parentList.splice(location.index + 1, 0, ...cloneTree(blocks));
  return newTree;
}

/** Split current block at cursor offset */
export function splitBlock(
  tree: BlockNode[],
  targetId: string,
  cursorOffset: number
): { newTree: BlockNode[]; newBlockId: string } | null {
  const newTree = cloneTree(tree);
  const loc = findNodeLocation(newTree, targetId);
  if (!loc) return null;

  const currentBlock = loc.parentList[loc.index];
  const fullText = currentBlock.content;
  const before = fullText.slice(0, cursorOffset);
  const after = fullText.slice(cursorOffset);

  currentBlock.content = before;

  const newBlock: BlockNode = {
    id: generateId(),
    type: "text",
    content: after,
    children: [],
    collapsed: false,
  };

  const hasChildren = Boolean(currentBlock.children && currentBlock.children.length > 0);
  if (cursorOffset === 0 && hasChildren) {
    // Enter al inicio de un bullet con subbullets: el bullet original se queda
    // vacío arriba y el nuevo bullet (con el contenido restante) pasa a ser su
    // hermano, adoptando los subbullets. Así no se crea un bullet vacío con el
    // contenido original anidado dentro.
    newBlock.children = currentBlock.children!;
    newBlock.collapsed = currentBlock.collapsed;
    currentBlock.children = [];
    currentBlock.collapsed = false;
    loc.parentList.splice(loc.index + 1, 0, newBlock);
  } else if (!currentBlock.collapsed && hasChildren) {
    currentBlock.children!.unshift(newBlock);
  } else {
    loc.parentList.splice(loc.index + 1, 0, newBlock);
  }

  return { newTree, newBlockId: newBlock.id };
}

export function insertImageBlockAfter(
  tree: BlockNode[],
  targetId: string,
  source: string,
  alt: string
): { newTree: BlockNode[]; newBlockId: string } | null {
  const newTree = cloneTree(tree);
  const loc = findNodeLocation(newTree, targetId);
  if (!loc) return null;

  const imageBlock: BlockNode = {
    id: generateId(),
    type: "image",
    content: source,
    imageAlt: alt,
    children: [],
    collapsed: false,
  };
  loc.parentList.splice(loc.index + 1, 0, imageBlock);
  return { newTree, newBlockId: imageBlock.id };
}

/** Indent block (Tab): make it the last child of previous sibling */
export function indentBlock(tree: BlockNode[], targetId: string): BlockNode[] | null {
  const newTree = cloneTree(tree);
  const loc = findNodeLocation(newTree, targetId);
  if (!loc || loc.index === 0) {
    return null;
  }

  const prevSibling = loc.parentList[loc.index - 1];
  const [removed] = loc.parentList.splice(loc.index, 1);
  if (!prevSibling.children) {
    prevSibling.children = [];
  }
  prevSibling.children.push(removed);
  return newTree;
}

/** Outdent block (Shift+Tab): move block out to parent's level */
export function outdentBlock(tree: BlockNode[], targetId: string): BlockNode[] | null {
  const newTree = cloneTree(tree);
  const loc = findNodeLocation(newTree, targetId);
  if (!loc || !loc.parentNode) {
    return null;
  }

  const parentLoc = findNodeLocation(newTree, loc.parentNode.id);
  if (!parentLoc) return null;

  const [removed] = loc.parentList.splice(loc.index, 1);
  parentLoc.parentList.splice(parentLoc.index + 1, 0, removed);
  return newTree;
}

export interface EnterAtEndResult {
  newTree: BlockNode[];
  newBlockId: string | null;
  outdented: boolean;
}

/**
 * Resuelve Enter al final de un bullet, imitando el flujo de Logseq/Roam:
 *
 * 1. El primer Enter crea un bullet nuevo (hijo si el actual tiene hijos,
 *    hermano en caso contrario).
 * 2. Si el bullet nuevo sigue vacío, el segundo Enter lo desindenta un nivel.
 * 3. El tercer Enter crea otro bullet en ese nivel (ya sin volver a desindentar).
 *
 * `alreadyOutdented` evita que el paso 2 se repita indefinidamente: el
 * llamador lo mantiene mientras el foco siga en el bullet desindentado.
 */
export function enterAtEnd(
  tree: BlockNode[],
  targetId: string,
  alreadyOutdented = false
): EnterAtEndResult | null {
  const loc = findNodeLocation(tree, targetId);
  if (!loc) return null;

  const currentBlock = loc.parentList[loc.index];
  const canOutdent =
    !alreadyOutdented &&
    currentBlock.content.trim() === "" &&
    loc.parentNode !== null &&
    (!currentBlock.children || currentBlock.children.length === 0);

  if (canOutdent) {
    const newTree = outdentBlock(tree, targetId);
    if (newTree) {
      return { newTree, newBlockId: null, outdented: true };
    }
  }

  const inserted = insertBlockAfter(tree, targetId, "");
  if (!inserted) return null;
  return { newTree: inserted.newTree, newBlockId: inserted.newBlockId, outdented: false };
}

/**
 * Indenta todos los bloques seleccionados un nivel (Tab con selección múltiple).
 * Solo actúa sobre las "raíces" de la selección (cuyos padres no están también
 * seleccionados) para preservar la jerarquía. Procesa en orden documental para
 * que cada bloque quede como último hijo de su hermano anterior.
 */
export function indentBlocks(tree: BlockNode[], targetIds: ReadonlySet<string>): BlockNode[] | null {
  const roots = getSelectedBlockRoots(tree, targetIds);
  if (roots.length === 0) return null;
  let current = tree;
  let changed = false;
  for (const root of roots) {
    const next = indentBlock(current, root.id);
    if (next) {
      current = next;
      changed = true;
    }
  }
  return changed ? current : null;
}

/**
 * Desindenta todos los bloques seleccionados un nivel (Shift+Tab con selección
 * múltiple). Procesa en orden inverso al documental para conservar el orden
 * entre hermanos tras salir del nivel.
 */
export function outdentBlocks(tree: BlockNode[], targetIds: ReadonlySet<string>): BlockNode[] | null {
  const roots = getSelectedBlockRoots(tree, targetIds);
  if (roots.length === 0) return null;
  let current = tree;
  let changed = false;
  for (const root of [...roots].reverse()) {
    const next = outdentBlock(current, root.id);
    if (next) {
      current = next;
      changed = true;
    }
  }
  return changed ? current : null;
}

/** Move a block before, after, or inside another block. */
export function moveBlockTo(
  tree: BlockNode[],
  sourceId: string,
  targetId: string,
  position: "before" | "after" | "inside"
): BlockNode[] | null {
  const newTree = cloneTree(tree);
  const sourceLoc = findNodeLocation(newTree, sourceId);
  const targetLoc = findNodeLocation(newTree, targetId);
  if (!sourceLoc || !targetLoc || sourceId === targetId) return null;

  const source = sourceLoc.parentList[sourceLoc.index];
  const hasTargetDescendant = (nodes: BlockNode[]): boolean =>
    nodes.some((node) => node.id === targetId || hasTargetDescendant(node.children || []));
  if (position === "inside" && hasTargetDescendant(source.children || [])) return null;

  sourceLoc.parentList.splice(sourceLoc.index, 1);
  const updatedTargetLoc = findNodeLocation(newTree, targetId);
  if (!updatedTargetLoc) return null;
  const target = updatedTargetLoc.parentList[updatedTargetLoc.index];

  if (position === "inside") {
    target.children.push(source);
    target.collapsed = false;
  } else {
    const insertAt = updatedTargetLoc.index + (position === "after" ? 1 : 0);
    updatedTargetLoc.parentList.splice(insertAt, 0, source);
  }
  return newTree;
}

/** Delete block or merge into previous */
export function deleteOrMergeBlock(
  tree: BlockNode[],
  targetId: string
): { newTree: BlockNode[]; targetFocusId: string | null; cursorOffset: number } | null {
  const newTree = cloneTree(tree);
  const flat = getFlatVisibleBlocks(newTree);
  const currentIndex = flat.findIndex((b) => b.id === targetId);
  if (currentIndex < 0) return null;

  const currentBlock = flat[currentIndex];
  const loc = findNodeLocation(newTree, targetId);
  if (!loc) return null;

  if (currentIndex === 0) {
    if (flat.length === 1) {
      currentBlock.content = "";
      return { newTree, targetFocusId: targetId, cursorOffset: 0 };
    }
    if (currentBlock.children && currentBlock.children.length > 0) {
      return null;
    }
    loc.parentList.splice(loc.index, 1);
    const nextBlock = flat[1];
    return { newTree, targetFocusId: nextBlock.id, cursorOffset: 0 };
  }

  const prevBlock = flat[currentIndex - 1];
  const prevLoc = findNodeLocation(newTree, prevBlock.id);
  if (!prevLoc) return null;

  const prevTarget = prevLoc.parentList[prevLoc.index];
  const prevLen = prevTarget.content.length;

  if (currentBlock.content.trim() === "" && (!currentBlock.children || currentBlock.children.length === 0)) {
    loc.parentList.splice(loc.index, 1);
    return { newTree, targetFocusId: prevTarget.id, cursorOffset: prevLen };
  } else if (!currentBlock.children || currentBlock.children.length === 0) {
    prevTarget.content += currentBlock.content;
    loc.parentList.splice(loc.index, 1);
    return { newTree, targetFocusId: prevTarget.id, cursorOffset: prevLen };
  }

  return null;
}

/** Move block up among siblings */
export function moveBlockUp(tree: BlockNode[], targetId: string): BlockNode[] | null {
  const newTree = cloneTree(tree);
  const loc = findNodeLocation(newTree, targetId);
  if (!loc || loc.index === 0) return null;

  const list = loc.parentList;
  const temp = list[loc.index];
  list[loc.index] = list[loc.index - 1];
  list[loc.index - 1] = temp;
  return newTree;
}

/** Move block down among siblings */
export function moveBlockDown(tree: BlockNode[], targetId: string): BlockNode[] | null {
  const newTree = cloneTree(tree);
  const loc = findNodeLocation(newTree, targetId);
  if (!loc || loc.index >= loc.parentList.length - 1) return null;

  const list = loc.parentList;
  const temp = list[loc.index];
  list[loc.index] = list[loc.index + 1];
  list[loc.index + 1] = temp;
  return newTree;
}

/** Delete a block directly */
export function removeBlock(tree: BlockNode[], targetId: string): BlockNode[] {
  const newTree = cloneTree(tree);
  const loc = findNodeLocation(newTree, targetId);
  if (loc) {
    loc.parentList.splice(loc.index, 1);
  }
  if (newTree.length === 0) {
    newTree.push({
      id: generateId(),
      type: "text",
      content: "",
      children: [],
      collapsed: false,
    });
  }
  return newTree;
}

/** Toggle task status: TODO -> DONE -> none -> TODO */
export function toggleTaskStatus(content: string): string {
  const trimmed = content.trim();
  if (/^(TODO|LATER)\s+/i.test(trimmed)) {
    return content.replace(/^(TODO|LATER)\s+/i, "DOING ");
  }
  if (/^(DOING|NOW)\s+/i.test(trimmed)) {
    return content.replace(/^(DOING|NOW)\s+/i, "DONE ");
  }
  if (/^DONE\s+/i.test(trimmed)) {
    return content.replace(/^DONE\s+/i, "");
  }
  return `TODO ${content}`;
}

/** Format text selection or wrap content with markdown formatting */
export function applyFormatting(
  content: string,
  format: "bold" | "italic" | "underline" | "strike" | "code",
  start = 0,
  end = 0
): string {
  const hasSelection = end > start;
  const targetText = hasSelection ? content.slice(start, end) : content;

  let formatted = "";
  switch (format) {
    case "bold":
      formatted = `**${targetText}**`;
      break;
    case "italic":
      formatted = `*${targetText}*`;
      break;
    case "underline":
      formatted = `<u>${targetText}</u>`;
      break;
    case "strike":
      formatted = `~~${targetText}~~`;
      break;
    case "code":
      formatted = `\`${targetText}\``;
      break;
  }

  if (hasSelection) {
    return content.slice(0, start) + formatted + content.slice(end);
  }
  return formatted;
}

/** Remove inline formatting (bold, italic, underline, strike, code, cloze) from a range. */
export function clearFormatting(
  content: string,
  start = 0,
  end = 0
): string {
  const hasSelection = end > start;
  const targetText = hasSelection ? content.slice(start, end) : content;

  const cleaned = stripInlineFormatting(targetText);

  if (hasSelection) {
    return content.slice(0, start) + cleaned + content.slice(end);
  }
  return cleaned;
}

function stripInlineFormatting(text: string): string {
  let result = text;
  let previous = "";
  // Repeat until stable so nested markers (e.g. ***bold italic***) are fully stripped.
  while (result !== previous) {
    previous = result;
    result = result
      .replace(/<\/?u>/gi, "")
      .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/___([^_]+)___/g, "$1")
      .replace(/\b__([^_\s]+)__\b/g, "$1")
      .replace(/\b_([^_\s]+)_\b/g, "$1")
      .replace(/~~([^~]+)~~/g, "$1")
      .replace(/==([^=]+)==/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
  }
  return result;
}

/** Toggle collapse of children */
export function toggleCollapse(tree: BlockNode[], targetId: string): BlockNode[] {
  const newTree = cloneTree(tree);
  const loc = findNodeLocation(newTree, targetId);
  if (loc) {
    const node = loc.parentList[loc.index];
    node.collapsed = !node.collapsed;
  }
  return newTree;
}
