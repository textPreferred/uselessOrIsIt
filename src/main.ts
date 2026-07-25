import { createMachine } from "./machine";
import "./style.css";
import { renderMachine } from "./ui";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("missing #app root");

renderMachine(app, createMachine());
