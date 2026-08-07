import { expect, test } from "@playwright/test";
import { clickTop } from "./support";

test.describe("useless machine — OFF and ON labels", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("nudges an untouched OFF label with a one-time peek", async ({
    page,
  }) => {
    const offLabel = page.locator(".label-tape-off");
    await expect(offLabel).not.toHaveClass(/peek/);
    await expect(offLabel).toHaveClass(/peek/, { timeout: 5000 });
  });

  test("grabbing the OFF label cancels the peek nudge", async ({ page }) => {
    const offLabel = page.locator(".label-tape-off");
    const box = await offLabel.boundingBox();
    if (!box) throw new Error("label has no bounding box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    // held well past when the nudge would otherwise have fired
    await page.waitForTimeout(5000);
    await expect(offLabel).not.toHaveClass(/peek/);
  });

  test("spinning the ON label upside down blocks the switch", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const onLabel = page.locator(".label-tape-on");
    await onLabel.click();
    await onLabel.click(); // 2 clicks = 180deg = upside down, reads NO
    await clickTop(machineSwitch);
    // immediate check — the machine's own auto-off would eventually satisfy
    // a retrying "not checked" assertion even if the click wasn't blocked
    expect(await machineSwitch.getAttribute("aria-checked")).toBe("false");
  });

  test("spinning the ON label a full turn reactivates the switch", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const onLabel = page.locator(".label-tape-on");
    await onLabel.click();
    await onLabel.click();
    await onLabel.click();
    await onLabel.click(); // 4 clicks = 360deg = back to normal
    await expect(page.locator(".egg-toast")).toBeHidden();
    await clickTop(machineSwitch);
    await expect(machineSwitch).toBeChecked();
  });

  test("trying the switch while blocked, then succeeding once unblocked, unlocks an easter egg", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const onLabel = page.locator(".label-tape-on");
    await onLabel.click();
    await onLabel.click(); // 2 clicks = upside down, blocked
    await clickTop(machineSwitch); // a real attempt, swallowed
    expect(await machineSwitch.getAttribute("aria-checked")).toBe("false");

    await onLabel.click();
    await onLabel.click(); // back to ON

    await clickTop(machineSwitch);
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "no-means-no",
    );
  });

  test("turning the switch on normally, without ever trying while blocked, doesn't unlock that egg", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const onLabel = page.locator(".label-tape-on");
    await onLabel.click();
    await onLabel.click();
    await onLabel.click();
    await onLabel.click(); // full turn, unblocked throughout

    await clickTop(machineSwitch);
    await expect(machineSwitch).toBeChecked();
    await expect(page.locator(".egg-toast")).toBeHidden();
  });
});
