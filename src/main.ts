import cablesUrl from "./assets/mechanisms/cables.jpg";
import circuitUrl from "./assets/mechanisms/circuit.jpg";
import gearsUrl from "./assets/mechanisms/gears.jpg";
import pipesUrl from "./assets/mechanisms/pipes.jpg";
import { createMachine } from "./machine";
import "./style.css";
import { currentContactDelayMs, type Mechanism, renderMachine } from "./ui";

// Stock photos behind the peeled wall label. gears is a Pexels photo,
// credited though the license doesn't require it: George Piskov. cables,
// circuit, and pipes were swapped in from user-supplied images.
const mechanisms: readonly Mechanism[] = [
  { id: "cables", url: cablesUrl },
  { id: "gears", url: gearsUrl },
  { id: "circuit", url: circuitUrl },
  { id: "pipes", url: pipesUrl },
];

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("missing #app root");

renderMachine(
  app,
  createMachine({ armDelayMs: currentContactDelayMs }),
  mechanisms,
);
