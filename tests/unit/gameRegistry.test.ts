import { describe, expect, it } from 'vitest';
import { GAME_REGISTRY, findGame } from '../../src/app/gameRegistry';
import { ASTEROIDS_TOUCH, PHOSPHOR_SWARM_TOUCH, TEMPEST_TOUCH } from '../../src/input/layout';
import { AsteroidsGame } from '../../src/game/AsteroidsGame';
import { PhosphorSwarmGame } from '../../src/game/PhosphorSwarmGame';
import { TempestGame } from '../../src/game/TempestGame';

describe('game registry', () => {
  it('registers all games in stable menu order', () => {
    expect(GAME_REGISTRY.map((entry) => entry.id)).toEqual(['asteroids', 'tempest', 'phosphor-swarm']);
    expect(GAME_REGISTRY.map((entry) => entry.title)).toEqual(['ASTEROIDS', 'TEMPEST', 'PHOSPHOR SWARM']);
  });

  it('constructs the correct game implementation and touch profile', () => {
    expect(findGame('asteroids')?.create()).toBeInstanceOf(AsteroidsGame);
    expect(findGame('tempest')?.create()).toBeInstanceOf(TempestGame);
    expect(findGame('phosphor-swarm')?.create()).toBeInstanceOf(PhosphorSwarmGame);
    expect(findGame('missing')).toBeUndefined();
    expect(findGame('asteroids')?.touch).toBe(ASTEROIDS_TOUCH);
    expect(findGame('tempest')?.touch).toBe(TEMPEST_TOUCH);
    expect(findGame('phosphor-swarm')?.touch).toBe(PHOSPHOR_SWARM_TOUCH);
  });
});
