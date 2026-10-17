import { expect, test, type Page } from '@playwright/test';

async function waitForArcade(page: Page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__VECTOR_ARCADE_DEBUG__?.snapshot().frameCount));
}

async function launch(page: Page, gameId: 'asteroids' | 'tempest') {
  await waitForArcade(page);
  await page.locator(`.arcade-menu-item[data-entry-id="${gameId}"]`).click();
  await expect.poll(async () => (await page.evaluate(() => window.__VECTOR_ARCADE_DEBUG__!.snapshot().activeGameId))).toBe(gameId);
}

async function pointer(page: Page, type: 'pointerdown' | 'pointermove' | 'pointerup', pointerId: number, x: number, y: number) {
  await page.evaluate(
    ({ type, pointerId, x, y }) => {
      const root = document.querySelector<HTMLElement>('#app');
      if (!root) throw new Error('Missing #app');
      root.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId,
        pointerType: 'touch',
        isPrimary: pointerId === 1,
        buttons: type === 'pointerup' ? 0 : 1,
      }));
    },
    { type, pointerId, x, y },
  );
}

test.describe('Vector Arcade shell and GPU integration', () => {
  test('boots Pixi/WebGL into the top-level program menu', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    await waitForArcade(page);

    const first = await page.evaluate(() => window.__VECTOR_ARCADE_DEBUG__!.snapshot());
    await page.waitForTimeout(120);
    const second = await page.evaluate(() => window.__VECTOR_ARCADE_DEBUG__!.snapshot());
    const hasWebGL = await page.locator('canvas.game-canvas').evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    });

    expect(hasWebGL).toBe(true);
    expect(first.mode).toBe('menu');
    expect(second.frameCount).toBeGreaterThan(first.frameCount);
    await expect(page.locator('.arcade-menu')).toBeVisible();
    await expect(page.locator('.arcade-menu-item')).toHaveCount(3);
    await expect(page.locator('.arcade-menu-item[data-entry-id="asteroids"]')).toContainText('ASTEROIDS');
    await expect(page.locator('.arcade-menu-item[data-entry-id="tempest"]')).toContainText('TEMPEST');
    await expect(page.locator('.arcade-menu-item[data-entry-id="configuration"]')).toContainText('CONFIGURATION');
    expect(pageErrors).toEqual([]);
  });

  test('opens global Configuration from the menu and changes live display settings', async ({ page }) => {
    await waitForArcade(page);
    await page.locator('.arcade-menu-item[data-entry-id="configuration"]').click();
    await expect(page.locator('.settings-panel')).toBeVisible();

    const before = await page.evaluate(() => window.__VECTOR_ARCADE_DEBUG__!.snapshot().frameCount);
    await page.locator('input[data-setting="controlOpacity"]').fill('0.55');
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => window.__VECTOR_ARCADE_DEBUG__!.snapshot().frameCount);
    expect(after).toBeGreaterThan(before);
    await page.locator('.settings-close').click();
    await expect(page.locator('.arcade-menu')).toBeVisible();
  });

  test('launches Asteroids from the menu and preserves simultaneous joystick+A touch', async ({ page }) => {
    await launch(page, 'asteroids');
    await expect(page.locator('.touch-overlay')).toBeVisible();

    await pointer(page, 'pointerdown', 1, 600, 400);
    await pointer(page, 'pointermove', 1, 700, 400);
    await pointer(page, 'pointerdown', 2, 1050, 600);
    await page.waitForTimeout(50);

    const active = await page.evaluate(() => window.__VECTOR_ARCADE_DEBUG__!.snapshot().input);
    expect(active.joystick.x).toBeGreaterThan(0.6);
    expect(Math.abs(active.joystick.y)).toBeLessThan(0.1);
    expect(active.buttons.a).toBe(true);

    await pointer(page, 'pointerup', 2, 1050, 600);
    await pointer(page, 'pointerup', 1, 700, 400);
  });

  test('launches Tempest and advances the tube-shooter simulation', async ({ page }) => {
    await launch(page, 'tempest');
    const before = await page.evaluate(() => window.__VECTOR_ARCADE_DEBUG__!.snapshot());
    expect(before.hud).toContain('TUBE VECTOR');
    expect((before.game as { laneCount: number }).laneCount).toBe(16);

    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('Space');
    await page.waitForTimeout(160);
    await page.keyboard.up('Space');
    await page.keyboard.up('ArrowRight');

    const after = await page.evaluate(() => window.__VECTOR_ARCADE_DEBUG__!.snapshot());
    expect((after.game as { playerLane: number }).playerLane).not.toBe((before.game as { playerLane: number }).playerLane);
    expect((after.game as { bullets: unknown[] }).bullets.length).toBeGreaterThan(0);
  });

  test('supports simultaneous L/R strip input inside either game', async ({ page }) => {
    await launch(page, 'tempest');
    await pointer(page, 'pointerdown', 3, 120, 30);
    await pointer(page, 'pointerdown', 4, 1080, 30);
    await page.waitForTimeout(40);

    const active = await page.evaluate(() => window.__VECTOR_ARCADE_DEBUG__!.snapshot().input.buttons);
    expect(active.l).toBe(true);
    expect(active.r).toBe(true);

    await pointer(page, 'pointerup', 3, 120, 30);
    await pointer(page, 'pointerup', 4, 1080, 30);
  });

  test('Select opens global settings from a game and Start pauses the active game', async ({ page }) => {
    await launch(page, 'asteroids');

    await pointer(page, 'pointerdown', 5, 150, 775);
    await page.waitForTimeout(40);
    await pointer(page, 'pointerup', 5, 150, 775);
    await expect(page.locator('.settings-panel')).toBeVisible();
    await page.locator('.settings-close').click();

    await pointer(page, 'pointerdown', 6, 1050, 775);
    await page.waitForTimeout(40);
    await pointer(page, 'pointerup', 6, 1050, 775);
    await expect.poll(async () => (await page.evaluate(() => window.__VECTOR_ARCADE_DEBUG__!.snapshot().hud))).toContain('PAUSED');
  });

  test('Start+Select chord returns a running game to the arcade menu', async ({ page }) => {
    await launch(page, 'tempest');
    await pointer(page, 'pointerdown', 8, 150, 775);
    await pointer(page, 'pointerdown', 9, 1050, 775);
    await page.waitForTimeout(50);
    await pointer(page, 'pointerup', 8, 150, 775);
    await pointer(page, 'pointerup', 9, 1050, 775);

    await expect.poll(async () => (await page.evaluate(() => window.__VECTOR_ARCADE_DEBUG__!.snapshot().mode))).toBe('menu');
    await expect(page.locator('.arcade-menu')).toBeVisible();
    await expect(page.locator('.touch-overlay')).toBeHidden();
  });

  test('desktop keyboard navigation can choose Tempest without touching the menu', async ({ page }) => {
    await waitForArcade(page);
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(40);
    await page.keyboard.up('ArrowDown');
    await page.waitForTimeout(30);
    await page.keyboard.down('Space');
    await page.waitForTimeout(40);
    await page.keyboard.up('Space');
    await expect.poll(async () => (await page.evaluate(() => window.__VECTOR_ARCADE_DEBUG__!.snapshot().activeGameId))).toBe('tempest');
  });

  test('resizes the Pixi surface and active Tempest game on orientation change', async ({ page }) => {
    await launch(page, 'tempest');
    await page.setViewportSize({ width: 800, height: 1200 });

    await expect.poll(async () => {
      const snapshot = await page.evaluate(() => window.__VECTOR_ARCADE_DEBUG__!.snapshot());
      return [Math.round(snapshot.screen.width), Math.round(snapshot.screen.height), (snapshot.game as { width: number; height: number }).width, (snapshot.game as { width: number; height: number }).height];
    }).toEqual([800, 1200, 800, 1200]);
  });
});
