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

  test("dragging the wall label past the threshold peels it, reveals the panel, and unlocks an easter egg", async ({
    page,
  }) => {
    const wallLabel = page.locator(".wall-tape-group");
    await dragBy(page, wallLabel, 100, -100);
    await expect(wallLabel).toHaveClass(/peeled/);
    await expect(page.locator(".wall-panel-img")).toBeVisible();
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "trade-secret",
    );
  });

  test("dragging it only a short distance springs it back — no panel, no egg, no permanent class", async ({
    page,
  }) => {
    const wallLabel = page.locator(".wall-tape-group");
    await dragBy(page, wallLabel, 20, -10);
    await expect(wallLabel).not.toHaveClass(/peeled/);
    await expect(page.locator(".egg-toast")).toBeHidden();
  });

  test("swiping the revealed panel cycles the mechanism image forward and loops back to the first", async ({
    page,
  }) => {
    const wallLabel = page.locator(".wall-tape-group");
    await dragBy(page, wallLabel, 100, -100);
    await expect(wallLabel).toHaveClass(/peeled/);
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    const panel = page.locator(".wall-panel");
    const img = page.locator(".wall-panel-img");
    await expect(img).toHaveAttribute("data-mechanism", "cables");
    await dragBy(page, panel, 80, 0);
    await expect(img).toHaveAttribute("data-mechanism", "gears");
    await dragBy(page, panel, 80, 0);
    await expect(img).toHaveAttribute("data-mechanism", "circuit");
    await dragBy(page, panel, 80, 0);
    await expect(img).toHaveAttribute("data-mechanism", "pipes");
    await dragBy(page, panel, 80, 0); // loops back around
    await expect(img).toHaveAttribute("data-mechanism", "cables");
  });
});
