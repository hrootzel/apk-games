import type { ArcadeGame } from './ArcadeGame';
import type { InputSnapshot, Vec2, VectorPath } from './types';

export interface TempestEnemyState {
  id: number;
  lane: number;
  depth: number;
  speed: number;
  kind: 'flipper' | 'spinner';
  color: number;
}

export interface TempestBulletState {
  lane: number;
  depth: number;
  speed: number;
}

export interface TempestState {
  width: number;
  height: number;
  laneCount: number;
  playerLane: number;
  playerVelocity: number;
  bullets: TempestBulletState[];
  enemies: TempestEnemyState[];
  shootCooldownMs: number;
  spawnCooldownMs: number;
  score: number;
  wave: number;
  lives: number;
  superCharges: number;
  paused: boolean;
  invulnerableMs: number;
  nextEnemyId: number;
}

export interface TempestGameOptions {
  onSettingsRequested?: () => void;
  random?: () => number;
  laneCount?: number;
  initialEnemyCount?: number;
  autoSpawn?: boolean;
}

const TAU = Math.PI * 2;
const ENEMY_COLORS = [0xff5470, 0xffa62b, 0xd970ff, 0x5cf2ff, 0xb9ff5c];

/**
 * A color-vector tube shooter inspired by classic vector arcade hardware.
 * The world is simulated in lane/depth coordinates and projected into 2D
 * VectorPaths every frame, keeping it independent from Pixi itself.
 */
export class TempestGame implements ArcadeGame {
  private width = 1600;
  private height = 1000;
  private readonly laneCount: number;
  private playerLane = 0;
  private playerVelocity = 0;
  private bullets: TempestBulletState[] = [];
  private enemies: TempestEnemyState[] = [];
  private shootCooldownMs = 0;
  private spawnCooldownMs = 650;
  private score = 0;
  private wave = 1;
  private lives = 3;
  private superCharges = 2;
  private paused = false;
  private invulnerableMs = 1200;
  private nextEnemyId = 1;
  private lastInput: InputSnapshot | null = null;
  private readonly onSettingsRequested?: () => void;
  private readonly random: () => number;
  private readonly autoSpawn: boolean;

