import { expect, test } from "@playwright/test";
import { BASE_CONTACT_DELAY_MS } from "../src/ui";
import { clickBottom, clickTop, dragOnto } from "./support";

test.describe("useless machine — plate", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
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
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "behind-the-wall",
    );
    await expect(page.locator(".wall-tape").nth(0)).toHaveText(
      /useless machine,/i,
    );
    await expect(page.locator(".wall-tape").nth(1)).toHaveText(/isn't it\?/i);
  });

  test("hides the screws and labels once the plate is open, since a metal plate can't be seen through", async ({
    page,
  }) => {
    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);

    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await expect(page.locator(corner)).toHaveCSS("opacity", "0");
    }
    await expect(page.locator(".label-tape-on")).toHaveCSS("opacity", "0");
    await expect(offLabel).toHaveCSS("opacity", "0");

    // re-seating a screw still needs to work from behind
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });
    await page.locator(".screw-tl").click();
    await expect(page.locator(".plate")).not.toHaveClass(/open/);
  });

  test("opening the plate reveals mounting holes in the wall where the screws were", async ({
    page,
  }) => {
    // capture each screw's on-screen position before it's backed out, so we
    // can check the wall hole left behind lines up with it exactly
    const screwBoxesBefore = Object.fromEntries(
      await Promise.all(
        [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"].map(
          async (corner) => [corner, await page.locator(corner).boundingBox()],
        ),
      ),
    );

    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);

    for (const [corner, hole] of [
      [".screw-tl", ".wall-hole-tl"],
      [".screw-tr", ".wall-hole-tr"],
      [".screw-bl", ".wall-hole-bl"],
      [".screw-br", ".wall-hole-br"],
    ]) {
      const before = screwBoxesBefore[corner];
      if (!before) throw new Error(`${corner} has no bounding box`);
      const holeBox = await page.locator(hole).boundingBox();
      if (!holeBox) throw new Error(`${hole} has no bounding box`);
      expect(Math.abs(holeBox.x - before.x)).toBeLessThan(2);
      expect(Math.abs(holeBox.y - before.y)).toBeLessThan(2);
    }
  });

  test("opening the plate reveals a faint outline of its former footprint on the wall", async ({
    page,
  }) => {
    const plateBoxBefore = await page.locator(".plate").boundingBox();
    if (!plateBoxBefore) throw new Error(".plate has no bounding box");

    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);

    const outlineBox = await page.locator(".wall-outline").boundingBox();
    if (!outlineBox) throw new Error(".wall-outline has no bounding box");
    expect(Math.abs(outlineBox.x - plateBoxBefore.x)).toBeLessThan(2);
    expect(Math.abs(outlineBox.y - plateBoxBefore.y)).toBeLessThan(2);
    expect(Math.abs(outlineBox.width - plateBoxBefore.width)).toBeLessThan(2);
    expect(Math.abs(outlineBox.height - plateBoxBefore.height)).toBeLessThan(2);
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

  test("pressing the OFF button turns the switch on once the plate is open, and unlocks an easter egg as soon as the antenna starts retreating", async ({
    page,
  }) => {
    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);

    // wait out the "behind-the-wall" discovery toast before continuing
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch); // the ON half is now a no-op while off
    await expect(machineSwitch).not.toBeChecked();

    await clickBottom(machineSwitch); // the OFF half turns it on instead
    await expect(machineSwitch).toBeChecked();
    // not yet — the antenna still has to fly out and actually make contact
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 300 });

    // unlocked the instant it starts backing off — well before the panel
    // has swung shut behind it. A short timeout on the egg check matters
    // here: it must already be showing right as retreat starts, not just
    // show up eventually once the panel gets around to closing.
    const arm = page.getByTestId("arm");
    await expect(arm).toHaveClass(/retreat/, {
      timeout: BASE_CONTACT_DELAY_MS + 500,
    });
    await expect(page.locator(".plate")).toHaveClass(/open/);
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "reverse-psychology",
      { timeout: 200 },
    );

    await expect(machineSwitch).not.toBeChecked({
      timeout: BASE_CONTACT_DELAY_MS + 1000,
    });
    await expect(page.locator(".plate")).not.toHaveClass(/open/);
  });

  test("the antenna reaches toward the switch's shifted position, on its ON side, once the plate is open", async ({
    page,
  }) => {
    const antenna = page.getByTestId("arm");

    async function reachTarget(): Promise<{ x: string; y: string }> {
      return antenna.evaluate((el) => ({
        x: (el as HTMLElement).style.getPropertyValue("--reach-x"),
        y: (el as HTMLElement).style.getPropertyValue("--reach-y"),
      }));
    }

    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch); // closed-plate baseline: no offset
    expect(await reachTarget()).toEqual({ x: "", y: "" });
    await expect(machineSwitch).not.toBeChecked({ timeout: 5000 });

    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);

    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    await clickBottom(machineSwitch); // the OFF button turns it on while ajar
    await expect(machineSwitch).toBeChecked();

    const target = await reachTarget();
    // the panel is hinged on the left, so the ajar switch sits well left of
    // its usual centered spot — the antenna's target should follow it there
    expect(parseFloat(target.x)).toBeLessThan(-10);
    // and since the mirrored paddle now has ON, not OFF, as the live side,
    // contact needs to land higher up (toward ON) instead of its usual spot
    // near the bottom (OFF)
    expect(target.y).toBe("-9.1rem");
  });

  test("re-seating a screw closes the plate again", async ({ page }) => {
    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);

    // the discovery toast covers the screen briefly — wait it out before
    // reaching the screw again
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

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

    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

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

  test("flipping the switch and watching the machine respond closes the plate on its own", async ({
    page,
  }) => {
    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);

    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    const machineSwitch = page.getByRole("switch");
    await clickBottom(machineSwitch); // the OFF button turns it on while ajar
    await expect(machineSwitch).toBeChecked();

    await expect(machineSwitch).not.toBeChecked({
      timeout: BASE_CONTACT_DELAY_MS + 1000,
    });
    await expect(page.locator(".plate")).not.toHaveClass(/open/);
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await expect(page.locator(corner)).not.toHaveClass(/loose/);
    }
  });

  test("waits for the antenna to leave the screen before closing the plate, so they don't collide", async ({
    page,
  }) => {
    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    const machineSwitch = page.getByRole("switch");
    const arm = page.getByTestId("arm");
    await clickBottom(machineSwitch); // the OFF button turns it on while ajar
    await expect(machineSwitch).toBeChecked();

    // the switch flips back off the instant the antenna makes contact — the
    // antenna itself is still visibly retreating at that exact moment, and
    // the plate must not have swung shut on top of it yet
    await expect(machineSwitch).not.toBeChecked({
      timeout: BASE_CONTACT_DELAY_MS + 1000,
    });
    await expect(arm).toBeVisible();
    await expect(page.locator(".plate")).toHaveClass(/open/);

    // only once the antenna has actually left does the plate close — it
    // still has its own full retreat to play out from here
    await expect(arm).toBeHidden({ timeout: 2 * BASE_CONTACT_DELAY_MS + 1000 });
    await expect(page.locator(".plate")).not.toHaveClass(/open/);
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
});
