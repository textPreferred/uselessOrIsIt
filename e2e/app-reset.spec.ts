import { expect, test } from "@playwright/test";
import { clickScrewsClockwise, clickTop, dragBy, dragOnto } from "./support";

test.describe("useless machine — resetting easter eggs resets the whole app", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("confirming the reset also returns labels to their default orientation and location", async ({
    page,
  }) => {
    // a lot of setup, plus a real page reload at the end — comfortably past
    // the default 30s on a slow sandboxed browser (see plate.spec.ts's own
    // reload tests for the same allowance)
    test.setTimeout(60000);
    const onLabel = page.locator(".label-tape-on");
    const offLabel = page.locator(".label-tape-off");
    const wallLabel = page.locator(".wall-tape-group");
    const machineSwitch = page.getByRole("switch");

    // spin the ON label upside down — blocks the switch until undone
    await onLabel.click();
    await onLabel.click();

    // open the plate so the wall panel behind it is reachable
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    // peel the wall tape and cycle past the first mechanism photo
    await dragBy(page, wallLabel, 100, -100);
    await expect(wallLabel).toHaveClass(/peeled/);
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    const panel = page.locator(".wall-panel");
    await dragBy(page, panel, 80, 0);
    await expect(page.locator(".wall-panel-img")).toHaveAttribute(
      "data-mechanism",
      "circuit",
    );
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "inner-workings",
    );
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    // close the plate again — a real-coordinate click is unreliable mid-3D-
    // rotation, so this dispatches the click directly, same as plate.spec.ts
    await page.locator(".plate").evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator(".plate")).not.toHaveClass(/open/);
    // let the closing swing (and the screws' own re-reveal transition)
    // finish before clicking them — same settle wait dragBy/dragOnto give
    // their own drags elsewhere in this suite
    await page.waitForTimeout(350);

    await clickScrewsClockwise(page);
    await page.getByRole("button", { name: "Yes, reset the app" }).click();

    // confirming reloads the page — Playwright's own auto-retrying locators
    // ride out the navigation, so there's nothing to explicitly await here
    await expect(page.getByRole("switch")).toBeVisible({ timeout: 30000 });

    // ON label back to normal — the switch isn't blocked anymore
    await clickTop(machineSwitch);
    await expect(machineSwitch).toBeChecked();

    // wall tape re-covers the panel, showing the first mechanism again
    await expect(page.locator(".wall-tape-group")).not.toHaveClass(/peeled/);
    await expect(page.locator(".wall-panel-img")).toHaveAttribute(
      "data-mechanism",
      "cables",
    );
  });
});
