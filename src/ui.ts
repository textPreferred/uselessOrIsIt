import type { Machine } from "./machine";

export function renderMachine(root: HTMLElement, machine: Machine): void {
  root.innerHTML = `
    <div class="machine" data-state="off">
      <div class="arm" data-testid="arm"></div>
      <button class="switch" type="button" role="switch" aria-checked="false" aria-label="Switch">
        Switch
      </button>
    </div>
  `;

  const box = mustFind<HTMLDivElement>(root, ".machine");
  const machineSwitch = mustFind<HTMLButtonElement>(root, "[role=switch]");

  machineSwitch.addEventListener("click", () => machine.flip());

  machine.onEvent(() => {
    box.dataset.state = machine.state;
    machineSwitch.setAttribute("aria-checked", String(machine.state === "on"));
  });
}

function mustFind<T extends Element>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`missing element: ${selector}`);
  return element;
}
