import { expect, type Locator, test } from "@playwright/test";

/** Only the top half of the rocker turns it on, only the bottom half off. */
async function clickTop(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("switch has no bounding box");
  await locator.click({ position: { x: box.width / 2, y: box.height * 0.25 } });
}

async function clickBottom(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("switch has no bounding box");
  await locator.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
}

test.describe("useless machine", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("shows the machine with its switch off @smoke", async ({ page }) => {
    await expect(page).toHaveTitle(/useless machine/i);
    const machineSwitch = page.getByRole("switch");
    await expect(machineSwitch).toBeVisible();
    await expect(machineSwitch).not.toBeChecked();
  });

  test("turns on when the top half is clicked", async ({ page }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await expect(machineSwitch).toBeChecked();
  });

  test("ignores a click on the wrong half", async ({ page }) => {
    const machineSwitch = page.getByRole("switch");
    await clickBottom(machineSwitch); // already off — bottom half is a no-op
    await expect(machineSwitch).not.toBeChecked();
    await clickTop(machineSwitch);
    await expect(machineSwitch).toBeChecked();
    await clickTop(machineSwitch); // already on — top half is a no-op
    await expect(machineSwitch).toBeChecked();
  });

  test("shows its arm only while switched on", async ({ page }) => {
    const arm = page.getByTestId("arm");
    await expect(arm).toBeHidden();
    await clickTop(page.getByRole("switch"));
    await expect(arm).toBeVisible();
    await expect(arm).toBeHidden({ timeout: 5000 });
  });

  test("flips its own switch back off", async ({ page }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await expect(machineSwitch).toBeChecked();
    await expect(machineSwitch).not.toBeChecked({ timeout: 5000 });
  });

  test("unlocks an achievement for beating the antenna", async ({ page }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // beat the antenna to it
    await expect(page.locator(".achievement-title")).toHaveText(
      /turning it on and off again/i,
    );
  });
});
