import { expect, test } from "@playwright/test";
import { dragOnto } from "./support";

test.describe("useless machine — party lights", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("dragging the ON label onto the feedback bubble lights it up and unlocks an easter egg", async ({
    page,
  }) => {
    const onLabel = page.locator(".label-tape-on");
    const feedbackButton = page.locator(".feedback-button");
    await dragOnto(page, onLabel, feedbackButton);

    await expect(feedbackButton).toHaveClass(/party/);
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "lets-party",
    );
  });

  test("a spun ON label isn't draggable onto the bubble — only a click-spin still works on it", async ({
    page,
  }) => {
    const onLabel = page.locator(".label-tape-on");
    const feedbackButton = page.locator(".feedback-button");
    await onLabel.click(); // one spin — no longer in its original orientation

    await dragOnto(page, onLabel, feedbackButton);

    await expect(feedbackButton).not.toHaveClass(/party/);
    await expect(page.locator(".egg-toast")).toBeHidden();
  });

  test("the party lights are a ring of bulbs around the bubble, and fade out on their own after a beat", async ({
    page,
  }) => {
    const onLabel = page.locator(".label-tape-on");
    const feedbackButton = page.locator(".feedback-button");
    await dragOnto(page, onLabel, feedbackButton);

    await expect(feedbackButton).toHaveClass(/party/);
    const bulbCount = await feedbackButton.locator(".party-bulb").count();
    expect(bulbCount).toBeGreaterThan(0);

    await expect(feedbackButton).not.toHaveClass(/party/, { timeout: 4000 });
    await expect(feedbackButton.locator(".party-bulb")).toHaveCount(0);
  });
});
