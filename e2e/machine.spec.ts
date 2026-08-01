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

/** Drags one element on top of another via raw mouse movement (for elements
 * that respond to pointer drags rather than clicks). */
async function dragOnto(page: Page, from: Locator, to: Locator): Promise<void> {
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  if (!fromBox || !toBox) throw new Error("missing bounding box");
  await page.mouse.move(
    fromBox.x + fromBox.width / 2,
    fromBox.y + fromBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
  // let the dragged element's spring-back transition finish before anyone
  // reads its position again — otherwise a follow-up drag's bounding-box
  // read can be stale by the time the real mousedown lands.
  await page.waitForTimeout(350);
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

    await expect(page.locator(".egg-title")).toHaveText(/tug of war/i);
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

    await expect(page.locator(".egg-title")).toHaveText(/you're in the way/i);
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
        name: "Don't reset my easter eggs, but collect this one anyway.",
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
        name: "Don't reset my easter eggs, but collect this one anyway.",
      })
      .click();
    await expect(page.locator(".egg-title")).toHaveText(/anti-easter egg/i);
    await expect(page.locator(".egg-hint")).toBeVisible();
  });

  test("dragging the OFF label across a screw backs it loose", async ({
    page,
  }) => {
    const offLabel = page.locator(".label-tape-off");
    await dragOnto(page, offLabel, page.locator(".screw-tl"));
    await expect(page.locator(".screw-tl")).toHaveClass(/loose/);
    // untouched screws stay put
    await expect(page.locator(".screw-tr")).not.toHaveClass(/loose/);
    await expect(page.locator(".screw-bl")).not.toHaveClass(/loose/);
    await expect(page.locator(".screw-br")).not.toHaveClass(/loose/);
  });

  test("clicking a loose screw winds it back in", async ({ page }) => {
    const offLabel = page.locator(".label-tape-off");
    const screwTl = page.locator(".screw-tl");
    await dragOnto(page, offLabel, screwTl);
    await expect(screwTl).toHaveClass(/loose/);

    await screwTl.click();
    await expect(screwTl).not.toHaveClass(/loose/);
  });

  test("clicking a fastened screw doesn't back it out", async ({ page }) => {
    const screwTl = page.locator(".screw-tl");
    await screwTl.click(); // just a click, no drag — shouldn't unscrew it
    await expect(screwTl).not.toHaveClass(/loose/);
  });

  test("backing out all four screws swings the plate open and unlocks an easter egg", async ({
    page,
  }) => {
    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      // the label springs back to rest between drags — wait for that
      // settle so the next drag reads its actual (not mid-transition) box
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).not.toHaveClass(/open/); // three isn't enough
    await dragOnto(page, offLabel, page.locator(".screw-br"));

    await expect(page.locator(".plate")).toHaveClass(/open/);
    await expect(page.locator(".egg-title")).toHaveText(/and off they go/i);
    await expect(page.locator(".wall-tape").nth(0)).toHaveText(
      /useless machine,/i,
    );
    await expect(page.locator(".wall-tape").nth(1)).toHaveText(/isn't it\?/i);
  });

  test("shows the switch as if from behind once the plate is open", async ({
    page,
  }) => {
    const paddle = page.locator(".paddle");

    // rotateX tilts the paddle's top edge toward or away from the viewer —
    // reading the sign of its resulting z tells which side currently
    // protrudes, regardless of the ancestor perspective used to render it.
    async function paddleTopZ(): Promise<number> {
      return paddle.evaluate((el) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        return matrix.transformPoint({ x: 0, y: -1, z: 0 }).z;
      });
    }

    const closedTopZ = await paddleTopZ();

    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);

    const openTopZ = await paddleTopZ();
    expect(Math.sign(openTopZ)).toBe(-Math.sign(closedTopZ));
  });

  test("pressing the OFF button turns the switch on once the plate is open, and unlocks an easter egg", async ({
    page,
  }) => {
    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);

    // dismiss the "behind-the-wall" discovery toast before continuing
    await expect(page.locator(".egg-hint")).toHaveText(
      /click anywhere to dismiss/i,
      { timeout: 4000 },
    );
    await page.locator(".egg-toast").click();

    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch); // the ON half is now a no-op while off
    await expect(machineSwitch).not.toBeChecked();

    await clickBottom(machineSwitch); // the OFF half turns it on instead
    await expect(machineSwitch).toBeChecked();
    await expect(page.locator(".egg-title")).toHaveText(/reverse psychology/i);
  });

  test("the antenna reaches toward the switch's shifted position once the plate is open", async ({
    page,
  }) => {
    const antenna = page.getByTestId("arm");

    async function reachOffsetPx(): Promise<string> {
      return antenna.evaluate((el) =>
        (el as HTMLElement).style.getPropertyValue("--reach-x"),
      );
    }

    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch); // closed-plate baseline: no offset
    expect(await reachOffsetPx()).toBe("");
    await expect(machineSwitch).not.toBeChecked({ timeout: 5000 });

    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);

    await expect(page.locator(".egg-hint")).toHaveText(
      /click anywhere to dismiss/i,
      { timeout: 4000 },
    );
    await page.locator(".egg-toast").click();

    await clickBottom(machineSwitch); // the OFF button turns it on while ajar
    await expect(machineSwitch).toBeChecked();

    // the panel is hinged on the left, so the ajar switch sits well left of
    // its usual centered spot — the antenna's target should follow it there
    const offsetPx = await reachOffsetPx();
    expect(parseFloat(offsetPx)).toBeLessThan(-10);
  });

  test("re-seating a screw closes the plate again", async ({ page }) => {
    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);

    // the discovery toast covers the screen — dismiss it before reaching
    // the screw again
    await expect(page.locator(".egg-hint")).toHaveText(
      /click anywhere to dismiss/i,
      { timeout: 4000 },
    );
    await page.locator(".egg-toast").click();

    await page.locator(".screw-tl").click();
    await expect(page.locator(".plate")).not.toHaveClass(/open/);
  });

  test("tapping the open plate pushes it shut and re-fastens every screw", async ({
    page,
  }) => {
    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);

    await expect(page.locator(".egg-hint")).toHaveText(
      /click anywhere to dismiss/i,
      { timeout: 4000 },
    );
    await page.locator(".egg-toast").click();

    // the plate itself, not any one screw, closes everything in one go. A
    // real-coordinate click is unreliable here — the plate is mid-3D-rotation,
    // so its on-screen quad doesn't line up with its axis-aligned bounding
    // box — so this dispatches the click directly instead.
    await page.locator(".plate").evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator(".plate")).not.toHaveClass(/open/);
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await expect(page.locator(corner)).not.toHaveClass(/loose/);
    }
  });

  test("the open plate stays open across a reload", async ({ page }) => {
    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);

    await page.reload();

    await expect(page.locator(".plate")).toHaveClass(/open/);
    await expect(page.locator(".screw-tl")).toHaveClass(/loose/);
    await expect(page.locator(".screw-tr")).toHaveClass(/loose/);
    await expect(page.locator(".screw-bl")).toHaveClass(/loose/);
    await expect(page.locator(".screw-br")).toHaveClass(/loose/);
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
    await expect(page.locator(".egg-title")).toHaveText(/no means no/i);
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
