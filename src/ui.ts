import { unlockAchievement } from "./achievements";
import type { Machine } from "./machine";

/** Duration of the antenna's first move; each subsequent move is 50% faster. */
export const BASE_CONTACT_DELAY_MS = 1800;
const MIN_CONTACT_DELAY_MS = 100;
/** No flip for this long resets the pace back to the first move's speed. */
const IDLE_RESET_MS = 5000;

let moveCount = 0;
let contactDelayMs = BASE_CONTACT_DELAY_MS;
let idleResetTimer: ReturnType<typeof setTimeout> | undefined;

function armIdleReset(): void {
  clearTimeout(idleResetTimer);
  idleResetTimer = setTimeout(() => {
    moveCount = 0;
  }, IDLE_RESET_MS);
}

function advanceContactDelay(): number {
  contactDelayMs = Math.max(
    BASE_CONTACT_DELAY_MS * 0.5 ** moveCount,
    MIN_CONTACT_DELAY_MS,
  );
  moveCount++;
  return contactDelayMs;
}

/** The delay used for the move in progress — read by the machine's own
 * switch-off timer so it lands exactly when the antenna's glide does. */
export function currentContactDelayMs(): number {
  return contactDelayMs;
}

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

  function retreat(durMs: number): void {
    antenna.classList.remove("reach");
    antenna.classList.add("retreat");
    schedule(() => antenna.classList.remove("retreat"), durMs);
  }

  function startSequence(): void {
    const durMs = advanceContactDelay();
    if (durMs <= MIN_CONTACT_DELAY_MS) unlockAchievement("top-speed");
    antenna.style.setProperty("--dur", `${durMs}ms`);
    antenna.classList.remove("retreat");
    requestAnimationFrame(() => antenna.classList.add("reach"));
    schedule(() => retreat(durMs), durMs + 100);
  }

  rocker.addEventListener("click", (event) => {
    const rect = rocker.getBoundingClientRect();
    const clickedTop = event.clientY - rect.top < rect.height / 2;
    const isOn = machine.state === "on";
    // only the top half turns it on, only the bottom half turns it off
    if (clickedTop === isOn) return;
    armIdleReset();
    machine.flip();
  });

  machine.onEvent((event) => {
    rocker.setAttribute("aria-checked", String(machine.state === "on"));
    snap(machine.state === "on");
    if (event.type === "switched-on") {
      cancelSequence();
      startSequence();
    } else if (event.by === "user") {
      cancelSequence();
      if (antenna.classList.contains("reach")) {
        retreat(currentContactDelayMs());
        unlockAchievement("beat-the-antenna");
      }
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
