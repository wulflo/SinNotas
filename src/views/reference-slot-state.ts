/** Estado del botón «ver nota sin truncar» de las ranuras 1/2. */

export function toggleReferenceExpanded(
  expanded: ReadonlySet<number>,
  index: number
): Set<number> {
  const next = new Set(expanded);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  return next;
}

export interface ReferenceExpandLabels {
  expand: string;
  collapse: string;
}

export function createReferenceExpandButton(
  expanded: boolean,
  labels: ReferenceExpandLabels,
  onToggle: () => void
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn-icon reference-slot-expand";
  const label = expanded ? labels.collapse : labels.expand;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(expanded));
  button.textContent = expanded ? "⤡" : "⤢";
  button.addEventListener("click", onToggle);
  return button;
}
