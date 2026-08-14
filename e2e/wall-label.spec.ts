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
    await expect(img).toHaveAttribute("data-mechanism", "circuit");
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "inner-workings",
    );
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    for (const id of [
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

  test("the next mechanism photo already tracks into frame during the swipe, not just after release", async ({
    page,
  }) => {
    const wallLabel = page.locator(".wall-tape-group");
    await dragBy(page, wallLabel, 100, -100);
    await expect(wallLabel).toHaveClass(/peeled/);
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    const panel = page.locator(".wall-panel");
    const incoming = page.locator(".wall-panel-img-incoming");
    await expect(incoming).toHaveAttribute("data-mechanism", "circuit");

    const panelBox = await panel.boundingBox();
    if (!panelBox) throw new Error("panel has no bounding box");
    const centerX = panelBox.x + panelBox.width / 2;
    const centerY = panelBox.y + panelBox.height / 2;

    // at rest, the incoming photo sits fully outside the frame
    const restBox = await incoming.boundingBox();
    if (!restBox) throw new Error("incoming photo has no bounding box");
    expect(restBox.x).toBeGreaterThan(panelBox.x + panelBox.width / 2);

    // mid-swipe, well short of both the threshold and release — it should
    // already be sliding into the frame from the opposite edge, not still
    // waiting off-screen for the gesture to finish
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 25, centerY, { steps: 5 });

    const dragBox = await incoming.boundingBox();
    if (!dragBox) throw new Error("incoming photo has no bounding box mid-drag");
    expect(dragBox.x).toBeLessThan(restBox.x);

    await page.mouse.up();
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
    await expect(img).toHaveAttribute("data-mechanism", "circuit");

    await page.reload();

    await expect(page.locator(".plate")).toHaveClass(/open/);
    await expect(page.locator(".wall-tape-group")).toHaveClass(/peeled/);
    await expect(page.locator(".wall-panel-img")).toHaveAttribute(
      "data-mechanism",
      "circuit",
    );
  });
});
