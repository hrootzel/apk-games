import { describe, expect, it } from 'vitest';
import { GAME_REGISTRY, findGame } from '../../src/app/gameRegistry';
import { AsteroidsGame } from '../../src/game/AsteroidsGame';
import { TempestGame } from '../../src/game/TempestGame';

describe('game registry', () => {
  it('registers Asteroids and Tempest in stable menu order', () => {
    expect(GAME_REGISTRY.map((entry) => entry.id)).toEqual(['asteroids', 'tempest']);
    expect(GAME_REGISTRY.map((entry) => entry.title)).toEqual(['ASTEROIDS', 'TEMPEST']);
  });

  it('constructs the correct game implementation', () => {
    expect(findGame('asteroids')?.create()).toBeInstanceOf(AsteroidsGame);
    expect(findGame('tempest')?.create()).toBeInstanceOf(TempestGame);
    expect(findGame('missing')).toBeUndefined();
  });
});
