import { unlockAchievement } from "./achievements";
import type { Machine } from "./machine";

/** Duration of the antenna's first move; each subsequent move is 50% faster. */
export const BASE_CONTACT_DELAY_MS = 1800;
const MIN_CONTACT_DELAY_MS = 100;
/** No flip for this long resets the pace back to the first move's speed. */
const IDLE_RESET_MS = 5000;
/** A press shorter than this is just a tap; longer, and it becomes a hold
 * that fights the antenna off. */
const HOLD_THRESHOLD_MS = 160;
/** How long the antenna keeps struggling against a hold before it gives up
 * and backs off — still frozen, still waiting for the user to let go. */
const STRUGGLE_MS = 1400;

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

  // Holding the switch on (rather than tapping it) starts a tug-of-war: the
  // antenna struggles against the hold, eventually backs off as if it's
  // given up, then lunges back in the instant the user lets go.
  let holdPointerId: number | undefined;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let struggling = false;

  function startStruggle(): void {
    struggling = true;
    machine.hold();
    cancelSequence();
    antenna.classList.remove("reach", "retreat");
    antenna.classList.add("struggle");
    schedule(giveUp, STRUGGLE_MS);
  }

  function giveUp(): void {
    antenna.classList.remove("struggle");
    antenna.classList.add("retreat");
  }

  function endHold(): void {
    if (holdPointerId === undefined) return;
    clearTimeout(holdTimer);
    holdPointerId = undefined;
    if (!struggling) return; // released before the hold even kicked in
    struggling = false;
    cancelSequence();
    const resumedMs = machine.release();
    if (resumedMs === undefined) return;
    // Whatever's in flight (the struggle shake, or the "give up" retreat)
    // needs to be killed rather than redirected: freeze the antenna exactly
    // where it visually is, with transitions off, then let the "reach"
    // transition start fresh from there. Redirecting an in-flight retreat
    // straight to "reach" instead would make the browser treat the comeback
    // as a *reversal* of that retreat and shorten its duration to match how
    // little of the retreat had played — snapping instead of gliding.
    const frozenTransform = getComputedStyle(antenna).transform;
    antenna.classList.remove("struggle", "retreat");
    antenna.style.transition = "none";
    antenna.style.transform = frozenTransform;
    void antenna.offsetHeight;
    antenna.style.setProperty("--dur", `${resumedMs}ms`);
    antenna.style.removeProperty("transition");
    requestAnimationFrame(() => {
      antenna.style.removeProperty("transform");
      antenna.classList.add("reach");
    });
    schedule(() => retreat(resumedMs), resumedMs + 100);
  }

  rocker.addEventListener("pointerdown", (event) => {
    if (holdPointerId !== undefined) return; // a hold is already in progress
    const rect = rocker.getBoundingClientRect();
    const clickedTop = event.clientY - rect.top < rect.height / 2;
    const isOn = machine.state === "on";
    // only the top half turns it on, only the bottom half turns it off
    if (clickedTop === isOn) return;
    armIdleReset();
    const turningOn = clickedTop && !isOn;
    machine.flip();
    if (turningOn) {
      holdPointerId = event.pointerId;
      holdTimer = setTimeout(startStruggle, HOLD_THRESHOLD_MS);
    }
  });
  window.addEventListener("pointerup", (event) => {
    if (event.pointerId === holdPointerId) endHold();
  });
  window.addEventListener("pointercancel", (event) => {
    if (event.pointerId === holdPointerId) endHold();
  });

  rocker.addEventListener("click", (event) => {
    if (event.detail !== 0) return; // pointer taps are handled by pointerdown
    const rect = rocker.getBoundingClientRect();
    const clickedTop = event.clientY - rect.top < rect.height / 2;
    const isOn = machine.state === "on";
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
