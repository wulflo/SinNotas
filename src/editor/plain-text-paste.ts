export function insertPlainTextAtSelection(
  element: HTMLElement,
  text: string,
  selection: Selection | null = window.getSelection()
): boolean {
  if (!selection || text.length === 0) return false;

  const selectedRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const range = document.createRange();
  let startOffset: number;
  let selectedLength = 0;
  if (selectedRange && element.contains(selectedRange.commonAncestorContainer)) {
    const prefix = document.createRange();
    prefix.selectNodeContents(element);
    prefix.setEnd(selectedRange.startContainer, selectedRange.startOffset);
    startOffset = prefix.toString().length;
    selectedLength = selectedRange.toString().length;
  } else {
    startOffset = (element.textContent || "").length;
  }

  const currentText = element.textContent || "";
  const nextText = currentText.slice(0, startOffset) + text + currentText.slice(startOffset + selectedLength);
  const textNode = document.createTextNode(nextText);
  element.replaceChildren(textNode);
  range.setStart(textNode, startOffset + text.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}