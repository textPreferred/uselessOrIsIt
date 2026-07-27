import { offerEasterEggReset, unlockEasterEgg } from "./easter-eggs";
import type { Machine } from "./machine";

/** Dashes between letter/digit runs so the build's commit SHA reads like a
 * stamped serial number instead of a hex hash. */
function serialize(sha: string): string {
  return sha
    .toUpperCase()
    .replace(/(?<=[0-9])(?=[A-Z])|(?<=[A-Z])(?=[0-9])/g, "-");
}

/** Duration of the antenna's first move; each subsequent move is 50% faster. */
export const BASE_CONTACT_DELAY_MS = 1800;
const MIN_CONTACT_DELAY_MS = 100;
/** No flip for this long resets the pace back to the first move's speed. */
const IDLE_RESET_MS = 5000;
/** How much earlier than its calculated arrival to check whether the switch
 * is still held — keeps that check reliably ahead of the machine's own
 * switch-off timer, which is armed for the same moment. */
const ARRIVAL_LEAD_MS = 40;
/** How long the paddle's own flip takes, and how long the antenna dwells at
 * contact before retreating, at base pace — both scale down with the
 * current pace like everything else (see `scaleWithPace`), so a fast
 * antenna doesn't look like it's still finishing the push well after it's
 * already arrived and frozen in place. */
const PADDLE_FLIP_MS = 160;
const CONTACT_HOLD_MS = 100;

function scaleWithPace(msAtBasePace: number, durMs: number): number {
  return (msAtBasePace / BASE_CONTACT_DELAY_MS) * durMs;
}

/** How long the antenna quietly presses against a held switch before it
 * starts visibly struggling. */
const PUSH_MS = 1300;
/** How long the antenna struggles before it gives up and backs off — still
 * waiting, not actually leaving, for as long as the switch stays held. */
const SHIVER_MS = 1200;
/** How fast the antenna finishes the job once the switch is finally let go
 * — always this fast, regardless of how long it was held. */
const RELEASE_SNAP_MS = 220;

/** How long the antenna's annoyed pull-back takes after being physically
 * blocked and released, before it strikes back. */
const BLOCK_RETREAT_MS = 200;
/** How fast its retaliatory approach is — quicker than a normal move, since
 * it's coming back annoyed rather than just trying again. */
const HIT_BACK_MS = 120;

