import { expect, test } from "@playwright/test";

test.describe("useless machine — page basics", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("shows the machine with its switch off @smoke", async ({ page }) => {
    await expect(page).toHaveTitle(/useless machine/i);
    const machineSwitch = page.getByRole("switch");
    await expect(machineSwitch).toBeVisible();
    await expect(machineSwitch).not.toBeChecked();
  });

  test("keeps the plate fully visible on short landscape viewports", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await page.goto("./");
    const stageBox = await page.locator(".stage").boundingBox();
    const plateBox = await page.locator(".plate-mount").boundingBox();
    if (!stageBox || !plateBox) throw new Error("missing bounding box");
    expect(plateBox.y).toBeGreaterThanOrEqual(stageBox.y);
    expect(plateBox.y + plateBox.height).toBeLessThanOrEqual(
      stageBox.y + stageBox.height,
    );
  });

  test("shows a feedback button wired to the Tally form", async ({ page }) => {
    const feedbackButton = page.getByRole("button", { name: "Give feedback" });
    await expect(feedbackButton).toBeVisible();
    await expect(feedbackButton).toHaveAttribute("data-tally-open", "0Qz2gP");
  });

  test("prefills the Tally form's version-number field with the app version", async ({
    page,
  }) => {
    const feedbackButton = page.getByRole("button", { name: "Give feedback" });
    await expect(feedbackButton).toHaveAttribute(
      "data-version-number",
      /^v\d+\.\d+\.\d+ \(\d{8}\)$/,
    );
  });

  test("prefills the Tally form's browser-string field with the user agent", async ({
    page,
  }) => {
    const feedbackButton = page.getByRole("button", { name: "Give feedback" });
    const userAgent = await page.evaluate(() => navigator.userAgent);
    await expect(feedbackButton).toHaveAttribute(
      "data-browser-string",
      userAgent,
    );
  });

  test("prefills the Tally form's operating-system field", async ({ page }) => {
    const feedbackButton = page.getByRole("button", { name: "Give feedback" });
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const expectedOs = /Android/.test(userAgent)
      ? "Android"
      : /iPhone|iPad|iPod/.test(userAgent)
        ? "iOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Macintosh|Mac OS X/.test(userAgent)
            ? "Mac"
            : /Linux/.test(userAgent)
              ? "Linux"
              : "Unknown";
    await expect(feedbackButton).toHaveAttribute(
      "data-operating-system",
      expectedOs,
    );
  });

  test("prefills the Tally form's language-preferences field", async ({
    page,
  }) => {
    const feedbackButton = page.getByRole("button", { name: "Give feedback" });
    const languages = await page.evaluate(() => navigator.languages.join(", "));
    await expect(feedbackButton).toHaveAttribute(
      "data-language-preferences",
      languages,
    );
  });

  test("shows a build version on the nameplate below the serial number", async ({
    page,
  }) => {
    const version = page.locator(".nameplate-version");
    await expect(version).toBeVisible();
    await expect(version).toHaveText(/^v\d+\.\d+\.\d+ \(\d{8}\)$/);
  });

  test("clicking the nameplate's question mark twice cycles it and unlocks an easter egg", async ({
    page,
  }) => {
    const mark = page.locator(".nameplate-mark");
    await expect(mark).toHaveText("?");
    await mark.click();
    await expect(mark).not.toHaveText("?");
    await mark.click();
    await expect(page.locator(".egg-toast")).toHaveAttribute(
      "data-egg-id",
      "questioning-the-question",
    );
  });
});
