import type { Locator, Page } from "@playwright/test";
import { EASTER_EGGS, SEEN_STORAGE_KEY, STORAGE_KEY } from "../src/easter-eggs";

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

/** Drags an element by a fixed pixel offset from its own center and
 * releases — for gestures measured by distance travelled rather than by
 * landing on another element (the wall label's peel, the mechanism swipe). */
export async function dragBy(
  page: Page,
  locator: Locator,
  dx: number,
  dy: number,
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("missing bounding box");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 10 });
  await page.mouse.up();
  // let the dragged element's spring-back (or lock-in) transition finish
  // before anyone reads its position or class list again
  await page.waitForTimeout(350);
}

/** Seeds localStorage so the first `count` known eggs are already found and
 * marked seen, before the page ever loads — for tests about behavior gated
 * on the found count (like the feedback button's reveal threshold), not
 * about finding the eggs themselves. Must be called before `page.goto`.
 * Uses `addInitScript`, which reapplies on every navigation — including a
 * later reload — so don't use this in a test that resets state and then
 * checks what survives the reload. */
export async function seedFoundEggs(page: Page, count: number): Promise<void> {
  const ids = EASTER_EGGS.slice(0, count).map((egg) => egg.id);
  await page.addInitScript(
    ({ storageKey, seenKey, ids }) => {
      localStorage.setItem(storageKey, JSON.stringify(ids));
      localStorage.setItem(seenKey, JSON.stringify(ids));
    },
    { storageKey: STORAGE_KEY, seenKey: SEEN_STORAGE_KEY, ids },
  );
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
