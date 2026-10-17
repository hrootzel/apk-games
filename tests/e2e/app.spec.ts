import { expect, test, type Page } from '@playwright/test';
import type { ButtonName } from '../../src/game/types';
import type { ArcadeDebugSnapshot, VectorArcadeDebugWindow } from '../../src/app/debugTypes';

async function snapshot(page: Page): Promise<ArcadeDebugSnapshot> {
  return page.evaluate(() => {
    const bridge = (window as VectorArcadeDebugWindow).__VECTOR_ARCADE_DEBUG__;
    if (!bridge) throw new Error('Missing E2E bridge');
    return bridge.snapshot();
  });
}

async function waitForArcade(page: Page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean((window as VectorArcadeDebugWindow).__VECTOR_ARCADE_DEBUG__));
  await expect.poll(async () => (await snapshot(page)).mode, { timeout: 15_000 }).toBe('menu');
  await expect(page.locator('canvas.game-canvas')).toBeVisible();
}

async function launch(page: Page, gameId: 'asteroids' | 'tempest') {
  await waitForArcade(page);
  const menuFrame = (await snapshot(page)).frameCount;
  await page.locator(`.arcade-menu-item[data-entry-id="${gameId}"]`).click();

  // startGame() switches mode synchronously, while HUD text is refreshed by the
  // next Pixi ticker frame. Wait for the actual game state and at least one
  // post-menu frame instead of reading the previous menu HUD.
  await expect.poll(async () => {
    const current = await snapshot(page);
    return current.mode === 'game'
      && current.activeGameId === gameId
      && current.game !== null
      && current.frameCount > menuFrame;
  }, { timeout: 15_000 }).toBe(true);
}

async function setButton(page: Page, button: ButtonName, pressed: boolean, pointerId = 9000) {
  await page.evaluate(
    ({ button, pressed, pointerId }) => {
      const bridge = (window as VectorArcadeDebugWindow).__VECTOR_ARCADE_DEBUG__;
      if (!bridge) throw new Error('Missing E2E bridge');
      if (pressed) bridge.input.press(button, pointerId);
      else bridge.input.release(button, pointerId);
    },
    { button, pressed, pointerId },
  );
}

async function setButtonsAtomic(
  page: Page,
  changes: Array<{ button: ButtonName; pressed: boolean; pointerId: number }>,
) {
  await page.evaluate((changes) => {
    const bridge = (window as VectorArcadeDebugWindow).__VECTOR_ARCADE_DEBUG__;
    if (!bridge) throw new Error('Missing E2E bridge');
    for (const change of changes) {
      if (change.pressed) bridge.input.press(change.button, change.pointerId);
      else bridge.input.release(change.button, change.pointerId);
    }
  }, changes);
}

async function setJoystick(page: Page, x: number, y: number) {
  await page.evaluate(({ x, y }) => {
    const bridge = (window as VectorArcadeDebugWindow).__VECTOR_ARCADE_DEBUG__;
    if (!bridge) throw new Error('Missing E2E bridge');
    bridge.input.joystick(x, y);
  }, { x, y });
}

async function resetInput(page: Page) {
  await page.evaluate(() => (window as VectorArcadeDebugWindow).__VECTOR_ARCADE_DEBUG__?.input.reset());
}

/**
 * Keep one real PointerEvent smoke path so the browser-facing overlay remains
 * covered. Events target the actual control element and derive their position
 * from its live DOM rect instead of assuming a 1200x800 coordinate map.
 */
