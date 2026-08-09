export interface EasterEgg {
  id: string;
  title: string;
  description: string;
}

export const EASTER_EGGS: readonly EasterEgg[] = [
  {
    id: "beat-the-antenna",
    title: "Have you tried turning it on and off again?",
    description: "You did!",
  },
  {
    id: "top-speed",
    title: "Terminal velocity",
    description: "You kept flipping till the machine couldn't go any faster.",
  },
  {
    id: "tug-of-war",
    title: "False retreat",
    description: "It looked like the machine gave up. It didn't.",
  },
  {
    id: "poked-the-antenna",
    title: "Poke the bear",
    description:
      "You grabbed the machine mid-reach. It didn't take it too well.",
  },
  {
    id: "no-means-no",
    title: "No means no — and on means on.",
    description: "You spun the label blocking the switch.",
  },
  {
    id: "behind-the-wall",
    title: "And off they go",
    description: "You found a really useful label.",
  },
  {
    id: "reverse-psychology",
    title: "Reverse psychology",
    description: "You pressed off to turn the machine on.",
  },
  {
    id: "questioning-the-question",
    title: "Questioning the question",
    description: "You juggled some symbols.",
  },
  {
    id: "over-the-top",
    title: "Over the top",
    description: "You literally stood in the way.",
  },
  {
    id: "no-bending-of-space-time",
    title: "Don't mess with space-time.",
    description: "You tried to travel in time.",
  },
  {
    id: "trade-secret",
    title: "Trade secret",
    description: "You found what's inside. It won't be the same thing twice.",
  },
];

/** Description for the reset offer's confirmation card. Not an `EasterEgg`
 * — the offer is UI chrome, not a collectible, so it stays out of
 * `EASTER_EGGS` and never touches the unlocked/seen sets. */
const RESET_OFFER = {
  description: "Set or reset — your choice.",
};

export const STORAGE_KEY = "uselessMachine.easterEggs";
export const SEEN_STORAGE_KEY = "uselessMachine.easterEggsSeen";

function loadIds(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set(); // storage unavailable — easter eggs just won't persist
  }
}

function saveIds(key: string, ids: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable — still works for this session */
  }
}

const KNOWN_EGG_IDS = new Set(EASTER_EGGS.map((egg) => egg.id));

/** Drops IDs that no longer name a current easter egg (e.g. one retired in
 * a later release) and persists the trim. Without this, a stale ID from an
 * old version stays in `unlocked` forever, pushing the found count above
 * `EASTER_EGGS.length` and producing a nonsensical fraction like "10/9". */
function pruneUnknownIds(key: string, ids: Set<string>): Set<string> {
  let changed = false;
  for (const id of ids) {
    if (!KNOWN_EGG_IDS.has(id)) {
      ids.delete(id);
      changed = true;
    }
  }
  if (changed) saveIds(key, ids);
  return ids;
}

const unlocked = pruneUnknownIds(STORAGE_KEY, loadIds(STORAGE_KEY));
// Found eggs the collection view has already shown and been closed on —
// the complement within `unlocked` is what's still "new" and drives the
// "+N" badge instead of the running total.
const seen = pruneUnknownIds(SEEN_STORAGE_KEY, loadIds(SEEN_STORAGE_KEY));
const toastQueue: EasterEgg[] = [];
let toastShowing = false;

function pendingIds(): string[] {
  return [...unlocked].filter((id) => !seen.has(id));
}

/** How many found eggs haven't been viewed in the collection list yet. */
export function pendingEggCount(): number {
  return pendingIds().length;
}

/** Marks every currently-pending egg as seen, collapsing the "+N" badge
 * back into the found/total fraction. Called when the collection view
 * closes, not when it opens, so new eggs stay highlighted for as long as
 * it's open. */
function markPendingSeen(): void {
  const ids = pendingIds();
  if (ids.length === 0) return;
  for (const id of ids) seen.add(id);
  saveIds(SEEN_STORAGE_KEY, seen);
  notifyChanged();
}

const changeListeners: Array<() => void> = [];

/** Notified whenever an egg is unlocked or the collection is reset, so the
 * always-visible collection button can keep its count in sync. */
export function onEggsChanged(listener: () => void): void {
  changeListeners.push(listener);
}

function notifyChanged(): void {
  for (const listener of changeListeners) listener();
}

/** Number of pieces to burst out of a newly-found egg's card. Purely
 * decorative — CSS positions and colors each one via :nth-child. */
const CONFETTI_PIECE_COUNT = 8;

