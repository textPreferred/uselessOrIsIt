import {
  mountEggCollectionButton,
  offerEasterEggReset,
  unlockEasterEgg,
} from "./easter-eggs";
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

/** Short OS name parsed from a user agent string, for the feedback form's
 * hidden fields — order matters since Android UAs also match /Linux/ and
 * iOS UAs also match /like Mac OS X/. */
function detectOperatingSystem(userAgent: string): string {
  if (/Android/.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/.test(userAgent)) return "iOS";
  if (/Windows/.test(userAgent)) return "Windows";
  if (/Macintosh|Mac OS X/.test(userAgent)) return "Mac";
  if (/Linux/.test(userAgent)) return "Linux";
  return "Unknown";
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

/** How long a path block can be held before the antenna gives up on that
 * gap by itself — regardless of whether it's still being held — and sends
 * the top arm in instead. Shorter than the held-switch struggle: blocking
 * the path outright is a more direct provocation than just holding on. */
const PATH_BLOCK_GIVEUP_MS = 1000;
/** How long the main antenna's pull-back takes once it's given up on its
 * path, before the second arm comes in from the top. */
const PATH_BLOCK_RETREAT_MS = 200;
/** How long the top arm's descent takes — always the same, since unlike the
 * main antenna it isn't racing anyone. */
const TOP_ARM_DESCENT_MS = 260;
/** How far outside the switch's own width a path-block press still counts,
 * so a slightly-off finger still registers. */
const PATH_GAP_MARGIN_PX = 24;

// Clicking the four mounting screws clockwise, starting from the top-left,
// offers to reset every unlocked easter egg. A pause between clicks resets
// progress — this is a click pattern, not a race against the clock.
const SCREW_SEQUENCE = ["tl", "tr", "br", "bl"] as const;
const SCREW_STEP_TIMEOUT_MS = 3000;
type Corner = (typeof SCREW_SEQUENCE)[number];

// The peeled OFF label backs a screw out by brushing against it while
// dragged — no precision required, just get close. Touch gets a wider catch
// than a mouse, since a fingertip covers far more of the plate than a
// pointer does.
const SCREW_TOUCH_RADIUS_PX = 28;
const SCREW_TOUCH_RADIUS_TOUCHSCREEN_PX = 40;
// If the label's never been grabbed by this point, its corner lifts once on
// its own — a nudge for anyone who's stalled, gone before anyone who moves
// fast enough to see it as an interruption.
const LABEL_PEEK_DELAY_MS = 3200;

// Cycled by clicking the nameplate's "?". Mixed rather than grouped
// upright-then-inverted, so clicking through it doesn't telegraph a
// pattern. The percontation point (a mirrored "?", used historically for
// rhetorical questions) has no dedicated upside-down glyph in Unicode, so
// its inverted slot reuses the same character and flips it visually via
// CSS instead of switching glyphs like the others do.
const QUESTION_MARK_FORMS: ReadonlyArray<{ char: string; flipped?: boolean }> =
  [
    { char: "?" },
    { char: "¡" },
    { char: "⸮" },
    { char: "¿" },
    { char: "!" },
    { char: "⸮", flipped: true },
    { char: "⸘" },
    { char: "‽" },
  ];

const SCREWS_STORAGE_KEY = "uselessMachine.plateScrews";
const ALL_FASTENED: Record<Corner, boolean> = {
  tl: true,
  tr: true,
  bl: true,
  br: true,
};

function loadFastened(): Record<Corner, boolean> {
  try {
    const raw = localStorage.getItem(SCREWS_STORAGE_KEY);
    if (!raw) return { ...ALL_FASTENED };
    const saved = JSON.parse(raw) as Partial<Record<Corner, boolean>>;
    return { ...ALL_FASTENED, ...saved };
  } catch {
    return { ...ALL_FASTENED }; // storage unavailable — screws just won't persist
  }
}

function saveFastened(state: Record<Corner, boolean>): void {
  try {
    localStorage.setItem(SCREWS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — still works for this session */
  }
}

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
      <div class="wall-tape-group" aria-hidden="true">
        <div class="wall-tape">USELESS MACHINE,</div>
        <div class="wall-tape wall-tape-2">ISN'T IT?</div>
      </div>
      <div class="wall-mount" aria-hidden="true">
        <span class="wall-outline"></span>
        <span class="wall-hole wall-hole-tl"></span>
        <span class="wall-hole wall-hole-tr"></span>
        <span class="wall-hole wall-hole-bl"></span>
        <span class="wall-hole wall-hole-br"></span>
      </div>
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
      <div class="nameplate" aria-hidden="true">
        <span class="nameplate-model">Useless Machine <span class="nameplate-mark">?</span></span>
        <span class="nameplate-serial">S/N ${serialize(__COMMIT_SHA__)}</span>
        <span class="nameplate-version">${__APP_VERSION__}</span>
      </div>
      <div class="antenna" data-testid="arm" aria-hidden="true">
        <span class="seg-1"></span><span class="seg-2"></span><span class="seg-3"></span><span class="knob"></span>
      </div>
      <div class="top-arm" aria-hidden="true">
        <span class="top-arm-seg"></span><span class="top-arm-knob"></span>
      </div>
      <button
        type="button"
        class="feedback-button"
        data-tally-open="0Qz2gP"
        data-version-number="${__APP_VERSION__}"
        data-browser-string="${navigator.userAgent}"
        data-operating-system="${detectOperatingSystem(navigator.userAgent)}"
        data-language-preferences="${navigator.languages.join(", ")}"
        data-tally-hide-title="1"
        data-tally-emoji-text="💬"
        data-tally-emoji-animation="wave"
        aria-label="Give feedback"
      >
        💬
      </button>
    </div>
  `;

  const rocker = mustFind<HTMLButtonElement>(root, "[role=switch]");
  const antenna = mustFind<HTMLDivElement>(root, "[data-testid=arm]");
  const topArm = mustFind<HTMLDivElement>(root, ".top-arm");
  const onLabel = mustFind<HTMLDivElement>(root, ".label-tape-on");
  const offLabel = mustFind<HTMLDivElement>(root, ".label-tape-off");
  const plate = mustFind<HTMLDivElement>(root, ".plate");
  const stage = mustFind<HTMLDivElement>(root, ".stage");
  mountEggCollectionButton(stage);

  const nameplateMark = mustFind<HTMLSpanElement>(root, ".nameplate-mark");
  let markClicks = 0;
  nameplateMark.addEventListener("click", () => {
    markClicks++;
    const form = QUESTION_MARK_FORMS[markClicks % QUESTION_MARK_FORMS.length];
    nameplateMark.textContent = form.char;
    nameplateMark.classList.toggle("nameplate-mark-flip", !!form.flipped);
    if (markClicks >= 2) unlockEasterEgg("questioning-the-question");
  });

  // Dragging the version number scrubs its patch digits up/down like an
  // odometer, purely visual — it always snaps back to the real version the
  // instant it's released, and that snap-back (not the drag itself) is what
  // unlocks the egg: you tried to bend the version, time corrected itself.
  const nameplateVersion = mustFind<HTMLSpanElement>(
    root,
    ".nameplate-version",
  );
  const VERSION_PATCH_PATTERN = /^(v\d+\.\d+\.)(\d+)(.*)$/;
  const VERSION_DRAG_STEP_PX = 18;
  let versionDragPointerId: number | undefined;
  let versionDragStartX = 0;
  let versionOriginalText = "";
  let versionPrefix = "";
  let versionSuffix = "";
  let versionOriginalPatch = 0;
  let versionChanged = false;
  nameplateVersion.addEventListener("pointerdown", (event) => {
    const match = nameplateVersion.textContent?.match(VERSION_PATCH_PATTERN);
    if (!match) return;
    versionDragPointerId = event.pointerId;
    versionDragStartX = event.clientX;
    versionOriginalText = nameplateVersion.textContent ?? "";
    versionPrefix = match[1];
    versionOriginalPatch = Number(match[2]);
    versionSuffix = match[3];
    versionChanged = false;
    nameplateVersion.setPointerCapture(event.pointerId);
    nameplateVersion.classList.add("grabbed");
  });
  nameplateVersion.addEventListener("pointermove", (event) => {
    if (event.pointerId !== versionDragPointerId) return;
    const steps = Math.trunc(
      (event.clientX - versionDragStartX) / VERSION_DRAG_STEP_PX,
    );
    if (steps !== 0) versionChanged = true;
    const patch = Math.max(0, versionOriginalPatch + steps);
    nameplateVersion.textContent = `${versionPrefix}${patch}${versionSuffix}`;
  });
  function endVersionDrag(event: PointerEvent): void {
    if (event.pointerId !== versionDragPointerId) return;
    versionDragPointerId = undefined;
    nameplateVersion.classList.remove("grabbed");
    if (versionChanged) {
      nameplateVersion.textContent = versionOriginalText;
      unlockEasterEgg("no-bending-of-space-time");
    }
  }
  nameplateVersion.addEventListener("pointerup", endVersionDrag);
  nameplateVersion.addEventListener("pointercancel", endVersionDrag);

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
  // is a direct click — kept as two different gestures on purpose. Persisted
  // so a plate left open stays open across a reload, like the eggs it can
  // unlock.
  const fastened: Record<Corner, boolean> = loadFastened();

  function renderScrews(): void {
    for (const corner of SCREW_SEQUENCE) {
      screwEls[corner].classList.toggle("loose", !fastened[corner]);
    }
    const allLoose = SCREW_SEQUENCE.every((corner) => !fastened[corner]);
    plate.classList.toggle("open", allLoose);
    saveFastened(fastened);
    if (allLoose) unlockEasterEgg("behind-the-wall");
  }
  renderScrews(); // reflect whatever was loaded before any interaction

  function closePlate(): void {
    for (const c of SCREW_SEQUENCE) fastened[c] = true;
    renderScrews();
  }

  function popScrew(corner: Corner): void {
    const el = screwEls[corner];
    el.classList.remove("pop");
    void el.offsetWidth; // restart the animation even mid-drag, corner after corner
    el.classList.add("pop");
  }

  let screwStep = 0;
  let screwStepTimer: ReturnType<typeof setTimeout> | undefined;

  for (const corner of SCREW_SEQUENCE) {
    screwEls[corner].addEventListener("click", () => {
      if (!fastened[corner]) {
        fastened[corner] = true;
        renderScrews();
        return; // winding a loose screw back in doesn't also feed the sequence
      }
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

  // Once ajar, the whole panel is a big, obvious target for pushing it shut
  // again — no hunting down four loose screws one at a time to recover.
  // Requires the plate itself to be the click's target, not just an
  // ancestor of it: any of its children (a screw, the rocker, either label)
  // already has its own click behavior, and — critically — releasing the
  // OFF label's drag fires its own trailing click, which bubbles up through
  // .plate right as it opens; targeting only the bare panel keeps that
  // click from immediately re-fastening what the drag just loosened.
  plate.addEventListener("click", (event) => {
    if (!plate.classList.contains("open")) return;
    if (event.target !== plate) return;
    closePlate();
  });

  // Dragging the peeled OFF label across a screw backs it out — the label
  // itself just follows the pointer via CSS custom properties, and every
  // move checks proximity to each still-fastened screw.
  let dragPointerId: number | undefined;
  let dragStartX = 0;
  let dragStartY = 0;
  let toggledThisDrag = new Set<Corner>();
  let everGrabbed = false;

  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setTimeout(() => {
      if (!everGrabbed) offLabel.classList.add("peek");
    }, LABEL_PEEK_DELAY_MS);
  }

  function catchRadiusPx(pointerType: string): number {
    return pointerType === "touch"
      ? SCREW_TOUCH_RADIUS_TOUCHSCREEN_PX
      : SCREW_TOUCH_RADIUS_PX;
  }

  function checkScrewCollisions(pointerType: string): void {
    const labelRect = offLabel.getBoundingClientRect();
    const lx = labelRect.left + labelRect.width / 2;
    const ly = labelRect.top + labelRect.height / 2;
    const radius = catchRadiusPx(pointerType);
    for (const corner of SCREW_SEQUENCE) {
      if (!fastened[corner] || toggledThisDrag.has(corner)) continue;
      const r = screwEls[corner].getBoundingClientRect();
      const dx = lx - (r.left + r.width / 2);
      const dy = ly - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < radius) {
        toggledThisDrag.add(corner);
        fastened[corner] = false;
        popScrew(corner);
        renderScrews();
      }
    }
  }

  offLabel.addEventListener("pointerdown", (event) => {
    everGrabbed = true;
    offLabel.classList.remove("peek");
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
    checkScrewCollisions(event.pointerType);
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

  // Set when an auto-off lands while the plate is ajar: the machine's own
  // switch-off timer fires the instant the antenna makes contact, well
  // before the antenna's own retreat clears the screen, so the plate can't
  // close right then without swinging shut through it. Deferred here until
  // retreat() below reports the antenna has actually settled.
  let closePlateOnceSettled = false;

  function cancelSequence(): void {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
    closePlateOnceSettled = false;
  }

  function antennaSettled(): boolean {
    return (
      !antenna.classList.contains("reach") &&
      !antenna.classList.contains("retreat") &&
      !antenna.classList.contains("struggle") &&
      !antenna.classList.contains("blocked")
    );
  }

  function retreat(durMs: number): void {
    antenna.classList.remove("reach");
    antenna.classList.add("retreat");
    schedule(() => {
      antenna.classList.remove("retreat");
      if (closePlateOnceSettled) {
        closePlateOnceSettled = false;
        if (plate.classList.contains("open")) closePlate();
      }
    }, durMs);
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
    updateReachOffset();
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
    updateReachOffset();
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
  //
  // Blocking its *path* instead — a press that lands between the antenna's
  // current tip and the switch without touching the antenna itself — freezes
  // it the same way at first, but it doesn't wait on you: outlast
  // PATH_BLOCK_GIVEUP_MS and it gives up on that gap by itself, no matter
  // whether you're still holding it, and the second arm above the housing
  // comes down instead — a route your finger isn't in. Let go before then
  // and it's the opposite of giving up: the gap's open now, so it finishes
  // fast through it, same snap as letting go of a held switch.
  let blockedPointerId: number | undefined;
  let blockedViaPath = false;
  let pathBlockGiveUpTimer: ReturnType<typeof setTimeout> | undefined;

  function beginBlock(pointerId: number, viaPath: boolean): void {
    blockedPointerId = pointerId;
    blockedViaPath = viaPath;
    machine.hold();
    cancelSequence(); // cancel whatever retreat/hit-back was scheduled next
    settleThenTransition("blocked", (frozenTransform) => {
      const { x, y } = translationOf(frozenTransform);
      antenna.style.setProperty("--block-x", `${x}px`);
      antenna.style.setProperty("--block-y", `${y}px`);
    });
    if (viaPath) {
      pathBlockGiveUpTimer = setTimeout(pathBlockGiveUp, PATH_BLOCK_GIVEUP_MS);
    }
  }

  function hitBack(): void {
    unlockEasterEgg("poked-the-antenna");
    antenna.classList.remove("retreat");
    antenna.style.setProperty("--dur", `${HIT_BACK_MS}ms`);
    rocker.style.setProperty(
      "--paddle-dur",
      `${scaleWithPace(PADDLE_FLIP_MS, HIT_BACK_MS)}ms`,
    );
    updateReachOffset();
    requestAnimationFrame(() => antenna.classList.add("reach"));
    schedule(
      () => retreat(HIT_BACK_MS),
      HIT_BACK_MS + scaleWithPace(CONTACT_HOLD_MS, HIT_BACK_MS),
    );
  }

  function topArmDescend(): void {
    unlockEasterEgg("over-the-top");
    topArm.classList.remove("retreat");
    topArm.style.setProperty("--dur", `${TOP_ARM_DESCENT_MS}ms`);
    rocker.style.setProperty(
      "--paddle-dur",
      `${scaleWithPace(PADDLE_FLIP_MS, TOP_ARM_DESCENT_MS)}ms`,
    );
    requestAnimationFrame(() => topArm.classList.add("reach"));
    schedule(() => {
      topArm.classList.remove("reach");
      topArm.classList.add("retreat");
      schedule(() => topArm.classList.remove("retreat"), TOP_ARM_DESCENT_MS);
    }, TOP_ARM_DESCENT_MS + scaleWithPace(CONTACT_HOLD_MS, TOP_ARM_DESCENT_MS));
  }

  // Fires on its own once a path-block has been held past
  // PATH_BLOCK_GIVEUP_MS — the pointer may well still be down, but that no
  // longer matters: this resolves the block unconditionally, the same way
  // an actual release would, so a later pointerup for it is a no-op.
  function pathBlockGiveUp(): void {
    blockedPointerId = undefined;
    machine.release(PATH_BLOCK_RETREAT_MS + TOP_ARM_DESCENT_MS);
    antenna.style.setProperty("--dur", `${PATH_BLOCK_RETREAT_MS}ms`);
    settleThenTransition("retreat");
    schedule(topArmDescend, PATH_BLOCK_RETREAT_MS);
  }

  function endBlock(): void {
    if (blockedPointerId === undefined) return;
    blockedPointerId = undefined;
    if (blockedViaPath) {
      clearTimeout(pathBlockGiveUpTimer);
      // Released before giving up on its own — the gap's open now, so it
      // finishes fast through it, exactly like letting go of a held switch.
      machine.release(RELEASE_SNAP_MS);
      antenna.style.setProperty("--dur", `${RELEASE_SNAP_MS}ms`);
      rocker.style.setProperty(
        "--paddle-dur",
        `${scaleWithPace(PADDLE_FLIP_MS, RELEASE_SNAP_MS)}ms`,
      );
      updateReachOffset();
      settleThenTransition("reach");
      schedule(
        () => retreat(RELEASE_SNAP_MS),
        RELEASE_SNAP_MS + scaleWithPace(CONTACT_HOLD_MS, RELEASE_SNAP_MS),
      );
      return;
    }
    // Arm the real switch-off for when the retaliatory strike actually
    // lands, same idea as endHold()'s RELEASE_SNAP_MS timing.
    machine.release(BLOCK_RETREAT_MS + HIT_BACK_MS);
    antenna.style.setProperty("--dur", `${BLOCK_RETREAT_MS}ms`);
    settleThenTransition("retreat");
    schedule(hitBack, BLOCK_RETREAT_MS);
  }

  // Whether a press at this point falls in the open gap between the
  // antenna's current tip and the switch it's headed for — close enough
  // in x to the switch, and between the two in y — without landing on the
  // antenna itself (that's the direct-grab block above instead). Scoped to
  // the normal (closed-plate) approach; the mirrored backside case isn't
  // covered.
  function withinPathGap(clientX: number, clientY: number): boolean {
    if (!antenna.classList.contains("reach")) return false;
    if (isBackside()) return false;
    const antennaRect = antenna.getBoundingClientRect();
    const rockerRect = rocker.getBoundingClientRect();
    if (
      clientX < rockerRect.left - PATH_GAP_MARGIN_PX ||
      clientX > rockerRect.right + PATH_GAP_MARGIN_PX
    ) {
      return false;
    }
    const top = Math.min(rockerRect.bottom, antennaRect.top);
    const bottom = Math.max(rockerRect.bottom, antennaRect.top);
    return clientY >= top && clientY <= bottom;
  }

  // Ajar, the paddle's relief is mirrored (see the .plate.open rules in
  // style.css) — the half that's actually live to a press mirrors right
  // along with it, so pressing the side that now reads OFF is what turns
  // the switch on.
  function isBackside(): boolean {
    return plate.classList.contains("open");
  }

  // The antenna only ever reaches while the switch is on, headed toward
  // turning it off again — so the side it needs to contact is whichever one
  // is currently live for that: OFF (the CSS default, near the bottom)
  // normally, ON (mirrored, near the top) once the plate's ajar and the
  // paddle relief has flipped. Mirrors the -4.1rem default around the
  // rocker's center rather than deriving it, same hand-tuned contact depth
  // either way.
  const REACH_Y_BACKSIDE = "-9.1rem";

  // Ajar, the switch has also visually swung away from its usual centered
  // rest spot — measured live off the rocker and fed into --reach-x just
  // before the antenna reaches, so it travels to where the switch actually
  // is instead of where it used to be. antenna's own rect is unaffected by
  // its current translateY, so it's a stable stand-in for the closed-plate
  // target even while retreated off-screen.
  function updateReachOffset(): void {
    if (!isBackside()) {
      antenna.style.removeProperty("--reach-x");
      antenna.style.removeProperty("--reach-y");
      return;
    }
    const switchBox = rocker.getBoundingClientRect();
    const restBox = antenna.getBoundingClientRect();
    const offsetPx =
      switchBox.left + switchBox.width / 2 - (restBox.left + restBox.width / 2);
    antenna.style.setProperty("--reach-x", `${offsetPx}px`);
    antenna.style.setProperty("--reach-y", REACH_Y_BACKSIDE);
  }

  // Applies whatever a press/drag to this Y position should do — turning
  // on, turning off, or nothing if it's already sitting on that side. Used
  // for both the initial pointerdown and every pointermove while pressed,
  // so dragging across the midline acts exactly like releasing and
  // freshly pressing at the new position.
  function applyPressAt(clientY: number, pointerId: number): void {
    const rect = rocker.getBoundingClientRect();
    const rawClickedTop = clientY - rect.top < rect.height / 2;
    const clickedTop = isBackside() ? !rawClickedTop : rawClickedTop;
    const isOn = machine.state === "on";
    // only the top half turns it on, only the bottom half turns it off —
    // mirrored while the plate is ajar, per clickedTop above
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
    if (turningOn && isBackside() && !rawClickedTop) {
      unlockEasterEgg("reverse-psychology");
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
    beginBlock(event.pointerId, false);
  });
  stage.addEventListener("pointerdown", (event) => {
    if (blockedPointerId !== undefined) return; // already blocked
    if (holdPointerId !== undefined || engaged) return; // switch-hold in control
    // the antenna and rocker handle presses on themselves elsewhere — this
    // is only for a press that lands in the open gap between them
    if (antenna.contains(event.target as Node)) return;
    if (rocker.contains(event.target as Node)) return;
    if (!withinPathGap(event.clientX, event.clientY)) return;
    beginBlock(event.pointerId, true);
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
    const rawClickedTop = event.clientY - rect.top < rect.height / 2;
    const clickedTop = isBackside() ? !rawClickedTop : rawClickedTop;
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
    if (turningOn && isBackside() && !rawClickedTop) {
      unlockEasterEgg("reverse-psychology");
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
        clearTimeout(pathBlockGiveUpTimer); // switch is off already — no belated top-arm strike
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
    } else if (plate.classList.contains("open")) {
      // the whole point of peeking behind the wall was watching the switch
      // get flipped back — once that's happened there's nothing left to do
      // in there, so the plate closes itself instead of staying ajar. This
      // event fires the instant the antenna makes contact, not once it's
      // actually left again, so closing right away would have the plate
      // swing shut through it — wait for antennaSettled() unless it already
      // is (a real collision, physically, needs the antenna gone first).
      if (antennaSettled()) {
        closePlate();
      } else {
        closePlateOnceSettled = true;
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
