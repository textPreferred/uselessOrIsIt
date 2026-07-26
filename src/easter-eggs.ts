export interface EasterEgg {
  id: string;
  title: string;
  description: string;
}

export const EASTER_EGGS: readonly EasterEgg[] = [
  {
    id: "beat-the-antenna",
    title: "Have you tried turning it on and off again?",
    description: "Turning the switch off before the antenna does it.",
  },
  {
    id: "top-speed",
    title: "So fast!",
    description: "Reached the machine's top speed.",
  },
  {
    id: "tug-of-war",
    title: "Tug of war",
    description: "They, who are last will be first.",
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
 * dismiss it before it's been seen. */
const DISMISS_GRACE_MS = 500;

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
  hint.textContent = "Click anywhere to dismiss";

  card.append(eyebrow, title, desc, hint);
  overlay.append(card);

  const shownAt = Date.now();
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
