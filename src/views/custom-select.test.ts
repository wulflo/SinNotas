// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { migrateSelect, syncCustomSelect } from "./custom-select";

interface OptionSpec {
  value: string;
  label: string;
  disabled?: boolean;
}

function makeSelect(options: OptionSpec[], value = ""): HTMLSelectElement {
  const select = document.createElement("select");
  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    if (option.disabled) element.disabled = true;
    select.appendChild(element);
  }
  select.value = value;
  document.body.appendChild(select);
  return select;
}

function menuItems(): HTMLElement[] {
  return Array.from(
    document.body.querySelectorAll<HTMLElement>(".custom-select-menu .custom-select-item")
  );
}

afterEach(() => {
  document.body.innerHTML = "";
  document.dispatchEvent(new Event("mousedown", { bubbles: true }));
});

describe("migrateSelect", () => {
  it("esconde el select nativo y muestra el botón con la opción seleccionada", () => {
    const select = makeSelect([{ value: "a", label: "Opción A" }, { value: "b", label: "Opción B" }], "a");
    const custom = migrateSelect(select);

    expect(custom).not.toBeNull();
    expect(select.style.display).toBe("none");
    expect(custom?.root.textContent).toBe("Opción A");
    expect(custom?.root.getAttribute("aria-expanded")).toBe("false");
  });

  it("es idempotente: los selects ya convertidos se ignoran", () => {
    const select = makeSelect([{ value: "a", label: "A" }], "a");
    const first = migrateSelect(select);
    expect(migrateSelect(select)).toBe(first);
  });

  it("devuelve null para selectores vacíos", () => {
    expect(migrateSelect(null)).toBeNull();
  });

  it("no esconde un select que aún no tiene padre", () => {
    const select = document.createElement("select");
    const option = document.createElement("option");
    option.value = "a";
    option.textContent = "Opción A";
    select.append(option);

    expect(migrateSelect(select)).toBeNull();
    expect(select.style.display).not.toBe("none");
    expect(select.hasAttribute("data-custom-select-applied")).toBe(false);

    // Cuando se inserta más tarde, la migración funciona con normalidad.
    document.body.appendChild(select);
    const custom = migrateSelect(select);
    expect(custom).not.toBeNull();
    expect(select.style.display).toBe("none");
  });

  it("al hacer clic abre el menú, selecciona la opción y despacha change", () => {
    const select = makeSelect([{ value: "a", label: "Opción A" }, { value: "b", label: "Opción B" }], "");
    const custom = migrateSelect(select)!;
    const changes: string[] = [];
    select.addEventListener("change", () => changes.push(select.value));

    custom.root.click();
    expect(custom.root.getAttribute("aria-expanded")).toBe("true");
    const items = menuItems();
    expect(items).toHaveLength(2);
    expect(items[1].textContent).toBe("Opción B");

    items[1].click();
    expect(select.value).toBe("b");
    expect(changes).toEqual(["b"]);
    expect(custom.root.textContent).toBe("Opción B");
    expect(custom.root.getAttribute("aria-expanded")).toBe("false");
    expect(menuItems()).toHaveLength(0);
  });

  it("escape cierra el menú sin cambiar el valor", () => {
    const select = makeSelect([{ value: "a", label: "Opción A" }, { value: "b", label: "Opción B" }], "a");
    const custom = migrateSelect(select)!;

    custom.root.click();
    expect(menuItems()).toHaveLength(2);
    custom.root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(menuItems()).toHaveLength(0);
    expect(select.value).toBe("a");
  });

  it("un clic fuera cierra el menú", () => {
    const select = makeSelect([{ value: "a", label: "Opción A" }], "a");
    const custom = migrateSelect(select)!;

    custom.root.click();
    expect(menuItems()).toHaveLength(1);
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(menuItems()).toHaveLength(0);
  });

  it("el teclado navega y selecciona las opciones del menú", () => {
    const select = makeSelect([{ value: "a", label: "Opción A" }, { value: "b", label: "Opción B" }], "");
    const custom = migrateSelect(select)!;

    custom.root.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    const items = menuItems();
    expect(items).toHaveLength(2);
    expect(document.activeElement).toBe(items[0]);

    items[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(document.activeElement).toBe(items[1]);
    items[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(select.value).toBe("b");
    expect(menuItems()).toHaveLength(0);
  });

  it("syncCustomSelect recomputa el texto tras cambios programáticos", () => {
    const select = makeSelect([{ value: "a", label: "Opción A" }, { value: "b", label: "Opción B" }], "a");
    const custom = migrateSelect(select)!;
    select.value = "b";
    syncCustomSelect(select);
    expect(custom.root.textContent).toBe("Opción B");
    expect(custom.value).toBe("b");
  });
});
