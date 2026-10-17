import { Application, Text } from 'pixi.js';
import type { ArcadeGame } from '../game/ArcadeGame';
import type { InputSnapshot, VectorPath } from '../game/types';
import { VectorRenderer } from '../graphics/VectorRenderer';
import { defaultGraphicsSettings } from '../graphics/settings';
import { TouchController } from '../input/TouchController';
import { ArcadeMenuView } from '../ui/ArcadeMenuView';
import { SettingsPanel } from '../ui/SettingsPanel';
import { GAME_REGISTRY, findGame } from './gameRegistry';
import { MenuController, type MenuEntry, type MenuSelection } from './MenuController';

export type ArcadeMode = 'menu' | 'game';

export class GameApp {
  private readonly pixi = new Application();
  private readonly settings = { ...defaultGraphicsSettings };
  private readonly vectorRenderer = new VectorRenderer(this.settings);
  private readonly touch: TouchController;
  private readonly settingsPanel: SettingsPanel;
  private readonly menuController: MenuController;
  private readonly menuView: ArcadeMenuView;
  private activeGame: ArcadeGame | null = null;
  private activeGameId: string | null = null;
  private mode: ArcadeMode = 'menu';
  private frameCount = 0;
  private lastInput: InputSnapshot | null = null;
  private shellLastInput: InputSnapshot | null = null;
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
    this.settingsPanel = new SettingsPanel(
      this.settings,
      () => this.applySettings(),
      () => this.showMenu(),
    );

    const menuEntries: MenuEntry[] = [
      ...GAME_REGISTRY.map((game) => ({
        id: game.id,
        title: game.title,
        subtitle: game.subtitle,
        kind: 'game' as const,
      })),
      {
        id: 'configuration',
        title: 'CONFIGURATION',
        subtitle: 'Global vector display and input settings',
        kind: 'configuration' as const,
      },
    ];
    this.menuController = new MenuController(menuEntries, 5);
    this.menuView = new ArcadeMenuView(this.menuController, (selection) => this.activateMenuSelection(selection));
    root.append(this.menuView.element, this.settingsPanel.element);

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape' && this.mode === 'game') this.showMenu();
    });
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
    this.showMenu();

    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(this.root);

    this.pixi.ticker.add((ticker) => {
      const elapsedMs = Math.max(0, ticker.deltaMS);
      const dtMs = Math.min(50, elapsedMs);
      const input = this.touch.snapshot();
      this.lastInput = input;

      if (this.mode === 'menu') {
        const selection = this.menuController.update(input);
        if (selection) this.activateMenuSelection(selection);
        this.menuView.sync();
        this.vectorRenderer.render(this.menuVectorPaths(), elapsedMs);
        this.hud.text = 'VECTOR ARCADE  //  FULL-COLOR PHOSPHOR SYSTEM';
      } else if (this.activeGame) {
        if (this.shellChordPressed(input)) {
          this.showMenu();
        } else {
          this.activeGame.update(dtMs, input);
          this.vectorRenderer.render(this.activeGame.getVectorPaths(input), elapsedMs);
          this.hud.text = this.activeGame.getHudText();
        }
      }

      this.shellLastInput = input;
      this.frameCount += 1;
    });
  }

  getDebugSnapshot() {
    return {
      frameCount: this.frameCount,
      mode: this.mode,
      activeGameId: this.activeGameId,
      input: this.lastInput ?? this.touch.snapshot(),
      game: this.activeGame?.exportState() ?? null,
      menu: this.menuController.getState(),
      settingsVisible: this.settingsPanel.isVisible(),
      hud: this.hud.text,
      renderer: this.pixi.renderer.constructor.name,
      screen: {
        width: this.pixi.screen.width,
        height: this.pixi.screen.height,
        resolution: this.pixi.renderer.resolution,
      },
    };
  }

  private activateMenuSelection(selection: MenuSelection): void {
    if (selection.kind === 'configuration') {
      this.settingsPanel.show();
      return;
    }
    this.startGame(selection.id);
  }

  private startGame(id: string): void {
    const registration = findGame(id);
    if (!registration) return;
    this.activeGame = registration.create({ onSettingsRequested: () => this.settingsPanel.toggle() });
    this.activeGameId = registration.id;
    this.mode = 'game';
    this.menuView.hide();
    this.settingsPanel.hide();
    this.touch.setVisible(true);
    this.menuController.resetInputEdges();
    this.shellLastInput = null;
    this.activeGame.resize(this.pixi.screen.width, this.pixi.screen.height);
  }

  private showMenu(): void {
    this.mode = 'menu';
    this.activeGame = null;
    this.activeGameId = null;
    this.settingsPanel.hide();
    this.menuView.show();
    // The menu is directly touchable; hiding the gameplay overlay prevents the
    // quadrant labels from competing visually with the program list.
    this.touch.setVisible(false);
    this.menuController.resetInputEdges();
    this.shellLastInput = null;
  }

  private resize(): void {
    this.activeGame?.resize(this.pixi.screen.width, this.pixi.screen.height);
    this.vectorRenderer.resize(this.pixi.screen.width, this.pixi.screen.height);
  }

  private applySettings(): void {
    this.vectorRenderer.refreshFilters();
    this.touch.setOverlayOpacity(this.settings.controlOpacity);
    this.root.style.setProperty('--scanline-alpha', String(this.settings.scanlines));
    this.root.style.setProperty('--vignette-alpha', String(this.settings.vignette));
  }

  private shellChordPressed(input: InputSnapshot): boolean {
    const chord = input.buttons.start && input.buttons.select;
    const previousChord = Boolean(this.shellLastInput?.buttons.start && this.shellLastInput?.buttons.select);
    return chord && !previousChord;
  }

  private menuVectorPaths(): VectorPath[] {
    const width = this.pixi.screen.width;
    const height = this.pixi.screen.height;
    const inset = Math.min(width, height) * 0.045;
    const midY = height * 0.5;
    return [
      {
        points: [
          { x: inset, y: inset },
          { x: width - inset, y: inset },
          { x: width - inset, y: height - inset },
          { x: inset, y: height - inset },
        ],
        color: 0x54ffd1,
        intensity: 0.45,
        width: 0.9,
        closed: true,
      },
      {
        points: [
          { x: inset * 1.4, y: midY },
          { x: width * 0.27, y: midY },
        ],
        color: 0x6be7ff,
        intensity: 0.38,
        width: 0.8,
      },
      {
        points: [
          { x: width * 0.73, y: midY },
          { x: width - inset * 1.4, y: midY },
        ],
        color: 0xf66cff,
        intensity: 0.38,
        width: 0.8,
      },
      {
        points: [
          { x: width * 0.5, y: inset * 1.2 },
          { x: width * 0.5, y: height * 0.19 },
        ],
        color: 0xffb64f,
        intensity: 0.3,
        width: 0.75,
      },
    ];
  }
}
