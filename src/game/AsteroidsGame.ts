import type { InputSnapshot, Vec2, VectorPath } from './types';

export interface ShipState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  invulnerableMs: number;
}

export interface BulletState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifeMs: number;
}

export interface AsteroidState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  vertices: number[];
  color: number;
}

export interface GameState {
  width: number;
  height: number;
  ship: ShipState;
  bullets: BulletState[];
  asteroids: AsteroidState[];
  shootCooldownMs: number;
  score: number;
  paused: boolean;
}

export interface AsteroidsGameOptions {
  onSettingsRequested?: () => void;
  random?: () => number;
  initialAsteroidCount?: number;
  autoRespawn?: boolean;
}

const TAU = Math.PI * 2;
const ASTEROID_COLORS = [0xffb347, 0xff5da2, 0x79e6ff, 0xbaff66, 0xd8a6ff];

export class AsteroidsGame {
  private width = 1600;
  private height = 1000;
  private ship: ShipState = this.newShip();
  private bullets: BulletState[] = [];
  private asteroids: AsteroidState[] = [];
  private shootCooldownMs = 0;
  private score = 0;
  private paused = false;
  private lastInput: InputSnapshot | null = null;
  private readonly onSettingsRequested?: () => void;
  private readonly random: () => number;
  private readonly autoRespawn: boolean;

  constructor(options: AsteroidsGameOptions = {}) {
    this.onSettingsRequested = options.onSettingsRequested;
    this.random = options.random ?? Math.random;
    this.autoRespawn = options.autoRespawn ?? true;
    this.resetAsteroids(options.initialAsteroidCount ?? 8);
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.ship.x = this.wrap(this.ship.x, this.width);
    this.ship.y = this.wrap(this.ship.y, this.height);
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

    const turn = Math.max(-1, Math.min(1, input.joystick.x + (input.buttons.r ? 1 : 0) - (input.buttons.l ? 1 : 0)));
    const thrust = Math.max(0, Math.min(1, -input.joystick.y + (input.buttons.b ? 1 : 0)));

    this.ship.angle += turn * 3.7 * dt;
    if (thrust > 0.02) {
      const power = 410 * thrust;
      this.ship.vx += Math.cos(this.ship.angle) * power * dt;
      this.ship.vy += Math.sin(this.ship.angle) * power * dt;
    }

    if (input.buttons.y) {
      const damping = Math.pow(0.10, dt);
      this.ship.vx *= damping;
      this.ship.vy *= damping;
    }

    this.ship.vx *= Math.pow(0.994, dt * 60);
    this.ship.vy *= Math.pow(0.994, dt * 60);
    this.ship.x = this.wrap(this.ship.x + this.ship.vx * dt, this.width);
    this.ship.y = this.wrap(this.ship.y + this.ship.vy * dt, this.height);
    this.ship.invulnerableMs = Math.max(0, this.ship.invulnerableMs - safeDtMs);

    if (this.wasPressed(input, 'x')) this.hyperspace();

    this.shootCooldownMs -= safeDtMs;
    if (input.buttons.a && this.shootCooldownMs <= 0) {
      this.fire();
      this.shootCooldownMs = 155;
    }

    for (const bullet of this.bullets) {
      bullet.x = this.wrap(bullet.x + bullet.vx * dt, this.width);
      bullet.y = this.wrap(bullet.y + bullet.vy * dt, this.height);
      bullet.lifeMs -= safeDtMs;
    }
    this.bullets = this.bullets.filter((bullet) => bullet.lifeMs > 0);

    for (const asteroid of this.asteroids) {
      asteroid.x = this.wrap(asteroid.x + asteroid.vx * dt, this.width);
      asteroid.y = this.wrap(asteroid.y + asteroid.vy * dt, this.height);
      asteroid.rotation += asteroid.rotationSpeed * dt;
    }

    this.resolveBulletCollisions();
    this.resolveShipCollision();

    if (this.autoRespawn && this.asteroids.length === 0) this.resetAsteroids(10);
    this.lastInput = input;
  }

  getVectorPaths(input: InputSnapshot): VectorPath[] {
    const paths: VectorPath[] = [];

    for (const asteroid of this.asteroids) {
      paths.push({
        points: asteroid.vertices.map((r, index) => {
          const angle = asteroid.rotation + (index / asteroid.vertices.length) * TAU;
          return {
            x: asteroid.x + Math.cos(angle) * asteroid.radius * r,
            y: asteroid.y + Math.sin(angle) * asteroid.radius * r,
          };
        }),
        color: asteroid.color,
        intensity: 0.78,
        width: 1.15,
        closed: true,
      });
    }

    for (const bullet of this.bullets) {
      const speed = Math.max(1, Math.hypot(bullet.vx, bullet.vy));
      const ux = bullet.vx / speed;
      const uy = bullet.vy / speed;
      paths.push({
        points: [
          { x: bullet.x - ux * 7, y: bullet.y - uy * 7 },
          { x: bullet.x + ux * 7, y: bullet.y + uy * 7 },
        ],
        color: 0xffffff,
        intensity: 1.35,
        width: 1.4,
      });
    }

    const blink = this.ship.invulnerableMs > 0 && Math.floor(this.ship.invulnerableMs / 90) % 2 === 0;
    if (!blink) {
      const c = Math.cos(this.ship.angle);
      const s = Math.sin(this.ship.angle);
      const transform = (x: number, y: number): Vec2 => ({
        x: this.ship.x + x * c - y * s,
        y: this.ship.y + x * s + y * c,
      });
      paths.push({
        points: [transform(22, 0), transform(-15, -13), transform(-9, 0), transform(-15, 13)],
        color: 0x62f4ff,
        intensity: 1.2,
        width: 1.45,
        closed: true,
      });

      const thrust = Math.max(0, Math.min(1, -input.joystick.y + (input.buttons.b ? 1 : 0)));
      if (thrust > 0.05) {
        paths.push({
          points: [transform(-11, -7), transform(-27 - this.random() * 8 * thrust, 0), transform(-11, 7)],
          color: 0xff5a3d,
          intensity: 1.05,
          width: 1.15,
        });
      }
    }

    return paths;
  }

