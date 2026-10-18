import { describe, expect, it } from 'vitest';
import { PhosphorSwarmGame, type PhosphorSwarmState } from '../../src/game/PhosphorSwarmGame';
import { input, seededRandom } from './helpers';

function game(options: ConstructorParameters<typeof PhosphorSwarmGame>[0] = {}): PhosphorSwarmGame {
  return new PhosphorSwarmGame({ random: seededRandom(1234), autoAdvance: false, ...options });
}

describe('PhosphorSwarmGame', () => {
  it('starts centered with a deterministic enemy wave', () => {
    const subject = game({ initialEnemyCount: 5 });
    subject.resize(1200, 800);
    const state = subject.exportState();
    expect(state.player.x).toBe(600);
    expect(state.player.y).toBe(400);
    expect(state.enemies).toHaveLength(5);
    expect(state.wave).toBe(1);
  });

  it('moves from the primary analog vector and aims independently', () => {
    const subject = game({ initialEnemyCount: 0 });
    subject.resize(1000, 600);
    const before = subject.exportState();
    subject.update(100, input({}, { x: 1, y: 0 }, { x: 0, y: -1 }));
    const after = subject.exportState();
    expect(after.player.x).toBeGreaterThan(before.player.x);
    expect(after.player.aimAngle).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('fires continuously along the independent aim vector', () => {
    const subject = game({ initialEnemyCount: 0 });
    subject.resize(1000, 600);
    subject.update(16, input({ a: true }, { x: 0, y: 0 }, { x: 0, y: 1 }));
    const state = subject.exportState();
    expect(state.bullets).toHaveLength(1);
    expect(state.bullets[0]?.vy).toBeGreaterThan(700);
    expect(state.particles.length).toBeGreaterThan(0);
  });

  it('dash is edge-triggered and grants a cooldown/invulnerability window', () => {
    const subject = game({ initialEnemyCount: 0 });
    subject.update(16, input({ b: true }, { x: 1, y: 0 }));
    const once = subject.exportState();
    subject.update(16, input({ b: true }, { x: 1, y: 0 }));
    const held = subject.exportState();
    expect(once.dashCooldownMs).toBeGreaterThan(800);
    expect(once.player.invulnerableMs).toBeGreaterThan(200);
    expect(held.player.vx).toBeLessThan(once.player.vx + 620);
  });

  it('pulse bomb consumes a charge and destroys nearby enemies into particles', () => {
    const subject = game({ initialEnemyCount: 0 });
    const state = subject.exportState();
    state.enemies = [{ id: 1, x: state.player.x + 40, y: state.player.y, vx: 0, vy: 0, radius: 16, hp: 1, kind: 'chaser', phase: 0, color: 0xff00ff }];
    subject.importState(state);
    subject.update(16, input({ x: true }));
    const after = subject.exportState();
    expect(after.pulseBombs).toBe(1);
    expect(after.enemies).toHaveLength(0);
    expect(after.particles.length).toBeGreaterThan(50);
    expect(after.ripples.length).toBeGreaterThan(0);
  });

  it('repulsor pushes nearby enemies away while held', () => {
    const subject = game({ initialEnemyCount: 0 });
    const state = subject.exportState();
    state.enemies = [{ id: 1, x: state.player.x + 100, y: state.player.y, vx: 0, vy: 0, radius: 16, hp: 1, kind: 'chaser', phase: 0, color: 0xffffff }];
    subject.importState(state);
    subject.update(50, input({ y: true }));
    expect(subject.exportState().enemies[0]?.vx).toBeGreaterThan(0);
  });

  it('bullet collisions score and create an explosion field', () => {
    const subject = game({ initialEnemyCount: 0 });
    const state = subject.exportState();
    state.enemies = [{ id: 1, x: 550, y: 300, vx: 0, vy: 0, radius: 16, hp: 1, kind: 'chaser', phase: 0, color: 0x00ffff }];
    state.bullets = [{ x: 550, y: 300, vx: 0, vy: 0, lifeMs: 500, color: 0xffffff }];
    subject.importState(state);
    subject.update(0, input());
    const after = subject.exportState();
    expect(after.enemies).toHaveLength(0);
    expect(after.bullets).toHaveLength(0);
    expect(after.score).toBe(110);
    expect(after.particles.length).toBeGreaterThan(20);
  });

  it('particle snapshots fade and expire independently from vector paths', () => {
    const subject = game({ initialEnemyCount: 0 });
    const state = subject.exportState();
    state.particles = [{ x: 20, y: 20, vx: 100, vy: 0, lifeMs: 100, maxLifeMs: 100, color: 0xff0000, size: 4, rotation: 0, spin: 0 }];
    subject.importState(state);
    expect(subject.getParticles()[0]?.alpha).toBeCloseTo(0.92, 5);
    subject.update(120, input());
    expect(subject.getParticles()).toHaveLength(0);
  });

  it('emits a warped neon grid plus player/enemy vector geometry', () => {
    const subject = game({ initialEnemyCount: 2 });
    subject.resize(1200, 800);
    const paths = subject.getVectorPaths(input());
    expect(paths.length).toBeGreaterThan(20);
    expect(paths.some((path) => path.color === 0x72fff2)).toBe(true);
  });

  it('round-trips serializable game state', () => {
    const subject = game({ initialEnemyCount: 3 });
    subject.resize(900, 500);
    subject.update(20, input({ a: true }, { x: 0.5, y: -0.2 }, { x: 1, y: 0 }));
    const snapshot = subject.exportState();
    const restored = game({ initialEnemyCount: 0 });
    restored.importState(snapshot as PhosphorSwarmState);
    expect(restored.exportState()).toEqual(snapshot);
  });
  it('pause freezes simulation and select requests global settings on an edge', () => {
    let settingsRequests = 0;
    const subject = game({ initialEnemyCount: 0, onSettingsRequested: () => { settingsRequests += 1; } });
    subject.update(16, input({ start: true }));
    const paused = subject.exportState();
    subject.update(100, input({ start: false }, { x: 1, y: 0 }));
    expect(subject.exportState().player.x).toBe(paused.player.x);
    subject.update(16, input({ select: true }));
    expect(settingsRequests).toBe(1);
  });

  it('player collision consumes a life and respawns with invulnerability', () => {
    const subject = game({ initialEnemyCount: 0 });
    const state = subject.exportState();
    state.enemies = [{ id: 1, x: state.player.x, y: state.player.y, vx: 0, vy: 0, radius: 18, hp: 1, kind: 'spinner', phase: 0, color: 0xffffff }];
    subject.importState(state);
    subject.update(16, input());
    const after = subject.exportState();
    expect(after.lives).toBe(2);
    expect(after.player.invulnerableMs).toBeGreaterThan(1200);
    expect(after.particles.length).toBeGreaterThan(50);
  });

  it('automatically advances an empty arena and periodically replenishes pulse bombs', () => {
    const subject = new PhosphorSwarmGame({ random: seededRandom(99), initialEnemyCount: 0, autoAdvance: true });
    const state = subject.exportState();
    state.wave = 2;
    state.pulseBombs = 1;
    subject.importState(state);
    subject.update(16, input());
    const after = subject.exportState();
    expect(after.wave).toBe(3);
    expect(after.pulseBombs).toBe(2);
    expect(after.enemies.length).toBeGreaterThan(0);
  });

  it('pulse bomb knocks distant enemies outward instead of deleting them', () => {
    const subject = game({ initialEnemyCount: 0 });
    subject.resize(1600, 1000);
    const state = subject.exportState();
    state.enemies = [{ id: 1, x: 1500, y: 900, vx: 0, vy: 0, radius: 16, hp: 1, kind: 'chaser', phase: 0, color: 0xffffff }];
    subject.importState(state);
    subject.update(16, input({ x: true }));
    const enemy = subject.exportState().enemies[0];
    expect(enemy).toBeDefined();
    expect(Math.hypot(enemy!.vx, enemy!.vy)).toBeGreaterThan(0);
  });

  it('renders spinner-specific geometry and expires bullets outside the arena', () => {
    const subject = game({ initialEnemyCount: 0 });
    const state = subject.exportState();
    state.enemies = [{ id: 1, x: 300, y: 250, vx: 0, vy: 0, radius: 20, hp: 2, kind: 'spinner', phase: 0, color: 0xff00ff }];
    state.bullets = [{ x: -100, y: -100, vx: -10, vy: -10, lifeMs: 500, color: 0xffffff }];
    subject.importState(state);
    const paths = subject.getVectorPaths(input());
    expect(paths.filter((path) => path.color === 0xff00ff).length).toBeGreaterThan(0);
    expect(paths.some((path) => path.color === 0xffffff)).toBe(true);
    subject.update(16, input());
    expect(subject.exportState().bullets).toHaveLength(0);
  });

});
