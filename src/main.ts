import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("missing #app root");

app.innerHTML = `
  <button type="button" role="switch" aria-checked="false" aria-label="Switch">
    Switch
  </button>
`;

const machineSwitch = app.querySelector<HTMLButtonElement>("[role=switch]");
if (!machineSwitch) throw new Error("missing switch");

machineSwitch.addEventListener("click", () => {
  if (machineSwitch.getAttribute("aria-checked") === "true") {
    machineSwitch.setAttribute("aria-checked", "false");
    return;
  }
  machineSwitch.setAttribute("aria-checked", "true");
  setTimeout(() => {
    machineSwitch.setAttribute("aria-checked", "false");
  }, 800);
});
