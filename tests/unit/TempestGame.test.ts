import { describe, expect, it, vi } from 'vitest';
import {
  TempestGame,
  type TempestEnemyState,
  type TempestState,
} from '../../src/game/TempestGame';
import { input, seededRandom } from './helpers';

function emptyTempest(options: ConstructorParameters<typeof TempestGame>[0] = {}) {
  return new TempestGame({
    initialEnemyCount: 0,
    autoSpawn: false,
    random: seededRandom(17),
    ...options,
  });
}

function baseState(game: TempestGame): TempestState {
  const state = game.exportState();
  state.width = 1000;
  state.height = 700;
  state.playerLane = 0;
  state.playerVelocity = 0;
  state.bullets = [];
  state.enemies = [];
  state.shootCooldownMs = 0;
  state.spawnCooldownMs = 500;
  state.score = 0;
  state.wave = 1;
  state.lives = 3;
  state.superCharges = 2;
  state.paused = false;
  state.invulnerableMs = 0;
  state.nextEnemyId = 10;
  return state;
}

function enemy(overrides: Partial<TempestEnemyState> = {}): TempestEnemyState {
  return {
    id: 1,
    lane: 2,
    depth: 0.5,
    speed: 0,
    kind: 'flipper',
    color: 0xff5470,
    ...overrides,
  };
}

describe('TempestGame movement and controls', () => {
  it('resizes safely and reports tube-vector HUD state', () => {
    const game = emptyTempest();
    game.resize(0, -20);
    const state = game.exportState();
    expect(state.width).toBe(1);
    expect(state.height).toBe(1);
    expect(game.getHudText()).toContain('TUBE VECTOR');
  });

  it('moves around the tube rim and wraps lane position', () => {
    const game = emptyTempest();
    const state = baseState(game);
    state.playerLane = 15.95;
    state.playerVelocity = 9;
    game.importState(state);

    game.update(50, input({}, { x: 1, y: 0 }));
    const after = game.exportState();
    expect(after.playerLane).toBeGreaterThanOrEqual(0);
    expect(after.playerLane).toBeLessThan(16);
    expect(after.playerVelocity).toBeGreaterThan(8);
  });

  it('uses Y as a precision/slow response modifier', () => {
    const fast = emptyTempest();
    fast.importState(baseState(fast));
    fast.update(50, input({}, { x: 1, y: 0 }));

    const precise = emptyTempest();
    precise.importState(baseState(precise));
    precise.update(50, input({ y: true }, { x: 1, y: 0 }));

    expect(precise.exportState().playerVelocity).toBeLessThan(fast.exportState().playerVelocity);
  });

  it('pauses on Start edge and requests settings on Select edge', () => {
    const onSettingsRequested = vi.fn();
    const game = emptyTempest({ onSettingsRequested });
    game.importState(baseState(game));

    game.update(16, input({ start: true }));
    expect(game.exportState().paused).toBe(true);
    game.update(16, input({ start: true }));
    expect(game.exportState().paused).toBe(true);
    game.update(16, input({ start: false }));
    game.update(16, input({ start: true }));
    expect(game.exportState().paused).toBe(false);

    game.update(16, input({ select: true }));
    game.update(16, input({ select: true }));
    game.update(16, input({ select: false }));
    game.update(16, input({ select: true }));
    expect(onSettingsRequested).toHaveBeenCalledTimes(2);
  });

  it('phase-jumps to a deterministic lane and grants protection', () => {
    const game = emptyTempest({ random: () => 0.75 });
    game.importState(baseState(game));

    game.update(0, input({ x: true }));
    const state = game.exportState();
    expect(state.playerLane).toBe(12);
    expect(state.playerVelocity).toBe(0);
    expect(state.invulnerableMs).toBe(800);
  });
});

