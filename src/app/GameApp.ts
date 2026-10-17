import { Application, Text } from 'pixi.js';
import { AsteroidsGame } from '../game/AsteroidsGame';
import type { InputSnapshot } from '../game/types';
import { VectorRenderer } from '../graphics/VectorRenderer';
import { defaultGraphicsSettings } from '../graphics/settings';
import { TouchController } from '../input/TouchController';
import { SettingsPanel } from '../ui/SettingsPanel';

export class GameApp {
  private readonly pixi = new Application();
  private readonly settings = { ...defaultGraphicsSettings };
  private readonly vectorRenderer = new VectorRenderer(this.settings);
  private readonly touch: TouchController;
  private readonly settingsPanel: SettingsPanel;
  private readonly game: AsteroidsGame;
  private frameCount = 0;
  private lastInput: InputSnapshot | null = null;
  private readonly hud = new Text({
    text: '',
    style: {
      fill: 0xbafcff,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 15,
      letterSpacing: 2,
    },
  });

  constructor(private readonly root: HTMLElement) {
    this.touch = new TouchController(root);
    this.settingsPanel = new SettingsPanel(this.settings, () => this.applySettings());
    this.game = new AsteroidsGame({ onSettingsRequested: () => this.settingsPanel.toggle() });
    root.appendChild(this.settingsPanel.element);
  }

  async start(): Promise<void> {
    await this.pixi.init({
      resizeTo: this.root,
      background: '#010302',
      antialias: true,
      preference: 'webgl',
      preferWebGLVersion: 2,
      resolution: Math.min(window.devicePixelRatio || 1, 1.5),
      autoDensity: true,
      powerPreference: 'high-performance',
    });

    this.pixi.canvas.classList.add('game-canvas');
    this.root.prepend(this.pixi.canvas);
    this.pixi.stage.addChild(this.vectorRenderer.container, this.hud);
    this.vectorRenderer.initialize(this.pixi.renderer, this.pixi.screen.width, this.pixi.screen.height);
    this.hud.position.set(18, 15);
    this.applySettings();
    this.resize();

    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(this.root);

    this.pixi.ticker.add((ticker) => {
      const elapsedMs = Math.max(0, ticker.deltaMS);
      const dtMs = Math.min(50, elapsedMs);
      const input = this.touch.snapshot();
      this.lastInput = input;
      this.game.update(dtMs, input);
      this.vectorRenderer.render(this.game.getVectorPaths(input), elapsedMs);
      this.hud.text = this.game.getHudText();
      this.frameCount += 1;
    });
  }

  getDebugSnapshot() {
    return {
      frameCount: this.frameCount,
      input: this.lastInput ?? this.touch.snapshot(),
      game: this.game.exportState(),
      hud: this.hud.text,
      renderer: this.pixi.renderer.constructor.name,
      screen: {
        width: this.pixi.screen.width,
        height: this.pixi.screen.height,
        resolution: this.pixi.renderer.resolution,
      },
    };
  }

  private resize(): void {
    this.game.resize(this.pixi.screen.width, this.pixi.screen.height);
    this.vectorRenderer.resize(this.pixi.screen.width, this.pixi.screen.height);
  }

  private applySettings(): void {
    this.vectorRenderer.refreshFilters();
    this.touch.setOverlayOpacity(this.settings.controlOpacity);
    this.root.style.setProperty('--scanline-alpha', String(this.settings.scanlines));
    this.root.style.setProperty('--vignette-alpha', String(this.settings.vignette));
  }
}
