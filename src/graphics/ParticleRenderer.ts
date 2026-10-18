import { Particle, ParticleContainer, Texture } from 'pixi.js';
import type { ArcadeParticle } from '../game/types';
import type { GraphicsSettings } from './settings';

/**
 * High-volume additive particle layer for modern games in the arcade.
 * Games emit plain particle snapshots; Pixi owns the optimized GPU objects.
 */
export class ParticleRenderer {
  readonly container = new ParticleContainer({
    texture: Texture.WHITE,
    dynamicProperties: {
      position: true,
      rotation: true,
      vertex: true,
      color: true,
      uvs: false,
    },
    roundPixels: false,
  });

  private readonly pool: Particle[] = [];

  constructor(private readonly settings: GraphicsSettings) {
    this.container.blendMode = 'add';
  }

  render(states: readonly ArcadeParticle[]): void {
    this.ensureCapacity(states.length);
    const baseTextureSize = 16;

    for (let i = 0; i < states.length; i += 1) {
      const state = states[i];
      const particle = this.pool[i];
      if (!state || !particle) continue;
      const scale = Math.max(0.02, state.size / baseTextureSize);
      particle.x = state.x;
      particle.y = state.y;
      particle.rotation = state.rotation ?? 0;
      particle.scaleX = scale * Math.max(0.2, state.stretch ?? 1);
      particle.scaleY = scale;
      particle.tint = state.color;
      particle.alpha = Math.max(0, Math.min(1, state.alpha * this.settings.beamIntensity));
    }
    for (let i = states.length; i < this.pool.length; i += 1) this.pool[i]!.alpha = 0;
  }

  clear(): void {
    for (const particle of this.pool) particle.alpha = 0;
  }

  destroy(): void {
    this.container.removeParticles(0, this.container.particleChildren.length);
    this.pool.length = 0;
    this.container.destroy();
  }

  private ensureCapacity(count: number): void {
    while (this.pool.length < count) {
      const particle = new Particle({ texture: Texture.WHITE, x: 0, y: 0, alpha: 0 });
      this.pool.push(particle);
      this.container.addParticle(particle);
    }
  }
}
