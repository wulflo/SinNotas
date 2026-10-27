/**
 * Soporte de gamepad para flashcards (estilo contanki, sin dependencias).
 *
 * - Presets de los mandos más populares: etiquetan los botones según el mando
 *   para que el mapeo sea entendible (A/B/X/Y, ✕/○/□/△, B/A/Y/X...).
 * - Detección de conexión con nombre del dispositivo.
 * - Listener con detección de flanco: cada pulsación se dispara UNA sola vez,
 *   aunque el botón se mantenga mantenido.
 */

export type ControllerType = "xbox" | "playstation" | "switch" | "steamdeck" | "generic";

export interface ControllerPreset {
  id: ControllerType;
  label: string;
  /** Etiquetas para los botones 0..15 según el estándar W3C Gamepad. */
  buttons: string[];
}

const STANDARD_BUTTONS = [
  "Botón 0 (A/Cross)",
  "Botón 1 (B/Circle)",
  "Botón 2 (X/Square)",
  "Botón 3 (Y/Triangle)",
  "LB (L1)",
  "RB (R1)",
  "LT (L2)",
  "RT (R2)",
  "Select (Back)",
  "Start (Menu)",
  "L3 (Stick izq.)",
  "R3 (Stick der.)",
  "D-pad Arriba",
  "D-pad Abajo",
  "D-pad Izquierda",
  "D-pad Derecha",
];

export const CONTROLLER_PRESETS: Record<ControllerType, ControllerPreset> = {
  xbox: {
    id: "xbox",
    label: "Xbox (Series / One / 360)",
    buttons: [
      "A",
      "B",
      "X",
      "Y",
      "LB",
      "RB",
      "LT",
      "RT",
      "View (Back)",
      "Menu (Start)",
      "L3 (Stick izq.)",
      "R3 (Stick der.)",
      "D-pad Arriba",
      "D-pad Abajo",
      "D-pad Izquierda",
      "D-pad Derecha",
    ],
  },
  playstation: {
    id: "playstation",
    label: "PlayStation (DualSense / DualShock)",
    buttons: [
      "✕ (Cross)",
      "○ (Circle)",
      "□ (Square)",
      "△ (Triangle)",
      "L1",
      "R1",
      "L2",
      "R2",
      "Share / Create",
      "Options",
      "L3 (Stick izq.)",
      "R3 (Stick der.)",
      "D-pad Arriba",
      "D-pad Abajo",
      "D-pad Izquierda",
      "D-pad Derecha",
    ],
  },
  switch: {
    id: "switch",
    label: "Nintendo Switch (Pro Controller / Joy-Con)",
    // En el estándar W3C el mapeo de Nintendo queda en orden inverso:
    // 0=B, 1=A, 2=Y, 3=X.
    buttons: [
      "B",
      "A",
      "Y",
      "X",
      "L",
      "R",
      "ZL",
      "ZR",
      "Minus",
      "Plus",
      "L3 (Stick izq.)",
      "R3 (Stick der.)",
      "D-pad Arriba",
      "D-pad Abajo",
      "D-pad Izquierda",
      "D-pad Derecha",
    ],
  },
  steamdeck: {
    id: "steamdeck",
    label: "Steam Deck",
    buttons: [
      "A",
      "B",
      "X",
      "Y",
      "L1",
      "R1",
      "L2",
      "R2",
      "View",
      "Menu",
      "L3 (Stick izq.)",
      "R3 (Stick der.)",
      "D-pad Arriba",
      "D-pad Abajo",
      "D-pad Izquierda",
      "D-pad Derecha",
    ],
  },
  generic: {
    id: "generic",
    label: "Genérico (estándar W3C)",
    buttons: STANDARD_BUTTONS,
  },
};

export const CONTROLLER_TYPE_OPTIONS: Array<{ value: ControllerType | ""; label: string }> = [
  { value: "", label: "Detectado automáticamente" },
  { value: "xbox", label: CONTROLLER_PRESETS.xbox.label },
  { value: "playstation", label: CONTROLLER_PRESETS.playstation.label },
  { value: "switch", label: CONTROLLER_PRESETS.switch.label },
  { value: "steamdeck", label: CONTROLLER_PRESETS.steamdeck.label },
  { value: "generic", label: CONTROLLER_PRESETS.generic.label },
];

/** Devuelve las etiquetas de botones para un tipo (o las genéricas si es automático). */
export function buttonLabelsFor(type: ControllerType | ""): string[] {
  return type === "" ? STANDARD_BUTTONS : CONTROLLER_PRESETS[type].buttons;
}

/** Primer gamepad conectado, o null. */
export function firstConnectedGamepad(): Gamepad | null {
  const gamepads = navigator.getGamepads();
  for (const gp of gamepads) {
    if (gp) return gp;
  }
  return null;
}

/**
 * Listener de pulsaciones con detección de flanco de subida:
 * cada botón se reporta una sola vez por pulsación, aunque se mantenga.
 */
export class GamepadListener {
  private intervalId: number | null = null;
  private previousPressed = new Set<number>();

  constructor(
    private readonly onPress: (buttonIndex: number, gamepad: Gamepad) => void,
    private readonly onPoll?: (gamepad: Gamepad) => void,
    private readonly pollMs = 60
  ) {}

  get running(): boolean {
    return this.intervalId !== null;
  }

  start(): void {
    if (this.intervalId !== null) return;
    this.previousPressed.clear();
    this.intervalId = window.setInterval(() => this.poll(), this.pollMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.previousPressed.clear();
  }

  private poll(): void {
    const gamepad = firstConnectedGamepad();
    if (!gamepad) {
      this.previousPressed.clear();
      return;
    }

    const currentlyPressed = new Set<number>();
    gamepad.buttons.forEach((button, index) => {
      // `pressed` cubre botones digitales; los analógicos (gatillos) usan value.
      // Umbral bajo para que los gatillos (RT/LT) se reconozcan aunque no se
      // pulsen a fondo.
      if (button.pressed || button.value > 0.1) currentlyPressed.add(index);
    });

    // Algunos mandos genéricos exponen los gatillos como ejes en lugar de
    // botones. Se mapean a los índices estándar 6 (LT) y 7 (RT).
    const axes = gamepad.axes || [];
    if (axes.length >= 3 && (axes[2] ?? 0) > 0.5) currentlyPressed.add(6);
    if (axes.length >= 4 && (axes[3] ?? 0) > 0.5) currentlyPressed.add(7);
    if (axes.length >= 5 && (axes[4] ?? 0) > 0.5) currentlyPressed.add(6);
    if (axes.length >= 6 && (axes[5] ?? 0) > 0.5) currentlyPressed.add(7);

    currentlyPressed.forEach((index) => {
      if (!this.previousPressed.has(index)) this.onPress(index, gamepad);
    });
    this.previousPressed = currentlyPressed;

    this.onPoll?.(gamepad);
  }
}
