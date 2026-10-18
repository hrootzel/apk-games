import type { ArcadeParticle, InputSnapshot, VectorPath } from './types';

/** Minimal contract implemented by every game in the Vector Arcade collection. */
export interface ArcadeGame {
  resize(width: number, height: number): void;
  update(dtMs: number, input: InputSnapshot): void;
  getVectorPaths(input: InputSnapshot): VectorPath[];
  /** Optional high-volume particle layer rendered by Pixi ParticleContainer. */
  getParticles?(): ArcadeParticle[];
  getHudText(): string;
  exportState(): unknown;
}

export interface ArcadeGameFactoryOptions {
  onSettingsRequested?: () => void;
}
