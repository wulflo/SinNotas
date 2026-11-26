/**
 * Registro de atajos editables.
 *
 * El editor tiene muchos atajos escritos literalmente en los handlers de
 * teclado. Este módulo centraliza solo los que se pueden cambiar desde
 * Ajustes > Atajos, con una representación canónica independiente del layout
 * del teclado (usa `event.code`, y `Mod` para Ctrl/Cmd). El resto de atajos
 * conocidos quedan como reservados para poder detectar colisiones al asignar.
 */

export const EDITABLE_SHORTCUT_IDS = [
  "shortcuts",
  "sidebar",
  "searchPage",
  "escape",
  "findInNote",
  "newBullet",
  "indent",
  "outdent",
  "selectAdjacentUp",
  "selectAdjacentDown",
  "selectAll",
  "mergePrevious",
  "copyBullets",
  "cutBullets",
  "deleteBullets",
  "createCard",
  "removeCards",
  "undo",
  "redo",
  "pastePlain",
  "revealAnswer",
] as const;

export type EditableShortcutId = (typeof EDITABLE_SHORTCUT_IDS)[number];

export interface ShortcutDefinition {
  id: EditableShortcutId;
  /** Etiqueta canónica en español: el sistema i18n la traduce. */
  label: string;
  defaultBinding: string;
}

export const SHORTCUT_DEFINITIONS: readonly ShortcutDefinition[] = [
  { id: "shortcuts", label: "Abrir o cerrar esta lista", defaultBinding: "Mod+/" },
  { id: "sidebar", label: "Mostrar u ocultar la barra lateral", defaultBinding: "Mod+B" },
  { id: "searchPage", label: "Buscar o crear una página", defaultBinding: "Mod+K" },
  { id: "escape", label: "Cerrar ventanas y menús", defaultBinding: "Escape" },
  { id: "findInNote", label: "Buscar dentro de la nota", defaultBinding: "Mod+F" },
  { id: "newBullet", label: "Crear un bullet nuevo", defaultBinding: "Enter" },
  { id: "indent", label: "Sangrar bullet", defaultBinding: "Tab" },
  { id: "outdent", label: "Desangrar bullet", defaultBinding: "Shift+Tab" },
  { id: "selectAdjacentUp", label: "Seleccionar bullets contiguos hacia arriba", defaultBinding: "Shift+ArrowUp" },
  { id: "selectAdjacentDown", label: "Seleccionar bullets contiguos hacia abajo", defaultBinding: "Shift+ArrowDown" },
  { id: "selectAll", label: "Seleccionar todos los bullets de la página", defaultBinding: "Mod+Shift+A" },
  { id: "mergePrevious", label: "Unir con el bullet anterior", defaultBinding: "Backspace" },
  { id: "copyBullets", label: "Copiar bullets seleccionados", defaultBinding: "Mod+C" },
  { id: "cutBullets", label: "Cortar bullets seleccionados", defaultBinding: "Mod+X" },
  { id: "deleteBullets", label: "Borrar bullets seleccionados", defaultBinding: "Delete" },
  { id: "createCard", label: "Crear tarjeta básica desde la selección", defaultBinding: "Mod+Shift+C" },
  { id: "removeCards", label: "Quitar flashcards de la selección", defaultBinding: "Mod+Shift+D" },
  { id: "undo", label: "Deshacer", defaultBinding: "Mod+Z" },
  { id: "redo", label: "Rehacer", defaultBinding: "Mod+Y" },
  { id: "pastePlain", label: "Pegar sin formato", defaultBinding: "Mod+Shift+V" },
  { id: "revealAnswer", label: "Mostrar la respuesta", defaultBinding: "Space" },
];

/** Combinaciones que siguen perteneciendo al navegador o a otros flujos. */
export const RESERVED_SHORTCUTS: Readonly<Record<string, string>> = {
  "Mod+V": "Pegar",
};

