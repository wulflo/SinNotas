import { describe, expect, it } from "vitest";
import { BlockNode } from "../types";
import { enterAtEnd, getFlatVisibleBlocks, removeBlocks, splitBlock } from "./tree-engine";

function block(id: string, content: string, children: BlockNode[] = []): BlockNode {
  return { id, type: "text", content, children, collapsed: false };
}

describe("removeBlocks", () => {
  it("removes every selected root even when they are siblings", () => {
    const tree = [block("a", "A"), block("b", "B"), block("c", "C"), block("d", "D")];

    const result = removeBlocks(tree, new Set(["a", "b", "c", "d"]));

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("");
  });

  it("removes all selected siblings in the middle without skipping any", () => {
    const tree = [
      block("keep-1", "1"),
      block("remove-1", "2"),
      block("keep-2", "3"),
      block("remove-2", "4"),
      block("remove-3", "5"),
    ];

    const result = removeBlocks(tree, new Set(["remove-1", "remove-2", "remove-3"]));

    expect(result.map((node) => node.id)).toEqual(["keep-1", "keep-2"]);
  });

  it("removes selected roots and ignores their selected descendants", () => {
    const tree = [
      block("parent", "P", [block("child", "C"), block("grandchild", "G")]),
      block("sibling", "S"),
    ];

    const result = removeBlocks(tree, new Set(["parent", "child", "grandchild", "sibling"]));

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("");
  });

  it("does not mutate the original tree", () => {
    const tree = [block("a", "A"), block("b", "B")];

    removeBlocks(tree, new Set(["a"]));

    expect(tree).toHaveLength(2);
  });
});

describe("enterAtEnd", () => {
  it("creates a child on the first Enter when the current bullet has children", () => {
    const tree = [block("parent", "Parent", [block("child", "Child")])];

    const result = enterAtEnd(tree, "parent");

    expect(result).not.toBeNull();
    expect(result!.outdented).toBe(false);
    expect(result!.newTree[0].children?.map((node) => node.id)).toEqual([
      result!.newBlockId,
      "child",
    ]);
  });

  it("outdents an empty nested bullet on the second Enter", () => {
    const tree = [block("parent", "Parent", [block("child", "Child")])];
    const first = enterAtEnd(tree, "child")!;

    const second = enterAtEnd(first.newTree, first.newBlockId!)!;

    expect(second.outdented).toBe(true);
    expect(second.newBlockId).toBeNull();
    expect(second.newTree.map((node) => node.id)).toEqual(["parent", first.newBlockId]);
    expect(second.newTree[0].children?.map((node) => node.id)).toEqual(["child"]);
  });

  it("creates a sibling after the outdent on the third Enter", () => {
    const tree = [block("parent", "Parent", [block("child", "Child")])];
    const first = enterAtEnd(tree, "child")!;
    const second = enterAtEnd(first.newTree, first.newBlockId!)!;

    const third = enterAtEnd(second.newTree, first.newBlockId!, true)!;

    expect(third.outdented).toBe(false);
    expect(third.newTree.map((node) => node.id)).toEqual([
      "parent",
      first.newBlockId,
      third.newBlockId,
    ]);
  });

  it("does not outdent a root bullet or an empty bullet with children", () => {
    const rootResult = enterAtEnd([block("root", "")], "root")!;
    expect(rootResult.outdented).toBe(false);

    const withChildrenResult = enterAtEnd(
      [block("empty", "", [block("child", "Child")])],
      "empty"
    )!;
    expect(withChildrenResult.outdented).toBe(false);
  });

  it("does not outdent again when the caller marks the bullet as already outdented", () => {
    const tree = [block("parent", "Parent", [block("empty", "")])];

    const result = enterAtEnd(tree, "empty", true)!;

    expect(result.outdented).toBe(false);
    expect(result.newTree[0].children?.map((node) => node.id)).toEqual([
      "empty",
      result.newBlockId,
    ]);
  });
});

describe("splitBlock", () => {
  it("splits text and inserts the new block after the current one", () => {
    const tree = [block("a", "Hello world")];

    const result = splitBlock(tree, "a", 5);

    expect(result).not.toBeNull();
    expect(result!.newTree.map((node) => node.content)).toEqual(["Hello", " world"]);
  });

  it("moves the subbullets to the new sibling when pressing Enter at the start", () => {
    const tree = [block("parent", "Parent", [block("child-1", "One"), block("child-2", "Two")])];

    const result = splitBlock(tree, "parent", 0);

    expect(result).not.toBeNull();
    const [first, second] = result!.newTree;
    expect(first.id).toBe("parent");
    expect(first.content).toBe("");
    expect(first.children).toEqual([]);
    expect(second.id).toBe(result!.newBlockId);
    expect(second.content).toBe("Parent");
    expect(second.children.map((node) => node.content)).toEqual(["One", "Two"]);
    expect(getFlatVisibleBlocks(result!.newTree).map((node) => node.content)).toEqual([
      "",
      "Parent",
      "One",
      "Two",
    ]);
  });

  it("keeps the original block at the same level when splitting at the start", () => {
    const tree = [
      block("before", "Before"),
      block("parent", "Parent", [block("child", "Child")]),
      block("after", "After"),
    ];

    const result = splitBlock(tree, "parent", 0);

    expect(result!.newTree.map((node) => node.content)).toEqual(["Before", "", "Parent", "After"]);
    expect(result!.newTree[2].children.map((node) => node.id)).toEqual(["child"]);
  });

  it("unshifts the split remainder into the children when splitting in the middle", () => {
    const tree = [block("parent", "Parent", [block("child", "Child")])];

    const result = splitBlock(tree, "parent", 3);

    const [first] = result!.newTree;
    expect(first.content).toBe("Par");
    expect(first.children.map((node) => node.id)).toEqual([result!.newBlockId, "child"]);
    expect(first.children[0].content).toBe("ent");
  });
});
