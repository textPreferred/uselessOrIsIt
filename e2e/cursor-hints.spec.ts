import { expect, test } from "@playwright/test";
import { dragOnto } from "./support";

test.describe("useless machine — cursor hints don't spoil secrets", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
  });

  test("draggable and unscrewable secrets show no special cursor before they're touched", async ({
    page,
  }) => {
    const cursorOf = (selector: string) =>
      page.locator(selector).evaluate((el) => getComputedStyle(el).cursor);

    await expect(cursorOf(".screw-tl")).resolves.toBe("auto");
    await expect(cursorOf(".nameplate-version")).resolves.toBe("auto");
    await expect(cursorOf(".label-tape-off")).resolves.toBe("auto");

    // reach the wall-mounted secrets and the ajar plate itself
    const offLabel = page.locator(".label-tape-off");
    for (const corner of [".screw-tl", ".screw-tr", ".screw-bl", ".screw-br"]) {
      await dragOnto(page, offLabel, page.locator(corner));
    }
    await expect(page.locator(".plate")).toHaveClass(/open/);

    await expect(cursorOf(".plate")).resolves.toBe("auto");
    await expect(cursorOf(".wall-tape-group")).resolves.toBe("auto");
    await expect(cursorOf(".wall-panel")).resolves.toBe("auto");

    // control: an always-visible, genuinely obvious button keeps its pointer cursor
    await expect(cursorOf(".feedback-button")).resolves.toBe("pointer");
  });
});
