import {
  mountEggCollectionButton,
  offerEasterEggReset,
  unlockEasterEgg,
} from "./easter-eggs";
import type { Machine } from "./machine";

/** One mechanism photo behind the peeled wall label. Images themselves are
 * wired in from main.ts, not imported here — e2e specs import named exports
 * straight from this module under plain Node/ESM, which has no loader for
 * raw `.jpg` files the way Vite's build does; keeping this module free of
 * asset imports keeps it importable there. */
export interface Mechanism {
  id: string;
  url: string;
}

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

// The wall tape peels the same general way the OFF label does — dragged,
// following the pointer — but its outcome is a permanent toggle rather than
// an always-elastic pull: short of this distance it springs back like an
// unfinished OFF-label drag; past it, release locks the tape peeled for
// good, more like backing out a screw. Same order of magnitude as the
// screw catch radii above.
const WALL_LABEL_PEEL_THRESHOLD_PX = 70;
// Once peeled, swiping the revealed panel just cycles to the next mechanism
// photo — a much smaller ask than fully peeling the tape, since there's
// nothing left to spring back to either way a swipe goes.
const PANEL_SWIPE_THRESHOLD_PX = 40;

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

const WALL_LABEL_STORAGE_KEY = "uselessMachine.wallLabel";
interface WallLabelState {
  peeled: boolean;
  mechanism: number;
}
const DEFAULT_WALL_LABEL_STATE: WallLabelState = {
  peeled: false,
  mechanism: 0,
};

function loadWallLabel(): WallLabelState {
  try {
    const raw = localStorage.getItem(WALL_LABEL_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WALL_LABEL_STATE };
    const saved = JSON.parse(raw) as Partial<WallLabelState>;
    return { ...DEFAULT_WALL_LABEL_STATE, ...saved };
  } catch {
    return { ...DEFAULT_WALL_LABEL_STATE }; // storage unavailable — wall label just won't persist
  }
}

