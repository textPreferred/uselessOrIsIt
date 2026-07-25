import type { Machine } from "./machine";

/** Milliseconds after switch-on at which the antenna's jab lands. */
export const CONTACT_DELAY_MS = 2500;

export function renderMachine(root: HTMLElement, machine: Machine): void {
  root.innerHTML = `
    <div class="stage">
      <button class="rocker" type="button" role="switch" aria-checked="false" aria-label="Switch">
        <span class="well"></span>
        <span class="paddle-stage">
          <span class="paddle">
            <span class="mark mark-i"></span>
            <span class="mark mark-o"></span>
          </span>
        </span>
      </button>
      <div class="antenna" data-testid="arm" aria-hidden="true">
        <span class="seg-1"></span><span class="seg-2"></span><span class="seg-3"></span><span class="knob"></span>
      </div>
    </div>
  `;

  const rocker = mustFind<HTMLButtonElement>(root, "[role=switch]");
  const antenna = mustFind<HTMLDivElement>(root, "[data-testid=arm]");

  let timers: ReturnType<typeof setTimeout>[] = [];

  function schedule(fn: () => void, delayMs: number): void {
    timers.push(setTimeout(fn, delayMs));
  }

  function cancelSequence(): void {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
  }

  function retreat(): void {
    antenna.classList.remove("poised", "jab", "in");
    antenna.classList.add("retreat");
    schedule(() => antenna.classList.remove("retreat"), 600);
  }

  function startSequence(): void {
    schedule(() => {
      antenna.classList.remove("retreat");
      antenna.classList.add("in");
    }, 500);
    schedule(() => antenna.classList.add("poised"), 1250);
    schedule(() => {
      antenna.classList.remove("poised");
      antenna.classList.add("jab");
    }, CONTACT_DELAY_MS - 150);
    schedule(() => antenna.classList.remove("jab"), CONTACT_DELAY_MS + 200);
    schedule(retreat, CONTACT_DELAY_MS + 600);
  }

  rocker.addEventListener("click", () => machine.flip());

  machine.onEvent((event) => {
    rocker.setAttribute("aria-checked", String(machine.state === "on"));
    snap(machine.state === "on");
    if (event.type === "switched-on") {
      startSequence();
    } else if (event.by === "user") {
      cancelSequence();
      if (antenna.classList.contains("in")) retreat();
    }
  });
}

let audio: AudioContext | undefined;

function snap(on: boolean): void {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(on ? 2200 : 1700, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.025);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  } catch {
    /* audio unavailable — the machine still works silently */
  }
}

function mustFind<T extends Element>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`missing element: ${selector}`);
  return element;
}
