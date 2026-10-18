import { ASTEROIDS_TOUCH, PHOSPHOR_SWARM_TOUCH, TEMPEST_TOUCH, type TouchProfile } from '../input/layout';
import type { ArcadeGame, ArcadeGameFactoryOptions } from '../game/ArcadeGame';
import { AsteroidsGame } from '../game/AsteroidsGame';
import { PhosphorSwarmGame } from '../game/PhosphorSwarmGame';
import { TempestGame } from '../game/TempestGame';

export interface GameRegistration {
  id: string;
  title: string;
  subtitle: string;
  touch: TouchProfile;
  create: (options?: ArcadeGameFactoryOptions) => ArcadeGame;
}

export const GAME_REGISTRY: readonly GameRegistration[] = [
  {
    id: 'asteroids',
    touch: ASTEROIDS_TOUCH,
    title: 'ASTEROIDS',
    subtitle: 'Free-flight vector survival',
    create: (options = {}) => new AsteroidsGame(options),
  },
  {
    id: 'tempest',
    touch: TEMPEST_TOUCH,
    title: 'TEMPEST',
    subtitle: 'Chromatic vector tube assault',
    create: (options = {}) => new TempestGame(options),
  },
  {
    id: 'phosphor-swarm',
    touch: PHOSPHOR_SWARM_TOUCH,
    title: 'PHOSPHOR SWARM',
    subtitle: 'Twin-stick neon particle arena',
    create: (options = {}) => new PhosphorSwarmGame(options),
  },
];

export function findGame(id: string): GameRegistration | undefined {
  return GAME_REGISTRY.find((entry) => entry.id === id);
}
