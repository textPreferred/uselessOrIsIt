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
});
