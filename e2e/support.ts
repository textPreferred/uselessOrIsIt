import type { Locator, Page } from "@playwright/test";

/** Only the top half of the rocker turns it on, only the bottom half off. */
export async function clickTop(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("switch has no bounding box");
  await locator.click({ position: { x: box.width / 2, y: box.height * 0.25 } });
}

export async function clickBottom(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("switch has no bounding box");
  await locator.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
}

/** Clicks the four mounting screws clockwise, starting from the top-left. */
export async function clickScrewsClockwise(page: Page): Promise<void> {
  await page.locator(".screw-tl").click();
  await page.locator(".screw-tr").click();
  await page.locator(".screw-br").click();
  await page.locator(".screw-bl").click();
}

/** Drags one element on top of another via raw mouse movement (for elements
 * that respond to pointer drags rather than clicks). */
export async function dragOnto(
  page: Page,
  from: Locator,
  to: Locator,
): Promise<void> {
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

/** Presses down in the open gap between the antenna's current tip and the
 * switch, without landing on the antenna itself. */
export async function beginPathBlock(
  page: Page,
  arm: Locator,
  machineSwitch: Locator,
): Promise<void> {
  const armBox = await arm.boundingBox();
  const switchBox = await machineSwitch.boundingBox();
  if (!armBox || !switchBox) throw new Error("missing bounding box");
  const gapY = (armBox.y + switchBox.y + switchBox.height) / 2;
  await page.mouse.move(switchBox.x + switchBox.width / 2, gapY);
  await page.mouse.down();
}
