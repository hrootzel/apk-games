import { describe, expect, it, vi } from 'vitest';
import {
  AsteroidsGame,
  type AsteroidState,
  type GameState,
} from '../../src/game/AsteroidsGame';
import { input, seededRandom } from './helpers';

function emptyGame(options: ConstructorParameters<typeof AsteroidsGame>[0] = {}) {
  return new AsteroidsGame({
    initialAsteroidCount: 0,
    autoRespawn: false,
    random: seededRandom(42),
    ...options,
  });
}

function baseState(game: AsteroidsGame): GameState {
  const state = game.exportState();
  state.width = 1000;
  state.height = 600;
  state.ship = { x: 500, y: 300, vx: 0, vy: 0, angle: 0, invulnerableMs: 0 };
  state.bullets = [];
  state.asteroids = [];
  state.shootCooldownMs = 0;
  state.score = 0;
  state.paused = false;
  return state;
}

function asteroid(overrides: Partial<AsteroidState> = {}): AsteroidState {
  return {
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    radius: 30,
    rotation: 0,
    rotationSpeed: 0,
    vertices: [1, 1, 1, 1, 1, 1, 1, 1],
    color: 0xffffff,
    ...overrides,
  };
}

describe('AsteroidsGame movement and controls', () => {
  it('resizes safely, wraps the ship, and reports HUD mode', () => {
    const game = emptyGame();
    const state = baseState(game);
    state.ship.x = 1200;
    state.ship.y = -20;
    game.importState(state);

    game.resize(800, 400);
    const resized = game.exportState();
    expect(resized.width).toBe(800);
    expect(resized.height).toBe(400);
    expect(resized.ship.x).toBe(400);
    expect(resized.ship.y).toBe(380);
    expect(game.getHudText()).toContain('VECTOR MODE');
  });

  it('wraps ship motion around the playfield', () => {
    const game = emptyGame();
    const state = baseState(game);
    state.ship = { ...state.ship, x: 999, vx: 100 };
    game.importState(state);

    game.update(50, input());
    expect(game.exportState().ship.x).toBeGreaterThanOrEqual(0);
    expect(game.exportState().ship.x).toBeLessThan(10);
  });

  it('combines analog steering and thrust with inertial motion', () => {
    const game = emptyGame();
    game.importState(baseState(game));

    game.update(50, input({}, { x: 1, y: -1 }));
    const state = game.exportState();
    expect(state.ship.angle).toBeCloseTo(0.185, 3);
    expect(state.ship.vx).toBeGreaterThan(15);
    expect(state.ship.vy).toBeGreaterThan(0);
  });

  it('applies braking when Y is held', () => {
    const game = emptyGame();
    const state = baseState(game);
    state.ship.vx = 300;
    game.importState(state);

    game.update(50, input({ y: true }));
    expect(game.exportState().ship.vx).toBeLessThan(270);
  });

  it('pauses on the Start press edge and does not retrigger while held', () => {
    const game = emptyGame();
    game.importState(baseState(game));

    game.update(16, input({ start: true }));
    expect(game.exportState().paused).toBe(true);
    game.update(16, input({ start: true }));
    expect(game.exportState().paused).toBe(true);
    game.update(16, input({ start: false }));
    game.update(16, input({ start: true }));
    expect(game.exportState().paused).toBe(false);
  });

  it('requests settings only on the Select press edge', () => {
    const onSettingsRequested = vi.fn();
    const game = emptyGame({ onSettingsRequested });
    game.importState(baseState(game));

    game.update(16, input({ select: true }));
    game.update(16, input({ select: true }));
    game.update(16, input({ select: false }));
    game.update(16, input({ select: true }));
    expect(onSettingsRequested).toHaveBeenCalledTimes(2);
  });

  it('hyperspaces to deterministic coordinates and grants invulnerability', () => {
    const values = [0.25, 0.75];
    const game = emptyGame({ random: () => values.shift() ?? 0.5 });
    const state = baseState(game);
    state.ship.vx = 100;
    state.ship.vy = 50;
    game.importState(state);

    game.update(0, input({ x: true }));
    const after = game.exportState().ship;
    expect(after.x).toBeCloseTo(325, 6);
    expect(after.y).toBeCloseTo(405, 6);
    expect(after.vx).toBeCloseTo(40, 6);
    expect(after.vy).toBeCloseTo(20, 6);
    expect(after.invulnerableMs).toBe(850);
  });
});