// Clicking the four mounting screws clockwise, starting from the top-left,
// offers to reset every unlocked easter egg. A pause between clicks resets
// progress — this is a click pattern, not a race against the clock.
const SCREW_SEQUENCE = ["tl", "tr", "br", "bl"] as const;
const SCREW_STEP_TIMEOUT_MS = 3000;

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
      <div class="nameplate" aria-hidden="true">
        <span class="nameplate-model">Useless Machine <span class="nameplate-mark">?</span></span>
        <span class="nameplate-serial">S/N ${serialize(__COMMIT_SHA__)}</span>
      </div>
      <div class="label-tape label-tape-on" aria-hidden="true">ON</div>
      <button class="rocker" type="button" role="switch" aria-checked="false" aria-label="Switch">
        <span class="well"></span>
        <span class="paddle-stage">
          <span class="paddle"></span>
        </span>
      </button>
      <div class="label-tape label-tape-off" aria-hidden="true">OFF</div>
      <div class="antenna" data-testid="arm" aria-hidden="true">
        <span class="seg-1"></span><span class="seg-2"></span><span class="seg-3"></span><span class="knob"></span>
      </div>
    </div>
  `;

  const rocker = mustFind<HTMLButtonElement>(root, "[role=switch]");
  const antenna = mustFind<HTMLDivElement>(root, "[data-testid=arm]");

  let screwStep = 0;
  let screwStepTimer: ReturnType<typeof setTimeout> | undefined;

  for (const corner of SCREW_SEQUENCE) {
    const screw = mustFind<HTMLSpanElement>(root, `.screw-${corner}`);
    screw.addEventListener("click", () => {
      clearTimeout(screwStepTimer);
      if (corner === SCREW_SEQUENCE[screwStep]) {
        screwStep++;
      } else {
        screwStep = corner === SCREW_SEQUENCE[0] ? 1 : 0;
      }
      if (screwStep === SCREW_SEQUENCE.length) {
        screwStep = 0;
        offerEasterEggReset();
        return;
      }
      screwStepTimer = setTimeout(() => {
        screwStep = 0;
      }, SCREW_STEP_TIMEOUT_MS);
    });
  }

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
    rocker.style.setProperty(
      "--paddle-dur",
      `${scaleWithPace(PADDLE_FLIP_MS, durMs)}ms`,
    );
    antenna.classList.remove("retreat");
    requestAnimationFrame(() => antenna.classList.add("reach"));
    schedule(
      () => retreat(durMs),
      durMs + scaleWithPace(CONTACT_HOLD_MS, durMs),
    );
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
  function settleThenTransition(
    nextClass: string,
    onSettled?: (frozenTransform: string) => void,
  ): void {
    const frozenTransform = getComputedStyle(antenna).transform;
    antenna.classList.remove("reach", "retreat", "struggle", "blocked");
    antenna.style.transition = "none";
    antenna.style.transform = frozenTransform;
    void antenna.offsetHeight;
    antenna.style.removeProperty("transition");
    requestAnimationFrame(() => {
      antenna.style.removeProperty("transform");
      onSettled?.(frozenTransform);
      antenna.classList.add(nextClass);
    });
  }

  /** Extracts the x/y translation (in px) from a computed `transform`
   * string, so a freshly frozen position can seed --block-x/--block-y. */
  function translationOf(transform: string): { x: number; y: number } {
    if (transform === "none") return { x: 0, y: 0 };
    const matrix = new DOMMatrixReadOnly(transform);
    return { x: matrix.m41, y: matrix.m42 };
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
    rocker.style.setProperty(
      "--paddle-dur",
      `${scaleWithPace(PADDLE_FLIP_MS, RELEASE_SNAP_MS)}ms`,
    );
    settleThenTransition("reach");
    schedule(
      () => retreat(RELEASE_SNAP_MS),
      RELEASE_SNAP_MS + scaleWithPace(CONTACT_HOLD_MS, RELEASE_SNAP_MS),
    );
  }

  // Blocking the antenna directly — pressing on it wherever it currently is,
  // mid-approach — is a separate provocation from holding the switch: it
  // freezes right there for as long as it's blocked (holding the machine on
  // the same way a held switch does), then once released it backs off
  // annoyed and strikes back with a fast, aggressive approach. Blocking that
  // retaliatory approach again just repeats the cycle.
  let blockedPointerId: number | undefined;

  function beginBlock(pointerId: number): void {
    blockedPointerId = pointerId;
    machine.hold();
    cancelSequence(); // cancel whatever retreat/hit-back was scheduled next
    settleThenTransition("blocked", (frozenTransform) => {
      const { x, y } = translationOf(frozenTransform);
      antenna.style.setProperty("--block-x", `${x}px`);
      antenna.style.setProperty("--block-y", `${y}px`);
    });
  }

  function hitBack(): void {
    unlockEasterEgg("poked-the-antenna");
    antenna.classList.remove("retreat");
    antenna.style.setProperty("--dur", `${HIT_BACK_MS}ms`);
    rocker.style.setProperty(
      "--paddle-dur",
      `${scaleWithPace(PADDLE_FLIP_MS, HIT_BACK_MS)}ms`,
    );
    requestAnimationFrame(() => antenna.classList.add("reach"));
    schedule(
      () => retreat(HIT_BACK_MS),
      HIT_BACK_MS + scaleWithPace(CONTACT_HOLD_MS, HIT_BACK_MS),
    );
  }

  function endBlock(): void {
    if (blockedPointerId === undefined) return;
    blockedPointerId = undefined;
    // Arm the real switch-off for when the retaliatory strike actually
    // lands, same idea as endHold()'s RELEASE_SNAP_MS timing.
    machine.release(BLOCK_RETREAT_MS + HIT_BACK_MS);
    antenna.style.setProperty("--dur", `${BLOCK_RETREAT_MS}ms`);
    settleThenTransition("retreat");
    schedule(hitBack, BLOCK_RETREAT_MS);
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
  antenna.addEventListener("pointerdown", (event) => {
    if (blockedPointerId !== undefined) return; // already blocked
    if (holdPointerId !== undefined || engaged) return; // switch-hold in control
    if (!antenna.classList.contains("reach")) return; // only mid-approach
    beginBlock(event.pointerId);
  });
  window.addEventListener("pointerup", (event) => {
    if (event.pointerId === holdPointerId) endHold();
    if (event.pointerId === blockedPointerId) endBlock();
  });
  window.addEventListener("pointercancel", (event) => {
    if (event.pointerId === holdPointerId) endHold();
    if (event.pointerId === blockedPointerId) endBlock();
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
      } else if (antenna.classList.contains("blocked")) {
        blockedPointerId = undefined; // its own pointerup would now no-op anyway
        const durMs = currentContactDelayMs();
        antenna.style.setProperty("--dur", `${durMs}ms`);
        settleThenTransition("retreat"); // "blocked" is an animation, not a
        // transition — retreat() alone would leave both classes fighting
        schedule(() => antenna.classList.remove("retreat"), durMs);
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
