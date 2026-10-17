import { BlurFilter, Container, Graphics, RenderTexture, Sprite, Texture } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { VectorPath } from '../game/types';
import { PhosphorFilter } from './PhosphorFilter';
import type { GraphicsSettings } from './settings';

/**
 * Rasterizes geometric vector beams into an accumulating GPU phosphor surface.
 * A -> B -> A ping-pong passes read ONLY the previous texture and write ONLY
 * the next texture. No CPU-side history objects or texture readbacks are used.
 */
export class VectorRenderer {
  readonly container = new Container();

  private readonly feedbackScene = new Container();
  private readonly bloomLayer = new Container();
  private readonly liveLayer = new Container();
  private readonly bloom = new Graphics();
  private readonly live = new Graphics();
  private readonly historySprite = new Sprite();
  private readonly displaySprite = new Sprite();
  private readonly phosphorFilter = new PhosphorFilter();
  private readonly emptyScene = new Container();
  private bloomFilter?: BlurFilter;

  private renderer?: Application['renderer'];
  private textures: [RenderTexture, RenderTexture] | undefined;
  private readIndex: 0 | 1 = 0;
  private width = 1;
  private height = 1;
  private resolution = 1;

  constructor(private readonly settings: GraphicsSettings) {
    this.bloom.blendMode = 'add';
    this.live.blendMode = 'add';
    this.bloomLayer.addChild(this.bloom);
    this.liveLayer.addChild(this.live);
    this.historySprite.filters = [this.phosphorFilter];
    this.feedbackScene.addChild(this.historySprite, this.bloomLayer, this.liveLayer);
    this.container.addChild(this.displaySprite);
    this.refreshFilters();
  }

  initialize(renderer: Application['renderer'], width: number, height: number): void {
    this.renderer = renderer;
    this.resolution = Math.min(renderer.resolution, 1.5);
    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    if (!this.renderer) return;
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (this.textures && this.width === w && this.height === h) return;

    // Detach stale GPU inputs before destroying textures (important on resize).
    this.historySprite.texture = Texture.EMPTY;
    this.displaySprite.texture = Texture.EMPTY;
    this.textures?.forEach((texture) => texture.destroy(true));

    this.width = w;
    this.height = h;
    this.textures = [
      RenderTexture.create({ width: w, height: h, resolution: this.resolution }),
      RenderTexture.create({ width: w, height: h, resolution: this.resolution }),
    ];
    this.readIndex = 0;

    // Ensure neither buffer contains undefined old GPU memory at startup.
    for (const texture of this.textures) {
      this.renderer.render({ container: this.emptyScene, target: texture, clear: true });
    }

    this.displaySprite.texture = this.textures[0];
    this.historySprite.width = w;
    this.historySprite.height = h;
    this.displaySprite.width = w;
    this.displaySprite.height = h;
  }

  refreshFilters(): void {
    this.bloomFilter?.destroy();
    this.bloomFilter = new BlurFilter({
      strength: 2.5 + this.settings.glow * 5.5,
      quality: 2,
      kernelSize: 5,
    });
    this.bloomLayer.filters = [this.bloomFilter];
  }

  render(paths: VectorPath[], dtMs: number): void {
    if (!this.renderer || !this.textures) return;
    this.drawCurrent(paths);

    const previous = this.textures[this.readIndex];
    const nextIndex: 0 | 1 = this.readIndex === 0 ? 1 : 0;
    const next = this.textures[nextIndex];

    this.historySprite.texture = previous;
    this.historySprite.width = this.width;
    this.historySprite.height = this.height;
    this.phosphorFilter.update(
      dtMs,
      previous.source.pixelWidth,
      previous.source.pixelHeight,
      this.settings,
    );

    // GPU pass: filtered/decayed previous image + today's luminous beam.
    this.renderer.render({ container: this.feedbackScene, target: next, clear: true });

    this.readIndex = nextIndex;
    this.displaySprite.texture = next;
    this.displaySprite.width = this.width;
    this.displaySprite.height = this.height;
  }

  destroy(): void {
    this.historySprite.filters = [];
    this.bloomLayer.filters = [];
    this.bloomFilter?.destroy();
    this.bloomFilter = undefined;
    this.phosphorFilter.destroy();
    this.historySprite.texture = Texture.EMPTY;
    this.displaySprite.texture = Texture.EMPTY;
    this.textures?.forEach((texture) => texture.destroy(true));
    this.textures = undefined;
    this.feedbackScene.destroy({ children: true });
    this.container.destroy({ children: true });
  }

  private drawCurrent(paths: VectorPath[]): void {
    this.live.clear();
    this.bloom.clear();

    for (const path of paths) {
      if (path.points.length < 2) continue;
      const intensity = (path.intensity ?? 1) * this.settings.beamIntensity;
      const width = path.width ?? 1.4;
      const jittered = path.points.map((point) => ({
        x: point.x + (Math.random() - 0.5) * this.settings.jitter,
        y: point.y + (Math.random() - 0.5) * this.settings.jitter,
      }));

      this.strokePath(this.bloom, jittered, path.closed ?? false, {
        color: path.color,
        width: width * (4.5 + this.settings.glow * 2.5),
        alpha: Math.min(0.34, 0.18 * intensity * this.settings.glow),
      });
      this.strokePath(this.live, jittered, path.closed ?? false, {
        color: path.color,
        width: width * 2.2,
        alpha: Math.min(0.75, 0.46 * intensity),
      });
      this.strokePath(this.live, jittered, path.closed ?? false, {
        color: 0xffffff,
        width: Math.max(0.65, width * 0.58),
        alpha: Math.min(1, 0.76 * intensity),
      });

      if (!path.closed) {
        const endpoint = jittered[jittered.length - 1];
        if (endpoint) {
          this.live.circle(endpoint.x, endpoint.y, Math.max(0.8, width * 0.7)).fill({
            color: path.color,
            alpha: Math.min(0.9, 0.5 * intensity),
          });
        }
      }
    }
  }

  private strokePath(
    graphics: Graphics,
    points: readonly { x: number; y: number }[],
    closed: boolean,
    style: { color: number; width: number; alpha: number },
  ): void {
    const first = points[0];
    if (!first) return;
    graphics.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const point = points[i];
      if (point) graphics.lineTo(point.x, point.y);
    }
    if (closed) graphics.lineTo(first.x, first.y);
    graphics.stroke(style);
  }
}
