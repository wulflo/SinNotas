/** Mínimo de desbordamiento para mostrar la navegación flotante de la nota. */
export const NOTE_SCROLL_MIN_OVERFLOW_PX = 80;
/** Margen para considerar que el usuario ya está al inicio o al final. */
export const NOTE_SCROLL_EDGE_TOLERANCE_PX = 8;

export interface NoteScrollState {
  /** Píxeles que se pueden recorrer por encima del alto visible. */
  overflow: number;
  /** Hay suficiente contenido para que los botones aporten algo. */
  visible: boolean;
  atTop: boolean;
  atBottom: boolean;
  showTop: boolean;
  showBottom: boolean;
}

/**
 * Calcula qué botones debe mostrar la navegación flotante.
 *
 * Se separa del DOM para poder probar los casos límite (nota corta, inicio,
 * final y tolerancias) sin depender de un navegador.
 */
export function noteScrollState(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number
): NoteScrollState {
  const overflow = Math.max(0, scrollHeight - clientHeight);
  const top = Math.min(Math.max(0, scrollTop), overflow);
  const visible = overflow > NOTE_SCROLL_MIN_OVERFLOW_PX;
  const atTop = top <= NOTE_SCROLL_EDGE_TOLERANCE_PX;
  const atBottom =
    overflow <= NOTE_SCROLL_EDGE_TOLERANCE_PX ||
    top >= overflow - NOTE_SCROLL_EDGE_TOLERANCE_PX;

  return {
    overflow,
    visible,
    atTop,
    atBottom,
    showTop: visible && !atTop,
    showBottom: visible && !atBottom,
  };
}

export interface NoteScrollNavOptions {
  nav: HTMLElement;
  topButton: HTMLButtonElement;
  bottomButton: HTMLButtonElement;
  /** Contenedor que realmente hace scroll (cambia en la vista dividida). */
  getScrollRoot: () => HTMLElement | null;
  /** La vista del editor debe estar visible. */
  isActive: () => boolean;
  /** Elementos cuyo tamaño cambia cuando la nota crece o se contrae. */
  observe?: HTMLElement[];
}

export interface NoteScrollNavController {
  /** Vuelve a medir el contenido y programa una actualización. */
  refresh: () => void;
  destroy: () => void;
}

/**
 * Conecta los botones flotantes con el scroll real del editor.
 *
 * El listener de scroll se instala en captura sobre `#view-editor`: así sigue
 * funcionando aunque el contenedor que scrollea cambie entre `.content-scroll`
 * y `.canvas-wrapper` al abrir el panel de referencias.
 */
export function installNoteScrollNav(
  options: NoteScrollNavOptions
): NoteScrollNavController {
  const { nav, topButton, bottomButton, getScrollRoot, isActive } = options;
  const scrollHost = nav.parentElement;
  let updateFrame: number | null = null;
  let destroyed = false;

  const hide = (): void => {
    nav.hidden = true;
    nav.setAttribute("aria-hidden", "true");
    topButton.hidden = true;
    bottomButton.hidden = true;
  };

  const update = (): void => {
    if (destroyed) return;
    const root = isActive() ? getScrollRoot() : null;
    if (!root) {
      hide();
      return;
    }

    const state = noteScrollState(root.scrollTop, root.scrollHeight, root.clientHeight);
    const visible = state.visible && (state.showTop || state.showBottom);
    nav.hidden = !visible;
    nav.setAttribute("aria-hidden", String(!visible));
    topButton.hidden = !state.showTop;
    bottomButton.hidden = !state.showBottom;
  };

  const scheduleUpdate = (): void => {
    if (destroyed || updateFrame !== null) return;
    updateFrame = window.requestAnimationFrame(() => {
      updateFrame = null;
      update();
    });
  };

  const scrollToEdge = (edge: "top" | "bottom"): void => {
    const root = getScrollRoot();
    if (!root) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.scrollTo({
      top: edge === "top" ? 0 : root.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  const onTopClick = (): void => scrollToEdge("top");
  const onBottomClick = (): void => scrollToEdge("bottom");

  topButton.addEventListener("click", onTopClick);
  bottomButton.addEventListener("click", onBottomClick);
  scrollHost?.addEventListener("scroll", scheduleUpdate, {
    capture: true,
    passive: true,
  });
  window.addEventListener("resize", scheduleUpdate, { passive: true });

  const resizeObserver =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);
  options.observe?.forEach((element) => resizeObserver?.observe(element));

  scheduleUpdate();

  return {
    refresh: scheduleUpdate,
    destroy(): void {
      destroyed = true;
      if (updateFrame !== null) {
        window.cancelAnimationFrame(updateFrame);
        updateFrame = null;
      }
      topButton.removeEventListener("click", onTopClick);
      bottomButton.removeEventListener("click", onBottomClick);
      scrollHost?.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver?.disconnect();
      hide();
    },
  };
}
