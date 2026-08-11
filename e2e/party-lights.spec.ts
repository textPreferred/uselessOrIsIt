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
});