  constructor(options: TempestGameOptions = {}) {
    this.onSettingsRequested = options.onSettingsRequested;
    this.random = options.random ?? Math.random;
    this.laneCount = Math.max(8, Math.round(options.laneCount ?? 16));
    this.autoSpawn = options.autoSpawn ?? true;
    const initialCount = Math.max(0, Math.round(options.initialEnemyCount ?? 5));
    for (let i = 0; i < initialCount; i += 1) {
      this.enemies.push(this.createEnemy(this.random() * 0.52));
    }
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  update(dtMs: number, input: InputSnapshot): void {
    const safeDtMs = Math.max(0, dtMs);
    const dt = Math.min(safeDtMs, 50) / 1000;

    if (this.wasPressed(input, 'start')) this.paused = !this.paused;
    if (this.wasPressed(input, 'select')) this.onSettingsRequested?.();

    if (this.paused) {
      this.lastInput = input;
      return;
    }

    this.invulnerableMs = Math.max(0, this.invulnerableMs - safeDtMs);

    // Analog rim movement. L/R remain useful as discrete digital controls.
    const direction = Math.max(
      -1,
      Math.min(1, input.joystick.x + (input.buttons.r ? 1 : 0) - (input.buttons.l ? 1 : 0)),
    );
    const targetVelocity = direction * 9.2;
    const response = input.buttons.y ? 8 : 15;
    this.playerVelocity += (targetVelocity - this.playerVelocity) * Math.min(1, response * dt);
    if (Math.abs(direction) < 0.03) this.playerVelocity *= Math.pow(0.08, dt);
    this.playerLane = this.wrapLane(this.playerLane + this.playerVelocity * dt);

    if (this.wasPressed(input, 'x')) {
      this.playerLane = this.wrapLane(Math.floor(this.random() * this.laneCount));
      this.playerVelocity = 0;
      this.invulnerableMs = Math.max(this.invulnerableMs, 800);
    }

    if (this.wasPressed(input, 'b') && this.superCharges > 0) {
      this.superCharges -= 1;
      this.score += this.enemies.length * 75;
      this.enemies = [];
      this.spawnCooldownMs = Math.max(this.spawnCooldownMs, 550);
    }

    this.shootCooldownMs -= safeDtMs;
    if (input.buttons.a && this.shootCooldownMs <= 0) {
      this.bullets.push({ lane: this.playerLane, depth: 0.93, speed: 1.52 });
      this.shootCooldownMs = 125;
    }

    for (const bullet of this.bullets) bullet.depth -= bullet.speed * dt;
    this.bullets = this.bullets.filter((bullet) => bullet.depth > 0.035);

    const speedScale = 1 + Math.min(1.4, (this.wave - 1) * 0.08);
    for (const enemy of this.enemies) {
      enemy.depth += enemy.speed * speedScale * dt;
      if (enemy.kind === 'flipper') {
        enemy.lane = this.wrapLane(enemy.lane + Math.sin((enemy.depth + enemy.id) * 7) * dt * 0.55);
      }
    }

    this.resolveBulletCollisions();
    this.resolvePlayerCollisions();

    if (this.autoSpawn) {
      this.spawnCooldownMs -= safeDtMs;
      if (this.spawnCooldownMs <= 0) {
        this.enemies.push(this.createEnemy(0.04));
        const base = Math.max(250, 760 - this.wave * 28);
        this.spawnCooldownMs = base * (0.72 + this.random() * 0.55);
      }

      // Progression is intentionally score/enemy-count based so it is stable
      // under variable frame times.
      const desiredWave = 1 + Math.floor(this.score / 1800);
      if (desiredWave > this.wave) {
        this.wave = desiredWave;
        this.superCharges = Math.min(3, this.superCharges + 1);
      }
    }

    this.lastInput = input;
  }

  getVectorPaths(_input: InputSnapshot): VectorPath[] {
    const paths: VectorPath[] = [];
    const center = { x: this.width / 2, y: this.height * 0.49 };

    // Radial rails: hue changes gradually around the tube.
    for (let lane = 0; lane < this.laneCount; lane += 1) {
      paths.push({
        points: [this.project(lane, 0.03, center), this.project(lane, 1, center)],
        color: this.laneColor(lane, 0.76),
        intensity: 0.44,
        width: 0.82,
      });
    }

    // Depth rings strongly communicate the pseudo-3D vector tube.
    const ringDepths = [0.04, 0.16, 0.34, 0.58, 0.8, 1];
    for (const depth of ringDepths) {
      const points: Vec2[] = [];
      for (let lane = 0; lane < this.laneCount; lane += 1) points.push(this.project(lane, depth, center));
      paths.push({
        points,
        color: this.depthColor(depth),
        intensity: depth === 1 ? 0.9 : 0.35 + depth * 0.26,
        width: depth === 1 ? 1.45 : 0.82,
        closed: true,
      });
    }

    for (const enemy of this.enemies) {
      const p = this.project(enemy.lane, enemy.depth, center);
      const tangent = this.tangent(enemy.lane);
      const radial = this.radial(enemy.lane);
      const size = 3 + enemy.depth * 13;
      if (enemy.kind === 'spinner') {
        paths.push({
          points: [
            { x: p.x + tangent.x * size, y: p.y + tangent.y * size },
            { x: p.x + radial.x * size, y: p.y + radial.y * size },
            { x: p.x - tangent.x * size, y: p.y - tangent.y * size },
            { x: p.x - radial.x * size, y: p.y - radial.y * size },
          ],
          color: enemy.color,
          intensity: 1.22,
          width: 1.25,
          closed: true,
        });
      } else {
        paths.push({
          points: [
            { x: p.x - tangent.x * size, y: p.y - tangent.y * size },
            { x: p.x + radial.x * size * 0.8, y: p.y + radial.y * size * 0.8 },
            { x: p.x + tangent.x * size, y: p.y + tangent.y * size },
          ],
          color: enemy.color,
          intensity: 1.18,
          width: 1.2,
        });
      }
    }

    for (const bullet of this.bullets) {
      const front = this.project(bullet.lane, bullet.depth, center);
      const back = this.project(bullet.lane, Math.min(1, bullet.depth + 0.035), center);
      paths.push({ points: [back, front], color: 0xffffff, intensity: 1.6, width: 1.65 });
    }

    const blink = this.invulnerableMs > 0 && Math.floor(this.invulnerableMs / 90) % 2 === 0;
    if (!blink) {
      const p = this.project(this.playerLane, 1, center);
      const tangent = this.tangent(this.playerLane);
      const inward = this.radial(this.playerLane);
      const size = Math.max(12, Math.min(this.width, this.height) * 0.018);
      paths.push({
        points: [
          { x: p.x - tangent.x * size, y: p.y - tangent.y * size },
          { x: p.x - inward.x * size * 1.25, y: p.y - inward.y * size * 1.25 },
          { x: p.x + tangent.x * size, y: p.y + tangent.y * size },
        ],
        color: 0x72fff1,
        intensity: 1.45,
        width: 1.55,
        closed: true,
      });
    }

    return paths;
  }

  getHudText(): string {
    const mode = this.paused ? 'PAUSED' : 'TUBE VECTOR';
    return `SCORE ${String(this.score).padStart(6, '0')}  //  WAVE ${String(this.wave).padStart(2, '0')}  //  LIVES ${this.lives}  //  ZAP ${this.superCharges}  //  ${mode}`;
  }

  exportState(): TempestState {
    return {
      width: this.width,
      height: this.height,
      laneCount: this.laneCount,
      playerLane: this.playerLane,
      playerVelocity: this.playerVelocity,
      bullets: this.bullets.map((bullet) => ({ ...bullet })),
      enemies: this.enemies.map((enemy) => ({ ...enemy })),
      shootCooldownMs: this.shootCooldownMs,
      spawnCooldownMs: this.spawnCooldownMs,
      score: this.score,
      wave: this.wave,
      lives: this.lives,
      superCharges: this.superCharges,
      paused: this.paused,
      invulnerableMs: this.invulnerableMs,
      nextEnemyId: this.nextEnemyId,
    };
  }

  importState(state: TempestState): void {
    if (state.laneCount !== this.laneCount) throw new Error(`Expected ${this.laneCount} lanes, got ${state.laneCount}`);
    this.width = Math.max(1, state.width);
    this.height = Math.max(1, state.height);
    this.playerLane = this.wrapLane(state.playerLane);
    this.playerVelocity = state.playerVelocity;
    this.bullets = state.bullets.map((bullet) => ({ ...bullet }));
    this.enemies = state.enemies.map((enemy) => ({ ...enemy, lane: this.wrapLane(enemy.lane) }));
    this.shootCooldownMs = state.shootCooldownMs;
    this.spawnCooldownMs = state.spawnCooldownMs;
    this.score = state.score;
    this.wave = Math.max(1, state.wave);
    this.lives = Math.max(0, state.lives);
    this.superCharges = Math.max(0, state.superCharges);
    this.paused = state.paused;
    this.invulnerableMs = Math.max(0, state.invulnerableMs);
    this.nextEnemyId = Math.max(1, state.nextEnemyId);
    this.lastInput = null;
  }

  private resolveBulletCollisions(): void {
    const hitBullets = new Set<TempestBulletState>();
    const hitEnemies = new Set<TempestEnemyState>();
    for (const bullet of this.bullets) {
      for (const enemy of this.enemies) {
        if (Math.abs(bullet.depth - enemy.depth) > 0.075) continue;
        if (this.laneDistance(bullet.lane, enemy.lane) > 0.58) continue;
        hitBullets.add(bullet);
        hitEnemies.add(enemy);
        this.score += enemy.kind === 'spinner' ? 175 : 125;
        break;
      }
    }
    this.bullets = this.bullets.filter((bullet) => !hitBullets.has(bullet));
    this.enemies = this.enemies.filter((enemy) => !hitEnemies.has(enemy));
  }

  private resolvePlayerCollisions(): void {
    const survivors: TempestEnemyState[] = [];
    for (const enemy of this.enemies) {
      if (enemy.depth < 0.985) {
        survivors.push(enemy);
        continue;
      }
      if (this.invulnerableMs <= 0 && this.laneDistance(enemy.lane, this.playerLane) <= 0.72) {
        this.lives = Math.max(0, this.lives - 1);
        this.playerVelocity = 0;
        this.invulnerableMs = 1350;
        if (this.lives === 0) {
          this.score = 0;
          this.wave = 1;
          this.lives = 3;
          this.superCharges = 2;
        }
      }
      // Anything reaching the rim leaves the tube, hit or miss.
    }
    this.enemies = survivors;
  }

  private createEnemy(depth: number): TempestEnemyState {
    const id = this.nextEnemyId++;
    const kind: TempestEnemyState['kind'] = this.random() < 0.35 ? 'spinner' : 'flipper';
    return {
      id,
      lane: Math.floor(this.random() * this.laneCount),
      depth: Math.max(0.02, Math.min(0.9, depth)),
      speed: 0.105 + this.random() * 0.095,
      kind,
      color: ENEMY_COLORS[id % ENEMY_COLORS.length] ?? 0xffffff,
    };
  }

  private project(lane: number, depth: number, center: Vec2): Vec2 {
    const angle = this.laneAngle(lane);
    const minDim = Math.min(this.width, this.height);
    const nearRadius = minDim * 0.43;
    const farRadius = minDim * 0.052;
    const d = Math.max(0, Math.min(1, depth));
    const radius = farRadius + (nearRadius - farRadius) * Math.pow(d, 0.82);
    // A small vertical compression gives the tube a broad arcade-monitor shape.
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius * 0.73,
    };
  }