function saveWallLabel(state: WallLabelState): void {
  try {
    localStorage.setItem(WALL_LABEL_STORAGE_KEY, JSON.stringify(state));
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

export function renderMachine(
  root: HTMLElement,
  machine: Machine,
  mechanisms: readonly Mechanism[],
): void {
  root.innerHTML = `
    <div class="stage">
      <div class="wall-panel" aria-hidden="true">
        <div class="wall-panel-glass">
          <img class="wall-panel-img" alt="" src="${mechanisms[0].url}" data-mechanism="${mechanisms[0].id}" />
        </div>
      </div>
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
  const wallTapeGroup = mustFind<HTMLDivElement>(root, ".wall-tape-group");
  const wallPanel = mustFind<HTMLDivElement>(root, ".wall-panel");
  const wallPanelImg = mustFind<HTMLImageElement>(root, ".wall-panel-img");
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
  const VERSION_DRAG_STEP_PX = 5;
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

  // The wall tape itself peels the same way — dragged, following the
  // pointer via its own CSS custom properties — but it's covered by the
  // closed plate the same way the screws and front labels are (see the
  // z-index/DOM-order comment above .wall-tape-group in style.css), so
  // there's nothing extra to gate here: a closed plate already sits on top
  // of it and swallows the pointer events. Persisted so a peeled label (and
  // whichever mechanism it's showing) stays that way across a reload, like
  // the screws it otherwise mirrors.
  const wallLabel: WallLabelState = loadWallLabel();

  function renderWallLabel(): void {
    wallTapeGroup.classList.toggle("peeled", wallLabel.peeled);
    const mechanism = mechanisms[wallLabel.mechanism] ?? mechanisms[0];
    wallPanelImg.src = mechanism.url;
    wallPanelImg.dataset.mechanism = mechanism.id;
    saveWallLabel(wallLabel);
  }
  renderWallLabel(); // reflect whatever was loaded before any interaction

  let wallDragPointerId: number | undefined;
  let wallDragStartX = 0;
  let wallDragStartY = 0;

  wallTapeGroup.addEventListener("pointerdown", (event) => {
    if (wallLabel.peeled) return; // already locked open — nothing left to drag
    wallDragPointerId = event.pointerId;
    wallTapeGroup.setPointerCapture(event.pointerId);
    wallTapeGroup.classList.add("grabbed");
    wallDragStartX = event.clientX;
    wallDragStartY = event.clientY;
  });
  wallTapeGroup.addEventListener("pointermove", (event) => {
    if (event.pointerId !== wallDragPointerId) return;
    wallTapeGroup.style.setProperty(
      "--wall-drag-x",
      `${event.clientX - wallDragStartX}px`,
    );
    wallTapeGroup.style.setProperty(
      "--wall-drag-y",
      `${event.clientY - wallDragStartY}px`,
    );
  });
  function endWallDrag(event: PointerEvent): void {
    if (event.pointerId !== wallDragPointerId) return;
    wallDragPointerId = undefined;
    wallTapeGroup.classList.remove("grabbed");
    const distance = Math.hypot(
      event.clientX - wallDragStartX,
      event.clientY - wallDragStartY,
    );
    wallTapeGroup.style.removeProperty("--wall-drag-x");
    wallTapeGroup.style.removeProperty("--wall-drag-y");
    if (distance >= WALL_LABEL_PEEL_THRESHOLD_PX) {
      wallLabel.peeled = true;
      renderWallLabel();
    }
    // short of the threshold: clearing the drag vars above is enough to
    // spring it back to rest — same as releasing an unfinished OFF-label
    // drag, no separate "not peeled" render needed
  }
  wallTapeGroup.addEventListener("pointerup", endWallDrag);
  wallTapeGroup.addEventListener("pointercancel", endWallDrag);

  // Once peeled, a horizontal swipe on the revealed panel cycles to the
  // next mechanism photo — like a carousel: the port frame itself never
  // moves, only the photo does, dragged 1:1 with the pointer via
  // --img-drag-x on .wall-panel-img (not .wall-panel — that stays put).
  // Direction doesn't matter for *which* photo comes next — any swipe
  // past the threshold just advances, looping forever — but it does
  // decide which way the photo slides out and the next one slides in
  // from, so the motion still tracks the swipe.
  let panelDragPointerId: number | undefined;
  let panelDragStartX = 0;
  // Set while a completed swipe's slide-out is still animating, so a
  // fresh grab before it finishes can cancel the stale callback instead
  // of leaving it to fire later with an outdated direction.
  let mechanismSlideHandler: (() => void) | undefined;

  wallPanel.addEventListener("pointerdown", (event) => {
    if (!wallLabel.peeled) return; // nothing to see yet
    if (mechanismSlideHandler) {
      wallPanelImg.removeEventListener("transitionend", mechanismSlideHandler);
      mechanismSlideHandler = undefined;
    }
    panelDragPointerId = event.pointerId;
    wallPanel.setPointerCapture(event.pointerId);
    wallPanel.classList.add("grabbed");
    panelDragStartX = event.clientX;
  });
  wallPanel.addEventListener("pointermove", (event) => {
    if (event.pointerId !== panelDragPointerId) return;
    wallPanelImg.style.setProperty(
      "--img-drag-x",
      `${event.clientX - panelDragStartX}px`,
    );
  });
  function endPanelDrag(event: PointerEvent): void {
    if (event.pointerId !== panelDragPointerId) return;
    panelDragPointerId = undefined;
    wallPanel.classList.remove("grabbed");
    const dx = event.clientX - panelDragStartX;
    if (Math.abs(dx) < PANEL_SWIPE_THRESHOLD_PX) {
      wallPanelImg.style.removeProperty("--img-drag-x"); // spring back to center
      return;
    }
    const direction = dx > 0 ? 1 : -1;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      wallPanelImg.style.removeProperty("--img-drag-x");
      wallLabel.mechanism = (wallLabel.mechanism + 1) % mechanisms.length;
      renderWallLabel();
      unlockEasterEgg("inner-workings");
      return;
    }
    // Finish the drag's own slide the rest of the way off-frame; once
    // that transition lands, swap in the next photo positioned just off
    // the opposite edge and transition it back to center — the same
    // "reset off-screen, then animate in" trick a carousel uses to loop
    // a single element rather than keeping every slide in the DOM.
    //
    // The next photo is preloaded in parallel with the slide-out below so
    // it's decoded and cache-ready by the time the swap happens — without
    // this, setting wallPanelImg.src at swap time paints the still-loading
    // old bitmap for a frame or two, which reads as the old photo briefly
    // reappearing before the new one pops in mid-animation.
    const nextIndex = (wallLabel.mechanism + 1) % mechanisms.length;
    const nextMechanism = mechanisms[nextIndex] ?? mechanisms[0];
    const preload = new Image();
    preload.src = nextMechanism.url;

    wallPanelImg.style.setProperty("--img-drag-x", `${direction * 100}%`);
    mechanismSlideHandler = () => {
      mechanismSlideHandler = undefined;
      const slideIn = () => {
        wallLabel.mechanism = nextIndex;
        renderWallLabel();
        unlockEasterEgg("inner-workings");
        wallPanelImg.style.transition = "none";
        wallPanelImg.style.setProperty("--img-drag-x", `${-direction * 100}%`);
        void wallPanelImg.offsetWidth; // force reflow so the jump above isn't itself animated
        wallPanelImg.style.transition = "";
        wallPanelImg.style.setProperty("--img-drag-x", "0px");
      };
      if (preload.complete) {
        slideIn();
      } else {
        preload.addEventListener("load", slideIn, { once: true });
      }
    };
    wallPanelImg.addEventListener("transitionend", mechanismSlideHandler, {
      once: true,
    });
  }
  wallPanel.addEventListener("pointerup", endPanelDrag);
  wallPanel.addEventListener("pointercancel", endPanelDrag);

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

  function beginBlock(
    pointerId: number,
    viaPath: boolean,
    blockClientY?: number,
  ): void {
    blockedPointerId = pointerId;
    blockedViaPath = viaPath;
    machine.hold();
    cancelSequence(); // cancel whatever retreat/hit-back was scheduled next
    if (viaPath && blockClientY !== undefined) {
      awaitPathArrival(pointerId, blockClientY);
    } else {
      freezeIntoBlocked();
    }
  }

  function freezeIntoBlocked(): void {
    settleThenTransition("blocked", (frozenTransform) => {
      const { x, y } = translationOf(frozenTransform);
      antenna.style.setProperty("--block-x", `${x}px`);
      antenna.style.setProperty("--block-y", `${y}px`);
    });
    if (blockedViaPath) {
      pathBlockGiveUpTimer = setTimeout(pathBlockGiveUp, PATH_BLOCK_GIVEUP_MS);
    }
  }

  // A path block lands in the open gap ahead of the tip, not on the antenna
  // itself — so rather than yanking it to a stop right where the finger
  // first touched down, let its existing approach keep gliding until the
  // tip actually reaches the finger's height, then freeze it there. Polled
  // per frame against the antenna's own live position rather than computed
  // once up front, since it's already mid-transition and its exact path is
  // easiest to read straight off the DOM.
  function awaitPathArrival(pointerId: number, blockClientY: number): void {
    const check = () => {
      if (blockedPointerId !== pointerId) return; // released before arrival
      if (antenna.getBoundingClientRect().top <= blockClientY) {
        freezeIntoBlocked();
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
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
    beginBlock(event.pointerId, true, event.clientY);
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
