import cablesUrl from "./assets/mechanisms/cables.jpg";
import circuitUrl from "./assets/mechanisms/circuit.jpg";
import conveyorUrl from "./assets/mechanisms/conveyor.jpg";
import driveUrl from "./assets/mechanisms/drive.jpg";
import gearsUrl from "./assets/mechanisms/gears.jpg";
import leversUrl from "./assets/mechanisms/levers.jpg";
import pipesUrl from "./assets/mechanisms/pipes.jpg";
import { createMachine } from "./machine";
import "./style.css";
import { currentContactDelayMs, type Mechanism, renderMachine } from "./ui";

// Stock photos behind the peeled wall label. gears is a Pexels photo,
// credited though the license doesn't require it: George Piskov. The
// rest — cables, circuit, pipes, levers, conveyor, drive — were
// swapped/added from user-supplied images.
const mechanisms: readonly Mechanism[] = [
  { id: "cables", url: cablesUrl },
  { id: "gears", url: gearsUrl },
  { id: "circuit", url: circuitUrl },
  { id: "pipes", url: pipesUrl },
  { id: "levers", url: leversUrl },
  { id: "conveyor", url: conveyorUrl },
  { id: "drive", url: driveUrl },
];

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("missing #app root");

renderMachine(
  app,
  createMachine({ armDelayMs: currentContactDelayMs }),
  mechanisms,
);
