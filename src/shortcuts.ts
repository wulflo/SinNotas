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
  "findInNote",
  "selectAll",
  "createCard",
  "removeCards",
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
  { id: "findInNote", label: "Buscar dentro de la nota", defaultBinding: "Mod+F" },
  { id: "selectAll", label: "Seleccionar todos los bullets de la página", defaultBinding: "Mod+Shift+A" },
  { id: "createCard", label: "Crear tarjeta básica desde la selección", defaultBinding: "Mod+Shift+C" },
  { id: "removeCards", label: "Quitar flashcards de la selección", defaultBinding: "Mod+Shift+D" },
];

/** Combinaciones usadas por otros handlers; no se pueden reasignar desde Ajustes. */
export const RESERVED_SHORTCUTS: Readonly<Record<string, string>> = {
  "Mod+C": "Copiar bullets seleccionados",
  "Mod+X": "Cortar bullets seleccionados",
  "Mod+V": "Pegar",
  "Mod+Shift+V": "Pegar sin formato",
  "Mod+Z": "Deshacer",
  "Mod+Y": "Rehacer",
  "Mod+Shift+Z": "Rehacer",
};

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

/** Convierte un evento en su combinación canónica, o null si no tiene modificador. */
export function normalizeShortcutEvent(event: KeyboardEvent): string | null {
  const key = keyFromEvent(event);
  if (!key || ["Shift", "Control", "Meta", "Alt", "CapsLock"].includes(key)) return null;
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("Mod");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (parts.length === 0) return null;
  parts.push(key);
  return parts.join("+");
}

/** Representación legible: Mod se muestra como Ctrl/Cmd, como en el modal. */
export function formatShortcut(binding: string): string {
  return binding
    .split("+")
    .map((part) => (part === "Mod" ? "Ctrl/Cmd" : part === "Space" ? "Space" : part))
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
  return normalizeShortcutEvent(event) === getBinding(id);
}
