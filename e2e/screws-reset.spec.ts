import { expect, test } from "@playwright/test";
import { EASTER_EGGS } from "../src/easter-eggs";
import { clickScrewsClockwise } from "./support";

test.describe("useless machine — screw reset offer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("clicking the four screws clockwise from the top-left offers to reset the app", async ({
    page,
  }) => {
    await clickScrewsClockwise(page);
    await expect(page.locator(".egg-toast-confirm .egg-desc")).toHaveText(
      /reset the app/i,
    );
    await expect(
      page.getByRole("button", { name: "Yes, reset the app" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Don't reset the app.",
      }),
    ).toBeVisible();
  });

  test("the reset offer has no eyebrow or title — it's not dressed up as an easter egg", async ({
    page,
  }) => {
    await clickScrewsClockwise(page);
    await expect(page.locator(".egg-toast-confirm .egg-eyebrow")).toHaveCount(
      0,
    );
    await expect(page.locator(".egg-toast-confirm .egg-title")).toHaveCount(0);
  });

  test("clicking screws out of order doesn't offer to reset", async ({
    page,
  }) => {
    await page.locator(".screw-tl").click();
    await page.locator(".screw-bl").click(); // wrong — bl isn't next after tl
    await page.locator(".screw-tr").click();
    await page.locator(".screw-br").click();
    await expect(page.locator(".egg-toast")).toBeHidden();
  });

  test("declining the reset doesn't collect anything — the offer is just UI, not an egg", async ({
    page,
  }) => {
    await clickScrewsClockwise(page);
    await page
      .getByRole("button", {
        name: "Don't reset the app.",
      })
      .click();
    await expect(page.locator(".egg-toast")).toBeHidden();
    await expect(page.locator(".egg-collection-toggle")).toBeHidden();
  });

  test("the reset offer isn't part of the collection's total or list", () => {
    expect(
      EASTER_EGGS.find(
        (egg) => egg.description === "Reset the app — your choice.",
      ),
    ).toBeUndefined();
  });
});