  getHudText(): string {
    return `SCORE ${String(this.score).padStart(6, '0')}  //  ${this.paused ? 'PAUSED' : 'VECTOR MODE'}`;
  }

  /** Serializable state snapshot used by save/debug tooling and deterministic tests. */
  exportState(): GameState {
    return {
      width: this.width,
      height: this.height,
      ship: { ...this.ship },
      bullets: this.bullets.map((bullet) => ({ ...bullet })),
      asteroids: this.asteroids.map((asteroid) => ({ ...asteroid, vertices: [...asteroid.vertices] })),
      shootCooldownMs: this.shootCooldownMs,
      score: this.score,
      paused: this.paused,
    };
  }

  /** Restores a state snapshot. Input edge history is intentionally cleared. */
  importState(state: GameState): void {
    this.width = Math.max(1, state.width);
    this.height = Math.max(1, state.height);
    this.ship = { ...state.ship };
    this.bullets = state.bullets.map((bullet) => ({ ...bullet }));
    this.asteroids = state.asteroids.map((asteroid) => ({ ...asteroid, vertices: [...asteroid.vertices] }));
    this.shootCooldownMs = state.shootCooldownMs;
    this.score = state.score;
    this.paused = state.paused;
    this.lastInput = null;
  }

  private fire(): void {
    const speed = 690;
    const c = Math.cos(this.ship.angle);
    const s = Math.sin(this.ship.angle);
    this.bullets.push({
      x: this.ship.x + c * 26,
      y: this.ship.y + s * 26,
      vx: this.ship.vx + c * speed,
      vy: this.ship.vy + s * speed,
      lifeMs: 980,
    });
  }

  private hyperspace(): void {
    this.ship.x = this.width * (0.15 + this.random() * 0.7);
    this.ship.y = this.height * (0.15 + this.random() * 0.7);
    this.ship.vx *= 0.4;
    this.ship.vy *= 0.4;
    this.ship.invulnerableMs = 850;
  }

  private resolveBulletCollisions(): void {
    const bulletsToRemove = new Set<BulletState>();
    const asteroidsToRemove = new Set<AsteroidState>();
    const spawned: AsteroidState[] = [];

    for (const bullet of this.bullets) {
      for (const asteroid of this.asteroids) {
        if (this.torusDistanceSq(bullet.x, bullet.y, asteroid.x, asteroid.y) > asteroid.radius * asteroid.radius) continue;
        bulletsToRemove.add(bullet);
        asteroidsToRemove.add(asteroid);
        this.score += Math.round(1400 / asteroid.radius);

        if (asteroid.radius > 34) {
          spawned.push(this.createAsteroid(asteroid.x, asteroid.y, asteroid.radius * 0.58));
          spawned.push(this.createAsteroid(asteroid.x, asteroid.y, asteroid.radius * 0.58));
        }
        break;
      }
    }

    this.bullets = this.bullets.filter((bullet) => !bulletsToRemove.has(bullet));
    this.asteroids = this.asteroids.filter((asteroid) => !asteroidsToRemove.has(asteroid));
    this.asteroids.push(...spawned);
  }

  private resolveShipCollision(): void {
    if (this.ship.invulnerableMs > 0) return;
    for (const asteroid of this.asteroids) {
      const hitRadius = asteroid.radius + 11;
      if (this.torusDistanceSq(this.ship.x, this.ship.y, asteroid.x, asteroid.y) < hitRadius * hitRadius) {
        this.ship = this.newShip();
        return;
      }
    }
  }

  private resetAsteroids(count = 8): void {
    this.asteroids = [];
    for (let i = 0; i < count; i += 1) {
      let asteroid: AsteroidState;
      do {
        asteroid = this.createAsteroid(this.random() * this.width, this.random() * this.height, 48 + this.random() * 46);
      } while (this.torusDistanceSq(asteroid.x, asteroid.y, this.width / 2, this.height / 2) < 220 * 220);
      this.asteroids.push(asteroid);
    }
  }

  private createAsteroid(x: number, y: number, radius: number): AsteroidState {
    const angle = this.random() * TAU;
    const speed = 35 + this.random() * 75;
    const vertexCount = 8 + Math.floor(this.random() * 5);
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      rotation: this.random() * TAU,
      rotationSpeed: (this.random() - 0.5) * 0.85,
      vertices: Array.from({ length: vertexCount }, () => 0.72 + this.random() * 0.36),
      color: ASTEROID_COLORS[Math.floor(this.random() * ASTEROID_COLORS.length)] ?? 0xffb347,
    };
  }

  private newShip(): ShipState {
    return {
      x: this.width / 2,
      y: this.height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      invulnerableMs: 1400,
    };
  }

  private wasPressed(input: InputSnapshot, button: keyof InputSnapshot['buttons']): boolean {
    return input.buttons[button] && !(this.lastInput?.buttons[button] ?? false);
  }

  private wrap(value: number, max: number): number {
    return ((value % max) + max) % max;
  }

  private torusDistanceSq(ax: number, ay: number, bx: number, by: number): number {
    let dx = Math.abs(ax - bx);
    let dy = Math.abs(ay - by);
    dx = Math.min(dx, this.width - dx);
    dy = Math.min(dy, this.height - dy);
    return dx * dx + dy * dy;
  }
}