  private radial(lane: number): Vec2 {
    const angle = this.laneAngle(lane);
    return { x: Math.cos(angle), y: Math.sin(angle) * 0.73 };
  }

  private tangent(lane: number): Vec2 {
    const angle = this.laneAngle(lane);
    return { x: -Math.sin(angle), y: Math.cos(angle) * 0.73 };
  }

  private laneAngle(lane: number): number {
    return -Math.PI / 2 + (this.wrapLane(lane) / this.laneCount) * TAU;
  }

  private laneDistance(a: number, b: number): number {
    const raw = Math.abs(this.wrapLane(a) - this.wrapLane(b));
    return Math.min(raw, this.laneCount - raw);
  }

  private wrapLane(lane: number): number {
    return ((lane % this.laneCount) + this.laneCount) % this.laneCount;
  }

  private laneColor(lane: number, brightness: number): number {
    const t = lane / this.laneCount;
    return this.rgbFromHsv(t, 0.68, brightness);
  }

  private depthColor(depth: number): number {
    const hue = 0.54 + depth * 0.23;
    return this.rgbFromHsv(hue % 1, 0.62, 0.62 + depth * 0.32);
  }

  private rgbFromHsv(h: number, s: number, v: number): number {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    const sextant = i % 6;
    const [r, g, b] = sextant === 0 ? [v, t, p]
      : sextant === 1 ? [q, v, p]
        : sextant === 2 ? [p, v, t]
          : sextant === 3 ? [p, q, v]
            : sextant === 4 ? [t, p, v]
              : [v, p, q];
    return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
  }

  private wasPressed(input: InputSnapshot, button: keyof InputSnapshot['buttons']): boolean {
    return input.buttons[button] && !(this.lastInput?.buttons[button] ?? false);
  }
}
