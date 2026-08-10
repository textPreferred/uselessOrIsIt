import { expect, test } from "@playwright/test";
import { BASE_CONTACT_DELAY_MS } from "../src/ui";
import { beginPathBlock, clickTop } from "./support";

test.describe("useless machine — blocking the antenna's path", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("blocking the antenna holds the machine on until released", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const arm = page.getByTestId("arm");
    await clickTop(machineSwitch);

    // near the end of its approach, safely on-screen, still short of contact
    await page.waitForTimeout(BASE_CONTACT_DELAY_MS - 200);
    const box = await arm.boundingBox();
    if (!box) throw new Error("arm has no bounding box");
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();

    // held well past its normal arrival — still on, blocking holds it exactly
    // like holding the switch does
    await page.waitForTimeout(BASE_CONTACT_DELAY_MS);
    await expect(machineSwitch).toBeChecked();

    // let go, and it eventually finishes the job
    await page.mouse.up();
    await expect(machineSwitch).not.toBeChecked({ timeout: 3000 });
  });

  test("outlasting a path block makes the antenna give up on its own and send a second arm in from the top", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const arm = page.getByTestId("arm");
    await clickTop(machineSwitch);

    // early in its approach, so there's still a real gap between its tip
    // and the switch to plant a finger in
    await page.waitForTimeout(300);
    await beginPathBlock(page, arm, machineSwitch);

    // held mid-gap, never touching the arm itself — still on, blocking the
    // path holds the machine exactly like a direct block does, at first
    await page.waitForTimeout(300);
    await expect(machineSwitch).toBeChecked();

    // still holding — it gives up on its own regardless, and the top arm
    // lands anyway
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "over-the-top",
      { timeout: 2000 },
    );
    await expect(machineSwitch).not.toBeChecked({ timeout: 2000 });

    await page.mouse.up(); // released after the fact — shouldn't do anything
  });

  test("releasing a path block early lets the antenna finish fast instead of triggering the top arm", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const arm = page.getByTestId("arm");
    await clickTop(machineSwitch);

    await page.waitForTimeout(300);
    await beginPathBlock(page, arm, machineSwitch);

    await page.waitForTimeout(200); // well short of the give-up timer
    await page.mouse.up();

    await expect(machineSwitch).not.toBeChecked({ timeout: 1000 });
    await expect(page.locator(".top-arm")).not.toHaveClass(/reach/);
  });

  test("blocking the antenna's path lets it keep approaching the finger instead of freezing where it started", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const arm = page.getByTestId("arm");
    await clickTop(machineSwitch);

    // early in its approach — plenty of path still ahead of the tip for it
    // to keep closing before it reaches the finger
    await page.waitForTimeout(200);
    await beginPathBlock(page, arm, machineSwitch);

    const startTop = (await arm.boundingBox())?.y;
    if (startTop === undefined) throw new Error("arm has no bounding box");

    // still gliding toward the finger, not pinned at the press position —
    // a frozen antenna would never clear this margin (the shiver-in-place
    // jitter alone is under 3px)
    await expect
      .poll(async () => (await arm.boundingBox())?.y, { timeout: 1000 })
      .toBeLessThan(startTop - 10);

    await page.mouse.up();
  });

  test("provoking the antenna by blocking it unlocks an easter egg", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const arm = page.getByTestId("arm");
    await clickTop(machineSwitch);

    await page.waitForTimeout(BASE_CONTACT_DELAY_MS - 200);
    const box = await arm.boundingBox();
    if (!box) throw new Error("arm has no bounding box");
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.waitForTimeout(300); // let it struggle against the block a beat
    await page.mouse.up();

    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "poked-the-antenna",
    );
  });
});
