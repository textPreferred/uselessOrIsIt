import { expect, test } from "@playwright/test";

test.describe("useless machine — nameplate version drag", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("dragging the version number right scrubs the patch number up, then snaps back on release", async ({
    page,
  }) => {
    const version = page.locator(".nameplate-version");
    const originalText = await version.textContent();
    const box = await version.boundingBox();
    if (!box || !originalText) throw new Error("version has no bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2);
    await expect(version).not.toHaveText(originalText);
    await page.mouse.up();

    await expect(version).toHaveText(originalText);
  });

  test("dragging the version number unlocks the time-travel egg once it snaps back", async ({
    page,
  }) => {
    const version = page.locator(".nameplate-version");
    const box = await version.boundingBox();
    if (!box) throw new Error("version has no bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2);
    await expect(page.locator(".egg-toast")).toBeHidden();
    await page.mouse.up();

    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "no-bending-of-space-time",
    );
  });

  test("just tapping the version number, without dragging, doesn't unlock anything", async ({
    page,
  }) => {
    const version = page.locator(".nameplate-version");
    await version.click();
    await expect(page.locator(".egg-toast")).toBeHidden();
  });
});