async function pointerOnControl(
  page: Page,
  type: 'pointerdown' | 'pointerup' | 'pointercancel',
  control: ButtonName | 'fire-thrust',
  pointerId: number,
) {
  await page.locator(`[data-control="${control}"]`).evaluate(
    (element, { type, pointerId }) => {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      element.dispatchEvent(new PointerEvent(type, {
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
    { type, pointerId },
  );
}

test.afterEach(async ({ page }) => {
  if (!page.isClosed()) await resetInput(page).catch(() => undefined);
});

test.describe('Vector Arcade shell and GPU integration', () => {
  test('boots Pixi/WebGL into the top-level program menu', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    await waitForArcade(page);

    const first = await snapshot(page);
    const hasWebGL = await page.locator('canvas.game-canvas').evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    });

    expect(hasWebGL).toBe(true);
    expect(first.mode).toBe('menu');
    await expect.poll(async () => (await snapshot(page)).frameCount, { timeout: 15_000 })
      .toBeGreaterThan(first.frameCount);
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

    await page.locator('input[data-setting="controlOpacity"]').fill('0.55');
    await expect.poll(async () => (await snapshot(page)).settings.controlOpacity, { timeout: 15_000 }).toBe(0.55);
    await expect(page.locator('output[data-value="controlOpacity"]')).toHaveText('0.55');

    await page.locator('.settings-close').click();
    await expect(page.locator('.arcade-menu')).toBeVisible();
  });

  test('launches Asteroids and preserves simultaneous joystick+A state through the E2E bridge', async ({ page }) => {
    await launch(page, 'asteroids');
    await expect(page.locator('.touch-overlay')).toBeVisible();

    await setJoystick(page, 0.85, 0);
    await setButton(page, 'a', true, 2002);

    await expect.poll(async () => {
      const input = (await snapshot(page)).input;
      return input.joystick.x > 0.8 && Math.abs(input.joystick.y) < 0.05 && input.buttons.a;
    }, { timeout: 15_000 }).toBe(true);

    await setButton(page, 'a', false, 2002);
    await setJoystick(page, 0, 0);
  });

  test('launches Tempest and advances the tube-shooter simulation', async ({ page }) => {
    await launch(page, 'tempest');
    const before = await snapshot(page);
    expect(before.mode).toBe('game');
    expect(before.activeGameId).toBe('tempest');
    expect((before.game as { laneCount: number }).laneCount).toBe(16);
    const initialLane = (before.game as { playerLane: number }).playerLane;

    await setJoystick(page, 1, 0);
    await setButton(page, 'a', true, 3001);

    await expect.poll(async () => {
      const game = (await snapshot(page)).game as { playerLane: number; bullets: unknown[] };
      return Math.abs(game.playerLane - initialLane) > 0.01 && game.bullets.length > 0;
    }, { timeout: 15_000 }).toBe(true);

    await setButton(page, 'a', false, 3001);
    await setJoystick(page, 0, 0);
  });

  test('maps simultaneous real PointerEvents from the lower-left steering buttons', async ({ page }) => {
    await launch(page, 'tempest');
    await pointerOnControl(page, 'pointerdown', 'l', 4003);
    await pointerOnControl(page, 'pointerdown', 'r', 4004);

    await expect.poll(async () => {
      const buttons = (await snapshot(page)).input.buttons;
      return buttons.l && buttons.r;
    }, { timeout: 15_000 }).toBe(true);

    await pointerOnControl(page, 'pointerup', 'l', 4003);
    await pointerOnControl(page, 'pointerup', 'r', 4004);
    await expect.poll(async () => {
      const buttons = (await snapshot(page)).input.buttons;
      return !buttons.l && !buttons.r;
    }, { timeout: 15_000 }).toBe(true);
  });

  test('Asteroids supports steering and combined fire/thrust with independent pointer release', async ({ page }) => {
    await launch(page, 'asteroids');
    await expect(page.locator('.joystick-shell')).toHaveCount(0);
    await expect(page.locator('[data-control="b"]')).toHaveText('THRUST');
    const before = (await snapshot(page)).game as { ship: { angle: number } };
    await pointerOnControl(page, 'pointerdown', 'r', 71);
    await pointerOnControl(page, 'pointerdown', 'fire-thrust', 72);
    await pointerOnControl(page, 'pointerdown', 'a', 73);
    await expect.poll(async () => {
      const current = await snapshot(page);
      const game = current.game as { ship: { angle: number }; bullets: unknown[] };
      return current.input.buttons.r && current.input.buttons.a && current.input.buttons.b
        && game.ship.angle !== before.ship.angle && game.bullets.length > 0;
    }, { timeout: 15_000 }).toBe(true);
    await pointerOnControl(page, 'pointercancel', 'fire-thrust', 72);
    expect((await snapshot(page)).input.buttons).toMatchObject({ a: true, b: false, r: true });
    await pointerOnControl(page, 'pointerup', 'a', 73);
    await pointerOnControl(page, 'pointerup', 'r', 71);
    expect((await snapshot(page)).input.buttons).toMatchObject({ a: false, b: false, r: false });
  });

  test('center touches are neutral and focus loss releases held touch controls', async ({ page }) => {
    await launch(page, 'asteroids');
    await page.locator('canvas.game-canvas').evaluate((canvas) => {
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, pointerId: 80, clientX: rect.width / 2, clientY: rect.height / 2,
      }));
    });
    expect(Object.values((await snapshot(page)).input.buttons).some(Boolean)).toBe(false);
    await pointerOnControl(page, 'pointerdown', 'fire-thrust', 81);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    expect(Object.values((await snapshot(page)).input.buttons).some(Boolean)).toBe(false);
  });

  test('Tempest drag steering is configurable, horizontal, and releases on cancellation', async ({ page }) => {
    await launch(page, 'tempest');
    await setButton(page, 'select', true);
    await expect(page.locator('.settings-panel')).toBeVisible();
    await setButton(page, 'select', false);
    await page.locator('input[data-setting="dragSteering"]').check();
    await page.locator('input[data-setting="controlSize"]').fill('90');
    await page.locator('input[data-setting="controlInset"]').fill('30');
    await page.locator('.settings-close').click();
    await expect(page.locator('[data-control="l"]')).toBeHidden();
    await expect(page.locator('.steering-strip')).toBeVisible();
    await expect(page.locator('[data-control="b"]')).toHaveText('SUPERZAP');
    await page.locator('.steering-strip').evaluate((strip) => {
      const rect = strip.getBoundingClientRect();
      const common = { bubbles: true, cancelable: true, pointerId: 91, pointerType: 'touch' };
      strip.dispatchEvent(new PointerEvent('pointerdown', { ...common, clientX: rect.left + rect.width / 2, clientY: rect.top + 20 }));
      strip.dispatchEvent(new PointerEvent('pointermove', { ...common, clientX: rect.right, clientY: rect.top + 40 }));
    });
    await pointerOnControl(page, 'pointerdown', 'a', 92);
    await expect.poll(async () => {
      const input = (await snapshot(page)).input;
      return input.joystick.x === 1 && input.joystick.y === 0 && input.buttons.a;
    }, { timeout: 15_000 }).toBe(true);
    await page.locator('.steering-strip').dispatchEvent('pointercancel', { pointerId: 91 });
    expect((await snapshot(page)).input.joystick).toEqual({ x: 0, y: 0 });
    expect((await snapshot(page)).input.buttons.a).toBe(true);
    await pointerOnControl(page, 'pointerup', 'a', 92);
    const current = await snapshot(page);
    expect(current.settings.controlSize).toBe(90);
    expect(current.settings.controlInset).toBe(30);
    // Returning to the shell clears any held pointers; the next profile supplies its own controls.
    await pointerOnControl(page, 'pointerdown', 'a', 93);
    await page.keyboard.press('Escape');
    expect((await snapshot(page)).input.buttons.a).toBe(false);
    await page.locator('.arcade-menu-item[data-entry-id="asteroids"]').click();
    await expect(page.locator('.steering-strip')).toHaveCount(0);
    await expect(page.locator('[data-control="b"]')).toHaveText('THRUST');
    await setButton(page, 'select', true);
    await expect(page.locator('.settings-panel')).toBeVisible();
    await setButton(page, 'select', false);
    await page.locator('input[data-setting="combinedFireThrust"]').uncheck();
    await page.locator('.settings-close').click();
    await expect(page.locator('[data-control="fire-thrust"]')).toBeHidden();
    await expect(page.locator('[data-control="a"]')).toBeVisible();
    await expect(page.locator('[data-control="b"]')).toBeVisible();
  });

  test('touch controls remain reachable without overlapping in tablet orientations', async ({ page }) => {
    await launch(page, 'asteroids');
    for (const viewport of [{ width: 1200, height: 800 }, { width: 800, height: 1200 }]) {
      await page.setViewportSize(viewport);
      const bounds = await page.locator('.touch-button:visible').evaluateAll((buttons) => buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }));
      for (const [index, rect] of bounds.entries()) {
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(viewport.width);
        expect(rect.top).toBeGreaterThanOrEqual(0);
        expect(rect.bottom).toBeLessThanOrEqual(viewport.height);
        for (const other of bounds.slice(index + 1)) {
          expect(rect.right <= other.left || rect.left >= other.right || rect.bottom <= other.top || rect.top >= other.bottom).toBe(true);
        }
      }
      await page.screenshot({ path: `out/controls-${viewport.width}x${viewport.height}.png` });
    }
  });

  test('Select opens global settings from a game and Start pauses the active game', async ({ page }) => {
    await launch(page, 'asteroids');

    await setButton(page, 'select', true, 5005);
    await expect(page.locator('.settings-panel')).toBeVisible({ timeout: 15_000 });
    await setButton(page, 'select', false, 5005);
    await page.locator('.settings-close').click();
    await expect(page.locator('.settings-panel')).toBeHidden();

    await setButton(page, 'start', true, 5006);
    await expect.poll(async () => Boolean(((await snapshot(page)).game as { paused: boolean }).paused), { timeout: 15_000 })
      .toBe(true);
    await setButton(page, 'start', false, 5006);
  });

  test('Start+Select chord atomically returns a running game to the arcade menu', async ({ page }) => {
    await launch(page, 'tempest');

    await setButtonsAtomic(page, [
      { button: 'select', pressed: true, pointerId: 6008 },
      { button: 'start', pressed: true, pointerId: 6009 },
    ]);

    await expect.poll(async () => (await snapshot(page)).mode, { timeout: 15_000 }).toBe('menu');

    await setButtonsAtomic(page, [
      { button: 'select', pressed: false, pointerId: 6008 },
      { button: 'start', pressed: false, pointerId: 6009 },
    ]);
    await expect(page.locator('.arcade-menu')).toBeVisible();
    await expect(page.locator('.touch-overlay')).toBeHidden();
  });

  test('desktop keyboard navigation can choose Tempest without touching the menu', async ({ page }) => {
    await waitForArcade(page);
    await page.keyboard.down('ArrowDown');
    await expect.poll(async () => (await snapshot(page)).menu.selectedId, { timeout: 15_000 }).toBe('tempest');
    await page.keyboard.up('ArrowDown');

    await page.keyboard.down('Space');
    await expect.poll(async () => (await snapshot(page)).activeGameId, { timeout: 15_000 }).toBe('tempest');
    await page.keyboard.up('Space');
  });

  test('resizes the Pixi surface and active Tempest game on orientation change', async ({ page }) => {
    await launch(page, 'tempest');
    await page.setViewportSize({ width: 800, height: 1200 });

    await expect.poll(async () => {
      const current = await snapshot(page);
      const game = current.game as { width: number; height: number };
      return [Math.round(current.screen.width), Math.round(current.screen.height), game.width, game.height];
    }, { timeout: 15_000 }).toEqual([800, 1200, 800, 1200]);
  });
});
