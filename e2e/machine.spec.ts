import { expect, test } from "@playwright/test";

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

  test("turns on when the switch is flipped", async ({ page }) => {
    const machineSwitch = page.getByRole("switch");
    await machineSwitch.click();
    await expect(machineSwitch).toBeChecked();
  });

  test("shows its arm only while switched on", async ({ page }) => {
    const arm = page.getByTestId("arm");
    await expect(arm).toBeHidden();
    await page.getByRole("switch").click();
    await expect(arm).toBeVisible();
    await expect(arm).toBeHidden({ timeout: 5000 });
  });

  test("flips its own switch back off @smoke", async ({ page }) => {
    const machineSwitch = page.getByRole("switch");
    await machineSwitch.click();
    await expect(machineSwitch).toBeChecked();
    await expect(machineSwitch).not.toBeChecked({ timeout: 5000 });
  });
});
