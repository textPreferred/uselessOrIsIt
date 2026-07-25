export interface Achievement {
  id: string;
  title: string;
  description: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
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
];

const STORAGE_KEY = "uselessMachine.achievements";

function loadUnlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set(); // storage unavailable — achievements just won't persist
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
const toastQueue: Achievement[] = [];
let toastShowing = false;

function showNextToast(): void {
  if (toastShowing) return;
  const achievement = toastQueue.shift();
  if (!achievement) return;
  toastShowing = true;

  const overlay = document.createElement("div");
  overlay.className = "achievement-toast";

  const card = document.createElement("div");
  card.className = "achievement-card";

  const eyebrow = document.createElement("p");
  eyebrow.className = "achievement-eyebrow";
  eyebrow.textContent = "Achievement unlocked";

  const title = document.createElement("p");
  title.className = "achievement-title";
  title.textContent = achievement.title;

  const desc = document.createElement("p");
  desc.className = "achievement-desc";
  desc.textContent = achievement.description;

  const hint = document.createElement("p");
  hint.className = "achievement-hint";
  hint.textContent = "Click anywhere to dismiss";

  card.append(eyebrow, title, desc, hint);
  overlay.append(card);
  overlay.addEventListener("click", () => {
    overlay.remove();
    toastShowing = false;
    showNextToast();
  });
  document.body.appendChild(overlay);
}

/** Unlocks an achievement (a no-op if already unlocked) and, if newly
 * unlocked, shows it until the user clicks anywhere on screen. */
export function unlockAchievement(id: string): void {
  if (unlocked.has(id)) return;
  const achievement = ACHIEVEMENTS.find((a) => a.id === id);
  if (!achievement) return;
  unlocked.add(id);
  saveUnlocked(unlocked);
  toastQueue.push(achievement);
  showNextToast();
}
