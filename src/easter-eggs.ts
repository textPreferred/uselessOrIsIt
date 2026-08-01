export interface EasterEgg {
  id: string;
  title: string;
  description: string;
}

export const ANTI_EASTER_EGG_ID = "anti-easter-egg";

export const EASTER_EGGS: readonly EasterEgg[] = [
  {
    id: "beat-the-antenna",
    title: "Have you tried turning it on and off again?",
    description: "Why did you turn it on in the first place?",
  },
  {
    id: "top-speed",
    title: "So fast!",
    description: "You reached a limit.",
  },
  {
    id: "tug-of-war",
    title: "Tug of war",
    description: "Who is useful, here?",
  },
  {
    id: "poked-the-antenna",
    title: "You're in the way",
    description: "Why block it if you set it going?",
  },
  {
    id: "no-means-no",
    title: "No means no",
    description: "And on means on.",
  },
  {
    id: "behind-the-wall",
    title: "And off they go",
    description: "Useful label?",
  },
  {
    id: "reverse-psychology",
    title: "Reverse psychology",
    description: "OFF said no. Turns out it meant yes.",
  },
  {
    id: ANTI_EASTER_EGG_ID,
    title: "Anti-Easter Egg",
    description: "Delete all easter eggs, so I can start over.",
  },
];

const STORAGE_KEY = "uselessMachine.easterEggs";

function loadUnlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set(); // storage unavailable — easter eggs just won't persist
  }
}

function saveUnlocked(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable — still works for this session */
  }
}

const unlocked = loadUnlocked();
const toastQueue: EasterEgg[] = [];
let toastShowing = false;

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

/** Builds the eyebrow/title/desc header shared by cards that need the user
 * to actually read them (the anti-easter-egg's reset confirmation). */
function buildEggCardHeader(egg: EasterEgg): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "egg-card";

  const eyebrow = document.createElement("p");
  eyebrow.className = "egg-eyebrow";
  eyebrow.textContent = "Easter egg found";

  const title = document.createElement("p");
  title.className = "egg-title";
  title.textContent = egg.title;

  const desc = document.createElement("p");
  desc.className = "egg-desc";
  desc.textContent = egg.description;

  card.append(eyebrow, title, desc);
  addConfetti(card);
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

  card.append(icon);
  addConfetti(card);
  return card;
}

/** How long the plain discovery toast stays up before it removes itself —
 * no click needed. */
const AUTO_DISMISS_MS = 1000;

function showNextToast(): void {
  if (toastShowing) return;
  const egg = toastQueue.shift();
  if (!egg) return;
  toastShowing = true;

  const overlay = document.createElement("div");
  overlay.className = "egg-toast";
  overlay.dataset.eggId = egg.id;
  overlay.append(buildEggFoundCard());
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.remove();
    toastShowing = false;
    showNextToast();
  }, AUTO_DISMISS_MS);
}

/** Unlocks an easter egg (a no-op if already unlocked) and, if newly
 * unlocked, shows it until the user clicks anywhere on screen. */
export function unlockEasterEgg(id: string): void {
  if (unlocked.has(id)) return;
  const egg = EASTER_EGGS.find((e) => e.id === id);
  if (!egg) return;
  unlocked.add(id);
  saveUnlocked(unlocked);
  toastQueue.push(egg);
  showNextToast();
  notifyChanged();
}

/** Whether the given egg has been found. */
export function isEggUnlocked(id: string): boolean {
  return unlocked.has(id);
}

/** How many eggs (out of `EASTER_EGGS.length`) have been found so far. */
export function unlockedEggCount(): number {
  return unlocked.size;
}

/** The anti-easter-egg: found by clicking all four screws clockwise from the
 * top-left. Offers to wipe every unlocked egg (this one included) so they're
 * all up for grabs again, rather than just unlocking on discovery like the
 * others — declining collects it normally instead. */
export function offerEasterEggReset(): void {
  const egg = EASTER_EGGS.find((e) => e.id === ANTI_EASTER_EGG_ID);
  if (!egg) return;

  const overlay = document.createElement("div");
  overlay.className = "egg-toast egg-toast-confirm";

  const card = buildEggCardHeader(egg);

  const actions = document.createElement("div");
  actions.className = "egg-actions";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "egg-button egg-button-reset";
  resetButton.textContent = "Yes, reset my easter eggs";
  resetButton.addEventListener("click", () => {
    unlocked.clear();
    saveUnlocked(unlocked);
    notifyChanged();
    overlay.remove();
  });

  const keepButton = document.createElement("button");
  keepButton.type = "button";
  keepButton.className = "egg-button egg-button-keep";
  keepButton.textContent =
    "Don't reset my easter eggs, but collect this one anyway.";
  keepButton.addEventListener("click", () => {
    overlay.remove();
    unlockEasterEgg(ANTI_EASTER_EGG_ID);
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
  const overlay = document.createElement("div");
  overlay.className = "egg-toast egg-collection-overlay";
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });

  const card = document.createElement("div");
  card.className = "egg-card egg-collection-card";

  const eyebrow = document.createElement("p");
  eyebrow.className = "egg-eyebrow";
  eyebrow.textContent = "Easter eggs found";

  const list = document.createElement("ul");
  list.className = "egg-collection-list";
  for (const egg of EASTER_EGGS) {
    if (!isEggUnlocked(egg.id)) continue;

    const item = document.createElement("li");
    item.className = "egg-collection-item";

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
  closeButton.addEventListener("click", () => overlay.remove());

  card.append(eyebrow, list, closeButton);
  overlay.append(card);
  document.body.appendChild(overlay);
}

/** Mounts the collection button into `parent`, hidden until the first egg
 * is found — an icon only, no count. Tapping it opens the collection view.
 * Visibility stays in sync via `onEggsChanged`. */
export function mountEggCollectionButton(parent: HTMLElement): void {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "egg-collection-toggle";
  button.setAttribute("aria-label", "View found easter eggs");

  const icon = document.createElement("span");
  icon.className = "egg-collection-toggle-icon";
  icon.setAttribute("aria-hidden", "true");
  button.append(icon);

  function updateVisibility(): void {
    button.hidden = unlockedEggCount() === 0;
  }
  updateVisibility();
  onEggsChanged(updateVisibility);

  button.addEventListener("click", renderEggCollection);
  parent.append(button);
}
