import { test, expect } from "@playwright/test";
test("menu, real movement, rewind, pause, settings, and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Begin experiment" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/main-menu.png" });
  await page.getByRole("button", { name: "Begin experiment" }).click();
  await expect(page.locator("#room-title")).toHaveText("The first correction");
  const start = await page.evaluate(
    () => (window as any).rewindDebug.sim().state.player.z,
  );
  await page.keyboard.down("w");
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as any).rewindDebug.sim().state.player.z),
      { timeout: 10000 },
    )
    .toBeLessThan(start - 1);
  await page.keyboard.up("w");
  const moved = await page.evaluate(
    () => (window as any).rewindDebug.sim().state.player.z,
  );
  expect(moved).toBeLessThan(start - 1);
  await page.keyboard.down("r");
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as any).rewindDebug.sim().state.player.z),
      { timeout: 10000 },
    )
    .toBeGreaterThan(moved + 0.5);
  await page.keyboard.up("r");
  expect(
    await page.evaluate(() => (window as any).rewindDebug.sim().state.player.z),
  ).toBeGreaterThan(moved);
  await page.keyboard.press("Escape");
  const tick = await page.evaluate(
    () => (window as any).rewindDebug.sim().state.tick,
  );
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => (window as any).rewindDebug.sim().state.tick),
  ).toBe(tick);
  await page.getByRole("button", { name: "Sound & display" }).click();
  await page.locator("#quality").selectOption("low");
  await page.getByRole("button", { name: "Save & return" }).click();
  await page.reload();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("rewind-room-v1")!).quality,
    ),
  ).toBe("low");
  expect(errors).toEqual([]);
});
test("tutorial interaction and exit advance progression", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Begin experiment" }).click();
  await page.evaluate(() => {
    const a = (window as any).rewindDebug.app;
    const s = a.sim;
    const go = (x: number, z: number) => {
      for (
        let i = 0;
        i < 300 &&
        Math.hypot(x - s.state.player.x, z - s.state.player.z) > 0.09;
        i++
      )
        s.step({
          x:
            Math.abs(x - s.state.player.x) > 0.06
              ? Math.sign(x - s.state.player.x)
              : 0,
          z:
            Math.abs(z - s.state.player.z) > 0.06
              ? Math.sign(z - s.state.player.z)
              : 0,
        });
    };
    go(-2, 2);
    s.step({ x: 0, z: 0, interact: true });
    go(0, 2);
    go(0, -4.3);
  });
  await expect(page.getByText("A future opens.")).toBeVisible();
  await page.getByRole("button", { name: "Enter next chamber" }).click();
  await expect(page.locator("#room-title")).toHaveText("Hold the line");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("rewind-room-v1")!).unlocked,
    ),
  ).toBe(1);
  await page.screenshot({ path: "test-results/playing.png" });
});
test("mobile controls fit and move the player", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Begin experiment" }).click();
  const up = page.getByRole("button", { name: "Move forward" });
  await expect(up).toBeVisible();
  const box = (await up.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).rewindDebug.sim().state.player.z),
    )
    .toBeLessThan(3.3);
  await page.mouse.up();
  await expect(page.locator("#timeline")).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png" });
});
test("five real solution routes reach the ending and persist all rooms", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "Begin experiment" }).click();
  for (let id = 0; id < 5; id++) {
    await page.evaluate((id) => {
      const s = (window as any).rewindDebug.sim();
      const wait = (n: number) => {
        for (let i = 0; i < n; i++) s.step();
      };
      const go = (x: number, z: number) => {
        for (
          let i = 0;
          i < 600 &&
          Math.hypot(x - s.state.player.x, z - s.state.player.z) > 0.09;
          i++
        ) {
          if (s.state.outcome === "won") return;
          if (s.state.outcome !== "active") throw Error(s.state.reason);
          s.step({
            x:
              Math.abs(x - s.state.player.x) > 0.06
                ? Math.sign(x - s.state.player.x)
                : 0,
            z:
              Math.abs(z - s.state.player.z) > 0.06
                ? Math.sign(z - s.state.player.z)
                : 0,
          });
        }
      };
      const record = (i: number) => {
        const p = s.room.plates[i];
        go(p.x, 3.8);
        go(p.x, p.z);
        wait(1050 - s.state.tick);
        if (!s.commit()) throw Error("commit failed");
      };
      const interact = () => s.step({ x: 0, z: 0, interact: true });
      const scanner = () => {
        while (s.state.tick % 120 < 50 || s.state.tick % 120 > 80) s.step();
      };
      if (id === 0) {
        go(-2, 2);
        interact();
        go(0, 2);
        go(0, -4.3);
      }
      if (id === 1) {
        record(0);
        go(0, -4.3);
      }
      if (id === 2) {
        record(0);
        record(1);
        go(2, 3.8);
        go(2, -0.7);
        go(0, -0.7);
        go(0, -4.3);
      }
      if (id === 3) {
        record(0);
        go(0, -3.2);
        scanner();
        go(0, -4.3);
      }
      if (id === 4) {
        record(0);
        record(1);
        go(3, 3.2);
        interact();
        go(0, 3.2);
        go(0, -0.4);
        interact();
        go(0, -0.8);
        scanner();
        go(0, -4.3);
      }
      if (s.state.outcome !== "won") throw Error("Route did not win");
    }, id);
    await page
      .getByRole("button", {
        name: id === 4 ? "Leave the facility" : "Enter next chamber",
      })
      .click();
  }
  await expect(page.getByText("You made time.")).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("rewind-room-v1")!).completed,
    ),
  ).toEqual([0, 1, 2, 3, 4]);
});
