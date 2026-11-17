// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { insertPlainTextAtSelection } from "./plain-text-paste";

describe("insertPlainTextAtSelection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("replaces the selected content with a plain text node and emits input", () => {
    const heading = document.createElement("h1");
    heading.contentEditable = "true";
    heading.innerHTML = '<span style="font-size: 10px">Old title</span>';
    document.body.appendChild(heading);
    const text = heading.querySelector("span")!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, text.textContent!.length);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    let inputCount = 0;
    heading.addEventListener("input", () => inputCount++);

    expect(insertPlainTextAtSelection(heading, "Pasted title", selection)).toBe(true);
    expect(heading.textContent).toBe("Pasted title");
    expect(heading.querySelector("span")).toBeNull();
    expect(inputCount).toBe(1);
  });

  it("inserts at the end when the current selection is outside the heading", () => {
    const heading = document.createElement("h1");
    heading.textContent = "Title";
    const outside = document.createElement("p");
    outside.textContent = "Elsewhere";
    document.body.append(heading, outside);
    const range = document.createRange();
    range.selectNodeContents(outside);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(insertPlainTextAtSelection(heading, " appended", selection)).toBe(true);
    expect(heading.textContent).toBe("Title appended");
  });
});