describe('AsteroidsGame shooting and collisions', () => {
  it('fires repeatedly on the cooldown while A remains held', () => {
    const game = emptyGame();
    game.importState(baseState(game));

    game.update(0, input({ a: true }));
    expect(game.exportState().bullets).toHaveLength(1);
    game.update(100, input({ a: true }));
    expect(game.exportState().bullets).toHaveLength(1);
    game.update(55, input({ a: true }));
    expect(game.exportState().bullets).toHaveLength(2);
  });

  it('removes bullets when their lifetime expires', () => {
    const game = emptyGame();
    const state = baseState(game);
    state.bullets = [{ x: 100, y: 100, vx: 0, vy: 0, lifeMs: 10 }];
    game.importState(state);

    game.update(11, input());
    expect(game.exportState().bullets).toHaveLength(0);
  });

  it('scores and splits large asteroids when struck', () => {
    const game = emptyGame({ random: seededRandom(5) });
    const state = baseState(game);
    state.ship.x = 800;
    state.ship.y = 500;
    state.bullets = [{ x: 100, y: 100, vx: 0, vy: 0, lifeMs: 100 }];
    state.asteroids = [asteroid({ radius: 60 })];
    game.importState(state);

    game.update(0, input());
    const after = game.exportState();
    expect(after.bullets).toHaveLength(0);
    expect(after.asteroids).toHaveLength(2);
    expect(after.asteroids[0]!.radius).toBeCloseTo(34.8, 6);
    expect(after.score).toBe(Math.round(1400 / 60));
  });

  it('removes small asteroids without splitting them', () => {
    const game = emptyGame();
    const state = baseState(game);
    state.ship.x = 800;
    state.ship.y = 500;
    state.bullets = [{ x: 100, y: 100, vx: 0, vy: 0, lifeMs: 100 }];
    state.asteroids = [asteroid({ radius: 30 })];
    game.importState(state);

    game.update(0, input());
    expect(game.exportState().asteroids).toHaveLength(0);
  });

  it('detects bullet collisions through opposite screen edges', () => {
    const game = emptyGame();
    const state = baseState(game);
    state.ship.x = 500;
    state.ship.y = 500;
    state.bullets = [{ x: 2, y: 100, vx: 0, vy: 0, lifeMs: 100 }];
    state.asteroids = [asteroid({ x: 998, y: 100, radius: 10 })];
    game.importState(state);

    game.update(0, input());
    expect(game.exportState().asteroids).toHaveLength(0);
  });

  it('respawns the ship at center after an unprotected collision', () => {
    const game = emptyGame();
    const state = baseState(game);
    state.ship = { ...state.ship, x: 100, y: 100, vx: 40, invulnerableMs: 0 };
    state.asteroids = [asteroid({ x: 100, y: 100, radius: 30 })];
    game.importState(state);

    game.update(0, input());
    const ship = game.exportState().ship;
    expect(ship.x).toBe(500);
    expect(ship.y).toBe(300);
    expect(ship.vx).toBe(0);
    expect(ship.invulnerableMs).toBe(1400);
  });
});

describe('AsteroidsGame world lifecycle and rendering data', () => {
  it('automatically starts a ten-asteroid wave when the field is empty', () => {
    const game = new AsteroidsGame({ initialAsteroidCount: 0, autoRespawn: true, random: seededRandom(99) });
    game.update(0, input());
    expect(game.exportState().asteroids).toHaveLength(10);
  });

  it('exports deep state snapshots that cannot mutate the running game', () => {
    const game = emptyGame();
    const state = baseState(game);
    state.asteroids = [asteroid()];
    game.importState(state);

    const exported = game.exportState();
    exported.ship.x = 1;
    exported.asteroids[0]!.vertices[0] = 99;
    const fresh = game.exportState();
    expect(fresh.ship.x).toBe(500);
    expect(fresh.asteroids[0]!.vertices[0]).toBe(1);
  });

  it('emits vector paths for asteroid, bullet, ship, and active thrust flame', () => {
    const game = emptyGame({ random: () => 0.5 });
    const state = baseState(game);
    state.ship.invulnerableMs = 0;
    state.asteroids = [asteroid()];
    state.bullets = [{ x: 200, y: 200, vx: 100, vy: 0, lifeMs: 100 }];
    game.importState(state);

    const paths = game.getVectorPaths(input({ b: true }));
    expect(paths).toHaveLength(4);
    expect(paths.some((path) => path.closed && path.color === 0x62f4ff)).toBe(true);
    expect(paths.some((path) => path.color === 0xff5a3d)).toBe(true);
  });
});
