import { expect, test } from "@playwright/test";
import { dragBy, dragOnto } from "./support";

test.describe("useless machine — wall label", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
      await expect(page.locator(corner)).toHaveClass(/loose/);
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);
    // wait out the "behind-the-wall" discovery toast before continuing
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });
  });

  test("dragging the wall label past the threshold peels it and reveals the panel — no egg yet", async ({
    page,
  }) => {
    const wallLabel = page.locator(".wall-tape-group");
    await dragBy(page, wallLabel, 100, -100);
    await expect(wallLabel).toHaveClass(/peeled/);
    await expect(page.locator(".wall-panel-img")).toBeVisible();
    await expect(page.locator(".egg-toast")).toBeHidden();
  });

  test("dragging it only a short distance springs it back — no panel, no egg, no permanent class", async ({
    page,
  }) => {
    const wallLabel = page.locator(".wall-tape-group");
    await dragBy(page, wallLabel, 20, -10);
    await expect(wallLabel).not.toHaveClass(/peeled/);
    await expect(page.locator(".egg-toast")).toBeHidden();
  });

  test("swiping the revealed panel cycles the mechanism image forward, unlocks an easter egg on the first swipe, and loops back to the first", async ({
    page,
  }) => {
    const wallLabel = page.locator(".wall-tape-group");
    await dragBy(page, wallLabel, 100, -100);
    await expect(wallLabel).toHaveClass(/peeled/);
    await expect(page.locator(".egg-toast")).toBeHidden();

    const panel = page.locator(".wall-panel");
    const img = page.locator(".wall-panel-img");
    await expect(img).toHaveAttribute("data-mechanism", "cables");

    // first swipe both advances the photo and unlocks the "inner-workings"
    // egg — wait out its toast before the rest of the loop, since it's a
    // full-screen overlay that would otherwise swallow the next drag
    await dragBy(page, panel, 80, 0);
    await expect(img).toHaveAttribute("data-mechanism", "gears");
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "inner-workings",
    );
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    for (const id of [
      "circuit",
      "pipes",
      "levers",
      "conveyor",
      "drive",
      "cables", // loops back around
    ]) {
      await dragBy(page, panel, 80, 0);
      await expect(img).toHaveAttribute("data-mechanism", id);
    }
  });

  test("the peeled state and current mechanism persist across a reload", async ({
    page,
  }) => {
    // more drags than the other cases here, plus a reload — comfortably
    // past the default 30s on a slow sandboxed browser
    test.setTimeout(60000);
    const wallLabel = page.locator(".wall-tape-group");
    await dragBy(page, wallLabel, 100, -100);
    await expect(wallLabel).toHaveClass(/peeled/);
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    const panel = page.locator(".wall-panel");
    const img = page.locator(".wall-panel-img");
    await dragBy(page, panel, 80, 0);
    await expect(img).toHaveAttribute("data-mechanism", "gears");

    await page.reload();

    await expect(page.locator(".plate")).toHaveClass(/open/);
    await expect(page.locator(".wall-tape-group")).toHaveClass(/peeled/);
    await expect(page.locator(".wall-panel-img")).toHaveAttribute(
      "data-mechanism",
      "gears",
    );
  });
});