/** Los atajos de una sola tecla solo se permiten en definiciones que ya la usan. */
function allowsBareKey(id: EditableShortcutId): boolean {
  return !definitionFor(id).defaultBinding.includes("+");
}

const STORAGE_KEY = "sinnotas-custom-shortcuts";

export type ShortcutValidation =
  | { ok: true }
  | { ok: false; reason: "invalid" | "reserved" | "duplicate"; conflictLabel?: string };

function keyFromEvent(event: KeyboardEvent): string {
  const code = event.code || "";
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit") && code.length === 6) return code.slice(5);
  if (code === "Space" || code === "Slash") return code === "Space" ? "Space" : "/";
  const key = event.key;
  if (key === " " || key === "Spacebar") return "Space";
  return key.length === 1 ? key.toUpperCase() : key;
}

/**
 * Convierte un evento en su combinación canónica. Por defecto exige un
 * modificador (comportamiento histórico); `allowBareKey` habilita teclas
 * sueltas como Enter, Tab o Escape para los atajos del editor.
 */
export function normalizeShortcutEvent(event: KeyboardEvent, allowBareKey = false): string | null {
  const key = keyFromEvent(event);
  if (!key || ["Shift", "Control", "Meta", "Alt", "CapsLock"].includes(key)) return null;
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("Mod");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (parts.length === 0 && !allowBareKey) return null;
  parts.push(key);
  return parts.join("+");
}

/** Representación legible: Mod se muestra como Ctrl/Cmd, como en el modal. */
const ARROW_LABELS: Readonly<Record<string, string>> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

export function formatShortcut(binding: string): string {
  return binding
    .split("+")
    .map((part) =>
      part === "Mod" ? "Ctrl/Cmd" : ARROW_LABELS[part] ?? part
    )
    .join("+");
}

export function definitionFor(id: EditableShortcutId): ShortcutDefinition {
  return SHORTCUT_DEFINITIONS.find((definition) => definition.id === id)!;
}

export function loadCustomBindings(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, string> = {};
    for (const definition of SHORTCUT_DEFINITIONS) {
      const value = (parsed as Record<string, unknown>)[definition.id];
      if (typeof value === "string" && value) result[definition.id] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function saveCustomBindings(bindings: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // La preferencia se aplica en memoria aunque no se pueda persistir.
  }
}

export function getBinding(id: EditableShortcutId): string {
  return loadCustomBindings()[id] || definitionFor(id).defaultBinding;
}

export function validateShortcut(
  id: EditableShortcutId,
  binding: string | null
): ShortcutValidation {
  if (!binding) return { ok: false, reason: "invalid" };
  if (!binding.includes("+") && !allowsBareKey(id)) return { ok: false, reason: "invalid" };
  const reserved = RESERVED_SHORTCUTS[binding];
  if (reserved) return { ok: false, reason: "reserved", conflictLabel: reserved };
  const custom = loadCustomBindings();
  for (const definition of SHORTCUT_DEFINITIONS) {
    if (definition.id === id) continue;
    const other = custom[definition.id] || definition.defaultBinding;
    if (other === binding) {
      return { ok: false, reason: "duplicate", conflictLabel: definition.label };
    }
  }
  return { ok: true };
}

/** Asigna un atajo si no colisiona; devuelve el resultado de la validación. */
export function assignBinding(id: EditableShortcutId, binding: string | null): ShortcutValidation {
  const validation = validateShortcut(id, binding);
  if (!validation.ok) return validation;
  const custom = loadCustomBindings();
  if (binding === definitionFor(id).defaultBinding) delete custom[id];
  else custom[id] = binding!;
  saveCustomBindings(custom);
  return { ok: true };
}

export function resetBinding(id: EditableShortcutId): void {
  const custom = loadCustomBindings();
  delete custom[id];
  saveCustomBindings(custom);
}

export function matchesShortcut(event: KeyboardEvent, id: EditableShortcutId): boolean {
  return normalizeShortcutEvent(event, true) === getBinding(id);
}
