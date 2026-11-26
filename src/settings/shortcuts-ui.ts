import { onLanguageChange, translate } from "../i18n";
import { showToast } from "../ui/toast";
import {
  SHORTCUT_DEFINITIONS,
  assignBinding,
  formatShortcut,
  getBinding,
  normalizeShortcutEvent,
  resetBinding,
  type EditableShortcutId,
} from "../shortcuts";

const shortcutsModalOverlay = document.getElementById("shortcuts-modal-overlay") as HTMLElement;

let capturingShortcutId: EditableShortcutId | null = null;

export function refreshShortcutModalBindings(): void {
  shortcutsModalOverlay.querySelectorAll<HTMLElement>("[data-shortcut-id]").forEach((kbd) => {
    const id = kbd.dataset.shortcutId as EditableShortcutId | undefined;
    if (id) kbd.textContent = formatShortcut(getBinding(id));
  });
}

export function renderShortcutSettings(): void {
  // Se busca en cada llamada: switchSettingsTab() también se ejecuta durante
  // la inicialización del módulo, antes de declarar el estado de captura.
  const list = document.getElementById("shortcuts-settings-list");
  if (!list) return;
  list.replaceChildren();
  for (const definition of SHORTCUT_DEFINITIONS) {
    const row = document.createElement("div");
    row.className = "settings-row";

    const label = document.createElement("label");
    label.textContent = translate(definition.label);

    const actions = document.createElement("div");
    actions.className = "shortcut-binding-actions";

    const bindingButton = document.createElement("button");
    bindingButton.type = "button";
    bindingButton.className = "font-option-btn shortcut-binding-btn";
    bindingButton.dataset.shortcutId = definition.id;
    const isCapturing = capturingShortcutId === definition.id;
    if (isCapturing) bindingButton.classList.add("is-capturing");
    bindingButton.textContent = isCapturing
      ? translate("Pulsa una combinación de teclas...")
      : formatShortcut(getBinding(definition.id));
    bindingButton.addEventListener("click", () => {
      capturingShortcutId = definition.id;
      renderShortcutSettings();
    });

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "btn-icon";
    resetButton.textContent = "↺";
    resetButton.setAttribute(
      "aria-label",
      `${translate("Restablecer atajo")}: ${translate(definition.label)}`
    );
    resetButton.addEventListener("click", () => {
      resetBinding(definition.id);
      capturingShortcutId = null;
      renderShortcutSettings();
      refreshShortcutModalBindings();
      showToast(translate("Atajo restablecido."));
    });

    actions.append(bindingButton, resetButton);
    row.append(label, actions);
    list.append(row);
  }
}

// Captura en fase capture: la combinación que se está asignando no debe
// ejecutar su acción mientras se graba.
window.addEventListener("keydown", (event) => {
  if (!capturingShortcutId) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.key === "Escape") {
    capturingShortcutId = null;
    renderShortcutSettings();
    return;
  }
  const result = assignBinding(capturingShortcutId, normalizeShortcutEvent(event, true));
  if (!result.ok) {
    const reasonKey = result.reason === "duplicate"
      ? "Ese atajo ya está en uso por"
      : result.reason === "reserved"
        ? "Ese atajo está reservado por"
        : "Combinación no válida para este atajo.";
    const conflict = result.conflictLabel ? ` ${translate(result.conflictLabel)}` : "";
    showToast(`${translate(reasonKey)}${conflict}`);
    return;
  }
  capturingShortcutId = null;
  renderShortcutSettings();
  refreshShortcutModalBindings();
  showToast(translate("Atajo guardado."));
}, true);

onLanguageChange(() => {
  renderShortcutSettings();
  refreshShortcutModalBindings();
});
