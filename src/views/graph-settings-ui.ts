import type { GraphView } from "./graph-view";
import {
  defaultGraphSettings,
  loadGraphSettings,
  normalizeGraphSettings,
  saveGraphSettings,
  type GraphColorRule,
  type GraphSettings,
} from "./graph-settings";
import { translate } from "../i18n";
import { showToast } from "../ui/toast";

/** Único estado de desktop.ts que necesita el panel del grafo. */
export interface GraphSettingsHost {
  getGraphView(): GraphView | null;
}

let host!: GraphSettingsHost;
let graphSettingsUiReady = false;

export function configureGraphSettingsUi(nextHost: GraphSettingsHost): void {
  host = nextHost;
}

let graphSettings: GraphSettings = loadGraphSettings();
let graphSettingsSaveTimer: number | null = null;

// Los ajustes del grafo viven ahora en un panel lateral de la propia vista de
// grafo (antes eran una pestaña de Ajustes). El panel es estático, así que sus
// listeners no se pierden al montar/desmontar el overlay de Ajustes.
const graphSettingsPanel = document.getElementById("graph-settings-panel") as HTMLElement;
const graphSettingsToggleButton = document.getElementById(
  "btn-toggle-graph-settings"
) as HTMLButtonElement | null;
const graphSettingsCloseButton = document.getElementById(
  "btn-close-graph-settings"
) as HTMLButtonElement | null;

function setGraphSettingsPanelOpen(open: boolean): void {
  if (!graphSettingsPanel) return;
  graphSettingsPanel.hidden = !open;
  graphSettingsToggleButton?.setAttribute("aria-expanded", String(open));
  graphSettingsToggleButton?.classList.toggle("active", open);
  if (open && graphSettingsUiReady) syncGraphSettingsUi();
}

if (graphSettingsToggleButton) {
  graphSettingsToggleButton.addEventListener("click", () => {
    setGraphSettingsPanelOpen(graphSettingsPanel.hidden);
  });
}
graphSettingsCloseButton?.addEventListener("click", () => setGraphSettingsPanelOpen(false));

// El overlay de Ajustes se quita del DOM al iniciar la app, así que los hijos
// deben buscarse cuando se usan (no al evaluar este módulo).
function graphColorRulesElement(): HTMLDivElement | null {
  return document.getElementById("graph-color-rules") as HTMLDivElement | null;
}

function graphRuleNameElement(): HTMLInputElement | null {
  return document.getElementById("graph-rule-name") as HTMLInputElement | null;
}

function graphRuleColorElement(): HTMLInputElement | null {
  return document.getElementById("graph-rule-color") as HTMLInputElement | null;
}

interface GraphSliderBinding {
  inputId: string;
  outputId: string;
  get: (settings: GraphSettings) => number;
  set: (settings: GraphSettings, value: number) => void;
  format: (value: number) => string;
}

