import { unlockEasterEgg } from "./easter-eggs";
import type { Machine } from "./machine";

/** Duration of the antenna's first move; each subsequent move is 50% faster. */
export const BASE_CONTACT_DELAY_MS = 1800;
const MIN_CONTACT_DELAY_MS = 100;
/** No flip for this long resets the pace back to the first move's speed. */
const IDLE_RESET_MS = 5000;
/** How much earlier than its calculated arrival to check whether the switch
 * is still held — keeps that check reliably ahead of the machine's own
 * switch-off timer, which is armed for the same moment. */
const ARRIVAL_LEAD_MS = 40;
/** How long the antenna quietly presses against a held switch before it
 * starts visibly struggling. */
const PUSH_MS = 1300;
/** How long the antenna struggles before it gives up and backs off — still
 * waiting, not actually leaving, for as long as the switch stays held. */
const SHIVER_MS = 1200;
/** How fast the antenna finishes the job once the switch is finally let go
 * — always this fast, regardless of how long it was held. */
const RELEASE_SNAP_MS = 220;

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
      <div class="plate" aria-hidden="true">
        <span class="screw screw-tl"></span>
        <span class="screw screw-tr"></span>
        <span class="screw screw-bl"></span>
        <span class="screw screw-br"></span>
      </div>
      <div class="sticky-note sticky-note-on" aria-hidden="true">On</div>
      <button class="rocker" type="button" role="switch" aria-checked="false" aria-label="Switch">
        <span class="well"></span>
        <span class="paddle-stage">
          <span class="paddle"></span>
        </span>
      </button>
      <div class="sticky-note sticky-note-off" aria-hidden="true">Off</div>
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
    if (durMs <= MIN_CONTACT_DELAY_MS) unlockEasterEgg("top-speed");
    antenna.style.setProperty("--dur", `${durMs}ms`);
    antenna.classList.remove("retreat");
    requestAnimationFrame(() => antenna.classList.add("reach"));
    schedule(() => retreat(durMs), durMs + 100);
  }

  // Holding the switch on (rather than tapping it) starts a tug-of-war: the
  // antenna makes its normal approach, notices the switch is still pressed
  // once it arrives, quietly pushes for a while, struggles, then gives up
  // and backs off — but it's still right there, waiting. Letting go at any
  // point makes it finish fast.
  let holdPointerId: number | undefined;
  let arrivalTimer: ReturnType<typeof setTimeout> | undefined;
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  let shiverTimer: ReturnType<typeof setTimeout> | undefined;
  let engaged = false;
  let hasGivenUp = false;

  function noticeStillHeld(): void {
    engaged = true;
    machine.hold();
    cancelSequence(); // cancel the retreat startSequence() scheduled for arrival
    pushTimer = setTimeout(startStruggle, PUSH_MS);
  }

  function startStruggle(): void {
    antenna.classList.remove("reach");
    antenna.classList.add("struggle");
    shiverTimer = setTimeout(giveUp, SHIVER_MS);
  }

  // Whatever's in flight (the struggle shake, a mid-flight transition) needs
  // to be killed rather than redirected: freeze the antenna exactly where it
  // visually is, with transitions off, then let `nextClass` start a fresh
  // transition from there. Redirecting an in-flight animation or transition
  // straight into a new target instead means the browser never registers a
  // distinct "before" to transition from — an in-flight *transition* gets
  // read as a reversal and has its duration shortened to match how little
  // had played, while an active *animation* being removed at the same
  // moment its replacement is added leaves nothing to transition from at
  // all. Either way, the result is snapping into place instead of gliding.
  function settleThenTransition(nextClass: string): void {
    const frozenTransform = getComputedStyle(antenna).transform;
    antenna.classList.remove("reach", "retreat", "struggle");
    antenna.style.transition = "none";
    antenna.style.transform = frozenTransform;
    void antenna.offsetHeight;
    antenna.style.removeProperty("transition");
    requestAnimationFrame(() => {
      antenna.style.removeProperty("transform");
      antenna.classList.add(nextClass);
    });
  }

  function giveUp(): void {
    hasGivenUp = true;
    settleThenTransition("retreat");
  }

  function endHold(): void {
    if (holdPointerId === undefined) return;
    clearTimeout(arrivalTimer);
    clearTimeout(pushTimer);
    clearTimeout(shiverTimer);
    holdPointerId = undefined;
    if (!engaged) return; // released before it even arrived — nothing to do,
    // its normal approach and auto-flip are already running unmodified
    engaged = false;
    // Arm the real switch-off for the same duration as the visual snap, so
    // the state doesn't flip until the antenna actually gets there.
    machine.release(RELEASE_SNAP_MS);
    antenna.style.setProperty("--dur", `${RELEASE_SNAP_MS}ms`);
    settleThenTransition("reach");
    schedule(() => retreat(RELEASE_SNAP_MS), RELEASE_SNAP_MS + 100);
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
      engaged = false;
      const arrivalMs = Math.max(0, currentContactDelayMs() - ARRIVAL_LEAD_MS);
      arrivalTimer = setTimeout(noticeStillHeld, arrivalMs);
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
      hasGivenUp = false;
      cancelSequence();
      startSequence();
    } else if (event.by === "user") {
      cancelSequence();
      if (antenna.classList.contains("reach")) {
        retreat(currentContactDelayMs());
        unlockEasterEgg("beat-the-antenna");
      }
    } else if (hasGivenUp) {
      // it looked like it had backed off for good, but it was still right
      // there — the machine still gets the last word
      unlockEasterEgg("tug-of-war");
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
