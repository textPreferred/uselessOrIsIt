import { createMachine } from "./machine";
import "./style.css";
import { CONTACT_DELAY_MS, renderMachine } from "./ui";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("missing #app root");

renderMachine(app, createMachine({ armDelayMs: CONTACT_DELAY_MS }));
