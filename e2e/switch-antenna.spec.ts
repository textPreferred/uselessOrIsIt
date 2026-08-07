import { expect, test } from "@playwright/test";
import { BASE_CONTACT_DELAY_MS } from "../src/ui";
import { clickBottom, clickTop } from "./support";

test.describe("useless machine — switch and antenna race", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
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

  test("the switch's own flip speeds up with the antenna, not just its approach", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const paddle = page.locator(".paddle");

    async function paddleFlipMs(): Promise<number> {
      return paddle.evaluate(
        (el) => parseFloat(getComputedStyle(el).transitionDuration) * 1000,
      );
    }

    await clickTop(machineSwitch);
    const firstFlipMs = await paddleFlipMs();
    await expect(machineSwitch).not.toBeChecked({ timeout: 5000 });

    // a few more auto-flips ratchet the pace well past the first flip
    for (let i = 0; i < 3; i++) {
      await clickTop(machineSwitch);
      await expect(machineSwitch).not.toBeChecked({ timeout: 5000 });
    }
    await clickTop(machineSwitch);
    const fastFlipMs = await paddleFlipMs();

    // otherwise the paddle looks like it's still finishing the push well
    // after a fast antenna has already arrived and frozen in place
    expect(fastFlipMs).toBeLessThan(firstFlipMs);
  });

  test("unlocks an easter egg for beating the antenna", async ({ page }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // beat the antenna to it
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "beat-the-antenna",
    );
  });

  test("the toast dismisses itself after a second, no click needed", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // beat the antenna to it

    await expect(page.locator(".egg-toast")).toBeVisible();
    // still there well before the 1s mark — not an instant flash
    await page.waitForTimeout(500);
    await expect(page.locator(".egg-toast")).toBeVisible();
    // gone on its own shortly after, without anyone clicking it
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1000 });
  });

  test("the discovery toast morphs into the collection button instead of just vanishing", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // beat the antenna to it

    // shortly after the plain-toast beat, it starts flying toward the button
    await expect(page.locator(".egg-toast .egg-card")).toHaveClass(
      /egg-card-morph/,
      { timeout: 1200 },
    );
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1600 });
  });

  test("releasing before the antenna arrives doesn't rush it off", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const box = await machineSwitch.boundingBox();
    if (!box) throw new Error("switch has no bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.25);
    await page.mouse.down();
    await page.waitForTimeout(300); // let go long before the antenna arrives
    await page.mouse.up();

    // still mid-approach — letting go early shouldn't have sped anything up
    await page.waitForTimeout(BASE_CONTACT_DELAY_MS - 600);
    await expect(machineSwitch).toBeChecked();
    await expect(machineSwitch).not.toBeChecked({ timeout: 2000 });
  });

  test("holding the switch past its arrival holds it off until released", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const box = await machineSwitch.boundingBox();
    if (!box) throw new Error("switch has no bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.25);
    await page.mouse.down();
    await expect(machineSwitch).toBeChecked();

    // held well past the antenna's normal arrival — still on, because it
    // noticed the hold and is waiting rather than just delaying the clock
    await page.waitForTimeout(BASE_CONTACT_DELAY_MS * 1.5);
    await expect(machineSwitch).toBeChecked();

    // release, and it wins fast
    await page.mouse.up();
    await expect(machineSwitch).not.toBeChecked({ timeout: 1000 });
  });

  test("stays on through the antenna's snap back, not before", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const box = await machineSwitch.boundingBox();
    if (!box) throw new Error("switch has no bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.25);
    await page.mouse.down();
    await page.waitForTimeout(BASE_CONTACT_DELAY_MS * 1.5); // well past arrival
    await page.mouse.up();

    // the antenna needs a beat to actually get there — the switch shouldn't
    // flip until it arrives, not the instant the user lets go
    await page.waitForTimeout(100);
    await expect(machineSwitch).toBeChecked();

    await expect(machineSwitch).not.toBeChecked({ timeout: 1000 });
  });

  test("dragging past the midline flips the switch live", async ({ page }) => {
    const machineSwitch = page.getByRole("switch");
    const box = await machineSwitch.boundingBox();
    if (!box) throw new Error("switch has no bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.25);
    await page.mouse.down();
    await expect(machineSwitch).toBeChecked();

    // drag down into the bottom half without ever letting go
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.75);
    await expect(machineSwitch).not.toBeChecked();

    // and back up again, still without letting go
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.25);
    await expect(machineSwitch).toBeChecked();

    await page.mouse.up();
  });

  test("leaving the switch while pressed ends the press", async ({ page }) => {
    const machineSwitch = page.getByRole("switch");
    const box = await machineSwitch.boundingBox();
    if (!box) throw new Error("switch has no bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.1);
    await page.mouse.down();
    await expect(machineSwitch).toBeChecked();

    // drag out of the switch entirely, staying level with the top half
    await page.mouse.move(box.x + box.width + 40, box.y + box.height * 0.1);

    // now come back in over the bottom half, still held down — the press
    // already ended on leaving, so this shouldn't register as a flip
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.75);
    await expect(machineSwitch).toBeChecked();

    await page.mouse.up();
    await expect(machineSwitch).toBeChecked(); // releasing outside doesn't flip it either
  });

  test("unlocks an easter egg when the antenna wins after giving up", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const box = await machineSwitch.boundingBox();
    if (!box) throw new Error("switch has no bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.25);
    await page.mouse.down();
    // past arrival, past the quiet push, past the shiver — it's given up
    await page.waitForTimeout(BASE_CONTACT_DELAY_MS + 3000);
    await page.mouse.up();

    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "tug-of-war",
    );
  });
});
