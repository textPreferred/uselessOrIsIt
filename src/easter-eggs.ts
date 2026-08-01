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

/** Clicks land within this window of the toast appearing are ignored, so the
 * reflexive click that often follows triggering an egg can't instantly
 * dismiss it before it's been seen. Counted down visibly in the hint text. */
const DISMISS_GRACE_MS = 3000;

function showNextToast(): void {
  if (toastShowing) return;
  const egg = toastQueue.shift();
  if (!egg) return;
  toastShowing = true;

  const overlay = document.createElement("div");
  overlay.className = "egg-toast";

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

  const hint = document.createElement("p");
  hint.className = "egg-hint";

  card.append(eyebrow, title, desc, hint);
  overlay.append(card);

  const shownAt = Date.now();
  function updateHint(): void {
    const remainingS = Math.max(
      0,
      Math.ceil((shownAt + DISMISS_GRACE_MS - Date.now()) / 1000),
    );
    hint.textContent =
      remainingS > 0 ? `Wait ${remainingS}s…` : "Click anywhere to dismiss";
    if (remainingS <= 0) clearInterval(tickTimer);
  }
  updateHint();
  const tickTimer = setInterval(updateHint, 250);

  overlay.addEventListener("click", () => {
    if (Date.now() - shownAt < DISMISS_GRACE_MS) return;
    overlay.remove();
    toastShowing = false;
    showNextToast();
  });
  document.body.appendChild(overlay);
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

  const actions = document.createElement("div");
  actions.className = "egg-actions";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "egg-button egg-button-reset";
  resetButton.textContent = "Yes, reset my easter eggs";
  resetButton.addEventListener("click", () => {
    unlocked.clear();
    saveUnlocked(unlocked);
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
  card.append(eyebrow, title, desc, actions);
  overlay.append(card);
  document.body.appendChild(overlay);
}
