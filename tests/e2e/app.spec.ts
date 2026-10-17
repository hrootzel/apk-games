import { expect, test, type Page } from '@playwright/test';

async function waitForGame(page: Page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__VECTOR_ASTEROIDS_DEBUG__?.snapshot().frameCount));
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

test.describe('Vector Asteroids browser/GPU integration', () => {
  test('boots Pixi with WebGL and advances frames without page errors', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await waitForGame(page);
    const first = await page.evaluate(() => window.__VECTOR_ASTEROIDS_DEBUG__!.snapshot());
    await page.waitForTimeout(120);
    const second = await page.evaluate(() => window.__VECTOR_ASTEROIDS_DEBUG__!.snapshot());

    const hasWebGL = await page.locator('canvas.game-canvas').evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    });
    expect(hasWebGL).toBe(true);
    expect(second.frameCount).toBeGreaterThan(first.frameCount);
    expect(second.hud).toContain('VECTOR MODE');
    await expect(page.locator('canvas.game-canvas')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('supports simultaneous joystick and A-button touch pointers', async ({ page }) => {
    await waitForGame(page);

    await pointer(page, 'pointerdown', 1, 600, 400);
    await pointer(page, 'pointermove', 1, 700, 400);
    await pointer(page, 'pointerdown', 2, 1050, 600);
    await page.waitForTimeout(50);

    const active = await page.evaluate(() => window.__VECTOR_ASTEROIDS_DEBUG__!.snapshot().input);
    expect(active.joystick.x).toBeGreaterThan(0.6);
    expect(Math.abs(active.joystick.y)).toBeLessThan(0.1);
    expect(active.buttons.a).toBe(true);

    await pointer(page, 'pointerup', 2, 1050, 600);
    await pointer(page, 'pointerup', 1, 700, 400);
    await page.waitForTimeout(40);
    const released = await page.evaluate(() => window.__VECTOR_ASTEROIDS_DEBUG__!.snapshot().input);
    expect(released.buttons.a).toBe(false);
    expect(released.joystick.x).toBeCloseTo(0, 5);
    expect(released.joystick.y).toBeCloseTo(0, 5);
  });

  test('recognizes simultaneous L/R strip input', async ({ page }) => {
    await waitForGame(page);
    await pointer(page, 'pointerdown', 3, 120, 30);
    await pointer(page, 'pointerdown', 4, 1080, 30);
    await page.waitForTimeout(40);

    const active = await page.evaluate(() => window.__VECTOR_ASTEROIDS_DEBUG__!.snapshot().input.buttons);
    expect(active.l).toBe(true);
    expect(active.r).toBe(true);

    await pointer(page, 'pointerup', 3, 120, 30);
    await pointer(page, 'pointerup', 4, 1080, 30);
  });

  test('maps Select to display settings and Start to pause', async ({ page }) => {
    await waitForGame(page);

    await pointer(page, 'pointerdown', 5, 150, 775);
    await page.waitForTimeout(40);
    await pointer(page, 'pointerup', 5, 150, 775);
    await expect(page.locator('.settings-panel')).toBeVisible();

    await page.locator('.settings-close').click();
    await expect(page.locator('.settings-panel')).toBeHidden();

    await pointer(page, 'pointerdown', 6, 1050, 775);
    await page.waitForTimeout(40);
    await pointer(page, 'pointerup', 6, 1050, 775);
    await expect.poll(async () => (await page.evaluate(() => window.__VECTOR_ASTEROIDS_DEBUG__!.snapshot().hud))).toContain('PAUSED');
  });

  test('supports desktop keyboard debugging bindings', async ({ page }) => {
    await waitForGame(page);
    await page.keyboard.down('Space');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(40);

    const active = await page.evaluate(() => window.__VECTOR_ASTEROIDS_DEBUG__!.snapshot().input);
    expect(active.buttons.a).toBe(true);
    expect(active.joystick.x).toBe(-1);

    await page.keyboard.up('Space');
    await page.keyboard.up('ArrowLeft');
  });

  test('resizes the Pixi screen when orientation changes', async ({ page }) => {
    await waitForGame(page);
    await page.setViewportSize({ width: 800, height: 1200 });

    await expect.poll(async () => {
      const screen = await page.evaluate(() => window.__VECTOR_ASTEROIDS_DEBUG__!.snapshot().screen);
      return [Math.round(screen.width), Math.round(screen.height)];
    }).toEqual([800, 1200]);
  });

  test('settings sliders update live without breaking the render loop', async ({ page }) => {
    await waitForGame(page);
    await pointer(page, 'pointerdown', 7, 150, 775);
    await page.waitForTimeout(40);
    await pointer(page, 'pointerup', 7, 150, 775);

    const before = await page.evaluate(() => window.__VECTOR_ASTEROIDS_DEBUG__!.snapshot().frameCount);
    const controlOpacity = page.locator('input[data-setting="controlOpacity"]');
    await controlOpacity.fill('0.55');
    await expect.poll(async () => page.locator('.touch-overlay').evaluate((element) => (element as HTMLElement).style.getPropertyValue('--control-opacity'))).toBe('0.55');
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => window.__VECTOR_ASTEROIDS_DEBUG__!.snapshot().frameCount);
    expect(after).toBeGreaterThan(before);
  });
});
