export type MachineState = "off" | "on";

export type MachineEvent =
  | { type: "switched-on" }
  | { type: "switched-off"; by: "machine" | "user" };

type Listener = (event: MachineEvent) => void;

export interface MachineOptions {
  /** How long the machine waits before flipping the switch back off. Called
   * fresh on each flip so the delay can change over time. */
  armDelayMs?: number | (() => number);
}

export interface Machine {
  readonly state: MachineState;
  /** Subscribe to machine events; returns an unsubscribe function. */
  onEvent(listener: Listener): () => void;
  /** A press of the switch, from either direction. */
  flip(): void;
  /** Freezes the machine's own switch-off countdown. A no-op while off or
   * already held. */
  hold(): void;
  /** Resumes a countdown frozen by hold(), arming it to fire after delayMs.
   * A no-op if not currently held. */
  release(delayMs: number): void;
}

export function createMachine({
  armDelayMs = 800,
}: MachineOptions = {}): Machine {
  let state: MachineState = "off";
  let armTimer: ReturnType<typeof setTimeout> | undefined;
  let held = false;
  const listeners = new Set<Listener>();

  function emit(event: MachineEvent): void {
    for (const listener of listeners) listener(event);
  }

  function switchOff(by: "machine" | "user"): void {
    clearTimeout(armTimer);
    armTimer = undefined;
    held = false;
    state = "off";
    emit({ type: "switched-off", by });
  }

  function arm(delay: number): void {
    armTimer = setTimeout(() => switchOff("machine"), delay);
  }

  return {
    get state() {
      return state;
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    flip() {
      if (state === "on") {
        switchOff("user");
        return;
      }
      state = "on";
      emit({ type: "switched-on" });
      const delay =
        typeof armDelayMs === "function" ? armDelayMs() : armDelayMs;
      arm(delay);
    },
    hold() {
      if (state !== "on" || held) return;
      held = true;
      clearTimeout(armTimer);
      armTimer = undefined;
    },
    release(delayMs) {
      if (state !== "on" || !held) return;
      held = false;
      arm(delayMs);
    },
  };
}
