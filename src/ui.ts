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
type Corner = (typeof SCREW_SEQUENCE)[number];

// The peeled OFF label backs a screw out by brushing against it while
// dragged — no precision required, just get close.
const SCREW_TOUCH_RADIUS_PX = 28;

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
      <div class="wall-tape label-tape" aria-hidden="true">IS IT?</div>
      <div class="plate-mount">
        <div class="plate">
          <span class="hole hole-tl"></span>
          <span class="hole hole-tr"></span>
          <span class="hole hole-bl"></span>
          <span class="hole hole-br"></span>
          <span class="screw screw-tl"></span>
          <span class="screw screw-tr"></span>
          <span class="screw screw-bl"></span>
          <span class="screw screw-br"></span>
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
        </div>
      </div>
      <div class="antenna" data-testid="arm" aria-hidden="true">
        <span class="seg-1"></span><span class="seg-2"></span><span class="seg-3"></span><span class="knob"></span>
      </div>
    </div>
  `;

  const rocker = mustFind<HTMLButtonElement>(root, "[role=switch]");
  const antenna = mustFind<HTMLDivElement>(root, "[data-testid=arm]");
  const onLabel = mustFind<HTMLDivElement>(root, ".label-tape-on");
  const offLabel = mustFind<HTMLDivElement>(root, ".label-tape-off");

  // Each click spins the ON label 90deg counter-clockwise. Since O and N are
  // both symmetric under a 180deg rotation, two clicks (180deg) reads as NO
  // — and blocks the switch to match. Four clicks (360deg) is back to ON,
  // reactivating it.
  let onLabelSpins = 0;
  // Set when a real turn-on attempt is swallowed by the block above; a
  // later successful turn-on that follows it unlocks its own easter egg.
  let attemptedWhileBlocked = false;
  function onLabelBlocksSwitch(): boolean {
    return onLabelSpins % 4 === 2;
  }
  onLabel.addEventListener("click", () => {
    onLabelSpins++;
    onLabel.style.setProperty("--on-label-spin", `${-90 * onLabelSpins}deg`);
  });

  const screwEls: Record<Corner, HTMLSpanElement> = {
    tl: mustFind(root, ".screw-tl"),
    tr: mustFind(root, ".screw-tr"),
    bl: mustFind(root, ".screw-bl"),
    br: mustFind(root, ".screw-br"),
  };
  // Whether each corner screw is still driven in. Backing one out is a drag
  // gesture (the OFF label brushing against it, below); winding it back in
  // is a direct click — kept as two different gestures on purpose.
  const fastened: Record<Corner, boolean> = {
    tl: true,
    tr: true,
    bl: true,
    br: true,
  };

  function renderScrews(): void {
    for (const corner of SCREW_SEQUENCE) {
      screwEls[corner].classList.toggle("removed", !fastened[corner]);
    }
  }

  let screwStep = 0;
  let screwStepTimer: ReturnType<typeof setTimeout> | undefined;

  for (const corner of SCREW_SEQUENCE) {
    screwEls[corner].addEventListener("click", () => {
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

  // Dragging the peeled OFF label across a screw backs it out — the label
  // itself just follows the pointer via CSS custom properties, and every
  // move checks proximity to each still-fastened screw.
  let dragPointerId: number | undefined;
  let dragStartX = 0;
  let dragStartY = 0;
  let toggledThisDrag = new Set<Corner>();

  function checkScrewCollisions(): void {
    const labelRect = offLabel.getBoundingClientRect();
    const lx = labelRect.left + labelRect.width / 2;
    const ly = labelRect.top + labelRect.height / 2;
    for (const corner of SCREW_SEQUENCE) {
      if (!fastened[corner] || toggledThisDrag.has(corner)) continue;
      const r = screwEls[corner].getBoundingClientRect();
      const dx = lx - (r.left + r.width / 2);
      const dy = ly - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < SCREW_TOUCH_RADIUS_PX) {
        toggledThisDrag.add(corner);
        fastened[corner] = false;
        renderScrews();
      }
    }
  }

  offLabel.addEventListener("pointerdown", (event) => {
    dragPointerId = event.pointerId;
    toggledThisDrag = new Set();
    offLabel.setPointerCapture(event.pointerId);
    offLabel.classList.add("grabbed");
    dragStartX = event.clientX;
    dragStartY = event.clientY;
  });
  offLabel.addEventListener("pointermove", (event) => {
    if (event.pointerId !== dragPointerId) return;
    offLabel.style.setProperty("--drag-x", `${event.clientX - dragStartX}px`);
    offLabel.style.setProperty("--drag-y", `${event.clientY - dragStartY}px`);
    checkScrewCollisions();
  });
  function endLabelDrag(event: PointerEvent): void {
    if (event.pointerId !== dragPointerId) return;
    dragPointerId = undefined;
    offLabel.classList.remove("grabbed");
    offLabel.style.removeProperty("--drag-x");
    offLabel.style.removeProperty("--drag-y");
  }
  offLabel.addEventListener("pointerup", endLabelDrag);
  offLabel.addEventListener("pointercancel", endLabelDrag);

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
  // Whichever pointer is currently pressing the rocker, on or off — tracked
  // separately from holdPointerId (which only means "holding it on") so
  // dragging across the midline or off the switch entirely can be detected
  // regardless of which direction the press started in.
  let pressPointerId: number | undefined;

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

  // Stops the local hold-tracking (timers + flags) without touching the
  // machine or the antenna's visuals — used both by a normal release and by
  // a mid-drag flip straight to off, which needs the machine and antenna
  // handled through the paths their own callers already use for a direct
  // flip instead.
  function cancelHold(): void {
    clearTimeout(arrivalTimer);
    clearTimeout(pushTimer);
    clearTimeout(shiverTimer);
    holdPointerId = undefined;
    engaged = false;
  }

  function endHold(): void {
    if (holdPointerId === undefined) return;
    const wasEngaged = engaged;
    cancelHold();
    if (!wasEngaged) return; // released before it even arrived — nothing to
    // do, its normal approach and auto-flip are already running unmodified
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

  // Applies whatever a press/drag to this Y position should do — turning
  // on, turning off, or nothing if it's already sitting on that side. Used
  // for both the initial pointerdown and every pointermove while pressed,
  // so dragging across the midline acts exactly like releasing and
  // freshly pressing at the new position.
  function applyPressAt(clientY: number, pointerId: number): void {
    const rect = rocker.getBoundingClientRect();
    const clickedTop = clientY - rect.top < rect.height / 2;
    const isOn = machine.state === "on";
    // only the top half turns it on, only the bottom half turns it off
    if (clickedTop === isOn) return;
    const turningOn = clickedTop && !isOn;
    if (turningOn && onLabelBlocksSwitch()) {
      attemptedWhileBlocked = true;
      return;
    }
    if (turningOn && attemptedWhileBlocked) {
      attemptedWhileBlocked = false;
      unlockEasterEgg("no-means-no");
    }
    armIdleReset();
    machine.flip();
    if (turningOn) {
      holdPointerId = pointerId;
      engaged = false;
      const arrivalMs = Math.max(0, currentContactDelayMs() - ARRIVAL_LEAD_MS);
      arrivalTimer = setTimeout(noticeStillHeld, arrivalMs);
    } else {
      // machine.flip() above already turned it off synchronously (and the
      // machine.onEvent listener below already reacted to that) — this just
      // stops the local hold timers from later firing into a switch that's
      // already off.
      cancelHold();
    }
  }

  function withinRocker(clientX: number, clientY: number): boolean {
    const rect = rocker.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  function endPress(pointerId: number): void {
    if (pressPointerId !== pointerId) return;
    pressPointerId = undefined;
    if (rocker.hasPointerCapture(pointerId)) {
      rocker.releasePointerCapture(pointerId);
    }
    if (pointerId === holdPointerId) endHold();
  }

  rocker.addEventListener("pointerdown", (event) => {
    if (pressPointerId !== undefined) return; // a press is already in progress
    pressPointerId = event.pointerId;
    // Captured so drags that leave the rocker's bounds still deliver
    // pointermove/pointerup here instead of wherever the pointer ends up.
    rocker.setPointerCapture(event.pointerId);
    applyPressAt(event.clientY, event.pointerId);
  });
  rocker.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pressPointerId) return;
    if (!withinRocker(event.clientX, event.clientY)) {
      endPress(event.pointerId); // left the switch — no longer pressed
      return;
    }
    applyPressAt(event.clientY, event.pointerId);
  });
  rocker.addEventListener("pointerup", (event) => endPress(event.pointerId));
  rocker.addEventListener("pointercancel", (event) =>
    endPress(event.pointerId),
  );
  antenna.addEventListener("pointerdown", (event) => {
    if (blockedPointerId !== undefined) return; // already blocked
    if (holdPointerId !== undefined || engaged) return; // switch-hold in control
    if (!antenna.classList.contains("reach")) return; // only mid-approach
    beginBlock(event.pointerId);
  });
  window.addEventListener("pointerup", (event) => {
    if (event.pointerId === blockedPointerId) endBlock();
  });
  window.addEventListener("pointercancel", (event) => {
    if (event.pointerId === blockedPointerId) endBlock();
  });

  rocker.addEventListener("click", (event) => {
    if (event.detail !== 0) return; // pointer taps are handled by pointerdown
    const rect = rocker.getBoundingClientRect();
    const clickedTop = event.clientY - rect.top < rect.height / 2;
    const isOn = machine.state === "on";
    if (clickedTop === isOn) return;
    const turningOn = clickedTop && !isOn;
    if (turningOn && onLabelBlocksSwitch()) {
      attemptedWhileBlocked = true;
      return;
    }
    if (turningOn && attemptedWhileBlocked) {
      attemptedWhileBlocked = false;
      unlockEasterEgg("no-means-no");
    }
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
      } else if (antenna.classList.contains("struggle")) {
        // dragged straight to off while the antenna was already pushing
        // against the held switch — same idea as the "reach" case above,
        // just needing settleThenTransition() to freeze its mid-struggle
        // position before transitioning, the way giveUp() does.
        settleThenTransition("retreat");
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