function addConfetti(card: HTMLDivElement): void {
  for (let i = 0; i < CONFETTI_PIECE_COUNT; i++) {
    const piece = document.createElement("span");
    piece.className = "egg-confetti-piece";
    card.appendChild(piece);
  }
}

/** Builds the reset offer's confirmation card: description only, no eyebrow
 * or title — it's a plain confirmation prompt, not a collectible, so
 * there's no confetti and neither button below ever unlocks anything. */
function buildResetOfferHeader(): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "egg-card";

  const desc = document.createElement("p");
  desc.className = "egg-desc";
  desc.textContent = RESET_OFFER.description;

  card.append(desc);
  return card;
}

/** Builds the plain discovery toast's card: a visual indicator only — no
 * title or description on screen, so the reveal happens later in the
 * collection view instead of spoiling it on the spot. */
function buildEggFoundCard(): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "egg-card egg-card-minimal";

  const icon = document.createElement("div");
  icon.className = "egg-found-icon";
  icon.setAttribute("role", "img");
  icon.setAttribute("aria-label", "Easter egg found");
  icon.textContent = "✨";

  card.append(icon);
  addConfetti(card);
  return card;
}

/** How long the plain discovery toast stays up before it removes itself —
 * no click needed. */
const AUTO_DISMISS_MS = 1000;

/** How long the toast takes to fly and shrink into the collection button.
 * Must match the transition duration on `.egg-card-morph` in style.css. */
const MORPH_DURATION_MS = 300;

/** Sends the toast's card flying and shrinking toward the collection
 * button rather than just vanishing, so the find visibly lands where it'll
 * live from now on. Skipped (returns false) under reduced motion, or if the
 * button isn't in the DOM yet for some reason — either way the caller just
 * dismisses the toast immediately instead. */
function morphIntoCollectionButton(
  overlay: HTMLDivElement,
  card: HTMLDivElement,
): boolean {
  const target = document.querySelector(".egg-collection-toggle");
  if (!target || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }

  const from = card.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  card.style.setProperty(
    "--morph-x",
    `${to.left + to.width / 2 - (from.left + from.width / 2)}px`,
  );
  card.style.setProperty(
    "--morph-y",
    `${to.top + to.height / 2 - (from.top + from.height / 2)}px`,
  );
  card.style.setProperty("--morph-scale", `${to.width / from.width}`);
  card.classList.add("egg-card-morph");
  overlay.classList.add("egg-toast-morphing");
  return true;
}

function showNextToast(): void {
  if (toastShowing) return;
  const egg = toastQueue.shift();
  if (!egg) return;
  toastShowing = true;

  const overlay = document.createElement("div");
  overlay.className = "egg-toast";
  overlay.dataset.eggId = egg.id;
  const card = buildEggFoundCard();
  overlay.append(card);
  document.body.appendChild(overlay);

  setTimeout(() => {
    const morphing = morphIntoCollectionButton(overlay, card);
    setTimeout(
      () => {
        overlay.remove();
        toastShowing = false;
        // fires only once the toast has visibly landed on the collection
        // button, so it appears (and its count ticks up) right as the find
        // arrives there instead of popping in at the start
        notifyChanged();
        showNextToast();
      },
      morphing ? MORPH_DURATION_MS : 0,
    );
  }, AUTO_DISMISS_MS);
}

/** Unlocks an easter egg (a no-op if already unlocked) and, if newly
 * unlocked, briefly shows the discovery toast. */
export function unlockEasterEgg(id: string): void {
  if (unlocked.has(id)) return;
  const egg = EASTER_EGGS.find((e) => e.id === id);
  if (!egg) return;
  unlocked.add(id);
  saveIds(STORAGE_KEY, unlocked);
  toastQueue.push(egg);
  showNextToast();
}

/** Whether the given egg has been found. */
export function isEggUnlocked(id: string): boolean {
  return unlocked.has(id);
}

/** How many eggs (out of `EASTER_EGGS.length`) have been found so far. */
export function unlockedEggCount(): number {
  return unlocked.size;
}

/** Found by clicking all four screws clockwise from the top-left. Offers to
 * wipe every unlocked egg so they're all up for grabs again. Neither button
 * unlocks anything — this offer is UI chrome, not an egg of its own. */