describe('TempestGame weapons and collisions', () => {
  it('fires repeatedly on a held A button with cooldown', () => {
    const game = emptyTempest();
    game.importState(baseState(game));

    game.update(0, input({ a: true }));
    expect(game.exportState().bullets).toHaveLength(1);
    game.update(100, input({ a: true }));
    expect(game.exportState().bullets).toHaveLength(1);
    game.update(25, input({ a: true }));
    expect(game.exportState().bullets).toHaveLength(2);
  });

  it('removes bullets after they reach the tube center', () => {
    const game = emptyTempest();
    const state = baseState(game);
    state.bullets = [{ lane: 0, depth: 0.04, speed: 1.5 }];
    game.importState(state);
    game.update(16, input());
    expect(game.exportState().bullets).toHaveLength(0);
  });

  it('destroys enemies and scores when a bullet intersects their lane/depth', () => {
    const game = emptyTempest();
    const state = baseState(game);
    state.bullets = [{ lane: 2, depth: 0.5, speed: 0 }];
    state.enemies = [enemy({ lane: 2.2, depth: 0.52, kind: 'spinner' })];
    game.importState(state);

    game.update(0, input());
    const after = game.exportState();
    expect(after.bullets).toHaveLength(0);
    expect(after.enemies).toHaveLength(0);
    expect(after.score).toBe(175);
  });

  it('detects lane collisions across the seam between lane 0 and lane 15', () => {
    const game = emptyTempest();
    const state = baseState(game);
    state.bullets = [{ lane: 0.1, depth: 0.5, speed: 0 }];
    state.enemies = [enemy({ lane: 15.8, depth: 0.5 })];
    game.importState(state);
    game.update(0, input());
    expect(game.exportState().enemies).toHaveLength(0);
  });

  it('uses B super-zap only on the button edge, clearing the tube and consuming a charge', () => {
    const game = emptyTempest();
    const state = baseState(game);
    state.enemies = [enemy({ id: 1 }), enemy({ id: 2, lane: 7 })];
    game.importState(state);

    game.update(0, input({ b: true }));
    const after = game.exportState();
    expect(after.enemies).toHaveLength(0);
    expect(after.superCharges).toBe(1);
    expect(after.score).toBe(150);

    game.update(0, input({ b: true }));
    expect(game.exportState().superCharges).toBe(1);
  });

  it('loses a life when an enemy reaches the player lane at the rim', () => {
    const game = emptyTempest();
    const state = baseState(game);
    state.playerLane = 4;
    state.enemies = [enemy({ lane: 4.2, depth: 0.99 })];
    game.importState(state);
    game.update(0, input());

    const after = game.exportState();
    expect(after.lives).toBe(2);
    expect(after.invulnerableMs).toBe(1350);
    expect(after.enemies).toHaveLength(0);
  });

  it('lets rim enemies on other lanes leave without damaging the player', () => {
    const game = emptyTempest();
    const state = baseState(game);
    state.playerLane = 4;
    state.enemies = [enemy({ lane: 9, depth: 0.99 })];
    game.importState(state);
    game.update(0, input());
    expect(game.exportState().lives).toBe(3);
    expect(game.exportState().enemies).toHaveLength(0);
  });

  it('resets the run after losing the final life', () => {
    const game = emptyTempest();
    const state = baseState(game);
    state.playerLane = 0;
    state.lives = 1;
    state.score = 999;
    state.wave = 4;
    state.superCharges = 0;
    state.enemies = [enemy({ lane: 0, depth: 0.99 })];
    game.importState(state);
    game.update(0, input());

    const after = game.exportState();
    expect(after.lives).toBe(3);
    expect(after.score).toBe(0);
    expect(after.wave).toBe(1);
    expect(after.superCharges).toBe(2);
  });
});

describe('TempestGame lifecycle, state, and vector projection', () => {
  it('auto-spawns enemies and advances waves from score', () => {
    const game = new TempestGame({ initialEnemyCount: 0, autoSpawn: true, random: seededRandom(44) });
    const state = game.exportState();
    state.spawnCooldownMs = 0;
    state.score = 3600;
    state.superCharges = 1;
    game.importState(state);

    game.update(0, input());
    const after = game.exportState();
    expect(after.enemies).toHaveLength(1);
    expect(after.wave).toBe(3);
    expect(after.superCharges).toBe(2);
    expect(after.spawnCooldownMs).toBeGreaterThan(0);
  });

  it('exports deep state snapshots and validates lane topology on import', () => {
    const game = emptyTempest();
    const state = baseState(game);
    state.enemies = [enemy()];
    game.importState(state);

    const exported = game.exportState();
    exported.enemies[0]!.lane = 12;
    expect(game.exportState().enemies[0]!.lane).toBe(2);

    expect(() => game.importState({ ...state, laneCount: 12 })).toThrow(/Expected 16 lanes/);
  });

  it('emits a complete vector tube, enemies, bullets, and player ship', () => {
    const game = emptyTempest();
    const state = baseState(game);
    state.invulnerableMs = 0;
    state.enemies = [enemy({ kind: 'flipper' }), enemy({ id: 2, lane: 5, kind: 'spinner', color: 0xd970ff })];
    state.bullets = [{ lane: 3, depth: 0.7, speed: 0 }];
    game.importState(state);

    const paths = game.getVectorPaths(input());
    // 16 rails + 6 rings + 2 enemies + 1 bullet + 1 player.
    expect(paths).toHaveLength(26);
    expect(paths.filter((path) => path.closed).length).toBeGreaterThanOrEqual(8);
    expect(paths.some((path) => path.color === 0xffffff && path.intensity === 1.6)).toBe(true);
    expect(paths.every((path) => path.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)))).toBe(true);
  });

  it('blinks the player while invulnerable', () => {
    const game = emptyTempest();
    const state = baseState(game);
    state.invulnerableMs = 180;
    game.importState(state);
    const paths = game.getVectorPaths(input());
    expect(paths).toHaveLength(22); // rails + rings only
  });
});
