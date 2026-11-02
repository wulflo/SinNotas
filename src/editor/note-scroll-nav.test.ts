import { describe, expect, it } from "vitest";
import {
  NOTE_SCROLL_EDGE_TOLERANCE_PX,
  NOTE_SCROLL_MIN_OVERFLOW_PX,
  noteScrollState,
} from "./note-scroll-nav";

describe("note-scroll-nav", () => {
  it("oculta la navegación cuando la nota cabe en pantalla", () => {
    const state = noteScrollState(0, 500, 800);
    expect(state).toMatchObject({
      overflow: 0,
      visible: false,
      atTop: true,
      atBottom: true,
      showTop: false,
      showBottom: false,
    });
  });

  it("no muestra la navegación con un desbordamiento mínimo", () => {
    expect(noteScrollState(0, 800 + NOTE_SCROLL_MIN_OVERFLOW_PX, 800).visible).toBe(false);
    expect(noteScrollState(0, 800 + NOTE_SCROLL_MIN_OVERFLOW_PX + 1, 800).visible).toBe(true);
  });

  it("al inicio solo ofrece bajar al final", () => {
    const state = noteScrollState(0, 2000, 800);
    expect(state).toMatchObject({
      overflow: 1200,
      visible: true,
      atTop: true,
      atBottom: false,
      showTop: false,
      showBottom: true,
    });
  });

  it("en medio ofrece ambos botones", () => {
    const state = noteScrollState(500, 2000, 800);
    expect(state).toMatchObject({
      atTop: false,
      atBottom: false,
      showTop: true,
      showBottom: true,
    });
  });

  it("al final solo ofrece volver al inicio", () => {
    const state = noteScrollState(1200, 2000, 800);
    expect(state).toMatchObject({
      atTop: false,
      atBottom: true,
      showTop: true,
      showBottom: false,
    });
  });

  it("aplica una tolerancia en los extremos y acota scrollTop", () => {
    expect(noteScrollState(NOTE_SCROLL_EDGE_TOLERANCE_PX, 2000, 800).atTop).toBe(true);
    expect(noteScrollState(NOTE_SCROLL_EDGE_TOLERANCE_PX + 1, 2000, 800).atTop).toBe(false);

    expect(noteScrollState(1200 - NOTE_SCROLL_EDGE_TOLERANCE_PX, 2000, 800).atBottom).toBe(true);
    expect(noteScrollState(1200 - NOTE_SCROLL_EDGE_TOLERANCE_PX - 1, 2000, 800).atBottom).toBe(
      false
    );

    expect(noteScrollState(5000, 2000, 800).atBottom).toBe(true);
    expect(noteScrollState(-100, 2000, 800).atTop).toBe(true);
  });
});
