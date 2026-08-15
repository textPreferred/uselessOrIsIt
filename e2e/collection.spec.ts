import { expect, type Page, test } from "@playwright/test";
import { EASTER_EGGS, SEEN_STORAGE_KEY, STORAGE_KEY } from "../src/easter-eggs";
import {
  clickBottom,
  clickScrewsClockwise,
  clickTop,
  seedFoundEggs,
} from "./support";

/** Double-clicks the nameplate's question mark to unlock
 * "questioning-the-question" — a second, distinct egg that's quick to
 * trigger without any waits of its own. */
async function collectQuestioningTheQuestion(page: Page): Promise<void> {
  const mark = page.locator(".nameplate-mark");
  await mark.click();
  await mark.click();
}

test.describe("useless machine — easter egg collection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("resetting wipes previously found easter eggs so they can be found again", async ({
    page,
  }) => {
    // confirming the reset reloads the page — comfortably past the default
    // 30s on a slow sandboxed browser (see plate.spec.ts's own reload tests)
    test.setTimeout(60000);
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // unlock "beat-the-antenna"
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "beat-the-antenna",
    );
    // the toast covers the screen until it auto-dismisses, so wait it out
    // first — otherwise it's still blocking every click after it (including
    // the screws below)
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    await clickScrewsClockwise(page);
    await page.getByRole("button", { name: "Yes, reset the app" }).click();

    // confirming reloads the page — Playwright's own auto-retrying locators
    // ride out the navigation, so there's nothing to explicitly await here
    await expect(machineSwitch).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".egg-toast")).toBeHidden();

    await clickTop(machineSwitch);
    await clickBottom(machineSwitch);
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "beat-the-antenna",
    );
  });

  test("the easter egg toast bursts with confetti", async ({ page }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // beat the antenna to it
    await expect(page.locator(".egg-confetti-piece")).toHaveCount(8);
  });

  test("the toast shows a visual indicator instead of revealing what was found", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // beat the antenna to it
    await expect(page.locator(".egg-found-icon")).toBeVisible();
    await expect(page.locator(".egg-toast .egg-title")).toHaveCount(0);
    await expect(page.locator(".egg-toast .egg-desc")).toHaveCount(0);
  });

  test("the collection button stays hidden until something is found", async ({
    page,
  }) => {
    await expect(page.locator(".egg-collection-toggle")).toBeHidden();
  });

  test("the collection button shows a pending +N badge for a freshly found egg, not yet folded into the count", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // unlock "beat-the-antenna"
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    await expect(page.locator(".egg-collection-count")).toHaveText("+1");
    // count immediately follows the button in the markup
    await expect(
      page.locator(".egg-collection-toggle + .egg-collection-count"),
    ).toHaveCount(1);
  });

  test("the count sits below the button, not beside it", async ({ page }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // unlock "beat-the-antenna"
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    const buttonBox = await page
      .locator(".egg-collection-toggle")
      .boundingBox();
    const countBox = await page.locator(".egg-collection-count").boundingBox();
    if (!buttonBox || !countBox) throw new Error("missing bounding box");

    expect(countBox.y).toBeGreaterThanOrEqual(buttonBox.y + buttonBox.height);
  });

  test("the collection button waits for the toast to land before appearing", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // unlock "beat-the-antenna"

    // toast is still up, mid-flight — the button hasn't landed yet
    await page.waitForTimeout(600);
    await expect(page.locator(".egg-toast")).toBeVisible();
    await expect(page.locator(".egg-collection-toggle")).toBeHidden();

    // once the toast is fully gone, the button (and its count) are there
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1000 });
    await expect(page.locator(".egg-collection-toggle")).toBeVisible();
    await expect(page.locator(".egg-collection-count")).toHaveText("+1");
  });

  test("a found easter egg reveals the collection button and stays viewable, without spoiling what's still missing", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // unlock "beat-the-antenna"
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    const toggle = page.locator(".egg-collection-toggle");
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator(".egg-collection-item")).toHaveCount(1);
    await expect(page.locator(".egg-collection-item")).toContainText(
      /turning it on and off again/i,
    );
    // no hint of the other six — no count, no locked placeholders
    await expect(page.locator(".egg-collection-card")).not.toContainText("7");
    await expect(page.locator(".egg-collection-card")).not.toContainText("???");

    // closing and reopening still shows it — it's not a one-time reveal
    await page.locator(".egg-collection-close").click();
    await expect(page.locator(".egg-collection-overlay")).toBeHidden();
    await toggle.click();
    await expect(page.locator(".egg-collection-item")).toHaveCount(1);
  });

  test("once every easter egg is found, the badge says so instead of a count", async ({
    page,
  }) => {
    // seeded as already-viewed, not a pile of unseen finds — that's its own
    // "+N" badge, covered separately below
    await page.addInitScript(
      ({ storageKey, seenKey, ids }) => {
        localStorage.setItem(storageKey, JSON.stringify(ids));
        localStorage.setItem(seenKey, JSON.stringify(ids));
      },
      {
        storageKey: STORAGE_KEY,
        seenKey: SEEN_STORAGE_KEY,
        ids: EASTER_EGGS.map((egg) => egg.id),
      },
    );
    await page.goto("./");

    await expect(page.locator(".egg-collection-count")).toHaveText("All found");
    await expect(page.locator(".egg-collection-toggle")).toHaveAttribute(
      "aria-label",
      /all found/i,
    );

    await page.locator(".egg-collection-toggle").click();
    await expect(page.locator(".egg-collection-card")).toContainText(
      "All found!",
    );
  });

  test("a second egg found before viewing the collection bumps the pending badge to +2", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // unlock "beat-the-antenna"
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    const count = page.locator(".egg-collection-count");
    await expect(count).toHaveText("+1");
    await expect(count).toHaveClass(/egg-collection-count-pending/);

    await collectQuestioningTheQuestion(page);
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    await expect(count).toHaveText("+2");
  });

  test("closing the collection settles the pending badge into a plain count, until the next new find", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // unlock "beat-the-antenna"
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    const count = page.locator(".egg-collection-count");
    await page.locator(".egg-collection-toggle").click();
    await page.locator(".egg-collection-close").click();

    await expect(count).toHaveText(`1/${EASTER_EGGS.length}`);
    await expect(count).not.toHaveClass(/egg-collection-count-pending/);

    await collectQuestioningTheQuestion(page);
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    await expect(count).toHaveText("+1");
  });

  test("the settled badge shows the found/total fraction, not just the found count", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ storageKey, seenKey, ids }) => {
        localStorage.setItem(storageKey, JSON.stringify(ids));
        localStorage.setItem(seenKey, JSON.stringify(ids));
      },
      {
        storageKey: STORAGE_KEY,
        seenKey: SEEN_STORAGE_KEY,
        ids: EASTER_EGGS.slice(0, 3).map((egg) => egg.id),
      },
    );
    await page.goto("./");

    await expect(page.locator(".egg-collection-count")).toHaveText(
      `3/${EASTER_EGGS.length}`,
    );
  });

  test("a stale egg ID from a retired egg doesn't push the found count past the total", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ storageKey, seenKey, ids }) => {
        localStorage.setItem(storageKey, JSON.stringify(ids));
        localStorage.setItem(seenKey, JSON.stringify(ids));
      },
      {
        storageKey: STORAGE_KEY,
        seenKey: SEEN_STORAGE_KEY,
        ids: [...EASTER_EGGS.map((egg) => egg.id), "a-retired-easter-egg"],
      },
    );
    await page.goto("./");

    await expect(page.locator(".egg-collection-count")).toHaveText("All found");
  });

  test("finding the last egg shows All found immediately, even though it's still pending", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ storageKey, seenKey, ids }) => {
        localStorage.setItem(storageKey, JSON.stringify(ids));
        localStorage.setItem(seenKey, JSON.stringify(ids));
      },
      {
        storageKey: STORAGE_KEY,
        seenKey: SEEN_STORAGE_KEY,
        ids: EASTER_EGGS.filter((egg) => egg.id !== "beat-the-antenna").map(
          (egg) => egg.id,
        ),
      },
    );
    await page.goto("./");

    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // unlock the last remaining egg
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    const count = page.locator(".egg-collection-count");
    await expect(count).toHaveText("All found");
    await expect(count).not.toHaveText("+1");
    await expect(count).toHaveClass(/egg-collection-count-complete/);
    await expect(count).not.toHaveClass(/egg-collection-count-pending/);
  });

  test("the collection view puts newly found eggs on top and highlighted, until it's closed", async ({
    page,
  }) => {
    const machineSwitch = page.getByRole("switch");
    const toggle = page.locator(".egg-collection-toggle");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // unlock "beat-the-antenna"
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    // view and close it, so this first egg is no longer "new" by the time
    // the second one is found
    await toggle.click();
    await page.locator(".egg-collection-close").click();

    await collectQuestioningTheQuestion(page);
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    await toggle.click();
    const items = page.locator(".egg-collection-item");
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText(/questioning the question/i);
    await expect(items.first()).toHaveClass(/egg-collection-item-new/);
    await expect(items.last()).not.toHaveClass(/egg-collection-item-new/);

    // closing marks it seen — reopening no longer highlights it
    await page.locator(".egg-collection-close").click();
    await toggle.click();
    await expect(page.locator(".egg-collection-item").first()).not.toHaveClass(
      /egg-collection-item-new/,
    );
  });

  test("the feedback button waits for a third easter egg before appearing", async ({
    page,
  }) => {
    await seedFoundEggs(page, 2);
    await page.goto("./");

    await expect(page.locator(".feedback-button")).toBeHidden();

    const machineSwitch = page.getByRole("switch");
    const onLabel = page.locator(".label-tape-on");
    await onLabel.click();
    await onLabel.click(); // upside down, blocks the switch
    await clickTop(machineSwitch); // a real attempt, swallowed
    await onLabel.click();
    await onLabel.click(); // back to ON
    await clickTop(machineSwitch); // succeeds — unlocks "no-means-no", the third egg
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "no-means-no",
    );
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    await expect(page.locator(".feedback-button")).toBeVisible();
  });

  test("resetting the app hides the feedback button again", async ({
    page,
  }) => {
    // `seedFoundEggs` uses `addInitScript`, which reapplies on every
    // navigation — including the reload this test triggers — so it would
    // silently undo the very reset being tested. Unlocking three eggs live
    // instead sidesteps that.
    test.setTimeout(60000);
    const machineSwitch = page.getByRole("switch");
    await clickTop(machineSwitch);
    await clickBottom(machineSwitch); // unlock "beat-the-antenna"
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    await collectQuestioningTheQuestion(page);
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    const onLabel = page.locator(".label-tape-on");
    await onLabel.click();
    await onLabel.click(); // upside down, blocks the switch
    await clickTop(machineSwitch); // a real attempt, swallowed
    await onLabel.click();
    await onLabel.click(); // back to ON
    await clickTop(machineSwitch); // unlock "no-means-no", the third egg
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "no-means-no",
    );
    await expect(page.locator(".egg-toast")).toBeHidden({ timeout: 1500 });

    await expect(page.locator(".feedback-button")).toBeVisible();

    await clickScrewsClockwise(page);
    await page.getByRole("button", { name: "Yes, reset the app" }).click();

    await expect(machineSwitch).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".feedback-button")).toBeHidden();
  });
});
