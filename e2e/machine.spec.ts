import { expect, type Locator, type Page, test } from "@playwright/test";
import { BASE_CONTACT_DELAY_MS } from "../src/ui";

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

/** Clicks the four mounting screws clockwise, starting from the top-left. */
async function clickScrewsClockwise(page: Page): Promise<void> {
  await page.locator(".screw-tl").click();
  await page.locator(".screw-tr").click();
  await page.locator(".screw-br").click();
  await page.locator(".screw-bl").click();
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

  test("flips its own switch back off @smoke", async ({ page }) => {
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
    await expect(page.locator(".egg-title")).toHaveText(
      /turning it on and off again/i,
    );
  });

  test("counts down the easter egg toast's dismiss grace period", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // beat the antenna to it

    const hint = page.locator(".egg-hint");
    await expect(hint).toHaveText(/wait 3s/i);

    // clicking mid-countdown doesn't dismiss it
    await page.locator(".egg-toast").click();
    await expect(page.locator(".egg-toast")).toBeVisible();
    await expect(hint).toHaveText(/wait 2s/i);

    // once the countdown reaches zero, it invites a click and honors it
    await expect(hint).toHaveText(/click anywhere to dismiss/i, {
      timeout: 4000,
    });
    await page.locator(".egg-toast").click();
    await expect(page.locator(".egg-toast")).toBeHidden();
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

    await expect(page.locator(".egg-title")).toHaveText(/tug of war/i);
  });

  test("clicking the four screws clockwise from the top-left offers to reset easter eggs", async ({
    page,
  }) => {
    await clickScrewsClockwise(page);
    await expect(page.locator(".egg-title")).toHaveText(/anti-easter egg/i);
    await expect(
      page.getByRole("button", { name: "Yes, reset my easter eggs" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Don't reset easter eggs but collect this one",
      }),
    ).toBeVisible();
  });

  test("clicking screws out of order doesn't offer to reset", async ({
    page,
  }) => {
    await page.locator(".screw-tl").click();
    await page.locator(".screw-bl").click(); // wrong — bl isn't next after tl
    await page.locator(".screw-tr").click();
    await page.locator(".screw-br").click();
    await expect(page.locator(".egg-toast")).toBeHidden();
  });

  test("declining the reset collects the anti-easter-egg like any other", async ({
    page,
  }) => {
    await clickScrewsClockwise(page);
    await page
      .getByRole("button", {
        name: "Don't reset easter eggs but collect this one",
      })
      .click();
    await expect(page.locator(".egg-title")).toHaveText(/anti-easter egg/i);
    await expect(page.locator(".egg-hint")).toBeVisible();
  });

  test("resetting wipes previously found easter eggs so they can be found again", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // unlock "beat-the-antenna"
    await expect(page.locator(".egg-title")).toHaveText(
      /turning it on and off again/i,
    );
    // the toast ignores clicks during its dismiss grace period, so wait it
    // out first — otherwise this click is swallowed and the toast lingers,
    // blocking every click after it (including the screws below)
    await expect(page.locator(".egg-hint")).toHaveText(
      /click anywhere to dismiss/i,
      { timeout: 4000 },
    );
    await page.locator(".egg-toast").click(); // dismiss

    await clickScrewsClockwise(page);
    await page
      .getByRole("button", { name: "Yes, reset my easter eggs" })
      .click();
    await expect(page.locator(".egg-toast")).toBeHidden();

    await clickTop(machineSwitch);
    await clickBottom(machineSwitch);
    await expect(page.locator(".egg-title")).toHaveText(
      /turning it on and off again/i,
    );
  });
});