export function offerEasterEggReset(): void {
  const overlay = document.createElement("div");
  overlay.className = "egg-toast egg-toast-confirm";

  const card = buildResetOfferHeader();

  const actions = document.createElement("div");
  actions.className = "egg-actions";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "egg-button egg-button-reset";
  resetButton.textContent = "Yes, reset my easter eggs";
  resetButton.addEventListener("click", () => {
    unlocked.clear();
    seen.clear();
    saveIds(STORAGE_KEY, unlocked);
    saveIds(SEEN_STORAGE_KEY, seen);
    notifyChanged();
    overlay.remove();
  });

  const keepButton = document.createElement("button");
  keepButton.type = "button";
  keepButton.className = "egg-button egg-button-keep";
  keepButton.textContent = "Don't reset my easter eggs.";
  keepButton.addEventListener("click", () => {
    overlay.remove();
  });

  actions.append(resetButton, keepButton);
  card.append(actions);
  overlay.append(card);
  document.body.appendChild(overlay);
}

/** Opens the collection view: every egg found so far, with its title and
 * description finally revealed. Nothing here hints at what's still
 * missing — no count, no locked placeholders — so a find stays visible any
 * time, not just in the toast that announced it. */
function renderEggCollection(): void {
  // Snapshotted once up front: eggs found since the view was last closed
  // stay on top and highlighted for this whole viewing, even once closing
  // it marks them seen for next time.
  const newIds = new Set(pendingIds());

  const overlay = document.createElement("div");
  overlay.className = "egg-toast egg-collection-overlay";

  function closeCollection(): void {
    markPendingSeen();
    overlay.remove();
  }

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeCollection();
  });

  const card = document.createElement("div");
  card.className = "egg-card egg-collection-card";

  const eyebrow = document.createElement("p");
  eyebrow.className = "egg-eyebrow";
  eyebrow.textContent = "Easter eggs found";

  if (unlockedEggCount() === EASTER_EGGS.length) {
    const allFound = document.createElement("p");
    allFound.className = "egg-all-found";
    allFound.textContent = "All found!";
    card.append(eyebrow, allFound);
  } else {
    card.append(eyebrow);
  }

  const list = document.createElement("ul");
  list.className = "egg-collection-list";
  const found = EASTER_EGGS.filter((egg) => isEggUnlocked(egg.id));
  const ordered = [
    ...found.filter((egg) => newIds.has(egg.id)),
    ...found.filter((egg) => !newIds.has(egg.id)),
  ];
  for (const egg of ordered) {
    const item = document.createElement("li");
    item.className = "egg-collection-item";
    item.classList.toggle("egg-collection-item-new", newIds.has(egg.id));

    const title = document.createElement("p");
    title.className = "egg-title";
    title.textContent = egg.title;

    const desc = document.createElement("p");
    desc.className = "egg-desc";
    desc.textContent = egg.description;

    item.append(title, desc);
    list.append(item);
  }

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "egg-button egg-button-keep egg-collection-close";
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", closeCollection);

  card.append(list, closeButton);
  overlay.append(card);
  document.body.appendChild(overlay);
}

/** Mounts the collection button (and its found-count) into `parent`, hidden
 * until the first egg is found. Before every egg is found, the count shows
 * the found/total fraction, e.g. "2/8" — unless eggs are still pending
 * (found but not yet viewed in the collection), in which case the badge
 * shows "+N" for those instead. Once the last egg lands, the badge switches
 * to "All found" immediately, overriding any still-pending "+N" — there's
 * nothing left to reveal by opening the collection, so no reason to make
 * that wait. Tapping the button opens the collection view; closing it
 * settles "+N" back into the fraction. Visibility and count stay in sync
 * via `onEggsChanged`. */
export function mountEggCollectionButton(parent: HTMLElement): void {
  const wrapper = document.createElement("div");
  wrapper.className = "egg-collection-widget";

  const count = document.createElement("span");
  count.className = "egg-collection-count";
  count.setAttribute("aria-hidden", "true");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "egg-collection-toggle";

  const icon = document.createElement("span");
  icon.className = "egg-collection-toggle-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "✨";
  button.append(icon);

  function updateVisibility(): void {
    const found = unlockedEggCount();
    const pending = pendingEggCount();
    const total = EASTER_EGGS.length;
    const allFound = found === total;
    wrapper.classList.toggle("egg-collection-widget-revealed", found > 0);
    count.classList.toggle("egg-collection-count-complete", allFound);
    count.classList.toggle(
      "egg-collection-count-pending",
      pending > 0 && !allFound,
    );
    count.textContent = allFound
      ? "All found"
      : pending > 0
        ? `+${pending}`
        : `${found}/${total}`;
    button.setAttribute(
      "aria-label",
      allFound
        ? "View found easter eggs (all found)"
        : pending > 0
          ? `View found easter eggs (${pending} new)`
          : `View found easter eggs (${found} of ${total})`,
    );
  }
  updateVisibility();
  onEggsChanged(updateVisibility);

  button.addEventListener("click", renderEggCollection);
  wrapper.append(button, count);
  parent.append(wrapper);
}