const graphSliderBindings: GraphSliderBinding[] = [
  {
    inputId: "graph-repulsion",
    outputId: "graph-repulsion-value",
    get: (s) => s.physics.repulsion,
    set: (s, v) => { s.physics.repulsion = v; },
    format: (v) => String(Math.round(v)),
  },
  {
    inputId: "graph-link-strength",
    outputId: "graph-link-strength-value",
    get: (s) => s.physics.linkStrength,
    set: (s, v) => { s.physics.linkStrength = v; },
    format: (v) => v.toFixed(2),
  },
  {
    inputId: "graph-link-distance",
    outputId: "graph-link-distance-value",
    get: (s) => s.physics.linkDistance,
    set: (s, v) => { s.physics.linkDistance = v; },
    format: (v) => `${Math.round(v)} px`,
  },
  {
    inputId: "graph-center-strength",
    outputId: "graph-center-strength-value",
    get: (s) => s.physics.centerStrength,
    set: (s, v) => { s.physics.centerStrength = v; },
    format: (v) => v.toFixed(3),
  },
  {
    inputId: "graph-collision-strength",
    outputId: "graph-collision-strength-value",
    get: (s) => s.physics.collisionStrength,
    set: (s, v) => { s.physics.collisionStrength = v; },
    format: (v) => v.toFixed(1),
  },
  {
    inputId: "graph-velocity-decay",
    outputId: "graph-velocity-decay-value",
    get: (s) => s.physics.velocityDecay,
    set: (s, v) => { s.physics.velocityDecay = v; },
    format: (v) => v.toFixed(2),
  },
  {
    inputId: "graph-node-base",
    outputId: "graph-node-base-value",
    get: (s) => s.nodeBaseRadius,
    set: (s, v) => { s.nodeBaseRadius = v; },
    format: (v) => `${v.toFixed(1)} px`,
  },
  {
    inputId: "graph-node-connections",
    outputId: "graph-node-connections-value",
    get: (s) => s.nodePerConnectionRadius,
    set: (s, v) => { s.nodePerConnectionRadius = v; },
    format: (v) => `${v.toFixed(1)} px`,
  },
  {
    inputId: "graph-node-max",
    outputId: "graph-node-max-value",
    get: (s) => s.nodeMaxRadius,
    set: (s, v) => { s.nodeMaxRadius = v; },
    format: (v) => `${Math.round(v)} px`,
  },
  {
    inputId: "graph-link-width",
    outputId: "graph-link-width-value",
    get: (s) => s.linkWidth,
    set: (s, v) => { s.linkWidth = v; },
    format: (v) => `${v.toFixed(1)} px`,
  },
  {
    inputId: "graph-link-highlight-width",
    outputId: "graph-link-highlight-width-value",
    get: (s) => s.linkHighlightWidth,
    set: (s, v) => { s.linkHighlightWidth = v; },
    format: (v) => `${v.toFixed(1)} px`,
  },
  {
    inputId: "graph-label-zoom",
    outputId: "graph-label-zoom-value",
    get: (s) => s.labelZoomThreshold,
    set: (s, v) => { s.labelZoomThreshold = v; },
    format: (v) => `${v.toFixed(2)}×`,
  },
];

function cloneGraphSettingsForEdit(settings: GraphSettings): GraphSettings {
  return {
    ...settings,
    colorRules: settings.colorRules.map((rule) => ({ ...rule })),
    physics: { ...settings.physics },
  };
}

function scheduleGraphSettingsSave(): void {
  if (graphSettingsSaveTimer !== null) window.clearTimeout(graphSettingsSaveTimer);
  graphSettingsSaveTimer = window.setTimeout(() => {
    graphSettingsSaveTimer = null;
    saveGraphSettings(graphSettings);
  }, 120);
}

function applyGraphSettings(next: GraphSettings, persist = true): void {
  graphSettings = normalizeGraphSettings(next);
  host.getGraphView()?.applySettings(graphSettings);
  // Refleja los límites cruzados (p. ej. radio máximo ≥ radio base).
  syncGraphSliderValues();
  if (persist) scheduleGraphSettingsSave();
}

function updateGraphSettings(mutator: (draft: GraphSettings) => void): void {
  const draft = cloneGraphSettingsForEdit(graphSettings);
  mutator(draft);
  applyGraphSettings(draft);
}

function graphSliderElements(binding: GraphSliderBinding): {
  input: HTMLInputElement | null;
  output: HTMLOutputElement | null;
} {
  return {
    input: document.getElementById(binding.inputId) as HTMLInputElement | null,
    output: document.getElementById(binding.outputId) as HTMLOutputElement | null,
  };
}

function syncGraphSliderValues(): void {
  for (const binding of graphSliderBindings) {
    const { input, output } = graphSliderElements(binding);
    const value = binding.get(graphSettings);
    if (input) input.value = String(value);
    if (output) output.value = binding.format(value);
  }
}

