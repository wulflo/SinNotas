/**
 * Icono de nota usado en «Todas las páginas». El trazo usa `currentColor`, así
 * que sigue el acento del tema en vez de arrastrar el color del emoji antiguo.
 */
const PAGE_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M8 13h8M8 17h8"></path></svg>';
const JOURNAL_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M16 2v4M8 2v4M3 9h18"></path><path d="M8 13h3M8 17h6"></path></svg>';
/** Flecha de «enlaces salientes»: SVG para que el trazo no dependa de la fuente. */
const OUTGOING_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15"></path><path d="M13 6l6 6-6 6"></path></svg>';

export function pageIconMarkup(isJournal = false): string {
  return `<span class="page-icon" aria-hidden="true">${isJournal ? JOURNAL_SVG : PAGE_SVG}</span>`;
}

export function createPageIcon(isJournal = false): HTMLSpanElement {
  const icon = document.createElement("span");
  icon.className = "page-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = isJournal ? JOURNAL_SVG : PAGE_SVG;
  return icon;
}

/** Icono de enlace saliente, con el mismo tamaño y color que el de retroenlace. */
export function createOutgoingLinkIcon(): HTMLSpanElement {
  const icon = document.createElement("span");
  icon.className = "page-icon outgoing-link-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = OUTGOING_SVG;
  return icon;
}
