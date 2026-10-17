import type { ArcadeGame, ArcadeGameFactoryOptions } from '../game/ArcadeGame';
import { AsteroidsGame } from '../game/AsteroidsGame';
import { TempestGame } from '../game/TempestGame';

export interface GameRegistration {
  id: string;
  title: string;
  subtitle: string;
  create: (options?: ArcadeGameFactoryOptions) => ArcadeGame;
}

export const GAME_REGISTRY: readonly GameRegistration[] = [
  {
    id: 'asteroids',
    title: 'ASTEROIDS',
    subtitle: 'Free-flight vector survival',
    create: (options = {}) => new AsteroidsGame(options),
  },
  {
    id: 'tempest',
    title: 'TEMPEST',
    subtitle: 'Chromatic vector tube assault',
    create: (options = {}) => new TempestGame(options),
  },
];

export function findGame(id: string): GameRegistration | undefined {
  return GAME_REGISTRY.find((entry) => entry.id === id);
}