function renderGraphColorRules(): void {
  const container = graphColorRulesElement();
  if (!container) return;
  container.replaceChildren();

  graphSettings.colorRules.forEach((rule) => {
    const row = document.createElement("div");
    row.className = "graph-color-rule";

    const name = document.createElement("input");
    name.type = "text";
    name.value = rule.name;
    name.placeholder = "Texto del nombre";
    name.setAttribute("aria-label", "Texto del nombre del grupo de color");
    name.addEventListener("change", () => {
      const value = name.value.trim();
      if (!value) {
        name.value = rule.name;
        return;
      }
      updateGraphSettings((draft) => {
        const target = draft.colorRules.find((candidate) => candidate.id === rule.id);
        if (target) target.name = value;
      });
    });

    const color = document.createElement("input");
    color.type = "color";
    color.value = rule.color;
    color.setAttribute("aria-label", `Color para ${rule.name}`);
    color.addEventListener("input", () => {
      updateGraphSettings((draft) => {
        const target = draft.colorRules.find((candidate) => candidate.id === rule.id);
        if (target) target.color = color.value;
      });
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "font-option-btn";
    remove.textContent = "✕";
    remove.title = "Eliminar grupo";
    remove.setAttribute("aria-label", `Eliminar grupo ${rule.name}`);
    remove.addEventListener("click", () => {
      updateGraphSettings((draft) => {
        draft.colorRules = draft.colorRules.filter((candidate) => candidate.id !== rule.id);
      });
      renderGraphColorRules();
    });

    row.append(name, color, remove);
    container.appendChild(row);
  });
}

/** Sincroniza los controles con el estado guardado (al abrir la pestaña). */
export function syncGraphSettingsUi(): void {
  syncGraphSliderValues();
  renderGraphColorRules();
}

function addGraphColorRule(): void {
  const nameInput = graphRuleNameElement();
  const name = nameInput?.value.trim() ?? "";
  if (!name) {
    nameInput?.focus();
    return;
  }
  const color = graphRuleColorElement()?.value || "#3b82f6";
  const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `graph-rule-${crypto.randomUUID()}`
    : `graph-rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const rule: GraphColorRule = { id, name, color };
  updateGraphSettings((draft) => {
    draft.colorRules = [...draft.colorRules, rule];
  });
  if (nameInput) nameInput.value = "";
  renderGraphColorRules();
}

function resetGraphSettings(): void {
  graphSettings = defaultGraphSettings();
  host.getGraphView()?.applySettings(graphSettings);
  saveGraphSettings(graphSettings);
  syncGraphSettingsUi();
  showToast(translate("Ajustes del grafo restablecidos."));
}

// Delegación: los controles viven dentro del overlay, que se desmonta y vuelve
// a montar al abrir/cerrar Ajustes. Así los listeners siguen funcionando.
graphSettingsPanel.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const binding = graphSliderBindings.find((candidate) => candidate.inputId === target.id);
  if (!binding) return;
  const value = Number(target.value);
  if (!Number.isFinite(value)) return;
  const { output } = graphSliderElements(binding);
  if (output) output.value = binding.format(value);
  updateGraphSettings((draft) => binding.set(draft, value));
});

graphSettingsPanel.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const target = event.target;
  if (target instanceof HTMLElement && target.id === "graph-rule-name") {
    event.preventDefault();
    addGraphColorRule();
  }
});

graphSettingsPanel.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest("#btn-add-graph-color-rule")) {
    addGraphColorRule();
    return;
  }
  if (target.closest("#btn-reset-graph-settings")) {
    resetGraphSettings();
  }
});

syncGraphSettingsUi();

/** Sincroniza los controles del panel de grafo mientras esté abierto. */
export function syncGraphSettingsUiIfPanelOpen(): void {
  if (!graphSettingsPanel.hidden && graphSettingsUiReady) syncGraphSettingsUi();
}
